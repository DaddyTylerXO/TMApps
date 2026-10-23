'use strict';
(() => {
  const api = window.launcher, $ = id => document.getElementById(id), names = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  let content = { articles: [], apps: {} };
  let state, filter = 'all', busy = false, update, avatar=null;
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const isNewer = (a, b) => { const av = a.split('-')[0].split('.').map(Number), bv = b.split('-')[0].split('.').map(Number); for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return av[i] > bv[i]; return !a.includes('-') && b.includes('-'); };
  const notice = text => { $('notice').textContent = text; };
  const button = (text, callback, primary = false) => { const b = el('button', text, primary ? 'primary' : ''); b.type = 'button'; b.addEventListener('click', () => Promise.resolve(callback()).catch(e => notice(e.message))); return b; };
  function osBadge(key) { const node = el('span', null, 'os-badge'); node.setAttribute('aria-label', `${names[key]} supported`); node.title = `${names[key]} package available`; const icon = el('span'); icon.innerHTML = window.platformIcons[key]; node.append(icon, el('span', names[key])); return node; }
  function render() {
    $('system').textContent = `${names[state.os]} · ${state.arch === 'arm64' ? 'ARM64' : 'Intel / AMD 64-bit'}`;
    $('footer').textContent = `TMApps Launcher ${state.version || '1.9.0'} · DaddyTylerXO · ${names[state.os]} ${state.arch}`;
    const initial = [...(state.profile.displayName || state.profile.emails[0] || '')][0]; $('profile').textContent = initial ? initial.toUpperCase() : '◉'; $('profile').title = state.profile.displayName || 'Your optional profile';if(avatar){const image=el('img');image.src=avatar;image.alt='Your profile photo';$('profile').replaceChildren(image);}
    const view = state.settings.libraryView; $('library').className = view.toLowerCase(); $('list').setAttribute('aria-pressed', String(view === 'List')); $('grid').setAttribute('aria-pressed', String(view === 'Grid'));
    document.documentElement.dataset.theme = state.settings.theme || 'Orange';
    document.documentElement.dataset.platform = state.platform; $('shell').dataset.compact = String(state.settings.compactNavigation === true);
    document.querySelectorAll('aside button').forEach((b, i) => { b.title = b.textContent.trim(); b.dataset.glyph = ['▦', '✓', '↻', '↓', '↻', '♫', '●', '?', '⚙', '↗'][i] || '•'; });
    $('shell').className = `edge-${state.settings.navigationEdge.toLowerCase()}`;
    $('all-count').textContent = state.apps.length; $('installed-count').textContent = state.apps.filter(a => a.installed).length; $('updates-count').textContent = state.apps.filter(a => a.installed && isNewer(a.version, a.installed.version)).length; $('notinstalled-count').textContent = state.apps.filter(a => !a.installed).length;
    document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === filter));
    const rank = app => app.id === 'tma-agent-office' ? 2 : app.id === 'tma-socialsmanager' ? 1 : 0;
    const ordered = [...state.apps].sort((a, b) => rank(a) - rank(b));
    const term = $('search').value.toLowerCase(); const apps = ordered.filter(a => `${a.name} ${a.description}`.toLowerCase().includes(term)).filter(a => filter === 'all' || filter === 'installed' && a.installed || filter === 'notinstalled' && !a.installed || filter === 'updates' && a.installed && isNewer(a.version, a.installed.version));
    $('library').replaceChildren(); $('empty').hidden = apps.length > 0;
    for (const app of apps) {
      const card = el('article', null, `card${app.id === 'tma-finance' ? ' finance' : app.id === 'tma-libraries' ? ' libraries' : ''}${app.id === 'tma-agent-office' ? ' office' : app.id === 'tma-cut' ? ' cut' : app.id === 'tma-safe' ? ' safe' : app.id === 'tma-padlock' ? ' padlock' : app.id === 'tma-socialsmanager' ? ' socials' : ''}`); card.dataset.id = app.id;
      card.append(el('div', `${String(ordered.indexOf(app) + 1).padStart(2, '0')} / ${app.id === 'tma-mail' ? 'MAIL & COMMUNICATION' : app.id === 'tma-socialsmanager' ? 'YOUR SOCIAL WORKSPACE' : app.id === 'tma-padlock' ? 'YOUR AUTHENTICATORS' : app.id === 'tma-safe' ? 'YOUR PRIVATE SPACE' : app.id === 'tma-agent-office' ? 'YOUR AI TEAM' : app.category.toUpperCase()}`, 'card-head'));
      const body = el('div', null, 'card-body'), info = el('div', null, 'app-info'), meta = el('div', null, 'app-meta');
      const icon = el('div', app.id === 'tma-libraries' ? '?' : app.id === 'tma-mail' ? null : app.id === 'tma-socialsmanager' ? null : app.id === 'tma-padlock' ? '▦' : app.id === 'tma-safe' ? '⚿' : '♧', 'app-icon');
      if (app.id === 'tma-finance' || app.id === 'tma-libraries' || app.id === 'tma-cut' || app.id === 'tma-mail' || app.id === 'tma-padlock' || app.id === 'tma-safe' || app.id === 'tma-socialsmanager') { icon.replaceChildren(); icon.classList.add('app-image'); const image = el('img'); image.src = app.id === 'tma-finance' ? '../assets/TMA-Finance.png' : app.id === 'tma-libraries' ? '../assets/TMA-Libraries.png' : app.id === 'tma-cut' ? '../assets/TMA-Cut.png' : app.id === 'tma-mail' ? '../assets/TMA-Mail.png' : app.id === 'tma-safe' ? '../assets/TMA-Safe.png' : app.id === 'tma-socialsmanager' ? '../assets/TMA-SocialsManager.png' : '../assets/TMA-Padlock.png'; image.alt = app.name; icon.append(image); }
      body.append(icon); const title = el('h2'); const titleButton = button(app.name, () => details(app)); titleButton.className = 'app-title'; title.append(titleButton); info.append(title, el('p', app.description));
      const badges = el('div', null, 'support'); badges.setAttribute('aria-label', 'Supported operating systems'); app.support.forEach(key => badges.append(osBadge(key))); if (!app.support.length) badges.append(el('small', 'No published packages yet')); info.append(badges); body.append(info);
      const unavailable = !app.package && !app.installed, comingSoon = !app.support.length && unavailable;
      const status = comingSoon ? 'COMING SOON' : unavailable ? state.platform==='win32' ? 'USE THE NATIVE WINDOWS EDITION' : `NOT AVAILABLE FOR ${names[state.os].toUpperCase()} ${state.arch.toUpperCase()}` : app.installed ? (isNewer(app.version, app.installed.version) ? 'UPDATE AVAILABLE' : 'INSTALLED · UP TO DATE') : 'READY TO INSTALL';
      meta.append(el('p', status, 'status'), el('p', comingSoon ? 'Version not published' : `v${app.version}${app.installed ? ` · Installed v${app.installed.version}` : ''}`, 'version'));
      const date = new Date(app.updatedAt || NaN); meta.append(el('p', `Updated ${isNaN(date) ? 'date not published' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, 'version'));
      const actions = el('div', null, 'actions'); const primary = button(comingSoon ? 'Coming soon' : unavailable ? 'Not available on this OS' : app.installed ? (isNewer(app.version, app.installed.version) ? '↓ Update app' : '↗ Open app') : '↓ Install app', () => app.installed && !isNewer(app.version, app.installed.version) ? api.open(app.id) : install(app), true); primary.disabled = busy || unavailable;
      if (comingSoon) primary.title = 'This application is in development.'; else if (unavailable) primary.title = 'No compatible package has been published. The icons show which operating systems currently have builds.';
      actions.append(primary);
      const menu = el('details'), summary = el('summary', '•••'); summary.setAttribute('aria-label', `${app.name} options`); const items = el('div', null, 'menu-items');
      const open = button('Open application', () => api.open(app.id)); open.disabled = busy || !app.installed; items.append(open, button('View source on GitHub ↗', () => api.source(app.id)));
      const remove = button('Uninstall…', () => uninstall(app)); remove.disabled = busy || !app.installed; items.append(remove); menu.append(summary, items); actions.append(menu); meta.append(actions); const detail = button('Details', () => details(app)); detail.className = 'app-details'; meta.append(detail); body.append(meta); card.append(body); $('library').append(card);
    }
    $('refresh').disabled = busy; $('settings').disabled = busy; $('profile').disabled = busy;
    $('release-update').hidden = !update; if (update) $('release-text').textContent = `Launcher ${update.version} is available.`;
  }
  function modal(title, message, action, build = () => {}, submit = async () => true) {
    return new Promise(resolve => {
      const dialog = el('dialog'), header = el('div', title, 'dialog-header'), body = el('div', null, 'dialog-body'), footer = el('div', null, 'dialog-actions'), error = el('p', '', 'dialog-error');
      body.append(el('p', message)); const controls = build(body) || {}; body.append(error);
      const finish = value => { dialog.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); dialog.close(); dialog.remove(); resolve(value); };
      const cancel = button('Cancel', () => finish(false)), primary = button(action, async () => { try { if (await submit(controls) !== false) finish(true); } catch (e) { error.textContent = e.message; } }, true);
      footer.append(cancel, primary); dialog.append(header, body, footer); dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); }); document.body.append(dialog); dialog.showModal();
    });
  }
  function field(body, label, value, kind = 'input') { const id = 'field-' + Math.random().toString(36).slice(2), caption = el('label', label), input = el(kind); caption.htmlFor = id; input.id = id; input.value = value || ''; body.append(caption, input); return input; }
  function check(body, label, value) { const row = el('label', null, 'check'), input = el('input'); input.type = 'checkbox'; input.checked = value; row.append(input, document.createTextNode(label)); body.append(row); return input; }
  async function operation(title, job, canCancel=true) {
    busy = true; render(); const dialog = el('dialog'), body = el('div', null, 'dialog-body'), status = el('p', 'Preparing…'), actions = el('div', null, 'dialog-actions');
    const cancel = button('Cancel download', () => api.cancel()); cancel.disabled=!canCancel; const progress=el('progress');progress.setAttribute('aria-label',title+' progress');body.append(status,progress); actions.append(cancel); dialog.append(el('div', title, 'dialog-header'), body, actions); document.body.append(dialog);
    dialog.addEventListener('cancel', e => { e.preventDefault(); if(canCancel) api.cancel(); }); dialog.showModal();
    const unsubscribe = api.onProgress(text => { status.textContent = text; });
    try { const result = await job(); if (result?.apps) state = result; if (result?.notice || result?.warning) notice(result.notice || result.warning); else notice('Operation completed.'); }
    catch (e) { notice(e.message); }
    finally { unsubscribe(); dialog.close(); dialog.remove(); busy = false; state = await api.snapshot(); content = api.experience ? await api.experience() : content; render(); }
  }
  async function install(app) {
    let options = {};
    const approved = app.installed ? await modal(`Update ${app.name}?`, 'Update in the saved application folder? Your startup/desktop choices and app data will be kept.', 'Update app') : await modal(`Install ${app.name}`, 'Choose an empty folder for this app. Updates will use the same location.', 'Install app', body => {
      const location = field(body, 'Installation folder (leave blank for the default)', ''); location.placeholder = 'Default application folder';
      const browse = button('Browse…', async () => { const value = await api.choose(); if (value) location.value = value; }); const browseRow=el('div',null,'browse-row');location.replaceWith(browseRow);browseRow.append(location,browse);
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
    await modal('Your TMApps profile', 'Optional. Save your name, email addresses, and social accounts for your apps on this device.', 'Save profile', body => {
      if (api.auth) body.append(button('TMApps sign-in and linked apps', signIn));
      let photo=avatar;const preview=el('img',null,'profile-photo-preview');preview.alt='Optional profile photo';preview.hidden=!photo;if(photo)preview.src=photo;body.append(preview);
      if(api.photo){body.append(button('Choose profile photo',async()=>{const selected=await api.photo({action:'choose'});if(selected){photo=selected;preview.src=photo;preview.hidden=false;}}),button('Remove photo',()=>{photo=null;preview.hidden=true;preview.removeAttribute('src');}),el('p','Your cropped profile photo is saved on this device when you save the profile. It is not sent to providers or other apps.'));}
      const name = field(body, 'Your name', state.profile.displayName); name.maxLength = 100;
      const emailRows=el('div',null,'email-rows'), emails=[];body.append(el('h3','Email addresses'),emailRows);
      const addEmail=button('+ Add email address',()=>addEmailRow(''));addEmail.dataset.action='add-email';
      function addEmailRow(value){if(emails.length>=20)return;const row=el('div',null,'email-row'),input=field(row,'Email address',value);input.type='email';input.maxLength=254;input.autocomplete='email';emails.push(input);row.append(button('Remove',()=>{emails.splice(emails.indexOf(input),1);row.remove();addEmail.disabled=false;}));emailRows.append(row);addEmail.disabled=emails.length>=20;}
      (state.profile.emails.length?state.profile.emails:['']).forEach(addEmailRow);body.append(addEmail);
      const allShare=check(body,'Autofill compatible TMA app profiles on this device',state.profile.shareWithApps !== false); body.append(el('p','Compatible profile icons use your name and primary email as suggestions. Local app edits and connected account identities are preserved. Support reaches companion downloads with their next releases.'));
      const mailShare = check(body, 'Sync name and emails to TMA-Mail when supported on this device', state.profile.shareWithMail);
      body.append(el('p', 'TMA-Mail is currently Windows-only. Its name/email sync works on Windows with a compatible Mail version. A profile does not connect accounts: app-specific passwords/keys or provider sign-in are still required in Mail. Never enter credentials here.'));
      body.append(el('h3', 'Social accounts (optional)'), el('p', 'Save usernames or public profile URLs for later use in TMA-SocialsManager and TMA-Cut. This does not connect or sign in to an account. Integration will be available when those apps support it; you will approve sign-in inside each app. Do not enter passwords, API keys, or access tokens here.'));
      const rows = el('div', null, 'social-accounts'), entries = [];
      const add = button('+ Add social account', () => addRow({})); add.dataset.action = 'add-social-account';
      function addRow(value) {
        if (entries.length >= 20) return;
        const row = el('div', null, 'social-account-row');
        const platform = field(row, 'Platform (for example, Instagram, YouTube, or TikTok)', value.platform), account = field(row, 'Username or profile URL', value.account); platform.maxLength = 40; account.maxLength = 300;
        const entry = { platform, account }; entries.push(entry);
        row.append(button('Remove account', () => { entries.splice(entries.indexOf(entry), 1); row.remove(); add.disabled = false; })); rows.append(row); add.disabled = entries.length >= 20;
      }
      (state.profile.socialAccounts || []).forEach(addRow); body.append(rows, add);
      const socialShare = check(body, 'Make social accounts available to TMA-SocialsManager and TMA-Cut when supported', state.profile.shareWithSocialApps);
      body.append(el('p', 'Saved locally for this user. Sharing is optional and does not send data to a social network. Turning it off stops future sharing; it does not disconnect accounts already connected inside another app.'));
      if (state.profile.warning) body.append(el('p', state.profile.warning, 'dialog-error'));
      return { name, emails, allShare, mailShare, socialShare, entries,photo:()=>photo };
    }, async fields => { state = await api.profile({ schemaVersion: 1, displayName: fields.name.value, emails: fields.emails.map(e=>e.value).filter(Boolean), shareWithApps: fields.allShare.checked, shareWithMail: fields.allShare.checked && fields.mailShare.checked, socialAccounts: fields.entries.map(e => ({ platform: e.platform.value, account: e.account.value })), shareWithSocialApps: fields.allShare.checked && fields.socialShare.checked });if(api.photo)avatar=await api.photo({action:'save',data:fields.photo()}); render(); notice('Optional profile saved locally. Future social app linking will require sign-in inside each app.'); });
  }
  async function signIn() {
    let status = await api.auth({ action: 'status' });
    await modal('TMApps sign-in and linked apps', status.configured ? 'Sign in with an email code, then allow selected compatible apps to reuse your TMApps identity. This does not connect mailbox or social-network accounts.' : 'The TMApps sign-in service is prepared but not configured. The operator must deploy it and supply the project URL and public key. Separate app/provider sign-ins remain available.', 'Close', body => {
      if (status.warning) body.append(el('p', status.warning, 'dialog-error'));
      const summary = el('p', status.email ? `Signed in as ${status.email}` : 'Not signed in.'); body.append(summary);
      if (!status.persistent) body.append(el('p', 'No secure OS keyring is available. This session is kept only in memory and ends when the launcher exits.'));
      const email = field(body, 'Email address', status.email || state.profile.emails[0] || ''), code = field(body, 'Email verification code', ''); code.autocomplete = 'one-time-code';
      const error = el('p', '', 'dialog-error'), entries = [];
      const send = button('Send sign-in code', async () => { try { const result = await api.auth({ action: 'send', email: email.value }); error.textContent = result.notice; } catch(e) { error.textContent = e.message; } }); send.disabled = !status.configured; body.append(send);
      const verify = button('Verify code', async () => { try { status = await api.auth({ action: 'verify', email: email.value, code: code.value }); summary.textContent = `Signed in as ${status.email}`; code.value = ''; error.textContent = 'Verified. Select apps and save access.'; entries.forEach(e => { e.input.checked = status.allowedApps.includes(e.id); }); } catch(e) { error.textContent = e.message; } }); verify.disabled = !status.configured; body.append(verify, el('h3', 'Selected app access'));
      state.apps.forEach(app => { const input = check(body, app.name, status.allowedApps.includes(app.id)); entries.push({ id: app.id, input }); });
      body.append(el('p', 'Apps must implement the prepared handoff contract before they can reuse sign-in. Revoking access blocks future handoffs and app-session checks. Provider credentials stay in each app.'));
      const save = button('Save app access', async () => { try { status = await api.auth({ action: 'access', apps: entries.filter(e => e.input.checked).map(e => e.id) }); error.textContent = 'App access saved.'; } catch(e) { error.textContent = e.message; } }); save.disabled = !status.configured; body.append(save, button('Sign out of launcher', async () => { try { status = await api.auth({ action: 'logout' }); summary.textContent = 'Not signed in.'; } catch(e) { error.textContent = e.message; } }), error);
    });
  }
  const matches = (text, query) => query.toLowerCase().split(/\s+/).filter(Boolean).every(word => text.toLowerCase().includes(word));
  const media = value => { try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/DaddyTylerXO/TMApps/') && !u.username && !u.password; } catch { return false; } };
  async function details(app) {
    const entry=content.apps[app.id]||{},updated=new Date(app.updatedAt||NaN);
    await modal(app.name,`Version ${app.version} · Updated ${Number.isNaN(updated.getTime())?'date not published':updated.toLocaleDateString()}`,'Close',body=>{
      body.closest('dialog')?.classList.add('app-showcase');body.classList.add('showcase-body');
      const hero=el('div',null,'showcase-hero'),icon=document.querySelector(`[data-id="${app.id}"] .app-icon`)?.cloneNode(true),intro=el('div');if(icon)hero.append(icon);intro.append(el('h2',app.name),el('p',app.description));hero.append(intro);body.append(hero);
      const actions=el('div',null,'showcase-actions');const installed=app.installed,updatable=installed&&isNewer(app.version,installed.version);const open=button(installed&&!updatable?'Open app':updatable?'Update app':'Install app',()=>installed&&!updatable?api.open(app.id):install(app),true);open.disabled=busy||(!app.package&&!installed);actions.append(open,button('GitHub ↗',()=>api.source(app.id)));if(api.releases)actions.append(button('Releases ↗',()=>api.releases()));for(const [kind,label] of [['feature','Feature request'],['bug','Bug report'],['issue','Issue report']])actions.append(button(label,()=>api.support(kind,'',app.id)));actions.append(button('Help',help));body.append(actions);
      const columns=el('div',null,'showcase-columns'),gallery=el('section',null,'showcase-gallery'),features=el('section',null,'showcase-features');columns.append(gallery,features);body.append(columns);
      const shots=(entry.screenshots||[]).filter(x=>media(x.url)).slice(0,10);
      if(shots.length){let selected=0;const image=el('img',null,'showcase-image'),caption=el('p'),thumbs=el('div',null,'showcase-thumbs');image.decoding='async';const show=i=>{selected=(i+shots.length)%shots.length;image.src=shots[selected].url;image.alt=shots[selected].caption||app.name;caption.textContent=`${selected+1} / ${shots.length} · ${shots[selected].caption||''}`;[...thumbs.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===selected)));};shots.forEach((shot,i)=>{const b=button('',()=>show(i)),thumb=el('img');b.setAttribute('aria-label',`Screenshot ${i+1}: ${shot.caption||app.name}`);thumb.src=shot.url;thumb.alt='';thumb.loading='lazy';b.append(thumb);thumbs.append(b);});gallery.append(image,caption,button('← Previous screenshot',()=>show(selected-1)),button('Next screenshot →',()=>show(selected+1)),thumbs);show(0);}else gallery.append(el('p','Screenshots will appear here when published.'));
      if(media(entry.video)){const video=el('video');video.src=entry.video;video.controls=true;video.preload='none';video.setAttribute('aria-label',app.name+' showcase');gallery.append(video);}
      features.append(el('h3','Features'));for(const text of [app.description,`Published support: ${app.support.map(x=>names[x]).join(', ')||'Coming soon'}`,'Install and update from your application library. Review the release notes for preview limitations.']){const box=el('section',null,'feature-card');box.append(el('p',text));features.append(box);}
      body.append(el('h3','Latest release'),el('pre',entry.releaseNotes||'Release notes have not been published yet.','release-notes'));
      queueMicrotask(()=>body.closest('dialog')?.classList.add('app-showcase'));
    });
  }
  async function serviceStatus(){
    await modal('Service Status','API Checkers test public endpoint reachability from this device. Green does not verify an account, subscription or provider permission. No credentials are sent. Nothing is checked in the background.','Close',body=>{
      body.append(el('h3','API Checkers'));let active=true;const notice=el('p','Not checked yet.'),rows=el('div');body.append(notice,rows);
      const associations=state.apps.map(app=>({name:app.name,ids:app.id==='tma-mail'?['github','microsoft','google','spotify']:['github','spotify']}));
      const draw=results=>{rows.replaceChildren();for(const app of associations){const section=el('section',null,'feature-card');section.append(el('h3',app.name));for(const id of app.ids){const result=results?.find(x=>x.id===id),row=el('p',null,'service-row'),light=el('span',null,'status-light '+(!result?'unchecked':result.working?'working':'broken'));light.setAttribute('aria-label',!result?'Not checked':result.working?'Reachable':'Unavailable');row.append(light,document.createTextNode(result?.name||{github:'GitHub downloads and API',spotify:'Spotify Web API (suite integration)',microsoft:'Microsoft sign-in',google:'Google sign-in'}[id]));if(result)row.append(el('small',result.detail));section.append(row);}section.append(el('small','Provider-specific account checks and any additional integrations remain inside the app. Spotify support in companion downloads follows their own releases.'));rows.append(section);}};draw();const refresh=button('Check APIs now',async()=>{refresh.disabled=true;notice.textContent='Checking public services…';try{const result=await api.status();if(!body.isConnected)return;draw(result);notice.textContent='Last checked '+new Date().toLocaleTimeString();}finally{refresh.disabled=false;}});body.insertBefore(refresh,notice);
    });
  }
  async function help() {
    await modal('Help and KB Library', 'Search guides, setup information, and troubleshooting by keyword or KB number.', 'Close', body => {
      const search = field(body, 'Search KB Library', ''); const results = el('div'); body.append(results);
      const render = () => { results.replaceChildren(); content.articles.filter(a => matches(`${a.id} ${a.title} ${a.keywords} ${a.body}`, search.value)).forEach(a => results.append(button(`${a.id} · ${a.title}`, () => modal(`${a.id} · ${a.title}`, a.body, 'Close')))); }; search.addEventListener('input', render); render();
      for (const [kind, label] of [['feature','Feature request'],['bug','Bug report'],['issue','Issue report']]) body.append(button(label, () => api.support(kind)));
      body.append(button('Review crash report', crashReport)); if (api.knowledgeDocument) body.append(button('Download KB Library Word document', () => api.knowledgeDocument()));
    });
  }
  async function crashReport() {
    const report = await api.crash();
    await modal('Review crash report', 'Review and edit this draft. Upload opens a GitHub issue form; you sign in and submit it there. Nothing is sent automatically.', 'Upload to GitHub Issues…', body => { const draft = field(body, 'Report draft', report, 'textarea'); draft.rows = 14; return { draft }; }, async c => { await api.support('crash', c.draft.value); });
  }
  async function settings() {
    const result = await modal('Your workspace', 'Search settings or KB numbers. Appearance previews immediately; Cancel restores it.', 'Save changes', body => {
      const search = field(body, 'Search settings', ''), tabs = el('nav', null, 'settings-tabs'), groups = []; tabs.setAttribute('aria-label', 'Settings sections'); body.append(tabs); let active = 'Appearance';
      const group = (title, keywords) => { const block = el('section', null, 'settings-section'); block.dataset.keywords = title + ' ' + keywords; block.dataset.section = title; block.append(el('h3', title)); body.append(block); groups.push(block); return block; };
      const appearance = group('Appearance', 'theme dark grey gray black orange colour color navigation view list grid');
      const edge = field(appearance, 'Navigation position', '', 'select'); ['Left', 'Right', 'Top', 'Bottom'].forEach(v => edge.append(new Option(v, v))); edge.value = state.settings.navigationEdge;
      const view = field(appearance, 'Library view', '', 'select'); ['List', 'Grid'].forEach(v => view.append(new Option(v, v))); view.value = state.settings.libraryView;
      const theme = field(appearance, 'Dark palette', '', 'select'); ['Orange', 'Grey', 'Black'].forEach(v => theme.append(new Option(v, v))); theme.value = state.settings.theme || 'Orange'; theme.addEventListener('change', () => { document.documentElement.dataset.theme = theme.value; });
      const compact = check(appearance, 'Compact Navigation Bar', state.settings.compactNavigation === true); appearance.append(button('Spotify playback modes and account', () => api.spotify()));
      const performance = group('Startup and performance', 'cpu gpu ram memory network boot startup tray update background');
      const startup = check(performance, 'Open launcher on sign-in', state.settings.runAtStartup), tray = check(performance, 'Stay in the tray when closed (requires desktop tray support)', state.settings.closeToTray), updates = check(performance, 'Check apps and launcher for updates at startup', state.settings.checkOnStartup);
      performance.append(el('p', 'Startup affects boot time. Tray mode keeps RAM in use; Quit releases it. Updates briefly use CPU and network. Screenshots load only in Details. Playing a video uses RAM, CPU/GPU decoding and network; close Details to stop it. See Launcher-KB6.'));
      const support = group('Help and KB Library', 'knowledge kb guides help search reports'); const kb = check(support, 'Include KB articles in settings search', state.settings.includeKbSearch !== false); support.append(button('Open KB Library and support', help), button('Review crash report', crashReport));
      const results = el('div'); body.append(results); const filter = () => { groups.forEach(g => { g.hidden = search.value.trim() ? !matches(g.dataset.keywords + ' ' + g.textContent, search.value) : g.dataset.section !== active; }); tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(!search.value.trim() && b.textContent === active))); results.replaceChildren(); if (kb.checked && search.value.trim()) content.articles.filter(a => matches(`${a.id} ${a.title} ${a.keywords} ${a.body}`, search.value)).forEach(a => results.append(button(`${a.id} · ${a.title}`, () => modal(`${a.id} · ${a.title}`, a.body, 'Close')))); };
      groups.forEach(g => tabs.append(button(g.dataset.section, () => { active = g.dataset.section; search.value = ''; filter(); }))); search.addEventListener('input', filter); kb.addEventListener('change', filter); filter();
      return { edge, view, theme, compact, startup, tray, updates, kb };
    }, async c => { state = await api.settings({ ...state.settings, navigationEdge: c.edge.value, libraryView: c.view.value, theme: c.theme.value, compactNavigation: c.compact.checked, includeKbSearch: c.kb.checked, runAtStartup: c.startup.checked, closeToTray: c.tray.checked, checkOnStartup: c.updates.checked }); render(); notice('Settings saved.'); });
    if (!result) document.documentElement.dataset.theme = state.settings.theme || 'Orange';
  }
  async function refresh() { if (busy) return; busy = true; render(); notice('Checking apps and launcher…'); try { const result = await api.refresh(); state = result; update = result.update; notice(result.notice); } catch (e) { notice(e.message); } finally { busy = false; render(); } }
  const ready = (async () => {
    state = await api.snapshot();content=api.experience?await api.experience():content;if(api.photo)avatar=await api.photo({action:'read'}); render(); notice(state.platform==='win32' ? 'This is the macOS/Linux client preview. Use TMApps-Launcher-Setup.exe for the full Windows edition.' : `Showing published app support. Windows-only apps cannot be installed on ${names[state.os]} until a compatible package is published.`);
    $('search').addEventListener('input', render); $('refresh').addEventListener('click', refresh); $('settings').addEventListener('click', settings); $('profile').addEventListener('click', profile); $('github').addEventListener('click', () => api.source()); $('help').addEventListener('click', help); $('spotify').addEventListener('click', () => api.spotify());$('status').addEventListener('click',serviceStatus);
    document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
    for (const [id, view] of [['list', 'List'], ['grid', 'Grid']]) $(id).addEventListener('click', async () => { try { state = await api.settings({ ...state.settings, libraryView: view }); render(); } catch (e) { notice(e.message); } });
    $('launcher-update').addEventListener('click', async () => { if (await modal('Update TMApps Launcher?', state.platform === 'darwin' ? 'Download and verify the update, then open its disk image. Quit the launcher and replace the app in Applications. Settings and your library are kept.' : 'Download and verify the update, replace this AppImage, and restart? Your profile and library are kept.', state.platform === 'darwin' ? 'Download and open' : 'Update and restart')) await operation('Updating launcher', () => api.update()); });
    api.onPrompt(async prompt => api.answer(prompt.id, await modal(prompt.title, prompt.message, prompt.action))); api.onNotice(notice); api.onRefresh(refresh);
    if (state.settings.checkOnStartup && !state.smoke) refresh();
  })();
  window.launcherSmoke = async () => { await ready; return { ok: true, cards: document.querySelectorAll('.card').length, badges: document.querySelectorAll('.os-badge').length, platform: state.platform, arch: state.arch, nodeAvailable: typeof window.require !== 'undefined' || typeof window.process !== 'undefined' }; };
  if (api.rendererError) { window.addEventListener('error', event => api.rendererError(String(event.error?.stack || event.message)).catch(() => {})); window.addEventListener('unhandledrejection', event => api.rendererError(String(event.reason?.stack || event.reason)).catch(() => {})); }
  window.launcherReady = ready;
})();
