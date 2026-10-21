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
  dom.window.launcher = { experience: async () => require('../experience.json'), support: async (kind, report) => calls.push(['support',kind,report]), crash: async () => 'Redacted crash fixture', snapshot: async () => state, settings: async v => { calls.push(['settings', v]); state.settings = v; return state; }, profile: async v => { calls.push(['profile', v]); state.profile = v; return state; }, source: async id => calls.push(['source', id]), refresh: async () => { calls.push(['refresh']); return { ...state, notice: 'Catalog checked.' }; }, onPrompt: () => () => {}, onNotice: () => () => {}, onProgress: () => () => {}, onRefresh: () => () => {} };
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/icons.js'), 'utf8')); dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8')); await dom.window.launcherReady;
  return { dom, window: dom.window, document: dom.window.document, calls, state };
}
test('Mac and Linux libraries render real support logos and disable incompatible installers', async t => {
  for (const platform of ['darwin', 'linux']) { const v = await view(t, platform); assert.equal(v.document.querySelectorAll('.card').length, 7); assert.equal(v.document.querySelectorAll('.os-badge').length, 2); assert.equal(v.document.querySelectorAll('.os-badge svg').length, 2); assert.ok([...v.document.querySelectorAll('.os-badge')].every(b => b.textContent === 'Windows')); assert.ok([...v.document.querySelectorAll('.actions > button')].every(b => b.disabled)); const smoke = await v.window.launcherSmoke(); assert.equal(smoke.nodeAvailable, false); }
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

test('profile social account controls add, remove, save, and cancel without signing in', async t => {
  const v = await view(t); v.document.getElementById('profile').click(); await tick();
  let dialog = v.document.querySelector('dialog');
  assert.match(dialog.textContent, /TMA-SocialsManager and TMA-Cut/); assert.match(dialog.textContent, /does not connect or sign in/);
  assert.equal(dialog.querySelectorAll('input[type=checkbox]')[1].checked, false);
  dialog.querySelector('[data-action=add-social-account]').click(); await tick();
  let row = dialog.querySelector('.social-account-row'); row.querySelectorAll('input')[0].value = 'YouTube'; row.querySelectorAll('input')[1].value = 'https://www.youtube.com/@example';
  dialog.querySelector('[data-action=add-social-account]').click(); await tick(); dialog.querySelectorAll('.social-account-row')[1].querySelector('button').click(); await tick();
  assert.equal(dialog.querySelectorAll('.social-account-row').length, 1);
  dialog.querySelectorAll('input[type=checkbox]')[1].checked = true; dialog.querySelector('.dialog-actions .primary').click(); await tick();
  assert.equal(v.calls.at(-1)[1].socialAccounts[0].platform, 'YouTube'); assert.equal(v.calls.at(-1)[1].shareWithSocialApps, true);
  v.document.getElementById('profile').click(); await tick(); dialog = v.document.querySelector('dialog'); row = dialog.querySelector('.social-account-row'); assert.equal(row.querySelectorAll('input')[1].value, 'https://www.youtube.com/@example');
  row.querySelector('button').click(); await tick(); const count = v.calls.length; dialog.querySelector('.dialog-actions button').click(); await tick(); assert.equal(v.calls.length, count); assert.equal(v.state.profile.socialAccounts.length, 1);
});

test('details show versions and ten gallery slots without autoplay', async t => {
 const v=await view(t);v.document.querySelector('.app-title').click();await tick();const d=v.document.querySelector('dialog');assert.match(d.textContent,/Version/);assert.equal(d.querySelectorAll('.gallery figure').length,10);assert.match(d.textContent,/Showcase video not published/);assert.ok([...d.querySelectorAll('img')].every(i=>i.loading==='lazy'));
});
test('settings search finds KB numbers and theme cancellation restores the saved palette',async t=>{
 const v=await view(t);v.document.getElementById('settings').click();await tick();let d=v.document.querySelector('dialog');const selects=d.querySelectorAll('select');selects[2].value='Black';selects[2].dispatchEvent(new v.window.Event('change'));assert.equal(v.document.documentElement.dataset.theme,'Black');const search=d.querySelector('input');search.value='Launcher-KB6';search.dispatchEvent(new v.window.Event('input'));assert.match(d.textContent,/Launcher-KB6/);d.querySelector('.dialog-actions button').click();await tick();assert.equal(v.document.documentElement.dataset.theme,'Orange');
});
test('help opens the chosen report draft only after user action',async t=>{
 const v=await view(t);v.document.getElementById('help').click();await tick();const d=v.document.querySelector('dialog');[...d.querySelectorAll('button')].find(b=>b.textContent==='Bug report').click();await tick();assert.equal(v.calls.at(-1)[1],'bug');
});


test('Libraries stays coming soon with working details and source on Mac and Linux', async t => {
  for (const platform of ['darwin', 'linux']) {
    const v = await view(t, platform), card = v.document.querySelector('[data-id="tma-libraries"]');
    assert.equal(card.querySelector('.app-icon').textContent, '?');
    assert.equal(card.querySelector('.status').textContent, 'COMING SOON');
    assert.ok(card.querySelector('.actions > button').disabled);
    assert.equal(card.querySelectorAll('.os-badge').length, 0);
    assert.match(card.textContent, /Version not published/);
    assert.match(card.textContent, /date not published/);
    assert.ok(!card.textContent.includes('1970') && !card.textContent.includes('v0.0.0'));
    assert.equal(card.querySelector('.card-head').textContent, '05 / LIBRARIES');
    assert.equal(v.document.querySelector('.card:last-child .card-head').textContent, '07 / YOUR AI TEAM');
    [...card.querySelectorAll('.menu-items button')].find(b => b.textContent.includes('source')).click(); await tick();
    assert.equal(v.calls.at(-1)[1], 'tma-libraries');
    card.querySelector('.app-title').click(); await tick();
    const dialog = v.document.querySelector('dialog');
    assert.match(dialog.textContent, /Version not published/);
    assert.match(dialog.textContent, /date not published/);
    assert.equal(dialog.querySelectorAll('.gallery figure').length, 10);
    assert.equal(dialog.querySelectorAll('video,img').length, 0);
  }
});
