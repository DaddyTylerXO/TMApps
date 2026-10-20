'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { origin } = require('./vault.cjs');
function startBridge({ approve, unlocked, port = 19473 }) {
  const token = crypto.randomBytes(32).toString('hex'); let busy = false, closed = false; const controller = new AbortController();
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };
    const ext = req.headers.origin || '';
    if (!/^(chrome-extension:\/\/[a-p]{32}|moz-extension:\/\/[a-zA-Z0-9-]{1,80})$/.test(ext) || req.headers.host !== `127.0.0.1:${server.address()?.port}`) { send(403, { error: 'Extension origin required.' }); return; }
    res.setHeader('Access-Control-Allow-Origin', ext); res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); send(204, {}); return; }
    const supplied = Buffer.from(req.headers.authorization || ''), expected = Buffer.from('Bearer ' + token);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) { send(401, { error: 'Pair this browser again from TMA-Safe.' }); return; }
    if (req.method !== 'POST' || req.url !== '/fill' || !unlocked() || closed) { send(403, { error: 'Unlock TMA-Safe and enable browser filling.' }); return; }
    if (busy) { send(429, { error: 'Another fill is awaiting approval.' }); return; } busy = true;
    try {
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) throw Error('Request too large.'); }
      const value = JSON.parse(body); const site = origin(value.origin); if (!site || site !== value.origin) throw Error('An exact HTTPS origin is required.');
      const login = await approve(site, ext, controller.signal); if (closed || !unlocked()) throw Error('Vault is locked.'); send(200, login);
    } catch { send(403, { error: 'Filling was declined, the vault locked, or no matching login exists.' }); } finally { busy = false; }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxConnections = 12;
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); server.on('error', () => {}); resolve({ token, port: server.address().port, close() { closed = true; controller.abort(); server.close(); server.closeAllConnections(); } }); }); });
}
module.exports = { startBridge };
