const {OpenAIConnection}=require('./openai.cjs');
const {LiveRunner}=require('./live-runner.cjs');
const {CodexConnection}=require('./codex.cjs');
const fs=require('node:fs');const path=require('node:path');
function setupAI({app,ipcMain,safeStorage,window,apps,shell,dialog}) {
  const directory=app.getPath('userData');const api=new OpenAIConnection({directory,safeStorage});
  const {ProjectFolders}=require('./project-folders.cjs');const folders=new ProjectFolders({directory,defaultParent:()=>path.join(apps.config().workFolder,'projects')});
  const file=path.join(directory,'ai-provider.json');let selected='codex';try{selected=JSON.parse(fs.readFileSync(file,'utf8')).provider==='openai'?'openai':'codex';}catch{}
  let runner;const changed=()=>{if(runner){if(!window.webContents.isDestroyed())window.webContents.send('office:ai-changed',runner.snapshot());runner.kick();}};
  const codex=new CodexConnection({directory,onChange:changed});
  const provider={status:()=>({...((selected==='codex'?codex:api).status()),provider:selected}),respond:args=>api.respond(args),runStage:args=>codex.runStage(args),verify:()=>selected==='codex'?codex.verify():api.verify(),forget:()=>selected==='codex'?codex.forget():api.forget(),save:payload=>{
    const next=payload.provider==='openai'?'openai':'codex';const result=(next==='codex'?codex:api).save(payload);selected=next;fs.writeFileSync(file,JSON.stringify({provider:selected}));return {...result,provider:selected};
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
  bind('office:ai-select',async name=>{if(runner.active)throw new Error('Finish or cancel the current job before changing providers.');if(!['codex','openai'].includes(name))throw new Error('Unknown AI provider.');if(name==='codex'&&codex.executable())await codex.refresh();selected=name;fs.writeFileSync(file,JSON.stringify({provider:selected}));changed();return provider.status();});
  bind('office:ai-login',()=>{if(runner.active)throw new Error('Finish or cancel the current job before signing in again.');if(selected!=='codex')throw new Error('Select Codex and save the connection first.');return codex.login(url=>shell.openExternal(url));});
  bind('office:ai-login-cancel',()=>codex.cancelLogin());
  bind('office:ai-runtime',async()=>{if(runner.active)throw new Error('Finish or cancel the current job first.');const result=await dialog.showOpenDialog(window,{title:'Choose Codex runtime',properties:['openFile'],filters:[{name:'Codex runtime',extensions:['exe']}]});return result.canceled?null:result.filePaths[0];});
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
  app.on('before-quit',()=>{runner.close();codex.close();});if(selected==='codex'&&codex.executable())codex.refresh().catch(()=>{});runner.kick();return runner;
}
module.exports={setupAI};
