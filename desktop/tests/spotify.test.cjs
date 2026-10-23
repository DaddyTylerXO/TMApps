'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { Spotify, challenge, CLIENT_ID } = require('../electron/spotify.cjs');
const vault = () => { let value; return { persistent: true, read: async () => value, write: async v => { value = v; }, clear: async () => { value = null; } }; };
async function redirect() { const s = http.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const port = s.address().port; await new Promise(r => s.close(r)); return `http://127.0.0.1:${port}/spotify/callback`; }
test('PKCE uses the RFC 7636 SHA-256 vector', () => assert.equal(challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'));
test('loopback sign-in rejects wrong state, exchanges PKCE and never uses a client secret', async () => {
  const store = vault(), uri = await redirect(); let expected, tokenCalls = 0;
  const api = new Spotify({ vault: store, redirect: uri, open: async url => { const u = new URL(url); expected = u.searchParams.get('code_challenge'); assert.equal(u.origin, 'https://accounts.spotify.com'); assert.equal(u.searchParams.get('client_id'), CLIENT_ID); assert.equal((await fetch(uri + '?state=wrong&code=fixture')).status, 400); await fetch(uri + '?state=' + u.searchParams.get('state') + '&code=fixture'); }, fetch: async (url, options) => { tokenCalls++; assert.equal(url, 'https://accounts.spotify.com/api/token'); assert.equal(challenge(options.body.get('code_verifier')), expected); assert.equal(options.body.has('client_secret'), false); return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600 }); } });
  try { await api.connect(); assert.equal(tokenCalls, 1); assert.equal(await store.read(), 'fixture-refresh'); assert.equal((await api.status()).connected, true); await api.disconnect(); assert.equal((await api.status()).connected, false); } finally { api.dispose(); }
});
test('refresh rotation, playback control and rate-limit backoff stay in the main process', async () => {
  const store = vault(); await store.write('fixture-old'); let requests = 0, limited = false;
  const api = new Spotify({ vault: store, open: async () => {}, fetch: async (url, options) => {
    requests++; if (url.includes('/api/token')) { assert.equal(options.body.get('refresh_token'), 'fixture-old'); return Response.json({ access_token: 'fixture-access', refresh_token: 'fixture-new', expires_in: 3600 }); }
    assert.equal(options.headers.Authorization, 'Bearer fixture-access'); assert.equal(options.redirect, 'error');
    if (limited) return new Response(null, { status: 429, headers: { 'Retry-After': '120' } });
    if (options.method !== 'GET') return new Response(null, { status: 204 });
    return Response.json({ is_playing: true, item: { name: 'Sample track', artists: [{ name: 'Example artist' }] }, device: { name: 'Example web player' } });
  } });
  try { assert.deepEqual(await api.control('play'), { connected: true, playing: true, title: 'Sample track', artist: 'Example artist', device: 'Example web player', restricted: false }); assert.equal(await store.read(), 'fixture-new'); await assert.rejects(api.control('https://example.com'), /Unknown/); limited = true; await assert.rejects(api.playback(), /busy/); const count = requests; await assert.rejects(api.playback(), /rate limiting/); assert.equal(requests, count); } finally { api.dispose(); }
});
test('closing the player cancels an unfinished authorization and releases the loopback port', async () => {
  const uri = await redirect(); let opened; const started = new Promise(r => { opened = r; }); const api = new Spotify({ vault: vault(), redirect: uri, open: async () => opened() }); const connecting = api.connect(); await started; api.dispose(); await assert.rejects(connecting, /cancelled/); const server = http.createServer(); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(new URL(uri).port, '127.0.0.1', resolve); }); await new Promise(r => server.close(r));
});
