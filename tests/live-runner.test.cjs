const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
const {LiveRunner}=require('../electron/live-runner.cjs');const {workspaceTool}=require('../electron/workspace.cjs');const {OpenAIConnection}=require('../electron/openai.cjs');
const configuration={hasKey:true,model:'test-model',maxCalls:10,maxOutputTokens:512,autoConfinedApps:false};
const final=text=>({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}],usage:{input_tokens:10,output_tokens:5}});
const call=(name,args)=>({status:'completed',output:[{type:'function_call',name,call_id:'call-'+name,arguments:JSON.stringify(args)}],usage:{input_tokens:10,output_tokens:5}});
const agent=(id,role='Developer')=>({id,name:id,role,description:''});
async function until(check){for(let i=0;i<500;i++){if(check())return;await new Promise(setImmediate);}throw new Error('Expected state was not reached.');}
function fixture(respond,extra={}){
  const prefix=path.join(os.tmpdir(),'agent-office-live-');const folder=fs.mkdtempSync(prefix);const calls=[];let reserved=false;
  const provider={status:()=>({...configuration,...extra.settings}),respond:async args=>{calls.push(args);return respond(args,calls.length);}};
  const apps={config:()=>({workFolder:folder}),allowed:()=>[],tools:async()=>[],run:async()=>({summary:'app result'}),acquire:()=>{if(reserved)return false;reserved=true;return true;},release:()=>{reserved=false;},...extra.apps};
  const runner=new LiveRunner({directory:folder,provider,apps,...(extra.projectFolders?{projectFolders:extra.projectFolders}:{})});
  return {runner,folder,calls,provider,async dispose(){runner.close();await until(()=>!runner.active);assert.ok(path.resolve(folder).startsWith(path.resolve(prefix)));fs.rmSync(folder,{recursive:true,force:true});}};
}
test('live specialists write real files and hand deliverables to the next agent',async()=>{
  const f=fixture(async(args,index)=>index===1?call('workspace_write',{path:'report.md',content:'Verified local output'}):index===2?final('Created report.md with the requested result.'):index===3?call('workspace_read',{path:'report.md'}):final('Reviewed the actual file and its content.'));
  try{
    const job=f.runner.submit({title:'Create and review a report',agents:[agent('builder'),agent('reviewer','Reviewer')]});await until(()=>job.status==='done');
    assert.equal(fs.readFileSync(path.join(f.folder,'report.md'),'utf8'),'Verified local output');assert.equal(job.artifacts.length,2);assert.deepEqual(job.files,['report.md']);
    assert.equal(job.usage.calls,4);assert.equal(job.usage.inputTokens,40);assert.equal(job.usage.outputTokens,20);
    assert.match(f.calls[2].input[0].content,/Created report.md/);
    assert.ok(f.calls[1].input.some(i=>i.type==='function_call_output'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.folder,'live-jobs.json'),'utf8')).jobs[0].status,'done');
  }finally{await f.dispose();}
});

test('Codex specialists use the same confined file tools, durable outputs and handoffs',async()=>{
 const f=fixture(async()=>{throw new Error('API backend must not be called');},{settings:{provider:'codex'}});let stages=0;
 f.provider.runStage=async({input,callTool,onDelta,onUsage})=>{stages++;onDelta('Working');onUsage({inputTokens:12,outputTokens:8});if(stages===1){await callTool({name:'workspace_write',arguments:JSON.stringify({path:'codex.txt',content:'Codex deliverable'})});return 'Created codex.txt';}assert.match(input[0].content,/Created codex.txt/);const result=await callTool({name:'workspace_read',arguments:JSON.stringify({path:'codex.txt'})});return 'Reviewed '+result.content;};
 try{const job=f.runner.submit({title:'Codex handoff',agents:[agent('builder'),agent('reviewer','Reviewer')]});await until(()=>job.status==='done');assert.equal(job.settings.provider,'codex');assert.equal(job.usage.calls,2);assert.equal(job.usage.toolCalls,2);assert.equal(job.usage.inputTokens,24);assert.match(job.artifacts[1].text,/Codex deliverable/);assert.deepEqual(job.files,['codex.txt']);}finally{await f.dispose();}
});

test('a Claude specialist uses its configured provider and passes a real file to the default reviewer',async()=>{
 const f=fixture(async(args,index)=>index===1?call('workspace_write',{path:'claude.txt',content:'Claude specialist output'}):final('Saved or reviewed claude.txt'));f.provider.connectionStatus=name=>({hasKey:name==='claude',model:'sonnet'});
 try{const job=f.runner.submit({title:'Mixed team',agents:[{...agent('claude-builder'),provider:'claude'},agent('reviewer','Reviewer')]});await until(()=>job.status==='done');assert.equal(f.calls[0].provider,'claude');assert.equal(f.calls[0].model,'sonnet');assert.equal(f.calls.at(-1).provider,'openai');assert.match(f.calls.at(-1).input[0].content,/Saved or reviewed/);assert.equal(job.outputVerification.passed,true);}finally{await f.dispose();}
});

test('new project jobs create dedicated folders, reuse their project folder and preserve completed jobs',async()=>{
 let revision=0;const f=fixture(async args=>{const root=JSON.parse(args.input[0].content).workFolder;fs.writeFileSync(path.join(root,'deliverable.txt'),'Saved deliverable '+(++revision));return final('Saved deliverable');});
 try{const payload={title:'Build project',projectId:'project-example',projectWorkspace:true,agents:[agent('builder')]};const first=f.runner.submit(payload);await until(()=>first.status==='done');assert.equal(first.workFolder,path.join(f.folder,'projects','project-example'));assert.equal(fs.statSync(first.workFolder).isDirectory(),true);assert.equal(first.workspaceRoot,f.folder);
 const next=f.runner.submit(payload);await until(()=>next.status==='done');assert.equal(next.workFolder,first.workFolder);const separate=f.runner.submit({...payload,projectId:null});await until(()=>separate.status==='done');assert.notEqual(separate.workFolder,first.workFolder);
 const restored=new LiveRunner({directory:f.folder,provider:f.provider,apps:f.runner.apps});assert.equal(restored.jobs.filter(j=>j.status==='done').length,3);assert.equal(restored.jobs[0].artifacts[0].text,'Saved deliverable');assert.equal(restored.jobs[0].workFolder,first.workFolder);restored.close();
 }finally{await f.dispose();}
});

test('agents and their ArtCraft sessions use the registered project folder outside the default root',async()=>{
 const parent=fs.mkdtempSync(path.join(os.tmpdir(),'office-custom-project-'));const custom=path.join(parent,'Chosen project');fs.mkdirSync(custom);let acquired;
 const f=fixture(async(args,index)=>index===1?call('workspace_write',{path:'output.txt',content:'Saved at the chosen location'}):final('Created output.txt'),{projectFolders:id=>id==='project-custom'?{folderPath:custom,parentFolder:parent}:null,apps:{acquire:root=>{acquired=root;return true;}}});
 try{const job=f.runner.submit({title:'Use chosen location',projectId:'project-custom',projectWorkspace:true,agents:[agent('builder')]});await until(()=>job.status==='done');assert.equal(job.projectFolder,true);assert.equal(job.workFolder,custom);assert.equal(acquired,custom);assert.equal(fs.readFileSync(path.join(custom,'output.txt'),'utf8'),'Saved at the chosen location');assert.equal(job.outputVerification.passed,true);assert.equal(fs.existsSync(path.join(f.folder,'projects','project-custom')),false);}finally{await f.dispose();fs.rmSync(parent,{recursive:true,force:true});}
});

test('text-only claims, empty files and unchanged files cannot mark an AI job completed',async()=>{
 for(const scenario of ['chat','empty','unchanged']){const f=fixture(async args=>{if(scenario==='empty')fs.writeFileSync(path.join(JSON.parse(args.input[0].content).workFolder,'empty.txt'),'');return final('I created the requested deliverable.');});try{if(scenario==='unchanged')fs.writeFileSync(path.join(f.folder,'existing.txt'),'pre-existing');const job=f.runner.submit({title:'Must create something',projectWorkspace:scenario==='chat',agents:[agent('builder')]});await until(()=>job.status==='failed');assert.match(job.error,/No non-empty output/);assert.equal(job.outputVerification.passed,false);assert.equal(job.artifacts.length,1);assert.equal(job.files.length,0);}finally{await f.dispose();}}
});

test('retry creates a new verified attempt and preserves the incomplete job',async()=>{
 let produce=false;const f=fixture(async args=>{if(produce)fs.writeFileSync(path.join(JSON.parse(args.input[0].content).workFolder,'deliverable.md'),'Actual saved result');return final('Task result');});
 try{const old=f.runner.submit({title:'Retry incomplete work',agents:[agent('builder')]});await until(()=>old.status==='failed');assert.equal(f.runner.jobs.length,1);produce=true;const snapshot=f.runner.retry(old.id);const retry=snapshot.jobs.find(j=>j.id!==old.id);await until(()=>retry.status==='done');assert.equal(old.status,'failed');assert.equal(retry.retryOf,old.id);assert.equal(retry.outputVerification.passed,true);assert.notEqual(retry.id,old.id);}finally{await f.dispose();}
});
test('app actions wait for exact approval and unassigned apps cannot execute',async()=>{
  let executed=0;
  const f=fixture(async(args,index)=>index===1?call('app_call',{appId:'vectorcraft',tool:'inspect',arguments_json:'{}'}):index===2?call('workspace_write',{path:'inspection.md',content:'Inspected the assigned app.'}):final('Inspected the assigned app.'),{apps:{allowed:()=>[{id:'vectorcraft',name:'VectorCraft',confined:true}],run:async()=>{executed++;return {summary:'inspected'};}}});
  try{
    const job=f.runner.submit({title:'Inspect',agents:[agent('atlas')]});await until(()=>job.pendingApproval);assert.equal(executed,0);
    f.runner.approve(job.id,job.pendingApproval.id,true);await until(()=>job.status==='done');assert.equal(executed,1);
    const bad=fixture(async(args,index)=>index===1?call('app_call',{appId:'gridcraft',tool:'inspect',arguments_json:'{}'}):final('That app is not assigned.'));
    try{const denied=bad.runner.submit({title:'No access',agents:[agent('atlas')]});await until(()=>denied.status==='failed');assert.match(bad.calls[1].input.at(-1).output,/not assigned/);assert.equal(denied.usage.toolCalls,1);assert.match(denied.error,/No non-empty output/);}finally{await bad.dispose();}
  }finally{await f.dispose();}
});
test('cancellation during app review stops without executing the app',async()=>{
  let executed=0;
  const f=fixture(async()=>call('app_call',{appId:'vectorcraft',tool:'export',arguments_json:'{}'}),{apps:{allowed:()=>[{id:'vectorcraft',name:'VectorCraft',confined:true}],run:async()=>{executed++;return {};}}});
  try{const job=f.runner.submit({title:'Review then stop',agents:[agent('atlas')]});await until(()=>job.pendingApproval);f.runner.cancel(job.id);await until(()=>job.status==='cancelled');assert.equal(executed,0);assert.equal(f.calls.length,1);}finally{await f.dispose();}
});
test('pause prevents model calls and call limits stop tool loops honestly',async()=>{
  const f=fixture(async()=>call('workspace_list',{path:''}),{settings:{maxCalls:5}});
  try{f.runner.setPaused(true);const job=f.runner.submit({title:'Bounded work',agents:[agent('atlas')]});await new Promise(setImmediate);assert.equal(job.status,'queued');assert.equal(f.calls.length,0);f.runner.setPaused(false);await until(()=>job.status==='failed');assert.equal(f.calls.length,5);assert.match(job.error,/limit of 5 model calls/);}finally{await f.dispose();}
});
test('workspace file tools refuse traversal, binary reads and escaping links',()=>{
  const prefix=path.join(os.tmpdir(),'agent-office-files-');const base=fs.mkdtempSync(prefix);const root=path.join(base,'root');const outside=path.join(base,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);
  try{
    assert.throws(()=>workspaceTool(root,'workspace_write',{path:'../outside/leak.txt',content:'no'}),/outside/);
    workspaceTool(root,'workspace_write',{path:'nested/result.txt',content:'yes'});assert.equal(workspaceTool(root,'workspace_read',{path:'nested/result.txt'}).content,'yes');
    fs.writeFileSync(path.join(root,'binary.bin'),Buffer.from([0,1,2]));assert.throws(()=>workspaceTool(root,'workspace_read',{path:'binary.bin'}),/binary/);
    fs.symlinkSync(outside,path.join(root,'escape'),process.platform==='win32'?'junction':'dir');assert.throws(()=>workspaceTool(root,'workspace_write',{path:'escape/no.txt',content:'no'}),/outside/);
    assert.equal(fs.existsSync(path.join(outside,'no.txt')),false);
  }finally{assert.ok(path.resolve(base).startsWith(path.resolve(prefix)));fs.rmSync(base,{recursive:true,force:true});}
});
test('fresh workspaces have no fake jobs and cannot simulate live progress',()=>{
  const E=require('../src/engine.js');const state=E.initial();assert.equal(state.mode,'live');assert.equal(state.jobs.length,0);assert.equal(state.projects.length,0);
  state.jobs.push(E.task('Do not simulate'));assert.equal(E.tick(state),false);assert.equal(state.jobs[0].status,'queued');
});
test('interrupted native jobs become failures without a model call on restart',async()=>{
  const f=fixture(async()=>final('Never called'));
  try{
    f.runner.setPaused(true);const job=f.runner.submit({title:'Interrupted',agents:[agent('atlas')]});job.status='running';f.runner.persist();
    const restored=new LiveRunner({directory:f.folder,provider:f.provider,apps:{config:()=>({workFolder:f.folder})}});
    assert.equal(restored.jobs[0].status,'failed');assert.match(restored.jobs[0].error,/not retried/);assert.equal(f.calls.length,0);restored.close();
  }finally{await f.dispose();}
});
test('OpenAI keys are encrypted, never included in public status, and API requests are bounded',async()=>{
  const prefix=path.join(os.tmpdir(),'agent-office-key-');const folder=fs.mkdtempSync(prefix);const encryption={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from('encrypted:'+value),decryptString:buffer=>buffer.toString().slice(10)};let request;
  try{
    const connection=new OpenAIConnection({directory:folder,safeStorage:encryption,environment:{},fetchImpl:async(url,options)=>{request={url,options};return {ok:true,text:async()=>JSON.stringify(final('Actual provider protocol result'))};}});
    connection.save({apiKey:'sk-unit-test-secret',remember:true,model:'test-model',maxCalls:5,maxOutputTokens:512});
    assert.equal(fs.readFileSync(path.join(folder,'openai.json'),'utf8').includes('sk-unit-test-secret'),false);assert.equal(JSON.stringify(connection.status()).includes('sk-unit'),false);
    await connection.respond({model:'test-model',instructions:'Work',input:[{role:'user',content:'Task'}],tools:[],maxOutputTokens:512});
    assert.equal(request.url,'https://api.openai.com/v1/responses');const body=JSON.parse(request.options.body);assert.equal(body.store,false);assert.equal(body.parallel_tool_calls,false);assert.equal(body.max_output_tokens,512);
    const restored=new OpenAIConnection({directory:folder,safeStorage:encryption,environment:{}});assert.equal(restored.key(),'sk-unit-test-secret');restored.forget();assert.equal(restored.status().hasKey,false);
  }finally{assert.ok(path.resolve(folder).startsWith(path.resolve(prefix)));fs.rmSync(folder,{recursive:true,force:true});}
});
