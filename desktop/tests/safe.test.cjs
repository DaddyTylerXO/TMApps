'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { parseCatalog, support, Library } = require('../electron/service.cjs');
const bundled = require('./catalog-fixture.json');
test('Safe catalog accepts verified native builds and still reads legacy two-app caches', () => {
  const catalog = structuredClone(bundled), safe = catalog.apps.find(a => a.id === 'tma-safe');
  assert.ok(safe); assert.deepEqual(support(safe), []);
  safe.downloadUrl = 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Safe-0.1.0-win-x64.zip'; safe.sha256 = 'a'.repeat(64);
  safe.packages = { 'macos-arm64': { url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Safe-0.1.0-mac-arm64.tar.gz', sha256: 'b'.repeat(64), format: 'tar.gz', executable: 'TMA-Safe.app/Contents/MacOS/TMA-Safe' }, 'linux-x64': { url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Safe-0.1.0-linux-x64.AppImage', sha256: 'c'.repeat(64), format: 'appimage', executable: 'TMA-Safe.AppImage' } };
  assert.deepEqual(support(parseCatalog(catalog).apps[2]), ['windows', 'macos', 'linux']);
  assert.equal(parseCatalog({ schemaVersion: 1, apps: catalog.apps.slice(0, 2) }).apps.length, 2);
  const library = new Library({ bundled: catalog }); assert.deepEqual(library.dataLocations('tma-safe'), []);
  catalog.apps.push(structuredClone(safe)); assert.throws(() => parseCatalog(catalog));
});
