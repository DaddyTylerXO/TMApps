'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const tar = require('tar');
const exec = promisify(execFile);
const RELEASE = 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/';
const IDS = ['tma-mail', 'tma-agent-office'];
const LABELS = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
const osKey = platform => ({ win32: 'windows', darwin: 'macos', linux: 'linux' }[platform]);
function inside(root, candidate) { const rel = path.relative(root, candidate); return rel !== '' && !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel); }
function trusted(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.hash && (u.origin === 'https://github.com' && u.pathname.startsWith('/DaddyTylerXO/TMApps/releases/download/tma-apps/') || u.origin === 'https://raw.githubusercontent.com' && /^\/DaddyTylerXO\/TMApps\/[a-f\d]{40}\//i.test(u.pathname)); } catch { return false; }
}
function version(value) { if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(value || '')) throw new Error('Invalid version.'); return value.split('-'); }
function newer(a, b) {
  const av = version(a), bv = version(b), aa = av[0].split('.').map(Number), bb = bv[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i];
  return av.length !== bv.length ? av.length === 1 : (av[1] || '') > (bv[1] || '');
}
function relative(value) { return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes(':') && !value.startsWith('/') && value.split('/').every(p => p && p !== '.' && p !== '..'); }
function parseCatalog(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.apps) || data.apps.length !== 2 || new Set(data.apps.map(a => a.id)).size !== 2) throw new Error('Unsupported application catalog.');
  for (const item of data.apps) {
    if (!IDS.includes(item.id) || typeof item.name !== 'string' || !item.name || typeof item.description !== 'string') throw new Error('Unknown application.');
    version(item.version);
    if (item.downloadUrl && (!trusted(item.downloadUrl) || !/^[a-f\d]{64}$/i.test(item.sha256 || ''))) throw new Error('Invalid Windows package.');
    if (item.platforms && (!Array.isArray(item.platforms) || item.platforms.some(p => !LABELS[p]))) throw new Error('Invalid OS support metadata.');
    // Native support is advertised only when a real package exists for that platform.
    for (const [key, pkg] of Object.entries(item.packages || {})) {
      if (!/^(macos|linux)-(x64|arm64)$/.test(key) || !trusted(pkg.url) || !/^[a-f\d]{64}$/i.test(pkg.sha256 || '') || !['tar.gz', 'appimage'].includes(pkg.format) || !relative(pkg.executable)) throw new Error('Invalid native app package.');
      if (pkg.format === 'appimage' && !key.startsWith('linux-')) throw new Error('AppImage requires Linux.');
    }
  }
  return data;
}
function support(item) { return [...new Set([...(item.downloadUrl ? ['windows'] : []), ...Object.keys(item.packages || {}).map(k => k.split('-')[0])])]; }
function launcherRelease(manifest, platform, arch, current) {
  if(manifest?.schemaVersion!==1 || !Array.isArray(manifest.releases)) throw new Error('Invalid launcher update manifest.');
  version(manifest.version);
  const selected=manifest.releases.find(item=>item.platform===platform && item.arch===arch);
  if(!selected) return null;
  if(!['darwin','linux'].includes(platform) || !['x64','arm64'].includes(arch)) throw new Error('Unsupported launcher platform.');
  const extension=platform==='darwin' ? 'dmg' : 'AppImage';
  const expected=`TMApps-Launcher-${manifest.version}-${platform==='darwin' ? 'mac' : 'linux'}-${arch}.${extension}`;
  if(selected.filename!==expected || selected.url!==RELEASE+expected || !/^[a-f\d]{64}$/i.test(selected.sha256 || '')) throw new Error('Invalid launcher installer metadata.');
  return newer(manifest.version,current) ? {...selected,version:manifest.version} : null;
}
function profile(value) {
  if (!value || value.schemaVersion !== 1 || typeof value.displayName !== 'string' || !Array.isArray(value.emails)) throw new Error('Invalid profile.');
  const name = value.displayName.trim();
  if (name.length > 100 || /[\x00-\x1f\x7f]/.test(name) || value.emails.length > 20) throw new Error('Use a name of up to 100 characters and up to 20 email addresses.');
  const emails = [];
  for (const raw of value.emails) { const email = String(raw).trim(); if (!email) continue; if (email.length > 254 || !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email)) throw new Error('Enter one valid email address per line.'); if (!emails.some(e => e.toLowerCase() === email.toLowerCase())) emails.push(email); }
  return { schemaVersion: 1, revision: typeof value.revision === 'string' ? value.revision.slice(0, 80) : null, displayName: name, emails, shareWithMail: value.shareWithMail === true };
}
async function readJSON(file, fallback = null) { try { const info = await fs.stat(file); if (info.size > 1024 * 1024) throw new Error('Metadata too large.'); return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); } catch { return fallback; } }
async function atomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true }); const temp = file + '.' + crypto.randomUUID() + '.tmp';
  try { await fs.writeFile(temp, JSON.stringify(data, null, 2), { mode: 0o600 }); await fs.rename(temp, file); } finally { await fs.rm(temp, { force: true }); }
}
async function download(url, destination, hash, { signal, fetcher = fetch, progress = () => {}, limit = 2 * 1024 ** 3 } = {}) {
  if (!trusted(url)) throw new Error('Untrusted download location.');
  const response = await fetcher(url, { signal }); if (!response.ok || !response.body) throw new Error('Download failed. Please retry.');
  await fs.mkdir(path.dirname(destination), { recursive: true }); const digest = crypto.createHash('sha256'); let total = 0, last = 0;
  const file = await fs.open(destination, 'wx', 0o600);
  try {
    for await (const chunk of response.body) { signal?.throwIfAborted(); total += chunk.length; if (total > limit) throw new Error('Package too large.'); digest.update(chunk); await file.writeFile(chunk); if (Date.now() - last > 200) { progress(`Downloading · ${Math.ceil(total / 1048576)} MB`); last = Date.now(); } }
    if (digest.digest('hex').toLowerCase() !== hash.toLowerCase()) throw new Error('Download verification failed. Your current version is unchanged.');
  } catch (error) { await file.close(); await fs.rm(destination, { force: true }); throw error; }
  await file.close();
}
async function extract(archive, destination) {
  await fs.mkdir(destination, { recursive: true }); let total = 0, count = 0, problem;
  // Validate the entire archive before extraction. Exceptions inside a tar stream
  // callback escape its promise, so collect validation failures and reject after listing.
  await tar.t({ file: archive, strict: true, preservePaths: true, onReadEntry(entry) {
    const name=entry.path, clean=name.replace(/\/$/, ''), target=path.resolve(destination,name);
    if(++count>30000 || !relative(clean) || !inside(destination,target) || (total+=entry.size || 0)>4*1024**3) problem='Unsafe application archive.';
    if(!['File','Directory','SymbolicLink','Link'].includes(entry.type)) problem='Unsupported archive entry.';
    if(entry.linkpath) {
      const link=path.resolve(entry.type==='Link' ? destination : path.dirname(target),entry.linkpath);
      if(path.isAbsolute(entry.linkpath) || !inside(destination,link)) problem='Unsafe archive link.';
    }
    entry.resume();
  } });
  if(problem) throw new Error(problem);
  await tar.x({ file: archive, cwd: destination, strict: true, preservePaths: false });
}
function directories(platform = process.platform, home = os.homedir(), env = process.env) {
  const base = platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : platform === 'win32' ? (env.LOCALAPPDATA || path.join(home, 'AppData', 'Local')) : (env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, '.config'));
  return { root: path.join(base, 'TMApps', 'Launcher'), shared: path.join(base, 'TMApps', 'profile.json'), data: base };
}
class Library {
  constructor({ root, shared, data, bundled, platform = process.platform, arch = process.arch, fetcher = fetch, confirm = async () => false, progress = () => {}, integration = async () => {} }) {
    Object.assign(this, { root, shared, data, platform, arch, fetcher, confirm, progress, integration }); this.bundled = parseCatalog(bundled); this.catalog = this.bundled; this.busy = false;
  }
  async load() { try { this.catalog=parseCatalog(await readJSON(path.join(this.root,'catalog.json'),this.bundled)); } catch { this.catalog=this.bundled; } return this.catalog; }
  item(id) { const app = this.catalog.apps.find(a => a.id === id); if (!app) throw new Error('Unknown application.'); return app; }
  pkg(item) { return item.packages?.[`${osKey(this.platform)}-${this.arch}`] || null; }
  stateFile(id) { if (!IDS.includes(id)) throw new Error('Unknown application.'); return path.join(this.root, 'apps', id, 'installed.json'); }
  async installed(item) {
    const state = await readJSON(this.stateFile(item.id));
    if (!state || state.platform !== this.platform || !/^[a-f\d-]{36}$/.test(state.folder || '') || !path.isAbsolute(state.root || '') || !relative(state.executable)) return null;
    const marker = await readJSON(path.join(state.root, '.tmapps-owner.json')); if (marker?.app !== item.id) return null;
    try { version(state.version); const executable = path.join(state.root, state.folder, state.executable); if (!inside(state.root, executable) || !(await fs.stat(executable)).isFile()) return null; return state; } catch { return null; }
  }
  async snapshot() {
    const apps = await Promise.all(this.catalog.apps.map(async a => ({ ...a, support: support(a), package: this.pkg(a), installed: await this.installed(a) })));
    let savedProfile; try { savedProfile = profile(await readJSON(this.shared, { schemaVersion: 1, displayName: '', emails: [], shareWithMail: false })); } catch { savedProfile = { schemaVersion: 1, displayName: '', emails: [], shareWithMail: false, warning: 'Saved profile could not be read. Saving will replace it.' }; }
    return { apps, profile: savedProfile, settings: await readJSON(path.join(this.root, 'settings.json'), { navigationEdge: 'Left', libraryView: 'List', closeToTray: this.platform !== 'linux', checkOnStartup: true, runAtStartup: false }), platform: this.platform, arch: this.arch, os: osKey(this.platform), busy: this.busy };
  }
  async json(url) { const response = await this.fetcher(url + '?check=' + Date.now(), { signal: AbortSignal.timeout(35000) }); if (!response.ok) throw new Error('Could not reach the release service.'); const text = await response.text(); if (text.length > 1024 ** 2) throw new Error('Metadata too large.'); return JSON.parse(text.replace(/^\uFEFF/, '')); }
  async refresh() {
    const catalog = parseCatalog(await this.json(RELEASE + 'catalog.json'));
    // Keep the most recent known release if an older cached catalog is returned.
    catalog.apps = catalog.apps.map(item => { const known = this.catalog.apps.find(a => a.id === item.id); return known && newer(known.version, item.version) ? known : item; });
    this.catalog = catalog; await atomic(path.join(this.root, 'catalog.json'), catalog); return this.snapshot();
  }
  async saveProfile(value) { const saved = profile(value); saved.revision = crypto.randomUUID().replaceAll('-', ''); await atomic(this.shared, saved); return this.snapshot(); }
  async saveSettings(value) {
    if (!['Left', 'Right', 'Top', 'Bottom'].includes(value.navigationEdge) || !['List', 'Grid'].includes(value.libraryView)) throw new Error('Invalid appearance settings.');
    const saved = { navigationEdge: value.navigationEdge, libraryView: value.libraryView, closeToTray: value.closeToTray === true, checkOnStartup: value.checkOnStartup === true, runAtStartup: value.runAtStartup === true };
    await this.integration('launcher', saved); await atomic(path.join(this.root, 'settings.json'), saved); return this.snapshot();
  }
  async processes() {
    if(this.platform === 'linux') {
      const entries=await fs.readdir('/proc');
      const found=await Promise.all(entries.filter(p=>/^\d+$/.test(p)).map(async pid=> {
        try { const executable=(await fs.readlink(`/proc/${pid}/exe`)).replace(/ \(deleted\)$/, ''); const stat=await fs.readFile(`/proc/${pid}/stat`,'utf8'); const start=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]; return {pid:+pid,executable,start}; } catch { return null; }
      }));
      return found.filter(Boolean);
    }
    const {stdout}=await exec('/bin/ps',['-axo','pid=,lstart=,comm='],{maxBuffer:4*1024**2,env:{...process.env,LC_ALL:'C',LANG:'C'}});
    return stdout.split('\n').flatMap(line=>{ const match=line.trim().match(/^(\d+)\s+([A-Za-z]{3}\s+[A-Za-z]{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.+)$/); return match ? [{pid:+match[1],start:match[2],executable:match[3]}] : []; });
  }
  async running(state) {
    if(!state) return [];
    return (await this.processes()).filter(p=>inside(path.join(state.root,state.folder),p.executable));
  }
  async closeApp(item, state) {
    let processes = await this.running(state); if (!processes.length) return;
    if (!await this.confirm({ title: `Close ${item.name}?`, message: 'This app is running, possibly in the tray. Save your work. Allow the launcher to close it before continuing?', action: 'Close app' })) throw new Error('Operation cancelled.');
    const signal = async kind => { const current = await this.running(state); for (const p of processes) if (current.some(c => c.pid === p.pid && c.executable === p.executable && c.start === p.start)) { try { process.kill(p.pid, kind); } catch (e) { if (e.code !== 'ESRCH') throw e; } } };
    await signal('SIGTERM'); let end = Date.now() + 4000;
    while ((await this.running(state)).length && Date.now() < end) await new Promise(r => setTimeout(r, 100));
    processes = await this.running(state); if (!processes.length) return;
    if (!await this.confirm({ title: `Force close ${item.name}?`, message: 'The app is still running. Force closing can lose unsaved work. Continue?', action: 'Force close' })) throw new Error('Operation cancelled.');
    await signal('SIGKILL'); end = Date.now() + 3000;
    while ((await this.running(state)).length && Date.now() < end) await new Promise(r => setTimeout(r, 100));
    if ((await this.running(state)).length) throw new Error('Close the app manually and retry.');
  }
  async prepare(root, id) {
    if (!path.isAbsolute(root) || path.parse(root).root === path.resolve(root)) throw new Error('Choose a full application folder, not a drive root.');
    const entries = await fs.readdir(root).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    if (entries.length && (await readJSON(path.join(root, '.tmapps-owner.json')))?.app !== id) throw new Error('Choose an empty folder dedicated to this application.');
    await fs.mkdir(root, { recursive: true }); await atomic(path.join(root, '.tmapps-owner.json'), { app: id });
  }
  async install(id, options = {}) {
    if (this.busy) throw new Error('Wait for the current operation.');
    const item = this.item(id), pkg = this.pkg(item); if (!pkg) throw new Error(`${item.name} has no ${LABELS[osKey(this.platform)]} ${this.arch} package. A Windows EXE cannot be installed on this system.`);
    this.busy = true; let archive, stage, activated = false;
    try {
      const previous = await this.installed(item); await this.closeApp(item, previous);
      const root = previous?.root || options.directory || path.join(this.root, 'Applications', id); await this.prepare(root, id);
      const folder = crypto.randomUUID(); stage = path.join(root, folder); archive = path.join(root, folder + '.download');
      await download(pkg.url, archive, pkg.sha256, { fetcher: this.fetcher, signal: this.signal, progress: this.progress });
      this.progress('Verifying and installing…');
      if (pkg.format === 'appimage') { await fs.mkdir(stage); await fs.rename(archive, path.join(stage, pkg.executable)); }
      else await extract(archive, stage);
      this.signal?.throwIfAborted();
      const executable = path.join(stage, pkg.executable); if (!(await fs.stat(executable)).isFile()) throw new Error('The expected application is missing.'); await fs.chmod(executable, 0o755);
      if ((await this.running(previous)).length) throw new Error('The app reopened during installation. Close it and retry.');
      const state = { root, folder, executable: pkg.executable, version: item.version, platform: this.platform, runAtStartup: previous?.runAtStartup ?? options.runAtStartup === true, desktopShortcut: previous?.desktopShortcut ?? options.desktopShortcut === true };
      this.signal?.throwIfAborted();
      await atomic(this.stateFile(id), state); activated = true;
      let warning; try { await this.integration('app', { item, state, previous }); } catch { warning = 'Installed, but startup/desktop integration needs attention.'; }
      if (previous) await fs.rm(path.join(previous.root, previous.folder), { recursive: true, force: true }).catch(() => {});
      return { ...await this.snapshot(), warning };
    } finally { if (archive) await fs.rm(archive, { force: true }); if (!activated && stage) await fs.rm(stage, { recursive: true, force: true }); this.busy = false; }
  }
  async open(id) {
    const state = await this.installed(this.item(id)); if (!state) throw new Error('Application is not installed.');
    const executable = path.join(state.root, state.folder, state.executable);
    await new Promise((resolve, reject) => { const child = spawn(executable, [], { cwd: path.dirname(executable), detached: true, stdio: 'ignore' }); child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(); }); });
  }
  dataLocations(id) { if (!IDS.includes(id)) throw new Error('Unknown application.'); return id === 'tma-mail' ? [] : [path.join(this.data, 'agent-office'), path.join(this.data, 'Agent Office')]; }
  async uninstall(id, deleteData = false) {
    if (this.busy) throw new Error('Wait for the current operation.'); this.busy = true;
    try {
      const item = this.item(id), state = await this.installed(item); if (!state) throw new Error('Application is not installed.'); await this.closeApp(item, state);
      if(deleteData && (await this.processes()).some(p=>path.basename(p.executable)===path.basename(state.executable))) throw new Error("Close all copies of this app before deleting shared profile data.");
      if (deleteData) for (const folder of this.dataLocations(id)) {
        if (inside(folder, state.root) || inside(state.root, folder) || folder === state.root) throw new Error('Installation and data folders overlap. Keep data and review the folder manually.');
        const stat = await fs.lstat(folder).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
        if (stat?.isSymbolicLink()) throw new Error('The profile is linked. Keep data and review it manually.');
        if (stat) await fs.rm(folder, { recursive: true });
      }
      await fs.rm(path.join(state.root, state.folder), { recursive: true }); await this.integration('remove', { item, state }); await fs.rm(this.stateFile(id)); return this.snapshot();
    } finally { this.busy = false; }
  }
}
module.exports = { Library, RELEASE, LABELS, osKey, inside, trusted, version, newer, relative, parseCatalog, support, launcherRelease, profile, readJSON, atomic, download, extract, directories };
