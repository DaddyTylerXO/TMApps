'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseCatalog,support,Library}=require('../electron/service.cjs');
test('Libraries is registered without packages or unrelated data-deletion paths',()=>{
 const catalog=structuredClone(require('../catalog.json')),app=catalog.apps.find(a=>a.id==='tma-libraries');
 assert.equal(app.branch,'TMA-Libraries');assert.equal(app.version,'0.0.0');
 assert.equal(app.updatedAt,'');assert.equal(app.executable,'TMA-Libraries.exe');
 assert.ok(parseCatalog(catalog));assert.deepEqual(support(app),[]);
 assert.deepEqual(Library.prototype.dataLocations.call({data:'/fixture'},app.id),[]);
 app.id='unknown-libraries';assert.throws(()=>parseCatalog(catalog),/Unknown/);
});
