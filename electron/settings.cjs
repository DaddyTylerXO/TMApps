'use strict';
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const generatorDefaults = Object.freeze({ length: 24, lower: true, upper: true, numbers: true, symbols: true, excludeSimilar: false });
const extraDefaults = Object.freeze({ appearance: 'purple', scheduledAppearance: 'black', scheduleEnabled: false, scheduleStart: '20:00', scheduleEnd: '07:00', transitionMinutes: 2, textScale: 100, highContrast: false, reducedMotion: false, includeKB: true, browserFilling: true, onboardingDone: false });
const defaults = Object.freeze({ openAtLogin: false, showTray: true, closeToTray: false, idleMinutes: 5, clipboardSeconds: 20, vaultFile: '', ...extraDefaults, generator: generatorDefaults, dashboardWidgets:['total','short','reused','due','flagged'] });
function validate(value) {
  if (!value || ['openAtLogin','showTray','closeToTray'].some(k => typeof value[k] !== 'boolean') || ![1,2,5,10,15,30].includes(value.idleMinutes) || ![10,20,30,60].includes(value.clipboardSeconds)) throw Error('Invalid settings.');
  if (value.closeToTray && !value.showTray) throw Error('Enable the tray icon before closing to tray.');
  const vaultFile = value.vaultFile ?? ''; if (typeof vaultFile !== 'string' || vaultFile.length > 4096 || /[\r\n\0]/.test(vaultFile) || vaultFile && !path.isAbsolute(vaultFile)) throw Error('Invalid remembered vault path.');
  const extra = Object.fromEntries(Object.entries(extraDefaults).map(([k, fallback]) => [k, value[k] ?? fallback]));
  if (!['purple','grey','black'].includes(extra.appearance) || !['purple','grey','black'].includes(extra.scheduledAppearance) || ![0,2,5,10,15,30,60].includes(extra.transitionMinutes) || ![100,115,130,150,175,200].includes(extra.textScale)) throw Error('Invalid appearance settings.');
  for (const field of ['scheduleEnabled','highContrast','reducedMotion','includeKB','browserFilling','onboardingDone']) if (typeof extra[field] !== 'boolean') throw Error('Invalid preference.');
  for (const field of ['scheduleStart','scheduleEnd']) if (typeof extra[field] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(extra[field])) throw Error('Invalid schedule time.');
  if (extra.scheduleEnabled && extra.scheduleStart === extra.scheduleEnd) throw Error('Schedule start and end must differ.');
  if (extra.scheduleEnabled) { const minute = time => Number(time.slice(0,2))*60 + Number(time.slice(3)); const gap = (minute(extra.scheduleEnd)-minute(extra.scheduleStart)+1440)%1440; if (extra.transitionMinutes > Math.min(gap,1440-gap)) throw Error('The transition duration must fit between both schedule times.'); }
  const dashboardWidgets = value.dashboardWidgets ?? defaults.dashboardWidgets; if (!Array.isArray(dashboardWidgets) || dashboardWidgets.length > 5 || new Set(dashboardWidgets).size !== dashboardWidgets.length || dashboardWidgets.some(k => !['total','short','reused','due','flagged'].includes(k))) throw Error('Invalid dashboard widgets.');
  const generator = { ...generatorDefaults, ...(value.generator || {}) };
  if (!Number.isInteger(generator.length) || generator.length < 8 || generator.length > 128 || ['lower','upper','numbers','symbols','excludeSimilar'].some(k => typeof generator[k] !== 'boolean') || !['lower','upper','numbers','symbols'].some(k => generator[k])) throw Error('Invalid generator defaults.');
  return { ...Object.fromEntries(['openAtLogin','showTray','closeToTray','idleMinutes','clipboardSeconds'].map(k => [k, value[k]])), vaultFile, ...extra, dashboardWidgets:[...dashboardWidgets], generator: Object.fromEntries(Object.keys(generatorDefaults).map(k => [k, generator[k]])) };
}
async function load(file) { try { const value=JSON.parse(await fs.readFile(file, 'utf8')); if (value.onboardingDone === undefined) value.onboardingDone = true; return validate(value); } catch { return { ...defaults }; } }
async function save(file, value) { const clean = validate(value); await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = file + '.' + crypto.randomUUID() + '.tmp'; try { await fs.writeFile(tmp, JSON.stringify(clean), { mode: 0o600, flag: 'wx' }); await fs.rename(tmp, file); } finally { await fs.rm(tmp, { force: true }); } return clean; }
function desktopEntry(executable) { if (!path.isAbsolute(executable) || /[\r\n\0]/.test(executable)) throw Error('Invalid startup executable.'); const escaped = executable.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%'); return `[Desktop Entry]\nType=Application\nName=TMA-Safe\nComment=Open your locked password vault\nExec="${escaped}"\nTerminal=false\nX-GNOME-Autostart-enabled=true\n`; }
async function linuxStartup(file, executable, enabled) { if (!enabled) { await fs.rm(file, { force: true }); return; } await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, desktopEntry(executable), { mode: 0o600 }); }
module.exports = { defaults, validate, load, save, desktopEntry, linuxStartup, generatorDefaults };
