'use strict';
(() => {
  const api = window.launcher, $ = id => document.getElementById(id), names = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  let state, filter = 'all', busy = false, update;
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const isNewer = (a, b) => { const av = a.split('-')[0].split('.').map(Number), bv = b.split('-')[0].split('.').map(Number); for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i]; return !a.includes('-') && b.includes('-'); };
  const notice = text => { $('notice').textContent = text; };
  const button = (text, callback, primary = false) => { const b = el('button', text, primary ? 'primary' : ''); b.type = 'button'; b.addEventListener('click', () => Promise.resolve(callback()).catch(e => notice(e.message))); return b; };
  function osBadge(key) { const node = el('span', null, 'os-badge'); node.setAttribute('aria-label', `${names[key]} supported`); node.title = `${names[key]} package available`; const icon = el('span'); icon.innerHTML = window.platformIcons[key]; node.append(icon, el('span', names[key])); return node; }
  function render() {
    $('system').textContent = `${names[state.os]} · ${state.arch === 'arm64' ? 'ARM64' : 'Intel / AMD 64-bit'}`;
    $('footer').textContent = `TMApps Launcher ${state.version || '1.9.0'} · DaddyTylerXO · ${names[state.os]} ${state.arch}`;
    const initial = [...(state.profile.displayName || state.profile.emails[0] || '')][0]; $('profile').textContent = initial ? initial.toUpperCase() : '◉'; $('profile').title = state.profile.displayName || 'Your optional profile';
    const view = state.settings.libraryView; $('library').className = view.toLowerCase(); $('list').setAttribute('aria-pressed', String(view === 'List')); $('grid').setAttribute('aria-pressed', String(view === 'Grid'));
    $('shell').className = `edge-${state.settings.navigationEdge.toLowerCase()}`;
    $('all-count').textContent = state.apps.length; $('installed-count').textContent = state.apps.filter(a => a.installed).length; $('updates-count').textContent = state.apps.filter(a => a.installed && isNewer(a.version, a.installed.version)).length; $('notinstalled-count').textContent = state.apps.filter(a => !a.installed).length;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    const term = $('search').value.toLowerCase(); const apps = state.apps.filter(a => `${a.name} ${a.description}`.toLowerCase().includes(term)).filter(a => filter === 'all' || filter === 'installed' && a.installed || filter === 'notinstalled' && !a.installed || filter === 'updates' && a.installed && isNewer(a.version, a.installed.version));
    $('library').replaceChildren(); $('empty').hidden = apps.length > 0;
    for (const app of apps) {
      const card = el('article', null, `card${app.id === 'tma-agent-office' ? ' office' : app.id === 'tma-safe' ? ' safe' : app.id === 'tma-padlock' ? ' padlock' : ''}`); card.dataset.id = app.id;
      card.append(el('div', app.id === 'tma-mail' ? '01 / MAIL & COMMUNICATION' : app.id === 'tma-padlock' ? '04 / YOUR AUTHENTICATORS' : app.id === 'tma-safe' ? '03 / YOUR PRIVATE SPACE' : '02 / YOUR AI TEAM', 'card-head'));
      const body = el('div', null, 'card-body'), info = el('div', null, 'app-info'), meta = el('div', null, 'app-meta');
      body.append(el('div', app.id === 'tma-mail' ? '✉' : app.id === 'tma-padlock' ? '▦' : app.id === 'tma-safe' ? '⚿' : '♧', 'app-icon')); info.append(el('h2', app.name), el('p', app.description));
      const badges = el('div', null, 'support'); badges.setAttribute('aria-label', 'Supported operating systems'); app.support.forEach(key => badges.append(osBadge(key))); if (!app.support.length) badges.append(el('small', 'No published packages yet')); info.append(badges); body.append(info);
      const unavailable = !app.package && !app.installed;
      const status = unavailable ? state.platform==='win32' ? 'USE THE NATIVE WINDOWS EDITION' : `NOT AVAILABLE FOR ${names[state.os].toUpperCase()} ${state.arch.toUpperCase()}` : app.installed ? (isNewer(app.version, app.installed.version) ? 'UPDATE AVAILABLE' : 'INSTALLED · UP TO DATE') : 'READY TO INSTALL';
      meta.append(el('p', status, 'status'), el('p', `v${app.version}${app.installed ? ` · Installed v${app.installed.version}` : ''}`, 'version'));
      const date = new Date(app.updatedAt); meta.append(el('p', `Updated ${isNaN(date) ? 'date not published' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, 'version'));
      const actions = el('div', null, 'actions'); const primary = button(unavailable ? 'Not available on this OS' : app.installed ? (isNewer(app.version, app.installed.version) ? '↓ Update app' : '↗ Open app') : '↓ Install app', () => app.installed && !isNewer(app.version, app.installed.version) ? api.open(app.id) : install(app), true); primary.disabled = busy || unavailable;
      if (unavailable) primary.title = 'No compatible package has been published. The icons show which operating systems currently have builds.';
      actions.append(primary);
      const menu = el('details'), summary = el('summary', '•••'); summary.setAttribute('aria-label', `${app.name} options`); const items = el('div', null, 'menu-items');
      const open = button('Open application', () => api.open(app.id)); open.disabled = busy || !app.installed; items.append(open, button('View source on GitHub ↗', () => api.source(app.id)));
      const remove = button('Uninstall…', () => uninstall(app)); remove.disabled = busy || !app.installed; items.append(remove); menu.append(summary, items); actions.append(menu); meta.append(actions); body.append(meta); card.append(body); $('library').append(card);
    }
    $('refresh').disabled = busy; $('settings').disabled = busy; $('profile').disabled = busy;
    $('release-update').hidden = !update; if (update) $('release-text').textContent = `Launcher ${update.version} is available.`;
  }
  function modal(title, message, action, build = () => {}, submit = async () => true) {
    return new Promise(resolve => {
      const dialog = el('dialog'), header = el('div', title, 'dialog-header'), body = el('div', null, 'dialog-body'), footer = el('div', null, 'dialog-actions'), error = el('p', '', 'dialog-error');
      body.append(el('p', message)); const controls = build(body) || {}; body.append(error);
      const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
      const cancel = button('Cancel', () => finish(false)), primary = button(action, async () => { try { if (await submit(controls) !== false) finish(true); } catch (e) { error.textContent = e.message; } }, true);
      footer.append(cancel, primary); dialog.append(header, body, footer); dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); }); document.body.append(dialog); dialog.showModal();
    });
  }
  function field(body, label, value, kind = 'input') { const id = 'field-' + Math.random().toString(36).slice(2), caption = el('label', label), input = el(kind); caption.htmlFor = id; input.id = id; input.value = value || ''; body.append(caption, input); return input; }
  function check(body, label, value) { const row = el('label', null, 'check'), input = el('input'); input.type = 'checkbox'; input.checked = value; row.append(input, document.createTextNode(label)); body.append(row); return input; }
  async function operation(title, job, canCancel=true) {
    busy = true; render(); const dialog = el('dialog'), body = el('div', null, 'dialog-body'), status = el('p', 'Preparing…'), actions = el('div', null, 'dialog-actions');
    const cancel = button('Cancel download', () => api.cancel()); cancel.disabled=!canCancel; body.append(status); actions.append(cancel); dialog.append(el('div', title, 'dialog-header'), body, actions); document.body.append(dialog);
    dialog.addEventListener('cancel', e => { e.preventDefault(); if(canCancel) api.cancel(); }); dialog.showModal();
    const unsubscribe = api.onProgress(text => { status.textContent = text; });
    try { const result = await job(); if (result?.apps) state = result; if (result?.notice || result?.warning) notice(result.notice || result.warning); else notice('Operation completed.'); }
    catch (e) { notice(e.message); }
    finally { unsubscribe(); dialog.close(); dialog.remove(); busy = false; state = await api.snapshot(); render(); }
  }
  async function install(app) {
    let options = {};
    const approved = app.installed ? await modal(`Update ${app.name}?`, 'Update in the saved application folder? Your startup/desktop choices and app data will be kept.', 'Update app') : await modal(`Install ${app.name}`, 'Choose an empty folder for this app. Updates will use the same location.', 'Install app', body => {
      const location = field(body, 'Installation folder (leave blank for the default)', ''); location.placeholder = 'Default application folder';
      const browse = button('Browse…', async () => { const value = await api.choose(); if (value) location.value = value; }); body.append(browse);
      return { location, startup: check(body, 'Open app on sign-in', false), desktop: check(body, 'Create a desktop icon', true) };
    }, controls => { options = { directory: controls.location.value || undefined, runAtStartup: controls.startup.checked, desktopShortcut: controls.desktop.checked }; });
    if (approved) await operation(`${app.installed ? 'Updating' : 'Installing'} ${app.name}`, () => api.install(app.id, options));
  }
  async function uninstall(app) {
    const folders = await api.data(app.id); let deleteData = false;
    const approved = await modal(`Uninstall ${app.name}`, 'Remove this application. Choose whether its standard local profile is kept or permanently deleted.', 'Uninstall app', body => {
      const group = 'data-' + app.id;
      for (const [text, value] of [['Keep local data (recommended)', false], ['Delete local data permanently', true]]) { const label = el('label', null, 'check'), radio = el('input'); radio.type = 'radio'; radio.name = group; radio.checked = !value; radio.addEventListener('change', () => { deleteData = value; }); label.append(radio, document.createTextNode(text)); body.append(label); }
      body.append(el('p', 'Deletion includes settings, caches, accounts and projects inside these standard folders. External work folders and custom profiles remain. Close other copies before deleting data.'));
      folders.forEach(folder => body.append(el('p', folder)));
    });
    if (approved) await operation(`Uninstalling ${app.name}`, () => api.uninstall(app.id, deleteData),false);
  }
  async function profile() {
    await modal('Your TMApps profile', 'Optional. Save a name and up to 20 email addresses, one per line.', 'Save profile', body => {
      const name = field(body, 'Your name', state.profile.displayName), emails = field(body, 'Email addresses', state.profile.emails.join('\n'), 'textarea'); name.maxLength = 100;
      body.append(el('p', 'TMA-Mail is currently Windows-only. Its name/email sync works on Windows with a compatible Mail version. A profile does not connect accounts: app-specific passwords/keys or provider sign-in are still required in Mail. Never enter credentials here.'));
      return { name, emails };
    }, async fields => { state = await api.profile({ schemaVersion: 1, displayName: fields.name.value, emails: fields.emails.value.split(/\r?\n/).filter(Boolean), shareWithMail: state.profile.shareWithMail === true }); render(); notice('Optional profile saved locally for this user.'); });
  }
  async function settings() {
    await modal('Your workspace', 'Choose where navigation appears and how the launcher starts.', 'Save changes', body => {
      const edge = field(body, 'Navigation position', '', 'select'); ['Left', 'Right', 'Top', 'Bottom'].forEach(v => edge.append(new Option(v, v))); edge.value = state.settings.navigationEdge;
      const view = field(body, 'Library view', '', 'select'); ['List', 'Grid'].forEach(v => view.append(new Option(v, v))); view.value = state.settings.libraryView;
      return { edge, view, startup: check(body, 'Open launcher on sign-in', state.settings.runAtStartup), tray: check(body, 'Stay in the tray when closed (requires desktop tray support)', state.settings.closeToTray), updates: check(body, 'Check apps and launcher for updates at startup', state.settings.checkOnStartup) };
    }, async c => { state = await api.settings({ ...state.settings, navigationEdge: c.edge.value, libraryView: c.view.value, runAtStartup: c.startup.checked, closeToTray: c.tray.checked, checkOnStartup: c.updates.checked }); render(); notice('Settings saved.'); });
  }
  async function refresh() { if (busy) return; busy = true; render(); notice('Checking apps and launcher…'); try { const result = await api.refresh(); state = result; update = result.update; notice(result.notice); } catch (e) { notice(e.message); } finally { busy = false; render(); } }
  const ready = (async () => {
    state = await api.snapshot(); render(); notice(state.platform==='win32' ? 'This is the macOS/Linux client preview. Use TMApps-Launcher-Setup.exe for the full Windows edition.' : `Showing published app support. Windows-only apps cannot be installed on ${names[state.os]} until a compatible package is published.`);
    $('search').addEventListener('input', render); $('refresh').addEventListener('click', refresh); $('settings').addEventListener('click', settings); $('profile').addEventListener('click', profile); $('github').addEventListener('click', () => api.source());
    document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
    for (const [id, view] of [['list', 'List'], ['grid', 'Grid']]) $(id).addEventListener('click', async () => { try { state = await api.settings({ ...state.settings, libraryView: view }); render(); } catch (e) { notice(e.message); } });
    $('launcher-update').addEventListener('click', async () => { if (await modal('Update TMApps Launcher?', state.platform === 'darwin' ? 'Download and verify the update, then open its disk image. Quit the launcher and replace the app in Applications. Settings and your library are kept.' : 'Download and verify the update, replace this AppImage, and restart? Your profile and library are kept.', state.platform === 'darwin' ? 'Download and open' : 'Update and restart')) await operation('Updating launcher', () => api.update()); });
    api.onPrompt(async prompt => api.answer(prompt.id, await modal(prompt.title, prompt.message, prompt.action))); api.onNotice(notice); api.onRefresh(refresh);
    if (state.settings.checkOnStartup && !state.smoke) refresh();
  })();
  window.launcherSmoke = async () => { await ready; return { ok: true, cards: document.querySelectorAll('.card').length, badges: document.querySelectorAll('.os-badge').length, platform: state.platform, arch: state.arch, nodeAvailable: typeof window.require !== 'undefined' || typeof window.process !== 'undefined' }; };
  window.launcherReady = ready;
})();
