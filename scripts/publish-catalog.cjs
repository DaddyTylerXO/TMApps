'use strict';
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const directory = process.argv[2], prior = process.argv[3], output = process.argv[4];
if (!directory || !prior || !output) throw Error('Expected artifacts directory, prior catalog, and output path.');
const metadata = fs.readdirSync(directory).filter(name => /^safe-metadata-.+\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(directory, name))));
const required = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64'];
if (metadata.length !== required.length || required.some(key => !metadata.some(m => m.platform + '-' + m.arch === key)) || new Set(metadata.map(m => m.version)).size !== 1) throw Error('Incomplete native build matrix.');
for (const m of metadata) for (const artifact of m.artifacts) { if (path.basename(artifact.filename) !== artifact.filename || crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, artifact.filename))).digest('hex') !== artifact.sha256) throw Error('Package integrity check failed.'); }
const catalog = JSON.parse(fs.readFileSync(prior, 'utf8').replace(/^\uFEFF/, '')); if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.apps) || !catalog.apps.some(a => a.id === 'tma-mail') || !catalog.apps.some(a => a.id === 'tma-agent-office')) throw Error('Missing existing catalog applications.');
const windows = metadata.find(m => m.platform === 'win32');
const safe = { id: 'tma-safe', name: 'TMA-Safe', category: 'PRIVACY & SECURITY', description: 'A calmer home for your passwords. Keep an encrypted, portable vault with a master password and optional separate key file.', version: windows.version, updatedAt: new Date().toISOString(), branch: 'TMA-Safe', executable: 'TMA-Safe.exe', downloadUrl: windows.package.url, sha256: windows.package.sha256, platforms: ['windows', 'macos', 'linux'], packages: Object.fromEntries(metadata.filter(m => m.platform !== 'win32').map(m => [(m.platform === 'darwin' ? 'macos' : 'linux') + '-' + m.arch, { url: m.package.url, sha256: m.package.sha256, format: m.package.format, executable: m.package.executable }])) };
const release = require('../docs/releases.json').find(item => item.version === windows.version); if (!release) throw Error('Missing release notes for this version.'); safe.releaseNotes = release.notes;
const existing = catalog.apps.findIndex(a => a.id === 'tma-safe');
if (existing >= 0) catalog.apps[existing] = safe;
else { const before = catalog.apps.findIndex(a => a.id === 'tma-socialsmanager' || a.id === 'tma-agent-office'); catalog.apps.splice(before < 0 ? catalog.apps.length : before, 0, safe); }
// Stable sorting changes display order only: every catalogue entry is retained.
// The owner's suite standard requires SocialsManager immediately before Agent Office.
const tailOrder = new Map([['tma-socialsmanager', 1], ['tma-agent-office', 2]]);
catalog.apps.sort((a,b) => (tailOrder.get(a.id) || 0) - (tailOrder.get(b.id) || 0));
fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
