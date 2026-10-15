const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {McpClient,authorize,argsFor,catalog}=require('../electron/artcraft.cjs');
test('ArtCraft permissions reject unassigned apps and folder arguments stay literal',()=>{
  assert.equal(catalog.length,13);
  assert.throws(()=>authorize({grants:{atlas:['photocraft']}},'atlas','vectorcraft'),/not been given/);
  assert.throws(()=>authorize({grants:{}},'atlas','shell'),/Unknown/);
  assert.doesNotThrow(()=>authorize({grants:{atlas:['photocraft']}},'atlas','photocraft'));
  assert.deepEqual(argsFor('E:\\Work folder; literal'),['mcp','--automation-read-root','E:\\Work folder; literal','--automation-write-root','E:\\Work folder; literal']);
  assert.deepEqual(argsFor('E:\\Work',false),['mcp']);
});
test('desktop handlers persist grants and enforce legacy access before running tools',async()=>{
  const prefix=path.join(os.tmpdir(),'agent-office-test-'); const folder=fs.mkdtempSync(prefix); const handlers=new Map(); const lifecycle=new Map();
  const contents={mainFrame:{}}; const window={webContents:contents}; const event={sender:contents,senderFrame:contents.mainFrame};
  const app={getPath:()=>folder,on:(name,handler)=>lifecycle.set(name,handler)};
  const ipcMain={removeHandler:name=>handlers.delete(name),handle:(name,handler)=>handlers.set(name,handler)};
  const invoke=(name,value)=>handlers.get('office:'+name)(event,value);
  try{
    require('../electron/integrations.cjs').setupIntegrations({app,ipcMain,dialog:{},shell:{},window});
    assert.equal((await invoke('integrations')).data.apps.length,13);
    assert.equal((await invoke('agent-apps',{agentId:'atlas',appIds:['not-an-app']})).ok,false);
    assert.equal((await invoke('agent-apps',{agentId:'atlas',appIds:['gridcraft']})).ok,true);
    assert.match((await invoke('run-app-tool',{agentId:'nova',appId:'gridcraft',tool:'list_commands',arguments:{}})).error,/not been given/);
    assert.match((await invoke('run-app-tool',{agentId:'atlas',appId:'gridcraft',tool:'list_commands',arguments:{}})).error,/full local file access/);
    assert.equal((await invoke('legacy-access',{appId:'gridcraft',enabled:true})).ok,true);
    const saved=JSON.parse(fs.readFileSync(path.join(folder,'integrations.json'),'utf8'));
    assert.deepEqual(saved.grants.atlas,['gridcraft']); assert.ok(saved.unrestricted.includes('gridcraft'));
    await assert.rejects(handlers.get('office:integrations')({sender:{},senderFrame:{}}),/Unknown integration caller/);
  }finally{lifecycle.get('before-quit')?.();assert.ok(path.resolve(folder).startsWith(path.resolve(prefix)));fs.rmSync(folder,{recursive:true,force:true});}
});
test('MCP transport handles split replies, notifications and timeouts',async()=>{
  const client=new McpClient(process.execPath,[path.join(__dirname,'fixtures/mcp-server.cjs')]);
  try {
    await client.initialize(); assert.equal((await client.tools())[0].name,'inspect');
    assert.equal((await client.request('tools/call',{name:'inspect',arguments:{}})).content[0].text,'real protocol response');
    await assert.rejects(client.request('never',{},30),/timed out/);
  } finally {client.close();}
});
