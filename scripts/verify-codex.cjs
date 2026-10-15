const path=require('node:path');const fs=require('node:fs');const {CodexConnection}=require('../electron/codex.cjs');
(async()=>{
 const directory=path.resolve('.verification/codex-runtime');fs.mkdirSync(directory,{recursive:true});const codex=new CodexConnection({directory});
 try{await codex.start();console.log('Runtime handshake: passed');const result=await codex.request('account/read',{refreshToken:false});console.log('Dedicated profile: '+(result.account?'connected':'sign-in required'));
 const thread=await codex.request('thread/start',{cwd:codex.home,ephemeral:true,environments:[],sandbox:'read-only',approvalPolicy:'never',dynamicTools:[{type:'function',name:'workspace_read',description:'Read assigned work folder text.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}]});
 console.log('Isolated thread and dynamic tool registration: '+(thread.thread.id?'passed':'failed'));await codex.request('thread/unsubscribe',{threadId:thread.thread.id});
 }finally{codex.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
