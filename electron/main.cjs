const {app,BrowserWindow,ipcMain,safeStorage,shell,dialog,Tray,Menu,nativeImage,screen}=require('electron');const path=require('node:path');const {pathToFileURL}=require('node:url');const {Store}=require('./store.cjs');const {Service}=require('./service.cjs');const {PLATFORMS}=require('./providers.cjs');const {Preferences}=require('./preferences.cjs');
app.setName('TMA-SocialsManager');if(process.argv.includes('--smoke')){app.disableHardwareAcceleration();app.setPath('userData',path.resolve(`artifacts/smoke-profile-${process.pid}`));}if(!app.requestSingleInstanceLock())app.quit();
let win,service,prefs,tray,trayPopup,scheduler,exiting=false,closeReady=false,closePending=false;let queue=Promise.resolve();
const {Scheduler}=require('./scheduler.cjs');
function enqueue(run){const result=queue.then(run);queue=result.catch(()=>{});return result;}
function snapshot(){return {...service.snapshot(),refreshStatus:scheduler?.status};}
function sendData(){if(win&&!win.isDestroyed())win.webContents.send('socials:data',snapshot());}
const page=pathToFileURL(path.join(__dirname,'../ui/index.html')).href;
const trayPage=pathToFileURL(path.join(__dirname,'../ui/tray.html')).href;
function restore(view){trayPopup?.hide();const created=!win||win.isDestroyed();if(created)createWindow();win.show();if(win.isMinimized())win.restore();if(prefs.value.startMaximized)win.maximize();win.focus();if(view){if(created)win.webContents.once('did-finish-load',()=>win?.webContents.send('socials:navigate',view));else win.webContents.send('socials:navigate',view);}}
function exit(){exiting=true;if(win&&!win.isDestroyed())win.close();else app.quit();}
app.on('second-instance',()=>restore());
function showTrayMenu(){
  if(process.platform!=='win32'){tray.popUpContextMenu();return;}
  if(!trayPopup){trayPopup=new BrowserWindow({width:270,height:170,frame:false,resizable:false,skipTaskbar:true,alwaysOnTop:true,show:false,transparent:true,webPreferences:{preload:path.join(__dirname,'tray-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});trayPopup.loadURL(trayPage);trayPopup.webContents.setWindowOpenHandler(()=>({action:'deny'}));trayPopup.webContents.on('will-navigate',e=>e.preventDefault());trayPopup.on('blur',()=>trayPopup.hide());trayPopup.webContents.once('did-finish-load',()=>showTrayMenu());return;}
  const pos=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(pos).workArea;trayPopup.setPosition(Math.max(area.x,Math.min(pos.x,area.x+area.width-270)),Math.max(area.y,Math.min(pos.y-170,area.y+area.height-170)));trayPopup.show();trayPopup.focus();
}
function applyTray(){
  if(!prefs.value.showTray){tray?.destroy();tray=null;trayPopup?.destroy();trayPopup=null;return;}
  if(tray)return;
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'../assets/icon.png')).resize({width:24,height:24}));tray.setToolTip('TMA-SocialsManager');
  if(process.platform!=='win32')tray.setContextMenu(Menu.buildFromTemplate([{label:'Open TMA-SocialsManager',click:()=>restore()},{label:'Settings',click:()=>restore('settings')},{type:'separator'},{label:'Exit TMA-SocialsManager',click:exit}]));
  tray.on('right-click',showTrayMenu);tray.on('click',()=>process.platform==='darwin'?showTrayMenu():restore());tray.on('double-click',()=>restore());
}
function finishClose(){closePending=false;if(exiting){closeReady=true;app.quit();return;}if(prefs.value.closeToTray&&tray){win.hide();return;}closeReady=true;win.close();}
function createWindow(){
  closeReady=false;win=new BrowserWindow({width:1360,height:920,minWidth:920,minHeight:640,show:false,backgroundColor:'#17191f',title:'TMA-SocialsManager',icon:path.join(__dirname,'../assets/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  win.on('close',e=>{if(closeReady)return;e.preventDefault();if(closePending)return;closePending=true;win.webContents.send('socials:prepareClose');});
  win.on('closed',()=>win=null);win.once('ready-to-show',()=>{const atLogin=process.argv.includes('--startup')||(process.platform==='darwin'&&app.getLoginItemSettings().wasOpenedAtLogin);const hidden=atLogin&&prefs.value.startMinimized&&tray;if(!hidden){if(prefs.value.startMaximized)win.maximize();win.show();}});win.loadURL(page);
}
ipcMain.on('socials:readyClose',event=>{if(event.sender===win?.webContents&&closePending)finishClose();});
ipcMain.on('socials:closeFailed',event=>{if(event.sender===win?.webContents){closePending=false;exiting=false;dialog.showErrorBox('Draft could not be saved','Your window is still open. Save your draft and try closing again.');}});
ipcMain.handle('socials:trayAction',(event,action)=>{if(event.sender!==trayPopup?.webContents||event.senderFrame!==trayPopup.webContents.mainFrame||event.senderFrame.url!==trayPage)throw Error('Untrusted request.');if(action==='open')restore();if(action==='settings')restore('settings');if(action==='exit')exit();if(action==='dismiss')trayPopup.hide();});
app.whenReady().then(async()=>{
  try{prefs=await new Preferences(app.getPath('userData'),{app}).load();service=new Service(await new Store(app.getPath('userData'),safeStorage).load());
    for(const method of ['snapshot','dashboardAction','connect','disconnect','refresh','draft','deleteDraft','publish','openDocs','preferences','savePreferences'])ipcMain.handle(`socials:${method}`,(event,value)=>{
      if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==page)throw Error('Untrusted request.');
      const run=async()=>{try{if(method==='snapshot')return snapshot();if(method==='preferences')return {...prefs.value,isPackaged:app.isPackaged};if(method==='savePreferences'){const p=await prefs.update(value);applyTray();scheduler.configure(p);return {...p,isPackaged:app.isPackaged};}if(method==='openDocs'){const p=PLATFORMS.find(p=>p.id===value);if(!p)throw Error('Unknown platform.');await shell.openExternal(p.docs);return {ok:true};}if(method==='publish'){const result=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Publish now'],defaultId:0,cancelId:0,message:'Publish this post to the selected accounts?',detail:'This sends the saved draft to the platforms shown in your composer.'});if(result.response!==1)return {cancelled:true};}return await service[method](value);}catch(e){return {error:e.name==='ProviderError'?e.message:method==='connect'?'Could not connect. Check your credentials, account permissions, and system keychain.':e.message.includes('token')?'The request could not be completed. Reconnect your account.':e.message};}};
      return enqueue(run);
    });scheduler=new Scheduler({run:()=>enqueue(()=>service.refresh()),onChange:sendData});scheduler.configure(prefs.value);applyTray();createWindow();if(process.argv.includes('--smoke'))win.webContents.once('did-finish-load',()=>require('../scripts/smoke.cjs')({win,prefs,showTrayMenu,exit}).catch(async e=>{require('node:fs').writeFileSync(path.resolve('artifacts/smoke-error.txt'),e.stack);closeReady=true;app.exit(1);}));
  }catch{dialog.showErrorBox('Workspace could not be opened','Your workspace files have been preserved. Check access to the application data folder before restarting.');app.quit();}
});
app.on('before-quit',e=>{if(win&&!closeReady){e.preventDefault();exiting=true;win.close();}});
app.on('will-quit',()=>scheduler?.stop());app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});app.on('activate',()=>{if(service)restore();});
