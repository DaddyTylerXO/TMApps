'use strict';
// Public desktop OAuth client. No client secret is used or distributed.
const crypto = require('node:crypto');
const http = require('node:http');
const CLIENT_ID = 'abc7cf7d00604cf7afd861e163c8be29';
const REDIRECT = 'http://127.0.0.1:43823/spotify/callback';
const scopes = 'user-read-playback-state user-modify-playback-state';
const challenge = verifier => crypto.createHash('sha256').update(verifier).digest('base64url');
class Spotify {
  constructor({ vault, open, fetch: request = globalThis.fetch, redirect = REDIRECT }) { this.vault = vault; this.open = open; this.fetch = request; this.redirect = redirect; this.session = null; this.retryAt = 0; this.active = null; this.closed = false; }
  async status() { return { connected: !!(this.session || await this.vault.read()), persistent: this.vault.persistent, clientId: CLIENT_ID, redirect: REDIRECT }; }
  async token(parameters) {
    const response = await this.fetch('https://accounts.spotify.com/api/token', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: CLIENT_ID, ...parameters }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) { if (response.status === 400 || response.status === 401) await this.disconnect(); throw new Error('Spotify authorization failed. Reconnect Spotify and check the developer app settings.'); }
    const result = await response.json(); if (!result.access_token || !result.expires_in) throw new Error('Spotify returned an incomplete authorization response.');
    if (this.closed) throw new Error('Spotify window closed.');
    this.session = { access: result.access_token, expires: Date.now() + result.expires_in * 1000, refresh: result.refresh_token || parameters.refresh_token };
    if (this.session.refresh) await this.vault.write(this.session.refresh);
  }
  async connect() {
    if (this.active) throw new Error('A Spotify sign-in is already open.');
    const verifier = crypto.randomBytes(32).toString('base64url'), state = crypto.randomBytes(32).toString('base64url'), uri = new URL(this.redirect);
    let timeout, finish; const server = http.createServer(); const callback = new Promise((resolve, reject) => { finish = reject; timeout = setTimeout(() => reject(new Error('Spotify sign-in timed out. Try connecting again.')), 180000); server.on('request', (req, res) => {
      let url; try { url = new URL(req.url, this.redirect); } catch { res.writeHead(400).end(); return; }
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.method !== 'GET' || url.pathname !== uri.pathname) { res.writeHead(404).end(); return; }
      if (url.searchParams.get('state') !== state) { res.writeHead(400).end('Sign-in state did not match. Return to TMApps.'); return; }
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Return to your TMA application. You may close this tab.');
      if (url.searchParams.has('error')) reject(new Error('Spotify sign-in was declined.')); else if (!url.searchParams.get('code')) reject(new Error('Spotify did not return an authorization code.')); else resolve(url.searchParams.get('code'));
    }); server.on('error', () => reject(new Error('Spotify sign-in port is busy. Finish sign-in in the other TMA app, then try again.'))); });
    callback.catch(() => {});
    this.active = () => finish(new Error('Spotify sign-in cancelled.'));
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(uri.port), '127.0.0.1', resolve); });
      const auth = new URL('https://accounts.spotify.com/authorize'); auth.search = new URLSearchParams({ client_id: CLIENT_ID, response_type: 'code', redirect_uri: this.redirect, state, scope: scopes, code_challenge_method: 'S256', code_challenge: challenge(verifier) }).toString();
      await this.open(auth.href); const code = await callback;
      await this.token({ grant_type: 'authorization_code', code, redirect_uri: this.redirect, code_verifier: verifier });
      return this.status();
    } finally { clearTimeout(timeout); this.active = null; server.closeAllConnections(); server.close(); callback.catch(() => {}); }
  }
  async access() {
    if (this.session && this.session.expires > Date.now() + 60000) return this.session.access;
    const refresh = this.session?.refresh || await this.vault.read(); if (!refresh) throw new Error('Connect Spotify first.');
    await this.token({ grant_type: 'refresh_token', refresh_token: refresh }); return this.session.access;
  }
  async request(path, method = 'GET') {
    if (Date.now() < this.retryAt) throw new Error('Spotify is rate limiting requests. Please wait before refreshing.');
    const access = await this.access();
    const response = await this.fetch('https://api.spotify.com/v1/me/player' + path, { method, redirect: 'error', headers: { Authorization: 'Bearer ' + access }, signal: AbortSignal.timeout(20000) });
    if (response.status === 429) { this.retryAt = Date.now() + Math.min(3600, Math.max(30, Number(response.headers.get('retry-after')) || 60)) * 1000; throw new Error('Spotify is busy. Refresh will pause until its retry period ends.'); }
    if (response.status === 401) { this.session = null; throw new Error('Spotify session expired. Refresh once or reconnect.'); }
    if (response.status === 403) throw new Error('Spotify denied access. Check Premium membership and developer-app user access.');
    if (response.status === 404) throw new Error('No active Spotify device. Open Spotify or its web player and start a track.');
    if (!response.ok) throw new Error('Spotify could not complete that request. Try again later.');
    return response.status === 204 ? null : response.json();
  }
  async playback() { const p = await this.request(''); return { connected: true, playing: p?.is_playing === true, title: p?.item?.name || 'No active track', artist: p?.item?.artists?.map(a => a.name).join(', ') || '', device: p?.device?.name || 'Open Spotify and start playback', restricted: p?.device?.is_restricted === true }; }
  async control(action) { if (!['play', 'pause', 'next', 'previous'].includes(action)) throw new Error('Unknown playback action.'); await this.request('/' + action, ['next', 'previous'].includes(action) ? 'POST' : 'PUT'); return this.playback(); }
  async disconnect() { this.active?.(); this.session = null; await this.vault.clear(); return { connected: false }; }
  dispose() { this.closed = true; this.active?.(); this.session = null; }
}
module.exports = { Spotify, CLIENT_ID, REDIRECT, challenge };
