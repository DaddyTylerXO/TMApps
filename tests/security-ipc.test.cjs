'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm'); const { EventEmitter } = require('node:events'); const { createRequire } = require('node:module');
test('real IPC registration rejects foreign windows, subframes and navigated frames', async () => {
  const file = path.join(__dirname, '../electron/main.cjs'), actual = createRequire(file), handlers = new Map(); let ready, window;
  class Window extends EventEmitter {
    constructor() { super(); window = this; this.webContents = new EventEmitter(); Object.assign(this.webContents, { mainFrame: { url: require('node:url').pathToFileURL(path.join(__dirname, '../ui/index.html')).href }, setWindowOpenHandler() {}, send() {}, session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } }); }
    isMinimized() { return false; } show() {} focus() {} loadURL() {}
  }
  const electron = { app: { requestSingleInstanceLock: () => true, on() {}, whenReady: () => ({ then(fn) { ready = fn; } }), setName() {}, getPath: () => '/fictional' }, BrowserWindow: Window, ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, powerMonitor: new EventEmitter() };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8') + '\nmodule.exports = {vault,lock};', { require: name => name === 'electron' ? electron : name === './settings.cjs' ? { ...actual(name), load: async () => ({ ...actual(name).defaults, showTray: false }) } : actual(name), module, __dirname: path.dirname(file), process, Buffer, URL, structuredClone, setInterval: () => 1, clearInterval() {}, setTimeout, clearTimeout });
  await ready(); const wc = window.webContents, trusted = { sender: wc, senderFrame: wc.mainFrame };
  module.exports.vault.key = Buffer.alloc(32, 1); module.exports.vault.data = { entries: [{ id: 'fictional', password: 'fictional-secret' }] };
  for (const name of ['reveal', 'unlock', 'bridge', 'copy', 'state', 'settings']) {
    const invoke = handlers.get('safe:' + name);
    for (const event of [{ sender: {}, senderFrame: wc.mainFrame }, { sender: wc, senderFrame: { ...wc.mainFrame } }]) assert.throws(() => invoke(event, 'fictional'), /Untrusted caller/);
    const url = wc.mainFrame.url; wc.mainFrame.url = 'https://attacker.example'; assert.throws(() => invoke(trusted, 'fictional'), /Untrusted caller/); wc.mainFrame.url = url;
  }
  assert.equal((await handlers.get('safe:reveal')(trusted, 'fictional')).value, 'fictional-secret'); module.exports.lock();
  assert.equal((await handlers.get('safe:reveal')(trusted, 'fictional')).ok, false);
});
