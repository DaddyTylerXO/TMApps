const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('trayActions',{run:action=>ipcRenderer.invoke('socials:trayAction',action)});
