'use strict';
const {BrowserWindow,Tray,Menu,nativeImage,screen,ipcMain}=require('electron');
const path=require('node:path'),{pathToFileURL}=require('node:url');
const page=pathToFileURL(path.join(__dirname,'../ui/tray.html')).href;
function position(anchor,area,width=240,height=300){return{x:Math.round(Math.max(area.x,Math.min(anchor.x+anchor.width/2-width/2,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(anchor.y+anchor.height,area.y+area.height-height)))};}
class TrayUI{
  constructor(actions){this.actions=actions;this.popup=null;this.icon=null;this.loaded=null;
    ipcMain.handle('padlock:tray',async(event,name)=>{
      if(!this.popup||event.sender!==this.popup.webContents||event.senderFrame!==this.popup.webContents.mainFrame||event.senderFrame.url!==page||!Object.hasOwn(this.actions,name))throw Error('Untrusted tray action.');
      this.popup.hide();await this.actions[name]();return true;
    });
  }
  async menu(anchor){
    if(!this.popup){
      this.popup=new BrowserWindow({width:240,height:300,show:false,frame:false,transparent:true,resizable:false,skipTaskbar:true,alwaysOnTop:true,hasShadow:false,webPreferences:{preload:path.join(__dirname,'tray-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,devTools:false}});
      this.popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));this.popup.webContents.on('will-navigate',e=>e.preventDefault());this.popup.webContents.on('will-attach-webview',e=>e.preventDefault());
      this.popup.webContents.on('before-input-event',(e,input)=>{if(input.key==='Escape'){e.preventDefault();this.popup.hide();}});
      this.popup.on('blur',()=>this.popup?.hide());this.popup.on('closed',()=>{this.popup=null;this.loaded=null;});
      this.loaded=this.popup.loadFile(path.join(__dirname,'../ui/tray.html'));
    }
    await this.loaded;
    const bounds=anchor||this.icon?.getBounds()||{...screen.getCursorScreenPoint(),width:1,height:1};
    this.popup.setPosition(...Object.values(position(bounds,screen.getDisplayMatching(bounds).workArea)));
    this.popup.show();this.popup.focus();
  }
  setVisible(enabled){
    if(!enabled){this.icon?.destroy();this.icon=null;this.popup?.hide();return;}
    if(this.icon)return;
    this.icon=new Tray(nativeImage.createFromPath(path.join(__dirname,'../assets/icon.png')).resize({width:24,height:24}));
    this.icon.setToolTip('TMA-Padlock');
    const show=()=>this.menu().catch(()=>this.actions.open());
    this.icon.on('click',show);this.icon.on('right-click',show);this.icon.on('double-click',()=>{this.popup?.hide();this.actions.open();});
    // StatusNotifier hosts on Linux may expose only their native context menu.
    if(process.platform==='linux')this.icon.setContextMenu(Menu.buildFromTemplate([{label:'Open TMA-Padlock',click:this.actions.open},{label:'Mini authenticator',click:this.actions.mini},{label:'Settings',click:this.actions.settings},{label:'Lock vault',click:this.actions.lock},{label:'Exit TMA-Padlock',click:this.actions.quit}]));
  }
  destroy(){this.icon?.destroy();this.icon=null;this.popup?.destroy();this.popup=null;}
}
module.exports={TrayUI,position};
