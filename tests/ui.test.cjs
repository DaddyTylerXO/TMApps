'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const { JSDOM } = require('jsdom');
test('UI never renders stored markup and removes credentials on lock', async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8'), { runScripts: 'outside-only', url: 'file:///ui/index.html' }); const w = dom.window, d = w.document;
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); }; w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
  const state = { file: '/vault/test.tmasafe', keyfile: false, entries: [{ id: 'test', title: '<img src=x onerror=alert(1)>', username: 'test@example.com', url: 'https://example.com', notes: '', expiryDays: 0 }] };
  w.safe = new Proxy({}, { get: (_, name) => async () => ({ ok: true, value: name === 'unlock' ? state : name === 'generate' ? 'RandomFakePassword123!' : null }) });
  w.eval(fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8'));
  for (const id of ['master','confirm-master']) { const toggle=d.querySelector(`[data-eye="${id}"]`); d.getElementById(id).value='fictional password'; toggle.click(); assert.equal(d.getElementById(id).type,'text'); assert.equal(toggle.getAttribute('aria-pressed'),'true'); toggle.click(); assert.equal(d.getElementById(id).type,'password'); }
  d.getElementById('master').value = 'should clear'; d.getElementById('unlock-form').dispatchEvent(new w.Event('submit', { cancelable: true })); await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(d.getElementById('workspace').hidden, false); assert.equal(d.getElementById('master').value, ''); assert.ok(d.querySelector('.login-info h3').textContent.includes('<img')); assert.equal(d.querySelector('.login-info img'), null);
  d.getElementById('add-button').click(); d.getElementById('entry-password').value = 'sensitive'; d.getElementById('entry-reveal').click(); assert.equal(d.getElementById('entry-password').type,'text'); w.dispatchEvent(new w.Event('safe-locked')); assert.equal(d.getElementById('entry-password').value, ''); assert.equal(d.getElementById('entry-password').type,'password'); assert.equal(d.getElementById('workspace').hidden, true); assert.equal(d.getElementById('view-content').textContent, ''); dom.window.close();
});
