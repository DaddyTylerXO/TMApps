'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
test('catalog publishing preserves other apps, verifies hashes and keeps SocialsManager before Agent Office last',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'padlock-release-'));
 try{
  const platforms=[['win32','x64'],['darwin','x64'],['darwin','arm64'],['linux','x64'],['linux','arm64']];
  for(const[platform,arch]of platforms){const filename=`test-${platform}-${arch}.zip`,bytes=Buffer.from(platform+arch),artifact={filename,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),url:'https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/'+filename};await fs.writeFile(path.join(dir,filename),bytes);await fs.writeFile(path.join(dir,`padlock-metadata-${platform}-${arch}.json`),JSON.stringify({version:'0.4.0',platform,arch,osVersion:'Synthetic native OS',osRelease:'test',date:'2026-10-24',sourceCommit:'a'.repeat(40),workflow:'https://github.com/DaddyTylerXO/TMApps/actions/runs/1',package:{...artifact,format:'zip',executable:'test'},artifacts:[artifact]}));}
  const original={schemaVersion:1,apps:[{id:'tma-mail',version:'9.8.7'},{id:'tma-agent-office',version:'8.7.6'},{id:'tma-safe',version:'7.6.5'},{id:'tma-socialsmanager',version:'6.5.4'}]},prior=path.join(dir,'prior.json'),output=path.join(dir,'out.json');await fs.writeFile(prior,JSON.stringify(original));
  const run=()=>spawnSync(process.execPath,[path.join(__dirname,'../scripts/publish-catalog.cjs'),dir,prior,output],{encoding:'utf8'});
  assert.equal(run().status,0);const published=JSON.parse(await fs.readFile(output,'utf8'));assert.deepEqual(published.apps.slice(-2).map(a=>a.id),['tma-socialsmanager','tma-agent-office']);for(const app of original.apps)assert.deepEqual(published.apps.find(a=>a.id===app.id),app);const padlock=published.apps.find(a=>a.id==='tma-padlock');assert.equal(padlock.verification.length,5);assert.equal(padlock.sourceCommit,'a'.repeat(40));assert.match(padlock.releaseNotes,/backup/);await fs.writeFile(path.join(dir,'test-win32-x64.zip'),'tampered');assert.notEqual(run().status,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
