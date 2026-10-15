const fs=require('node:fs');const path=require('node:path');
const {discover,McpClient,argsFor}=require('../electron/artcraft.cjs');
const {LiveRunner}=require('../electron/live-runner.cjs');
const root=path.join(process.cwd(),'.verification','vectorcraft');fs.mkdirSync(root,{recursive:true});
(async()=>{
  const app=discover().find(a=>a.id==='vectorcraft');const client=new McpClient(app.cli,argsFor(root,true),{cwd:root});
  try{
    await client.initialize();const available=await client.tools();
    for(const name of ['open_file','export'])if(!available.find(t=>t.name===name)?.inputSchema?.properties?.path)throw new Error(`Missing ${name} path support.`);
    const input=path.join(root,'input.svg');const output=path.join(root,'verified-output.svg');
    fs.writeFileSync(input,'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect x="20" y="20" width="280" height="140" fill="#527d5e"/></svg>');
    let count=0;
    const provider={status:()=>({hasKey:true,model:'controlled-verification-fixture',maxCalls:5,maxOutputTokens:512,autoConfinedApps:true}),respond:async()=>{
      count++;if(count>2)return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Opened input.svg in VectorCraft and exported verified-output.svg.'}]}]};
      return {status:'completed',output:[{type:'function_call',call_id:'verify-'+count,name:'app_call',arguments:JSON.stringify({appId:'vectorcraft',tool:count===1?'open_file':'export',arguments_json:JSON.stringify(count===1?{path:input}:{path:output,format:'svg'})})}]};
    }};
    const apps={config:()=>({workFolder:root}),allowed:id=>id==='verifier'?[app]:[],tools:async()=>available,run:async action=>{
      if(action.agentId!=='verifier'||action.appId!=='vectorcraft')throw new Error('Unexpected app permission.');
      const result=await client.request('tools/call',{name:action.tool,arguments:action.arguments});if(result.isError)throw new Error(JSON.stringify(result.content));return result;
    },acquire:()=>true,release:()=>{}};
    const runner=new LiveRunner({directory:root,provider,apps});
    const job=runner.submit({title:'Verify real ArtCraft tool execution',agents:[{id:'verifier',name:'Verifier',role:'Designer',description:''}]});
    const deadline=Date.now()+30000;while(['queued','running'].includes(job.status)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,30));
    runner.close();if(job.status!=='done')throw new Error(job.error || 'Verification did not finish.');
    if(!fs.existsSync(output)||fs.statSync(output).size<50)throw new Error('The actual SVG export was not created.');
    console.log('PASS: live runner called real VectorCraft open/export tools and produced '+output);
    console.log('Controlled model fixture used; no OpenAI request or API key was involved.');
  }finally{client.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
