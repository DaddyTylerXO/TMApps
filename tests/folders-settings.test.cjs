'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const { Vault } = require('../electron/vault.cjs'), settings = require('../electron/settings.cjs');
test('folders are encrypted, portable, and can be removed without deleting passwords', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'safe-folders-')); t.after(() => fs.rm(root,{recursive:true,force:true}));
  const file = path.join(root,'vault.tmasafe'), v = new Vault(); t.after(() => v.lock()); const password = 'fictional folder test passphrase';
  await v.create(file,password); await v.put({title:'A login',username:'test',password:'fake-secret',url:'https://example.com'}); const original = v.list().entries[0];
  await v.folder({name:'Private accounts'}); const folder = v.list().folders[0]; await assert.rejects(v.folder({name:' private ACCOUNTS '}),/already exists/);
  await v.put({...v.secret(original.id),folderId:folder.id}); assert.equal(v.list().entries[0].passwordChangedAt,original.passwordChangedAt);
  assert.ok(!(await fs.readFile(file,'utf8')).includes('Private accounts')); v.lock(); await v.unlock(file,password); assert.equal(v.list().entries[0].folderId,folder.id);
  await v.folder({id:folder.id,name:'Renamed folder'}); assert.equal(v.list().folders[0].name,'Renamed folder'); await v.removeFolder(folder.id);
  assert.equal(v.list().folders.length,0); assert.equal(v.list().entries[0].folderId,''); assert.equal(v.secret(original.id).password,'fake-secret');
  await assert.rejects(v.put({...v.secret(original.id),folderId:folder.id}),/no longer exists/);
});
test('settings persist validated options and startup filenames cannot inject desktop fields', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'safe-settings-')); t.after(() => fs.rm(root,{recursive:true,force:true})); const file=path.join(root,'settings.json');
  assert.deepEqual(await settings.load(file),settings.defaults);
  const value={...settings.defaults,openAtLogin:true,showTray:true,closeToTray:true,idleMinutes:10,clipboardSeconds:30}; await settings.save(file,value); assert.deepEqual(await settings.load(file),value);
  assert.throws(() => settings.validate({...value,showTray:false}),/tray icon/); assert.throws(() => settings.validate({...value,idleMinutes:0}));
  assert.throws(() => settings.desktopEntry('/tmp/app\nExec=other'),/Invalid/); assert.match(settings.desktopEntry('/home/test/My Safe.AppImage'),/Exec="\/home\/test\/My Safe.AppImage"/);
  const desktop=path.join(root,'autostart','tma-safe.desktop'); await settings.linuxStartup(desktop,'/home/test/My Safe.AppImage',true); assert.match(await fs.readFile(desktop,'utf8'),/Type=Application/); await settings.linuxStartup(desktop,'/home/test/My Safe.AppImage',false); await assert.rejects(fs.stat(desktop),/ENOENT/);
});
