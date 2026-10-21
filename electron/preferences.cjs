const fs=require('node:fs/promises');const path=require('node:path');
const DEFAULTS={runAtStartup:false,showTray:true,closeToTray:false,startMinimized:false,startMaximized:false,analyticsMode:'manual',intervalMinutes:15,offlineMode:false,kbInSearch:true,tourSeen:false,sidebarPosition:'left',theme:'yellow',scheduleTheme:false,dayTheme:'grey',nightTheme:'black',dayTime:'08:00',nightTime:'20:00',transitionMinutes:2};
function normalize(value){const p=Object.fromEntries(Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='boolean').map(k=>[k,typeof value?.[k]==='boolean'?value[k]:DEFAULTS[k]]));p.analyticsMode=['manual','live','interval'].includes(value?.analyticsMode)?value.analyticsMode:'manual';p.intervalMinutes=Number.isFinite(value?.intervalMinutes)?Math.max(1,Math.min(1440,Math.round(value.intervalMinutes))):15;for(const key of ['sidebarPosition','theme','dayTheme','nightTheme']){const allowed=key==='sidebarPosition'?['left','right','top','bottom']:['yellow','grey','black'];p[key]=allowed.includes(value?.[key])?value[key]:DEFAULTS[key];}for(const key of ['dayTime','nightTime'])p[key]=/^([01]\d|2[0-3]):[0-5]\d$/.test(value?.[key])?value[key]:DEFAULTS[key];p.transitionMinutes=Number.isFinite(value?.transitionMinutes)?Math.min(60,Math.max(0,value.transitionMinutes)):2;return p;}
function startupFile(env=process.env){return path.join(env.XDG_CONFIG_HOME||path.join(require('node:os').homedir(),'.config'),'autostart','tma-socialsmanager.desktop');}
async function setStartup(enabled,{platform=process.platform,app,env=process.env,executable=process.execPath}={}){
  if(enabled&&!app.isPackaged)throw Error('Install a packaged build before enabling launch at sign-in.');
  if(platform==='linux'){
    const file=startupFile(env);if(!enabled){await fs.rm(file,{force:true});return;}
    const target=env.APPIMAGE||executable;if(/[\r\n]/.test(target))throw Error('The application path is not supported.');
    const escaped=target.replace(/[\\"`$]/g,'\\$&').replace(/%/g,'%%');
    await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,`[Desktop Entry]\nType=Application\nName=TMA-SocialsManager\nExec="${escaped}" --startup\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`,{mode:0o600});
  }else app.setLoginItemSettings({openAtLogin:enabled,path:executable,args:['--startup']});
}
class Preferences{
  constructor(root,options){this.file=path.join(root,'preferences.json');this.options=options;this.value={...DEFAULTS};}
  async load(){try{this.value=normalize(JSON.parse(await fs.readFile(this.file,'utf8')));}catch(e){if(e.code!=='ENOENT')throw Error('Preferences could not be read. The saved file was preserved.');}return this;}
  async update(value){const next=normalize(value);if(!next.showTray){next.closeToTray=false;next.startMinimized=false;}
    const prev=this.value;if(next.runAtStartup!==prev.runAtStartup)await setStartup(next.runAtStartup,this.options);
    try{await fs.mkdir(path.dirname(this.file),{recursive:true});await fs.writeFile(this.file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});await fs.rename(this.file+'.tmp',this.file);}catch(e){if(next.runAtStartup!==prev.runAtStartup)await setStartup(prev.runAtStartup,this.options);throw e;}
    this.value=next;return next;
  }
}
module.exports={DEFAULTS,normalize,startupFile,setStartup,Preferences};
