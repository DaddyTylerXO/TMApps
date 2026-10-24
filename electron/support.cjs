'use strict';
const version = require('../package.json').version;
const base = 'https://github.com/DaddyTylerXO/TMApps';
const templates = Object.freeze({ feature: 'feature-request.md', bug: 'bug-report.md', issue: 'general-issue.md', crash: 'bug-report.md' });
// Runtime errors can contain arbitrary vault values. Use an allowlisted error category,
// never the original message/stack, filenames, request payloads or vault contents.
function sanitise(error) {
  if (!error) return 'No runtime error recorded.';
  const message = typeof error === 'string' ? error : error?.message || '';
  if (['Vault authentication failed. Private details omitted.','Vault save conflict. Private details omitted.','Operation cancelled by locking.','Renderer stopped unexpectedly. Private details omitted.'].includes(message)) return message;
  if (/Could not unlock|key file|master password/i.test(message)) return 'Vault authentication failed. Private details omitted.';
  if (/changed on disk|saved elsewhere|stale.*lock/i.test(message)) return 'Vault save conflict. Private details omitted.';
  if (/cancelled|locked during/i.test(message)) return 'Operation cancelled by locking.';
  if (/renderer|render process/i.test(message)) return 'Renderer stopped unexpectedly. Private details omitted.';
  return 'Unexpected application error. Original message and stack omitted to protect private data.';
}
function report(kind, error) { return `**App Name**\nTMA-Safe\n\n**Version**\n${version}\n\n**System**\n${process.platform} ${process.arch}\n\n**Sanitised error**\n${sanitise(error)}\n\n**Steps to reproduce**\n[Describe the steps without passwords, keys, private account names or file paths.]\n\n**Expected behaviour**\n[Describe what should happen.]\n`; }
function link(kind) { if (!Object.hasOwn(templates,kind)) throw Error('Unknown support action.'); const url = new URL(base + '/issues/new'); url.searchParams.set('template', templates[kind]); url.searchParams.set('title', `[TMA-Safe ${version}] ${kind === 'feature' ? 'Feature request' : kind === 'crash' ? 'Crash report' : kind === 'bug' ? 'Bug report' : 'Issue report'}`); return url; }
module.exports = { sanitise, report, link };
