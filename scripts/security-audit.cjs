'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['audit', '--json'], { encoding: 'utf8', shell: process.platform === 'win32', timeout: 120000 });
if (result.error) throw result.error;
let report;
try { report = JSON.parse(result.stdout); } catch { throw Error('Dependency audit did not return a valid report.'); }
if (!report.metadata?.vulnerabilities || report.error) throw Error('Dependency advisory service unavailable; audit needs review.');
fs.mkdirSync('build', { recursive: true }); fs.writeFileSync('build/dependency-audit.json', JSON.stringify(report, null, 2));
console.log('Dependency advisory counts:', report.metadata.vulnerabilities);
for (const advisory of Object.values(report.advisories || {})) console.log(`${advisory.severity}: ${advisory.module_name}: ${advisory.url}`);
// Moderate/low findings remain visible and require documented review. High/critical block release.
if (report.metadata.vulnerabilities.high || report.metadata.vulnerabilities.critical) process.exitCode = 1;
