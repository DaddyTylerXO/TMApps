'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('trayMenu', { action: value => ipcRenderer.invoke('tray:action', value) });

ipcRenderer.on('tray-appearance',(_event,value) => window.dispatchEvent(new CustomEvent('tray-appearance',{detail:value})));
