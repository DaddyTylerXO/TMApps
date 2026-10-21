'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const M=require('../ui/model.js');
async function read(file,fallback){try{return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch{return fallback;}}
async function atomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
function validateSettings(value){
  const defaults=M.defaults(),s={...defaults,...value};s.shortcuts={...defaults.shortcuts,...value.shortcuts};
  for(const key of ['autosaveSeconds','backupCount','timelineZoom','inspectorWidth','previewHeight','themeTransitionMinutes']){const bounds={autosaveSeconds:[15,3600],backupCount:[1,100],timelineZoom:[5,500],inspectorWidth:[220,600],previewHeight:[220,1000],themeTransitionMinutes:[0,120]}[key];M.validate; if(!Number.isFinite(s[key])||s[key]<bounds[0]||s[key]>bounds[1])throw new Error('Invalid '+key);}
  if(!['dark','grey','black'].includes(s.theme)||!['left','right','top','bottom'].includes(s.toolbarEdge)||!['frames','seconds'].includes(s.timeDisplay))throw new Error('Invalid appearance setting.');
  for(const key of ['videoColor','audioColor','textColor','noteColor'])if(!/^#[a-f\d]{6}$/i.test(s[key]))throw new Error('Invalid track colour.');
  for(const key of ['dayStart','nightStart'])if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[key]))throw new Error('Use HH:MM for theme schedules.');
  if(!['dark','grey','black'].includes(s.dayTheme)||!['dark','grey','black'].includes(s.nightTheme))throw new Error('Invalid scheduled theme.');
  for(const [key,val]of Object.entries(s.shortcuts))if(!Object.hasOwn(defaults.shortcuts,key)||typeof val!=='string'||val.length>70)throw new Error('Invalid key binding.');
  if(!Array.isArray(s.toolbar)||s.toolbar.length!==new Set(s.toolbar).size||s.toolbar.some(t=>!M.tools.some(v=>v[0]===t)))throw new Error('Invalid toolbar.');
  for(const key of ['folders','library','favourites','templates','colorPresets','plugins','customShortcuts'])if(!Array.isArray(s[key])||s[key].length>10000)throw new Error('Invalid '+key);
  if(s.folders.some(f=>typeof f!=='string'||!path.isAbsolute(f)))throw new Error('Library folders must be absolute paths.');
  if(s.customShortcuts.some(k=>typeof k.binding!=='string'||k.binding.length>70||!Object.hasOwn(defaults.shortcuts,k.action)))throw new Error('Custom keybinds must use an existing editor action.');
  for(const key of ['speechRegion','speechVoice','speechLanguage','whisperExecutable','whisperModel','exportFolder'])if(typeof s[key]!=='string'||s[key].length>1000)throw new Error('Invalid service setting.');
  if(s.speechRegion&&!/^[a-z][a-z0-9-]{1,45}$/.test(s.speechRegion))throw new Error('Invalid Microsoft Speech region.');
  M.validate(M.create(s),new Map(),{allowEmpty:true});
  for(const key of ['volume','fadeIn','fadeOut','noise','duck'])if(typeof s.defaultAudio[key]!=='number'||!Number.isFinite(s.defaultAudio[key])||s.defaultAudio[key]<0||s.defaultAudio[key]>(key==='volume'?4:key==='fadeIn'||key==='fadeOut'?86400:1))throw new Error('Invalid default audio '+key);
  if(!['windows','azure'].includes(s.ttsProvider)||!Number.isInteger(s.captionThreads)||s.captionThreads<1||s.captionThreads>8||typeof s.speechRate!=='number'||s.speechRate<-10||s.speechRate>10)throw new Error('Invalid speech settings.');
  if(![.5,1].includes(s.previewQuality))throw new Error('Preview quality must be half or full.');
  return s;
}
class Store{
  constructor(root){this.root=root;this.settings=M.defaults();}
  async load(){this.settings=validateSettings(await read(path.join(this.root,'settings.json'),M.defaults()));return this.settings;}
  async save(value){const s=validateSettings(value);await atomic(path.join(this.root,'settings.json'),s);this.settings=s;return s;}
  async snapshot(project){const dir=path.join(this.root,'autosaves',project.id);await fs.mkdir(dir,{recursive:true});const file=path.join(dir,Date.now()+'.tmacut');await atomic(file,project);await atomic(path.join(this.root,'recovery.json'),{file,name:project.name,time:new Date().toISOString()});const files=(await fs.readdir(dir)).filter(f=>/^\d+\.tmacut$/.test(f)).sort();for(const f of files.slice(0,-this.settings.backupCount))await fs.rm(path.join(dir,f));return {time:new Date().toISOString(),file};}
  async recovery(){return read(path.join(this.root,'recovery.json'),null);}
  async crash(error,details={}){const data={id:crypto.randomUUID(),time:new Date().toISOString(),version:require('../package.json').version,platform:process.platform,arch:process.arch,error:String(error?.stack||error).slice(0,16000),details};await atomic(path.join(this.root,'crash-report.json'),data);return data;}
}
const workspaceKeys=['theme','scheduledTheme','dayTheme','nightTheme','dayStart','nightStart','themeTransitionMinutes','timelineZoom','timeDisplay','wheelZoom','showFPS','analytics','resources','showSuggestions','searchKB','showIcons','videoColor','audioColor','textColor','noteColor','toolbar','toolbarEdge','inspectorWidth','previewHeight','shortcuts','customShortcuts','defaultVideo','defaultAudio','previewQuality','colorPresets'];
function workspaceProfile(settings){return {schemaVersion:1,workspace:Object.fromEntries(workspaceKeys.map(key=>[key,settings[key]]))};}
function mergeWorkspace(settings,value){if(value?.schemaVersion!==1||!value.workspace||typeof value.workspace!=='object')throw new Error('Invalid workspace profile.');return validateSettings({...settings,...Object.fromEntries(workspaceKeys.filter(key=>Object.hasOwn(value.workspace,key)).map(key=>[key,value.workspace[key]]))});}
module.exports={Store,read,atomic,validateSettings,workspaceProfile,mergeWorkspace};
