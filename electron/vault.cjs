'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
const LIMIT = 16 * 1024 ** 2;
const KDF = Object.freeze({ name: 'scrypt', N: 131072, r: 8, p: 1 });
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function text(value, max = 8192) { if (typeof value !== 'string' || value.length > max || value.includes('\0')) throw Error('Invalid text field.'); return value; }
function origin(value) { if (!value) return ''; const u = new URL(text(value, 2048)); if (u.protocol !== 'https:' || u.username || u.password) throw Error('Website must use HTTPS without embedded credentials.'); return u.origin; }
function entry(value) {
  const title = text(value.title, 200).trim(); if (!title) throw Error('Give this login a name.');
  const expiryDays = Number(value.expiryDays || 0); if (!Number.isInteger(expiryDays) || expiryDays < 0 || expiryDays > 3650) throw Error('Expiry must be between 0 and 3650 days.');
  const folderId = text(value.folderId || '', 36); if (folderId && !/^[a-f\d-]{36}$/.test(folderId)) throw Error('Invalid folder.');
  return { title, username: text(value.username), password: text(value.password), url: origin(value.url), notes: text(value.notes || '', 32000), expiryDays, folderId };
}
function validateData(data) {
  if (data?.schema !== 1 || !Array.isArray(data.entries) || data.entries.length > 20000) throw Error('Unsupported vault contents.');
  const ids = new Set();
  data.folders ??= []; if (!Array.isArray(data.folders) || data.folders.length > 1000) throw Error('Invalid folders.');
  const folders = new Set(), names = new Set();
  for (const f of data.folders) { const name = text(f.name, 80).trim(); if (!name || !/^[a-f\d-]{36}$/.test(f.id) || folders.has(f.id) || names.has(name.toLowerCase())) throw Error('Invalid or duplicate folder.'); folders.add(f.id); names.add(name.toLowerCase()); }
  for (const e of data.entries) { entry(e); if (e.folderId && !folders.has(e.folderId)) throw Error('Folder no longer exists.'); if (!/^[a-f\d-]{36}$/.test(e.id) || ids.has(e.id) || !Number.isFinite(Date.parse(e.updatedAt)) || !Number.isFinite(Date.parse(e.passwordChangedAt))) throw Error('Invalid vault entry.'); ids.add(e.id); }
  return data;
}
function header(h) {
  if (h?.format !== 'TMA-Safe' || h.version !== 1 || h.cipher !== 'aes-256-gcm' || JSON.stringify(h.kdf) !== JSON.stringify(KDF) || typeof h.keyfile !== 'boolean' || !/^[a-f\d]{64}$/.test(h.salt) || !/^[a-f\d]{24}$/.test(h.iv)) throw Error('Unsupported or damaged vault.');
  return { format: h.format, version: h.version, cipher: h.cipher, kdf: KDF, keyfile: h.keyfile, salt: h.salt, iv: h.iv };
}
async function derive(password, salt, keyfile) {
  text(password, 1024); if (keyfile && (!Buffer.isBuffer(keyfile) || keyfile.length !== 32)) throw Error('Select the original 32-byte TMA-Safe key file.');
  const material = crypto.createHash('sha256').update('TMA-Safe/v1\0').update(password).update('\0').update(keyfile || Buffer.alloc(0)).digest();
  try { return await scrypt(material, Buffer.from(salt, 'hex'), 32, { ...KDF, maxmem: 256 * 1024 ** 2 }); } finally { material.fill(0); }
}
function seal(data, key, base) {
  const h = header({ ...base, iv: crypto.randomBytes(12).toString('hex') });
  const cipher = crypto.createCipheriv(h.cipher, key, Buffer.from(h.iv, 'hex')); cipher.setAAD(Buffer.from(JSON.stringify(h)));
  const plain = Buffer.from(JSON.stringify(validateData(data)));
  try { const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]); if (ciphertext.length > LIMIT / 2) throw Error('Vault is too large.'); return JSON.stringify({ ...h, tag: cipher.getAuthTag().toString('hex'), data: ciphertext.toString('base64') }); } finally { plain.fill(0); }
}
async function readBytes(file, limit = LIMIT) {
  const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NONBLOCK || 0)); let bytes;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw Error('Expected a regular file within the size limit.');
    bytes = Buffer.alloc(limit + 1); let length = 0;
    while (length < bytes.length) { const result = await handle.read(bytes, length, bytes.length - length, null); if (!result.bytesRead) break; length += result.bytesRead; }
    if (length > limit) throw Error('File is too large.');
    return Buffer.from(bytes.subarray(0, length));
  } finally { bytes?.fill(0); await handle.close(); }
}
async function read(file) { const bytes = await readBytes(file); try { return bytes.toString('utf8'); } finally { bytes.fill(0); } }
async function encryptedTemp(file, content) {
  const handle = await fs.open(file, 'wx', 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}
async function write(file, content, previous) {
  const lock = file + '.lock'; const guard = await fs.open(lock, 'wx', 0o600).catch(() => { throw Error('Vault is being saved elsewhere, or a stale .lock file needs review.'); });
  const temp = path.join(path.dirname(file), '.' + path.basename(file) + '.' + crypto.randomUUID() + '.tmp');
  const backupTemp = temp + '.bak';
  try {
    if (previous) { const old = await read(file); if (digest(old) !== previous) throw Error('Vault changed on disk. Lock and reopen it before editing.'); await encryptedTemp(backupTemp, old); await fs.rename(backupTemp, file + '.bak'); }
    await encryptedTemp(temp, content);
    if (previous) await fs.rename(temp, file); else { await fs.link(temp, file); await fs.unlink(temp); }
  } finally { await fs.rm(temp, { force: true }); await fs.rm(backupTemp, { force: true }); await guard.close(); await fs.unlink(lock); }
}
class Vault {
  constructor() { this.epoch = 0; this.lock(); }
  lock() { this.epoch++; this.key?.fill(0); this.key = null; this.data = null; this.file = null; this.base = null; this.hash = null; }
  require() { if (!this.key) throw Error('Unlock your vault first.'); }
  async create(file, password, keyfile) {
    this.lock(); const epoch = this.epoch;
    if (text(password, 1024).length < 14) throw Error('Use a master password of at least 14 characters.');
    const base = { format: 'TMA-Safe', version: 1, cipher: 'aes-256-gcm', kdf: KDF, keyfile: !!keyfile, salt: crypto.randomBytes(32).toString('hex'), iv: '0'.repeat(24) };
    const key = await derive(password, base.salt, keyfile);
    try { if (epoch !== this.epoch) throw Error('Unlock cancelled.'); const data = { schema: 1, entries: [] }; const content = seal(data, key, base); await write(file, content); if (epoch !== this.epoch) throw Error('Unlock cancelled.'); Object.assign(this, { key, base, file, data, hash: digest(content) }); } catch (e) { key.fill(0); throw e; }
    return this.list();
  }
  async unlock(file, password, keyfile) {
    this.lock(); const epoch = this.epoch; const content = await read(file); const envelope = JSON.parse(content); const base = header(envelope);
    if (base.keyfile && !keyfile) throw Error('This vault also needs its separate key file.');
    if (!/^[a-f\d]{32}$/.test(envelope.tag) || typeof envelope.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(envelope.data)) throw Error('Damaged vault.');
    const key = await derive(password, base.salt, base.keyfile ? keyfile : null); let plain, unauthenticated;
    try {
      const decipher = crypto.createDecipheriv(base.cipher, key, Buffer.from(base.iv, 'hex')); decipher.setAAD(Buffer.from(JSON.stringify(base))); decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
      unauthenticated = decipher.update(Buffer.from(envelope.data, 'base64'));
      plain = Buffer.concat([unauthenticated, decipher.final()]); const data = validateData(JSON.parse(plain.toString('utf8')));
      if (epoch !== this.epoch) throw Error('Unlock cancelled.'); Object.assign(this, { key, base, file, data, hash: digest(content) });
    } catch { key.fill(0); throw Error('Could not unlock. Check the master password, key file, and vault integrity.'); } finally { plain?.fill(0); unauthenticated?.fill(0); }
    return this.list();
  }
  list() { this.require(); return { file: this.file, keyfile: this.base.keyfile, folders: structuredClone(this.data.folders || []), entries: this.data.entries.map(({ password, ...e }) => ({ ...e, expired: e.expiryDays > 0 && Date.now() >= Date.parse(e.passwordChangedAt) + e.expiryDays * 86400000 })) }; }
  async mutate(change) {
    this.require(); const data = structuredClone(this.data), epoch = this.epoch; change(data); const content = seal(data, this.key, this.base); await write(this.file, content, this.hash);
    if (epoch !== this.epoch) throw Error('Vault locked during save. Reopen to see saved changes.'); this.data = data; this.hash = digest(content); return this.list();
  }
  async put(value) {
    const clean = entry(value); return this.mutate(data => { const old = value.id ? data.entries.find(e => e.id === value.id) : null; if (value.id && !old) throw Error('Login no longer exists.'); const now = new Date().toISOString(); const saved = { ...clean, id: old?.id || crypto.randomUUID(), updatedAt: now, passwordChangedAt: old && old.password === clean.password ? old.passwordChangedAt : now }; if (old) data.entries[data.entries.indexOf(old)] = saved; else data.entries.push(saved); });
  }
  secret(id) { this.require(); const found = this.data.entries.find(e => e.id === id); if (!found) throw Error('Login no longer exists.'); return found; }
  async remove(id) { return this.mutate(data => { const index = data.entries.findIndex(e => e.id === id); if (index < 0) throw Error('Login no longer exists.'); data.entries.splice(index, 1); }); }
  async folder(value) { return this.mutate(data => { data.folders ??= []; const name = text(value.name, 80).trim(); if (!name) throw Error('Give the folder a name.'); if (data.folders.some(f => f.id !== value.id && f.name.toLowerCase() === name.toLowerCase())) throw Error('A folder with this name already exists.'); const old = value.id ? data.folders.find(f => f.id === value.id) : null; if (value.id && !old) throw Error('Folder no longer exists.'); if (old) old.name = name; else data.folders.push({ id: crypto.randomUUID(), name }); }); }
  async removeFolder(id) { return this.mutate(data => { if (!(data.folders || []).some(f => f.id === id)) throw Error('Folder no longer exists.'); data.folders = data.folders.filter(f => f.id !== id); for (const e of data.entries) if (e.folderId === id) e.folderId = ''; }); }
  async import(values) { const entries = values.map(entry); return this.mutate(data => { for (const e of entries) { if (data.entries.some(v => v.url === e.url && v.username === e.username && v.password === e.password)) continue; const now = new Date().toISOString(); data.entries.push({ ...e, id: crypto.randomUUID(), updatedAt: now, passwordChangedAt: now }); } }); }
  async copy(destination) { this.require(); await write(destination, seal(this.data, this.key, this.base)); }
}
function generate(options = {}) {
  const length = Number(options.length ?? 24); if (!Number.isInteger(length) || length < 8 || length > 128) throw Error('Choose 8–128 characters.');
  let groups = [options.lower !== false && 'abcdefghijklmnopqrstuvwxyz', options.upper !== false && 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', options.numbers !== false && '0123456789', options.symbols !== false && '!@#$%^&*()-_=+[]{};:,.?'].filter(Boolean);
  if (options.excludeSimilar) groups = groups.map(g => g.replace(/[Il1O0o]/g, ''));
  if (!groups.length) throw Error('Choose at least one character type.'); const all = groups.join('');
  // Rejection sampling is uniform over strings satisfying the selected groups.
  for (;;) { const chars = Array.from({ length }, () => all[crypto.randomInt(all.length)]); if (groups.every(g => chars.some(c => g.includes(c)))) return chars.join(''); }
}
module.exports = { Vault, generate, entry, origin, read, readBytes, KDF };
