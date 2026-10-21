'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
app.on('browser-window-created',(_event,window)=>window.webContents.once('did-finish-load',async()=>{
  if(window.getTitle()!=='TMA-Cut')return;
  await window.webContents.executeJavaScript(`(()=>{const original=window.cutSmokePrepare;window.previewProbe=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));const sample=label=>{const c=document.getElementById('preview-canvas');let pixels;try{pixels=[.15,.35,.55,.75,.9].map(x=>Array.from(c.getContext('2d').getImageData(Math.floor(c.width*x),Math.floor(c.height*.3),1,1).data));}catch(e){pixels=e.message;}window.previewProbe.push({label,time:snapshot().time,items:snapshot().project.items,pixels,decoders:[...compositor.sources.values()].map(v=>({time:v.currentTime,ready:v.readyState,duration:v.duration,paused:v.paused}))});};window.cutSmokePrepare=async()=>{await original();sample('original');for(const v of compositor.sources.values())try{v.currentTime=1;}catch(e){window.previewProbe.push({seekError:e.message});}await pause(500);compositor.draw(snapshot());sample('manual seek');for(const v of compositor.sources.values()){v.style.cssText='position:fixed;left:-1000px;width:100px;height:100px';document.body.append(v);}await pause(500);compositor.draw(snapshot());sample('attached');for(const v of compositor.sources.values())try{await v.play();}catch(e){window.previewProbe.push({playError:e.message});}await pause(500);for(const v of compositor.sources.values())v.pause();compositor.draw(snapshot());await pause(200);sample('play primed');};})();`);
  await window.webContents.executeJavaScript(`const baseSmoke=window.cutSmoke;window.cutSmoke=()=>({...baseSmoke(),probe:window.previewProbe});`);
}));
const file=path.resolve(__dirname,'../../electron/main.cjs'),unit=new Module(file,module);
unit.filename=file;unit.paths=Module._nodeModulePaths(path.dirname(file));
let code=fs.readFileSync(file,'utf8');if(process.env.SMOKE_VISIBLE==='1')code=code.replace('offscreen:smokeIndex>=0','offscreen:false').replace('show:smokeIndex<0','show:true');
unit._compile(code,file);
