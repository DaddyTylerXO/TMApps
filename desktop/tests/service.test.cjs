'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const tar = require('tar');
const { Library, trusted, newer, parseCatalog, support, launcherRelease, profile, directories, extract, download, readJSON, atomic } = require('../electron/service.cjs');
const bundled = require('../catalog.json');
const clone = value => structuredClone(value);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function fixture(t, platform = 'linux', arch = 'x64') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tmapps-launcher-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const payload = Buffer.from('#!/bin/sh\nexit 0\n'), catalog = clone(bundled);
  const options = { root: path.join(root, 'profile'), shared: path.join(root, 'shared.json'), data: path.join(root, 'data'), platform, arch, bundled: catalog, fetcher: async () => new Response(payload), integration: async () => {} };
  const library = new Library(options); library.running = async () => []; library.processes = async () => [];
  return { root, payload, catalog, library, addPackage(id = 'tma-agent-office') { const item = catalog.apps.find(a => a.id === id); item.packages = { [`${platform === 'darwin' ? 'macos' : 'linux'}-${arch}`]: { url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/fixture.AppImage', sha256: hash(payload), format: 'appimage', executable: 'Fixture.AppImage' } }; return item; } };
}
test('public catalogs advertise only published OS packages and legacy Windows support', () => {
  const catalog = parseCatalog(clone(bundled));
  for (const app of catalog.apps) { const expected=app.downloadUrl ? ['windows'] : []; assert.deepEqual(support(app), expected); delete app.platforms; assert.deepEqual(support(app), expected); }
  const app = catalog.apps[1]; app.platforms = ['windows', 'macos', 'linux'];
  assert.deepEqual(support(app), ['windows'], 'a claimed OS without a package is not advertised');
  app.packages = { 'linux-arm64': { url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/native.AppImage', sha256: 'a'.repeat(64), format: 'appimage', executable: 'Office.AppImage' } };
  assert.deepEqual(support(parseCatalog(catalog).apps[1]), ['windows', 'linux']);
});
test('package URL, platform, format and executable validation cannot be bypassed', () => {
  for (const bad of ['http://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/a', 'https://github.com.evil.test/DaddyTylerXO/TMApps/releases/download/tma-apps/a', 'https://github.com/attacker/TMApps/releases/download/tma-apps/a', 'https://user@github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/a']) assert.equal(trusted(bad), false);
  const catalog = clone(bundled); catalog.apps[1].packages = { 'linux-x64': { url: 'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/app.tar.gz', sha256: 'a'.repeat(64), format: 'tar.gz', executable: '../outside' } }; assert.throws(() => parseCatalog(catalog));
  catalog.apps[1].packages['linux-x64'].executable = '/outside'; assert.throws(() => parseCatalog(catalog));
  catalog.apps[1].packages['linux-x64'].executable = 'app'; catalog.apps[1].packages['macos-x64'] = { ...catalog.apps[1].packages['linux-x64'], format: 'appimage' }; assert.throws(() => parseCatalog(catalog));
});
test('OS and architecture select native packages without trying a Windows EXE', async t => {
  for (const platform of ['darwin', 'linux']) {
    const f = await fixture(t, platform); await assert.rejects(f.library.install('tma-mail'), /no .+ package/); await assert.rejects(f.library.install('tma-agent-office'), /no .+ package/); assert.equal(f.library.busy, false);
  }
  const f = await fixture(t); f.addPackage(); f.library.arch = 'arm64'; assert.equal(f.library.pkg(f.catalog.apps[1]), null);
});
test('verified install and atomic update retain custom location and app choices', async t => {
  const f = await fixture(t); const app = f.addPackage(); const destination = path.join(f.root, 'Custom Office'); const calls = []; f.library.integration = async (kind, value) => calls.push({ kind, value });
  await f.library.install(app.id, { directory: destination, desktopShortcut: true, runAtStartup: true }); const first = await f.library.installed(app); assert.equal(first.root, destination); assert.equal(first.runAtStartup, true); assert.equal(first.desktopShortcut, true);
  await fs.writeFile(path.join(destination, 'unrelated.txt'), 'keep'); app.version = '9.0.0'; await f.library.install(app.id); const second = await f.library.installed(app);
  assert.notEqual(first.folder, second.folder); assert.equal(second.root, destination); assert.equal(second.runAtStartup, true); assert.equal(await fs.readFile(path.join(destination, 'unrelated.txt'), 'utf8'), 'keep'); assert.equal(calls.length, 2);
  await assert.rejects(fs.stat(path.join(destination, first.folder)), { code: 'ENOENT' });
  app.packages['linux-x64'].sha256 = '0'.repeat(64); await assert.rejects(f.library.install(app.id), /verification failed/); assert.equal((await f.library.installed(app)).folder, second.folder); assert.equal(f.library.busy, false);
});
test('unsupported, nonempty and root destinations cannot be claimed', async t => {
  const f = await fixture(t); f.addPackage(); const folder = path.join(f.root, 'Other files'); await fs.mkdir(folder); await fs.writeFile(path.join(folder, 'keep'), 'keep');
  await assert.rejects(f.library.install('tma-agent-office', { directory: folder }), /empty folder/);
  await assert.rejects(f.library.prepare(path.parse(f.root).root, 'tma-agent-office'), /drive root/);
  await assert.rejects(f.library.installed({ id: 'unknown' }), /Unknown/);
});
test('uninstall keeps data by default, deletes only the selected profile on explicit choice', async t => {
  const f = await fixture(t); const app = f.addPackage(); const folder = path.join(f.library.data, 'agent-office'); const other = path.join(f.library.data, 'external-work'); await fs.mkdir(folder, { recursive: true }); await fs.mkdir(other); await fs.writeFile(path.join(folder, 'account'), 'synthetic'); await fs.writeFile(path.join(other, 'project'), 'keep');
  await f.library.install(app.id); await f.library.uninstall(app.id); assert.equal(await fs.readFile(path.join(folder, 'account'), 'utf8'), 'synthetic');
  await f.library.install(app.id); f.library.processes = async () => [{ executable: '/another-install/Fixture.AppImage', pid: 1 }]; await assert.rejects(f.library.uninstall(app.id, true), /all copies/); assert.ok(await f.library.installed(app));
  f.library.processes = async () => []; await f.library.uninstall(app.id, true); await assert.rejects(fs.stat(folder), { code: 'ENOENT' }); assert.equal(await fs.readFile(path.join(other, 'project'), 'utf8'), 'keep');
});
test('declining to close a running app never signals or removes its files', async t => {
  const f = await fixture(t); const app = f.addPackage(); await f.library.install(app.id); const current = await f.library.installed(app); let asked = 0;
  f.library.running = async () => [{ pid: process.pid, executable: process.execPath, start: 'fixture' }]; f.library.confirm = async () => { asked++; return false; };
  await assert.rejects(f.library.uninstall(app.id), /cancelled/); assert.equal(asked, 1); assert.equal((await f.library.installed(app)).folder, current.folder);
});
test('profile sharing contains no credentials and preserves optional local identity', async t => {
  const f = await fixture(t); let snapshot = await f.library.snapshot(); assert.equal(snapshot.profile.emails.length, 0);
  snapshot = await f.library.saveProfile({ schemaVersion: 1, displayName: '  Example User ', emails: ['one@example.com', 'ONE@example.com', 'two@example.org'], shareWithMail: false, password: 'must not persist', token: 'must not persist' });
  assert.equal(snapshot.profile.displayName, 'Example User'); assert.deepEqual(snapshot.profile.emails, ['one@example.com', 'two@example.org']); assert.equal(snapshot.profile.revision.length, 32); const stored = await fs.readFile(f.library.shared, 'utf8'); assert.equal(stored.includes('password'), false); assert.equal(stored.includes('token'), false);
  await assert.rejects(f.library.saveProfile({ schemaVersion: 1, displayName: 'x', emails: ['bad email'] }), /valid email/); assert.equal((await readJSON(f.library.shared)).displayName, 'Example User'); assert.throws(() => profile({ schemaVersion: 1, displayName: 'name\nother', emails: [] }));
});
test('native config locations follow each OS and remain separate from installed binaries', () => {
  assert.ok(directories('darwin', '/Users/test', {}).shared.endsWith(path.join('Library', 'Application Support', 'TMApps', 'profile.json')));
  assert.equal(directories('linux', '/home/test', { XDG_CONFIG_HOME: '/custom/config' }).shared, path.join('/custom/config', 'TMApps', 'profile.json'));
  assert.equal(directories('linux', '/home/test', { XDG_CONFIG_HOME: 'relative' }).shared, path.join('/home/test', '.config', 'TMApps', 'profile.json'));
});
test('version checks handle numeric versions and never downgrade a stable release', () => { assert.equal(newer('1.10.0', '1.9.0'), true); assert.equal(newer('1.9.0', '1.9.0-beta'), true); assert.equal(newer('1.9.0-beta', '1.9.0'), false); assert.equal(newer('1.9.0', '1.9.0'), false); });
test('settings save and validation invoke only the selected integration choices', async t => {
  const f = await fixture(t); const calls = []; f.library.integration = async (kind, value) => calls.push({ kind, value });
  const result = await f.library.saveSettings({ navigationEdge: 'Bottom', libraryView: 'Grid', runAtStartup: true, closeToTray: false, checkOnStartup: true }); assert.equal(result.settings.navigationEdge, 'Bottom'); assert.equal(calls[0].value.runAtStartup, true);
  await assert.rejects(f.library.saveSettings({ navigationEdge: 'unknown', libraryView: 'Grid' }), /Invalid/);
});
test('an older catalog cannot overwrite a newer saved package version', async t => {
  const f = await fixture(t); f.catalog.apps[0].version = '9.0.0'; f.library.fetcher = async () => new Response(JSON.stringify(bundled)); await f.library.refresh(); assert.equal(f.library.catalog.apps[0].version, '9.0.0');
});
test('archive extraction rejects traversal and links leaving the install folder', async t => {
  const f = await fixture(t); const source = path.join(f.root, 'source'); await fs.mkdir(source); await fs.writeFile(path.join(f.root, 'outside.txt'), 'keep');
  const archive = path.join(f.root, 'traversal.tar.gz'); await tar.c({ cwd: source, file: archive, gzip: true, preservePaths: true }, ['../outside.txt']);
  await assert.rejects(extract(archive, path.join(f.root, 'extracted')), /Unsafe/); assert.equal(await fs.readFile(path.join(f.root, 'outside.txt'), 'utf8'), 'keep');
  const header = Buffer.alloc(512); header.write('link'); header.write('0000777\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116); header.write('00000000000\0', 124); header.write('00000000000\0', 136); header.fill(32, 148, 156); header.write('2', 156); header.write('../../outside', 157); header.write('ustar\0', 257); header.write('00', 263); const sum = header.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0'); header.write(sum + '\0 ', 148); const linked = path.join(f.root, 'link.tar.gz'); await fs.writeFile(linked, zlib.gzipSync(Buffer.concat([header, Buffer.alloc(1024)])));
  await assert.rejects(extract(linked, path.join(f.root, 'links')), /Unsafe/);
});
test('cancelled and corrupt downloads are never activated or left behind', async t => {
  const f = await fixture(t); const destination = path.join(f.root, 'download');
  await assert.rejects(download('https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/file', destination, '0'.repeat(64), { fetcher: async () => new Response(f.payload) }), /verification/); await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
  const controller = new AbortController(); controller.abort(); await assert.rejects(download('https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/file', destination, hash(f.payload), { fetcher: async () => new Response(f.payload), signal: controller.signal })); await assert.rejects(fs.stat(destination), { code: 'ENOENT' });
});
test('native launcher updates select the exact OS/CPU installer and require its checksum', () => {
  const release={platform:'darwin',arch:'arm64',filename:'TMApps-Launcher-2.0.0-mac-arm64.dmg',url:'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/TMApps-Launcher-2.0.0-mac-arm64.dmg',sha256:'a'.repeat(64)};
  const manifest={schemaVersion:1,version:'2.0.0',releases:[release]};
  assert.equal(launcherRelease(manifest,'darwin','arm64','1.9.0').version,'2.0.0');
  assert.equal(launcherRelease(manifest,'linux','arm64','1.9.0'),null);
  assert.equal(launcherRelease(manifest,'darwin','x64','1.9.0'),null);
  assert.equal(launcherRelease(manifest,'darwin','arm64','2.0.0'),null);
  assert.throws(()=>launcherRelease({...manifest,releases:[{...release,url:'https://attacker.test/file.dmg'}]},'darwin','arm64','1.9.0'));
  assert.throws(()=>launcherRelease({...manifest,releases:[{...release,sha256:'missing'}]},'darwin','arm64','1.9.0'));
});
test('a corrupted native cache falls back to the bundled catalog',async t=>{
  const f=await fixture(t); await atomic(path.join(f.library.root,'catalog.json'),{schemaVersion:999});
  assert.equal((await f.library.load()).apps.length,4);
});
test('native close detection finds managed background processes and preserves other copies', {skip:process.platform==='win32'},async t=>{
  const f=await fixture(t,process.platform); const folder=crypto.randomUUID();
  const managedRoot=path.join(f.root,'managed'),stage=path.join(managedRoot,folder); await fs.mkdir(stage,{recursive:true});
  const own=path.join(stage,'node-fixture'),foreign=path.join(f.root,'node-foreign'); await fs.copyFile(process.execPath,own); await fs.copyFile(process.execPath,foreign); await fs.chmod(own,0o755); await fs.chmod(foreign,0o755);
  const {spawn}=require('node:child_process'); const first=spawn(own,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}),other=spawn(foreign,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  t.after(()=>{first.kill('SIGKILL');other.kill('SIGKILL');});
  await new Promise(resolve=>setTimeout(resolve,300));
  const library=new Library({root:path.join(f.root,'real-profile'),shared:path.join(f.root,'shared2'),data:f.root,bundled,platform:process.platform});
  const state={root:managedRoot,folder,executable:'node-fixture'};
  assert.ok((await library.running(state)).some(p=>p.pid===first.pid));
  await assert.rejects(library.closeApp({name:'Fixture'},state),/cancelled/);
  assert.equal(first.exitCode,null); library.confirm=async()=>true;
  await library.closeApp({name:'Fixture'},state); assert.equal((await library.running(state)).length,0); assert.equal(other.exitCode,null);
});

test('Linux x86_64 builder names normalize to the exact x64 update URL',async t=>{
  const f=await fixture(t);const generate=require('../scripts/release-metadata.cjs');
  const name='TMApps-Launcher-1.9.0-linux-x86_64.AppImage';await fs.writeFile(path.join(f.root,name),f.payload);
  const release=generate(f.root,{version:'1.9.0',platform:'linux',arch:'x64'});
  assert.equal(release.filename,'TMApps-Launcher-1.9.0-linux-x64.AppImage');assert.equal(release.sha256,hash(f.payload));
  assert.ok(await fs.stat(path.join(f.root,release.filename)));await assert.rejects(fs.stat(path.join(f.root,name)),{code:'ENOENT'});
});
