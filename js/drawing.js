(function(){
  "use strict";
  class DrawingPad{
    constructor(canvas){
      this.canvas=canvas;this.ctx=canvas.getContext("2d");this.width=1600;this.height=1000;canvas.width=this.width;canvas.height=this.height;
      this.tool="freehand";this.color="#c62828";this.lineWidth=6;this.paper="blank";this.objects=[];this.redoStack=[];this.background=null;this.backgroundImage=null;this.active=null;this.pointerId=null;this.expandable=false;this.pendingScroll=false;this.lastPenTap=null;this.onToolChange=null;this.drawQueued=false;
      this.bind();this.resizeCss();window.addEventListener("resize",()=>this.resizeCss());
    }
    bind(){
      const options={passive:false};
      this.canvas.addEventListener("pointerdown",e=>this.down(e),options);
      this.canvas.addEventListener("pointermove",e=>this.move(e),options);
      this.canvas.addEventListener("pointerup",e=>this.up(e),options);
      this.canvas.addEventListener("pointercancel",e=>this.up(e),options);
      this.canvas.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation()},options);
      ["selectstart","dragstart","copy"].forEach(type=>this.canvas.addEventListener(type,e=>{e.preventDefault();e.stopPropagation()},options));
      this.canvas.draggable=false;
    }
    resizeCss(){const wrap=this.canvas.parentElement;if(!wrap)return;const maxW=Math.max(300,wrap.clientWidth-24),maxH=Math.max(260,wrap.clientHeight-24);const scale=this.expandable?maxW/this.width:Math.min(maxW/this.width,maxH/this.height);this.canvas.style.width=Math.floor(this.width*scale)+"px";this.canvas.style.height=Math.floor(this.height*scale)+"px";}
    point(e){const r=this.canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*this.width/r.width,y:(e.clientY-r.top)*this.height/r.height,pressure:e.pressure||.5}}
    setTool(tool){this.tool=tool;this.onToolChange?.(tool)}
    setColor(color){this.color=color}
    setWidth(width){this.lineWidth=Number(width)||6}
    setPaper(paper){this.paper=["lined","grid","blank"].includes(paper)?paper:"blank";this.draw()}
    setExpandable(value){this.expandable=!!value;this.canvas.parentElement?.classList.toggle("serviceCanvas",this.expandable)}
    async reset(doc={}){this.height=this.expandable?Math.max(1000,Number(doc.height)||1000):1000;this.canvas.height=this.height;this.objects=Array.isArray(doc.objects)?structuredClone(doc.objects):[];this.redoStack=[];this.paper=["lined","grid","blank"].includes(doc.paper)?doc.paper:"blank";this.background=doc.background||null;this.backgroundImage=null;if(this.background){await this.loadBackground(this.background)}this.draw();this.resizeCss()}
    expandNear(y){if(!this.expandable||y<this.height-180)return;this.height+=800;this.canvas.height=this.height;this.pendingScroll=true;this.draw();this.resizeCss()}
    scheduleDraw(){if(this.drawQueued)return;this.drawQueued=true;const frame=window.requestAnimationFrame||((callback)=>setTimeout(callback,0));frame(()=>{this.drawQueued=false;this.draw()})}
    drawFreehandSegment(item,from,to){const c=this.ctx;c.save();c.strokeStyle=item.color||"#c62828";c.fillStyle=item.color||"#c62828";c.lineWidth=item.width||6;c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(from.x,from.y);c.lineTo(to.x,to.y);c.stroke();c.restore()}
    loadBackground(src){return new Promise(resolve=>{const img=new Image();img.onload=()=>{this.backgroundImage=img;resolve()};img.onerror=()=>resolve();img.src=src})}
    down(e){
      if(e.isPrimary===false||(e.button!==undefined&&e.button!==0&&e.pointerType==="mouse"))return;e.preventDefault();e.stopPropagation();const p=this.point(e);
      if(e.pointerType==="pen"&&this.lastPenTap&&Date.now()-this.lastPenTap.time<=420&&Math.hypot(p.x-this.lastPenTap.x,p.y-this.lastPenTap.y)<=70){
        const last=this.objects.at(-1);
        if(last?.type==="freehand"&&last.points.length===1){this.objects.pop();this.redoStack=[]}
        this.lastPenTap=null;this.setTool("eraser");this.draw();return;
      }
      this.expandNear(p.y);
      if(this.tool==="text"){const text=prompt("Text eingeben:","");if(text?.trim()){this.commit({type:"text",x:p.x,y:p.y,text:text.trim(),color:this.color,width:this.lineWidth})}return}
      if(this.tool==="eraser"){this.eraseAt(p);return}
      this.pointerId=e.pointerId;this.canvas.setPointerCapture?.(e.pointerId);
      this.active=this.tool==="freehand"?{type:"freehand",points:[p],color:this.color,width:this.lineWidth}:{type:this.tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:this.color,width:this.lineWidth};this.draw();
    }
    move(e){if(this.pointerId!==e.pointerId||!this.active)return;e.preventDefault();e.stopPropagation();const events=e.getCoalescedEvents?.()||[e];let redrawShape=false;events.forEach(pointEvent=>{const p=this.point(pointEvent);this.expandNear(p.y);if(this.active.type==="freehand"){const last=this.active.points.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>2){this.active.points.push(p);if(last)this.drawFreehandSegment(this.active,last,p)}}else{this.active.x2=p.x;this.active.y2=p.y;redrawShape=true}});if(redrawShape)this.scheduleDraw()}
    up(e){if(this.pointerId!==e.pointerId||!this.active)return;e.preventDefault();e.stopPropagation();const item=this.active;this.active=null;this.pointerId=null;this.canvas.releasePointerCapture?.(e.pointerId);if(item.type!=="freehand"||item.points.length>1){this.lastPenTap=null;this.commit(item,item.type!=="freehand")}else{if(e.pointerType==="pen"){const point=item.points[0];this.lastPenTap={time:Date.now(),x:point.x,y:point.y}}else this.lastPenTap=null;this.commit(item,false)}if(this.pendingScroll){this.pendingScroll=false;requestAnimationFrame(()=>this.canvas.parentElement?.scrollTo({top:this.canvas.parentElement.scrollHeight,behavior:"smooth"}))}}
    commit(item,redraw=true){this.objects.push(structuredClone(item));this.redoStack=[];if(redraw)this.draw()}
    undo(){if(!this.objects.length)return;this.redoStack.push(this.objects.pop());this.draw()}
    redo(){if(!this.redoStack.length)return;this.objects.push(this.redoStack.pop());this.draw()}
    eraseAt(p){let best=-1,bestDistance=45;this.objects.forEach((o,i)=>{const d=this.distance(o,p);if(d<bestDistance){bestDistance=d;best=i}});if(best>=0){this.redoStack=[];this.objects.splice(best,1);this.draw()}}
    distance(o,p){
      if(o.type==="freehand")return Math.min(...o.points.map(q=>Math.hypot(q.x-p.x,q.y-p.y)));
      if(o.type==="text")return Math.hypot(o.x-p.x,o.y-p.y);
      const x1=Math.min(o.x1,o.x2),x2=Math.max(o.x1,o.x2),y1=Math.min(o.y1,o.y2),y2=Math.max(o.y1,o.y2);
      if(o.type==="circle"||o.type==="rect")return Math.min(Math.abs(p.x-x1),Math.abs(p.x-x2),Math.abs(p.y-y1),Math.abs(p.y-y2));
      const dx=o.x2-o.x1,dy=o.y2-o.y1,l2=dx*dx+dy*dy;if(!l2)return Math.hypot(p.x-o.x1,p.y-o.y1);const t=Math.max(0,Math.min(1,((p.x-o.x1)*dx+(p.y-o.y1)*dy)/l2));return Math.hypot(p.x-(o.x1+t*dx),p.y-(o.y1+t*dy));
    }
    draw(){
      const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.fillStyle="#fff";c.fillRect(0,0,this.width,this.height);this.drawPaper();
      if(this.backgroundImage){const s=Math.min(this.width/this.backgroundImage.width,this.height/this.backgroundImage.height),w=this.backgroundImage.width*s,h=this.backgroundImage.height*s;c.drawImage(this.backgroundImage,(this.width-w)/2,(this.height-h)/2,w,h)}
      [...this.objects,...(this.active?[this.active]:[])].forEach(o=>this.drawObject(o));
    }
    drawPaper(){
      if(this.paper==="blank"||this.backgroundImage)return;
      const c=this.ctx;c.save();c.strokeStyle=this.paper==="grid"?"#c9dced":"#b9d2e6";c.lineWidth=1;
      const step=this.paper==="grid"?40:54;
      for(let y=step;y<this.height;y+=step){c.beginPath();c.moveTo(0,y+.5);c.lineTo(this.width,y+.5);c.stroke()}
      if(this.paper==="grid")for(let x=step;x<this.width;x+=step){c.beginPath();c.moveTo(x+.5,0);c.lineTo(x+.5,this.height);c.stroke()}
      c.restore();
    }
    drawObject(o){
      const c=this.ctx;c.save();c.strokeStyle=o.color||"#c62828";c.fillStyle=o.color||"#c62828";c.lineWidth=o.width||6;c.lineCap="round";c.lineJoin="round";
      if(o.type==="freehand"){c.beginPath();o.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke()}
      else if(o.type==="line"){c.beginPath();c.moveTo(o.x1,o.y1);c.lineTo(o.x2,o.y2);c.stroke()}
      else if(o.type==="rect"){c.strokeRect(o.x1,o.y1,o.x2-o.x1,o.y2-o.y1)}
      else if(o.type==="circle"){c.beginPath();c.ellipse((o.x1+o.x2)/2,(o.y1+o.y2)/2,Math.abs(o.x2-o.x1)/2,Math.abs(o.y2-o.y1)/2,0,0,Math.PI*2);c.stroke()}
      else if(o.type==="text"){c.font=`${Math.max(24,(o.width||6)*6)}px sans-serif`;c.textBaseline="top";c.fillText(o.text,o.x,o.y)}c.restore();
    }
    document(){return {version:2,width:this.width,height:this.height,paper:this.paper,background:this.background,objects:structuredClone(this.objects)}}
    contentBounds(){
      if(!this.objects.length)return null;let minX=this.width,minY=this.height,maxX=0,maxY=0;
      const include=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))return;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)};
      this.objects.forEach(o=>{if(o.type==="freehand")o.points.forEach(p=>include(p.x,p.y));else if(o.type==="text"){include(o.x,o.y);include(o.x+Math.max(120,String(o.text||"").length*26),o.y+Math.max(36,(o.width||6)*7))}else{include(o.x1,o.y1);include(o.x2,o.y2)}});
      const pad=48;return{x:Math.max(0,minX-pad),y:Math.max(0,minY-pad),width:Math.min(this.width,maxX+pad)-Math.max(0,minX-pad),height:Math.min(this.height,maxY+pad)-Math.max(0,minY-pad)};
    }
    preview(options={}){this.draw();if(!options.cropToContent)return this.canvas.toDataURL("image/jpeg",.88);const bounds=this.contentBounds();if(!bounds)return "";const out=document.createElement("canvas");out.width=Math.max(1,Math.ceil(bounds.width));out.height=Math.max(1,Math.ceil(bounds.height));out.getContext("2d").drawImage(this.canvas,bounds.x,bounds.y,bounds.width,bounds.height,0,0,out.width,out.height);return out.toDataURL("image/jpeg",.9)}
  }
  window.DrawingPad=DrawingPad;
})();
