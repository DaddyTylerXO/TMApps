'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('padlockTray',{action:name=>{if(!['open','mini','settings','lock','quit'].includes(name))return Promise.reject(Error('Unknown action.'));return ipcRenderer.invoke('padlock:tray',name);}});
