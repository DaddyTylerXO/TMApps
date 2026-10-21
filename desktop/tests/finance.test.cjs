'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseCatalog,support,Library}=require('../electron/service.cjs');
test('Finance is registered with Windows metadata and cannot claim a native install',()=>{
 const catalog=structuredClone(require('../catalog.json')),app=catalog.apps.find(a=>a.id==='tma-finance');
 assert.ok(parseCatalog(catalog));assert.equal(app.branch,'TMA-Finance');assert.equal(app.executable,'TMA-Finance.exe');assert.equal(app.version,'0.1.0');assert.deepEqual(support(app),['windows']);assert.match(app.sha256,/^[a-f0-9]{64}$/);assert.ok(Date.parse(app.updatedAt));
 assert.deepEqual(Library.prototype.dataLocations.call({data:'/fixture'},app.id),[]);
 app.id='attacker-finance';assert.throws(()=>parseCatalog(catalog),/Unknown/);
});
