'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parseCatalog,support,Library}=require('../electron/service.cjs');
test('Cut is registered and accepts verified native packages without claiming unpublished support',()=>{
  const catalog=structuredClone(require('../catalog.json')),cut=catalog.apps.find(a=>a.id==='tma-cut');
  assert.equal(cut.branch,'TMA-Cut');assert.equal(cut.executable,'TMA-Cut.exe');assert.deepEqual(support(cut),[]);
  cut.packages={'macos-arm64':{url:'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMA-Cut-0.1.0-mac-arm64.tar.gz',sha256:'a'.repeat(64),format:'tar.gz',executable:'TMA-Cut.app/Contents/MacOS/TMA-Cut'}};
  assert.ok(parseCatalog(catalog));assert.deepEqual(support(cut),['macos']);
  assert.deepEqual(Library.prototype.dataLocations.call({data:'/fixture'},'tma-cut'),[]);
});
