'use strict';
(() => {
  const $ = id => document.getElementById(id), raw = window.safe;
  const api = async (name, value) => { const result = await raw[name](value); if (name === 'lock' || name === 'activity') return result; if (!result.ok) throw Error(result.error); return result.value; };
  const node = (tag, text, className) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e; };
  const notice = text => { $('notice').textContent = text; };
  const button = (text, fn, primary) => { const b = node('button', text, primary ? 'primary' : ''); b.type = 'button'; b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { notice(e.message); } finally { b.disabled = false; } }); return b; };
  let state = null, create = false, view = 'all', editing = null, dirtyPassword = false, generated = '', generatorCleanup, revealTimer, session = 0;
  function locked() {
    session++; state = null; editing = null; generated = ''; generatorCleanup?.(); generatorCleanup = null; clearTimeout(revealTimer);
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    $('entry-form').reset(); $('entry-password').type = 'password'; $('master').value = ''; $('confirm-master').value = ''; $('workspace').hidden = true; $('gate').hidden = false; $('view-content').replaceChildren(); $('generator-modal-content').replaceChildren(); $('notice').textContent = ''; $('master').focus();
  }
  window.addEventListener('safe-locked', locked);
  function mode(value) { create = value; $('open-mode').classList.toggle('active', !value); $('create-mode').classList.toggle('active', value); $('gate-title').textContent = value ? 'Make yourself a safe' : 'Unlock your vault'; $('gate-description').textContent = value ? 'Choose a strong master passphrase. Only you will know it.' : 'A familiar place for the things only you should know.'; $('confirm-label').hidden = !value; $('confirm-master').required = value; $('create-key').hidden = !value; $('master').minLength = value ? 14 : 0; $('unlock-submit').textContent = value ? 'Create encrypted vault →' : 'Unlock vault →'; $('gate-note').textContent = value ? 'There is no password reset. Keep a secure backup of your master password and any key file.' : 'Your master password is required each time you open TMA-Safe.'; $('gate-error').textContent = ''; }
  $('open-mode').onclick = () => mode(false); $('create-mode').onclick = () => mode(true);
  $('use-key').onchange = () => { $('key-controls').hidden = !$('use-key').checked; };
  $('choose-vault').onclick = async () => { try { const name = await api('chooseVault', create); if (name) $('choose-vault').textContent = name; } catch (e) { $('gate-error').textContent = e.message; } };
  for (const [id, method] of [['choose-key', 'chooseKey'], ['create-key', 'createKey']]) $(id).onclick = async () => { try { const name = await api(method); if (name) $('key-name').textContent = name; } catch (e) { $('gate-error').textContent = e.message; } };
  $('unlock-form').onsubmit = async event => {
    event.preventDefault(); const epoch = session; $('unlock-submit').disabled = true; $('gate-error').textContent = '';
    try { const result = await api(create ? 'create' : 'unlock', { password: $('master').value, confirm: $('confirm-master').value, useKey: $('use-key').checked }); if (epoch !== session) return; state = result; $('master').value = ''; $('confirm-master').value = ''; $('gate').hidden = true; $('workspace').hidden = false; view = 'all'; render(); if (state.entries.some(e => e.expired)) notice('Some passwords are due for an update. Open “Due for an update” to review them.'); } catch (e) { $('gate-error').textContent = e.message; } finally { $('unlock-submit').disabled = false; }
  };
  $('lock-button').onclick = () => api('lock');
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; render(); });
  function panel(title, description) { const p = node('section', null, 'panel'); p.append(node('h3', title), node('p', description)); return p; }
  function render() {
    if (!state) return; generatorCleanup?.(); generatorCleanup = null;
    $('all-count').textContent = state.entries.length; $('due-count').textContent = state.entries.filter(e => e.expired).length;
    $('vault-name').textContent = state.file.split(/[\\/]/).pop(); $('add-button').hidden = !['all', 'due'].includes(view);
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const headings = { all: ['YOUR EVERYDAY ESSENTIALS', 'All logins', 'One safe place. A little less to remember.'], due: ['A LITTLE HOUSEKEEPING', 'Due for an update', 'Your reminders, ready when you are.'], generator: ['A FRESH START', 'Password generator', 'Make something strong. Remember one thing less.'], browser: ['YOUR SAFE, WITHIN REACH', 'Browser filling', 'A helping hand, with your permission.'], security: ['PRIVATE BY DESIGN', 'Vault & security', 'Your passwords stay under your control.'] };
    const h = headings[view]; $('view-eyebrow').textContent = h[0]; $('view-title').textContent = h[1]; $('view-description').textContent = h[2]; $('view-content').replaceChildren(); notice('');
    if (['all', 'due'].includes(view)) renderLogins();
    if (view === 'generator') { const p = panel('A password of its own', 'Randomly generated on your device. Every selected character type is included.'); generatorCleanup = makeGenerator(p); $('view-content').append(p); }
    if (view === 'security') renderSecurity();
    if (view === 'browser') renderBrowser();
  }
  function renderLogins() {
    const content = $('view-content'), summary = node('div', null, 'summary');
    for (const [label, count] of [['Saved logins', state.entries.length], ['Update reminders', state.entries.filter(e => e.expiryDays).length], ['Due for an update', state.entries.filter(e => e.expired).length]]) { const stat = node('div', null, 'stat'); stat.append(node('small', label), node('strong', count)); summary.append(stat); } content.append(summary);
    const toolbar = node('div', null, 'toolbar'), search = node('input'); search.type = 'search'; search.placeholder = 'Search your safe…'; search.setAttribute('aria-label', 'Search logins'); toolbar.append(search, node('small', 'PASSWORDS HIDDEN BY DEFAULT')); content.append(toolbar);
    const list = node('div', null, 'login-list'); content.append(list);
    function draw() {
      list.replaceChildren(); const term = search.value.toLowerCase(), entries = state.entries.filter(e => view !== 'due' || e.expired).filter(e => `${e.title} ${e.username} ${e.url}`.toLowerCase().includes(term)).sort((a, b) => a.title.localeCompare(b.title));
      if (!entries.length) { const empty = node('div', null, 'empty'); empty.append(node('div', '⚿', 'empty-symbol'), node('h3', term ? 'Nothing here just yet' : view === 'due' ? 'All caught up' : 'Your safe starts here'), node('p', term ? 'Try another name, username, or website.' : view === 'due' ? 'No passwords are currently due for an update.' : 'Add your first login, or bring your passwords over from a browser.')); if (!term && view === 'all') empty.append(button('＋ Add your first login', () => edit(), true), document.createTextNode(' '), button('Import passwords', importCSV)); list.append(empty); }
      for (const e of entries) {
        const card = node('article', null, 'login-card'), info = node('div', null, 'login-info'); card.append(node('div', e.title.slice(0, 1).toUpperCase(), 'login-symbol')); info.append(node('h3', e.title), node('small', e.username || 'No username'), node('div', e.url || 'No website added', 'site')); card.append(info);
        if (e.expiryDays) { const days = Math.max(0, Math.ceil((Date.parse(e.passwordChangedAt) + e.expiryDays * 86400000 - Date.now()) / 86400000)); card.append(node('span', e.expired ? 'Update due' : `${days} days left`, 'expiry' + (e.expired ? ' overdue' : ''))); }
        const actions = node('div', null, 'login-actions'); actions.append(button('Copy login', async () => { await api('copy', { id: e.id, field: 'username' }); notice('Username copied. Clipboard clears in 20 seconds.'); }), button('Copy password', async () => { await api('copy', { id: e.id, field: 'password' }); notice('Password copied. Clipboard clears in 20 seconds.'); }), button('Edit', () => edit(e))); card.append(actions); list.append(card);
      }
    } search.oninput = draw; draw();
  }
  function edit(e) {
    editing = e || null; dirtyPassword = !e; $('entry-form').reset(); $('entry-password').type = 'password'; $('entry-reveal').textContent = 'Show'; $('entry-error').textContent = ''; $('editor-title').textContent = e ? 'Your login' : 'Add a login';
    $('entry-title').value = e?.title || ''; $('entry-user').value = e?.username || ''; $('entry-url').value = e?.url || ''; $('entry-notes').value = e?.notes || ''; $('entry-password').placeholder = e ? 'Saved password · leave untouched to keep' : 'Enter a password';
    const expiry = String(e?.expiryDays || 0); $('entry-expiry').value = ['0', '30', '60', '90', '180', '365'].includes(expiry) ? expiry : 'custom'; $('custom-expiry').value = expiry === '0' ? '90' : expiry; $('custom-expiry-label').hidden = $('entry-expiry').value !== 'custom';
    document.querySelector('#editor .delete-login')?.remove(); if (e) { const remove = button('Delete login', async () => { const result = await api('remove', e.id); if (!state) return; state = result; $('editor').close(); $('entry-form').reset(); render(); }); remove.classList.add('delete-login'); document.querySelector('#editor .dialog-actions').prepend(remove); }
    $('editor').showModal(); $('entry-title').focus();
  }
  $('add-button').onclick = () => edit(); $('entry-cancel').onclick = () => $('editor').close();
  $('editor').addEventListener('close', () => { $('entry-password').value = ''; clearTimeout(revealTimer); });
  $('entry-password').oninput = () => { dirtyPassword = true; };
  $('entry-expiry').onchange = () => { $('custom-expiry-label').hidden = $('entry-expiry').value !== 'custom'; };
  $('entry-reveal').onclick = async () => {
    const epoch = session;
    try { if (editing && !dirtyPassword) { const value = await api('reveal', editing.id); if (epoch !== session) return; $('entry-password').value = value; } $('entry-password').type = $('entry-password').type === 'password' ? 'text' : 'password'; $('entry-reveal').textContent = $('entry-password').type === 'text' ? 'Hide' : 'Show'; clearTimeout(revealTimer); revealTimer = setTimeout(() => { $('entry-password').type = 'password'; $('entry-reveal').textContent = 'Show'; if (!dirtyPassword) $('entry-password').value = ''; }, 15000); } catch (e) { $('entry-error').textContent = e.message; }
  };
  $('entry-form').onsubmit = async event => {
    event.preventDefault(); const submit = event.submitter; if (submit) submit.disabled = true;
    try { const result = await api('put', { id: editing?.id, title: $('entry-title').value, username: $('entry-user').value, password: dirtyPassword ? $('entry-password').value : null, url: $('entry-url').value, notes: $('entry-notes').value, expiryDays: $('entry-expiry').value === 'custom' ? Number($('custom-expiry').value) : Number($('entry-expiry').value) }); if (!state) return; state = result; $('editor').close(); $('entry-form').reset(); render(); notice('Login saved to your encrypted vault.'); } catch (e) { $('entry-error').textContent = e.message; } finally { if (submit) submit.disabled = false; }
  };
  function makeGenerator(parent, onGenerated) {
    let disposed = false, revision = 0; const output = node('div', 'Creating a little randomness…', 'generated'); output.setAttribute('aria-live', 'polite');
    const rangeRow = node('div', null, 'length-row'), label = node('label', 'Length · 24'), range = node('input'); range.type = 'range'; range.min = '8'; range.max = '128'; range.value = '24'; range.setAttribute('aria-label', 'Password length'); rangeRow.append(label, range);
    const options = node('div', null, 'generator-options'), checks = {};
    for (const [key, title] of [['lower', 'Lowercase letters'], ['upper', 'Capital letters'], ['numbers', 'Numbers'], ['symbols', 'Symbols'], ['excludeSimilar', 'Exclude similar (I, l, 1…)']]) { const l = node('label', null, 'check'), input = node('input'); input.type = 'checkbox'; input.checked = key !== 'excludeSimilar'; checks[key] = input; l.append(input, document.createTextNode(title)); options.append(l); }
    async function regenerate() { const request = ++revision; label.textContent = 'Length · ' + range.value; try { const value = await api('generate', { length: Number(range.value), ...Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v.checked])) }); if (disposed || request !== revision) return; output.textContent = value; if (onGenerated) onGenerated(value); } catch (e) { if (disposed) return; output.textContent = e.message; if (onGenerated) onGenerated(''); } }
    range.oninput = regenerate; Object.values(checks).forEach(c => c.onchange = regenerate); parent.append(output, node('small', 'Generated locally with your operating system’s secure random source.'), rangeRow, options, button('↻ Generate another', regenerate)); regenerate(); return () => { disposed = true; output.textContent = ''; };
  }
  $('entry-generate').onclick = () => { $('generator-modal-content').replaceChildren(); generated = ''; generatorCleanup?.(); generatorCleanup = makeGenerator($('generator-modal-content'), value => { generated = value; $('generator-use').disabled = !value; }); $('generator-dialog').showModal(); };
  $('generator-cancel').onclick = () => $('generator-dialog').close();
  $('generator-use').onclick = () => { if (!generated) return; $('entry-password').value = generated; dirtyPassword = true; $('generator-dialog').close(); };
  $('generator-dialog').addEventListener('close', () => { generated = ''; generatorCleanup?.(); generatorCleanup = null; $('generator-modal-content').replaceChildren(); });
  async function importCSV() {
    const preview = await api('previewImport'); if (!preview || !state) return;
    const dialog = node('dialog'), body = node('div', null, 'dialog-body'), actions = node('div', null, 'dialog-actions'); body.append(node('h2', 'Bring your passwords home'), node('p', `${preview.count} supported logins found. ${preview.skipped.length} rows skipped (invalid or non-HTTPS websites). Exact duplicates are ignored.`), node('p', 'Browser exports contain plaintext passwords. Delete the export after importing and check your backups or cloud recycle bin.'));
    if (preview.skipped.length) body.append(node('p', 'Skipped CSV lines: ' + preview.skipped.join(', ')));
    actions.append(button('Cancel', () => dialog.close()), button('Import into vault', async () => { const result = await api('import'); if (!state) return; state = result; dialog.close(); view = 'all'; render(); notice('Passwords imported and encrypted. You can now remove the browser CSV export.'); }, true)); dialog.append(body, actions); dialog.onclose = () => dialog.remove(); document.body.append(dialog); dialog.showModal();
  }
  $('import-button').onclick = () => importCSV().catch(e => notice(e.message));
  function renderSecurity() {
    const p = panel('A vault that travels with you', 'Copy your .tmasafe file to another computer and open it with the same master password and, if enabled, its separate key file. Copies are independent; they do not sync.');
    for (const [label, value] of [['Vault location', state.file], ['Database encryption', 'AES-256-GCM · all login fields'], ['Password derivation', 'scrypt · 128 MiB memory cost'], ['Separate key file', state.keyfile ? 'Required to decrypt this vault' : 'Not enabled · create a new vault with a key file to enable'], ['Master password', 'Required on every launch · never saved'], ['Automatic lock', '5 minutes idle · screen lock · suspend · app close'], ['Clipboard', 'Clears after 20 seconds if unchanged']]) { const row = node('div', null, 'setting-row'); row.append(node('strong', label), node('span', value)); p.append(row); }
    p.append(button('Save an encrypted portable copy…', async () => { if (await api('backup')) notice('Encrypted copy saved. Keep your master password and any key file safe.'); })); $('view-content').append(p);
    const notes = panel('Keep a recovery plan', 'There is no master password reset. A missing master password or required key file cannot be recovered. Keep an encrypted backup and store your key file separately.'); notes.append(node('p', 'Each save keeps the previous encrypted version beside your vault as .bak. These backups retain old passwords. Reminders appear in this app and do not change passwords on websites. TMA-Safe uses its own file format; it does not open KeePass databases.')); $('view-content').append(notes);
  }
  function renderBrowser() {
    const p = panel('Fill with a little help from your safe', 'Use the companion extension with Chrome, Edge, Firefox, Opera, or Opera GX. Your vault must be open and unlocked. Each fill asks for approval in TMA-Safe and matches the exact HTTPS website origin.');
    const token = node('div'), status = node('p', 'Browser filling is off by default. Pairing lasts only until you lock or close this vault.');
    p.append(button('Enable & show pairing code', async () => { const result = await api('bridge', true); if (!state) return; token.replaceChildren(node('p', 'Paste this temporary code into the extension. Treat it as a secret.'), node('div', result.token, 'code')); status.textContent = 'Enabled for this unlocked session · 127.0.0.1:19473'; }), document.createTextNode(' '), button('Turn off', async () => { await api('bridge', false); token.replaceChildren(); status.textContent = 'Browser filling is off.'; }), status, token); $('view-content').append(p);
    const setup = panel('Connect your browser', 'Open the bundled extension folder. In Chrome, Edge, Opera, and Opera GX, enable Developer mode in the browser’s extension manager and choose “Load unpacked”. In Firefox, use about:debugging → This Firefox → Load Temporary Add-on and choose manifest.json.'); setup.append(button('Open extension folder', () => api('extension')), node('p', 'Click the extension on the login page, enter the pairing code, then choose Fill this website. Approve the request in TMA-Safe. Firefox’s temporary add-on must be reloaded after a browser restart; a permanent Firefox release requires Mozilla signing.')); $('view-content').append(setup);
  }
  let activity = 0; for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, () => { if (state && Date.now() - activity > 10000) { activity = Date.now(); api('activity'); } }, { passive: true });
  document.addEventListener('keydown', event => { if (event.ctrlKey && event.key.toLowerCase() === 'l' && state) { event.preventDefault(); api('lock'); } });
  window.addEventListener('safe-refresh', async () => { const result = await api('state'); if (!result) return; state = result; $('gate').hidden = true; $('workspace').hidden = false; view = 'all'; render(); });
})();
