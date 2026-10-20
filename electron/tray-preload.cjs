'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('trayMenu', { action: value => ipcRenderer.invoke('tray:action', value) });
