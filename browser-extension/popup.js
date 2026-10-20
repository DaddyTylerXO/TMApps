'use strict';
const api = globalThis.browser || chrome;
const token = document.getElementById('token'), status = document.getElementById('status'), fill = document.getElementById('fill');
// Session-only storage; the code is invalidated whenever the desktop vault locks.
api.storage.session.get('token').then(saved => { token.value = saved.token || ''; });
fill.onclick = async () => {
  fill.disabled = true;
  try {
    if (!/^[a-f\d]{64}$/.test(token.value)) throw Error('Enter the session pairing code from TMA-Safe.');
    const [tab] = await api.tabs.query({ active: true, currentWindow: true }); const url = new URL(tab.url);
    if (url.protocol !== 'https:') throw Error('Open an HTTPS login page first.');
    await api.storage.session.set({ token: token.value }); status.textContent = 'Approve the request in TMA-Safe…';
    const extension = new URL(api.runtime.getURL('')).origin;
    // URL.origin may be "null" for nonstandard extension schemes in some engines.
    const identity = extension === 'null' ? api.runtime.getURL('').replace(/\/$/, '') : extension;
    const response = await fetch('http://127.0.0.1:19473/fill', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.value, 'X-TMA-Extension': identity }, body: JSON.stringify({ origin: url.origin }), signal: AbortSignal.timeout(120000) });
    const login = await response.json(); if (!response.ok) throw Error(login.error); if (login.origin !== url.origin) throw Error('Website changed.');
    const results = await api.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, func: (value, expected) => {
      if (location.origin !== expected || document.visibilityState !== 'visible') return false;
      const visible = input => !input.disabled && !input.readOnly && input.getClientRects().length && getComputedStyle(input).visibility !== 'hidden';
      const passwords = [...document.querySelectorAll('input[type=password]')].filter(visible); if (passwords.length !== 1) return false;
      const password = passwords[0], root = password.form || document;
      if (password.autocomplete === 'new-password') return false;
      const users = [...root.querySelectorAll('input[autocomplete=username],input[type=email],input[type=text],input:not([type])')].filter(visible);
      const user = users.find(e => e.autocomplete === 'username') || users.find(e => e.type === 'email') || users[0];
      const set = (input, text) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
      if (user) set(user, value.username); set(password, value.password); return true;
    }, args: [login, url.origin] });
    login.password = ''; login.username = '';
    if (!results[0]?.result) throw Error('Could not identify one visible login password field. Copy from TMA-Safe instead.'); status.textContent = 'Login filled. Review the website before signing in.';
  } catch (e) { status.textContent = e.message === 'Failed to fetch' ? 'Open and unlock TMA-Safe, then enable browser filling.' : e.message; } finally { fill.disabled = false; }
};
