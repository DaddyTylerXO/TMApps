'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const api={};for(const name of ['status','unlock','create','list','lock','verify','add','rename','remove','advance','copy','backup','restore','activity','preferences','savePreferences'])api[name]=async value=>{const r=await ipcRenderer.invoke('padlock:'+name,value);if(!r.ok)throw Error(r.error);return r.value;};
api.onLock=fn=>{const handler=()=>fn();ipcRenderer.on('padlock:locked',handler);return()=>ipcRenderer.removeListener('padlock:locked',handler);};api.onSettings=fn=>{const handler=()=>fn();ipcRenderer.on('padlock:settings',handler);return()=>ipcRenderer.removeListener('padlock:settings',handler);};contextBridge.exposeInMainWorld('padlock',api);
