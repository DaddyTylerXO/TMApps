'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const catalog = require('../catalog.json');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function view(t, platform = 'darwin') {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8'), { runScripts: 'outside-only', url: 'file:///tmapps/index.html' }); t.after(() => dom.window.close());
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let state = { version: '1.9.0', platform, arch: 'arm64', os: platform === 'darwin' ? 'macos' : 'linux', smoke: true, settings: { libraryView: 'List', navigationEdge: 'Left', closeToTray: false, checkOnStartup: false }, profile: { schemaVersion: 1, displayName: '', emails: [], shareWithMail: false }, apps: catalog.apps.map(a => ({ ...structuredClone(a), support: require('../electron/service.cjs').support(a), package: null, installed: null })) };
  const calls = [];
  dom.window.launcher = { snapshot: async () => state, settings: async v => { calls.push(['settings', v]); state.settings = v; return state; }, profile: async v => { calls.push(['profile', v]); state.profile = v; return state; }, source: async id => calls.push(['source', id]), refresh: async () => { calls.push(['refresh']); return { ...state, notice: 'Catalog checked.' }; }, onPrompt: () => () => {}, onNotice: () => () => {}, onProgress: () => () => {}, onRefresh: () => () => {} };
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/icons.js'), 'utf8')); dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8')); await dom.window.launcherReady;
  return { dom, window: dom.window, document: dom.window.document, calls, state };
}
test('Mac and Linux libraries render real support logos and disable incompatible installers', async t => {
  for (const platform of ['darwin', 'linux']) { const v = await view(t, platform); assert.equal(v.document.querySelectorAll('.card').length, 5); assert.equal(v.document.querySelectorAll('.os-badge').length, 2); assert.equal(v.document.querySelectorAll('.os-badge svg').length, 2); assert.ok([...v.document.querySelectorAll('.os-badge')].every(b => b.textContent === 'Windows')); assert.ok([...v.document.querySelectorAll('.actions > button')].every(b => b.disabled)); const smoke = await v.window.launcherSmoke(); assert.equal(smoke.nodeAvailable, false); }
});
test('list/grid and navigation choices persist through the actual controls', async t => {
  const v = await view(t); v.document.getElementById('grid').click(); await tick(); assert.equal(v.document.getElementById('library').className, 'grid'); v.document.getElementById('settings').click(); await tick(); const fields = v.document.querySelectorAll('dialog select'); fields[0].value = 'Right'; v.document.querySelector('dialog .primary').click(); await tick(); assert.equal(v.document.getElementById('shell').className, 'edge-right'); assert.equal(v.calls.at(-1)[1].navigationEdge, 'Right');
});
test('optional profile editor documents credentials and saves addresses without asking for passwords', async t => {
  const v = await view(t); v.document.getElementById('profile').click(); await tick(); const dialog = v.document.querySelector('dialog'); assert.match(dialog.textContent, /app-specific passwords\/keys/); assert.match(dialog.textContent, /Windows-only/); assert.equal(dialog.querySelector('input[type=password]'), null); dialog.querySelector('input').value = 'Example User'; dialog.querySelector('textarea').value = 'one@example.com\ntwo@example.org'; dialog.querySelector('.primary').click(); await tick(); assert.equal(v.document.getElementById('profile').textContent, 'E'); assert.deepEqual([...v.calls.at(-1)[1].emails], ['one@example.com', 'two@example.org']);
});
test('search and source menu work even when no native app packages are available', async t => {
  const v = await view(t); const search = v.document.getElementById('search'); search.value = 'Mail'; search.dispatchEvent(new v.window.Event('input')); assert.equal(v.document.querySelectorAll('.card').length, 1); const buttons = [...v.document.querySelectorAll('.menu-items button')]; buttons.find(b => b.textContent.includes('source')).click(); await tick(); assert.equal(v.calls.at(-1)[1], 'tma-mail');
});

test('Agent Office stays last and keeps its full library number when filtered', async t => {
  const v = await view(t);
  const socials = v.state.apps.find(a => a.id === 'tma-socialsmanager');
  const office = v.state.apps.find(a => a.id === 'tma-agent-office');
  const mail = v.state.apps.find(a => a.id === 'tma-mail');
  v.state.apps = [office, socials, mail, { ...mail, id: 'new-app', name: 'New Tool', category: 'Tools' }, { ...mail, id: 'another-app', name: 'Another Tool', category: 'Tools' }];
  const search = v.document.getElementById('search');
  search.dispatchEvent(new v.window.Event('input'));
  assert.deepEqual([...v.document.querySelectorAll('.card')].map(c => c.dataset.id), ['tma-mail', 'new-app', 'another-app', 'tma-socialsmanager', 'tma-agent-office']);
  assert.equal(v.document.querySelector('.card:last-child .card-head').textContent, '05 / YOUR AI TEAM');
  search.value = 'Agent'; search.dispatchEvent(new v.window.Event('input'));
  assert.equal(v.document.querySelector('.card-head').textContent, '05 / YOUR AI TEAM');
});

test('SocialsManager is a coming-soon placeholder with source access and no installer', async t => {
  const v = await view(t), card = v.document.querySelector('[data-id="tma-socialsmanager"]');
  assert.equal(card.querySelector('.app-icon img').getAttribute('src'), '../assets/TMA-SocialsManager.png');
  assert.equal(card.querySelector('.status').textContent, 'COMING SOON');
  assert.equal(card.querySelector('.actions > button').textContent, 'Coming soon');
  assert.ok(card.querySelector('.actions > button').disabled);
  assert.equal(card.querySelectorAll('.os-badge').length, 0);
  [...card.querySelectorAll('.menu-items button')].find(b => b.textContent.includes('source')).click(); await tick();
  assert.equal(v.calls.at(-1)[1], 'tma-socialsmanager');
});
