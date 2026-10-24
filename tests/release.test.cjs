'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process');
test('catalog publication preserves existing apps and rejects incomplete or corrupted native packages', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'safe-release-test-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const preserved = [{ id: 'tma-mail', version: '9.0.0' }, { id: 'tma-agent-office', version: '8.0.0' }, { id:'tma-socialsmanager',version:'7.0.0',description:'Preserve this exact record' }, { id:'tma-finance',version:'6.0.0',packages:{'linux-x64':{url:'https://example.com/fictional'}} }];
  const prior = path.join(root, 'prior.json'), output = path.join(root, 'catalog.json'); await fs.writeFile(prior, JSON.stringify({ schemaVersion: 1, apps: preserved }));
  const run = () => spawnSync(process.execPath, [path.join(__dirname, '../scripts/publish-catalog.cjs'), root, prior, output], { encoding: 'utf8' });
  assert.notEqual(run().status, 0); await assert.rejects(fs.stat(output), /ENOENT/);
  for (const [platform, arch] of [['win32', 'x64'], ['darwin', 'x64'], ['darwin', 'arm64'], ['linux', 'x64'], ['linux', 'arm64']]) {
    const filename = `fixture-${platform}-${arch}`, bytes = Buffer.from(filename); await fs.writeFile(path.join(root, filename), bytes);
    const artifact = { filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/' + filename };
    await fs.writeFile(path.join(root, `safe-metadata-${platform}-${arch}.json`), JSON.stringify({ version: require('../package.json').version, platform, arch, artifacts: [artifact], package: { ...artifact, executable: platform === 'win32' ? 'TMA-Safe.exe' : platform === 'darwin' ? 'TMA-Safe.app/Contents/MacOS/TMA-Safe' : 'TMA-Safe.AppImage', format: platform === 'win32' ? 'zip' : platform === 'darwin' ? 'tar.gz' : 'appimage' } }));
  }
  const result = run(); assert.equal(result.status, 0, result.stderr); const published = await fs.readFile(output, 'utf8'), catalog = JSON.parse(published);
  assert.equal(catalog.apps.length, preserved.length+1); for (const app of preserved) assert.deepEqual(catalog.apps.find(a => a.id === app.id),app);
  assert.equal(catalog.apps.at(-2).id,'tma-socialsmanager'); assert.equal(catalog.apps.at(-1).id,'tma-agent-office'); assert.equal(Object.keys(catalog.apps.find(a => a.id === 'tma-safe').packages).length, 4);
  await fs.appendFile(path.join(root, 'fixture-linux-x64'), 'corrupt'); assert.notEqual(run().status, 0); assert.equal(await fs.readFile(output, 'utf8'), published);
});
