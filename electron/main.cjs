'use strict';
const {app,BrowserWindow,ipcMain,dialog,Tray,Menu,nativeImage,screen,protocol,net,shell}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {validate,parseSrt}=require('./project.cjs');
const {exportVideo}=require('./export.cjs');
const exec=promisify(execFile), media=new Map(), page=pathToFileURL(path.join(__dirname,'../ui/index.html')).href, trayPage=pathToFileURL(path.join(__dirname,'../ui/tray.html')).href;
let window,tray,trayWindow,quitting=false,controller,lastExport;
const smokeIndex=process.argv.indexOf('--smoke');
if(smokeIndex>=0)app.setPath('userData',path.join(path.dirname(path.resolve(process.argv[smokeIndex+1])),'smoke-profile-'+process.pid));
const unpack=p=>p.replace(/app\.asar([\\/])/,'app.asar.unpacked$1');
const ffmpeg=()=>process.env.TMA_CUT_FFMPEG || unpack(require('ffmpeg-static'));
const ffprobe=()=>process.env.TMA_CUT_FFPROBE || unpack(require('ffprobe-static').path);
protocol.registerSchemesAsPrivileged([{scheme:'cut-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true}}]);
function restore(){window.show(); if(window.isMinimized())window.restore(); window.focus(); trayWindow?.hide();}
async function register(file,kind){
  const stat=await fs.stat(file); if(!stat.isFile())throw new Error('Choose a regular media file.');
  const {stdout}=await exec(ffprobe(),['-v','error','-show_streams','-show_format','-of','json',file],{windowsHide:true,maxBuffer:4*1024**2,timeout:30000});
  const info=JSON.parse(stdout),video=info.streams?.find(s=>s.codec_type==='video'); if(!video)throw new Error('No video or image stream found.');
  const duration=+(info.format.duration||video.duration||0);
  if(kind==='video' && (!Number.isFinite(duration)||duration<=0))throw new Error('Could not read the video duration.');
  const id=crypto.randomUUID(),item={id,kind,path:file,name:path.basename(file),duration,width:video.width,height:video.height,transfer:video.color_transfer || '',audio:info.streams.some(s=>s.codec_type==='audio'),url:`cut-media://asset/${id}`};
  media.set(id,item); return publicMedia(item);
}
function publicMedia(item){const {path:ignored,...result}=item;return result;}
async function importFiles(kind){
  const result=await dialog.showOpenDialog(window,{title:kind==='video'?'Import video clips':'Add image overlay / logo',properties:kind==='video'?['openFile','multiSelections']:['openFile'],filters:[{name:kind==='video'?'Videos':'Images',extensions:kind==='video'?['mp4','mov','mkv','webm','avi','m4v']:['png','jpg','jpeg','webp']}]});
  if(result.canceled)return null;
  const imported=[],errors=[]; for(const file of result.filePaths) {try{imported.push(await register(file,kind));}catch(e){errors.push(`${path.basename(file)}: ${e.message}`);}}
  return {media:imported,errors};
}
async function saveProject(value){
  const project=validate(value,media), result=await dialog.showSaveDialog(window,{title:'Save edit',defaultPath:project.name+'.tmacut',filters:[{name:'TMA-Cut project',extensions:['tmacut']}]}); if(result.canceled)return null;
  const assets=[...new Set([...project.clips.map(c=>c.mediaId),...(project.overlay?[project.overlay.mediaId]:[])])].map(id=>({id,kind:media.get(id).kind,path:media.get(id).path}));
  const target=result.filePath,temp=target+'.tmp-'+crypto.randomUUID();
  try{await fs.writeFile(temp,JSON.stringify({...project,assets},null,2));await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
  return path.basename(target);
}
async function openProject(){
  const result=await dialog.showOpenDialog(window,{title:'Open edit',properties:['openFile'],filters:[{name:'TMA-Cut project',extensions:['tmacut']}]}); if(result.canceled)return null;
  if((await fs.stat(result.filePaths[0])).size>5*1024**2)throw new Error('Project file is too large.');
  const value=JSON.parse(await fs.readFile(result.filePaths[0],'utf8')); if(!Array.isArray(value.assets)||value.assets.length>101)throw new Error('Invalid project assets.');
  const remap=new Map(),imported=[];
  for(const a of value.assets){
    if(!['video','image'].includes(a.kind)||!path.isAbsolute(a.path)||/^(\\\\|\/\/)/.test(a.path))throw new Error('Project media must use local absolute file paths.');
    let file=a.path;
    try{await fs.access(file);}catch{
      const replacement=await dialog.showOpenDialog(window,{title:`Locate missing media: ${path.basename(file)}`,properties:['openFile']}); if(replacement.canceled)throw new Error('Open cancelled: media is missing.'); file=replacement.filePaths[0];
    }
    const item=await register(file,a.kind);imported.push(item);remap.set(a.id,item.id);
  }
  value.clips=value.clips.map(c=>({...c,mediaId:remap.get(c.mediaId)}));if(value.overlay)value.overlay.mediaId=remap.get(value.overlay.mediaId);
  return {project:validate(value,media),media:imported};
}
async function startExport(value){
  if(controller)throw new Error('An export is already running.'); const project=validate(value,media);
  const chosen=await dialog.showSaveDialog(window,{title:'Export MP4',defaultPath:project.name+'.mp4',filters:[{name:'MP4 video',extensions:['mp4']}]});if(chosen.canceled)return null;
  const target=chosen.filePath,sourcePaths=[...media.values()].map(x=>path.resolve(x.path).toLowerCase());if(sourcePaths.includes(path.resolve(target).toLowerCase()))throw new Error('Choose a different name from your source media.');
  const temp=path.join(path.dirname(target),`.tma-cut-${crypto.randomUUID()}.mp4`);controller=new AbortController();
  try {
    await exportVideo(ffmpeg(),project,media,temp,{tempRoot:app.getPath('temp'),signal:controller.signal,onProgress:seconds=>window.webContents.send('progress',{percent:Math.min(99,Math.round(seconds/project.duration*100))})});
    await fs.rename(temp,target);lastExport=target;window.webContents.send('progress',{percent:100});return {name:path.basename(target)};
  }finally{controller=null;await fs.rm(temp,{force:true});}
}
const uploaders={youtube:'https://studio.youtube.com/',tiktok:'https://www.tiktok.com/tiktokstudio/upload',instagram:'https://www.instagram.com/'};
async function run(){
  protocol.handle('cut-media',request=>{const u=new URL(request.url),id=u.pathname.slice(1),item=media.get(id);if(u.hostname!=='asset'||!item)return new Response('Not found',{status:404});return net.fetch(pathToFileURL(item.path).href,{headers:request.headers});});
  window=new BrowserWindow({width:1440,height:960,minWidth:1080,minHeight:740,show:smokeIndex<0,title:'TMA-Cut',backgroundColor:'#17191f',autoHideMenuBar:true,icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
  for(const w of [window]){w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());}
  const methods={importVideos:()=>importFiles('video'),importOverlay:()=>importFiles('image'),saveProject,openProject,exportVideo:startExport,cancelExport:()=>{controller?.abort();},revealExport:()=>{if(lastExport)shell.showItemInFolder(lastExport);},share:async key=>{if(!lastExport)throw new Error('Export your video before opening an uploader.');if(!uploaders[key])throw new Error('Unknown platform.');shell.showItemInFolder(lastExport);await shell.openExternal(uploaders[key]);},importCaptions:async()=>{
    const chosen=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'SubRip captions',extensions:['srt']}]});if(chosen.canceled)return null;if((await fs.stat(chosen.filePaths[0])).size>2*1024**2)throw new Error('Caption file is too large.');return parseSrt(await fs.readFile(chosen.filePaths[0],'utf8'));
  }};
  ipcMain.handle('cut',async(event,method,value)=>{
    try{
      if(event.senderFrame!==event.sender.mainFrame)throw new Error('Unknown caller.');
      if(method==='trayAction'&&event.sender===trayWindow?.webContents&&event.senderFrame.url===trayPage){
        trayWindow.hide();if(value==='open')restore();else if(value==='import'){restore();window.webContents.send('command','import');}else if(value==='quit'){window.close();}return {ok:true};
      }
      if(event.sender!==window.webContents||event.senderFrame.url!==page||!Object.hasOwn(methods,method))throw new Error('Unknown caller.');return {ok:true,data:await methods[method](value)};
    }catch(e){return {ok:false,error:e.name==='AbortError'?'Export cancelled.':e.message};}
  });
  await window.loadURL(page);
  window.on('close',event=>{if(quitting)return;event.preventDefault();void (async()=>{const result=await dialog.showMessageBox(window,{type:'question',message:controller?'Cancel the export and quit?':'Save your edit before quitting?',detail:controller?'The unfinished export will be removed.':'Unsaved changes will be lost. Project files keep edits; source videos are kept separately.',buttons:controller?['Keep editing','Cancel export and quit']:['Keep editing','Quit without saving'],defaultId:0,cancelId:0});if(result.response===1){if(controller){controller.abort(); const timer=setInterval(()=>{if(!controller){clearInterval(timer);quitting=true;app.quit();}},100);}else{quitting=true;app.quit();}}})();});
  try{
    tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'../assets/icon.png')).resize({width:24,height:24}));tray.setToolTip('TMA-Cut');
    trayWindow=new BrowserWindow({width:250,height:227,frame:false,transparent:true,resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
    await trayWindow.loadURL(trayPage);trayWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));trayWindow.webContents.on('will-navigate',e=>e.preventDefault());trayWindow.on('blur',()=>trayWindow.hide());
    const popup=(_e,position)=>{const bounds=tray.getBounds(),point=position||{x:bounds.x,y:bounds.y},area=screen.getDisplayNearestPoint(point).workArea;trayWindow.setPosition(Math.max(area.x,Math.min(point.x,area.x+area.width-250)),Math.max(area.y,Math.min(point.y,area.y+area.height-227)));trayWindow.show();trayWindow.focus();};
    tray.on('right-click',popup);tray.on('click',restore);tray.on('double-click',restore);
    // Linux StatusNotifier hosts use native DBus menus rather than right-click events.
    if(process.platform==='linux')tray.setContextMenu(Menu.buildFromTemplate([{label:'Open TMA-Cut',click:restore},{label:'Import videos',click:()=>{restore();window.webContents.send('command','import');}},{label:'Quit TMA-Cut',click:()=>window.close()}]));
  }catch{tray=null;}
  const smoke=process.argv.indexOf('--smoke');if(smoke>=0){await new Promise(r=>setTimeout(r,600));const report=process.argv[smoke+1];await fs.mkdir(path.dirname(report),{recursive:true});await fs.writeFile(report,JSON.stringify(await window.webContents.executeJavaScript('window.cutSmoke()')));await fs.writeFile(report+'.png',(await window.webContents.capturePage()).toPNG());quitting=true;app.quit();}
}
if(!app.requestSingleInstanceLock())app.quit();else{app.on('second-instance',()=>window&&restore());app.whenReady().then(run).catch(e=>{dialog.showErrorBox('TMA-Cut',e.message);app.quit();});app.on('activate',()=>window&&restore());}
app.on('before-quit',event=>{if(!quitting&&window){event.preventDefault();window.close();}});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{tray?.destroy();controller?.abort();});
