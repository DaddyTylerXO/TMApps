'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
function sharedPath(platform = process.platform, home = os.homedir(), env = process.env) {
  const base = platform === 'win32' ? env.LOCALAPPDATA || path.join(home, 'AppData', 'Local') : platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, '.config');
  return path.join(base, 'TMApps', 'profile.json');
}
const text = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : '';
const email = value => { const v = text(value, 254); return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v) ? v : ''; };
async function read(file, strict = false) { try { if ((await fs.stat(file)).size > 65536) throw new Error('Profile too large.'); return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); } catch (e) { if (strict && e.code !== 'ENOENT') throw new Error('The local profile could not be read. Its existing file was kept.'); return {}; } }
function suggestions(value) {
  if (value.schemaVersion !== 1 || !text(value.revision, 80) || value.shareWithApps === false) return { enabled: false, displayName: '', emails: [], socialAccounts: [] };
  const emails = [...new Set((Array.isArray(value.emails) ? value.emails : []).slice(0, 20).map(email).filter(Boolean))];
  const socialAccounts = value.shareWithSocialApps === true ? (Array.isArray(value.socialAccounts) ? value.socialAccounts : []).slice(0, 20).map(a => ({ platform: text(a?.platform, 40), account: text(a?.account, 300) })).filter(a => a.platform && a.account && (!a.account.includes('://') || (() => { try { const u = new URL(a.account); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } })())) : [];
  return { enabled: true, revision: value.revision, displayName: text(value.displayName, 100), emails, socialAccounts };
}
function merge(local, shared) {
  const result = { displayName: text(local.displayName, 100), email: email(local.email), importedName: text(local.importedName, 100), importedEmail: email(local.importedEmail) };
  if (shared.enabled) {
    if (!result.displayName || result.displayName === result.importedName) result.displayName = result.importedName = shared.displayName;
    if (!result.email || result.email === result.importedEmail) result.email = result.importedEmail = shared.emails[0] || '';
  }
  return result;
}
class AppProfile {
  constructor({ shared = sharedPath(), root, disabled = false }) { this.shared = shared; this.file = path.join(root, 'tmapps-profile.json'); this.disabled = disabled; this.queue = Promise.resolve(); }
  async snapshot() {
    const shared = this.disabled ? { enabled: false, emails: [], socialAccounts: [] } : suggestions(await read(this.shared));
    const local = await read(this.file, true), result = merge(local, shared);
    if (JSON.stringify(result) !== JSON.stringify(local) && (result.displayName || result.email)) await this.write(result);
    return { ...result, sharing: shared.enabled, emails: shared.emails, socialAccounts: shared.socialAccounts };
  }
  async write(value) { await fs.mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 }); const temp = this.file + '.tmp'; await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(temp, this.file); }
  async save(value) { const old = await read(this.file, true); if (typeof value?.displayName !== 'string' || value.displayName.length > 100 || /[\x00-\x1f\x7f]/.test(value.displayName) || value.email && !email(value.email)) throw new Error('Enter a name of up to 100 characters and a valid optional email address.'); await this.write({ ...merge(old, { enabled: false }), displayName: text(value.displayName, 100), email: email(value.email) }); return this.snapshot(); }
}
function setupProfile({ branch } = {}) {
  const { app, ipcMain, BrowserWindow, shell } = require('electron');
  const store = new AppProfile({ root: app.getPath('userData'), disabled: process.argv.includes('--smoke') || !!process.env.TMA_TEST_DATA_DIR });
  ipcMain.handle('tmapps:profile', (event, action, value) => {
    if (event.senderFrame !== event.sender.mainFrame || !BrowserWindow.fromWebContents(event.sender)) throw new Error('Profile data is available only from app windows.');
    const operation = async () => { if (action === 'read') return store.snapshot(); if (action === 'save') return store.save(value); if(action==='help'&&['TMA-AgentOffice','TMA-Finance','TMA-Safe','TMA-Padlock','TMA-Cut','TMA-SocialsManager'].includes(branch))return shell.openExternal('https://github.com/DaddyTylerXO/TMApps/blob/'+branch+'/docs/KB%20Library.docx'); throw new Error('Unknown profile operation.'); };
    const result = store.queue.then(operation, operation); store.queue = result.catch(() => {}); return result;
  });
}
module.exports = { sharedPath, suggestions, merge, AppProfile, setupProfile };
