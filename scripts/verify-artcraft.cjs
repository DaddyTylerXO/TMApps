// Read-only live verification against installed applications. Does not edit documents.
const {discover,McpClient,argsFor}=require('../electron/artcraft.cjs');
(async()=>{
  let failures=0;
  for(const app of discover()) {
    const client=new McpClient(app.cli,argsFor(process.cwd(),app.confined),{cwd:process.cwd()});
    try {
      await client.initialize(); const tools=await client.tools();
      const tool=tools.find(t=>['command_list','list_commands'].includes(t.name));
      let checked='capability discovery';
      if(tool){const result=await client.request('tools/call',{name:tool.name,arguments:{}},30000);if(result.isError)throw new Error('Command listing returned an error.');checked='command listing';}
      console.log(`${app.name}: PASS (${tools.length} tools, ${checked})`);
    } catch(error){failures++;console.log(`${app.name}: FAIL ${error.message}`);}
    finally{client.close();}
  }
  process.exitCode=failures?1:0;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
