const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {PassThrough,Writable}=require('node:stream');const {EventEmitter}=require('node:events');
const {CodexConnection}=require('../electron/codex.cjs');
function fixture({fail=false,hold=false,image=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'office-codex-'));const sent=[];let child,options;
 const spawnImpl=(_exe,args,opts)=>{
  options=opts;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>child.emit('exit',0);
  const notify=(method,params)=>child.stdout.write(JSON.stringify({method,params})+'\n');
  const reply=(id,result)=>child.stdout.write(JSON.stringify({id,result})+'\n');
  child.stdin=new Writable({write(chunk,encoding,done){const m=JSON.parse(chunk.toString());sent.push(m);done();if(!m.method&&m.id!==900)return;
    setImmediate(()=>{
      if(m.method==='initialize')reply(m.id,{userAgent:'test'});
      else if(m.method==='account/read')reply(m.id,{account:{type:'chatgpt',email:'user@example.com',planType:'plus',accessToken:'never-expose'}});
      else if(m.method==='model/list')reply(m.id,{data:[{model:'codex-test',displayName:'Codex test',isDefault:true}]});
      else if(m.method==='account/rateLimits/read')reply(m.id,{rateLimits:{primary:{usedPercent:12}}});
      else if(m.method==='account/login/start')reply(m.id,{loginId:'login-1',authUrl:'https://auth.openai.com/authorize?test=1'});
      else if(m.method==='thread/start')reply(m.id,{thread:{id:'thread-1'}});
      else if(m.method==='turn/start'){
        reply(m.id,{turn:{id:'turn-1'}});notify('turn/started',{threadId:'thread-1',turn:{id:'turn-1'}});
        if(!hold){child.stdout.write(JSON.stringify({id:900,method:'item/tool/call',params:{threadId:'thread-1',turnId:'turn-1',tool:'workspace_write',arguments:{path:'report.md',content:'actual output'}}})+'\n');}
      }
      else if(m.method==='thread/unsubscribe'||m.method==='turn/interrupt'||m.method==='account/login/cancel'||m.method==='account/logout')reply(m.id,{});
    });
    if(m.id===900){setImmediate(()=>{if(image)notify('item/completed',{threadId:'thread-1',item:{id:'image-1',type:'imageGeneration',status:'completed',result:'image-bytes'}});notify('item/agentMessage/delta',{threadId:'thread-1',delta:'Created report.md.'});notify('thread/tokenUsage/updated',{threadId:'thread-1',tokenUsage:{total:{inputTokens:11,outputTokens:7}}});notify('turn/completed',{threadId:'thread-1',turn:{id:'turn-1',status:fail?'failed':'completed',error:fail?{message:'Usage limit reached'}:null}});});}
  }});return child;
 };
 const codex=new CodexConnection({directory,spawnImpl,environment:{PATH:'',OPENAI_API_KEY:'private-api-key',CODEX_ACCESS_TOKEN:'private-token'}});codex.config.executable='C:\\runtime\\codex.exe';
 return {codex,sent,directory,get options(){return options;},get child(){return child;},dispose(){codex.close();fs.rmSync(directory,{recursive:true,force:true});}};
}
test('Codex signs in through browser, isolates its profile and exposes no credentials',async()=>{
 const f=fixture();try{let opened;await f.codex.login(async url=>{opened=url;});assert.match(opened,/https:\/\/auth.openai.com/);await f.codex.cancelLogin();await f.codex.refresh();assert.equal(f.codex.status().model,'codex-test');assert.equal(f.codex.status().hasKey,true);assert.equal(JSON.stringify(f.codex.status()).includes('never-expose'),false);assert.equal(f.options.env.OPENAI_API_KEY,undefined);assert.equal(f.options.env.CODEX_ACCESS_TOKEN,undefined);assert.equal(f.options.env.CODEX_HOME,path.join(f.directory,'codex-profile'));}finally{f.dispose();}
});
test('Codex streams a real protocol turn and routes tool requests through the host',async()=>{
 const f=fixture();try{let invocation,delta,usage;const result=await f.codex.runStage({cwd:f.directory,instructions:'Write report',input:[],tools:[{name:'workspace_write',description:'Write',parameters:{type:'object'}}],signal:new AbortController().signal,callTool:async call=>{invocation=call;return {path:'report.md'};},onDelta:value=>delta=value,onUsage:value=>usage=value});assert.equal(result,'Created report.md.');assert.equal(delta,result);assert.equal(usage.outputTokens,7);assert.equal(invocation.name,'workspace_write');const start=f.sent.find(m=>m.method==='thread/start');assert.deepEqual(start.params.environments,[]);assert.equal(start.params.sandbox,'workspace-write');assert.equal(start.params.cwd,f.directory);assert.deepEqual(start.params.runtimeWorkspaceRoots,[f.directory]);assert.equal(start.params.dynamicTools[0].name,'workspace_write');assert.equal(f.sent.find(m=>m.id===900).result.success,true);}finally{f.dispose();}
});
test('Codex failures never become completed deliverables',async()=>{const f=fixture({fail:true});try{await assert.rejects(()=>f.codex.runStage({cwd:f.directory,instructions:'Work',input:[],tools:[{name:'workspace_write'}],signal:new AbortController().signal,callTool:async()=>({})}),/Usage limit reached/);}finally{f.dispose();}});
test('Codex waits for generated image delivery before completing the stage',async()=>{const f=fixture({image:true});let delivered=false;try{await f.codex.runStage({cwd:f.directory,instructions:'Work',input:[],tools:[{name:'workspace_write'}],signal:new AbortController().signal,callTool:async()=>({}),onGeneratedImage:async(item,home)=>{assert.equal(item.id,'image-1');assert.equal(home,f.codex.home);await new Promise(setImmediate);delivered=true;}});assert.equal(delivered,true);}finally{f.dispose();}});
test('Codex cancellation interrupts its active turn and releases listeners',async()=>{
 const f=fixture({hold:true});try{const controller=new AbortController();const promise=f.codex.runStage({cwd:f.directory,instructions:'Work',input:[],tools:[],signal:controller.signal,callTool:async()=>({})});while(!f.sent.some(m=>m.method==='turn/start'))await new Promise(setImmediate);await new Promise(setImmediate);controller.abort(new Error('User stopped job'));await assert.rejects(()=>promise,/User stopped job/);assert.ok(f.sent.some(m=>m.method==='turn/interrupt'));assert.equal(f.codex.listenerCount('notification'),0);}finally{f.dispose();}
});

test('parallel Codex tool requests run serially so approval prompts cannot overwrite each other',async()=>{
 const f=fixture({hold:true});let release;const gate=new Promise(resolve=>release=resolve);const seen=[];
 try{const run=f.codex.runStage({cwd:f.directory,instructions:'Work',input:[],tools:[{name:'app_call'}],signal:new AbortController().signal,callTool:async call=>{seen.push(JSON.parse(call.arguments).index);if(seen.length===1)await gate;return {ok:true};}});
 while(!f.sent.some(m=>m.method==='turn/start'))await new Promise(setImmediate);
 for(const index of [1,2])f.child.stdout.write(JSON.stringify({id:950+index,method:'item/tool/call',params:{threadId:'thread-1',tool:'app_call',arguments:{index}}})+'\n');
 await new Promise(setImmediate);assert.deepEqual(seen,[1]);release();while(seen.length!==2)await new Promise(setImmediate);assert.deepEqual(seen,[1,2]);
 f.child.stdout.write(JSON.stringify({method:'item/agentMessage/delta',params:{threadId:'thread-1',delta:'Finished'}})+'\n');f.child.stdout.write(JSON.stringify({method:'turn/completed',params:{threadId:'thread-1',turn:{status:'completed'}}})+'\n');assert.equal(await run,'Finished');
 }finally{release();f.dispose();}
});
