'use strict';
const {app,BrowserWindow,ipcMain,safeStorage,clipboard,dialog,powerMonitor}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url'),{Vault}=require('./vault.cjs'),{entry,code}=require('./otp.cjs');
let win,vault,queue=Promise.resolve(),activity=Date.now(),copied,timer;
const url=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
// Smoke fixtures use only passwords and must not trigger interactive OS keychain prompts.
const storage=process.argv.includes('--smoke')?null:safeStorage;
if(process.argv.includes('--smoke'))app.disableHardwareAcceleration();
function clearClipboard(){clearTimeout(timer);if(copied && clipboard.readText()===copied)clipboard.clear();copied=null;}
function lock(){vault?.lock();clearClipboard();win?.webContents.send('padlock:locked');}
const actions={
  status:()=>vault.status(),unlock:v=>vault.unlock(v||''),create:v=>{if(v.mode==='password'&&v.password!==v.confirm)throw Error('Passwords do not match.');return vault.create(v.password||'',v.mode);},
  list:()=>vault.list(),lock:()=>{lock();return true;},verify:v=>{vault.require();const e=entry(v);return{code:code(e),name:e.name,type:e.type};},add:v=>vault.add(v),rename:v=>vault.rename(v.id,v.name),
  remove:async id=>{vault.find(id);const r=await dialog.showMessageBox(win,{type:'warning',message:'Delete this authenticator?',detail:'Keep the service recovery codes before deleting. This cannot be undone.',buttons:['Cancel','Delete'],defaultId:0,cancelId:0});return r.response===1?vault.remove(id):vault.list();},
  advance:id=>vault.advance(id),copy:id=>{const e=vault.find(id);clearClipboard();copied=code(e);clipboard.writeText(copied);timer=setTimeout(clearClipboard,20000);return true;},
  backup:async()=>{vault.require();if(vault.header.mode!=='password')throw Error('Device-protected backups only open on this OS account. Use master-password protection for portable backups.');const r=await dialog.showSaveDialog(win,{defaultPath:'My authenticators.tmapadlock',filters:[{name:'Encrypted Padlock backup',extensions:['tmapadlock']}]});if(r.canceled)return false;if(path.resolve(r.filePath)===path.resolve(vault.file))throw Error('Choose a different backup location.');await fs.copyFile(vault.file,r.filePath);return true;},
  restore:async()=>{const s=await vault.status();if(s.exists)throw Error('Restore is available before creating a vault. Existing vaults are never overwritten.');const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Encrypted Padlock backup',extensions:['tmapadlock']}]});if(r.canceled)return false;const h=await vault.read(r.filePaths[0]);if(h.mode!=='password')throw Error('Choose a master-password protected backup.');await fs.mkdir(path.dirname(vault.file),{recursive:true});await fs.copyFile(r.filePaths[0],vault.file,1);return true;},
  activity:()=>{activity=Date.now();return true;}
};
if(!app.requestSingleInstanceLock())app.quit();
else{app.on('second-instance',()=>{win?.show();win?.focus();});app.whenReady().then(async()=>{
  app.setName('TMA-Padlock');vault=new Vault(path.join(app.getPath('userData'),'vault.tmapadlock'),storage);
  win=new BrowserWindow({width:1180,height:820,minWidth:800,minHeight:650,backgroundColor:'#17191f',icon:path.join(__dirname,'../assets/icon.png'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:!app.isPackaged}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.on('will-attach-webview',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.webContents.session.setPermissionCheckHandler(()=>false);
  for(const [name,action]of Object.entries(actions))ipcMain.handle('padlock:'+name,(event,value)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==url)throw Error('Untrusted caller.');
    if(name==='lock'){lock();return{ok:true,value:true};}if(name==='activity')return{ok:true,value:actions.activity()};
    const epoch=vault.epoch;const job=queue.then(async()=>{if(!['list','status'].includes(name))activity=Date.now();try{if(['unlock','create'].includes(name)&&epoch!==vault.epoch)throw Error('Vault locked. Try again.');return{ok:true,value:await action(value)};}catch(e){return{ok:false,error:e.message};}});queue=job.catch(()=>{});return job;
  });
  powerMonitor.on('suspend',lock);powerMonitor.on('lock-screen',lock);win.webContents.on('render-process-gone',lock);win.on('close',lock);win.on('closed',()=>{win=null;app.quit();});
  const idle=setInterval(()=>{if(vault.key&&Date.now()-activity>5*60000)lock();},1000);app.on('will-quit',()=>clearInterval(idle));
  if(process.argv.includes('--smoke')){setTimeout(()=>{console.error('Smoke test timed out waiting for the packaged renderer.');app.exit(1);},45000).unref();win.webContents.on('did-fail-load',(_e,code,description)=>{console.error('Smoke load failure',code,description);app.exit(1);});win.webContents.on('render-process-gone',(_e,details)=>{console.error('Smoke renderer failure',details);app.exit(1);});}
  if(process.argv.includes('--smoke'))win.webContents.once('did-finish-load',async()=>{let folder;try{const target=process.argv[process.argv.indexOf('--smoke')+1];await fs.mkdir(target,{recursive:true});await new Promise(r=>setTimeout(r,400));await fs.writeFile(path.join(target,'locked.png'),(await win.webContents.capturePage()).toPNG());folder=await fs.mkdtemp(path.join(os.tmpdir(),'padlock-smoke-'));vault=new Vault(path.join(folder,'demo'),storage);await vault.create('Fictional demo password','password');for(const name of ['Google · alex@example.com','GitHub · alex-studio','Microsoft · Work'])await vault.add({name,secret:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'});await win.webContents.executeJavaScript('window.refreshPadlock()');await new Promise(r=>setTimeout(r,500));const check=await win.webContents.executeJavaScript(`({cards:document.querySelectorAll('.auth-card').length,node:typeof require,secret:document.body.textContent.includes('GEZDGNBV')})`);if(check.cards!==3||check.node!=='undefined'||check.secret)throw Error('Smoke verification failed.');await fs.writeFile(path.join(target,'vault.png'),(await win.webContents.capturePage()).toPNG());console.log(JSON.stringify(check));lock();if(folder)await fs.rm(folder,{recursive:true,force:true});app.exit(0);}catch(e){console.error(e);app.exit(1);}});
  await win.loadFile(path.join(__dirname,'../ui/index.html'));
});}
