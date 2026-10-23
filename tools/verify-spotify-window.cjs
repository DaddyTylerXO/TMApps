'use strict';
// Run with Electron against an isolated temporary profile; never signs in.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const [modulePath, output, name, brand] = process.argv.slice(2);
const started = Date.now();
app.setPath('userData', path.join(path.resolve(output), 'isolated-profile-' + process.pid));
app.whenReady().then(async () => {
  try {
    await fs.mkdir(output, { recursive: true });
    const open = require(path.resolve(modulePath)).setupSpotify({ name, brand, preview: true });
    await open(); let win = BrowserWindow.getAllWindows()[0];
    await new Promise(r => setTimeout(r, 150));
    const initial = await win.webContents.executeJavaScript(`({title:document.getElementById('app').textContent,node:typeof require!=='undefined'||typeof process!=='undefined',mode:document.getElementById('mode').value,connected:document.getElementById('connect').disabled})`);
    if (initial.node || initial.title !== name || initial.mode !== 'Connect' || initial.connected) throw new Error('Spotify window initialization failed: '+JSON.stringify(initial));
    const startupMs = Date.now() - started;
    await win.webContents.executeJavaScript(`const select=document.getElementById('mode');select.value='Browser';select.dispatchEvent(new Event('change'));`);
    await new Promise(r => setTimeout(r, 100));
    const snapshot = await win.webContents.executeJavaScript(`({mode:document.getElementById('mode').value,note:document.getElementById('mode-note').textContent,private:!document.body.textContent.includes('fixture-access')})`);
    if (snapshot.mode !== 'Browser' || !snapshot.note.includes('browser') || !snapshot.private) throw new Error('Playback mode did not change.');
    await fs.writeFile(path.join(output, 'spotify-preview.png'), (await win.webContents.capturePage()).toPNG());
    const before = app.getAppMetrics(); await new Promise(r => setTimeout(r, 2000)); const metrics = app.getAppMetrics();
    const memoryMb = metrics.reduce((sum, p) => sum + p.memory.workingSetSize, 0) / 1024;
    const idleCpuPercent = metrics.reduce((sum, p) => sum + p.cpu.percentCPUUsage, 0);
    if (startupMs > 30000 || memoryMb > 800 || idleCpuPercent > 30) throw new Error('Spotify window exceeded resource budget.');
    win.close(); await open(); win = BrowserWindow.getAllWindows()[0]; await new Promise(r => setTimeout(r, 100));
    if (await win.webContents.executeJavaScript(`document.getElementById('mode').value`) !== 'Browser') throw new Error('Playback mode was not retained.');
    await fs.writeFile(path.join(output, 'spotify-performance.json'), JSON.stringify({ passed: true, startupMs, workingSetMb: memoryMb, idleCpuPercent, modePersists: true, tokenExposedToRenderer: false, liveAccountTested: false }, null, 2));
    win.close(); app.exit(0);
  } catch (error) { await fs.writeFile(path.join(output, 'error.txt'), error.stack); app.exit(1); }
});
