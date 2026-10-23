'use strict';
require('electron').contextBridge.exposeInMainWorld('spotify', Object.freeze({ call: (action, value) => require('electron').ipcRenderer.invoke('tmapps:spotify', action, value) }));
