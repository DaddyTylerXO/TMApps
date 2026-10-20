'use strict';
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const directory = process.argv[2], prior = process.argv[3], output = process.argv[4];
if (!directory || !prior || !output) throw Error('Expected artifacts directory, prior catalog, and output path.');
const metadata = fs.readdirSync(directory).filter(name => /^padlock-metadata-.+\.json$/.test(name)).map(name => JSON.parse(fs.readFileSync(path.join(directory, name))));
const required = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64', 'linux-arm64'];
if (metadata.length !== required.length || required.some(key => !metadata.some(m => m.platform + '-' + m.arch === key)) || new Set(metadata.map(m => m.version)).size !== 1) throw Error('Incomplete native build matrix.');
for (const m of metadata) for (const artifact of m.artifacts) { if (path.basename(artifact.filename) !== artifact.filename || crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, artifact.filename))).digest('hex') !== artifact.sha256) throw Error('Package integrity check failed.'); }
const catalog = JSON.parse(fs.readFileSync(prior, 'utf8').replace(/^\uFEFF/, '')); if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.apps) || !catalog.apps.some(a => a.id === 'tma-mail') || !catalog.apps.some(a => a.id === 'tma-agent-office')) throw Error('Missing existing catalog applications.');
const windows = metadata.find(m => m.platform === 'win32');
const safe = { id: 'tma-padlock', name: 'TMA-Padlock', category: 'PRIVACY & SECURITY', description: 'Your codes, kept close. Encrypted TOTP and HOTP authenticators with optional master-password protection.', version: windows.version, updatedAt: new Date().toISOString(), branch: 'TMA-Padlock', executable: 'TMA-Padlock.exe', downloadUrl: windows.package.url, sha256: windows.package.sha256, platforms: ['windows', 'macos', 'linux'], packages: Object.fromEntries(metadata.filter(m => m.platform !== 'win32').map(m => [(m.platform === 'darwin' ? 'macos' : 'linux') + '-' + m.arch, { url: m.package.url, sha256: m.package.sha256, format: m.package.format, executable: m.package.executable }])) };
catalog.apps = [...catalog.apps.filter(a => a.id !== 'tma-padlock'), safe]; fs.writeFileSync(output, JSON.stringify(catalog, null, 2) + '\n');
