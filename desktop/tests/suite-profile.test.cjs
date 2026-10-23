'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { AppProfile, suggestions, merge, sharedPath } = require('../electron/suite-profile.cjs');
test('launcher global sharing opt-out disables legacy consumer flags', () => {
  const { profile } = require('../electron/service.cjs'); const p = profile({ schemaVersion: 1, displayName: 'Example', emails: [], shareWithApps: false, shareWithMail: true, shareWithSocialApps: true }); assert.equal(p.shareWithMail, false); assert.equal(p.shareWithSocialApps, false);
});
test('shared profile is optional, bounded, and contains no provider credentials', () => {
  assert.equal(suggestions({ schemaVersion: 1, revision: 'test', shareWithApps: false, displayName: 'Example' }).enabled, false);
  const p = suggestions({ schemaVersion: 1, revision: 'test', displayName: 'Example User', emails: ['one@example.com'], password: 'fixture-never-copy', shareWithSocialApps: false, socialAccounts: [{ platform: 'Example', account: 'person' }] });
  assert.equal(p.displayName, 'Example User'); assert.equal(p.password, undefined); assert.deepEqual(p.socialAccounts, []);
  assert.equal(sharedPath('linux', '/example', { XDG_CONFIG_HOME: 'relative' }), path.join('/example', '.config', 'TMApps', 'profile.json'));
});
test('autofill updates imported values and preserves app-specific identity edits', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmapps-profile-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const shared = path.join(root, 'shared.json');
  const store = new AppProfile({ root: path.join(root, 'app'), shared });
  const profile = { schemaVersion: 1, revision: 'one', displayName: 'Example User', emails: ['one@example.com'] }; await fs.writeFile(shared, JSON.stringify(profile));
  let p = await store.snapshot(); assert.equal(p.displayName, 'Example User'); assert.equal(p.email, 'one@example.com');
  profile.displayName = 'Updated Example'; profile.emails = ['two@example.com']; profile.revision = 'two'; await fs.writeFile(shared, JSON.stringify(profile)); p = await store.snapshot(); assert.equal(p.displayName, 'Updated Example'); assert.equal(p.email, 'two@example.com');
  await store.save({ displayName: 'App name', email: 'custom@example.net', token: 'fixture-never-copy' }); profile.displayName = 'Another change'; await fs.writeFile(shared, JSON.stringify(profile)); p = await store.snapshot(); assert.equal(p.displayName, 'App name'); assert.equal(p.email, 'custom@example.net'); assert.equal(JSON.parse(await fs.readFile(store.file, 'utf8')).token, undefined);
  profile.shareWithApps = false; await fs.writeFile(shared, JSON.stringify(profile)); p = await store.snapshot(); assert.equal(p.sharing, false); assert.equal(p.email, 'custom@example.net'); assert.deepEqual(p.emails, []);
  await fs.writeFile(store.file, '{invalid'); await assert.rejects(store.snapshot(), /existing file was kept/); assert.equal(await fs.readFile(store.file, 'utf8'), '{invalid');
});
test('profile merge never replaces a separately entered name or email', () => {
  const p = merge({ displayName: 'Local name', email: 'local@example.com' }, { enabled: true, displayName: 'Shared name', emails: ['shared@example.com'] }); assert.equal(p.displayName, 'Local name'); assert.equal(p.email, 'local@example.com');
});
test('profile icons open editable fields and autofill only declared profile inputs', async t => {
  const { JSDOM } = require('jsdom'); const source = require('node:fs').readFileSync(path.join(__dirname, '../ui/suite-profile.js'), 'utf8');
  const dom = new JSDOM('<body><div class="topbar-right"><span class="avatar">YO</span></div><form data-tmapps-profile-form><input data-profile-field="displayName"><input data-profile-field="email" value="custom@example.net"><input type="password" data-profile-field="email"></form></body>', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; dom.window.HTMLDialogElement.prototype.close = function () { this.dispatchEvent(new dom.window.Event('close')); };
  let p = { displayName: 'Example User', email: 'one@example.com', sharing: true }, saves = 0; dom.window.tmappsProfile = { read: async () => p, save: async value => { saves++; return p = { ...p, ...value }; } }; dom.window.eval(source); await new Promise(r => setImmediate(r));
  const d = dom.window.document; assert.equal(d.querySelector('.avatar').textContent, 'EU'); assert.equal(d.querySelector('[data-profile-field=displayName]').value, 'Example User'); assert.equal(d.querySelector('[data-profile-field=email]').value, 'custom@example.net'); assert.equal(d.querySelector('[type=password]').value, '');
  d.querySelector('.avatar').click(); await new Promise(r => setImmediate(r)); const dialog = d.querySelector('dialog'); assert.equal(dialog.querySelector('input').value, 'Example User'); dialog.querySelector('input').value = 'Local Name'; [...dialog.querySelectorAll('button')].find(b=>b.textContent==='Save profile').click(); await new Promise(r => setImmediate(r)); assert.equal(saves, 1); assert.equal(d.querySelector('.avatar').textContent, 'LN'); assert.equal(d.querySelector('dialog'), null);
});
test('apps without profile fields and Finance demo do not read shared identity', async t => {
  const { JSDOM } = require('jsdom'); const source = require('node:fs').readFileSync(path.join(__dirname, '../ui/suite-profile.js'), 'utf8');
  for (const html of ['<main>No user profile here</main>', '<div class="profile"><div class="avatar">D</div><div>Demo workspace</div></div>']) {
    const dom = new JSDOM(html, { runScripts: 'outside-only' }); t.after(() => dom.window.close()); let calls = 0; dom.window.tmappsProfile = { read: async () => { calls++; return {}; } }; dom.window.eval(source); await new Promise(r => setImmediate(r)); dom.window.dispatchEvent(new dom.window.Event('focus')); await new Promise(r => setImmediate(r)); assert.equal(calls, 0);
  }
});
