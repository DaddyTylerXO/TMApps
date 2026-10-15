const { discover, McpClient, argsFor } = require('../electron/artcraft.cjs');
(async () => {
  const apps = discover();
  for (let offset = 0; offset < apps.length; offset += 3) {
    await Promise.all(apps.slice(offset, offset + 3).map(async app => {
      const client = new McpClient(app.cli, argsFor(process.cwd(),app.confined));
      try { await client.initialize(); const tools = await client.tools(); console.log(JSON.stringify({id:app.id,ok:true,count:tools.length,tools:tools.slice(0,3).map(t=>t.name)})); }
      catch(error) { console.log(JSON.stringify({id:app.id,ok:false,error:error.message})); }
      finally { client.close(); }
    }));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
