'use strict';
const { Tray, BrowserWindow, screen, ipcMain, nativeImage } = require('electron');
const path = require('node:path'), { pathToFileURL } = require('node:url');
function createTray(actions, { preview = false } = {}) {
  const url = pathToFileURL(path.join(__dirname, '../ui/tray.html')).href;
  const icon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 22, height: 22 });
  const tray = preview ? null : new Tray(icon); tray?.setToolTip('TMA-Safe');
  const popup = new BrowserWindow({ width: 240, height: 200, show: false, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, webPreferences: { preload: path.join(__dirname, 'tray-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false } });
  popup.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); popup.webContents.on('will-navigate', e => e.preventDefault()); popup.webContents.on('will-attach-webview', e => e.preventDefault());
  ipcMain.handle('tray:action', (event, action) => { if (event.sender !== popup.webContents || event.senderFrame !== popup.webContents.mainFrame || event.senderFrame.url !== url || !['open','settings','lock','exit','dismiss'].includes(action)) throw Error('Untrusted tray action.'); popup.hide(); actions[action]?.(); });
  popup.on('blur', () => popup.hide()); popup.loadURL(url);
  const show = () => { const b = tray.getBounds(), cursor = screen.getCursorScreenPoint(), anchor = b.width ? { x: b.x + b.width / 2, y: b.y } : cursor, area = screen.getDisplayNearestPoint({ x: Math.round(anchor.x), y: Math.round(anchor.y) }).workArea; popup.setPosition(Math.round(Math.max(area.x, Math.min(anchor.x - 120, area.x + area.width - 240))), Math.round(Math.max(area.y, Math.min(anchor.y > area.y + area.height / 2 ? anchor.y - 200 : anchor.y + b.height, area.y + area.height - 200)))); popup.show(); popup.focus(); };
  tray?.on('click', show); tray?.on('right-click', show); if (tray) tray.on('double-click', actions.open);
  return { destroy() { ipcMain.removeHandler('tray:action'); tray?.destroy(); popup.destroy(); }, popup };
}
module.exports = { createTray };
