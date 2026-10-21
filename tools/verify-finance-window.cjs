'use strict';
// Development-only CDP verification of a disposable, packaged Finance session.
const fs = require('node:fs/promises');
const [port, screenshot, close] = process.argv.slice(2);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let page;
  for (let i = 0; i < 100; i++) {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()).catch(() => []);
    page = pages.find(p => p.type === 'page' && p.url === 'tma://app/index.html');
    if (page) break;
    await pause(100);
  }
  if (!page) throw Error('Packaged Finance page did not open.');
  const ws = new WebSocket(page.webSocketDebuggerUrl), pending = new Map(); let serial = 0;
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ({ data }) => { const result = JSON.parse(data); if (result.id && pending.has(result.id)) { const { resolve, reject, timer } = pending.get(result.id); clearTimeout(timer); pending.delete(result.id); result.error ? reject(Error(result.error.message)) : resolve(result.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => { pending.delete(id); reject(Error('Finance verification timed out.')); }, 10000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      const result = await call('Runtime.evaluate', { expression: "({ready:document.readyState==='complete' && document.body.innerText.length>500,isolated:typeof require==='undefined' && typeof process==='undefined',protocol:location.protocol})", returnByValue: true });
      const value = result.result.value;
      if (value?.ready) { if (!value.isolated || value.protocol !== 'tma:') throw Error('Finance renderer isolation failed.'); ready = true; break; }
      await pause(100);
    }
    if (!ready) throw Error('Finance did not render its packaged workspace.');
    if (screenshot && screenshot !== '-') { const capture = await call('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(screenshot, Buffer.from(capture.data, 'base64')); }
    if (close === 'close') await call('Runtime.evaluate', { expression: 'setTimeout(()=>window.close(),0);true' });
    process.stdout.write('Packaged Finance workspace rendered with renderer isolation.\n');
  } finally { ws.close(); }
})().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
