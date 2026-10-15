const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function boot(saved, desktop) {
  if(saved===undefined)saved=JSON.stringify(require('../src/engine.js').initial({demo:true}));
  const source = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
  const dom = new JSDOM(source('index.html'), { url:'http://localhost', runScripts:'outside-only' });
  const w = dom.window;
  if (desktop) w.desktop = desktop;
  w.matchMedia = () => ({ matches:false, addEventListener() {} });
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  if (saved) w.localStorage.setItem('agent-office-v1', saved);
  try { for (const name of ['engine.js', 'integrations.js', 'ai.js', 'features.js', 'projects.js', 'office-appearance.js', 'app.js']) vm.runInContext(source(name), dom.getInternalVMContext()); }
  catch (error) { w.close(); throw error; }
  return dom;
}

test('Codex UI handles browser sign-in completion, models and provider switching',async()=>{
  let listener,logins=0,saved;let connection={provider:'codex',hasKey:false,executable:'C:\\Codex\\codex.exe',model:'',maxCalls:20,models:[],autoConfinedApps:false};
  const desktop={aiState:async()=>({ok:true,data:{jobs:[],paused:false,connection}}),onAiChanged:cb=>listener=cb,
    aiLogin:async()=>{logins++;return {ok:true,data:{...connection,loginPending:true}};},
    aiSave:async payload=>{saved=payload;return {ok:true,data:connection};},
    aiSelect:async provider=>({ok:true,data:connection={provider,hasKey:false,model:'gpt-4.1-mini',maxCalls:20,maxOutputTokens:1800}})};
  const dom=boot(JSON.stringify(require('../src/engine.js').initial()),desktop);const d=dom.window.document;
  try{await new Promise(setImmediate);d.querySelector('[data-view="ai"]').click();assert.ok(d.querySelector('[data-ai-login]'));assert.equal(d.querySelector('[name="apiKey"]'),null);d.querySelector('[data-ai-login]').click();await new Promise(setImmediate);assert.equal(logins,1);assert.ok(d.querySelector('[data-ai-login-cancel]'));
    connection={...connection,hasKey:true,loginPending:false,account:{email:'signed@example.com',planType:'plus'},model:'codex-model',models:[{id:'codex-model',name:'Codex model'}]};listener({jobs:[],paused:false,connection});assert.match(d.getElementById('alternate').textContent,/signed@example.com/);assert.equal(d.querySelector('[name="model"]').value,'codex-model');
    d.getElementById('codex-connection-form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(saved.provider,'codex');assert.equal(saved.model,'codex-model');assert.equal(saved.apiKey,undefined);
    d.getElementById('ai-provider').value='openai';d.getElementById('ai-provider').dispatchEvent(new dom.window.Event('change',{bubbles:true}));await new Promise(setImmediate);assert.ok(d.querySelector('[name="apiKey"]'));
  }finally{dom.window.close();}
});

test('v0.2 ribbon and office styles persist while retaining Default',()=>{let saved;let dom=boot();try{const d=dom.window.document;assert.equal(d.documentElement.dataset.officeStyle,'default');d.getElementById('sidebar-toggle').click();assert.equal(d.getElementById('sidebar-toggle').getAttribute('aria-expanded'),'false');assert.ok(d.documentElement.classList.contains('sidebar-collapsed'));assert.equal(d.querySelector('[data-view="projects"]').getAttribute('aria-label'),'Projects');d.querySelector('[data-view="appearance"]').click();assert.equal(d.querySelectorAll('button[data-office-style]').length,3);d.querySelector('[data-office-style="robots"]').click();assert.equal(d.documentElement.dataset.officeStyle,'robots');assert.equal(d.querySelectorAll('.robot-station').length,6);assert.equal(d.querySelectorAll('#office').length,1);saved=dom.window.localStorage.getItem('agent-office-v1');}finally{dom.window.close();}dom=boot(saved);try{const d=dom.window.document;assert.equal(d.documentElement.dataset.officeStyle,'robots');assert.ok(d.documentElement.classList.contains('sidebar-collapsed'));d.querySelector('[data-office-style="default"]').click();assert.equal(d.getElementById('office-robots').hidden,true);}finally{dom.window.close();}});

test('robot couriers follow new handoffs, skip restored history and respect reduced motion',async()=>{
 let listener;const seed=require('../src/engine.js').initial();seed.appearance.officeStyle='robots';let animations=0;const job={id:'ROBOT-JOB',native:true,execution:'openai',title:'Handoff animation',flow:['atlas','nova'],agents:[{id:'atlas',name:'Atlas',role:'Orchestrator'},{id:'nova',name:'Nova',role:'Developer'}],priority:'medium',status:'running',step:1,progress:0,created:Date.now(),events:[{id:'past',time:1,kind:'handoff',agent:'atlas',jobId:'ROBOT-JOB',text:'Past handoff'}],files:[],artifacts:[],settings:{model:'test',maxCalls:10},usage:{calls:1,inputTokens:0,outputTokens:0,toolCalls:0}};const snapshot={jobs:[job],paused:false,connection:{hasKey:true,model:'test'}};const dom=boot(JSON.stringify(seed),{aiState:async()=>({ok:true,data:snapshot}),onAiChanged:cb=>listener=cb});
 try{dom.window.HTMLElement.prototype.animate=function(){animations++;return {cancel(){this.oncancel?.();}};};await new Promise(setImmediate);assert.equal(animations,0);job.events.unshift({...job.events[0],id:'new',time:Date.now()});listener(snapshot);assert.equal(animations,1);listener(snapshot);assert.equal(animations,1);vm.runInContext('state.appearance.reducedMotion=true',dom.getInternalVMContext());job.events.unshift({...job.events[0],id:'reduced'});listener(snapshot);assert.equal(animations,1);}finally{dom.window.close();}
});

test('Claude Code can be selected as the office provider and as a new specialist',async()=>{const connection={provider:'claude',hasKey:false,model:'sonnet',maxCalls:20,executable:''};const dom=boot(JSON.stringify(require('../src/engine.js').initial()),{aiState:async()=>({ok:true,data:{jobs:[],paused:false,connection}}),onAiChanged:()=>{}});try{await new Promise(setImmediate);const d=dom.window.document;d.querySelector('[data-view="ai"]').click();assert.ok(d.getElementById('claude-connection-form'));assert.ok(d.querySelector('[data-claude-install]'));d.getElementById('new-agent').click();const form=d.getElementById('agent-form');form.elements.name.value='Claude Coder';form.elements.provider.value='claude';form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));const saved=JSON.parse(dom.window.localStorage.getItem('agent-office-v1'));assert.equal(saved.agents.find(a=>a.name==='Claude Coder').provider,'claude');}finally{dom.window.close();}});

test('completed jobs expose Open file location directly below the message heading',async()=>{let opened;const job={id:'COMPLETED-FOLDER',native:true,execution:'openai',title:'Finished output',goal:'Make a report',flow:['atlas'],agents:[{id:'atlas',name:'Atlas',role:'Orchestrator'}],priority:'medium',status:'done',step:1,progress:0,created:Date.now(),events:[],files:['report.md'],artifacts:[{agent:'atlas',text:'Created report.md'}],settings:{model:'test',maxCalls:20},usage:{calls:1,inputTokens:1,outputTokens:1,toolCalls:1},workFolder:'C:\\Work\\Report'};const dom=boot(JSON.stringify(require('../src/engine.js').initial()),{aiState:async()=>({ok:true,data:{jobs:[job],paused:false,connection:{hasKey:true}}}),onAiChanged:()=>{},projectOpen:async id=>{opened=id;return {ok:true,data:true};}});try{await new Promise(setImmediate);const d=dom.window.document;d.querySelector('[data-view="completed"]').click();d.querySelector('[data-job="COMPLETED-FOLDER"]').click();const bar=d.querySelector('#detail .dialog-heading').nextElementSibling;assert.ok(bar.classList.contains('job-location-actions'));bar.querySelector('[data-job-location]').click();await new Promise(setImmediate);assert.equal(opened,job.id);}finally{dom.window.close();}});

test('Projects shows actual folders, updates text previews and reopens completed jobs after restart',async()=>{
 const seed=require('../src/engine.js').initial();seed.projects=[{id:'project-live',name:'Live website',zone:'products',status:'active',lastTouched:Date.now()}];
 const job={id:'JOB-PROJECT',native:true,execution:'openai',title:'Create a website',goal:'Create an actual website',projectId:'project-live',priority:'medium',flow:['atlas'],agents:[{id:'atlas',name:'Atlas',role:'Orchestrator'}],status:'done',step:1,progress:0,created:Date.now(),finished:Date.now(),artifacts:[{agent:'atlas',text:'Created index.html'}],files:['index.html'],events:[],settings:{provider:'codex',model:'codex-test',maxCalls:20},usage:{calls:1,inputTokens:12,outputTokens:8,toolCalls:1},workFolder:'C:\\Work\\projects\\project-live'};
 let content='<h1>First version</h1>',version=1;const desktop={aiState:async()=>({ok:true,data:{jobs:[job],paused:false,connection:{provider:'codex',hasKey:true,model:'codex-test'}}}),onAiChanged:()=>{},projectFiles:async()=>({ok:true,data:{root:job.workFolder,checkedAt:Date.now(),entries:[{name:'index.html',path:'index.html',parent:'',kind:'file',size:content.length,modified:version}]}}),projectRead:async()=>({ok:true,data:{path:'index.html',content}})};
 let dom=boot(JSON.stringify(seed),desktop);
 try{const d=dom.window.document;await new Promise(setImmediate);d.querySelector('[data-view="projects"]').click();await new Promise(setImmediate);assert.equal(d.getElementById('page-label').textContent,'Projects');assert.match(d.querySelector('.project-folder-bar').textContent,/project-live/);d.querySelector('[data-project-file="index.html"]').click();await new Promise(setImmediate);assert.equal(d.querySelector('.project-file-content').textContent,content);assert.equal(d.querySelector('.project-file-content h1'),null);
 content='<script>Updated output</script>';version=2;await vm.runInContext('refreshProjectFiles()',dom.getInternalVMContext());assert.equal(d.querySelector('.project-file-content').textContent,content);assert.match(d.querySelector('.project-changes').textContent,/Updated · index.html/);assert.equal(d.querySelector('.project-file-content script'),null);
 d.querySelector('[data-view="completed"]').click();assert.equal(d.querySelectorAll('.completed-jobs [data-job]').length,1);d.querySelector('.completed-jobs [data-job]').click();assert.match(d.getElementById('detail').textContent,/Created index.html/);assert.ok(d.querySelector('[data-project-job]'));d.querySelector('[data-project-job]').click();await new Promise(setImmediate);assert.equal(d.getElementById('detail-dialog').open,false);assert.equal(d.getElementById('page-label').textContent,'Projects');
 }finally{dom.window.close();}
 dom=boot(JSON.stringify(seed),desktop);try{await new Promise(setImmediate);const d=dom.window.document;d.querySelector('[data-view="completed"]').click();d.querySelector('.completed-jobs [data-job]').click();assert.match(d.getElementById('detail').textContent,/Created index.html/);}finally{dom.window.close();}
});

test('new projects choose a device location and folder name, preview the path, and keep it after restart',async()=>{
 let payload;const desktop={projectFolderInfo:async()=>({ok:true,data:{parentFolder:'C:\\Default\\projects'}}),projectFolderChoose:async()=>({ok:true,data:'D:\\My work'}),projectFolderSave:async value=>{payload=value;return {ok:true,data:{id:value.projectId,parentFolder:value.parentFolder,folderName:value.folderName,folderPath:value.parentFolder+'\\'+value.folderName}};}};
 const seed=require('../src/engine.js').initial();let dom=boot(JSON.stringify(seed),desktop);let saved;
 try{const d=dom.window.document;d.querySelector('[data-view="projects"]').click();d.querySelector('#alternate [data-add-project]').click();await new Promise(setImmediate);const form=d.getElementById('project-form');form.elements.name.value='Logo studio';form.elements.name.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(form.elements.projectFolderName.value,'Logo studio');d.getElementById('choose-project-folder').click();await new Promise(setImmediate);form.elements.projectFolderName.value='My Logos';form.elements.projectFolderName.dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert.equal(d.getElementById('project-folder-preview').textContent,'D:\\My work\\My Logos');form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);assert.equal(payload.parentFolder,'D:\\My work');assert.equal(payload.folderName,'My Logos');saved=dom.window.localStorage.getItem('agent-office-v1');const project=JSON.parse(saved).projects[0];assert.equal(project.folderPath,'D:\\My work\\My Logos');assert.ok(d.querySelector('#project-root'));d.querySelector('#alternate [data-project]').click();assert.equal(form.elements.projectFolderName.disabled,true);assert.equal(d.getElementById('choose-project-folder').disabled,true);
 }finally{dom.window.close();}
 dom=boot(saved,desktop);try{const d=dom.window.document;assert.match(d.querySelector('.project-folder-bar').textContent,/My Logos/);}finally{dom.window.close();}
});
test('Office Live shares the overview office, controls and saved navigation', () => {
  let dom=boot(); const d=dom.window.document; let saved;
  try {
    const office=d.getElementById('office'); const workspace=d.getElementById('office-workspace');
    assert.ok(d.getElementById('overview').contains(office));
    d.querySelector('nav [data-view="live"]').click();
    assert.equal(d.getElementById('office-live').hidden,false);
    assert.equal(d.getElementById('overview').hidden,true);
    assert.equal(d.getElementById('alternate').hidden,true);
    assert.ok(d.getElementById('office-live').contains(office));
    assert.equal(d.querySelectorAll('#office').length,1); assert.equal(d.querySelectorAll('.desk').length,6);
    assert.equal(d.getElementById('page-label').textContent,'The Office Live');
    d.getElementById('pause').click(); assert.match(d.getElementById('pause').textContent,/Resume/);
    d.querySelector('#office-live .desk').click(); assert.ok(d.getElementById('detail-dialog').open);
    d.querySelector('#detail .close-dialog').click();
    d.querySelector('nav [data-view="office"]').click();
    assert.equal(d.getElementById('overview').hidden,false); assert.ok(d.getElementById('overview').contains(workspace));
    assert.match(d.getElementById('pause').textContent,/Resume/);
    d.getElementById('open-live-office').click();
    saved=dom.window.localStorage.getItem('agent-office-v1');
  } finally {dom.window.close();}
  dom=boot(saved);
  try {assert.equal(dom.window.document.getElementById('office-live').hidden,false);assert.match(dom.window.document.getElementById('pause').textContent,/Resume/);}
  finally {dom.window.close();}
});
test('live UI connects privately, creates OpenAI jobs and displays real approval requests',async()=>{
  const seed=require('../src/engine.js').initial();let connection={hasKey:true,model:'test-model',maxCalls:10,maxOutputTokens:512,autoConfinedApps:false,canRemember:true};let listener;let submitted;let receivedKey;
  const snapshot={jobs:[],paused:false,connection};
  const desktop={
    aiState:async()=>({ok:true,data:snapshot}),onAiChanged:callback=>{listener=callback;},
    aiSave:async payload=>{receivedKey=payload.apiKey;return {ok:true,data:connection};},
    aiSubmit:async payload=>{submitted=payload;const job={...payload,id:'JOB-LIVE',native:true,execution:'openai',flow:payload.agents.map(a=>a.id),status:'queued',step:0,progress:0,artifacts:[],events:[],files:[],usage:{calls:0,inputTokens:0,outputTokens:0,toolCalls:0},settings:connection,workFolder:'E:\\Work',created:Date.now()};snapshot.jobs=[job];listener(snapshot);return {ok:true,data:job};},
    aiApprove:async()=>({ok:true,data:true})
  };
  const dom=boot(JSON.stringify(seed),desktop);const w=dom.window;const d=w.document;
  try{
    await new Promise(setImmediate);assert.equal(d.querySelectorAll('.job').length,0);
    d.querySelector('nav [data-view="ai"]').click();const form=d.getElementById('ai-connection-form');form.elements.apiKey.value='sk-ui-test-secret';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
    assert.equal(receivedKey,'sk-ui-test-secret');assert.equal(d.getElementById('ai-connection-form').elements.apiKey.value,'');assert.equal(w.localStorage.getItem('agent-office-v1').includes('sk-ui-test-secret'),false);
    d.getElementById('new-job').click();const jobForm=d.getElementById('job-form');jobForm.elements.title.value='A real team task';jobForm.elements.goal.value='Write and review a project report.';jobForm.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(setImmediate);
    assert.equal(submitted.goal,'Write and review a project report.');assert.equal(submitted.agents.length,5);
    d.querySelector('nav [data-view="jobs"]').click();d.querySelector('.all-jobs .job').click();
    snapshot.jobs[0].status='running';snapshot.jobs[0].pendingApproval={id:'approval-test',appId:'vectorcraft',appName:'VectorCraft',tool:'export',arguments:{path:'result.svg'}};listener(snapshot);
    assert.match(d.getElementById('detail').textContent,/Review app action/);assert.match(d.getElementById('detail').textContent,/result.svg/);
    assert.equal(d.querySelectorAll('[data-ai-approval]').length,2);assert.equal(JSON.parse(w.localStorage.getItem('agent-office-v1')).jobs.length,0);
  }finally{w.close();}
});
test('task creation, detail, navigation, filters, pause, and cancellation work', () => {
  const dom = boot(); const w = dom.window; const d = w.document;
  try {
    assert.equal(d.querySelectorAll('.desk').length, 6);
    d.getElementById('pause').click(); assert.match(d.getElementById('pause').textContent, /Resume/);
    d.getElementById('new-job').click(); assert.ok(d.getElementById('job-dialog').open);
    const form = d.getElementById('job-form'); form.elements.title.value = '<script>Test idea</script>';
    form.dispatchEvent(new w.Event('submit', {bubbles:true, cancelable:true}));
    assert.equal(d.getElementById('queue-count').textContent, '5');
    d.querySelector('nav [data-view="jobs"]').click();
    assert.equal(d.querySelectorAll('.all-jobs .job').length, 5);
    const added = [...d.querySelectorAll('.all-jobs .job')].find(b => b.textContent.includes('<script>Test idea</script>'));
    assert.ok(added); assert.equal(added.querySelector('script'), null);
    added.click(); assert.ok(d.getElementById('detail-dialog').open);
    d.querySelector('[data-cancel]').click(); assert.equal(d.querySelectorAll('.all-jobs .job').length, 4);
    d.querySelector('[data-filter="done"]').click(); assert.equal(d.querySelectorAll('.all-jobs .job').length, 0);
    d.querySelector('nav [data-view="agents"]').click(); assert.equal(d.querySelectorAll('.full-team .agent-card').length, 6);
    d.querySelector('.full-team [data-agent="nova"]').click(); assert.match(d.getElementById('detail').textContent, /Developer/);
    d.querySelector('#detail .close-dialog').click();
    d.querySelector('nav [data-view="activity"]').click(); assert.match(d.querySelector('.activity-list').textContent, /Cancelled/);
  } finally { w.close(); }
});
test('text size persists and real app tasks use agent grants and actual tool results', async () => {
  const E = require('../src/engine.js'); const seed = E.initial({demo:true}); seed.jobs = [];
  const { catalog } = require('../electron/artcraft.cjs');
  const data = {apps:catalog.map(a=>({...a,installed:true,desktopInstalled:true})),grants:{atlas:['vectorcraft']},unrestricted:[],workFolder:'E:\\Test Work'};
  let invocation;
  const desktop = {
    integrations:async()=>({ok:true,data}), spotify:async()=>({ok:true,data:{available:true,title:'A track <title>',artist:'An artist',playing:true,canToggle:true,canNext:true,canPrevious:true}}),
    saveAgentApps:async(id,apps)=>({ok:true,data:apps}),
    appTools:async()=>({ok:true,data:[{name:'command_list',description:'List actual engine commands.',inputSchema:{type:'object',properties:{}}}]}),
    runAppTool:async action=>{invocation=action;return {ok:true,data:{content:[{type:'text',text:'Actual app result <safe>'}]}};}
  };
  let dom=boot(JSON.stringify(seed),desktop); const w=dom.window; const d=w.document; let saved;
  try {
    await new Promise(setImmediate);
    d.querySelector('nav [data-view="appearance"]').click();
    const size=d.getElementById('text-size'); size.value=160; size.dispatchEvent(new w.Event('input',{bubbles:true}));
    assert.equal(d.documentElement.style.getPropertyValue('--text-scale'),'1.6'); assert.equal(d.getElementById('text-size-value').textContent,'160%');
    assert.equal(d.getElementById('spotify-title').textContent,'A track <title>'); assert.equal(d.getElementById('spotify-title').querySelector('title'),null);
    d.querySelector('nav [data-view="integrations"]').click(); assert.equal(d.querySelectorAll('.app-integration-card').length,13);
    const grant=d.querySelector('[data-grant-app="photocraft"]'); grant.checked=true; grant.dispatchEvent(new w.Event('change',{bubbles:true})); await new Promise(setImmediate);
    d.querySelector('[data-app-action="vectorcraft"]').click(); await new Promise(setImmediate);
    const form=d.getElementById('app-task-form'); form.elements.title.value='Real command list';
    form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await vm.runInContext('E.tick(state); runPendingAppTask()',dom.getInternalVMContext());
    assert.equal(invocation.appId,'vectorcraft'); assert.equal(invocation.agentId,'atlas');
    const current=JSON.parse(w.localStorage.getItem('agent-office-v1'));
    assert.equal(current.jobs[0].status,'done'); assert.match(current.jobs[0].artifacts[0].text,/Actual app result/);
    d.querySelector('nav [data-view="jobs"]').click(); d.querySelector('.all-jobs .job').click();
    assert.match(d.getElementById('detail').textContent,/Actual app result <safe>/); assert.equal(d.querySelector('#detail safe'),null);
    saved=w.localStorage.getItem('agent-office-v1');
  } finally { w.close(); }
  dom=boot(saved); assert.equal(dom.window.document.documentElement.style.getPropertyValue('--text-scale'),'1.6'); dom.window.close();
});
test('zones, project editing, stale warnings, appearance and custom agents persist', () => {
  const seed = require('../src/engine.js').initial({demo:true});
  seed.paused = true;
  seed.projects[0].lastTouched = Date.now() - 8 * 86400000;
  let dom = boot(JSON.stringify(seed)); const w = dom.window; const d = w.document;
  let saved;
  try {
    assert.equal(d.querySelectorAll('#zone-overview .zone-card').length, 8);
    assert.equal(d.querySelectorAll('#zone-overview .stale-badge').length, 1);
    d.querySelector('nav [data-view="zones"]').click();
    d.querySelector('#alternate .project-card').click();
    const project = d.getElementById('project-form');
    project.elements.status.value = 'completed'; project.elements.zone.value = 'archive';
    project.dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    assert.equal(d.querySelectorAll('#alternate .stale-badge').length, 0);
    assert.equal(d.querySelectorAll('#alternate .gold-check').length, 2);
    d.querySelector('#alternate [data-add-project="sns"]').click();
    project.elements.name.value = 'My character';
    project.dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    assert.match(d.getElementById('alternate').textContent, /My character/);
    d.getElementById('new-agent').click();
    const form = d.getElementById('agent-form');
    form.elements.name.value = '<Spark>'; form.elements.zone.value = 'sns'; form.elements.description.value = '<b>Specialty</b>';
    form.dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    assert.equal(d.getElementById('nav-agent-count').textContent, '7');
    assert.equal(d.querySelectorAll('.desk').length, 7);
    d.getElementById('new-job').click();
    const job = d.getElementById('job-form'); job.elements.title.value = 'Custom collaboration';
    job.elements.teammate.value = job.elements.teammate.options[1].value;
    job.elements.projectId.value = seed.projects[0].id;
    job.dispatchEvent(new w.Event('submit', {bubbles:true,cancelable:true}));
    d.querySelector('nav [data-view="jobs"]').click();
    [...d.querySelectorAll('.all-jobs .job')].find(b => b.textContent.includes('Custom collaboration')).click();
    assert.match(d.querySelector('#detail .workflow').textContent, /<Spark>/);
    assert.equal(d.querySelector('#detail .workflow b'), null);
    d.querySelector('#detail .close-dialog').click();
    d.querySelector('nav [data-view="appearance"]').click();
    d.querySelector('[data-theme-option="dark"]').click();
    assert.equal(d.documentElement.dataset.theme, 'dark');
    const motion = d.getElementById('reduce-motion'); motion.checked = true; motion.dispatchEvent(new w.Event('change', {bubbles:true}));
    assert.ok(d.documentElement.classList.contains('reduce-motion'));
    d.querySelector('[data-theme-option="system"]').click(); assert.equal(d.documentElement.dataset.theme, 'light');
    d.querySelector('[data-theme-option="dark"]').click();
    saved = w.localStorage.getItem('agent-office-v1');
    const state = JSON.parse(saved); assert.equal(state.jobs.at(-1).flow.length, 6); assert.equal(state.agents.length, 7);
  } finally { w.close(); }
  dom = boot(saved);
  try { assert.equal(dom.window.document.documentElement.dataset.theme, 'dark'); assert.equal(dom.window.document.getElementById('nav-agent-count').textContent, '7'); }
  finally { dom.window.close(); }
});
test('saved UI state restores and broken JSON recovers safely', () => {
  let dom = boot(); const w = dom.window;
  w.document.getElementById('pause').click();
  const saved = w.localStorage.getItem('agent-office-v1'); w.close();
  dom = boot(saved); assert.match(dom.window.document.getElementById('pause').textContent, /Resume/); dom.window.close();
  dom = boot('{broken'); assert.equal(dom.window.document.querySelectorAll('.desk').length, 6); dom.window.close();
});
