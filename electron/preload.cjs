'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const methods=['importVideos','importOverlay','importCaptions','saveProject','openProject','exportVideo','cancelExport','revealExport','share','trayAction'];
contextBridge.exposeInMainWorld('cut',Object.fromEntries([
  ...methods.map(method=>[method,value=>ipcRenderer.invoke('cut',method,value)]),
  ['onProgress',callback=>{ipcRenderer.on('progress',(_event,data)=>callback(data));}],
  ['onCommand',callback=>{ipcRenderer.on('command',(_event,data)=>callback(data));}]
]));
