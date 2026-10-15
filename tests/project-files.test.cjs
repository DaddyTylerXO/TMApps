const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {projectFiles,readProjectFile,openProjectFolder}=require('../electron/project-files.cjs');
test('project browser reads nested output, refreshes disk changes and refuses escaping links',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'office-project-files-'));const work=path.join(root,'work');fs.mkdirSync(path.join(work,'nested'),{recursive:true});const jobs=[{id:'saved-job',native:true,workFolder:work,workspaceRoot:root}];
 try{fs.writeFileSync(path.join(work,'nested','report.md'),'First output');let data=await projectFiles(jobs,'saved-job');assert.equal(data.entries.find(e=>e.name==='report.md').kind,'file');assert.equal(readProjectFile(jobs,'saved-job','nested/report.md').content,'First output');
 fs.writeFileSync(path.join(work,'nested','report.md'),'Updated output with more detail');data=await projectFiles(jobs,'saved-job');assert.equal(data.entries.find(e=>e.name==='report.md').size,31);assert.match(readProjectFile(jobs,'saved-job','nested/report.md').content,/Updated/);
 fs.writeFileSync(path.join(root,'private.txt'),'outside');assert.throws(()=>readProjectFile(jobs,'saved-job','../private.txt'),/outside/);fs.symlinkSync(root,path.join(work,'escape'),process.platform==='win32'?'junction':'dir');data=await projectFiles(jobs,'saved-job');assert.equal(data.entries.find(e=>e.name==='escape').kind,'link');assert.ok(!data.entries.some(e=>e.path.includes('escape'+path.sep)));assert.throws(()=>readProjectFile(jobs,'saved-job','escape/private.txt'),/outside/);
 fs.writeFileSync(path.join(work,'binary.dat'),Buffer.from([0,1]));assert.throws(()=>readProjectFile(jobs,'saved-job','binary.dat'),/binary/);assert.throws(()=>readProjectFile(jobs,'unknown','x'),/no saved project/);
 let opened;await openProjectFolder(jobs,'saved-job',{openPath:async value=>{opened=value;return '';}});assert.equal(opened,fs.realpathSync(work));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
