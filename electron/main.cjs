const {app,BrowserWindow,ipcMain,safeStorage,shell,dialog,Tray,Menu,nativeImage,screen}=require('electron');const path=require('node:path');const {pathToFileURL}=require('node:url');const {Store}=require('./store.cjs');const {Service}=require('./service.cjs');const {PLATFORMS}=require('./providers.cjs');const {Preferences}=require('./preferences.cjs');
const launchStarted=Date.now();const checkLaunch=process.argv.includes('--verify-launch');app.setName('TMA-SocialsManager');if(process.argv.includes('--smoke')||checkLaunch){app.disableHardwareAcceleration();app.setPath('userData',path.resolve(`artifacts/smoke-profile-${process.pid}`));}if(!app.requestSingleInstanceLock())app.quit();
let win,service,prefs,tray,trayPopup,scheduler,exiting=false,closeReady=false,closePending=false;let queue=Promise.resolve();
const {OAuth}=require('./oauth.cjs');const {oauthFailure}=require('./diagnostics.cjs');const {Media}=require('./media.cjs');const {attachFeatures}=require('./features.cjs');let oauth,maintenance,features;function configure(){if(scheduler&&features)scheduler.configure(features.schedulerConfig());}
const {Scheduler}=require('./scheduler.cjs');
function enqueue(run){const result=queue.then(run);queue=result.catch(()=>{});return result;}
function snapshot(){return {...service.snapshot(),refreshStatus:scheduler?.status};}
function sendData(){if(win&&!win.isDestroyed())win.webContents.send('socials:data',snapshot());}
async function maintainAccounts(){if(prefs.value.offlineMode)return;for(const account of [...service.store.state.accounts])if(account.platform==='twitch'||account.platform==='youtube'){try{if(account.platform==='twitch'){const auth=await service.account(account.id);await oauth.validateTwitch(auth);}else await service.account(account.id);}catch(error){if(account.platform==='youtube'&&(error.revoked||error.status===401))service.purgeAccount(account.id);else account.error='Provider sign-in could not be validated. Reconnect this account.';}}service.pruneYouTube();await service.store.save();sendData();}
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
  win.webContents.on('render-process-gone',(_event,details)=>{features?.record(new Error(),'renderer');closeReady=true;win?.destroy();win=null;restore('settings');});win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
  win.on('close',e=>{if(closeReady)return;e.preventDefault();if(closePending)return;closePending=true;win.webContents.send('socials:prepareClose');});
  win.on('closed',()=>win=null);win.once('ready-to-show',()=>{const atLogin=process.argv.includes('--startup')||(process.platform==='darwin'&&app.getLoginItemSettings().wasOpenedAtLogin);const hidden=atLogin&&prefs.value.startMinimized&&tray;if(!hidden){if(prefs.value.startMaximized)win.maximize();win.show();}});win.loadURL(page);
}
ipcMain.on('socials:readyClose',event=>{if(event.sender===win?.webContents&&closePending)finishClose();});
ipcMain.on('socials:closeFailed',event=>{if(event.sender===win?.webContents){closePending=false;exiting=false;dialog.showErrorBox('Draft could not be saved','Your window is still open. Save your draft and try closing again.');}});
ipcMain.handle('socials:trayAction',(event,action)=>{if(event.sender!==trayPopup?.webContents||event.senderFrame!==trayPopup.webContents.mainFrame||event.senderFrame.url!==trayPage)throw Error('Untrusted request.');if(action==='open')restore();if(action==='settings')restore('settings');if(action==='exit')exit();if(action==='dismiss')trayPopup.hide();});
app.whenReady().then(async()=>{
  try{prefs=await new Preferences(app.getPath('userData'),{app}).load();if(process.argv.includes('--smoke')||checkLaunch)prefs.value.tourSeen=true;service=new Service(await new Store(app.getPath('userData'),safeStorage).load());oauth=new OAuth(service.store,{openExternal:url=>shell.openExternal(url)});service.oauth=oauth;service.media=new Media(app.getPath('userData'),nativeImage);await service.media.cleanup(service.store.state.drafts.flatMap(d=>d.attachment?[d.attachment.id]:[]));features=attachFeatures({ipcMain,win:()=>win,page,service,prefs,media:service.media,shell,dialog,app,enqueue,snapshot,configure,sendData});if(service.pruneYouTube())await service.store.save();
    for(const method of ['oauthSettings','saveOAuthClient','removeOAuthClient','importGoogleClient','oauthConnect'])ipcMain.handle(`socials:${method}`,async(event,value)=>{
      if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==page)throw Error('Untrusted request.');
      try{
        if(method==='oauthSettings')return oauth.settings();
        if(method==='saveOAuthClient')return await enqueue(()=>oauth.save(value));
        if(method==='removeOAuthClient')return await enqueue(()=>oauth.remove(value));
        if(method==='importGoogleClient'){
          const chosen=await dialog.showOpenDialog(win,{title:'Import Google Desktop OAuth client (local only)',properties:['openFile'],filters:[{name:'Google client JSON',extensions:['json']}]});if(chosen.canceled)return {cancelled:true};
          const fs=require('node:fs/promises');if((await fs.stat(chosen.filePaths[0])).size>65536)throw Error('The selected file is too large.');let client;try{client=JSON.parse(await fs.readFile(chosen.filePaths[0],'utf8')).installed;}catch{throw Error('Choose the JSON downloaded for a Google Desktop app client.');}if(!client)throw Error('This is not a Google Desktop app client. Create a Desktop app client in Google Auth Platform.');
          return await enqueue(()=>oauth.save({platform:'youtube',clientId:client.client_id,clientSecret:client.client_secret}));
        }
        if(method==='oauthConnect'){features.assertOnline();const auth=await oauth.signIn(value);const result=await enqueue(()=>service.connectOAuth(auth));configure();sendData();return result;}
      }catch(error){const safe=oauthFailure(error,method==='oauthConnect'?'browser':'config');features.record(safe,'oauth');return {error:safe.message};}
    });
    maintenance=setInterval(()=>enqueue(maintainAccounts).catch(()=>{}),3600000);maintenance.unref();enqueue(maintainAccounts).catch(()=>{});
    for(const method of ['legalDocument','openLegalLink'])ipcMain.handle(`socials:${method}`,async(event,key)=>{
      if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==page)throw Error('Untrusted request.');
      if(method==='legalDocument'){if(!['terms','privacy','deletion'].includes(key))throw Error('Unknown legal document.');return require('node:fs/promises').readFile(path.join(__dirname,'../assets/legal',key+'.md'),'utf8');}
      const links={googlePrivacy:'https://policies.google.com/privacy',youtubeTerms:'https://www.youtube.com/t/terms',googlePermissions:'https://security.google.com/settings/security/permissions'};if(!links[key])throw Error('Unknown legal link.');return shell.openExternal(links[key]);
    });
    for(const method of ['snapshot','dashboardAction','connect','disconnect','refresh','draft','deleteDraft','publish','openDocs','preferences','savePreferences'])ipcMain.handle(`socials:${method}`,(event,value)=>{
      if(event.sender!==win?.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==page)throw Error('Untrusted request.');
      const run=async()=>{try{if(['connect','refresh','publish'].includes(method))features.assertOnline();if(method==='snapshot')return snapshot();if(method==='disconnect'){const account=service.store.state.accounts.find(a=>a.id===value);let warning='';if(account){try{const auth=service.store.unseal(account.credentials);if(!prefs.value.offlineMode)await oauth.revoke(auth);else warning='Local data removed while offline. Revoke access in the provider security settings when connected.';}catch{warning='Local account data was removed. Remote revocation could not be confirmed; remove access in the provider security settings.';}}const result=await service.disconnect(value);return {...result,...(warning?{notice:warning}:{})};}if(method==='preferences')return {...prefs.value,isPackaged:app.isPackaged};if(method==='savePreferences'){const p=await prefs.update(value);applyTray();configure();return {...p,isPackaged:app.isPackaged};}if(method==='openDocs'){const p=PLATFORMS.find(p=>p.id===value);if(!p)throw Error('Unknown platform.');await shell.openExternal(p.docs);return {ok:true};}if(method==='publish'){const result=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Publish now'],defaultId:0,cancelId:0,message:'Publish this post to the selected accounts?',detail:'This sends the saved draft to the platforms shown in your composer.'});if(result.response!==1)return {cancelled:true};}const result=await service[method](value);if(['dashboardAction','connect'].includes(method))configure();return result;}catch(e){return {error:e.name==='ProviderError'?e.message:method==='connect'?'Could not connect. Check your credentials, account permissions, and system keychain.':e.message.includes('token')?'The request could not be completed. Reconnect your account.':e.message};}};
      return enqueue(run);
    });scheduler=new Scheduler({run:()=>enqueue(async()=>{await features.refreshDue();sendData();}),onChange:status=>{if(win&&!win.isDestroyed())win.webContents.send('socials:status',status);}});configure();applyTray();createWindow();if(checkLaunch)win.webContents.once('did-finish-load',()=>require('./launch-check.cjs')({app,win,started:launchStarted,finish:code=>{closeReady=true;app.exit(code);}}).catch(()=>{closeReady=true;app.exit(1);}));if(process.argv.includes('--smoke'))win.webContents.once('did-finish-load',()=>require('../scripts/smoke.cjs')({win,prefs,showTrayMenu,exit,media:service.media}).catch(async e=>{require('node:fs').writeFileSync(path.resolve('artifacts/smoke-error.txt'),e.stack);closeReady=true;app.exit(1);}));
  }catch{dialog.showErrorBox('Workspace could not be opened','Your workspace files have been preserved. Check access to the application data folder before restarting.');app.quit();}
});
app.on('before-quit',e=>{if(win&&!closeReady){e.preventDefault();exiting=true;win.close();}});
app.on('will-quit',()=>{scheduler?.stop();clearInterval(maintenance);});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});app.on('activate',()=>{if(service)restore();});

process.on('uncaughtException',async error=>{await features?.record(error,'application');app.exit(1);});
process.on('unhandledRejection',error=>{features?.record(error,'application');});
