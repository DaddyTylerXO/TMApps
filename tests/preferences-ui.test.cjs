'use strict';
const { test }=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), {JSDOM}=require('jsdom');
test('folder views filter logins and settings prevent inaccessible close-to-tray choices',async()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///ui/index.html'}), w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const folders=[{id:'folder-a',name:'Personal'},{id:'folder-b',name:'Work'}];const entries=[{id:'one',title:'Home',folderId:'folder-a',username:'test',url:'https://example.com',expiryDays:0},{id:'two',title:'Office',folderId:'folder-b',username:'work',url:'https://example.org',expiryDays:0}];
  const settings={openAtLogin:false,showTray:true,closeToTray:true,idleMinutes:5,clipboardSeconds:20,startupSupported:true};let saved;
  w.safe=new Proxy({}, {get:(_,method)=>async value=>({ok:true,value:method==='unlock'?{file:'/test.tmasafe',folders,entries}:method==='settings'?(value?(saved=value,{...value,startupSupported:true}):settings):null})});
  w.eval(fs.readFileSync(path.join(__dirname,'../ui/renderer.js'),'utf8'));d.getElementById('unlock-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));
  d.querySelectorAll('#folders button')[1].click();assert.equal(d.getElementById('view-title').textContent,'Work');assert.equal(d.querySelectorAll('.login-card').length,1);assert.equal(d.querySelector('.login-info h3').textContent,'Office');d.getElementById('add-button').click();assert.equal(d.getElementById('entry-folder').value,'folder-b');d.getElementById('entry-cancel').click();
  d.getElementById('settings-button').click();await new Promise(r=>setTimeout(r,10));assert.equal(d.getElementById('settings-dialog').open,true);const tray=d.getElementById('setting-tray');tray.checked=false;tray.dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('setting-close').checked,false);assert.equal(d.getElementById('setting-close').disabled,true);
  d.getElementById('settings-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setTimeout(r,10));assert.equal(saved.showTray,false);assert.equal(saved.closeToTray,false);dom.window.close();
});
