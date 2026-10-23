'use strict';
(() => {
  const $ = id => document.getElementById(id); let connected = false, busy = false, timer;
  const call = async (action, value) => { const result = await window.spotify.call(action, value); if (result.error) throw new Error(result.error); return result; };
  function controls() { document.querySelectorAll('button').forEach(b => { b.disabled = busy || (b.id !== 'browser' && b.id !== 'connect' && !connected); }); $('connect').disabled = busy || connected; }
  async function work(job) { if (busy) return; busy = true; controls(); try { await job(); $('notice').textContent = ''; } catch (e) { $('notice').textContent = e.message; } finally { busy = false; controls(); } }
  function display(p) { $('track').textContent = p.title; $('artist').textContent = p.artist; $('device').textContent = p.device; }
  async function refresh() { if (connected && !document.hidden) display(await call('playback')); }
  function modeNote() { $('mode-note').textContent = $('mode').value === 'Browser' ? 'Open the web player in your browser, sign in there, and start a track. These controls operate that active Spotify device. Audio is streamed by your browser.' : 'Start playback in Spotify on your computer, phone or speaker. These controls operate the active device.'; }
  $('mode').addEventListener('change', () => work(async () => { await call('mode', $('mode').value); modeNote(); }));
  $('browser').onclick = () => work(() => call('browser'));
  $('connect').onclick = () => work(async () => { $('notice').textContent = 'Complete sign-in in your browser. Close this window to cancel.'; await call('connect'); connected = true; await refresh(); });
  $('disconnect').onclick = () => work(async () => { await call('disconnect'); connected = false; display({ title: 'Spotify disconnected', artist: '', device: '' }); });
  $('refresh').onclick = () => work(refresh);
  document.querySelectorAll('[data-action]').forEach(b => { b.onclick = () => work(async () => display(await call('control', b.dataset.action))); });
  work(async () => { const s = await call('status'); connected = s.connected; if (s.guide) $('guide').textContent=s.guide.id+' · '+s.guide.title+'\n\n'+s.guide.body; $('mode').value = s.mode; $('app').textContent = s.name; if (/^#[0-9a-f]{6}$/i.test(s.brand)) {document.documentElement.style.setProperty('--brand', s.brand);if(s.brand.toUpperCase()==='#E5B92F')document.documentElement.style.setProperty('--button-ink','#17191F');} if (!s.persistent) $('privacy').textContent += ' No secure OS keyring is available; this sign-in lasts only while the application runs.'; modeNote(); await refresh(); });
  timer = setInterval(() => { if (connected && !busy && !document.hidden) work(refresh); }, 15000); window.addEventListener('beforeunload', () => clearInterval(timer));
})();
