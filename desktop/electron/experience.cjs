'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const content = require('../experience.json');
function redact(value) {
  return String(value || '').replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted session]').replace(/(bearer\s+)\S+/gi, '$1[redacted]').replace(/(password|token|secret|api[_-]?key|authorization)(\s*[=:]\s*)[^\s,;]+/gi, '$1$2[redacted]').replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]').replace(/[A-Z]:[\\/][^\r\n]+|\/(?:Users|home)\/[^\s]+/gi, '[local path]').slice(0, 6000);
}
function issue(kind, report = '', appName = 'TMApps Launcher') {
  if (!['feature', 'bug', 'issue', 'crash'].includes(kind)) throw new Error('Unknown support action.');
  const url = new URL('https://github.com/DaddyTylerXO/TMApps/issues/new');
  url.searchParams.set('title', `[${appName === 'TMApps Launcher' ? 'Launcher' : appName}] ${kind} report`);
  const prompts = { feature: 'App: TMApps Launcher\nProblem to solve:\nRequested feature:\nExpected benefit:\n', bug: 'App: TMApps Launcher\nVersion:\nSteps to reproduce:\nExpected behaviour:\nActual behaviour:\n', issue: 'App: TMApps Launcher\nIssue category:\nDetails:\n', crash: 'Review this public crash report before submitting.\n\n' };
  url.searchParams.set('body', prompts[kind].replace('App: TMApps Launcher','App: '+appName) + redact(report).slice(0, 1800)); return url.href;
}
function report(error, version) { return `TMApps Launcher ${version}\nOS: ${os.platform()} ${os.release()}\nArchitecture: ${os.arch()}\nMemory MB: ${Math.round(process.memoryUsage().rss / 1048576)}\nUTC: ${new Date().toISOString()}\n\n${redact(error?.stack || error || 'No captured crash. Describe the issue and steps to reproduce.')}`; }
async function saveCrash(root, error, version) { try { await fs.mkdir(root, { recursive: true }); await fs.writeFile(path.join(root, 'last-crash.txt'), report(error, version)); } catch {} }
async function crash(root, version) { return redact(await fs.readFile(path.join(root, 'last-crash.txt'), 'utf8').catch(() => report(null, version))); }
function media(value) { try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/DaddyTylerXO/TMApps/') && !u.username && !u.password; } catch { return false; } }
module.exports = { content, redact, issue, report, saveCrash, crash, media };
