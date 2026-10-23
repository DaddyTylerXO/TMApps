'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const catalog = require('./catalog-fixture.json');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function view(t, platform = 'darwin') {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '../ui/index.html'), 'utf8'), { runScripts: 'outside-only', url: 'file:///tmapps/index.html' }); t.after(() => dom.window.close());
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  let state = { version: '1.9.0', platform, arch: 'arm64', os: platform === 'darwin' ? 'macos' : 'linux', smoke: true, settings: { libraryView: 'List', navigationEdge: 'Left', closeToTray: false, checkOnStartup: false }, profile: { schemaVersion: 1, displayName: '', emails: [], shareWithMail: false }, apps: catalog.apps.map(a => ({ ...structuredClone(a), support: require('../electron/service.cjs').support(a), package: null, installed: null })) };
  const calls = [];
  dom.window.launcher = { spotify: async () => calls.push(['spotify']), experience: async () => require('../experience.json'), support: async (kind, report) => calls.push(['support',kind,report]), crash: async () => 'Redacted crash fixture', snapshot: async () => state, settings: async v => { calls.push(['settings', v]); state.settings = v; return state; }, profile: async v => { calls.push(['profile', v]); state.profile = v; return state; }, source: async id => calls.push(['source', id]), refresh: async () => { calls.push(['refresh']); return { ...state, notice: 'Catalog checked.' }; }, onPrompt: () => () => {}, onNotice: () => () => {}, onProgress: () => () => {}, onRefresh: () => () => {} };
  dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/icons.js'), 'utf8')); dom.window.eval(fs.readFileSync(path.join(__dirname, '../ui/renderer.js'), 'utf8')); await dom.window.launcherReady;
  return { dom, window: dom.window, document: dom.window.document, calls, state };
}
test('Mac and Linux libraries render real support logos and disable incompatible installers', async t => {
  for (const platform of ['darwin', 'linux']) { const v = await view(t, platform); assert.equal(v.document.querySelectorAll('.card').length, 8); assert.equal(v.document.querySelectorAll('.os-badge').length, 4); assert.equal(v.document.querySelectorAll('.os-badge svg').length, 4); assert.ok([...v.document.querySelectorAll('.os-badge')].every(b => b.textContent === 'Windows')); assert.ok([...v.document.querySelectorAll('.actions > button')].every(b => b.disabled)); const smoke = await v.window.launcherSmoke(); assert.equal(smoke.nodeAvailable, false); }
});
test('list/grid and navigation choices persist through the actual controls', async t => {
  const v = await view(t); v.document.getElementById('grid').click(); await tick(); assert.equal(v.document.getElementById('library').className, 'grid'); v.document.getElementById('settings').click(); await tick(); const fields = v.document.querySelectorAll('dialog select'); fields[0].value = 'Right'; v.document.querySelector('dialog .primary').click(); await tick(); assert.equal(v.document.getElementById('shell').className, 'edge-right'); assert.equal(v.calls.at(-1)[1].navigationEdge, 'Right');
});
test('optional profile editor documents credentials and saves addresses without asking for passwords', async t => {
  const v = await view(t); v.document.getElementById('profile').click(); await tick(); const dialog = v.document.querySelector('dialog'); assert.match(dialog.textContent, /app-specific passwords\/keys/); assert.match(dialog.textContent, /Windows-only/); assert.equal(dialog.querySelector('input[type=password]'), null); dialog.querySelector('input').value = 'Example User'; dialog.querySelector('input[type=email]').value='one@example.com';dialog.querySelector('[data-action=add-email]').click();dialog.querySelectorAll('input[type=email]')[1].value='two@example.org'; dialog.querySelector('.primary').click(); await tick(); assert.equal(v.document.getElementById('profile').textContent, 'E'); assert.deepEqual([...v.calls.at(-1)[1].emails], ['one@example.com', 'two@example.org']);
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
  assert.equal([...dialog.querySelectorAll('label.check')].find(l=>l.textContent.includes('Make social accounts')).querySelector('input').checked, false);
  dialog.querySelector('[data-action=add-social-account]').click(); await tick();
  let row = dialog.querySelector('.social-account-row'); row.querySelectorAll('input')[0].value = 'YouTube'; row.querySelectorAll('input')[1].value = 'https://www.youtube.com/@example';
  dialog.querySelector('[data-action=add-social-account]').click(); await tick(); dialog.querySelectorAll('.social-account-row')[1].querySelector('button').click(); await tick();
  assert.equal(dialog.querySelectorAll('.social-account-row').length, 1);
  [...dialog.querySelectorAll('label.check')].find(l=>l.textContent.includes('Make social accounts')).querySelector('input').checked = true; dialog.querySelector('.dialog-actions .primary').click(); await tick();
  assert.equal(v.calls.at(-1)[1].socialAccounts[0].platform, 'YouTube'); assert.equal(v.calls.at(-1)[1].shareWithSocialApps, true);
  v.document.getElementById('profile').click(); await tick(); dialog = v.document.querySelector('dialog'); row = dialog.querySelector('.social-account-row'); assert.equal(row.querySelectorAll('input')[1].value, 'https://www.youtube.com/@example');
  row.querySelector('button').click(); await tick(); const count = v.calls.length; dialog.querySelector('.dialog-actions button').click(); await tick(); assert.equal(v.calls.length, count); assert.equal(v.state.profile.socialAccounts.length, 1);
});

test('details show versions and hide unpublished media without autoplay', async t => {
 const v=await view(t);v.document.querySelector('.app-title').click();await tick();const d=v.document.querySelector('dialog');assert.match(d.textContent,/Version/);assert.equal(d.querySelectorAll('video').length,0);assert.match(d.textContent,/Screenshots will appear/);assert.match(d.textContent,/Features/);assert.match(d.textContent,/Latest release/);
});
test('settings search finds KB numbers and theme cancellation restores the saved palette',async t=>{
 const v=await view(t);v.document.getElementById('settings').click();await tick();let d=v.document.querySelector('dialog');const selects=d.querySelectorAll('select');selects[2].value='Black';selects[2].dispatchEvent(new v.window.Event('change'));assert.equal(v.document.documentElement.dataset.theme,'Black');const search=d.querySelector('input');search.value='Launcher-KB6';search.dispatchEvent(new v.window.Event('input'));assert.match(d.textContent,/Launcher-KB6/);d.querySelector('.dialog-actions button').click();await tick();assert.equal(v.document.documentElement.dataset.theme,'Orange');
});
test('help opens the chosen report draft only after user action',async t=>{
 const v=await view(t);v.document.getElementById('help').click();await tick();const d=v.document.querySelector('dialog');[...d.querySelectorAll('button')].find(b=>b.textContent==='Bug report').click();await tick();assert.equal(v.calls.at(-1)[1],'bug');
});


test('Libraries and Finance show real branding and block Windows packages on Mac and Linux', async t => {
 for(const platform of ['darwin','linux']) {
  const v=await view(t,platform);
  for(const [id,icon,number] of [['tma-libraries','TMA-Libraries.png','05 / LIBRARIES'],['tma-finance','TMA-Finance.png','06 / FINANCE']]) {
   const card=v.document.querySelector(`[data-id="${id}"]`);
   assert.equal(card.querySelector('.app-icon img').getAttribute('src'),'../assets/'+icon);
   assert.match(card.querySelector('.status').textContent,/NOT AVAILABLE FOR/);
   assert.ok(card.querySelector('.actions > button').disabled);
   assert.equal(card.querySelectorAll('.os-badge').length,1);
   assert.equal(card.querySelector('.os-badge').textContent,'Windows');
   assert.match(card.textContent,/v0.1.0/);assert.equal(card.querySelector('.card-head').textContent,number);
   [...card.querySelectorAll('.menu-items button')].find(b=>b.textContent.includes('source')).click();await tick();assert.equal(v.calls.at(-1)[1],id);
   card.querySelector('.app-title').click();await tick();const dialog=v.document.querySelector('dialog');assert.match(dialog.textContent,/Version 0.1.0/);assert.equal(dialog.querySelectorAll('.showcase-thumbs button').length,1);assert.equal(dialog.querySelectorAll('video').length,0);dialog.querySelector('.dialog-actions button').click();await tick();
  }
  assert.equal(v.document.querySelector('.card:last-child .card-head').textContent,'08 / YOUR AI TEAM');
 }
});

test('Spotify entry opens native playback settings and list Details follows app actions',async t=>{const v=await view(t);v.document.getElementById('spotify').click();await tick();assert.deepEqual(v.calls.at(-1),['spotify']);const meta=v.document.querySelector('.app-meta');assert.ok(meta.querySelector('.actions').nextElementSibling.classList.contains('app-details'));v.document.getElementById('settings').click();await tick();const d=v.document.querySelector('dialog'),sections=d.querySelectorAll('.settings-section');assert.equal([...sections].filter(s=>!s.hidden).length,1);const compact=[...d.querySelectorAll('.check')].find(l=>l.textContent==='Compact Navigation Bar').querySelector('input');compact.checked=true;d.querySelector('.dialog-actions .primary').click();await tick();assert.equal(v.state.settings.compactNavigation,true);assert.equal(v.document.getElementById('shell').dataset.compact,'true');});

test('email editor bounds rows and Cancel preserves the saved profile',async t=>{const v=await view(t);v.document.getElementById('profile').click();await tick();const d=v.document.querySelector('dialog'),add=d.querySelector('[data-action=add-email]');assert.equal(d.querySelectorAll('input[type=email]').length,1);for(let i=0;i<25;i++)add.click();assert.equal(d.querySelectorAll('input[type=email]').length,20);assert.equal(add.disabled,true);d.querySelector('.email-row button').click();assert.equal(add.disabled,false);d.querySelector('.dialog-actions button').click();await tick();assert.equal(v.calls.filter(c=>c[0]==='profile').length,0);});

test('published app screenshots use next and thumbnail navigation without starting video',async t=>{const v=await view(t);v.document.querySelector('[data-id="tma-safe"] .app-title').click();await tick();const d=v.document.querySelector('dialog'),thumbs=d.querySelectorAll('.showcase-thumbs button');assert.ok(thumbs.length>1);const image=d.querySelector('.showcase-image'),first=image.src;[...d.querySelectorAll('button')].find(b=>b.textContent==='Next screenshot →').click();assert.notEqual(image.src,first);thumbs[0].click();assert.equal(image.src,first);assert.equal(d.querySelectorAll('video[autoplay]').length,0);});

test('Service Status stays idle until a manual check and renders accessible green/red states',async t=>{const v=await view(t);let checks=0;v.window.launcher.status=async()=>{checks++;return ['github','spotify','microsoft','google'].map((id,i)=>({id,name:id,working:i!==1,detail:'Reachability only'}));};v.document.getElementById('status').click();await tick();const d=v.document.querySelector('dialog');assert.equal(checks,0);assert.ok(d.querySelector('.status-light.unchecked'));[...d.querySelectorAll('button')].find(b=>b.textContent==='Check APIs now').click();await tick();assert.equal(checks,1);assert.ok(d.querySelector('.status-light.working'));assert.ok(d.querySelector('.status-light.broken'));assert.match(d.textContent,/does not verify an account/);});
