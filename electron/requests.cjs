'use strict';
const fields={create:['password','confirm','mode'],verify:['id','name','issuer','secret','type','algorithm','digits','period','counter'],add:['id','name','issuer','secret','type','algorithm','digits','period','counter'],rename:['id','name'],savePreferences:['openAtLogin','showTray','closeToTray','startMinimized','autoLockMinutes','alwaysOnTop','notifications','theme','scheduleTheme','nightTheme','nightStart','nightEnd','transitionMinutes','searchKB','tourSeen']};
fields.export=['password','confirm'];
fields.customize=['id','icon','hidden','autoRefresh'];
fields.report=['kind','description','includeDiagnostic'];
const empty=new Set(['status','list','lock','backup','activity','preferences','mini','diagnostic','pickIcon']);
function validateRequest(name,value){
  if(empty.has(name)){if(value!==undefined&&value!==null)throw Error('Unexpected request data.');return;}
  if(['unlock','restore','import','remove','advance','copy','help'].includes(name)){if(typeof value!=='string'||value.length>(['unlock','restore','import'].includes(name)?1024:128))throw Error('Invalid request value.');return;}
  if(!Object.hasOwn(fields,name)||!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields[name].includes(k)))throw Error('Invalid request fields.');
  let size=0;for(const[k,v]of Object.entries(value)){if(!['string','boolean','number'].includes(typeof v)||typeof v==='string'&&v.length>(k==='icon'?32800:4096)||typeof v==='number'&&!Number.isFinite(v))throw Error('Invalid request value.');size+=k.length+(typeof v==='string'?v.length:8);}if(size>(name==='customize'?34000:8192))throw Error('Request is too large.');
}
const session=new Set(['unlock','create','verify','add','rename','remove','advance','copy','backup','restore','import','export','customize','pickIcon']);
function trustedFrame(event,window,url){return !!(window&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame?.url===url);}
class Requests{
  constructor(vault,activity,{limit=32}={}){this.getVault=typeof vault==='function'?vault:()=>vault;this.activity=activity;this.limit=limit;this.pending=0;this.queue=Promise.resolve();}
  run(name,action,value){
    try{validateRequest(name,value);}catch(e){return Promise.resolve({ok:false,error:e.message});}
    if(name==='lock'||name==='activity')return Promise.resolve({ok:true,value:action()});
    if(this.pending>=this.limit)return Promise.resolve({ok:false,error:'Too many pending requests. Try again.'});
    const vault=this.getVault(),epoch=vault.epoch;this.pending++;
    const job=this.queue.then(async()=>{try{if(session.has(name))vault.current(epoch);if(!['list','status'].includes(name))this.activity();const result=await action();if(session.has(name)){vault.current(epoch+(name==='unlock'?1:0));if(!['restore'].includes(name))vault.require();}return{ok:true,value:result};}catch(e){return{ok:false,error:e.message};}finally{this.pending--;}});
    this.queue=job.catch(()=>{});return job;
  }
}
module.exports={validateRequest,Requests,trustedFrame};
