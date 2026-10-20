'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const defaults = Object.freeze({ openAtLogin: false, showTray: true, closeToTray: false, idleMinutes: 5, clipboardSeconds: 20 });
function validate(value) {
  if (!value || ['openAtLogin','showTray','closeToTray'].some(k => typeof value[k] !== 'boolean') || ![1,2,5,10,15,30].includes(value.idleMinutes) || ![10,20,30,60].includes(value.clipboardSeconds)) throw Error('Invalid settings.');
  if (value.closeToTray && !value.showTray) throw Error('Enable the tray icon before closing to tray.');
  return Object.fromEntries(Object.keys(defaults).map(k => [k, value[k]]));
}
async function load(file) { try { return validate(JSON.parse(await fs.readFile(file, 'utf8'))); } catch { return { ...defaults }; } }
async function save(file, value) { const clean = validate(value); await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = file + '.' + crypto.randomUUID() + '.tmp'; try { await fs.writeFile(tmp, JSON.stringify(clean), { mode: 0o600, flag: 'wx' }); await fs.rename(tmp, file); } finally { await fs.rm(tmp, { force: true }); } return clean; }
function desktopEntry(executable) { if (!path.isAbsolute(executable) || /[\r\n\0]/.test(executable)) throw Error('Invalid startup executable.'); const escaped = executable.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%'); return `[Desktop Entry]\nType=Application\nName=TMA-Safe\nComment=Open your locked password vault\nExec="${escaped}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`; }
async function linuxStartup(file, executable, enabled) { if (!enabled) { await fs.rm(file, { force: true }); return; } await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, desktopEntry(executable), { mode: 0o600 }); }
module.exports = { defaults, validate, load, save, desktopEntry, linuxStartup };
