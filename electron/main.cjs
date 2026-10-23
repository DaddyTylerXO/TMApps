'use strict';
const { app, BrowserWindow, ipcMain, dialog, clipboard, powerMonitor, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Vault, generate, read, readBytes } = require('./vault.cjs');
const { parseCSV } = require('./import.cjs');
const { startBridge } = require('./bridge.cjs');
const os = require('node:os');
const settings = require('./settings.cjs');
const { createTray } = require('./tray.cjs');
let preferences = { ...settings.defaults }, tray, quitting = false, settingsFile;
let win, selected, keyPath, bridge, pendingImport, clipTimer, idleTimer, lastActivity = Date.now();
const { SessionQueue } = require('./session.cjs');
const vault = new Vault(), operations = new SessionQueue();
const uiURL = pathToFileURL(path.join(__dirname, '../ui/index.html')).href;
// Hosted CI machines may have no usable GPU. This affects smoke runs only.
if (process.argv.includes('--smoke')) {
  app.disableHardwareAcceleration();
  // Test launches must never share the real profile or single-instance lock.
  const smokeProfile = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'tma-safe-smoke-profile-'));
  app.setPath('userData', smokeProfile);
}
function clearClipboard() { if (clipTimer) { clearTimeout(clipTimer.timer); if (clipboard.readText() === clipTimer.text) clipboard.clear(); clipTimer = null; } }
function lock() { operations.invalidate(); vault.lock(); keyPath = null; pendingImport = null; bridge?.close(); bridge = null; clearClipboard(); win?.webContents.send('locked'); }
function restore() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function syncTray() {
  if (process.argv.includes('--smoke')) return;
  if (!preferences.showTray) { restore(); tray?.destroy(); tray = null; return; }
  if (!tray) tray = createTray({ open: restore, settings: () => { restore(); win.webContents.send('settings'); }, lock, exit: () => { quitting = true; app.quit(); } });
}
async function startup(enabled) {
  if (!app.isPackaged) { if (enabled) throw Error('Startup is available in an installed build.'); return; }
  if (process.platform === 'linux') { const config = process.env.XDG_CONFIG_HOME && path.isAbsolute(process.env.XDG_CONFIG_HOME) ? process.env.XDG_CONFIG_HOME : path.join(os.homedir(), '.config'); await settings.linuxStartup(path.join(config, 'autostart', 'tma-safe.desktop'), process.env.APPIMAGE || process.execPath, enabled); }
  else app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
}
async function key() { if (!keyPath) return undefined; const bytes = await readBytes(keyPath, 32); if (bytes.length !== 32) { bytes.fill(0); throw Error('Expected a 32-byte TMA-Safe key file.'); } return bytes; }
async function withKey(fn) { const epoch = operations.epoch, bytes = await key(); try { operations.check(epoch); return await fn(bytes); } finally { bytes?.fill(0); } }
async function rememberVault(enabled) {
  if (typeof enabled !== 'boolean') throw Error('Invalid vault preference.');
  if (enabled && (!selected || !(await fs.stat(selected)).isFile())) throw Error('Choose an existing vault or create it first.');
  const vaultFile = enabled ? selected : '';
  if (vaultFile !== preferences.vaultFile) preferences = await settings.save(settingsFile, { ...preferences, vaultFile });
  return { remember: !!preferences.vaultFile };
}
async function finishUnlock(result, value) { try { await rememberVault(value.remember === true); return result; } catch { return { ...result, preferenceWarning: 'Vault unlocked, but the launch preference could not be saved. Try again after checking file permissions.' }; } }
async function pick(save, extension, title) {
  const epoch = operations.epoch;
  const options = { title, filters: [{ name: extension === 'tmasafe' ? 'Encrypted TMA-Safe vault' : 'TMA-Safe key file', extensions: [extension] }] };
  if (save) { const result = await dialog.showSaveDialog(win, { ...options, defaultPath: extension === 'tmasafe' ? 'My passwords.tmasafe' : 'My vault.tmakey' }); operations.check(epoch); return result.filePath; }
  const result = await dialog.showOpenDialog(win, { ...options, properties: ['openFile'] }); operations.check(epoch); return result.canceled ? null : result.filePaths[0];
}
const actions = {
  state: () => vault.key ? vault.list() : null,
  settings: async value => { if (value === undefined) return { ...preferences, startupSupported: app.isPackaged }; const next = settings.validate({ ...value, vaultFile: preferences.vaultFile }), previous = preferences; if (next.openAtLogin !== previous.openAtLogin) await startup(next.openAtLogin); try { preferences = await settings.save(settingsFile, next); syncTray(); } catch (e) { preferences = previous; await settings.save(settingsFile, previous).catch(() => {}); await startup(previous.openAtLogin).catch(() => {}); syncTray(); throw e; } return { ...preferences, startupSupported: app.isPackaged }; },
  vaultChoice: async () => { let available = false; if (selected) { try { available = (await fs.stat(selected)).isFile(); } catch {} } if (!available) selected = undefined; return { name: selected ? path.basename(selected) : null, remember: !!preferences.vaultFile, unavailable: !!preferences.vaultFile && !available }; },
  rememberVault,
  folder: value => vault.folder(value),
  removeFolder: async id => { vault.require(); const result = await dialog.showMessageBox(win, { type: 'question', title: 'Delete folder?', message: 'Delete this folder?', detail: 'Its logins will remain in All logins. No passwords will be deleted.', buttons: ['Cancel', 'Delete folder'], defaultId: 0, cancelId: 0 }); if (result.response !== 1) return vault.list(); return vault.removeFolder(id); },
  chooseVault: async save => { if (vault.key) throw Error('Lock the current vault first.'); const file = await pick(save === true, 'tmasafe', save ? 'Create vault' : 'Open vault'); if (file) selected = file; return selected ? path.basename(selected) : null; },
  chooseKey: async () => { keyPath = await pick(false, 'tmakey', 'Choose your separate key file'); return keyPath ? path.basename(keyPath) : null; },
  createKey: async () => { const epoch = operations.epoch, file = await pick(true, 'tmakey', 'Keep this key separate from your vault'); if (!file) return null; const bytes = crypto.randomBytes(32); try { await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 }); operations.check(epoch); keyPath = file; return path.basename(file); } finally { bytes.fill(0); } },
  create: async value => { if (!selected) throw Error('Choose a new vault file first.'); if (value.password !== value.confirm) throw Error('Master passwords do not match.'); if (value.useKey && !keyPath) throw Error('Choose or create a separate key file.'); if (!value.useKey) keyPath = null; return finishUnlock(await withKey(bytes => vault.create(selected, value.password, bytes)), value); },
  unlock: async value => { if (!selected) throw Error('Choose a vault file first.'); if (!value.useKey) keyPath = null; return finishUnlock(await withKey(bytes => vault.unlock(selected, value.password, bytes)), value); },
  lock: () => { lock(); keyPath = null; return null; },
  put: async value => { if (value.id && value.password === null) value.password = vault.secret(value.id).password; return vault.put(value); },
  remove: async id => { vault.require(); const result = await dialog.showMessageBox(win, { type: 'warning', title: 'Delete login?', message: 'Delete this login from the vault?', detail: 'An encrypted .bak file retains the previous save.', buttons: ['Cancel', 'Delete login'], defaultId: 0, cancelId: 0 }); if (result.response !== 1) return vault.list(); return vault.remove(id); },
  reveal: id => vault.secret(id).password,
  copy: value => { const e = vault.secret(value.id); if (!['username', 'password'].includes(value.field)) throw Error('Unsupported clipboard field.'); clearClipboard(); const text = e[value.field]; clipboard.writeText(text); clipTimer = { text, timer: setTimeout(clearClipboard, preferences.clipboardSeconds * 1000) }; return { seconds: preferences.clipboardSeconds }; },
  generate: value => generate(value),
  previewImport: async () => { vault.require(); const epoch = operations.epoch; pendingImport = null; const result = await dialog.showOpenDialog(win, { title: 'Import a browser password CSV', properties: ['openFile'], filters: [{ name: 'Browser password export', extensions: ['csv'] }] }); operations.check(epoch); if (result.canceled) return null; const bytes = await read(result.filePaths[0]); operations.check(epoch); const parsed = parseCSV(bytes); pendingImport = parsed.entries; return { count: parsed.entries.length, skipped: parsed.skipped }; },
  import: async () => { vault.require(); if (!pendingImport) throw Error('Preview a CSV first.'); const values = pendingImport; const state = await vault.import(values); pendingImport = null; return state; },
  backup: async () => { vault.require(); const file = await pick(true, 'tmasafe', 'Save an encrypted portable copy'); if (file) await vault.copy(file); return !!file; },
  extension: () => shell.openPath(path.join(app.getAppPath(), 'browser-extension')),
  bridge: async enabled => {
    vault.require(); if (!enabled) { bridge?.close(); bridge = null; return null; } if (bridge) return { token: bridge.token };
    const epoch = operations.epoch;
    const started = await startBridge({ unlocked: () => !!vault.key && epoch === operations.epoch, approve: async (site, extension, signal) => {
      vault.require(); const epoch = vault.epoch; const matches = vault.data.entries.filter(e => e.url === site); if (!matches.length || matches.length > 8) throw Error('No unique choice.');
      win.show(); win.focus(); const result = await dialog.showMessageBox(win, { type: 'question', title: 'Approve browser fill', message: `Fill a login for ${site}?`, detail: `Requested by ${extension}.\nOnly approve if you just clicked Fill in your browser.\n${matches.map((e, i) => `${i + 1}. ${e.title} — ${e.username}`).join('\n')}`, buttons: ['Cancel', ...matches.map((e, i) => `Fill login ${i + 1}`)], defaultId: 0, cancelId: 0, signal });
      if (signal.aborted || epoch !== vault.epoch || !result.response) throw Error('Declined.'); const e = vault.secret(matches[result.response - 1].id); return { username: e.username, password: e.password, origin: site };
    } });
    if (epoch !== operations.epoch) { started.close(); operations.check(epoch); }
    bridge = started; return { token: bridge.token };
  },
  activity: () => { lastActivity = Date.now(); return true; }
};
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', restore);
  app.whenReady().then(async () => {
    app.setName('TMA-Safe');
    settingsFile = path.join(app.getPath('userData'), 'settings.json');
    if (!process.argv.includes('--smoke')) preferences = await settings.load(settingsFile);
    selected = preferences.vaultFile || undefined;
    win = new BrowserWindow({ width: 1260, height: 850, minWidth: 900, minHeight: 680, backgroundColor: '#17191f', icon: path.join(__dirname, '../assets/icon.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    win.webContents.session.setPermissionCheckHandler(() => false);
    win.webContents.on('render-process-gone', lock);
    win.on('close', event => { lock(); if (!quitting && preferences.closeToTray && tray) { event.preventDefault(); win.hide(); } }); win.on('closed', () => { win = null; app.quit(); });
    try { syncTray(); } catch (e) { preferences.closeToTray = false; dialog.showErrorBox('Tray icon unavailable', e.message); }
    for (const [name, action] of Object.entries(actions)) ipcMain.handle('safe:' + name, (event, value) => {
      if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== uiURL) throw Error('Untrusted caller.');
      // Lock invalidates in-flight key derivation immediately; all other operations serialize.
      if (name === 'lock' || name === 'activity') return action(value);
      return operations.run(() => { lastActivity = Date.now(); return action(value); }).then(value => ({ ok: true, value }), e => ({ ok: false, error: e.message }));
    });
    powerMonitor.on('suspend', lock); powerMonitor.on('lock-screen', lock);
    idleTimer = setInterval(() => { if (vault.key && Date.now() - lastActivity >= preferences.idleMinutes * 60000) lock(); }, 1000);
    const smokeIndex = process.argv.indexOf('--smoke');
    if (smokeIndex >= 0) {
      const target = process.argv[smokeIndex + 1];
      win.webContents.once('did-finish-load', async () => {
        let folder;
        try {
          if (!target) throw Error('Smoke output directory required.'); await fs.mkdir(target, { recursive: true });
          await new Promise(resolve => setTimeout(resolve, 250)); await fs.writeFile(path.join(target, 'locked.png'), (await win.webContents.capturePage()).toPNG());
          await win.webContents.executeJavaScript(`document.getElementById('create-mode').click()`); await new Promise(resolve => setTimeout(resolve, 150)); await fs.writeFile(path.join(target, 'create.png'), (await win.webContents.capturePage()).toPNG());
          folder = await fs.mkdtemp(path.join(os.tmpdir(), 'tma-safe-smoke-'));
          await vault.create(path.join(folder, 'Demo.tmasafe'), 'fictional smoke passphrase only');
          await vault.folder({ name: 'Personal' }); await vault.folder({ name: 'Work' });
          for (const e of [{ title: 'Personal email', username: 'alex@example.com', url: 'https://mail.example.com', expiryDays: 90 }, { title: 'GitHub', username: 'alex-studio', url: 'https://github.com', expiryDays: 180 }, { title: 'Creative workspace', username: 'alex@example.com', url: 'https://workspace.example.com', expiryDays: 30 }]) await vault.put({ ...e, password: 'Fictional-demo-only!', notes: '', folderId: vault.data.folders[e.title === 'Personal email' ? 0 : 1].id });
          win.webContents.send('refresh');
          const deadline = Date.now() + 15000;
          while (!await win.webContents.executeJavaScript(`document.querySelectorAll('.login-card').length===3 && !document.getElementById('workspace').hidden`)) {
            if (Date.now() > deadline) throw Error('Timed out waiting for the demo vault to render.');
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          const result = await win.webContents.executeJavaScript(`({cards:document.querySelectorAll('.login-card').length, unlocked:!document.getElementById('workspace').hidden, nodeAvailable:typeof require!=='undefined', passwordVisible:document.body.textContent.includes('Fictional-demo-only!')})`);
          if (result.cards !== 3 || !result.unlocked || result.nodeAvailable || result.passwordVisible) throw Error('Renderer isolation or smoke fixture failed.');
          await fs.writeFile(path.join(target, 'vault.png'), (await win.webContents.capturePage()).toPNG());
          await win.webContents.executeJavaScript(`document.getElementById('settings-button').click()`);
          for (let i=0; i<100 && !await win.webContents.executeJavaScript(`document.getElementById('settings-dialog').open`); i++) await new Promise(resolve => setTimeout(resolve, 50));
          if (!await win.webContents.executeJavaScript(`document.getElementById('settings-dialog').open`)) throw Error('Settings did not open.');
          await fs.writeFile(path.join(target, 'settings.png'), (await win.webContents.capturePage()).toPNG());
          await win.webContents.executeJavaScript(`document.getElementById('settings-cancel').click(); document.getElementById('add-button').click()`);
          await new Promise(resolve => setTimeout(resolve, 150));
          await fs.writeFile(path.join(target, 'editor.png'), (await win.webContents.capturePage()).toPNG());
          await win.webContents.executeJavaScript(`document.getElementById('entry-cancel').click()`);
          const menu = createTray({}, { preview: true }); try { if (menu.popup.webContents.isLoading()) await new Promise(resolve => menu.popup.webContents.once('did-finish-load', resolve)); menu.popup.showInactive(); await fs.writeFile(path.join(target, 'tray.png'), (await menu.popup.webContents.capturePage()).toPNG()); } finally { menu.destroy(); }
          lock(); await new Promise(resolve => setTimeout(resolve, 100));
          if (!await win.webContents.executeJavaScript(`document.getElementById('workspace').hidden && document.querySelectorAll('.login-card').length===0`)) throw Error('Lock did not clear renderer.');
          await fs.writeFile(path.join(target, 'smoke.json'), JSON.stringify({ ok: true, platform: process.platform, arch: process.arch, ...result }, null, 2));
        } catch (e) { console.error(e.stack); process.exitCode = 1; if (target) await fs.writeFile(path.join(target, 'error.txt'), e.stack); }
        finally { lock(); if (folder) await fs.rm(folder, { recursive: true, force: true }); app.exit(process.exitCode || 0); }
      });
    }
    win.loadURL(uiURL);
  });
  app.on('before-quit', () => { quitting = true; clearInterval(idleTimer); lock(); tray?.destroy(); tray = null; });
  app.on('activate', restore);
}
