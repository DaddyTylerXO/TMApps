'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Vault, generate } = require('../electron/vault.cjs');
const { parseCSV } = require('../electron/import.cjs');
const password = 'a long unique test passphrase';
const login = { title: '<img src=x onerror=alert(1)>', username: 'private@example.com', password: 'VerySecret!12345', url: 'https://example.com/account', notes: 'Private notes', expiryDays: 30 };
test('encrypted vault lifecycle, integrity, key factor, portability and concurrent writes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tma-safe-test-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'test.tmasafe'), copy = path.join(root, 'copy.tmasafe'); const key = crypto.randomBytes(32), v = new Vault(); t.after(() => v.lock());
  await assert.rejects(v.create(file, 'short'), /14 characters/);
  await v.create(file, password, key); await v.put(login); const id = v.list().entries[0].id;
  assert.equal(v.list().entries[0].url, 'https://example.com'); assert.equal(v.list().entries[0].password, undefined);
  const content = await fs.readFile(file, 'utf8'); for (const value of [login.password, login.username, login.notes, 'example.com']) assert.ok(!content.includes(value));
  const before = v.secret(id).passwordChangedAt; await v.put({ ...login, title: 'Edited title', id }); assert.equal(v.secret(id).passwordChangedAt, before);
  assert.ok((await fs.readFile(file + '.bak', 'utf8')).includes('aes-256-gcm'));
  await v.copy(copy); await assert.rejects(v.copy(copy), /EEXIST/);
  const held = v.key; v.lock(); assert.ok(held.every(byte => byte === 0)); assert.throws(() => v.secret(id), /Unlock/);
  await assert.rejects(v.unlock(file, password), /key file/);
  await assert.rejects(v.unlock(file, 'incorrect password', key), /Could not unlock/);
  await assert.rejects(v.unlock(file, password, crypto.randomBytes(32)), /Could not unlock/);
  await v.unlock(copy, password, key); assert.equal(v.secret(id).password, login.password);
  await v.put({ ...login, password: 'changed', id }); assert.notEqual(v.secret(id).passwordChangedAt, before);
  const other = new Vault(); t.after(() => other.lock()); await other.unlock(copy, password, key); await v.put({ ...login, id, title: 'Newest on disk' }); await assert.rejects(other.put({ ...login, id }), /changed on disk/);
  const tampered = JSON.parse(content); tampered.data = (tampered.data[0] === 'A' ? 'B' : 'A') + tampered.data.slice(1); await fs.writeFile(file, JSON.stringify(tampered)); await assert.rejects(v.unlock(file, password, key), /Could not unlock/);
  tampered.kdf.N = 2 ** 30; await fs.writeFile(file, JSON.stringify(tampered)); await assert.rejects(v.unlock(file, password, key), /Unsupported/);
  const moved = path.join(root, 'moved.tmasafe'); await fs.rename(copy, moved); await v.unlock(moved, password, key); assert.equal(v.secret(id).title, 'Newest on disk');
  await v.remove(id); assert.equal(v.list().entries.length, 0);
  await assert.rejects(v.create(moved, password), /EEXIST/); // Never replace an existing vault.
});
test('locking while a master key is deriving cancels unlock', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tma-safe-cancel-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const file = path.join(root, 'test.tmasafe'), v = new Vault(); await v.create(file, password); v.lock();
  const pending = v.unlock(file, password); setTimeout(() => v.lock(), 30); await assert.rejects(pending); assert.equal(v.key, null);
});
test('generator constraints and secure source', () => {
  for (let i = 0; i < 80; i++) { const result = generate({ length: 20, excludeSimilar: true }); assert.equal(result.length, 20); assert.match(result, /[a-z]/); assert.match(result, /[A-Z]/); assert.match(result, /[2-9]/); assert.match(result, /[^a-zA-Z0-9]/); assert.doesNotMatch(result, /[Il1O0o]/); }
  assert.match(generate({ length: 12, lower: false, upper: false, symbols: false }), /^\d{12}$/);
  assert.throws(() => generate({ lower: false, upper: false, numbers: false, symbols: false })); assert.throws(() => generate({ length: 3 }));
});
test('browser CSV handles Chromium and Firefox columns, multiline notes, rejected rows and malformed input', () => {
  const parsed = parseCSV('\uFEFFname,url,username,password,note\r\nExample,https://example.com/path,me,"a,b","line one\nline ""two"""\r\nUnsafe,http://unsafe.test,me,pw,\r\n');
  assert.equal(parsed.entries.length, 1); assert.equal(parsed.entries[0].password, 'a,b'); assert.equal(parsed.entries[0].notes, 'line one\nline "two"'); assert.deepEqual(parsed.skipped, [3]);
  const firefox = parseCSV('url,username,password,httpRealm,formActionOrigin,guid,timeCreated,timeLastUsed,timePasswordChanged\nhttps://example.com,me,pw,,https://example.com,guid,1,1,1'); assert.equal(firefox.entries[0].title, 'example.com');
  assert.throws(() => parseCSV('name,password\na,b'), /Expected/); assert.throws(() => parseCSV('name,url,username,password\na,https://a.com,b,"broken'), /Unclosed/);
});
