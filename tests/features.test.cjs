'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const settings = require('../electron/settings.cjs'), { appearance, palettes } = require('../ui/appearance.js'), { Vault } = require('../electron/vault.cjs'), support = require('../electron/support.cjs');
test('appearance schedules interpolate across midnight, finish on restart, and honour reduced motion', () => {
  const prefs = { ...settings.defaults, scheduleEnabled:true, scheduleStart:'23:50', scheduleEnd:'07:00', transitionMinutes:30 };
  assert.deepEqual(appearance(prefs,new Date(2026,9,23,23,50)).colors,palettes.purple);
  const middle = appearance(prefs,new Date(2026,9,24,0,5)); assert.notDeepEqual(middle.colors,palettes.purple); assert.notDeepEqual(middle.colors,palettes.black); assert.ok(middle.nextMs <= 30000);
  assert.deepEqual(appearance(prefs,new Date(2026,9,24,0,30)).colors,palettes.black);
  assert.deepEqual(appearance(prefs,new Date(2026,9,24,0,5),true).colors,palettes.black);
  assert.deepEqual(appearance(prefs,new Date(2026,9,24,8,0)).colors,palettes.purple);
  assert.throws(() => settings.validate({...prefs,scheduleStart:'25:00'})); assert.throws(() => settings.validate({...prefs,scheduleEnd:'23:50'}));
  assert.throws(() => settings.validate({...prefs,generator:{...settings.generatorDefaults,lower:false,upper:false,numbers:false,symbols:false}}));
});
test('API and card secrets remain encrypted and absent from metadata, with portable typed records', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'safe-records-'));t.after(()=>fs.rm(root,{recursive:true,force:true})); const vault = new Vault();t.after(()=>vault.lock());const file=path.join(root,'vault.tmasafe'),password='fictional typed records passphrase';
  await vault.create(file,password); await vault.put({kind:'api',title:'Fictional app',username:'fake@example.com',clientId:'fictional-client-id',password:'fictional-client-secret',url:'https://example.com'});
  await vault.put({kind:'card',title:'Fictional card',username:'Demo user',password:JSON.stringify({number:'0000 0000 0000 0000',expiry:'12/30',cvv:'000'})});
  const body = await fs.readFile(file,'utf8');for(const text of ['fictional-client-secret','fictional-client-id','0000000000000000','12/30'])assert.ok(!body.includes(text));
  assert.ok(vault.list().entries.every(e=>!('password' in e))); assert.equal(vault.list().entries[0].url,''); vault.lock();await vault.unlock(file,password);assert.equal(vault.list().entries[0].kind,'api');assert.equal(vault.list().entries[0].clientId,'fictional-client-id');assert.equal(JSON.parse(vault.secret(vault.list().entries[1].id).password).number,'0000000000000000');
  await assert.rejects(vault.put({kind:'card',title:'Invalid',username:'Demo',password:JSON.stringify({number:'short',expiry:'99/00',cvv:'1'})}));
});
test('support drafts use fixed categories and cannot disclose arbitrary error content or URLs', () => {
  for(const value of ['fictional-secret-password at C:\\private\\vault.tmasafe','Could not unlock with fictional-secret','renderer crash fake@example.com']) { const text=support.report('crash',value);assert.ok(!text.includes('fictional-secret'));assert.ok(!text.includes('fake@example.com'));assert.ok(!text.includes('C:\\private')); }
  assert.throws(()=>support.link('https://attacker.example'));assert.equal(support.link('feature').hostname,'github.com');assert.equal(support.link('issue').searchParams.get('template'),'general-issue.md');
});
test('offline health snapshots reveal counts only, and encrypted merge preserves folders and typed records', async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'safe-health-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const a=new Vault(),b=new Vault();t.after(()=>{a.lock();b.lock()});
  await a.create(path.join(root,'source.tmasafe'),'fictional source passphrase');await b.create(path.join(root,'target.tmasafe'),'fictional target passphrase');await a.folder({name:'Fictional folder'});
  const login={title:'One',username:'private@example.com',password:'fake-shared',url:'https://example.com',folderId:a.list().folders[0].id,breached:true,breachSource:'Manually supplied fictional report'};
  await a.put(login);await a.put({...login,title:'Two',username:'other',breached:false});const report=a.audit();assert.equal(report.total,2);assert.equal(report.reused,2);assert.equal(report.short,2);assert.equal(report.flagged,1);assert.equal(report.history.length,1);assert.ok(!JSON.stringify(report).includes('fake-shared'));assert.ok(!JSON.stringify(report).includes('private@example.com'));
  await b.merge(a.data);assert.equal(b.list().entries.length,2);assert.equal(b.list().folders[0].name,'Fictional folder');assert.ok(b.list().entries.every(e=>e.folderId===b.list().folders[0].id));await b.merge(a.data);assert.equal(b.list().entries.length,2);
  a.lock();assert.throws(()=>a.audit(),/Unlock/);
});
