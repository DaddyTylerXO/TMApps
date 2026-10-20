'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const methods = ['state', 'settings', 'folder', 'removeFolder', 'chooseVault', 'chooseKey', 'createKey', 'create', 'unlock', 'lock', 'put', 'remove', 'reveal', 'copy', 'generate', 'previewImport', 'import', 'backup', 'bridge', 'extension', 'activity'];
contextBridge.exposeInMainWorld('safe', Object.fromEntries(methods.map(method => [method, value => ipcRenderer.invoke('safe:' + method, value)])));
ipcRenderer.on('locked', () => window.dispatchEvent(new Event('safe-locked')));
ipcRenderer.on('refresh', () => window.dispatchEvent(new Event('safe-refresh')));
ipcRenderer.on('settings', () => window.dispatchEvent(new Event('safe-settings')));
