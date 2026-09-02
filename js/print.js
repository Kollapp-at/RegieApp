(function(){
  "use strict";

  const COLORS={blue:[18,59,87],blueLine:[34,112,158],green:[39,135,72],orange:[207,121,31],ink:[23,38,51],muted:[91,108,120],line:[205,216,223],pale:[235,243,248],paper:[249,251,252],white:[255,255,255]};
  const PAGE={width:210,height:297,left:10,right:10,top:9,contentTop:38,bottom:282};
  const VORAU_COMPANY={companyName:"Elektrotechnik Haspl GmbH",street:"Bahnhofstraße 80",postalCode:"8250",city:"Vorau",country:"Österreich",phone:"+43 3337/30 006",email:"office@elektro-haspl.at",uid:"ATU69159117",firmenbuch:"FN425444d"};
  const fmt=value=>new Intl.NumberFormat("de-AT",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
  const euro=value=>new Intl.NumberFormat("de-AT",{style:"currency",currency:"EUR"}).format(Number(value)||0);
  const date=value=>value?new Intl.DateTimeFormat("de-AT",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"";
  const text=value=>String(value??"").trim();
  const signature=value=>typeof value==="string"?value:value?.dataUrl||value?.preview||"";
  const unit=value=>text(value)==="Psch"?"PA":text(value);

  function reportTitle(report){
    if(report.type==="weekly")return "Wochenbericht";
    if(report.type!=="work")return "Regieanforderung";
    if(report.kinds?.regie)return "Regiebericht";
    if(report.kinds?.daily)return "Tagesbericht";
    if(report.kinds?.material)return "Materialbericht";
    return "Arbeitsbericht";
  }

  function context(report,master){
    const projects=master.projects||[],branches=master.branches||[];
    const portalProject=projects.find(project=>String(project.id||"")===String(report.projectId||""))||{};
    const project=report.manualProject?{...portalProject,...report.manualProject}:portalProject;
    const headOffice=branches.find(branch=>text(branch.city).toLocaleLowerCase("de-AT")==="vorau")
      ||branches.find(branch=>`${text(branch.name)} ${text(branch.code)}`.toLocaleLowerCase("de-AT").includes("vorau"))
      ||{};
    return {project,headOffice};
  }

  function imageUrl(value){
    if(!value)return "";
    try{return new URL(value,location.href).href}catch{return value}
  }

  async function asDataUrl(value){
    if(!value)return "";
    if(/^data:image\//i.test(value))return value;
    try{
      const response=await fetch(imageUrl(value),{credentials:"same-origin"});
      if(!response.ok)throw new Error(String(response.status));
      const blob=await response.blob();
      return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});
    }catch{return ""}
  }

  function imageSize(doc,src,maxWidth,maxHeight,maxScale=.22){
    try{
      const props=doc.getImageProperties(src),ratio=Math.min(maxWidth/props.width,maxHeight/props.height,maxScale);
      return {props,width:Math.max(1,props.width*ratio),height:Math.max(1,props.height*ratio)};
    }catch{return null}
  }

  function addContainedImage(doc,src,x,y,width,height,limitUpscaling=false){
    if(!src)return false;
    try{
      const props=doc.getImageProperties(src),ratio=Math.min(width/props.width,height/props.height,limitUpscaling?.22:Number.POSITIVE_INFINITY),imageWidth=props.width*ratio,imageHeight=props.height*ratio;
      doc.addImage(src,props.fileType||"PNG",x+(width-imageWidth)/2,y+(height-imageHeight)/2,imageWidth,imageHeight,undefined,"FAST");
      return true;
    }catch{return false}
  }

  async function loadBrowserImage(src){
    if(typeof Image==="undefined")return null;
    return await new Promise(resolve=>{const value=new Image();value.onload=()=>resolve(value);value.onerror=()=>resolve(null);value.src=src});
  }

  async function hasRelevantDrawing(src){
    if(!src)return false;
    if(typeof document==="undefined"||typeof Image==="undefined")return true;
    const image=await loadBrowserImage(src);
    if(!image)return false;
    try{
      const scale=Math.min(1,260/Math.max(image.width,image.height)),canvas=document.createElement("canvas");
      canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
      const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,total=canvas.width*canvas.height;
      let relevant=0;
      for(let index=0;index<pixels.length;index+=4){
        const alpha=pixels[index+3];if(alpha<32)continue;
        const red=pixels[index],green=pixels[index+1],blue=pixels[index+2],minimum=Math.min(red,green,blue),maximum=Math.max(red,green,blue);
        if(minimum<145||maximum-minimum>70)relevant++;
      }
      return relevant>Math.max(7,total*.00018);
    }catch{return true}
  }

  function setColor(doc,color){doc.setTextColor(...color)}
  function newPage(doc,state){doc.addPage();state.y=PAGE.contentTop}
  function ensure(doc,state,height){if(state.y+height>PAGE.bottom)newPage(doc,state)}

  function sectionTitle(doc,state,title){
    ensure(doc,state,18);
    doc.setFillColor(...COLORS.blueLine);doc.roundedRect(PAGE.left,state.y+.7,1.7,4.7,.8,.8,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(11.2);setColor(doc,COLORS.blue);doc.text(title,PAGE.left+4.5,state.y+4.5);
    doc.setDrawColor(...COLORS.line);doc.setLineWidth(.25);doc.line(PAGE.left+4.5,state.y+6,200,state.y+6);
    state.y+=8;
  }

  function companyLines(branch={}){
    return {
      ...VORAU_COMPANY,
      addressLines:[VORAU_COMPANY.street,`${VORAU_COMPANY.postalCode} ${VORAU_COMPANY.city}`,VORAU_COMPANY.country],
      legalLines:[`UID-Nr. ${VORAU_COMPANY.uid}`,`Firmenbuch-Nr. ${VORAU_COMPANY.firmenbuch}`],
      reportLogoUrl:text(branch.reportLogoUrl),
      available:true,
    };
  }

  function drawCompanyBand(doc,state,branch,logo){
    const company=companyLines(branch);
    if(!addContainedImage(doc,logo,PAGE.left,state.y,47,17)){
      doc.setFont("helvetica","bold");doc.setFontSize(18);setColor(doc,COLORS.blue);doc.text("HASPL",PAGE.left,state.y+10.5);
    }
    const right=200;
    if(company.available){
       let cursor=state.y+2.5;
       doc.setFont("helvetica","bold");doc.setFontSize(8.8);setColor(doc,COLORS.blue);doc.text(company.companyName,right,cursor,{align:"right"});cursor+=3;
       doc.setFont("helvetica","normal");doc.setFontSize(6.7);setColor(doc,COLORS.ink);
       company.addressLines.forEach(line=>{doc.text(line,right,cursor,{align:"right"});cursor+=2.5});
       doc.setFontSize(6.1);setColor(doc,COLORS.muted);
       [`Telefon ${company.phone}`,`E-Mail ${company.email}`,...company.legalLines].forEach(line=>{doc.text(line,right,cursor,{align:"right"});cursor+=2.35});
    }else{
      doc.setFont("helvetica","normal");doc.setFontSize(7);setColor(doc,COLORS.muted);doc.text("Firmendaten des Firmensitzes Vorau fehlen",right,state.y+8,{align:"right"});
    }
     state.y+=24;
    doc.setDrawColor(...COLORS.blueLine);doc.setLineWidth(.7);doc.line(PAGE.left,state.y,200,state.y);
    state.y+=4;
  }

  function drawHeader(doc,state,branch,title,number,projectName,reportDate,logo){
     drawCompanyBand(doc,state,branch,logo);
    doc.setFont("helvetica","bold");doc.setFontSize(22);setColor(doc,COLORS.blue);doc.text(text(title).toLocaleUpperCase("de-AT"),PAGE.left,state.y+7.5);
    state.y+=11;
    const metadata=[number?`Bericht Nr. ${text(number)}`:"",projectName?`Projekt / Baustelle: ${text(projectName)}`:"",reportDate?`Datum: ${reportDate}`:""].filter(Boolean).join("   ·   ");
    doc.setFont("helvetica","normal");doc.setFontSize(7.5);setColor(doc,COLORS.muted);doc.text(doc.splitTextToSize(metadata,190),PAGE.left,state.y,{lineHeightFactor:1.05});
    state.y+=metadata.length>145?7:5;
  }

  function drawContinuationHeader(doc,branch,logo){
    const state={y:PAGE.top};
    drawCompanyBand(doc,state,branch,logo);
  }

  function groupHeight(doc,items,width){
    return 8+items.filter(item=>text(item?.[1])).reduce((height,item)=>height+4+Math.max(1,doc.splitTextToSize(text(item[1]),width-7).length)*3.05,0);
  }

  function drawInfoGroups(doc,state,groups){
    const visible=groups.map(group=>({...group,items:group.items.filter(item=>text(item?.[1]))})).filter(group=>group.items.length),gap=6,width=92;
    for(let index=0;index<visible.length;index+=2){
      const pair=visible.slice(index,index+2),rowHeight=Math.max(...pair.map(group=>groupHeight(doc,group.items,width)));
      ensure(doc,state,rowHeight+3);
      pair.forEach((group,column)=>{
        const x=PAGE.left+column*(width+gap);
        doc.setFillColor(...COLORS.paper);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.18);doc.roundedRect(x,state.y,width,rowHeight,1.4,1.4,"FD");
        doc.setFillColor(...COLORS.pale);doc.roundedRect(x,state.y,width,6,1.4,1.4,"F");doc.rect(x,state.y+3,width,3,"F");
        doc.setFont("helvetica","bold");doc.setFontSize(7);setColor(doc,COLORS.blue);doc.text(group.title.toLocaleUpperCase("de-AT"),x+3,state.y+4.1);
        let cursor=state.y+9;
        group.items.forEach(item=>{
          doc.setFont("helvetica","bold");doc.setFontSize(5.8);setColor(doc,COLORS.muted);doc.text(text(item[0]).toLocaleUpperCase("de-AT"),x+3,cursor);
          const lines=doc.splitTextToSize(text(item[1]),width-7);cursor+=3;
          doc.setFont("helvetica","normal");doc.setFontSize(8.1);setColor(doc,COLORS.ink);doc.text(lines,x+3,cursor,{lineHeightFactor:1.05});cursor+=Math.max(1,lines.length)*3.05+1;
        });
      });
      state.y+=rowHeight+3;
    }
  }

  function drawTextContent(doc,state,title,value,minHeight=9,titleAlreadyDrawn=false){
    if(!text(value))return;
    let lines=doc.splitTextToSize(text(value),184),headingDrawn=titleAlreadyDrawn,continuation=false;
    while(lines.length){
      if(!headingDrawn){ensure(doc,state,16);sectionTitle(doc,state,continuation?`${title} – Fortsetzung`:title)}
      else ensure(doc,state,16);
      const maxLines=Math.max(1,Math.floor((PAGE.bottom-state.y-5)/3.35)),part=lines.splice(0,maxLines),boxHeight=Math.max(minHeight,4.5+part.length*3.35);
      doc.setDrawColor(...COLORS.line);doc.setFillColor(...COLORS.paper);doc.setLineWidth(.18);doc.roundedRect(PAGE.left,state.y,190,boxHeight,1.2,1.2,"FD");
      doc.setFont("helvetica","normal");doc.setFontSize(8.2);setColor(doc,COLORS.ink);doc.text(part,PAGE.left+3,state.y+4.3,{lineHeightFactor:1.15});
      state.y+=boxHeight+3;headingDrawn=false;
      if(lines.length){newPage(doc,state);continuation=true}
    }
  }

  function drawTextSection(doc,state,title,value,minHeight=9){drawTextContent(doc,state,title,value,minHeight,false)}

  function autoTable(doc,state,head,body,options={}){
    ensure(doc,state,15);
    const config={startY:state.y,head:[head],body,margin:{left:PAGE.left,right:PAGE.right,top:PAGE.contentTop,bottom:18},theme:"grid",showHead:"everyPage",rowPageBreak:"avoid",styles:{font:"helvetica",fontSize:6.8,cellPadding:1.25,textColor:COLORS.ink,lineColor:COLORS.line,lineWidth:.12,overflow:"linebreak",valign:"middle"},headStyles:{fillColor:COLORS.pale,textColor:COLORS.blue,fontStyle:"bold",fontSize:7.1,lineColor:COLORS.line,lineWidth:.12},alternateRowStyles:{fillColor:[249,251,252]},...options};
    if(typeof doc.autoTable==="function")doc.autoTable(config);
    else if(window.jspdfAutoTable?.autoTable)window.jspdfAutoTable.autoTable(doc,config);
    else throw new Error("PDF-Tabellenmodul fehlt");
    state.y=(doc.lastAutoTable?.finalY||state.y)+3;
  }

  function tableTitle(doc,state,title){ensure(doc,state,36);sectionTitle(doc,state,title)}

  function drawTravel(doc,state,travel={}){
    const days=["mo","di","mi","do","fr","sa"],values=days.map(key=>`${key.toUpperCase()}: ${fmt(travel[key])} h`);
    ensure(doc,state,18);sectionTitle(doc,state,"Wegzeiten");
    doc.setFillColor(...COLORS.paper);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.18);doc.roundedRect(PAGE.left,state.y,190,8,1.2,1.2,"FD");
    doc.setFont("helvetica","normal");doc.setFontSize(7.6);setColor(doc,COLORS.ink);doc.text(values.join("    ·    "),PAGE.left+3,state.y+5.2);
    state.y+=11;
  }

  function evidenceIsSketch(item){return text(item.type).toLowerCase()==="sketch"||text(item.category).toLowerCase()==="skizze"}

  async function prepareEvidence(items,predicate){
    const prepared=[];
    for(const item of items||[]){
      if(!predicate(item))continue;
      const src=await asDataUrl(item.preview||item.fileUrl||"");
      if(src)prepared.push({item,src});
    }
    return prepared;
  }

  async function drawPhotos(doc,state,items=[]){
    const prepared=await prepareEvidence(items,item=>!evidenceIsSketch(item));
    if(!prepared.length)return;
    const gap=6,width=92,imageHeight=46,cardHeight=59;
    ensure(doc,state,cardHeight+10);sectionTitle(doc,state,"Fotodokumentation");
    for(let index=0;index<prepared.length;index+=2){
      if(state.y+cardHeight+3>PAGE.bottom){newPage(doc,state);sectionTitle(doc,state,"Fotodokumentation");}
      for(let column=0;column<2;column++){
        const entry=prepared[index+column];if(!entry)continue;
        const x=PAGE.left+column*(width+gap);
        doc.setFillColor(...COLORS.paper);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.18);doc.roundedRect(x,state.y,width,cardHeight,1.2,1.2,"FD");
        addContainedImage(doc,entry.src,x+2,state.y+2,width-4,imageHeight);
        doc.setFont("helvetica","bold");doc.setFontSize(6.7);setColor(doc,COLORS.blue);doc.text(text(entry.item.category)||"Foto",x+2.5,state.y+51);
        const caption=doc.splitTextToSize(text(entry.item.description),width-5).slice(0,2);
        if(caption.length){doc.setFont("helvetica","normal");doc.setFontSize(5.8);setColor(doc,COLORS.muted);doc.text(caption,x+2.5,state.y+54.5,{lineHeightFactor:1.05})}
      }
      state.y+=cardHeight+3;
    }
  }

  async function prepareSketches(report,{includeServiceDrawing=true}={}){
    const sketches=[];
    const serviceSrc=includeServiceDrawing?await asDataUrl(report.serviceDrawing?.preview||""):"";
    if(serviceSrc&&await hasRelevantDrawing(serviceSrc))sketches.push({title:"Handschriftliche Arbeitsleistung",description:"",src:serviceSrc});
    let number=0;
    for(const item of report.evidence||[]){
      if(!evidenceIsSketch(item))continue;
      const src=await asDataUrl(item.preview||item.fileUrl||"");
      if(!src||!await hasRelevantDrawing(src))continue;
      number++;
      sketches.push({title:`Skizze ${number}`,description:text(item.description),src});
    }
    return sketches;
  }

  function sketchBlock(doc,entry,options={}){
    const size=imageSize(doc,entry.src,options.maxWidth||175,options.maxHeight||115,options.maxScale??.22);
    if(!size)return null;
    const caption=doc.splitTextToSize(text(entry.description),181).slice(0,3),captionHeight=caption.length?caption.length*2.8+2:0;
    return {entry,size,caption,height:(entry.title?7:0)+size.height+captionHeight+4};
  }

  function drawSketchBlock(doc,state,block){
    const x=PAGE.left,width=190,headerHeight=block.entry.title?7:0;
    doc.setFillColor(...COLORS.white);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.18);doc.roundedRect(x,state.y,width,block.height,1.2,1.2,"FD");
    if(block.entry.title){doc.setFont("helvetica","bold");doc.setFontSize(7.5);setColor(doc,COLORS.blue);doc.text(block.entry.title,x+3,state.y+4.7)}
    const imageY=state.y+headerHeight,imageX=x+(width-block.size.width)/2;
    try{doc.addImage(block.entry.src,block.size.props.fileType||"PNG",imageX,imageY,block.size.width,block.size.height,undefined,"FAST")}catch{}
    if(block.caption.length){doc.setFont("helvetica","normal");doc.setFontSize(6.3);setColor(doc,COLORS.muted);doc.text(block.caption,x+4,imageY+block.size.height+3,{lineHeightFactor:1.05})}
    state.y+=block.height+3;
  }

  async function drawSketches(doc,state,report,options={}){
    const title=options.title||"Skizzen",blocks=(await prepareSketches(report,options)).map(entry=>sketchBlock(doc,entry)).filter(Boolean);
    if(!blocks.length)return;
    if(options.withSectionTitle!==false){ensure(doc,state,blocks[0].height+10);sectionTitle(doc,state,title)}
    for(const block of blocks){
      if(state.y+block.height>PAGE.bottom){newPage(doc,state);if(options.withSectionTitle!==false)sectionTitle(doc,state,`${title} – Fortsetzung`)}
      drawSketchBlock(doc,state,block);
    }
  }

  async function drawWorkServices(doc,state,report){
    const typed=text(report.services),serviceSrc=await asDataUrl(report.serviceDrawing?.preview||""),hasDrawing=serviceSrc&&await hasRelevantDrawing(serviceSrc);
    if(!typed&&!hasDrawing)return;
    const block=hasDrawing?sketchBlock(doc,{title:"",description:"",src:serviceSrc},{maxWidth:180,maxHeight:235,maxScale:.32}):null;
    ensure(doc,state,(block?.height||0)+(typed?18:0)+10);
    sectionTitle(doc,state,"Ausgeführte Leistung");
    if(typed)drawTextContent(doc,state,"Ausgeführte Leistung",typed,10,true);
    if(block){
      if(state.y+block.height>PAGE.bottom){newPage(doc,state);sectionTitle(doc,state,"Ausgeführte Leistung – Fortsetzung")}
      drawSketchBlock(doc,state,block);
    }
  }

  function completionStyle(value){
    if(value==="completed")return {accent:COLORS.green,fill:[242,249,244],symbol:"[OK]",label:"Baustelle abgeschlossen"};
    if(value==="partial")return {accent:COLORS.orange,fill:[252,248,242],symbol:"[ ]",label:"Teilfertigstellung"};
    if(value==="open")return {accent:COLORS.blueLine,fill:COLORS.paper,symbol:"[ ]",label:"Arbeiten offen"};
    return {accent:COLORS.muted,fill:COLORS.paper,symbol:"[ ]",label:"Nicht angegeben"};
  }

  function drawCompletion(doc,state,value){
    const style=completionStyle(value);
    doc.setFillColor(...style.fill);doc.roundedRect(PAGE.left,state.y,190,11,1.2,1.2,"F");
    doc.setFillColor(...style.accent);doc.roundedRect(PAGE.left,state.y,1.8,11,.9,.9,"F");
    doc.setFont("helvetica","bold");doc.setFontSize(6.2);setColor(doc,COLORS.muted);doc.text("ABSCHLUSSSTATUS",PAGE.left+5,state.y+4);
    doc.setFontSize(9);setColor(doc,style.accent);doc.text(`${style.symbol}  ${style.label}`,PAGE.left+5,state.y+8.4);
    state.y+=14;
  }

  function signatureHeight(){return 48}

  async function drawSignatures(doc,state,map={},entries=[]){
    sectionTitle(doc,state,"Unterschriften");
    const gap=entries.length===3?5:8,width=(190-gap*(entries.length-1))/entries.length,height=signatureHeight();
    for(let index=0;index<entries.length;index++){
      const entry=entries[index],x=PAGE.left+index*(width+gap),src=await asDataUrl(signature(map[entry.key]));
      doc.setFillColor(...COLORS.paper);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.18);doc.roundedRect(x,state.y,width,height,1.2,1.2,"FD");
      doc.setFont("helvetica","bold");doc.setFontSize(entries.length===3?6.5:7.3);setColor(doc,COLORS.blue);doc.text(entry.title,x+width/2,state.y+4.8,{align:"center",maxWidth:width-5});
      doc.setFillColor(...COLORS.white);doc.setDrawColor(...COLORS.line);doc.rect(x+3,state.y+7,width-6,22,"FD");
      addContainedImage(doc,src,x+5,state.y+8,width-10,20,true);
      doc.setDrawColor(...COLORS.muted);doc.setLineWidth(.2);doc.line(x+5,state.y+30.8,x+width-5,state.y+30.8);
      doc.setFont("helvetica","normal");doc.setFontSize(5.5);setColor(doc,COLORS.muted);doc.text("Unterschrift",x+5,state.y+33.4);
    }
    state.y+=height+3;
  }

  async function drawClosing(doc,state,completion,signatures,entries){
    ensure(doc,state,14+8+signatureHeight()+3);
    drawCompletion(doc,state,completion);
    await drawSignatures(doc,state,signatures,entries);
  }

  function reportCreationDate(report){
    return report?.createdAt||report?.created_at||report?.createdDate||report?.created_date||report?.createdOn||report?.created_on||report?.date||report?.periodFrom||report?.weekStart||"";
  }

  function creationStamp(value){
    const raw=text(value);
    if(!raw)return "unbekannt";
    const parsed=new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw)?`${raw}T12:00:00`:raw);
    if(Number.isNaN(parsed.getTime()))return raw;
    return new Intl.DateTimeFormat("de-AT",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(parsed);
  }

  function addFooters(doc,title,number,branch,logo,projectName,createdAt){
     const pages=doc.getNumberOfPages(),stamp=creationStamp(createdAt),center=[title,projectName].filter(Boolean).join(" · ");
     for(let page=1;page<=pages;page++){
      doc.setPage(page);doc.setDrawColor(...COLORS.line);doc.setLineWidth(.2);doc.line(PAGE.left,287,200,287);
      doc.setFont("helvetica","normal");doc.setFontSize(6);setColor(doc,COLORS.muted);
      doc.text("HASPL RegieApp",PAGE.left,290.4);doc.text(center,105,290.4,{align:"center",maxWidth:90});doc.text(`Seite ${page} von ${pages}`,200,290.4,{align:"right"});
      doc.setFontSize(5.2);doc.text(`Erstellt am ${stamp}`,PAGE.left,293.2);
    }
     for(let page=2;page<=pages;page++){doc.setPage(page);drawContinuationHeader(doc,branch,logo)}
  }

  function projectGroups(report,project){
    const contact=project.contactInfo||[project.customerContactPhone,project.customerContactEmail].filter(Boolean).join(" · ");
    return [
      {title:"Projekt",items:[["Baustelle",report.projectName||project.name],["Baustellenadresse",project.address]]},
      {title:"Auftrag",items:[["Auftraggeber",report.client||project.client||project.customer],["Auftraggeber-Adresse",project.clientAddress||project.customerAddress],["Ansprechpartner",project.contact||project.customerContactName],["Kontakt",contact],["Auftragsnummer Auftraggeber",report.orderNo||project.customerOrderNumber],["Interne HASPL-Auftragsnummer",project.internalOrder||project.internalOrderNumber||project.number]]},
      {title:"Verantwortliche",items:[["Bauleitung Auftraggeber",project.siteManager||project.customerSiteManager],["Interner Projektleiter",project.projectManager]]},
      {title:"Bericht",items:[["Datum",date(report.date)],["Berichtnummer",report.reportNo],["LV-Unterposition",report.lvPosition]]}
    ];
  }

  async function workPdf(doc,state,report,master,options){
    const {project,headOffice}=context(report,master),title=reportTitle(report),projectName=report.projectName||project.name;
    const logo=options.logoData||await asDataUrl(companyLines(headOffice).reportLogoUrl||imageUrl("assets/haspl-logo.png"));
    drawHeader(doc,state,headOffice,title,report.reportNo,projectName,date(report.date),logo);
    drawInfoGroups(doc,state,projectGroups(report,project));
    await drawWorkServices(doc,state,report);
    const days=["mo","di","mi","do","fr","sa","p50","p100"],dayLabels=["MO","DI","MI","DO","FR","SA","50 %","100 %"],workers=report.workers||[];
    tableTitle(doc,state,"Mitarbeiterstunden");
    const hourBody=workers.length?workers.map(worker=>[text(worker.employeeName),...days.map(key=>fmt(worker[key])),fmt(days.reduce((sum,key)=>sum+(Number(worker[key])||0),0))]):[["Keine Mitarbeiterstunden eingetragen","","","","","","","","",""]];
    const total=workers.reduce((sum,worker)=>sum+days.reduce((value,key)=>value+(Number(worker[key])||0),0),0);
    hourBody.push([{content:"Gesamtstunden",colSpan:9,styles:{fontStyle:"bold",fillColor:COLORS.pale,textColor:COLORS.blue}},{content:`${fmt(total)} h`,styles:{fontStyle:"bold",halign:"right",fillColor:COLORS.pale,textColor:COLORS.blue}}]);
    autoTable(doc,state,["Mitarbeiter",...dayLabels,"Summe"],hourBody,{columnStyles:{0:{cellWidth:42},1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"},6:{halign:"right"},7:{halign:"right"},8:{halign:"right"},9:{halign:"right"}}});
    drawTravel(doc,state,report.travel||{});
    const materials=(report.materials||[]).filter(material=>text(material.name)||text(material.lvPosition)||Number(material.quantity));
    if(materials.length){
       tableTitle(doc,state,"Material");
      autoTable(doc,state,["LV-Unterposition","Bezeichnung","Menge","Einheit"],materials.map(material=>[text(material.lvPosition),text(material.name),fmt(material.quantity),unit(material.unit)]),{columnStyles:{0:{cellWidth:38},1:{cellWidth:105},2:{cellWidth:25,halign:"right"},3:{cellWidth:22}}});
    }
    drawTextSection(doc,state,"Besondere Vorkommnisse / Bemerkungen",report.remark,9);
    await drawPhotos(doc,state,report.evidence||[]);
    await drawSketches(doc,state,report,{includeServiceDrawing:false});
    await drawClosing(doc,state,report.completion,report.signatures,[{key:"company",title:"HASPL / Ausführender"},{key:"customer",title:"Auftraggeber / Bauleitung"}]);
    addFooters(doc,title,report.reportNo,headOffice,logo,projectName,reportCreationDate(report));
  }

  function requestGroups(report,project){
    const contact=project.contactInfo||[project.customerContactPhone,project.customerContactEmail].filter(Boolean).join(" · ");
    return [
      {title:"Projekt",items:[["Bauvorhaben",report.projectName||project.name],["Baustellenadresse",project.address]]},
      {title:"Auftrag",items:[["Auftraggeber",project.client||project.customer],["Auftraggeber-Adresse",project.clientAddress||project.customerAddress],["Ansprechpartner",project.contact||project.customerContactName],["Kontakt",contact],["Interne HASPL-Auftragsnummer",project.internalOrder||project.internalOrderNumber||project.number]]},
      {title:"Verantwortliche",items:[["Bauleitung Auftraggeber",project.siteManager||project.customerSiteManager],["Interner Projektleiter",project.projectManager]]},
      {title:"Bericht",items:[["Regieanforderung Nr.",report.requestNo],["Regiefreigabe Nr.",report.approvalNo],["Ausführung",[date(report.periodFrom),date(report.periodTo)].filter(Boolean).join(" bis ")],["LV-Unterposition",report.lvPosition]]}
    ];
  }

  async function requestPdf(doc,state,report,master,options){
    const {project,headOffice}=context(report,master),title="Regieanforderung",projectName=report.projectName||project.name;
    const logo=options.logoData||await asDataUrl(companyLines(headOffice).reportLogoUrl||imageUrl("assets/haspl-logo.png"));
    drawHeader(doc,state,headOffice,title,report.requestNo,projectName,date(report.periodFrom),logo);
    drawInfoGroups(doc,state,requestGroups(report,project));
    drawTextSection(doc,state,"Zu erbringende Leistungen",report.services,10);
    drawTextSection(doc,state,"Begründung für den Auftraggeber",report.reason,9);
    const labor=(report.labor||[]).filter(item=>text(item.category)||Number(item.hours)||Number(item.rate));
    if(labor.length){
       tableTitle(doc,state,"Montage");
      autoTable(doc,state,["Stunden","Kategorie","EHP","Summe"],labor.map(item=>[fmt(item.hours),text(item.category),euro(item.rate),euro((Number(item.hours)||0)*(Number(item.rate)||0))]),{columnStyles:{0:{cellWidth:25,halign:"right"},2:{cellWidth:30,halign:"right"},3:{cellWidth:34,halign:"right"}}});
    }
    const materials=(report.materials||[]).filter(item=>text(item.article)||text(item.lvPosition)||Number(item.quantity)||Number(item.rate));
    const laborTotal=labor.reduce((sum,item)=>sum+(Number(item.hours)||0)*(Number(item.rate)||0),0),materialTotal=materials.reduce((sum,item)=>sum+(Number(item.quantity)||0)*(Number(item.rate)||0),0);
    if(materials.length){
       tableTitle(doc,state,"Material");
      const body=materials.map(item=>[text(item.lvPosition),text(item.article),fmt(item.quantity),unit(item.unit),euro(item.rate),euro((Number(item.quantity)||0)*(Number(item.rate)||0))]);
      body.push([{content:"Voraussichtliche Gesamtsumme",colSpan:5,styles:{fontStyle:"bold",fillColor:COLORS.pale,textColor:COLORS.blue}},{content:euro(laborTotal+materialTotal),styles:{fontStyle:"bold",halign:"right",fillColor:COLORS.pale,textColor:COLORS.blue}}]);
      autoTable(doc,state,["LV-Unterposition","Artikel","Menge","Einheit","EHP","Summe"],body,{columnStyles:{0:{cellWidth:32},2:{cellWidth:20,halign:"right"},3:{cellWidth:18},4:{cellWidth:28,halign:"right"},5:{cellWidth:30,halign:"right"}}});
    }
    drawTextSection(doc,state,"Besondere Bemerkungen",report.remarks,9);
    await drawPhotos(doc,state,report.evidence||[]);
    await drawSketches(doc,state,report);
    ensure(doc,state,11+8+signatureHeight()+3);
    doc.setFillColor(...COLORS.pale);doc.roundedRect(PAGE.left,state.y,190,9,1.2,1.2,"F");doc.setFont("helvetica","normal");doc.setFontSize(7);setColor(doc,COLORS.blue);doc.text("Arbeiten werden erst nach schriftlicher Beauftragung durchgeführt.",PAGE.left+3,state.y+5.5);state.y+=12;
    await drawSignatures(doc,state,report.signatures,[{key:"siteManager",title:"Auftraggeber / Bauleitung"},{key:"client",title:"Bauherr"},{key:"haspl",title:"HASPL / Ausführender"}]);
    addFooters(doc,title,report.requestNo,headOffice,logo,projectName,reportCreationDate(report));
  }

  function weeklyGroups(report,project){
    return [
      {title:"Projekt",items:[["Baustelle",report.projectName||project.name],["Baustellenadresse",project.address]]},
      {title:"Bericht",items:[["Kalenderwoche",report.weekKey||""],["Zeitraum",[date(report.weekStart),date(report.weekEnd)].filter(Boolean).join(" bis ")],["Berichtnummer",report.reportNo]]},
      {title:"Auftrag",items:[["Auftraggeber",report.client||project.client||project.customer],["Auftragsnummer",report.orderNo||project.customerOrderNumber]]},
    ];
  }

  async function weeklyPdf(doc,state,report,master,options){
    const {project,headOffice}=context(report,master),title="Wochenbericht",projectName=report.projectName||project.name;
    const logo=options.logoData||await asDataUrl(companyLines(headOffice).reportLogoUrl||imageUrl("assets/haspl-logo.png"));
    drawHeader(doc,state,headOffice,title,report.reportNo,projectName,date(report.weekEnd||report.weekStart),logo);
    drawInfoGroups(doc,state,weeklyGroups(report,project));

    const sourceDays=Array.isArray(report.sourceDays)?report.sourceDays:[];
    if(sourceDays.length){
       tableTitle(doc,state,"Tagesberichte Montag bis Sonntag");
      const body=sourceDays.map((day)=>[
        date(day.date),
        (day.reportIds||[]).length?String((day.reportIds||[]).length):"–",
        fmt(day.hours),
      ]);
      autoTable(doc,state,["Tag","Berichte","Stunden"],body,{columnStyles:{0:{cellWidth:55},1:{cellWidth:35,halign:"right"},2:{cellWidth:35,halign:"right"}}});
    }

    const employees=Array.isArray(report.employees)?report.employees:[];
    if(employees.length){
       tableTitle(doc,state,"Zusammengeführte Mitarbeiterstunden");
      const keys=["mo","di","mi","do","fr","sa","p50","p100"];
      const body=employees.map((employee)=>[
        text(employee.employeeName||employee.name||"Mitarbeiter"),
        ...keys.map((key)=>fmt(employee.hours?.[key])),
        fmt(employee.total),
      ]);
      body.push([{content:"Gesamtstunden",colSpan:9,styles:{fontStyle:"bold",fillColor:COLORS.pale,textColor:COLORS.blue}},{content:`${fmt(report.totalHours)} h`,styles:{fontStyle:"bold",halign:"right",fillColor:COLORS.pale,textColor:COLORS.blue}}]);
      autoTable(doc,state,["Mitarbeiter","MO","DI","MI","DO","FR","SA","50 %","100 %","Summe"],body,{columnStyles:{0:{cellWidth:42},1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"},6:{halign:"right"},7:{halign:"right"},8:{halign:"right"},9:{halign:"right"}}});
    }else{
      drawTextSection(doc,state,"Mitarbeiterstunden","Keine Mitarbeiterstunden eingetragen.",9);
    }

    drawTextSection(doc,state,"Ausgeführte Arbeiten",report.works,9);
    drawTextSection(doc,state,"Material",report.materialsText,9);
    drawTextSection(doc,state,"Fahrzeuge / Geräte",report.vehiclesText,9);
    drawTextSection(doc,state,"Vorkommnisse / Bemerkungen",report.incidentsText,9);
    drawTextSection(doc,state,"Offene Punkte",report.openPointsText,9);
    drawTextSection(doc,state,"Verknüpfte Regieberichte",report.linkedRegieReportsText,9);
    await drawSketches(doc,state,report);
    ensure(doc,state,8+signatureHeight()+3);
    await drawSignatures(doc,state,report.signatures||{},[{key:"company",title:"HASPL / Ausführender"},{key:"customer",title:"Auftraggeber / Bauleitung"}]);
    addFooters(doc,title,report.reportNo||report.weekKey,headOffice,logo,projectName,reportCreationDate(report));
  }

  function safeName(value){return text(value).replace(/[^a-z0-9äöüß_-]+/gi,"_").replace(/^_+|_+$/g,"")||"Bericht"}

  async function generate(report,master={},options={}){
    if(!report)throw new Error("Kein Bericht ausgewählt");
    const JsPdf=window.jspdf?.jsPDF;
    if(!JsPdf)throw new Error("PDF-Modul konnte nicht geladen werden");
    const doc=new JsPdf({orientation:"portrait",unit:"mm",format:"a4",compress:true,putOnlyUsedFonts:true}),title=reportTitle(report),number=report.reportNo||report.requestNo||date(report.date||report.periodFrom),{project,headOffice}=context(report,master),projectName=report.projectName||project.name||report.manualProject?.name||"Baustelle";
     doc.setProperties({title:`${title} ${number}`.trim(),subject:"HASPL RegieApp Bericht",author:VORAU_COMPANY.companyName,creator:"HASPL RegieApp V0.14.0"});
    const state={y:PAGE.top};
     if(report.type==="work")await workPdf(doc,state,report,master,options);
     else if(report.type==="weekly")await weeklyPdf(doc,state,report,master,options);
     else await requestPdf(doc,state,report,master,options);
    return {doc,fileName:`${safeName(title)}_${safeName(number)}_${safeName(projectName)}.pdf`};
  }

  async function print(report,master={}){
    const result=await generate(report,master);result.doc.save(result.fileName);return true;
  }

  window.RegiePrint=Object.freeze({print,generate,reportTitle});
})();
