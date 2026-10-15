const {OpenAIConnection}=require('./openai.cjs');
const {LiveRunner}=require('./live-runner.cjs');
const {CodexConnection}=require('./codex.cjs');
const {ClaudeConnection}=require('./claude.cjs');
const fs=require('node:fs');const path=require('node:path');
function setupAI({app,ipcMain,safeStorage,window,apps,shell,dialog}) {
  const directory=app.getPath('userData');const api=new OpenAIConnection({directory,safeStorage});
  const {ProjectFolders}=require('./project-folders.cjs');const folders=new ProjectFolders({directory,defaultParent:()=>path.join(apps.config().workFolder,'projects')});
  const file=path.join(directory,'ai-provider.json');let selected='codex';try{const saved=JSON.parse(fs.readFileSync(file,'utf8')).provider;if(['codex','openai','claude'].includes(saved))selected=saved;}catch{}
  let runner;const changed=()=>{if(runner){if(!window.webContents.isDestroyed())window.webContents.send('office:ai-changed',runner.snapshot());runner.kick();}};
  const codex=new CodexConnection({directory,onChange:changed});
  const claude=new ClaudeConnection({directory,onChange:changed});const connections={codex,openai:api,claude};
  const provider={connectionStatus:name=>({...connections[name].status(),provider:name}),status:()=>({...connections[selected].status(),provider:selected,connections:{claude:claude.status()}}),respond:args=>(args.provider==='claude'?claude:api).respond(args),runStage:args=>codex.runStage(args),verify:()=>connections[selected].verify(),forget:()=>connections[selected].forget(),save:payload=>{
    const next=['codex','openai','claude'].includes(payload.provider)?payload.provider:selected;const result=connections[next].save(payload);selected=next;fs.writeFileSync(file,JSON.stringify({provider:selected}));return {...result,provider:selected};
  }};
  runner=new LiveRunner({directory,provider,apps,projectFolders:id=>folders.get(id),onChange:snapshot=>{if(!window.webContents.isDestroyed())window.webContents.send('office:ai-changed',snapshot);}});
  function bind(channel,handler){ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,...args)=>{
    if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Unknown AI caller.');
    try{return {ok:true,data:await handler(...args)};}catch(error){return {ok:false,error:error.message};}
  });}
  bind('office:ai-state',()=>runner.snapshot());
  bind('office:ai-save',payload=>{if(runner.active)throw new Error('Finish or cancel the current job before changing its AI connection.');const status=provider.save(payload);runner.kick();return status;});
  bind('office:ai-forget',async()=>{if(runner.active)throw new Error('Finish or cancel the current job first.');await provider.forget();return provider.status();});
  bind('office:ai-verify',async()=>{await provider.verify();return provider.status();});
  bind('office:ai-select',async name=>{if(runner.active)throw new Error('Finish or cancel the current job before changing providers.');if(!['codex','openai','claude'].includes(name))throw new Error('Unknown AI provider.');if(name==='codex'&&codex.executable())await codex.refresh();if(name==='claude'&&claude.executable())await claude.verify();selected=name;fs.writeFileSync(file,JSON.stringify({provider:selected}));changed();return provider.status();});
  bind('office:ai-login',()=>{if(runner.active)throw new Error('Finish or cancel the current job before signing in again.');if(selected==='claude')return claude.login();if(selected!=='codex')throw new Error('Select a CLI provider first.');return codex.login(url=>shell.openExternal(url));});
  bind('office:ai-login-cancel',()=>selected==='claude'?claude.cancelLogin():codex.cancelLogin());
  bind('office:ai-install-guide',()=>shell.openExternal('https://code.claude.com/docs/en/setup'));
  bind('office:ai-runtime',async()=>{if(runner.active)throw new Error('Finish or cancel the current job first.');const title=selected==='claude'?'Claude Code':'Codex';const result=await dialog.showOpenDialog(window,{title:'Choose '+title+' runtime',properties:['openFile'],filters:[{name:title+' runtime',extensions:['exe']}]});return result.canceled?null:result.filePaths[0];});
  bind('office:ai-submit',payload=>runner.submit(payload));
  bind('office:ai-app-submit',payload=>runner.submit(payload,'artcraft'));
  bind('office:ai-pause',paused=>runner.setPaused(paused));
  bind('office:ai-cancel',id=>runner.cancel(id));
  bind('office:ai-retry',id=>runner.retry(id));
  bind('office:ai-approve',payload=>runner.approve(payload.jobId,payload.approvalId,payload.allow));
  const files=require('./project-files.cjs');
  const projectJobs=()=>[...runner.jobs,...folders.list().map(item=>({id:'project:'+item.id,native:true,workFolder:item.folderPath,workspaceRoot:item.parentFolder}))];
  bind('office:project-folder-info',id=>folders.info(id));
  bind('office:project-folder-save',payload=>folders.create(payload));
  bind('office:project-folder-choose',async()=>{const choice=await dialog.showOpenDialog(window,{title:'Choose where to create the project folder',defaultPath:apps.config().workFolder,properties:['openDirectory','createDirectory']});return choice.canceled?null:fs.realpathSync(choice.filePaths[0]);});
  bind('office:project-files',id=>files.projectFiles(projectJobs(),id));
  bind('office:project-read',payload=>files.readProjectFile(projectJobs(),payload.jobId,payload.path));
  bind('office:project-open',id=>files.openProjectFolder(projectJobs(),id,shell));
  app.on('before-quit',()=>{runner.close();codex.close();claude.close();});if(selected==='codex'&&codex.executable())codex.refresh().catch(()=>{});if(claude.executable())claude.verify().catch(()=>{});runner.kick();return runner;
}
module.exports={setupAI};
