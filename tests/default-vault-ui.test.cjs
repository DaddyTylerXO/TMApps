'use strict';
const { test }=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), {JSDOM}=require('jsdom');
test('remembered vault is preselected while credentials stay empty and master password remains required',async()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///ui/index.html'}), w=dom.window,d=w.document; const calls=[];
  w.safe=new Proxy({}, {get:(_,method)=>async value=>{calls.push([method,value]);return {ok:true,value:method==='vaultChoice'?{name:'My passwords.tmasafe',remember:true,unavailable:false}:null};}});
  w.eval(fs.readFileSync(path.join(__dirname,'../ui/renderer.js'),'utf8'));await new Promise(r=>setTimeout(r,10));
  assert.equal(d.getElementById('choose-vault').textContent,'My passwords.tmasafe');assert.equal(d.getElementById('always-vault').checked,true);assert.equal(d.getElementById('master').value,'');assert.equal(d.getElementById('master').required,true);assert.equal(d.getElementById('workspace').hidden,true);assert.ok(!calls.some(c=>c[0]==='unlock'));
  d.getElementById('always-vault').checked=false;d.getElementById('always-vault').dispatchEvent(new w.Event('change'));await new Promise(r=>setImmediate(r));assert.ok(calls.some(c=>c[0]==='rememberVault'&&c[1]===false));dom.window.close();
});
test('missing remembered vault offers file selection and does not attempt an unlock',async()=>{
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///ui/index.html'}), w=dom.window,d=w.document; const calls=[];
  w.safe=new Proxy({}, {get:(_,method)=>async value=>{calls.push([method,value]);return {ok:true,value:method==='vaultChoice'?{name:null,remember:true,unavailable:true}:method==='chooseVault'?'Moved vault.tmasafe':null};}});
  w.eval(fs.readFileSync(path.join(__dirname,'../ui/renderer.js'),'utf8'));await new Promise(r=>setTimeout(r,10));assert.match(d.getElementById('gate-error').textContent,/unavailable/);assert.ok(!calls.some(c=>c[0]==='unlock'));
  d.getElementById('choose-vault').click();await new Promise(r=>setTimeout(r,10));assert.equal(d.getElementById('choose-vault').textContent,'Moved vault.tmasafe');assert.ok(calls.some(c=>c[0]==='rememberVault'&&c[1]===true));dom.window.close();
});
