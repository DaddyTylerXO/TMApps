'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const { JSDOM } = require('jsdom');
const state = { file: '/fictional/vault.tmasafe', keyfile: false, folders: [], entries: [{ id: 'test', title: 'Fictional', username: 'user', url: 'https://example.com', notes: '', expiryDays: 0 }] };
const tick = () => new Promise(setImmediate);
function ui(t, handlers) {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8'), { runScripts: 'outside-only', url: 'file:///ui/index.html' }); t.after(() => dom.window.close());
  const w = dom.window; w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  w.safe = new Proxy({}, { get: (_, name) => async value => ({ ok: true, value: handlers[name] ? await handlers[name](value) : null }) }); w.eval(fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8')); return w;
}
test('late renderer state cannot reopen the workspace after a lock', async t => {
  let finish; const w = ui(t, { state: () => new Promise(r => { finish = r; }) }); await tick();
  w.dispatchEvent(new w.Event('safe-refresh')); await tick(); w.dispatchEvent(new w.Event('safe-locked')); finish(state);
  // The refresh listener must handle the cancelled promise without an unhandled rejection.
  await tick(); assert.equal(w.document.getElementById('workspace').hidden, true); assert.equal(w.document.querySelectorAll('.login-card').length, 0);
});
test('delayed password reveals stay hidden after blur or closing and reopening the editor', async t => {
  for (const action of ['blur', 'reopen']) {
    let finish; const w = ui(t, { unlock: () => structuredClone(state), reveal: () => new Promise(r => { finish = r; }) }), d = w.document;
    d.getElementById('unlock-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
    [...d.querySelectorAll('.login-actions button')].find(b => b.textContent === 'Edit').click();
    d.getElementById('entry-reveal').click(); await tick();
    if (action === 'blur') w.dispatchEvent(new w.Event('blur'));
    else { d.getElementById('entry-cancel').click(); d.getElementById('add-button').click(); }
    finish('must remain hidden'); await tick();
    assert.equal(d.getElementById('entry-password').type, 'password'); assert.equal(d.getElementById('entry-password').value, '');
  }
});
