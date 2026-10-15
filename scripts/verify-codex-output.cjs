const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {CodexConnection}=require('../electron/codex.cjs');const {workspaceTool}=require('../electron/workspace.cjs');const {tools}=require('../electron/live-runner.cjs');
(async()=>{
 const directory=path.join(process.env.APPDATA,'agent-office');const cwd=path.resolve('.verification','codex-real-output-'+Date.now());fs.mkdirSync(cwd,{recursive:true});
 const codex=new CodexConnection({directory});const controller=new AbortController();const timer=setTimeout(()=>controller.abort(new Error('Verification exceeded three minutes.')),180000);const invoked=[];
 try{await codex.refresh();if(!codex.status().hasKey)throw new Error('Sign in with ChatGPT in Agent Office first.');
 await codex.runStage({cwd,model:codex.status().model,instructions:'You are verifying Agent Office file creation. Call workspace_write to create index.html with a complete standalone HTML page titled Agent Office Verification and a heading that says Real file creation works. Then call workspace_read to verify its content. Do not merely print HTML in chat. Do not use image generation or any external application. Finish only after verifying the file.',input:[{role:'user',content:'Create and verify the requested HTML file now.'}],tools:tools.filter(t=>t.name.startsWith('workspace_')),signal:controller.signal,callTool:async call=>{invoked.push(call.name);return workspaceTool(cwd,call.name,JSON.parse(call.arguments));}});
 const content=fs.readFileSync(path.join(cwd,'index.html'),'utf8');assert.match(content,/Real file creation works/);assert.ok(invoked.includes('workspace_write'));assert.ok(invoked.includes('workspace_read'));console.log(JSON.stringify({verified:true,model:codex.status().model,tools:invoked,file:path.join(cwd,'index.html'),bytes:Buffer.byteLength(content)}));
 }finally{clearTimeout(timer);codex.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
