(function(){
  "use strict";

  const MAX_AUTO_RETRIES=5;
  const WORK_TYPES=["create_work_report","update_work_report","delete_work_report"];
  const REQUEST_TYPES=["create_request","update_request","delete_request"];
  let running=false;
  let rerunRequested=false;
  let user={};

  const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  const now=()=>new Date().toISOString();
  const isProtected=()=>HasplAuth.isProtected();
  const can=key=>user.role==="admin"||user.role==="development"||user.featurePermissions?.[key]===true;
  const canSeeAllReports=()=>user.role==="admin"||user.role==="development";

  function queueEntry(type,entityId,projectId,extra={}){
    return {queueId:uid(),type,entityId,projectId:projectId||"",createdAt:now(),retryCount:0,lastError:"",...extra};
  }

  function signatureData(value){
    return typeof value==="string"?value:value?.dataUrl||"";
  }

  function signatureRef(value,key){
    const id=typeof value==="object"?value?.remoteAttachmentId||value?.attachmentId:"";
    return id?{key,attachmentId:id}:null;
  }

  function reportTypes(kinds={}){
    return [kinds.regie&&"Regiebericht",kinds.daily&&"Tagesbericht",kinds.material&&"Materialbericht"].filter(Boolean);
  }

  function sumWorkerKey(workers,key){
    return (workers||[]).reduce((sum,row)=>sum+(Number(row?.[key])||0),0);
  }

  function toServer(report){
    const refs=Object.entries(report.signatures||{}).map(([key,value])=>signatureRef(value,key)).filter(Boolean);
    if(report.type==="work"){
      return {
        id:report.id,
        projectId:report.projectId,
        reportNumber:report.reportNo||"",
        date:report.date||"",
        client:report.client||"",
        orderNumber:report.orderNo||"",
        reportTypes:reportTypes(report.kinds),
        lvSubposition:report.lvPosition||"",
        workDescription:report.services||"",
        employeeHours:report.workers||[],
        surcharge50Hours:sumWorkerKey(report.workers,"p50"),
        surcharge100Hours:sumWorkerKey(report.workers,"p100"),
        travelTimes:report.travel||{},
        materialLines:report.materials||[],
        note:report.remark||"",
        partialCompletion:report.completion==="partial",
        siteCompleted:report.completion==="completed",
        signatures:can("regieapp.work_reports.sign")?refs:undefined,
        revision:report.revision||undefined
      };
    }
    return {
      id:report.id,
      projectId:report.projectId,
      requestNumber:report.requestNo||"",
      approvalNumber:report.approvalNo||"",
      lvSubposition:report.lvPosition||"",
      executionPeriod:[report.periodFrom||"",report.periodTo||""].join("|").replace(/^\||\|$/g,""),
      serviceDescription:report.services||"",
      clientJustification:report.reason||"",
      installationLines:report.labor||[],
      materialLines:report.materials||[],
      totalAmount:requestTotal(report),
      specialNotes:report.remarks||"",
      signatures:refs,
      revision:report.revision||undefined
    };
  }

  function requestTotal(report){
    return (report.labor||[]).reduce((s,x)=>s+(Number(x.hours)||0)*(Number(x.rate)||0),0)+
      (report.materials||[]).reduce((s,x)=>s+(Number(x.quantity)||0)*(Number(x.rate)||0),0);
  }

  function workFromServer(remote,existing={}){
    const types=remote.reportTypes||remote.report_types||[];
    const normalized=types.map(x=>String(x).toLowerCase());
    return {
      ...existing,
      id:remote.id,
      type:"work",
      projectId:remote.projectId||remote.project_id||existing.projectId||"",
      reportNo:remote.reportNumber??remote.report_number??existing.reportNo??"",
      date:remote.date??remote.reportDate??remote.report_date??existing.date??"",
      client:remote.client??existing.client??"",
      orderNo:remote.orderNumber??remote.order_number??existing.orderNo??"",
      kinds:{
        regie:normalized.some(x=>x.includes("regie")),
        daily:normalized.some(x=>x.includes("tag")),
        material:normalized.some(x=>x.includes("material"))
      },
      lvPosition:remote.lvSubposition??remote.lv_subposition??existing.lvPosition??"",
      services:remote.workDescription??remote.work_description??existing.services??"",
      workers:remote.employeeHours??remote.employee_hours??existing.workers??[],
      travel:remote.travelTimes??remote.travel_times??existing.travel??{},
      materials:remote.materialLines??remote.material_lines??existing.materials??[],
      remark:remote.note??existing.remark??"",
      completion:(remote.siteCompleted??remote.site_completed)?"completed":(remote.partialCompletion??remote.partial_completion)?"partial":"open",
      serviceDrawing:existing.serviceDrawing||null,
      evidence:existing.evidence||[],
      signatures:existing.signatures||{},
      createdBy:remote.createdBy||remote.created_by||existing.createdBy||"",
      createdByName:remote.createdByName||remote.created_by_name||existing.createdByName||"",
      createdAt:remote.createdAt||remote.created_at||existing.createdAt||now(),
      updatedAt:remote.updatedAt||remote.updated_at||existing.updatedAt||now(),
      revision:Number(remote.revision)||existing.revision||1,
      serverUpdatedAt:remote.updatedAt||remote.updated_at||"",
      syncStatus:"synced",
      conflict:null
    };
  }

  function requestFromServer(remote,existing={}){
    const period=String(remote.executionPeriod??remote.execution_period??"").split("|");
    return {
      ...existing,
      id:remote.id,
      type:"regie-request",
      projectId:remote.projectId||remote.project_id||existing.projectId||"",
      requestNo:remote.requestNumber??remote.request_number??existing.requestNo??"",
      approvalNo:remote.approvalNumber??remote.approval_number??existing.approvalNo??"",
      lvPosition:remote.lvSubposition??remote.lv_subposition??existing.lvPosition??"",
      periodFrom:period[0]||existing.periodFrom||"",
      periodTo:period[1]||existing.periodTo||"",
      services:remote.serviceDescription??remote.service_description??existing.services??"",
      reason:remote.clientJustification??remote.client_justification??existing.reason??"",
      labor:remote.installationLines??remote.installation_lines??existing.labor??[],
      materials:remote.materialLines??remote.material_lines??existing.materials??[],
      remarks:remote.specialNotes??remote.special_notes??existing.remarks??"",
      evidence:existing.evidence||[],
      signatures:existing.signatures||{},
      createdBy:remote.createdBy||remote.created_by||existing.createdBy||"",
      createdByName:remote.createdByName||remote.created_by_name||existing.createdByName||"",
      createdAt:remote.createdAt||remote.created_at||existing.createdAt||now(),
      updatedAt:remote.updatedAt||remote.updated_at||existing.updatedAt||now(),
      revision:Number(remote.revision)||existing.revision||1,
      serverUpdatedAt:remote.updatedAt||remote.updated_at||"",
      syncStatus:"synced",
      conflict:null
    };
  }

  function fromServer(remote,type,existing={}){
    return type==="work"?workFromServer(remote,existing):requestFromServer(remote,existing);
  }

  async function queueReport(report){
    if(!report||report.deletedAt)return;
    if(report.manualProject){report.syncStatus="local";report.lastSyncError="";await RegieDB.put("reports",report);emitStatus();return;}
    report.syncStatus="pending";
    report.lastSyncError="";
    await RegieDB.put("reports",report);
    const isWork=report.type==="work";
    const types=isWork?WORK_TYPES:REQUEST_TYPES;
    const type=report.revision?(isWork?"update_work_report":"update_request"):(isWork?"create_work_report":"create_request");
    await RegieDB.replaceQueueForEntity(report.id,types,queueEntry(type,report.id,report.projectId));
    await prepareAttachments(report);
    await RegieDB.put("reports",report);
    emitStatus();
    if(navigator.onLine)run();
  }

  async function queueDelete(report){
    if(!report)return;
    const types=report.type==="work"?WORK_TYPES:REQUEST_TYPES;
    if(!report.revision){
      await RegieDB.replaceQueueForEntity(report.id,types,null);
      await RegieDB.remove("reports",report.id);
      emitStatus();
      return;
    }
    report.deletedAt=now();
    report.syncStatus="pending";
    await RegieDB.put("reports",report);
    const type=report.type==="work"?"delete_work_report":"delete_request";
    await RegieDB.replaceQueueForEntity(report.id,types,queueEntry(type,report.id,report.projectId));
    if(report.serviceDrawing?.remoteAttachmentId)await queueAttachmentDelete(report,report.serviceDrawing.remoteAttachmentId);
    for(const item of report.evidence||[])if(item.remoteAttachmentId)await queueAttachmentDelete(report,item.remoteAttachmentId);
    for(const value of Object.values(report.signatures||{}))if(typeof value==="object"&&value.remoteAttachmentId)await queueAttachmentDelete(report,value.remoteAttachmentId);
    emitStatus();
    if(navigator.onLine)run();
  }

  async function prepareAttachments(report){
    let changed=false;
    const serviceDrawing=report.serviceDrawing;
    if(serviceDrawing?.preview){
      if(!serviceDrawing.attachmentId){serviceDrawing.attachmentId=uid();changed=true;}
      if(!serviceDrawing.remoteAttachmentId){
        await RegieDB.replaceQueueForEntity(serviceDrawing.attachmentId,["upload_attachment","delete_attachment"],queueEntry("upload_attachment",serviceDrawing.attachmentId,report.projectId,{reportId:report.id,reportType:report.type,itemId:"serviceDrawing",slot:"serviceDrawing"}));
      }
    }
    for(const item of report.evidence||[]){
      if(!item.attachmentId){item.attachmentId=uid();changed=true;}
      if(!item.remoteAttachmentId){
        await RegieDB.replaceQueueForEntity(item.attachmentId,["upload_attachment","delete_attachment"],queueEntry("upload_attachment",item.attachmentId,report.projectId,{reportId:report.id,reportType:report.type,itemId:item.id,slot:"evidence"}));
      }
    }
    for(const [key,value] of Object.entries(report.signatures||{})){
      if(!signatureData(value))continue;
      let record=value;
      if(typeof value==="string"){
        record={dataUrl:value,attachmentId:uid()};
        report.signatures[key]=record;
        changed=true;
      }
      if(!record.attachmentId){record.attachmentId=uid();changed=true;}
      if(!record.remoteAttachmentId){
        await RegieDB.replaceQueueForEntity(record.attachmentId,["upload_attachment","delete_attachment"],queueEntry("upload_attachment",record.attachmentId,report.projectId,{reportId:report.id,reportType:report.type,itemId:key,slot:"signature"}));
      }
    }
    if(changed)report.updatedAt=report.updatedAt||now();
  }

  async function queueAttachmentDelete(report,attachmentId){
    if(!attachmentId)return;
    await RegieDB.replaceQueueForEntity(attachmentId,["upload_attachment","delete_attachment"],queueEntry("delete_attachment",attachmentId,report?.projectId||"",{reportId:report?.id||""}));
    emitStatus();
    if(navigator.onLine)run();
  }

  async function queueLv(projectId,record){
    if(!projectId||!record)return;
    await RegieDB.replaceQueueForEntity(projectId,["put_lv"],queueEntry("put_lv",projectId,projectId));
    emitStatus();
    if(navigator.onLine)run();
  }

  async function syncEntity(entry){
    const report=await RegieDB.get("reports",entry.entityId);
    if(!report)return;
    const work=entry.type.includes("work_report");
    const base=work?"/api/regie/work-reports":"/api/regie/requests";
    if(entry.type.startsWith("delete_")){
      try{await RegieAPI.request(`${base}/${encodeURIComponent(report.id)}`,{method:"DELETE"});}
      catch(error){if(error.status!==404)throw error;}
      await RegieDB.remove("reports",report.id);
      return;
    }
    const payload=toServer(report);
    let result;
    try{
      result=report.revision?
        await RegieAPI.request(`${base}/${encodeURIComponent(report.id)}`,{method:"PATCH",json:payload}):
        await RegieAPI.request(base,{method:"POST",json:payload});
    }catch(error){
      if(error.status===409&&(error.payload?.error==="revision_conflict"||error.payload?.error==="id_exists")){
        await markConflict(report,base,error);
        return "conflict";
      }
      throw error;
    }
    const remote=work?(result.workReport||result.work_report):(result.request);
    const merged=fromServer(remote,report.type,report);
    await RegieDB.put("reports",merged);
  }

  async function markConflict(report,base,error){
    let remote=null;
    try{
      const result=await RegieAPI.request(`${base}/${encodeURIComponent(report.id)}`);
      remote=report.type==="work"?(result.workReport||result.work_report):result.request;
    }catch(_){}
    report.syncStatus="conflict";
    report.conflict={server:remote,serverRevision:Number(remote?.revision||error.payload?.serverRevision)||null,serverUpdatedAt:remote?.updatedAt||remote?.updated_at||error.payload?.serverUpdatedAt||"",detectedAt:now()};
    report.lastSyncError="Dieser Bericht wurde zwischenzeitlich geändert.";
    await RegieDB.put("reports",report);
  }

  function dataUrlBlob(dataUrl){
    const match=String(dataUrl||"").match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
    if(!match)throw new Error("Lokale Bilddaten fehlen");
    const mime=match[1]||"image/png";
    const bytes=match[2]?Uint8Array.from(atob(match[3]),c=>c.charCodeAt(0)):new TextEncoder().encode(decodeURIComponent(match[3]));
    return new Blob([bytes],{type:mime});
  }

  function extension(mime){return mime==="image/jpeg"?"jpg":mime==="image/webp"?"webp":"png";}

  async function syncAttachment(entry){
    const report=await RegieDB.get("reports",entry.reportId);
    if(!report)return;
    let source,annotated,category="Ausführung",description="",name="Bild";
    if(entry.slot==="signature"){
      const record=report.signatures?.[entry.itemId];
      source=signatureData(record);
      category="Unterschrift";
      description=entry.itemId;
      name=`Unterschrift-${entry.itemId}`;
    }else if(entry.slot==="serviceDrawing"){
      source=report.serviceDrawing?.preview;
      category="Arbeitsleistung";
      description="Handschriftliche Arbeitsleistung";
      name="Arbeitsleistung-handschriftlich";
    }else{
      const item=(report.evidence||[]).find(x=>x.id===entry.itemId);
      if(!item)return;
      source=item.type==="photo"?(item.drawing?.background||item.preview):item.preview;
      if(!/^data:image\/(jpeg|png|webp);/i.test(source||""))source=item.preview;
      annotated=item.type==="photo"&&item.preview!==source?item.preview:null;
      category=item.category|| (item.type==="sketch"?"Skizze":"Ausführung");
      description=item.description||"";
      name=item.name||category;
    }
    if(!source)return;
    const originalBlob=dataUrlBlob(source);
    const form=new FormData();
    form.append("id",entry.entityId);
    form.append("projectId",report.projectId);
    form.append("reportId",report.id);
    form.append("reportType",report.type);
    form.append("category",category);
    form.append("description",description);
    form.append("capturedAt",report.updatedAt||now());
    form.append("file",originalBlob,`${name}.${extension(originalBlob.type)}`);
    if(annotated){
      const annotatedBlob=dataUrlBlob(annotated);
      form.append("annotated",annotatedBlob,`${name}-markiert.${extension(annotatedBlob.type)}`);
    }
    let result;
    try{
      result=await RegieAPI.request("/api/regie/attachments",{method:"POST",body:form,timeout:60000});
    }catch(error){
      if(error.status===409&&error.payload?.error==="id_exists")result=await RegieAPI.request(`/api/regie/attachments/${encodeURIComponent(entry.entityId)}`);
      else throw error;
    }
    const attachment=result.attachment;
    if(entry.slot==="signature"){
      const current=report.signatures?.[entry.itemId];
      report.signatures[entry.itemId]={dataUrl:signatureData(current),attachmentId:entry.entityId,remoteAttachmentId:attachment.id,syncedAt:now()};
    }else if(entry.slot==="serviceDrawing"){
      if(report.serviceDrawing){report.serviceDrawing.remoteAttachmentId=attachment.id;report.serviceDrawing.syncedAt=now();}
    }else{
      const item=(report.evidence||[]).find(x=>x.id===entry.itemId);
      if(item){item.remoteAttachmentId=attachment.id;item.attachmentSyncedAt=now();}
    }
    await RegieDB.put("reports",report);
  }

  async function syncLv(entry){
    const record=await RegieDB.masterGet(`lv:${entry.projectId}`);
    if(!record)return;
    const positions=(record.positions||[]).map(p=>({
      lg:p.lg||"",positionNumber:p.pos||p.positionNumber||"",positionText:p.text||p.positionText||"",
      lvQuantity:p.lv_qty??p.lvQuantity??null,unit:p.unit||"",laborPerUnit:p.labor??p.laborPerUnit??null,
      otherPerUnit:p.material??p.otherPerUnit??null,unitPrice:p.ep??p.unitPrice??null
    }));
    const result=await RegieAPI.request(`/api/regie/projects/${encodeURIComponent(entry.projectId)}/lv`,{method:"PUT",json:{sourceFile:record.sourceFile||"",positions},timeout:60000});
    record.serverImportedAt=Math.max(0,...(result.positions||[]).map(p=>Date.parse(p.importedAt||p.imported_at)||0));
    record.syncStatus="synced";
    record.syncedAt=now();
    await RegieDB.masterPut(`lv:${entry.projectId}`,record);
  }

  async function processEntry(entry){
    if(WORK_TYPES.includes(entry.type)||REQUEST_TYPES.includes(entry.type))return syncEntity(entry);
    if(entry.type==="upload_attachment")return syncAttachment(entry);
    if(entry.type==="delete_attachment"){
      try{await RegieAPI.request(`/api/regie/attachments/${encodeURIComponent(entry.entityId)}`,{method:"DELETE"});}
      catch(error){if(error.status!==404)throw error;}
      return;
    }
    if(entry.type==="put_lv")return syncLv(entry);
  }

  async function run(options={}){
    if(running){rerunRequested=true;return;}
    if(!navigator.onLine||!isProtected())return;
    running=true;
    await emitStatus();
    try{
      const entries=(await RegieDB.getAll("syncQueue")).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
      for(const entry of entries){
        if(!options.manual&&Number(entry.retryCount)>=MAX_AUTO_RETRIES)continue;
        try{
          const outcome=await processEntry(entry);
          await RegieDB.remove("syncQueue",entry.queueId);
          if(outcome==="conflict")continue;
        }catch(error){
          entry.retryCount=Number(entry.retryCount||0)+1;
          entry.lastError=error.payload?.error||error.message||"Synchronisierungsfehler";
          entry.lastTriedAt=now();
          await RegieDB.put("syncQueue",entry);
          const report=entry.reportId?await RegieDB.get("reports",entry.reportId):await RegieDB.get("reports",entry.entityId);
          if(report&&!report.conflict){report.syncStatus="error";report.lastSyncError=entry.lastError;await RegieDB.put("reports",report);}
          if(!navigator.onLine||error.status===0)break;
        }
        await emitStatus();
      }
      await refreshReportStatuses();
      await pullRemote();
    }finally{
      running=false;
      await emitStatus();
      if(rerunRequested){rerunRequested=false;setTimeout(()=>run(),0);}
    }
  }

  async function refreshReportStatuses(){
    const queue=await RegieDB.getAll("syncQueue");
    const active=new Set(queue.flatMap(q=>[q.entityId,q.reportId]).filter(Boolean));
    for(const report of await RegieDB.getAll("reports")){
      if(report.deletedAt||report.conflict)continue;
      const hasPending=active.has(report.id)||active.has(report.serviceDrawing?.attachmentId)||(report.evidence||[]).some(x=>active.has(x.attachmentId))||Object.values(report.signatures||{}).some(x=>typeof x==="object"&&active.has(x.attachmentId));
      const failed=queue.some(q=>(q.entityId===report.id||q.reportId===report.id)&&q.retryCount>0);
      const next=failed?"error":hasPending?"pending":report.revision?"synced":"local";
      if(report.syncStatus!==next){report.syncStatus=next;await RegieDB.put("reports",report);}
    }
  }

  async function pullRemote(){
    if(!navigator.onLine||!isProtected())return;
    const jobs=[];
    if(can("regieapp.work_reports.view"))jobs.push(RegieAPI.request("/api/regie/work-reports").then(r=>mergeRemote(r.workReports||r.work_reports||[],"work")));
    if(can("regieapp.requests.view"))jobs.push(RegieAPI.request("/api/regie/requests").then(r=>mergeRemote(r.requests||[],"regie-request")));
    await Promise.allSettled(jobs);
    window.dispatchEvent(new CustomEvent("regie-data-updated"));
  }

  async function mergeRemote(rows,type){
    for(const remote of rows){
      const owner=remote.createdBy||remote.created_by||"";
      if(!canSeeAllReports()&&owner!==user.id)continue;
      const local=await RegieDB.get("reports",remote.id);
      if(!local){
        const report=fromServer(remote,type);
        await RegieDB.put("reports",report);
        await pullAttachments(report);
        continue;
      }
      if(local.deletedAt||local.syncStatus==="pending"||local.syncStatus==="error"||local.syncStatus==="conflict")continue;
      const report=Number(remote.revision)>Number(local.revision||0)?fromServer(remote,type,local):local;
      if(report!==local)await RegieDB.put("reports",report);
      await pullAttachments(report);
    }
  }

  async function blobDataUrl(blob){
    const bytes=new Uint8Array(await blob.arrayBuffer());
    let binary="";
    for(let offset=0;offset<bytes.length;offset+=32768){
      binary+=String.fromCharCode(...bytes.subarray(offset,offset+32768));
    }
    return `data:${blob.type||"application/octet-stream"};base64,${btoa(binary)}`;
  }

  function attachmentUrl(attachment){
    return attachment.annotatedUrl||attachment.annotated_url||attachment.fileUrl||attachment.file_url||
      `/api/regie/attachments/${encodeURIComponent(attachment.id)}/file`;
  }

  function attachmentDate(attachment){
    return attachment.capturedAt||attachment.captured_at||attachment.createdAt||attachment.created_at||now();
  }

  async function pullAttachments(report){
    if(!report?.id||!navigator.onLine||!isProtected())return report;
    const query=`report_id=${encodeURIComponent(report.id)}&report_type=${encodeURIComponent(report.type)}`;
    let attachments;
    try{
      const result=await RegieAPI.request(`/api/regie/attachments?${query}`);
      attachments=result.attachments||[];
    }catch(_){return report;}

    let changed=false;
    const evidence=report.evidence||[];
    const signatures=report.signatures||{};
    for(const attachment of attachments){
      if(!attachment?.id)continue;
      const category=attachment.category||"Ausführung";
      if(category==="Arbeitsleistung"){
        if(report.serviceDrawing?.preview)continue;
        try{
          const dataUrl=await blobDataUrl(await RegieAPI.blob(attachmentUrl(attachment),{timeout:60000}));
          report.serviceDrawing={drawing:{background:dataUrl,objects:[]},preview:dataUrl,attachmentId:attachment.id,remoteAttachmentId:attachment.id,syncedAt:attachmentDate(attachment),remoteOnly:true};
          changed=true;
        }catch(_){}
        continue;
      }
      if(category==="Unterschrift"){
        const key=attachment.description||"";
        if(!key||signatureData(signatures[key]))continue;
        try{
          const dataUrl=await blobDataUrl(await RegieAPI.blob(attachmentUrl(attachment),{timeout:60000}));
          signatures[key]={dataUrl,attachmentId:attachment.id,remoteAttachmentId:attachment.id,syncedAt:attachmentDate(attachment),remoteOnly:true};
          changed=true;
        }catch(_){}
        continue;
      }

      const existing=evidence.find(item=>item.remoteAttachmentId===attachment.id||item.attachmentId===attachment.id);
      if(existing?.preview)continue;
      try{
        const dataUrl=await blobDataUrl(await RegieAPI.blob(attachmentUrl(attachment),{timeout:60000}));
        const type=category==="Skizze"?"sketch":"photo";
        const values={
          id:existing?.id||`remote-${attachment.id}`,
          type,
          name:attachment.fileName||attachment.file_name||category,
          category,
          description:attachment.description||"",
          createdAt:attachmentDate(attachment),
          drawing:{background:dataUrl,objects:[]},
          preview:dataUrl,
          attachmentId:attachment.id,
          remoteAttachmentId:attachment.id,
          attachmentSyncedAt:attachment.updatedAt||attachment.updated_at||attachmentDate(attachment),
          remoteOnly:true
        };
        if(existing)Object.assign(existing,values);else evidence.push(values);
        changed=true;
      }catch(_){}
    }
    if(changed){
      report.evidence=evidence;
      report.signatures=signatures;
      await RegieDB.put("reports",report);
    }
    return report;
  }

  async function pullLv(projectId){
    if(!projectId||!navigator.onLine||!isProtected()||!can("regieapp.lv.view"))return null;
    const pending=(await RegieDB.getAll("syncQueue")).some(q=>q.type==="put_lv"&&q.projectId===projectId);
    if(pending)return null;
    try{
      const result=await RegieAPI.request(`/api/regie/projects/${encodeURIComponent(projectId)}/lv`);
      const positions=(result.positions||[]).map(p=>({
        lg:p.lg||"",pos:p.positionNumber||p.position_number||"",text:p.positionText||p.position_text||"",
        lv_qty:p.lvQuantity??p.lv_quantity??0,unit:p.unit||"",labor:p.laborPerUnit??p.labor_per_unit??0,
        material:p.otherPerUnit??p.other_per_unit??0,ep:p.unitPrice??p.unit_price??0
      }));
      const local=await RegieDB.masterGet(`lv:${projectId}`);
      if(!positions.length){
        if(local?.positions?.length){
          const deleted={projectId,sourceFile:"",importedAt:new Date().toISOString(),serverImportedAt:Date.now(),positions:[],syncStatus:"synced",deletedAt:new Date().toISOString()};
          await RegieDB.masterPut(`lv:${projectId}`,deleted);
          return deleted;
        }
        return local||null;
      }
      const remoteStamp=Math.max(0,...(result.positions||[]).map(p=>Date.parse(p.importedAt||p.imported_at)||0));
      const localStamp=Math.max(Date.parse(local?.importedAt)||0,Number(local?.serverImportedAt)||0);
      if(!local||remoteStamp>localStamp){
        const record={projectId,sourceFile:(result.positions?.[0]?.sourceFile||result.positions?.[0]?.source_file||"Portal"),importedAt:new Date(remoteStamp||Date.now()).toISOString(),serverImportedAt:remoteStamp,positions,syncStatus:"synced"};
        await RegieDB.masterPut(`lv:${projectId}`,record);
        return record;
      }
      return local;
    }catch(_){return null;}
  }

  async function resolveConflict(id,mode){
    const report=await RegieDB.get("reports",id);
    if(!report?.conflict?.server)return false;
    if(mode==="server"){
      const resolved=fromServer(report.conflict.server,report.type,report);
      resolved.conflict=null;
      resolved.syncStatus="synced";
      await RegieDB.put("reports",resolved);
    }else{
      report.revision=report.conflict.serverRevision||report.conflict.server.revision;
      report.conflict=null;
      report.syncStatus="pending";
      await RegieDB.put("reports",report);
      await queueReport(report);
    }
    window.dispatchEvent(new CustomEvent("regie-data-updated"));
    return true;
  }

  async function emitStatus(){
    const queue=await RegieDB.getAll("syncQueue");
    const reports=await RegieDB.getAll("reports");
    const detail={pending:queue.length,failed:queue.filter(q=>q.retryCount>0).length,conflicts:reports.filter(r=>r.conflict&&!r.deletedAt).length,running};
    window.dispatchEvent(new CustomEvent("regie-sync-status",{detail}));
    return detail;
  }

  async function initialize(currentUser){
    user=currentUser||{};
    for(const report of await RegieDB.getAll("reports")){
      if(!report.deletedAt&&!report.revision&&!report.conflict&&!report.manualProject)await queueReport(report);
    }
    await emitStatus();
    if(navigator.onLine){await run();}
  }

  window.RegieSync=Object.freeze({initialize,run,queueReport,queueDelete,queueAttachmentDelete,queueLv,pullLv,pullRemote,pullAttachments,resolveConflict,emitStatus,can,signatureData});
})();
