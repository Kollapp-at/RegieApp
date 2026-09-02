(function(){
  "use strict";

  const TIMEOUT=20000;

  class ApiError extends Error{
    constructor(message,status=0,payload=null){
      super(message);
      this.name="ApiError";
      this.status=status;
      this.payload=payload;
    }
  }

  async function request(url,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),options.timeout||TIMEOUT);
    const headers=new Headers(options.headers||{});
    headers.set("Accept","application/json");
    const init={...options,credentials:"include",cache:"no-store",headers,signal:controller.signal};
    delete init.timeout;
    if(options.json!==undefined){
      headers.set("Content-Type","application/json");
      init.body=JSON.stringify(options.json);
      delete init.json;
    }
    try{
      const response=await fetch(url,init);
      if(response.status===401){
        window.dispatchEvent(new CustomEvent("regie-auth-expired"));
        throw new ApiError("Anmeldung abgelaufen",401,{error:"not_authenticated"});
      }
      const contentType=response.headers.get("content-type")||"";
      const payload=contentType.includes("application/json")?await response.json():await response.text();
      if(!response.ok){
        const code=payload?.error||`HTTP_${response.status}`;
        throw new ApiError(code,response.status,payload);
      }
      return payload;
    }catch(error){
      if(error.name==="AbortError")throw new ApiError("Zeitüberschreitung",0,{error:"timeout"});
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  async function blob(url,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),options.timeout||TIMEOUT);
    const headers=new Headers(options.headers||{});
    const init={...options,credentials:"include",cache:"no-store",headers,signal:controller.signal};
    delete init.timeout;
    try{
      const response=await fetch(url,init);
      if(response.status===401){
        window.dispatchEvent(new CustomEvent("regie-auth-expired"));
        throw new ApiError("Anmeldung abgelaufen",401,{error:"not_authenticated"});
      }
      if(!response.ok){
        const contentType=response.headers.get("content-type")||"";
        const payload=contentType.includes("application/json")?await response.json():await response.text();
        throw new ApiError(payload?.error||`HTTP_${response.status}`,response.status,payload);
      }
      return await response.blob();
    }catch(error){
      if(error.name==="AbortError")throw new ApiError("Zeitüberschreitung",0,{error:"timeout"});
      throw error;
    }finally{
      clearTimeout(timer);
    }
  }

  function project(raw){
    return {
      id:raw.project_id||raw.id,
      number:raw.project_number||raw.projectNumber||"",
      name:raw.project_name||raw.name||"Projekt",
      customer:raw.customer||raw.client||raw.client_name||"",
      customerAddress:raw.customer_address||raw.customerAddress||raw.client_address||raw.clientAddress||"",
      customerContactName:raw.customer_contact_name||raw.customerContactName||raw.client_contact||raw.clientContact||"",
      customerContactPhone:raw.customer_contact_phone||raw.customerContactPhone||"",
      customerContactEmail:raw.customer_contact_email||raw.customerContactEmail||"",
      customerSiteManager:raw.customer_site_manager||raw.customerSiteManager||raw.client_site_manager||raw.clientSiteManager||"",
      internalOrderNumber:raw.internal_order_number||raw.internalOrderNumber||"",
      customerOrderNumber:raw.customer_order_number||raw.customerOrderNumber||raw.order_number||raw.orderNumber||"",
      internalProjectManagerEmployeeId:raw.internal_project_manager_employee_id||raw.internalProjectManagerEmployeeId||"",
      projectManager:raw.project_manager||raw.projectManager||"",
      address:raw.address||"",
      active:raw.active!==false,
      branchId:raw.branch_id||raw.branchId||"",
      assignedEmployeeIds:raw.assigned_employee_ids||raw.assignedEmployeeIds||[],
      updatedAt:raw.updated_at||raw.updatedAt||""
    };
  }

  function employee(raw){
    return {
      id:raw.employee_id||raw.id,
      name:raw.report_short_name||raw.reportShortName||raw.name||[raw.first_name||raw.firstName,raw.last_name||raw.lastName].filter(Boolean).join(" "),
      fullName:raw.name||[raw.first_name||raw.firstName,raw.last_name||raw.lastName].filter(Boolean).join(" "),
      role:raw.role||"",
      billingCategory:raw.billing_category||raw.billingCategory||"",
      linkedUserId:raw.linked_user_id||raw.linkedUserId||"",
      active:raw.active!==false,
      branchId:raw.branch_id||raw.branchId||"",
      assignedProjectIds:raw.assigned_project_ids||raw.assignedProjectIds||[]
    };
  }

  function vehicle(raw){
    return {
      id:raw.vehicle_id||raw.id,
      name:raw.name||raw.license_plate||raw.licensePlate||"Fahrzeug",
      licensePlate:raw.license_plate||raw.licensePlate||"",
      active:raw.active!==false,
      branchId:raw.branch_id||raw.branchId||""
    };
  }

  function branch(raw){
    return {
      id:raw.branch_id||raw.id,
      code:raw.code||"",
      name:raw.name||"Kostenstelle",
      companyName:raw.company_name||raw.companyName||"Elektrotechnik Haspl GmbH",
      address:raw.address||"",
      street:raw.street||"",
      postalCode:raw.postal_code||raw.postalCode||"",
      city:raw.city||"",
      phone:raw.phone||"",
      email:raw.email||"",
      website:raw.website||"",
      reportLogoUrl:raw.report_logo_url||raw.reportLogoUrl||"",
      active:raw.active!==false
    };
  }

  async function refresh(){
    const [p,e,v,b]=await Promise.all([
      request("/api/projects"),
      request("/api/employees"),
      request("/api/vehicles"),
      request("/api/branches")
    ]);
    const data={
      projects:(p.projects||[]).map(project).filter(x=>x.id&&x.active),
      employees:(e.employees||[]).map(employee).filter(x=>x.id&&x.active),
      vehicles:(v.vehicles||[]).map(vehicle).filter(x=>x.id&&x.active),
      branches:(b.branches||[]).map(branch).filter(x=>x.id&&x.active),
      loadedAt:new Date().toISOString()
    };
    await RegieDB.masterPut("portal",data);
    return {...data,source:"online"};
  }

  async function load(){
    if(!HasplAuth.isProtected()){
      const cached=await RegieDB.masterGet("portal");
      return cached?{...cached,source:"cache"}:{
        projects:[{id:"demo-project",number:"DEMO-01",name:"Musterbaustelle",customer:"HASPL Test",address:"Bahnhofstraße 80",branchId:"demo-branch"}],
        employees:[{id:"demo-1",name:"Max Mustermann",role:"worker",active:true},{id:"demo-2",name:"Franz Beispiel",role:"foreman",active:true}],
        vehicles:[{id:"demo-v1",name:"Montagebus",licensePlate:"DEMO 1"}],
        branches:[{id:"demo-branch",code:"001",name:"Vorau",companyName:"Elektrotechnik Haspl GmbH",street:"Bahnhofstraße 80",postalCode:"8250",city:"Vorau",phone:"03337 30 006",email:"office@elektro-haspl.at",website:"www.elektro-haspl.at"}],
        source:"demo"
      };
    }
    try{return await refresh();}
    catch(error){
      const cached=await RegieDB.masterGet("portal");
      if(cached)return {...cached,source:"cache",error};
      throw error;
    }
  }

  window.RegieAPI=Object.freeze({ApiError,request,blob,load,refresh,project,employee,vehicle,branch});
})();
