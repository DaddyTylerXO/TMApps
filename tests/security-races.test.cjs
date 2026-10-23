'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { SessionQueue } = require('../electron/session.cjs');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function main(overrides = {}) {
  const file = path.join(__dirname, '../electron/main.cjs'), actual = createRequire(file), module = { exports: {} };
  const electron = { app: { requestSingleInstanceLock: () => false, quit() {} }, dialog: {}, clipboard: {}, ...overrides.electron };
  vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nmodule.exports = {actions,lock,vault,operations,get pendingImport(){return pendingImport},get bridge(){return bridge},select(file){selected=file}};', {
    require: name => name === 'electron' ? electron : overrides[name] || actual(name), module, __dirname: path.dirname(file), process, Buffer, URL, structuredClone, setTimeout, clearTimeout, console
  }, { filename: file });
  return module.exports;
}
test('lock cancels active results AND queued unlock/reveal work before it executes', async () => {
  const queue = new SessionQueue(), wait = deferred(); let called = false;
  const active = queue.run(() => wait.promise), queued = queue.run(() => { called = true; return 'secret'; });
  const assertions = Promise.all([assert.rejects(active, /cancelled/), assert.rejects(queued, /cancelled/)]);
  await new Promise(setImmediate); queue.invalidate(); wait.resolve('stale secret'); await assertions;
  assert.equal(called, false); assert.equal(await queue.run(() => 'fresh operation'), 'fresh operation');
});
test('CSV import cannot repopulate plaintext after lock during dialog or disk read', async () => {
  for (const duringRead of [false, true]) {
    const wait = deferred(), started = deferred(); let reads = 0;
    const app = main({ electron: { dialog: { showOpenDialog: async () => { if (!duringRead) { started.resolve(); await wait.promise; } return { filePaths: ['fictional.csv'] }; } } },
      './vault.cjs': { ...require('../electron/vault.cjs'), read: async () => { reads++; started.resolve(); await wait.promise; return 'name,url,username,password\nExample,https://example.com,user,secret'; } } });
    app.vault.key = Buffer.alloc(32, 1);
    const pending = app.actions.previewImport(), rejected = assert.rejects(pending, /cancelled/);
    await started.promise; app.lock(); wait.resolve(); await rejected;
    assert.equal(app.pendingImport, null); assert.equal(reads, duringRead ? 1 : 0);
  }
});
test('a bridge that finishes listening after lock is closed and never paired', async () => {
  const wait = deferred(); let closed = false;
  const app = main({ './bridge.cjs': { startBridge: () => wait.promise } }); app.vault.key = Buffer.alloc(32, 1);
  const pending = app.actions.bridge(true), rejected = assert.rejects(pending, /cancelled/);
  app.lock(); wait.resolve({ token: 'must not be returned', close() { closed = true; } }); await rejected;
  assert.equal(closed, true); assert.equal(app.bridge, null);
});
test('lock during key-file read cancels unlock before key derivation and wipes bytes', async () => {
  const wait = deferred(), bytes = Buffer.alloc(32, 7); let called = false;
  const app = main({ './vault.cjs': { ...require('../electron/vault.cjs'), readBytes: () => wait.promise },
    electron: { dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['fictional.tmakey'] }) } } });
  app.select('fictional.tmasafe'); await app.actions.chooseKey();
  app.vault.unlock = () => { called = true; };
  const pending = app.actions.unlock({ useKey: true, password: 'fictional long passphrase' }), rejected = assert.rejects(pending, /cancelled/);
  app.lock(); wait.resolve(bytes); await rejected;
  assert.equal(called, false); assert.ok(bytes.every(b => b === 0));
});
