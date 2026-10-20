'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const defaults=Object.freeze({openAtLogin:false,showTray:true,closeToTray:false,startMinimized:false,autoLockMinutes:5});
function validate(value){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('Invalid settings.');
  const v={...defaults,...value};
  for(const name of ['openAtLogin','showTray','closeToTray','startMinimized'])if(typeof v[name]!=='boolean')throw Error('Invalid settings.');
  if(![1,5,15,30].includes(v.autoLockMinutes))throw Error('Choose an auto-lock time from the list.');
  if(!v.showTray&&(v.closeToTray||v.startMinimized))throw Error('Enable the tray icon before using tray startup or close options.');
  return v;
}
class Settings{
  constructor(file,integrate=async()=>{}){this.file=file;this.integrate=integrate;this.value={...defaults};}
  async load(){try{if((await fs.stat(this.file)).size>4096)throw Error('Settings too large.');this.value=validate(JSON.parse(await fs.readFile(this.file,'utf8')));}catch(e){if(e.code!=='ENOENT')this.warning='Saved settings could not be read. Defaults are being used.';this.value={...defaults};}return this.value;}
  async save(value){const next=validate(value),before=this.value,temp=this.file+'.'+crypto.randomUUID()+'.tmp';
    try{await this.integrate(next);await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(temp,JSON.stringify(next,null,2),{mode:0o600,flag:'wx'});await fs.rename(temp,this.file);this.value=next;return{...next};}
    catch(e){await this.integrate(before,true).catch(()=>{});throw e;}finally{await fs.rm(temp,{force:true});}
  }
}
function desktopQuote(value){if(typeof value!=='string'||/[\r\n\0]/.test(value))throw Error('Invalid startup executable.');return '"'+value.replace(/%/g,'%%').replace(/["\\`$]/g,'\\$&')+'"';}
async function startup(enabled,{app,platform=process.platform,env=process.env,executable=env.APPIMAGE||process.execPath}={}){
  if(!app?.isPackaged)throw Error('Launch at sign-in is available in the installed app.');
  if(platform==='win32'||platform==='darwin'){app.setLoginItemSettings({openAtLogin:enabled,...(platform==='win32'?{path:executable,name:'TMA-Padlock'}:{})});return;}
  if(platform!=='linux')throw Error('Startup is unavailable on this operating system.');
  const file=path.join(env.XDG_CONFIG_HOME||path.join(app.getPath('home'),'.config'),'autostart','tma-padlock.desktop');
  const marker='X-TMA-Padlock-Managed=true';let old='';try{old=await fs.readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(old&&!old.includes(marker))throw Error('An existing Padlock startup entry must be managed in your OS startup settings.');
  if(enabled){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,`[Desktop Entry]\nType=Application\nName=TMA-Padlock\nExec=${desktopQuote(executable)}\nTerminal=false\n${marker}\n`,{mode:0o600});}
  else if(old)await fs.rm(file);
}
function hideOnClose(settings,hasTray,quitting,smoke){return !!(settings.closeToTray&&settings.showTray&&hasTray&&!quitting&&!smoke);}
module.exports={Settings,defaults,validate,startup,desktopQuote,hideOnClose};
