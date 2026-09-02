(function(){
  "use strict";

  const DB_NAME="haspl-regieapp-v1";
  const DB_VERSION=2;
  let connection=null;

  function request(req){
    return new Promise((resolve,reject)=>{
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  function transactionDone(tx){
    return new Promise((resolve,reject)=>{
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error("Transaktion abgebrochen"));
    });
  }

  function open(){
    if(connection)return Promise.resolve(connection);
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains("reports")){
          const s=db.createObjectStore("reports",{keyPath:"id"});
          s.createIndex("type","type");
          s.createIndex("date","date");
          s.createIndex("projectId","projectId");
        }
        if(!db.objectStoreNames.contains("masterdata"))db.createObjectStore("masterdata",{keyPath:"key"});
        if(!db.objectStoreNames.contains("settings"))db.createObjectStore("settings",{keyPath:"key"});
        if(!db.objectStoreNames.contains("syncQueue")){
          const q=db.createObjectStore("syncQueue",{keyPath:"queueId"});
          q.createIndex("entityId","entityId");
          q.createIndex("type","type");
          q.createIndex("createdAt","createdAt");
        }
      };
      req.onsuccess=()=>{
        connection=req.result;
        connection.onversionchange=()=>{connection.close();connection=null;};
        resolve(connection);
      };
      req.onerror=()=>reject(req.error);
    });
  }

  async function store(name,mode="readonly"){
    const db=await open();
    return db.transaction(name,mode).objectStore(name);
  }

  async function put(name,value){return request((await store(name,"readwrite")).put(value));}
  async function get(name,key){return request((await store(name)).get(key));}
  async function getAll(name){return request((await store(name)).getAll());}
  async function remove(name,key){return request((await store(name,"readwrite")).delete(key));}

  async function replaceQueueForEntity(entityId,types,entry){
    const db=await open();
    const tx=db.transaction("syncQueue","readwrite");
    const q=tx.objectStore("syncQueue");
    const all=await request(q.getAll());
    for(const old of all){
      if(old.entityId===entityId&&types.includes(old.type))q.delete(old.queueId);
    }
    if(entry)q.put(entry);
    await transactionDone(tx);
  }

  async function reports(type){
    const all=await getAll("reports");
    return all.filter(r=>!r.deletedAt&&(!type||r.type===type)).sort((a,b)=>
      String(b.date||b.periodFrom||"").localeCompare(String(a.date||a.periodFrom||""))||
      String(b.updatedAt||"").localeCompare(String(a.updatedAt||""))
    );
  }

  async function masterGet(key){return (await get("masterdata",key))?.value||null;}
  async function masterPut(key,value){return put("masterdata",{key,value,updatedAt:new Date().toISOString()});}

  window.RegieDB=Object.freeze({
    open,put,get,getAll,remove,reports,masterGet,masterPut,replaceQueueForEntity
  });
})();
