'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module'),assert=require('node:assert/strict');
const builder=createRequire(require.resolve('electron-builder')),dependencies=createRequire(builder.resolve('app-builder-lib'));
const {getCurrentFuseWire,FuseV1Options}=dependencies('@electron/fuses');
const expected={RunAsNode:48,EnableNodeOptionsEnvironmentVariable:48,EnableNodeCliInspectArguments:48,EnableEmbeddedAsarIntegrityValidation:49,OnlyLoadAppFromAsar:49};
function find(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=path.join(dir,e.name);if(e.isDirectory()){if(e.name==='TMA-Padlock.app')return[file];if(e.name==='win-unpacked'||e.name.startsWith('linux')||e.name.startsWith('mac'))return find(file);return [];}return e.name==='TMA-Padlock.exe'||e.name==='TMA-Padlock'?[file]:[];});}
(async()=>{const paths=process.argv[2]?[process.argv[2]]:find(path.join(__dirname,'../dist'));assert.ok(paths.length,'No packaged app found.');for(const binary of paths){const wire=await getCurrentFuseWire(binary);for(const [name,value]of Object.entries(expected))assert.equal(wire[FuseV1Options[name]],value,'Unsafe packaged fuse: '+name);console.log('Verified packaged runtime fuses: '+path.basename(binary));}})().catch(e=>{console.error(e.message);process.exitCode=1;});
