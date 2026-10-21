'use strict';
const {app}=require('electron'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
app.on('browser-window-created',(_event,window)=>window.webContents.once('did-finish-load',async()=>{
  if(window.getTitle()!=='TMA-Cut')return;
  await window.webContents.executeJavaScript(`const baseSmoke=window.cutSmoke;window.cutSmoke=()=>{const report=baseSmoke();report.details=[...document.querySelectorAll('video')].map(v=>({width:v.videoWidth,duration:v.duration,ready:v.readyState}));report.decoderDetails=[...compositor.sources.values()].map(v=>({width:v.videoWidth,height:v.videoHeight,duration:v.duration,ready:v.readyState,seeking:v.seeking,paused:v.paused}));try{const c=document.getElementById('preview-canvas'),ctx=c.getContext('2d');report.pixels=[.15,.35,.55,.75,.9].map(x=>Array.from(ctx.getImageData(Math.floor(c.width*x),Math.floor(c.height*.3),1,1).data));}catch(e){report.pixelError=e.message;}return report;};`);
}));
const file=path.resolve(__dirname,'../../electron/main.cjs'),unit=new Module(file,module);
unit.filename=file;unit.paths=Module._nodeModulePaths(path.dirname(file));
let code=fs.readFileSync(file,'utf8');if(process.env.SMOKE_VISIBLE==='1')code=code.replace('offscreen:smokeIndex>=0','offscreen:false').replace('show:smokeIndex<0','show:true');
unit._compile(code,file);
