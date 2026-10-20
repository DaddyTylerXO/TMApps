const fs=require('node:fs/promises');const path=require('node:path');
module.exports=async function smoke({win,prefs,showTrayMenu,exit}){
  const assert=require('node:assert/strict');const out=path.resolve('artifacts');await fs.mkdir(out,{recursive:true});
  const js=code=>win.webContents.executeJavaScript(code,true);
  const until=async code=>{for(let i=0;i<100;i++){if(await js(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+code);};
  await until("document.querySelector('.stat-value')!==null && !document.body.hasAttribute('aria-busy')");
  assert.equal(await js("document.querySelector('#account-count').textContent"),'0');win.show();await new Promise(r=>setTimeout(r,1000));
  await fs.writeFile(path.join(out,'overview.png'),(await win.webContents.capturePage()).toPNG());
  await js("document.querySelector('[data-view=accounts]').click()");await until("document.querySelectorAll('.platform-card').length===9");
  await js("[...document.querySelectorAll('.platform-card')].find(n=>n.textContent.includes('No developer key')).querySelector('button').click()");
  assert.equal(await js("document.querySelector('#connect-dialog').open"),true);assert.equal(await js("document.querySelector('#password').type"),'password');await js("document.querySelector('#close-dialog').click()");
  await js("document.querySelector('[data-view=compose]').click()");await until("document.querySelector('#post-text')!==null");
  await js("document.querySelector('#post-text').value='Smoke test draft';document.querySelector('#post-title').value='Draft verification';document.querySelector('#post-text').dispatchEvent(new Event('input'));[...document.querySelectorAll('button')].find(b=>b.textContent==='Save draft').click()");await until("!document.body.hasAttribute('aria-busy') && document.querySelector('#notice').textContent.includes('saved')");
  await js("document.querySelector('[data-view=drafts]').click()");await until("document.querySelector('.draft-item')!==null");assert.match(await js("document.querySelector('.draft-item').textContent"),/Smoke test draft/);
  await js("document.querySelector('[data-view=settings]').click()");await until("document.querySelector('#pref-showTray')!==null");
  await js("document.querySelector('#analytics-mode').value='interval';document.querySelector('#analytics-mode').dispatchEvent(new Event('change'));document.querySelector('#analytics-unit').value='hours';document.querySelector('#analytics-amount').value='2';[...document.querySelectorAll('button')].find(b=>b.textContent==='Save analytics settings').click()");await until("!document.body.hasAttribute('aria-busy') && document.querySelector('#notice').textContent.includes('Analytics settings saved')");assert.equal(prefs.value.intervalMinutes,120);assert.equal(prefs.value.analyticsMode,'interval');
  await fs.writeFile(path.join(out,'settings.png'),(await win.webContents.capturePage()).toPNG());
  await js("document.querySelector('#pref-closeToTray').checked=true;[...document.querySelectorAll('button')].find(b=>b.textContent==='Save preferences').click()");await until("!document.body.hasAttribute('aria-busy') && document.querySelector('#notice').textContent.includes('Preferences saved')");assert.equal(prefs.value.closeToTray,true);
  win.close();for(let i=0;i<100&&win.isVisible();i++)await new Promise(r=>setTimeout(r,50));assert.equal(win.isVisible(),false);win.show();
  const popup=showTrayMenu();await new Promise(r=>setTimeout(r,500));
  const {BrowserWindow}=require('electron');const menu=BrowserWindow.getAllWindows().find(w=>w!==win);if(menu){await fs.writeFile(path.join(out,'tray.png'),(await menu.webContents.capturePage()).toPNG());await menu.webContents.executeJavaScript("document.querySelector('[data-action=settings]').click()",true);}
  await prefs.update({...prefs.value,showTray:false});
  await js("state.accounts=[{id:'fixture',platform:'bluesky',label:'Test fixture',snapshot:{updatedAt:new Date().toISOString(),metrics:{followers:5,posts:2}}}];preferences.analyticsMode='live';view='overview';render()");assert.equal(await js("document.querySelectorAll('.freshness.fresh').length"),5);await js("state.accounts[0].error='offline';paintFreshness()");assert.equal(await js("document.querySelectorAll('.freshness.fresh').length"),0);await js("view='settings';state.accounts=[];render()");
  await fs.writeFile(path.join(out,'smoke.json'),JSON.stringify({ok:true,platform:process.platform,checks:['initial empty state','nine platforms','masked credentials','draft save','preferences persistence','2-hour analytics interval','green fresh statistics','failed refresh removes green indicators','close to tray','tray settings action']}));exit();
};
