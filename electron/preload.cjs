'use strict';
const {contextBridge,ipcRenderer,webUtils}=require('electron');
const methods=['bootstrap','importFiles','importPaths','importCaptions','saveProject','openProject','newProject','settings','secret','choose','listFolder','extractAudio','recording','tts','voices','copyright','autosave','recover','exportVideo','renderPreview','cancelExport','revealExport','thumbnail','storage','profileFile','pluginInstall','linkedUpload','autoCaptions','previewState','popout','fullscreen','help','reportIssue','crash','resources','previewControl','trayAction','assetRole','saveTemplate','demo','sampleKey','reportPreview','uploadIssue','favouriteAsset'];
contextBridge.exposeInMainWorld('cut',Object.fromEntries([
  ...methods.map(method=>[method,value=>ipcRenderer.invoke('cut',method,value)]),
  ['filePath',file=>webUtils.getPathForFile(file)],
  ['onPreview',callback=>{ipcRenderer.on('preview',(_event,data)=>callback(data));}],
  ['onProgress',callback=>{ipcRenderer.on('progress',(_event,data)=>callback(data));}],
  ['onCommand',callback=>{ipcRenderer.on('command',(_event,data)=>callback(data));}]
]));
