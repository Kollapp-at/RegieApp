(function(){
  "use strict";
  const DAY=86400000;
  const CONFIG=Object.freeze({
    appId:"regieapp",
    endpoint:"/api/auth/me",
    protectedHosts:["apps.haspl.at","apps.elektrotechnik-haspl.at"],
    cacheKey:"haspl:regieapp:central-auth-cache:v1",
    offlineMaxAgeMs:30*DAY,
    requestTimeoutMs:10000
  });
  const root=document.documentElement;
  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve});

  function isProtected(){return CONFIG.protectedHosts.includes(String(location.hostname||"").toLowerCase())}
  function permissions(payload){return payload?.user?.permissions||payload?.permissions||{}}
  function roles(payload){return [payload?.user?.role,payload?.role].filter(Boolean).map(v=>String(v).toLowerCase())}
  function authorized(payload){return roles(payload).includes("admin")||permissions(payload)[CONFIG.appId]===true}
  function userSnapshot(payload){
    const u=payload?.user||payload||{};
    return {id:u.id||null,firstName:u.firstName||u.first_name||"",lastName:u.lastName||u.last_name||"",username:u.username||"",role:u.role||"",employeeId:u.employeeId||u.employee_id||"",branchId:u.branchId||u.branch_id||"",permissions:{regieapp:permissions(payload).regieapp===true},featurePermissions:u.featurePermissions||u.feature_permissions||payload?.featurePermissions||{}};
  }
  function saveCache(payload){try{localStorage.setItem(CONFIG.cacheKey,JSON.stringify({verifiedAt:Date.now(),expiresAt:Date.now()+CONFIG.offlineMaxAgeMs,user:userSnapshot(payload)}))}catch(_){}}
  function readCache(){try{const record=JSON.parse(localStorage.getItem(CONFIG.cacheKey)||"null");if(!record||Date.now()>=Number(record.expiresAt)){localStorage.removeItem(CONFIG.cacheKey);return null}return record}catch(_){return null}}
  function clearCache(){try{localStorage.removeItem(CONFIG.cacheKey)}catch(_){}}
  function showApp(mode,user){
    root.classList.remove("hasplAuthPending","hasplAuthDenied");root.classList.add("hasplAuthReady");root.dataset.hasplAuthMode=mode;
    const app=document.getElementById("app");if(app)app.hidden=false;
    const detail={ok:true,mode,user:user||{}};resolveReady(detail);window.dispatchEvent(new CustomEvent("haspl-auth-ready",{detail}));
  }
  function gate(title,text,button){
    root.classList.remove("hasplAuthPending");root.classList.add("hasplAuthDenied");
    document.querySelector("#authGate h1").textContent=title;document.getElementById("authGateText").textContent=text;
    const actions=document.getElementById("authGateActions");actions.innerHTML="";
    if(button){const b=document.createElement("button");b.className="primary";b.textContent=button.label;b.addEventListener("click",button.action);actions.appendChild(b)}
  }
  async function check(){
    if(!isProtected()){showApp("standalone",{role:"development",firstName:"Lokaler",lastName:"Test"});return}
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),CONFIG.requestTimeoutMs);
    try{
      const response=await fetch(CONFIG.endpoint,{credentials:"include",cache:"no-store",headers:{Accept:"application/json","Cache-Control":"no-cache"},signal:controller.signal});
      if(response.status===401){clearCache();location.replace("/?returnTo=/regieapp/");return}
      if(!response.ok)throw new Error("AUTH_HTTP_"+response.status);
      const payload=await response.json();
      if(!authorized(payload)){clearCache();gate("Kein Zugriff auf RegieApp","Du bist angemeldet, besitzt aber keine Berechtigung für die RegieApp.",{label:"Zum HASPL Portal",action:()=>location.replace("/")});resolveReady({ok:false,reason:"forbidden"});return}
      saveCache(payload);showApp("online",userSnapshot(payload));
    }catch(error){
      const cached=readCache();
      if(cached){showApp("offline-cache",cached.user);return}
      gate("Zentrale Anmeldung nicht erreichbar","Die RegieApp konnte die HASPL-Session nicht prüfen und es liegt keine gültige Offline-Freigabe vor.",{label:"Erneut prüfen",action:()=>location.reload()});
      resolveReady({ok:false,reason:"offline-unverified",error});
    }finally{clearTimeout(timer)}
  }
  window.HasplAuth=Object.freeze({ready,check,isProtected});
  window.addEventListener("regie-auth-expired",()=>{clearCache();if(isProtected())location.replace("/?returnTo=/regieapp/")});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",check,{once:true});else check();
})();
