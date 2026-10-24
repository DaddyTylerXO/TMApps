'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(setImmediate);
test('first-launch prompt persists dismissal and demo tour never writes real records',async t=>{
 let prefs={...require('../electron/settings.cjs').defaults};let writes=0;
 function launch(){const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///ui/index.html',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};w.safe=new Proxy({}, {get:(_,name)=>async value=>{if(['put','remove','import','importVault','backup'].includes(name))writes++;return {ok:true,value:name==='settings'?(value?(prefs={...value}):prefs):name==='generate'?'FictionalDemoOnly123!':null}}});for(const file of ['appearance.js','preferences.js','records.js','dashboard.js','onboarding.js','renderer.js'])w.eval(fs.readFileSync(path.join(__dirname,'../ui/'+file),'utf8'));return w;}
 const w=launch(),d=w.document;await tick();assert.equal(d.getElementById('welcome-dialog').open,true);d.getElementById('welcome-tour').click();await tick();await tick();assert.equal(prefs.onboardingDone,true);assert.equal(d.getElementById('tour-guide').hidden,false);assert.equal(d.getElementById('workspace').inert,true);
 for(let i=0;i<4;i++){d.getElementById('tour-next').click();await tick();}d.getElementById('tour-back').click();d.getElementById('tour-exit').click();await tick();assert.equal(writes,0);assert.equal(d.getElementById('workspace').hidden,true);assert.equal(d.getElementById('gate-title').textContent,'Make yourself a safe');
 const again=launch();await tick();assert.equal(again.document.getElementById('welcome-dialog').open,false);
});
