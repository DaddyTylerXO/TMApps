'use strict';
const { app, BrowserWindow, ipcMain, dialog, clipboard, powerMonitor, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Vault, generate, read } = require('./vault.cjs');
const { parseCSV } = require('./import.cjs');
const { startBridge } = require('./bridge.cjs');
const os = require('node:os');
let win, selected, keyPath, bridge, pendingImport, clipTimer, idleTimer, lastActivity = Date.now();
const vault = new Vault(); let queue = Promise.resolve();
const uiURL = pathToFileURL(path.join(__dirname, '../ui/index.html')).href;
function clearClipboard() { if (clipTimer) { clearTimeout(clipTimer.timer); if (clipboard.readText() === clipTimer.text) clipboard.clear(); clipTimer = null; } }
function lock() { vault.lock(); pendingImport = null; bridge?.close(); bridge = null; clearClipboard(); win?.webContents.send('locked'); }
async function key() { if (!keyPath) return undefined; const handle = await fs.open(keyPath, 'r'); try { if ((await handle.stat()).size !== 32) throw Error('Expected a 32-byte TMA-Safe key file.'); return await handle.readFile(); } finally { await handle.close(); } }
async function withKey(fn) { const bytes = await key(); try { return await fn(bytes); } finally { bytes?.fill(0); } }
async function pick(save, extension, title) {
  const options = { title, filters: [{ name: extension === 'tmasafe' ? 'Encrypted TMA-Safe vault' : 'TMA-Safe key file', extensions: [extension] }] };
  if (save) return (await dialog.showSaveDialog(win, { ...options, defaultPath: extension === 'tmasafe' ? 'My passwords.tmasafe' : 'My vault.tmakey' })).filePath;
  const result = await dialog.showOpenDialog(win, { ...options, properties: ['openFile'] }); return result.canceled ? null : result.filePaths[0];
}
const actions = {
  state: () => vault.key ? vault.list() : null,
  chooseVault: async save => { if (vault.key) throw Error('Lock the current vault first.'); const file = await pick(save === true, 'tmasafe', save ? 'Create vault' : 'Open vault'); if (file) selected = file; return selected ? path.basename(selected) : null; },
  chooseKey: async () => { keyPath = await pick(false, 'tmakey', 'Choose your separate key file'); return keyPath ? path.basename(keyPath) : null; },
  createKey: async () => { const file = await pick(true, 'tmakey', 'Keep this key separate from your vault'); if (!file) return null; const bytes = crypto.randomBytes(32); try { await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 }); keyPath = file; return path.basename(file); } finally { bytes.fill(0); } },
  create: async value => { if (!selected) throw Error('Choose a new vault file first.'); if (value.password !== value.confirm) throw Error('Master passwords do not match.'); if (value.useKey && !keyPath) throw Error('Choose or create a separate key file.'); if (!value.useKey) keyPath = null; return withKey(bytes => vault.create(selected, value.password, bytes)); },
  unlock: async value => { if (!selected) throw Error('Choose a vault file first.'); if (!value.useKey) keyPath = null; return withKey(bytes => vault.unlock(selected, value.password, bytes)); },
  lock: () => { lock(); keyPath = null; return null; },
  put: async value => { if (value.id && value.password === null) value.password = vault.secret(value.id).password; return vault.put(value); },
  remove: async id => { vault.require(); const result = await dialog.showMessageBox(win, { type: 'warning', title: 'Delete login?', message: 'Delete this login from the vault?', detail: 'An encrypted .bak file retains the previous save.', buttons: ['Cancel', 'Delete login'], defaultId: 0, cancelId: 0 }); if (result.response !== 1) return vault.list(); return vault.remove(id); },
  reveal: id => vault.secret(id).password,
  copy: value => { const e = vault.secret(value.id); if (!['username', 'password'].includes(value.field)) throw Error('Unsupported clipboard field.'); clearClipboard(); const text = e[value.field]; clipboard.writeText(text); clipTimer = { text, timer: setTimeout(clearClipboard, 20000) }; return true; },
  generate: value => generate(value),
  previewImport: async () => { vault.require(); pendingImport = null; const result = await dialog.showOpenDialog(win, { title: 'Import a browser password CSV', properties: ['openFile'], filters: [{ name: 'Browser password export', extensions: ['csv'] }] }); if (result.canceled) return null; const bytes = await read(result.filePaths[0]); const parsed = parseCSV(bytes); pendingImport = parsed.entries; return { count: parsed.entries.length, skipped: parsed.skipped }; },
  import: async () => { vault.require(); if (!pendingImport) throw Error('Preview a CSV first.'); const values = pendingImport; const state = await vault.import(values); pendingImport = null; return state; },
  backup: async () => { vault.require(); const file = await pick(true, 'tmasafe', 'Save an encrypted portable copy'); if (file) await vault.copy(file); return !!file; },
  extension: () => shell.openPath(path.join(app.getAppPath(), 'browser-extension')),
  bridge: async enabled => {
    vault.require(); if (!enabled) { bridge?.close(); bridge = null; return null; } if (bridge) return { token: bridge.token };
    bridge = await startBridge({ unlocked: () => !!vault.key, approve: async (site, extension, signal) => {
      vault.require(); const epoch = vault.epoch; const matches = vault.data.entries.filter(e => e.url === site); if (!matches.length || matches.length > 8) throw Error('No unique choice.');
      win.show(); win.focus(); const result = await dialog.showMessageBox(win, { type: 'question', title: 'Approve browser fill', message: `Fill a login for ${site}?`, detail: `Requested by ${extension}.\nOnly approve if you just clicked Fill in your browser.\n${matches.map((e, i) => `${i + 1}. ${e.title} — ${e.username}`).join('\n')}`, buttons: ['Cancel', ...matches.map((e, i) => `Fill login ${i + 1}`)], defaultId: 0, cancelId: 0, signal });
      if (signal.aborted || epoch !== vault.epoch || !result.response) throw Error('Declined.'); const e = vault.secret(matches[result.response - 1].id); return { username: e.username, password: e.password, origin: site };
    } }); return { token: bridge.token };
  },
  activity: () => { lastActivity = Date.now(); return true; }
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { win?.show(); win?.focus(); });
  app.whenReady().then(() => {
    app.setName('TMA-Safe');
    win = new BrowserWindow({ width: 1260, height: 850, minWidth: 900, minHeight: 680, backgroundColor: '#17191f', icon: path.join(__dirname, '../assets/icon.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    win.webContents.on('render-process-gone', lock);
    win.on('close', lock); win.on('closed', () => { win = null; app.quit(); });
    for (const [name, action] of Object.entries(actions)) ipcMain.handle('safe:' + name, (event, value) => {
      if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== uiURL) throw Error('Untrusted caller.');
      // Lock invalidates in-flight key derivation immediately; all other operations serialize.
      if (name === 'lock' || name === 'activity') return action(value);
      const run = queue.then(async () => { lastActivity = Date.now(); try { return { ok: true, value: await action(value) }; } catch (e) { return { ok: false, error: e.message }; } }); queue = run.catch(() => {}); return run;
    });
    powerMonitor.on('suspend', lock); powerMonitor.on('lock-screen', lock);
    idleTimer = setInterval(() => { if (vault.key && Date.now() - lastActivity >= 5 * 60000) lock(); }, 1000);
    const smokeIndex = process.argv.indexOf('--smoke');
    if (smokeIndex >= 0) {
      const target = process.argv[smokeIndex + 1];
      win.webContents.once('did-finish-load', async () => {
        let folder;
        try {
          if (!target) throw Error('Smoke output directory required.'); await fs.mkdir(target, { recursive: true });
          await new Promise(resolve => setTimeout(resolve, 250)); await fs.writeFile(path.join(target, 'locked.png'), (await win.webContents.capturePage()).toPNG());
          folder = await fs.mkdtemp(path.join(os.tmpdir(), 'tma-safe-smoke-'));
          await vault.create(path.join(folder, 'Demo.tmasafe'), 'fictional smoke passphrase only');
          for (const e of [{ title: 'Personal email', username: 'alex@example.com', url: 'https://mail.example.com', expiryDays: 90 }, { title: 'GitHub', username: 'alex-studio', url: 'https://github.com', expiryDays: 180 }, { title: 'Creative workspace', username: 'alex@example.com', url: 'https://workspace.example.com', expiryDays: 30 }]) await vault.put({ ...e, password: 'Fictional-demo-only!', notes: '' });
          win.webContents.send('refresh'); await new Promise(resolve => setTimeout(resolve, 350));
          const result = await win.webContents.executeJavaScript(`({cards:document.querySelectorAll('.login-card').length, unlocked:!document.getElementById('workspace').hidden, nodeAvailable:typeof require!=='undefined', passwordVisible:document.body.textContent.includes('Fictional-demo-only!')})`);
          if (result.cards !== 3 || !result.unlocked || result.nodeAvailable || result.passwordVisible) throw Error('Renderer isolation or smoke fixture failed.');
          await fs.writeFile(path.join(target, 'vault.png'), (await win.webContents.capturePage()).toPNG()); lock(); await new Promise(resolve => setTimeout(resolve, 100));
          if (!await win.webContents.executeJavaScript(`document.getElementById('workspace').hidden && document.querySelectorAll('.login-card').length===0`)) throw Error('Lock did not clear renderer.');
          await fs.writeFile(path.join(target, 'smoke.json'), JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, ...result }, null, 2));
        } catch (e) { console.error(e.stack); process.exitCode = 1; if (target) await fs.writeFile(path.join(target, 'error.txt'), e.stack); }
        finally { lock(); if (folder) await fs.rm(folder, { recursive: true, force: true }); app.exit(process.exitCode || 0); }
      });
    }
    win.loadURL(uiURL);
  });
  app.on('before-quit', () => { clearInterval(idleTimer); lock(); });
}
