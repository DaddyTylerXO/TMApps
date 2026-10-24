'use strict';
const { test } = require('node:test'); const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { Vault, readBytes } = require('../electron/vault.cjs');
const password = 'fictional security test passphrase';
test('backup replacement does not overwrite a hard-linked target, and remains encrypted', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'safe-security-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'vault.tmasafe'), victim = path.join(root, 'unrelated.txt'), vault = new Vault(); t.after(() => vault.lock());
  await vault.create(file, password); const original = await fs.readFile(file, 'utf8');
  await fs.writeFile(victim, 'DO NOT OVERWRITE'); await fs.link(victim, file + '.bak');
  await vault.put({ title: 'Example', username: 'private-user', password: 'private-password', url: 'https://example.com' });
  assert.equal(await fs.readFile(victim, 'utf8'), 'DO NOT OVERWRITE'); assert.equal(await fs.readFile(file + '.bak', 'utf8'), original);
  for (const name of await fs.readdir(root)) { if (name.endsWith('.tmasafe') || name.endsWith('.bak')) { const body = await fs.readFile(path.join(root, name), 'utf8'); assert.ok(!body.includes('private-password')); assert.ok(!body.includes('private-user')); } }
  if (process.platform !== 'win32') assert.equal((await fs.stat(file + '.bak')).mode & 0o777, 0o600);
});
test('bounded file reader rejects directories and oversized key material', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'safe-bounds-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await assert.rejects(readBytes(root, 32)); const file = path.join(root, 'key'); await fs.writeFile(file, Buffer.alloc(33)); await assert.rejects(readBytes(file, 32), /size limit/);
  await fs.writeFile(file, crypto.randomBytes(32)); assert.deepEqual(await readBytes(file, 32), await fs.readFile(file));
});
test('authentication failures wipe intermediate decrypted bytes and leave vault locked', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'safe-auth-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'vault.tmasafe'), vault = new Vault(); t.after(() => vault.lock()); await vault.create(file, password);
  const envelope = JSON.parse(await fs.readFile(file, 'utf8')); envelope.tag = '0'.repeat(32); await fs.writeFile(file, JSON.stringify(envelope));
  const original = crypto.createDecipheriv; let intermediate;
  crypto.createDecipheriv = (...args) => { const decipher = original(...args), update = decipher.update.bind(decipher); decipher.update = (...values) => (intermediate = update(...values)); return decipher; };
  try { await assert.rejects(vault.unlock(file, password), /Could not unlock/); assert.ok(intermediate.length > 0); assert.ok(intermediate.every(b => b === 0)); assert.equal(vault.key, null); assert.equal(vault.data, null); }
  finally { crypto.createDecipheriv = original; }
});
test('Windows transient rename locks retry without unlinking the original vault', {skip:process.platform!=='win32'}, async t => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'safe-rename-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const vault=new Vault();t.after(()=>vault.lock());const file=path.join(root,'vault.tmasafe');await vault.create(file,password);
  const rename=fs.rename;let attempts=0;fs.rename=async(...args)=>{if(attempts++<2){const error=Error('Fictional transient scanner lock');error.code='EPERM';throw error;}return rename(...args);};
  try{await vault.put({title:'Example',username:'demo',password:'fictional'});assert.ok(attempts>=3);assert.equal(vault.list().entries.length,1);}
  finally{fs.rename=rename;}
});
