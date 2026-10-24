'use strict';
const { test }=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
test('settings search finds controls and optional KBs, persists generator defaults, and leaves stored passwords alone',async t=>{
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///ui/index.html'});t.after(()=>dom.window.close());const w=dom.window,d=w.document;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 let prefs={...require('../electron/settings.cjs').defaults},saved;
 w.safe=new Proxy({}, {get:(_,method)=>async value=>({ok:true,value:method==='settings'?(value?(saved=value,prefs={...value}):prefs):method==='kb'?[{id:'Safe-KB1',title:'Create a vault',paragraphs:['Unique guide keyword portablearchive']}]:null})});
 for(const file of ['appearance.js','preferences.js','records.js','renderer.js'])w.eval(fs.readFileSync(path.join(__dirname,'../ui/'+file),'utf8'));
 await new Promise(setImmediate);d.getElementById('gate-settings').click();await new Promise(setImmediate);
 const query=d.getElementById('settings-search');query.value='portablearchive';query.dispatchEvent(new w.Event('input'));assert.match(d.getElementById('settings-kb-results').textContent,/Safe-KB1/);
 d.getElementById('setting-includeKB').checked=false;d.getElementById('setting-includeKB').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('settings-kb-results').textContent,'');
 d.getElementById('default-length').value='40';d.getElementById('setting-appearance').value='grey';d.getElementById('settings-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(setImmediate);
 assert.equal(saved.generator.length,40);assert.equal(saved.includeKB,false);assert.equal(saved.appearance,'grey');assert.equal(d.documentElement.style.getPropertyValue('--safe-bg'),'#202124');
});
