const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {EventEmitter}=require('node:events');
const {redact}=require('./openai.cjs');

function findCodex(environment=process.env) {
  const roots=[...(environment.PATH || environment.Path || '').split(path.delimiter)];
  const bin=path.join(environment.LOCALAPPDATA || '', 'OpenAI','Codex','bin');
  try {for(const entry of fs.readdirSync(bin).reverse())roots.push(path.join(bin,entry));}catch{}
  for(const root of roots) {const file=path.join(root,'codex.exe');if(path.isAbsolute(file)&&fs.existsSync(file))return file;}
  return '';
}

// A dedicated Codex profile avoids loading the user's unrelated MCP servers,
// plugins, hooks, keys, and conversation history into Agent Office.
class CodexConnection extends EventEmitter {
  constructor({directory,spawnImpl=spawn,environment=process.env,onChange=()=>{}}) {
    super();this.directory=directory;this.home=path.join(directory,'codex-profile');fs.mkdirSync(this.home,{recursive:true});
    this.file=path.join(directory,'codex-connection.json');this.spawn=spawnImpl;this.environment=environment;this.onChange=onChange;
    this.config={model:'',maxCalls:20,maxOutputTokens:1800,autoConfinedApps:false};
    try{Object.assign(this.config,JSON.parse(fs.readFileSync(this.file,'utf8')));}catch{}
    this.pending=new Map();this.sequence=0;this.account=null;this.models=[];this.rateLimits=null;this.loginId=null;
  }
  executable(){return this.config.executable || findCodex(this.environment);}
  status(){return {provider:'codex',...this.config,executable:this.executable(),hasKey:this.account?.type==='chatgpt',account:this.account,models:this.models,rateLimits:this.rateLimits,loginPending:!!this.loginId,error:this.loginError || '',keySource:'chatgpt',canRemember:false};}
  changed(){this.onChange();}
  write(message){if(!this.child?.stdin?.writable)throw new Error('Codex is not running.');this.child.stdin.write(JSON.stringify(message)+'\n');}
  request(method,params={}) {
    const id=++this.sequence;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Codex timed out: '+method));},45000);this.pending.set(id,{resolve,reject,timer});try{this.write({id,method,params});}catch(e){clearTimeout(timer);this.pending.delete(id);reject(e);}});
  }
  receive(message) {
    if(message.id!==undefined&&!message.method) {const pending=this.pending.get(message.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(message.id);message.error?pending.reject(new Error(redact(message.error.message))):pending.resolve(message.result);return;}
    if(message.method==='account/login/completed'){this.loginId=null;this.loginError=message.params.success?'':redact(message.params.error || 'ChatGPT sign-in failed.');this.refresh().catch(()=>this.changed());}
    if(message.method==='account/updated'){this.refresh().catch(()=>{});}
    if(message.method==='account/rateLimits/updated'){this.rateLimits=message.params.rateLimits;this.changed();}
    if(message.id!==undefined) {
      if(message.method==='item/tool/call'&&this.current&&message.params.threadId===this.current.threadId) {const current=this.current;current.queue=current.queue.then(()=>this.current===current?current.tool(message):undefined).catch(error=>current.fail(error));return;}
      // No other server request may grant permissions or execute an action.
      this.write({id:message.id,error:{code:-32601,message:'Agent Office permits only its assigned workspace and ArtCraft tools.'}});return;
    }
    this.emit('notification',message);
  }
  async start() {
    if(this.starting)return this.starting;
    if(this.child)return;
    this.starting=(async()=>{
      const executable=this.executable();if(!executable)throw new Error('Codex runtime not found. Install Codex or choose codex.exe.');
      const env={...this.environment,CODEX_HOME:this.home};delete env.OPENAI_API_KEY;delete env.CODEX_API_KEY;delete env.CODEX_ACCESS_TOKEN;
      const args=['app-server','-c','forced_login_method="chatgpt"','-c','cli_auth_credentials_store="file"','-c','features.shell_tool=false','-c','web_search="disabled"'];
      const child=this.spawn(executable,args,{cwd:this.home,env,windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;let buffer='';
      const stopped=error=>{if(this.child!==child)return;this.child=null;this.account=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(error);}this.pending.clear();this.emit('disconnected',error);this.changed();};
      child.on('error',()=>stopped(new Error('Cannot start Codex. Choose a working codex.exe.')));child.on('exit',()=>stopped(new Error('Codex stopped. Reconnect to continue.')));
      child.stdin.on('error',()=>{});child.stderr.on('data',()=>{});child.stdout.setEncoding('utf8');
      child.stdout.on('data',chunk=>{buffer+=chunk.toString();if(buffer.length>8*1024*1024){stopped(new Error('Codex output exceeded the message limit.'));child.kill();return;}let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);try{this.receive(JSON.parse(line));}catch{}}});
      await this.request('initialize',{clientInfo:{name:'agent_office',title:'Agent Office',version:'0.2.0'},capabilities:{experimentalApi:true}});this.write({method:'initialized',params:{}});
    })();
    try{await this.starting;}catch(error){this.close();throw error;}finally{this.starting=null;}
  }
  async refresh() {
    await this.start();const {account}=await this.request('account/read',{refreshToken:false});
    this.account=account?.type==='chatgpt'?{type:'chatgpt',email:account.email,planType:account.planType}:null;
    if(this.account){
      const result=await this.request('model/list',{});this.models=(result.data || []).map(m=>({id:m.model,name:m.displayName,isDefault:m.isDefault}));
      if(!this.config.model)this.config.model=this.models.find(m=>m.isDefault)?.id || this.models[0]?.id || '';
      try{this.rateLimits=(await this.request('account/rateLimits/read')).rateLimits;}catch{}
    }
    this.changed();return this.status();
  }
  save(payload) {
    if(payload.executable!==undefined&&payload.executable!==this.config.executable){if(payload.executable&&(!path.isAbsolute(payload.executable)||path.basename(payload.executable).toLowerCase()!=='codex.exe'||!fs.existsSync(payload.executable)))throw new Error('Choose an existing codex.exe.');this.close();this.config.executable=payload.executable;}
    if(typeof payload.model!=='string'||(payload.model&&!/^[a-zA-Z0-9_.:-]{1,100}$/.test(payload.model)))throw new Error('Choose a Codex model.');
    if(!Number.isInteger(payload.maxCalls)||payload.maxCalls<5||payload.maxCalls>50)throw new Error('Stage limit must be between 5 and 50.');
    Object.assign(this.config,{model:payload.model,maxCalls:payload.maxCalls,autoConfinedApps:payload.autoConfinedApps===true});fs.writeFileSync(this.file,JSON.stringify(this.config,null,2));this.changed();return this.status();
  }
  async login(openExternal) {
    await this.start();if(this.loginId)throw new Error('Sign-in is already open. Finish or cancel it first.');this.loginError='';
    const result=await this.request('account/login/start',{type:'chatgpt'});this.loginId=result.loginId;
    const url=new URL(result.authUrl);if(url.protocol!=='https:'||!['auth.openai.com','chatgpt.com'].includes(url.hostname)){await this.cancelLogin();throw new Error('Codex returned an unexpected sign-in address.');}
    try{await openExternal(url.href);}catch(error){await this.cancelLogin();throw error;}
    this.changed();return this.status();
  }
  async cancelLogin(){if(this.loginId)await this.request('account/login/cancel',{loginId:this.loginId});this.loginId=null;this.changed();return this.status();}
  async forget(){await this.start();await this.cancelLogin();await this.request('account/logout');this.account=null;this.models=[];this.rateLimits=null;this.changed();return this.status();}
  async verify(){return this.refresh();}
  async runStage({model,instructions,input,tools,signal,callTool,onDelta,onUsage,onGeneratedImage,cwd}) {
    await this.refresh();signal.throwIfAborted();if(!this.account)throw new Error('Sign in with ChatGPT in AI Connection first.');
    if(!cwd||!path.isAbsolute(cwd)||!fs.statSync(cwd).isDirectory())throw new Error('Choose an existing project work folder.');
    const result=await this.request('thread/start',{model:model || this.config.model,cwd,ephemeral:true,environments:[],runtimeWorkspaceRoots:[cwd],sandbox:'workspace-write',approvalPolicy:'never',baseInstructions:instructions+'\nThe project work folder is writable through the provided workspace_write tool. Use it to save real deliverables before finishing; text in a chat response is not a saved file. Do not infer that host workspace tools are read-only. All file operations must use the supplied host tools.',dynamicTools:tools.map(t=>({type:'function',name:t.name,description:t.description,inputSchema:t.parameters}))});
    const threadId=result.thread.id;
    try{return await new Promise((resolve,reject)=>{
      let text='',turnId=null,settled=false;let assets=Promise.resolve();
      const finish=(error)=>{if(settled)return;settled=true;this.off('notification',notification);this.off('disconnected',disconnected);signal.removeEventListener('abort',abort);this.current=null;error?reject(error):resolve(text);};
      const abort=()=>{if(turnId)this.request('turn/interrupt',{threadId,turnId}).catch(()=>{});finish(signal.reason || new Error('Job cancelled.'));};
      const disconnected=error=>finish(error);
      const notification=message=>{
        const p=message.params;if(p?.threadId!==threadId)return;
        if(message.method==='turn/started')turnId=p.turn.id;
        if(message.method==='item/agentMessage/delta'){text+=p.delta;if(text.length>200000){abort();return;}onDelta?.(p.delta);}
        if(message.method==='thread/tokenUsage/updated')onUsage?.(p.tokenUsage.total);
        if(message.method==='item/completed'&&p.item?.type==='imageGeneration'&&p.item.status==='completed'&&onGeneratedImage){const item=p.item;assets=assets.then(()=>onGeneratedImage(item,this.home));assets.catch(error=>finish(error));}
        if(message.method==='turn/completed'){const turn=p.turn;assets.then(()=>finish(turn.status==='completed'?(text.trim()?null:new Error('Codex returned no deliverable.')):new Error(turn.error?.message || 'Codex turn '+turn.status)),finish);}
      };
      this.current={threadId,queue:Promise.resolve(),fail:finish,tool:async message=>{
        let output,success=true;try{signal.throwIfAborted();if(!tools.some(t=>t.name===message.params.tool))throw new Error('Unknown tool.');output=await callTool({name:message.params.tool,arguments:JSON.stringify(message.params.arguments)});}catch(error){if(signal.aborted)return;success=false;output={error:redact(error.message)};}
        if(settled||signal.aborted)return;const raw=JSON.stringify(output);this.write({id:message.id,result:{success,contentItems:[{type:'inputText',text:raw.length>70000?JSON.stringify({result:raw.slice(0,70000),truncated:true}):raw}]}});
      }};
      this.on('notification',notification);this.on('disconnected',disconnected);signal.addEventListener('abort',abort,{once:true});
      this.request('turn/start',{threadId,input:[{type:'text',text:JSON.stringify(input)}],environments:[]}).then(r=>{turnId=r.turn.id;if(signal.aborted)this.request('turn/interrupt',{threadId,turnId}).catch(()=>{});}).catch(finish);
      if(signal.aborted)abort();
    });}finally{await this.request('thread/unsubscribe',{threadId}).catch(()=>{});}
  }
  close(){const child=this.child;this.child=null;this.account=null;this.loginId=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Codex connection closed.'));}this.pending.clear();if(child)child.kill();this.emit('disconnected',new Error('Codex connection closed.'));}
}
module.exports={CodexConnection,findCodex};
