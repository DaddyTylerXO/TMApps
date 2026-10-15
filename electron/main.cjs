const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('node:path');
let mainWindow;

function createWindow() {
  const window = new BrowserWindow({
    width: 1500, height: 1000, minWidth: 1000, minHeight: 720,
    backgroundColor: '#f5f5f0', title: 'Agent Office', autoHideMenuBar: true,
    webPreferences: { preload:path.join(__dirname,'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow=window;
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  const apps = require('./integrations.cjs').setupIntegrations({app,ipcMain,dialog,shell,window});
  require('./ai-service.cjs').setupAI({app,ipcMain,safeStorage,window,apps,shell,dialog});
  window.loadFile(path.join(__dirname, '../src/index.html'));
}
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('second-instance',()=>{if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
