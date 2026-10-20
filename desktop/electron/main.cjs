'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const { Library, RELEASE, directories, launcherRelease, download, inside } = require('./service.cjs');
const metadata = require('../package.json');
let window, library, tray, quitting = false, controller, settings, update, updating = false;
const prompts = new Map();
const smokeIndex = process.argv.indexOf('--smoke');
const smokeReport = smokeIndex >= 0 ? path.resolve(process.argv[smokeIndex + 1]) : null;
const page = pathToFileURL(path.join(__dirname, '../ui/index.html')).href;
if (smokeReport) app.disableHardwareAcceleration();
if (smokeReport) app.setPath('userData', path.join(path.dirname(smokeReport), 'smoke-profile-' + process.pid));
function confirm(details) {
  const id = crypto.randomUUID();
  return new Promise(resolve => { prompts.set(id, resolve); window.webContents.send('prompt', { ...details, id }); });
}
function restore() { window.show(); if (window.isMinimized()) window.restore(); window.focus(); }
function quote(value) { if (/[\r\n\x00]/.test(value)) throw new Error('Invalid executable path.'); return '"' + value.replace(/(["\\`$])/g, '\\$1') + '"'; }
async function managedDesktop(file, content, marker = 'X-TMApps-Managed=true') {
  if (content) { const old = await fs.readFile(file, 'utf8').catch(() => ''); if (old && !old.includes(marker)) throw new Error('A desktop entry with this name already exists.'); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content, { mode: 0o755 }); }
  else { const old = await fs.readFile(file, 'utf8').catch(() => ''); if (old.includes(marker)) await fs.rm(file, { force: true }); }
}
async function integrate(kind, value) {
  const home = app.getPath('home');
  if (kind === 'launcher') {
    if (process.platform === 'darwin') app.setLoginItemSettings({ openAtLogin: value.runAtStartup });
    else if (process.platform === 'linux') {
      const target = process.env.APPIMAGE || process.execPath;
      const file = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart', 'tmapps-launcher.desktop');
      await managedDesktop(file, value.runAtStartup ? `[Desktop Entry]\nType=Application\nName=TMApps Launcher\nExec=${quote(target)}\nX-TMApps-Managed=true\n` : null);
    }
    return;
  }
  const { item, state } = value;
  const executable = path.join(state.root, state.folder, state.executable), enabled = kind !== 'remove';
  if (process.platform === 'linux') {
    const entry = `[Desktop Entry]\nType=Application\nName=${item.name.replace(/[\r\n]/g, '')}\nExec=${quote(executable)}\nTerminal=false\nX-TMApps-Managed=true\n`;
    await managedDesktop(path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'autostart', `tmapps-${item.id}.desktop`), enabled && state.runAtStartup ? entry : null);
    await managedDesktop(path.join(app.getPath('desktop'), `${item.name}.desktop`), enabled && state.desktopShortcut ? entry : null);
  } else if (process.platform === 'darwin') {
    const bundle = executable.slice(0, executable.indexOf('.app/') + 4);
    if (!bundle.endsWith('.app') || !inside(path.join(state.root, state.folder), bundle)) throw new Error('Expected a native .app bundle.');
    const shortcut = path.join(app.getPath('desktop'), item.name + '.app');
    const old = await fs.lstat(shortcut).catch(() => null);
    if (old) { if (!old.isSymbolicLink() || !(await fs.readlink(shortcut)).startsWith(state.root + path.sep)) throw new Error('A desktop item with this name already exists.'); await fs.unlink(shortcut); }
    if (enabled && state.desktopShortcut) await fs.symlink(bundle, shortcut);
    const escape = v => v.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const agent = path.join(home, 'Library', 'LaunchAgents', `com.tmapps.${item.id}.plist`);
    const oldAgent = await fs.readFile(agent, 'utf8').catch(() => '');
    if (oldAgent && !oldAgent.includes('TMApps-Managed')) throw new Error('An existing startup entry needs manual review.');
    if (enabled && state.runAtStartup) { await fs.mkdir(path.dirname(agent), { recursive: true }); await fs.writeFile(agent, `<?xml version="1.0"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><!-- TMApps-Managed --><key>Label</key><string>com.tmapps.${item.id}</string><key>ProgramArguments</key><array><string>${escape(executable)}</string></array><key>RunAtLoad</key><true/></dict></plist>`, { mode: 0o600 }); }
    else if (oldAgent) await fs.rm(agent);
  }
}
async function checkLauncher() {
  const manifest = await library.json(RELEASE + 'launcher-platforms.json');
  return launcherRelease(manifest,process.platform,process.arch,metadata.version);
}
async function applyLauncherUpdate() {
  if (!update || library.busy || updating) throw new Error('Check for updates before updating the launcher.');
  updating = true; controller = new AbortController();
  try {
    const destination = path.join(library.root, 'updates', crypto.randomUUID(), update.filename);
    await download(update.url, destination, update.sha256, { signal: controller.signal, progress: text => window.webContents.send('progress', text), limit: 512 * 1024 ** 2 });
    if (process.platform === 'darwin') {
      const error = await shell.openPath(destination); if (error) throw new Error(error);
      return { notice: 'Verified update opened. Quit this launcher, then drag the new app into Applications to replace it. Your library and profile are kept.' };
    }
    if (!process.env.APPIMAGE || !path.isAbsolute(process.env.APPIMAGE) || !process.env.APPDIR || !inside(process.env.APPDIR,process.execPath)) throw new Error('The verified AppImage is downloaded. Run the launcher from an AppImage to enable automatic replacement.');
    const target = process.env.APPIMAGE;
    if ((await fs.lstat(target)).isSymbolicLink()) throw new Error('The launcher AppImage is a link. Replace it manually with the verified download.');
    await fs.access(path.dirname(target), require('node:fs').constants.W_OK);
    const replacement = target + '.tmapps-new-' + crypto.randomUUID();
    await fs.copyFile(target,target+'.tmapps-previous-'+metadata.version);
    await fs.copyFile(destination, replacement); await fs.chmod(replacement, 0o755); await fs.rename(replacement, target);
    app.relaunch({ execPath: target, args: [] }); quitting = true; app.quit(); return {};
  } finally { updating = false; controller = null; }
}
async function run() {
  const dirs = smokeReport ? { root: app.getPath('userData'), shared: path.join(app.getPath('userData'), 'suite-profile.json'), data: app.getPath('userData') } : directories();
  library = new Library({ ...dirs, bundled: require('../catalog.json'), confirm, progress: text => window.webContents.send('progress', text), integration: integrate });
  await library.load(); settings = (await library.snapshot()).settings;
  window = new BrowserWindow({ width: 1180, height: 800, minWidth: 960, minHeight: 600, title: 'TMApps Launcher', backgroundColor: '#17191f', autoHideMenuBar: true, show: !smokeReport, icon: path.join(__dirname, '../assets/icon.png'), webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, offscreen: !!smokeReport } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  const methods = {
    snapshot: () => library.snapshot(),
    refresh: async () => { if (library.busy || updating) throw new Error('Wait for the current operation.'); const messages = []; try { await library.refresh(); messages.push('Application catalog checked.'); } catch { messages.push('Could not refresh applications; showing the saved catalog.'); } try { update = await checkLauncher(); messages.push(update ? `Launcher ${update.version} is available.` : 'Launcher is up to date.'); } catch { messages.push('Launcher update check could not complete.'); } return { ...await library.snapshot(), update, notice: messages.join(' ') }; },
    profile: async value => library.saveProfile(value),
    settings: async value => { if (library.busy || updating) throw new Error('Wait for the current operation.'); const result = await library.saveSettings(value); settings = result.settings; return result; },
    choose: async () => { const result = await dialog.showOpenDialog(window, { title: 'Choose an empty application folder', properties: ['openDirectory', 'createDirectory'] }); return result.canceled ? null : result.filePaths[0]; },
    install: async ({ id, options }) => { if(library.busy || updating) throw new Error('Wait for the current operation.'); if (smokeReport) throw new Error('Installation disabled during smoke checks.'); controller = new AbortController(); library.signal = controller.signal; try { return await library.install(id, options); } finally { controller = null; library.signal = null; } },
    open: ({ id }) => library.open(id),
    uninstall: ({ id, deleteData }) => library.uninstall(id, deleteData === true),
    data: ({ id }) => library.dataLocations(id),
    source: ({ id } = {}) => shell.openExternal('https://github.com/DaddyTylerXO/TMApps/tree/' + (id === 'tma-mail' ? 'TMA-Mail' : id === 'tma-agent-office' ? 'TMA-AgentOffice' : id === 'tma-padlock' ? 'TMA-Padlock' : id === 'tma-safe' ? 'TMA-Safe' : 'TMApps-Launcher')),
    cancel: () => controller?.abort(),
    answer: ({ id, value }) => { const resolve = prompts.get(id); if (resolve) { prompts.delete(id); resolve(value === true); } },
    update: applyLauncherUpdate
  };
  ipcMain.handle('launcher', async (event, method, value) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== page || !Object.hasOwn(methods, method)) throw new Error('Unknown launcher caller.');
    try { let data=await methods[method](value); if(data?.apps) data={...data,version:metadata.version,smoke:!!smokeReport}; return { ok: true, data }; } catch (e) { return { ok: false, error: e.name === 'AbortError' ? 'Operation cancelled.' : e.message }; }
  });
  window.on('close', event => {
    if (quitting || smokeReport) return;
    if (library.busy || updating) { event.preventDefault(); window.webContents.send('notice', 'Wait for the current operation or cancel its download before quitting.'); return; }
    if (tray && settings.closeToTray) { event.preventDefault(); window.hide(); }
  });
  window.on('closed',()=>{ if(!quitting) {quitting=true;app.quit();} });
  await window.loadURL(page);
  if (smokeReport) {
    try {
      const result = await window.webContents.executeJavaScript('window.launcherSmoke()');
      if (!result.ok || result.nodeAvailable || result.cards !== 3 || result.platform !== process.platform || result.arch !== process.arch) throw new Error(JSON.stringify(result));
      await fs.mkdir(path.dirname(smokeReport), { recursive: true }); await fs.writeFile(smokeReport, JSON.stringify({ ...result, version: metadata.version }));
      await new Promise(resolve=>setTimeout(resolve,350));
      await fs.writeFile(smokeReport + '.png', (await window.webContents.capturePage()).toPNG());
      quitting = true; app.quit();
    } catch (e) { await fs.writeFile(smokeReport, JSON.stringify({ ok: false, error: e.message })); app.exit(1); }
    return;
  }
  try {
    const image = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png')).resize({ width: 22, height: 22 });
    tray = new Tray(image); tray.setToolTip('TMApps Launcher'); tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open launcher', click: restore }, { label: 'Check for updates', click: () => { restore(); window.webContents.send('refresh'); } }, { type: 'separator' }, { label: 'Quit', click: () => { if (library.busy || updating) { restore(); window.webContents.send('notice', 'Finish the current operation first.'); return; } quitting = true; app.quit(); } }])); tray.on('double-click', restore);
  } catch { tray = null; } // A Linux desktop without a tray must still be able to quit the app normally.
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'TMApps Launcher', submenu: [{ role: 'about' }, { role: 'hide' }, { role: 'unhide' }, { label: 'Quit', accelerator: 'Command+Q', click: () => { if (!library.busy && !updating) { quitting = true; app.quit(); } } }] }, { role: 'editMenu' }, { role: 'windowMenu' }]));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) restore(); });
  app.whenReady().then(run).catch(async error => { if (smokeReport) { await fs.writeFile(smokeReport, JSON.stringify({ ok: false, error: error.stack })); app.exit(1); } else { dialog.showErrorBox('TMApps Launcher', error.message); app.quit(); } });
  app.on('activate', () => { if (window) restore(); });
}
app.on('before-quit', event => { if ((library?.busy || updating) && !quitting) { event.preventDefault(); if (window) restore(); } else quitting = true; });
app.on('will-quit', () => { for (const resolve of prompts.values()) resolve(false); tray?.destroy(); });
app.on('window-all-closed', () => { if (!tray) app.quit(); });
