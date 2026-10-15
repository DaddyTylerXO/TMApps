const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { catalog, discover, McpClient, argsFor, authorize } = require('./artcraft.cjs');

function setupIntegrations({ app, ipcMain, dialog, shell, window }) {
  const configPath = path.join(app.getPath('userData'),'integrations.json');
  let config = { paths:{}, grants:{}, unrestricted:[], workFolder:path.join(app.getPath('userData'),'ArtCraft Workspace') };
  try { config = {...config,...JSON.parse(fs.readFileSync(configPath,'utf8'))}; } catch {}
  if (!config.paths || typeof config.paths!=='object') config.paths = {};
  if (!config.grants || typeof config.grants!=='object') config.grants = {};
  if (!Array.isArray(config.unrestricted)) config.unrestricted = [];
  try { fs.mkdirSync(config.workFolder,{recursive:true}); }
  catch { config.workFolder=path.join(app.getPath('userData'),'ArtCraft Workspace'); fs.mkdirSync(config.workFolder,{recursive:true}); }
  const clients = new Map(); const toolCache = new Map(); let running = false; let liveReserved = false; let mediaPending = null;
  let sessionRoot=config.workFolder;
  function persist() { fs.writeFileSync(configPath,JSON.stringify(config,null,2)); }
  function closeClients() { for (const client of clients.values()) client.close(); clients.clear(); toolCache.clear(); }
  function appById(id) { const item = discover(config.paths).find(a=>a.id===id); if (!item) throw new Error('Unknown app.'); return item; }
  async function clientFor(id) {
    const item = appById(id); if (!item.installed) throw new Error('Locate this app’s automation CLI first.');
    if (!clients.has(id) || clients.get(id).closed) {
      const client = new McpClient(item.cli,argsFor(sessionRoot,item.confined),{cwd:sessionRoot});
      clients.set(id,client);
      try { await client.initialize(); } catch (error) { clients.delete(id); client.close(); throw error; }
    }
    return clients.get(id);
  }
  async function toolsFor(id) {
    if (!toolCache.has(id)) toolCache.set(id,await (await clientFor(id)).tools());
    return toolCache.get(id);
  }
  function bind(channel, handler) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel,async (event,...args) => {
      if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Unknown integration caller.');
      try { return {ok:true,data:await handler(...args)}; } catch(error) { return {ok:false,error:error.message}; }
    });
  }
  bind('office:integrations',() => ({apps:discover(config.paths),grants:config.grants,unrestricted:config.unrestricted,workFolder:config.workFolder}));
  bind('office:choose-app',async id => {
    if (running || liveReserved) throw new Error('Finish or cancel the live job before changing app locations.');
    const item = appById(id);
    const choice = await dialog.showOpenDialog(window,{title:`Locate ${item.name} automation CLI`,properties:['openFile'],filters:[{name:`${id}-cli.exe`,extensions:['exe']}]});
    if (!choice.canceled) {
      const cli = choice.filePaths[0];
      if (path.basename(cli).toLowerCase() !== `${id}-cli.exe`) throw new Error(`Choose ${id}-cli.exe from the app installation folder.`);
      config.paths[id] = cli; closeClients(); persist();
    }
    return {apps:discover(config.paths),workFolder:config.workFolder};
  });
  bind('office:work-folder',async () => {
    if (running || liveReserved) throw new Error('Finish or cancel the live job before changing its work folder.');
    const choice = await dialog.showOpenDialog(window,{title:'ArtCraft work folder',defaultPath:config.workFolder,properties:['openDirectory','createDirectory']});
    if (!choice.canceled) { config.workFolder = fs.realpathSync(choice.filePaths[0]); sessionRoot=config.workFolder; closeClients(); persist(); }
    return config.workFolder;
  });
  bind('office:open-app',id => {
    const item = appById(id); if (!item.desktopInstalled) throw new Error('Desktop executable not found beside the CLI.');
    return new Promise((resolve,reject)=>{
      const child = spawn(item.desktop,[],{detached:true,stdio:'ignore',windowsHide:false});
      child.once('error',reject); child.once('spawn',()=>{child.unref();resolve(true);});
    });
  });
  bind('office:agent-apps',payload => {
    if (!payload || typeof payload.agentId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(payload.agentId) || !Array.isArray(payload.appIds) || payload.appIds.some(id=>!catalog.some(a=>a.id===id))) throw new Error('Invalid agent app assignment.');
    config.grants[payload.agentId] = [...new Set(payload.appIds)]; persist(); return config.grants[payload.agentId];
  });
  // Legacy releases expose MCP but do not enforce read/write roots. Opt in per app.
  bind('office:legacy-access',payload => {
    const item = appById(payload?.appId);
    if (item.confined) return false;
    config.unrestricted = config.unrestricted.filter(id=>id!==item.id);
    if (payload.enabled === true) config.unrestricted.push(item.id);
    persist(); return config.unrestricted;
  });
  bind('office:app-tools',async id => (await toolsFor(id)).map(({name,description,inputSchema})=>({name,description:description?.slice(0,6000),inputSchema})));
  async function runAppTool(action,fromLive=false) {
    if (running || (liveReserved && !fromLive)) throw new Error('Another live job or app action is already running.');
    if (!action || typeof action !== 'object') throw new Error('Invalid app action.');
    authorize(config,action.agentId,action.appId);
    const item = appById(action.appId);
    if (!item.confined && !config.unrestricted.includes(item.id)) throw new Error('This installed app cannot enforce a work folder. Enable its full local file access in Integrations to run actions.');
    if (typeof action.tool !== 'string' || !action.arguments || typeof action.arguments !== 'object' || Array.isArray(action.arguments) || JSON.stringify(action.arguments).length > 512000) throw new Error('Tool arguments must be a JSON object under 512 KB.');
    running = true;
    try {
      const tools = await toolsFor(action.appId); if (!tools.some(t=>t.name===action.tool)) throw new Error('Unknown app tool. Refresh the tool list.');
      const result = await (await clientFor(action.appId)).request('tools/call',{name:action.tool,arguments:action.arguments},120000);
      if (result?.isError) throw new Error(result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,6000) || 'The app rejected this action.');
      // Keep workspace exports small. Images and other large binary data remain in the app session.
      return {content:(result?.content || []).filter(c=>c.type==='text').slice(0,10).map(c=>({type:'text',text:String(c.text).length>50000?String(c.text).slice(0,50000)+'\n[Result display truncated at 50,000 characters.]':String(c.text)})),summary:'ArtCraft tool completed.'};
    } finally { running = false; }
  }
  bind('office:run-app-tool',action=>runAppTool(action));
  bind('office:spotify',async action => {
    if (!['status','toggle','next','previous','open'].includes(action)) throw new Error('Unknown Spotify action.');
    if (action==='open') { await shell.openExternal('spotify:'); return {available:false,message:'Opening Spotify. Play a track to connect.'}; }
    if (process.platform!=='win32') return {supported:false,available:false,message:'Local Spotify controls currently require Windows.'};
    if (mediaPending) { if (action==='status') return mediaPending; await mediaPending; }
    mediaPending = new Promise(resolve => {
      const helper=app.isPackaged?path.join(process.resourcesPath,'app.asar.unpacked','electron','spotify.ps1'):path.join(__dirname,'spotify.ps1');
      execFile(path.join(process.env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-File',helper,'-Action',action],{windowsHide:true,timeout:15000,maxBuffer:65536,encoding:'utf8'},(error,stdout) => {
        try { if (error) throw error; resolve(JSON.parse(stdout.replace(/^\uFEFF/,''))); }
        catch { resolve({supported:false,available:false,message:'Windows media controls are unavailable. Open Spotify on this PC and try again.'}); }
      });
    });
    try { return await mediaPending; } finally { mediaPending = null; }
  });
  app.on('before-quit',closeClients);
  return {
    config:()=>({workFolder:config.workFolder}),
    allowed:agentId=>discover(config.paths).filter(a=>a.installed&&config.grants[agentId]?.includes(a.id)&&(a.confined||config.unrestricted.includes(a.id))),
    tools:toolsFor,
    run:action=>runAppTool(action,true),
    acquire:(root=config.workFolder)=>{if(running||liveReserved)return false;const canonical=fs.realpathSync(root);if(sessionRoot!==canonical){closeClients();sessionRoot=canonical;}liveReserved=true;return true;},
    release:()=>{liveReserved=false;if(sessionRoot!==config.workFolder){closeClients();sessionRoot=config.workFolder;}}
  };
}
module.exports = { setupIntegrations };
