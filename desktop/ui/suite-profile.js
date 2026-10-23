'use strict';
(() => {
  const api = window.tmappsProfile; if (!api) return;
  let snapshot, pending = false;
  const selectors = '.profile .avatar,.topbar-right>.avatar';
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => [...s][0]).join('').toUpperCase() || '◉';
  const element = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  function apply() {
    if (!snapshot) return;
    document.querySelectorAll(selectors).forEach(avatar => {
      // Finance's synthetic demo identity must remain separate from the personal profile.
      if (avatar.parentElement.textContent.includes('Demo workspace')) return;
      if (snapshot.displayName && avatar.textContent !== initials(snapshot.displayName)) avatar.textContent = initials(snapshot.displayName);
      const label = avatar.nextElementSibling;
      if (label && snapshot.displayName && label.firstChild?.nodeType === 3 && label.firstChild.textContent !== snapshot.displayName) label.firstChild.textContent = snapshot.displayName;
      if (!avatar.closest('button') && !avatar.dataset.suiteProfile) {
        avatar.dataset.suiteProfile = 'true'; avatar.tabIndex = 0; avatar.setAttribute('role', 'button'); avatar.setAttribute('aria-label', 'Your TMA app profile'); avatar.title = 'Your TMA app profile';
        avatar.addEventListener('click', show); avatar.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); show(); } });
      }
    });
    document.querySelectorAll('[data-tmapps-profile-form] input[data-profile-field]').forEach(input => {
      if (input.type === 'password') return;
      const key = input.dataset.profileField, value = key === 'displayName' ? snapshot.displayName : key === 'email' ? snapshot.email : '';
      if (value && (!input.value || input.value === input.dataset.lastSuggested)) { input.value = value; input.dataset.lastSuggested = value; }
    });
  }
  async function refresh() { if (pending) return; pending = true; try { snapshot = await api.read(); apply(); } catch { /* Optional suggestions cannot block the app. */ } finally { pending = false; } }
  async function show() {
    if (document.querySelector('dialog.tmapps-profile')) return;
    await refresh(); const dialog = element('dialog'); dialog.className = 'tmapps-profile';
    dialog.append(element('h2', 'Your TMA app profile'), element('p', 'Launcher profile suggestions fill empty fields and update previously imported values. Edits saved here stay in this app. Provider accounts still need their own sign-in.'));
    const fields = {};
    for (const [key, caption] of [['displayName', 'Your name'], ['email', 'Email address']]) { const label = element('label', caption), input = element('input'); input.value = snapshot?.[key] || ''; input.maxLength = key === 'displayName' ? 100 : 254; input.type = key === 'email' ? 'email' : 'text'; label.append(input); dialog.append(label); fields[key] = input; }
    dialog.append(element('p', snapshot?.sharing ? 'Profile autofill is enabled in TMApps Launcher. Shared suggestions stay on this device.' : 'Launcher autofill is off or no shared profile is available. Your local app profile is kept.'));
    const error = element('p'), actions = element('div'); actions.className = 'tmapps-profile-actions';
    const close = element('button', 'Cancel'), save = element('button', 'Save profile'); close.type = save.type = 'button'; close.onclick = () => dialog.close();
    save.onclick = async () => { save.disabled = true; try { snapshot = await api.save({ displayName: fields.displayName.value, email: fields.email.value }); apply(); dialog.close(); } catch (e) { error.textContent = e.message; } finally { save.disabled = false; } };
    const help=element('button','Profile setup guide');help.type='button';help.onclick=async()=>{try{await api.help();}catch{error.textContent='The profile guide could not be opened.';}};actions.append(help, close, save); dialog.append(error, actions); dialog.addEventListener('close', () => dialog.remove()); document.body.append(dialog); dialog.showModal();
  }
  const active=()=>!!document.querySelector('[data-tmapps-profile-form]')||[...document.querySelectorAll(selectors)].some(a=>!a.parentElement.textContent.includes('Demo workspace'));
  function start() { if(active())refresh(); const observer = new MutationObserver(records => { if (records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches(selectors+', [data-tmapps-profile-form]') || n.querySelector(selectors+', [data-tmapps-profile-form]')))) && active()) {if(snapshot)apply();else refresh();} }); observer.observe(document.body, { childList: true, subtree: true }); window.addEventListener('focus', ()=>{if(active())refresh();}); window.addEventListener('beforeunload', () => observer.disconnect()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
