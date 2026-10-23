'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseCatalog,support,Library}=require('../electron/service.cjs');
test('Libraries advertises only its verified Windows package and preserves unrelated native data',()=>{
 const catalog=structuredClone(require('./catalog-fixture.json')),app=catalog.apps.find(a=>a.id==='tma-libraries');
 assert.equal(app.branch,'TMA-Libraries');assert.equal(app.version,'0.1.0');
 assert.ok(!Number.isNaN(Date.parse(app.updatedAt)));assert.equal(app.executable,'TMA-Libraries.exe');
 assert.ok(parseCatalog(catalog));assert.deepEqual(support(app),['windows']);
 assert.deepEqual(Library.prototype.dataLocations.call({data:'/fixture'},app.id),[]);
 app.id='unknown-libraries';assert.throws(()=>parseCatalog(catalog),/Unknown/);
});
