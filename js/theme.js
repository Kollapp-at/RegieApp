(function(){
  "use strict";

  const KEY="haspl_regieapp_theme";
  const root=document.documentElement;

  function preference(){
    try{
      const saved=localStorage.getItem(KEY);
      return ["dark","light","system"].includes(saved)?saved:"dark";
    }catch(_){return "dark";}
  }

  function resolved(value=preference()){
    if(value==="system")return matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
    return value;
  }

  function syncButton(){
    const button=document.getElementById("themeToggle");
    if(!button)return;
    const dark=root.dataset.theme==="dark";
    button.setAttribute("aria-pressed",dark?"true":"false");
    button.setAttribute("aria-label",dark?"Hellmodus einschalten":"Dark Mode einschalten");
    button.title=dark?"Hellmodus einschalten":"Dark Mode einschalten";
  }

  function apply(){
    const theme=resolved();
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=theme==="dark"?"#102330":"#123b57";
    syncButton();
  }

  function toggle(){
    const next=root.dataset.theme==="dark"?"light":"dark";
    try{localStorage.setItem(KEY,next);}catch(_){}
    apply();
  }

  window.RegieTheme=Object.freeze({apply,toggle,key:KEY});
  apply();
  document.addEventListener("DOMContentLoaded",()=>{
    document.getElementById("themeToggle")?.addEventListener("click",toggle);
    syncButton();
  },{once:true});
  window.addEventListener("pageshow",apply);
  window.addEventListener("storage",event=>{if(event.key===KEY)apply();});
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if(preference()==="system")apply();});
})();
