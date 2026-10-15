const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {ProjectFolders}=require('../electron/project-folders.cjs');const {LiveRunner}=require('../electron/live-runner.cjs');const {setupIntegrations}=require('../electron/integrations.cjs');
(async()=>{
 const base=path.resolve('.verification','chosen-project-location-'+Date.now());const directory=path.join(base,'app-data');const parent=path.join(base,'Selected parent');fs.mkdirSync(directory,{recursive:true});fs.mkdirSync(parent);
 fs.writeFileSync(path.join(directory,'integrations.json'),JSON.stringify({grants:{verifier:['vectorcraft']}}));const lifecycle=[];
 const apps=setupIntegrations({app:{getPath:()=>directory,on:(event,fn)=>{if(event==='before-quit')lifecycle.push(fn);}},ipcMain:{removeHandler(){},handle(){}},window:{webContents:{}},shell:{},dialog:{}});
 const folders=new ProjectFolders({directory,defaultParent:()=>path.join(apps.config().workFolder,'projects')});const saved=folders.create({projectId:'project-location-test',parentFolder:parent,folderName:'Custom artwork folder'});let count=0;let runner;
 const provider={status:()=>({hasKey:true,model:'controlled-protocol-fixture',maxCalls:10,maxOutputTokens:512,autoConfinedApps:true}),respond:async args=>{
   count++;const folder=JSON.parse(args.input[0].content).workFolder;let name,parameters;
   if(count===1){name='workspace_write';parameters={path:'input.svg',content:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="35" fill="#3f8569"/></svg>'};}
   else if(count===2||count===3){name='app_call';parameters={appId:'vectorcraft',tool:count===2?'open_file':'export',arguments_json:JSON.stringify(count===2?{path:path.join(folder,'input.svg')}:{path:path.join(folder,'output.svg'),format:'svg'})};}
   else return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Created and exported the SVG inside the selected project folder.'}]}]};
   return {status:'completed',output:[{type:'function_call',call_id:'location-'+count,name,arguments:JSON.stringify(parameters)}]};
 }};
 try{runner=new LiveRunner({directory,provider,apps,projectFolders:id=>folders.get(id)});const job=runner.submit({title:'Verify custom project location',projectId:'project-location-test',projectWorkspace:true,agents:[{id:'verifier',name:'Verifier',role:'Designer',description:''}]});const deadline=Date.now()+45000;while(['queued','running'].includes(job.status)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));if(job.status!=='done')throw new Error(job.error || 'Verification did not finish.');assert.equal(job.workFolder,saved.folderPath);assert.ok(fs.statSync(path.join(saved.folderPath,'output.svg')).size>50);assert.ok(job.outputVerification.passed);console.log(JSON.stringify({verified:true,folder:job.workFolder,outputs:job.outputVerification.files,artcraft:'Real VectorCraft open/export; controlled model fixture, no AI generation usage.'}));}
 finally{runner?.close();for(const fn of lifecycle)fn();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
