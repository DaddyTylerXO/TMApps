'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = async (method, value) => { const result = await ipcRenderer.invoke('launcher', method, value); if (!result.ok) throw new Error(result.error); return result.data; };
const listen = (channel, callback) => { const handler = (_event, data) => callback(data); ipcRenderer.on(channel, handler); return () => ipcRenderer.removeListener(channel, handler); };
contextBridge.exposeInMainWorld('launcher', Object.freeze({
  snapshot: () => call('snapshot'), refresh: () => call('refresh'), profile: value => call('profile', value), settings: value => call('settings', value), choose: () => call('choose'), install: (id, options) => call('install', { id, options }), open: id => call('open', { id }), uninstall: (id, deleteData) => call('uninstall', { id, deleteData }), data: id => call('data', { id }), source: id => call('source', { id }), cancel: () => call('cancel'), answer: (id, value) => call('answer', { id, value }), update: () => call('update'), onPrompt: callback => listen('prompt', callback), onProgress: callback => listen('progress', callback), onNotice: callback => listen('notice', callback), onRefresh: callback => listen('refresh', callback)
}));
