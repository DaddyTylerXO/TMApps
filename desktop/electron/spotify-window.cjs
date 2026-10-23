'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { Spotify } = require('./spotify.cjs');
function setupSpotify({ brand = '#CC5500', name = 'TMApps Launcher', preview = false } = {}) {
  const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
  let music, client, memory, queue = Promise.resolve();
  const persistent = () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');
  const tokenFile = path.join(app.getPath('userData'), 'spotify-session.bin'), modeFile = path.join(app.getPath('userData'), 'spotify-settings.json');
  const vault = { get persistent() { return persistent(); }, read: async () => { if (memory) return memory; if (!persistent()) return null; try { return safeStorage.decryptString(await fs.readFile(tokenFile)); } catch { return null; } }, write: async value => { memory = value; if (!persistent()) return; await fs.mkdir(path.dirname(tokenFile), { recursive: true, mode: 0o700 }); const temporary = tokenFile + '.tmp'; await fs.writeFile(temporary, safeStorage.encryptString(value), { mode: 0o600 }); await fs.rename(temporary, tokenFile); }, clear: async () => { memory = null; await fs.rm(tokenFile, { force: true }); } };
  async function open() {
    if (music) { music.show(); music.focus(); return; }
    client = new Spotify({ vault, open: url => shell.openExternal(url) });
    music = new BrowserWindow({ width: 600, height: 650, show: !preview, minWidth: 500, minHeight: 550, title: name + ' · Spotify', backgroundColor: '#22252c', autoHideMenuBar: true, titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden', titleBarOverlay: process.platform === 'darwin' ? undefined : { color: '#22252c', symbolColor: '#eceef3', height: 38 }, webPreferences: { preload: path.join(__dirname, 'spotify-preload.cjs'), offscreen: preview, contextIsolation: true, nodeIntegration: false, sandbox: true } });
    music.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); music.webContents.on('will-navigate', event => event.preventDefault());
    music.on('closed', () => { client?.dispose(); client = null; music = null; });
    await music.loadFile(path.join(__dirname, '../ui/spotify.html'));
  }
  ipcMain.handle('tmapps:spotify-open', event => { if (event.senderFrame !== event.sender.mainFrame || !BrowserWindow.fromWebContents(event.sender)) throw new Error('Spotify is available only from app windows.'); return open(); });
  ipcMain.handle('tmapps:spotify', (event, action, value) => {
    if (!music || event.sender !== music.webContents || event.senderFrame !== music.webContents.mainFrame) throw new Error('Invalid Spotify window.');
    const run = async () => { try {
      if (!client) throw new Error('Spotify window closed.');
      if (action === 'status') { let mode = 'Connect', guide; try { const p = JSON.parse(await fs.readFile(modeFile, 'utf8')); if (p.mode === 'Browser') mode = 'Browser'; } catch {} try { guide = JSON.parse(await fs.readFile(path.join(__dirname, '../ui/spotify-kb.json'), 'utf8')); } catch {} return { ...await client.status(), mode, name, brand, guide }; }
      if (action === 'mode') { if (!['Connect', 'Browser'].includes(value)) throw new Error('Invalid playback mode.'); await fs.mkdir(path.dirname(modeFile), { recursive: true }); await fs.writeFile(modeFile, JSON.stringify({ mode: value })); return {}; }
      if (action === 'browser') { await shell.openExternal('https://open.spotify.com/'); return {}; }
      if (action === 'connect') return await client.connect(); if (action === 'disconnect') return await client.disconnect(); if (action === 'playback') return await client.playback(); if (action === 'control') return await client.control(value);
      throw new Error('Unknown Spotify operation.');
    } catch (error) { return { error: error.message }; } };
    const result = queue.then(run, run); queue = result.catch(() => {}); return result;
  });
  return open;
}
module.exports = { setupSpotify };
