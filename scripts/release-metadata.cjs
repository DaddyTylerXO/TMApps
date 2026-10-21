'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]||'release-output'),version=require('../package.json').version;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8').replace(/^\uFEFF/,''));
if(catalog.schemaVersion!==1||!Array.isArray(catalog.apps))throw new Error('Invalid existing release catalog.');
const base='https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/';
function asset(filename){const file=path.join(root,filename);if(!fs.existsSync(file)&&filename.endsWith('-linux-x64.AppImage'))fs.renameSync(file.replace('-linux-x64.AppImage','-linux-x86_64.AppImage'),file);if(!fs.statSync(file).size)throw new Error('Empty package.');const sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');fs.writeFileSync(file+'.sha256',`${sha256}  ${filename}\n`);return {url:base+filename,sha256};}
const windows=asset(`TMA-Cut-${version}-win-x64.zip`);
const entry={id:'tma-cut',name:'TMA-Cut',category:'VIDEO & CREATIVITY',description:'A flexible creative studio. Stack video tracks, mix audio, style captions, and export your next story.',version,updatedAt:new Date().toISOString(),branch:'TMA-Cut',releaseNotes:'0.2.0: stacked timeline, colour and audio tools, captions/TTS setup, templates, workspace customisation and illustrated KB guides.',executable:'TMA-Cut.exe',downloadUrl:windows.url,sha256:windows.sha256,platforms:['windows','macos','linux'],packages:{}};
for(const arch of ['x64','arm64'])entry.packages['macos-'+arch]={...asset(`TMA-Cut-${version}-mac-${arch}.tar.gz`),format:'tar.gz',executable:'TMA-Cut.app/Contents/MacOS/TMA-Cut'};
const linux=`TMA-Cut-${version}-linux-x64.AppImage`;entry.packages['linux-x64']={...asset(linux),format:'appimage',executable:linux};
for(const arch of ['x64','arm64'])asset(`TMA-Cut-${version}-mac-${arch}.dmg`);
const existing=catalog.apps.findIndex(a=>a.id===entry.id);if(existing>=0)catalog.apps[existing]=entry;else catalog.apps.push(entry);
asset('TMA-Cut-KB-Library.docx');
for(const name of ['SocialsManager','Agent Office']){const index=catalog.apps.findIndex(a=>a.name===name);if(index>=0)catalog.apps.push(...catalog.apps.splice(index,1));}
fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(catalog,null,2)+'\n');
