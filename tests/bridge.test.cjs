'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict'); const { startBridge } = require('../electron/bridge.cjs');
test('browser bridge fails closed on websites, missing tokens, locked vaults and non-exact origins', async t => {
  let unlocked = true, calls = 0; const bridge = await startBridge({ port: 0, unlocked: () => unlocked, approve: async site => { calls++; return { username: 'test', password: 'fake', origin: site }; } }); t.after(() => bridge.close());
  const url = `http://127.0.0.1:${bridge.port}/fill`, ext = 'chrome-extension://' + 'a'.repeat(32);
  const send = (origin, token, website = 'https://example.com') => fetch(url, { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: website }) });
  assert.equal((await send('https://evil.example', bridge.token)).status, 403); assert.equal((await send(ext, 'bad')).status, 401); assert.equal(calls, 0);
  assert.equal((await send(ext, bridge.token, 'https://example.com/login')).status, 403); assert.equal((await send(ext, bridge.token, 'http://example.com')).status, 403);
  const good = await send(ext, bridge.token); assert.equal(good.status, 200); assert.equal(good.headers.get('access-control-allow-origin'), ext); assert.equal((await good.json()).origin, 'https://example.com'); assert.equal(calls, 1);
  unlocked = false; assert.equal((await send(ext, bridge.token)).status, 403); assert.equal(calls, 1);
  unlocked = true;
  const privileged = await fetch(url, { method: 'POST', headers: { 'X-TMA-Extension': 'moz-extension://test-browser-id', Authorization: 'Bearer ' + bridge.token }, body: JSON.stringify({ origin: 'https://example.com' }) }); assert.equal(privileged.status, 200);
  const spoofed = await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example', 'X-TMA-Extension': ext, Authorization: 'Bearer ' + bridge.token }, body: JSON.stringify({ origin: 'https://example.com' }) }); assert.equal(spoofed.status, 403);
});
test('locking revokes an in-flight approved fill', async t => {
  let release, started; const waiting = new Promise(resolve => { started = resolve; }); const bridge = await startBridge({ port: 0, unlocked: () => true, approve: async () => { started(); await new Promise(resolve => { release = resolve; }); return { password: 'must not escape' }; } }); t.after(() => bridge.close());
  const request = fetch(`http://127.0.0.1:${bridge.port}/fill`, { method: 'POST', headers: { Origin: 'chrome-extension://' + 'a'.repeat(32), Authorization: 'Bearer ' + bridge.token }, body: JSON.stringify({ origin: 'https://example.com' }) }).catch(() => null);
  await waiting; bridge.close(); release(); const response = await request; if (response) assert.notEqual(response.status, 200);
});
