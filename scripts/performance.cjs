'use strict';
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { performance } = require('node:perf_hooks');
const { Vault } = require('../electron/vault.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tma-safe-performance-')), vault = new Vault(), timings = {};
  const measure = async (name, action) => { const start = performance.now(); const value = await action(); timings[name] = Math.round(performance.now() - start); return value; };
  try {
    const file = path.join(root, 'fictional.tmasafe'), password = 'fictional performance benchmark only';
    await measure('createMs', () => vault.create(file, password));
    await measure('import1000Ms', () => vault.import(Array.from({ length: 1000 }, (_, i) => ({ title: `Fictional ${i}`, username: `user${i}`, password: `fictional password ${i}`, url: 'https://example.com', notes: '', expiryDays: 90 }))));
    vault.lock(); await measure('unlock1000Ms', () => vault.unlock(file, password));
    await measure('list1000Ms', () => { for (let i = 0; i < 20; i++) vault.list(); });
    const report = { platform: process.platform, arch: process.arch, node: process.version, entries: 1000, ...timings, vaultBytes: (await fs.stat(file)).size, peakRssMiB: Math.round(process.resourceUsage().maxRSS / 1024) };
    // Generous regression ceilings for shared CI; measured values are retained for comparison.
    if (timings.unlock1000Ms > 30000 || timings.import1000Ms > 15000 || timings.list1000Ms > 3000 || report.peakRssMiB > 768) throw Error('Performance regression ceiling exceeded: ' + JSON.stringify(report));
    await fs.mkdir('build', { recursive: true }); await fs.writeFile('build/performance.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } finally { vault.lock(); await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
