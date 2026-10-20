'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path'); const { JSDOM } = require('jsdom');
test('extension fills only the expected HTTPS top-level login, never submits, and refuses changed origins', async () => {
  for (const actualOrigin of ['https://example.com', 'https://attacker.example']) {
    const popup = new JSDOM(fs.readFileSync(path.join(__dirname, '../browser-extension/popup.html'), 'utf8'), { runScripts: 'outside-only' });
    const page = new JSDOM('<form><input autocomplete="username"><input type="password"><button>Sign in</button></form>', { url: actualOrigin, runScripts: 'outside-only', pretendToBeVisual: true });
    let submitted = false; page.window.document.querySelector('form').onsubmit = () => { submitted = true; };
    page.window.HTMLInputElement.prototype.getClientRects = () => [{}];
    popup.window.chrome = { storage: { session: { get: async () => ({}), set: async () => {} } }, tabs: { query: async () => [{ id: 1, url: 'https://example.com/login' }] }, scripting: { executeScript: async spec => [{ result: page.window.eval('(' + spec.func.toString() + ')')(...spec.args) }] } };
    popup.window.AbortSignal = AbortSignal;
    popup.window.fetch = async (_url, options) => { assert.equal(JSON.parse(options.body).origin, 'https://example.com'); return { ok: true, json: async () => ({ origin: 'https://example.com', username: 'fictional-user', password: 'fictional-secret' }) }; };
    popup.window.eval(fs.readFileSync(path.join(__dirname, '../browser-extension/popup.js'), 'utf8')); await new Promise(resolve => setImmediate(resolve));
    popup.window.document.getElementById('token').value = 'a'.repeat(64); popup.window.document.getElementById('fill').click(); await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(page.window.document.querySelector('input[type=password]').value, actualOrigin === 'https://example.com' ? 'fictional-secret' : ''); assert.equal(submitted, false);
    popup.window.close(); page.window.close();
  }
});
