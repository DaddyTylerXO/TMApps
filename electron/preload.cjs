const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  integrations: () => ipcRenderer.invoke('office:integrations'),
  chooseApp: appId => ipcRenderer.invoke('office:choose-app', appId),
  chooseWorkFolder: () => ipcRenderer.invoke('office:work-folder'),
  openApp: appId => ipcRenderer.invoke('office:open-app', appId),
  saveAgentApps: (agentId,appIds) => ipcRenderer.invoke('office:agent-apps',{agentId,appIds}),
  legacyAccess: (appId,enabled) => ipcRenderer.invoke('office:legacy-access',{appId,enabled}),
  appTools: appId => ipcRenderer.invoke('office:app-tools', appId),
  runAppTool: action => ipcRenderer.invoke('office:run-app-tool', action),
  aiState: () => ipcRenderer.invoke('office:ai-state'),
  aiSave: payload => ipcRenderer.invoke('office:ai-save',payload),
  aiForget: () => ipcRenderer.invoke('office:ai-forget'),
  aiVerify: () => ipcRenderer.invoke('office:ai-verify'),
  aiLogin: () => ipcRenderer.invoke('office:ai-login'),
  aiLoginCancel: () => ipcRenderer.invoke('office:ai-login-cancel'),
  aiRuntime: () => ipcRenderer.invoke('office:ai-runtime'),
  aiSelect: provider => ipcRenderer.invoke('office:ai-select',provider),
  aiInstallGuide: () => ipcRenderer.invoke('office:ai-install-guide'),
  projectFiles: jobId => ipcRenderer.invoke('office:project-files',jobId),
  projectRead: payload => ipcRenderer.invoke('office:project-read',payload),
  projectOpen: jobId => ipcRenderer.invoke('office:project-open',jobId),
  projectFolderInfo: projectId => ipcRenderer.invoke('office:project-folder-info',projectId),
  projectFolderSave: payload => ipcRenderer.invoke('office:project-folder-save',payload),
  projectFolderChoose: () => ipcRenderer.invoke('office:project-folder-choose'),
  aiSubmit: payload => ipcRenderer.invoke('office:ai-submit',payload),
  aiSubmitApp: payload => ipcRenderer.invoke('office:ai-app-submit',payload),
  aiPause: paused => ipcRenderer.invoke('office:ai-pause',paused),
  aiCancel: id => ipcRenderer.invoke('office:ai-cancel',id),
  aiRetry: id => ipcRenderer.invoke('office:ai-retry',id),
  aiApprove: payload => ipcRenderer.invoke('office:ai-approve',payload),
  onAiChanged: callback => {
    const listener=(_event,snapshot)=>callback(snapshot);
    ipcRenderer.on('office:ai-changed',listener);
    return ()=>ipcRenderer.removeListener('office:ai-changed',listener);
  },
  spotify: action => ipcRenderer.invoke('office:spotify', action)
});
