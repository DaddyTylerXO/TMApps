const appIntegration = {ready:false,apps:[],grants:{},unrestricted:[],workFolder:'',error:'',selectedAgent:'atlas',tools:new Map(),executing:null,formRevision:0};
const integrationNav = document.createElement('button'); integrationNav.className = 'nav'; integrationNav.dataset.view = 'integrations'; integrationNav.innerHTML = '<span>⌘</span> Integrations';
document.querySelector('nav').insertBefore(integrationNav,document.querySelector('nav [data-view="appearance"]'));
async function nativeCall(method,...args) {
  if (!window.desktop?.[method]) throw new Error('This integration is available in the Windows desktop app.');
  const reply = await window.desktop[method](...args);
  if (!reply?.ok) throw new Error(reply?.error || 'The desktop integration did not respond.');
  return reply.data;
}
async function loadIntegrations() {
  try { Object.assign(appIntegration,await nativeCall('integrations'),{ready:true,error:''}); }
  catch(error) { appIntegration.error = error.message; }
  if (state.view === 'integrations') renderIntegrations();
}
function renderIntegrations() {
  const selected = state.agents.find(a=>a.id===appIntegration.selectedAgent) || state.agents[0]; appIntegration.selectedAgent = selected.id;
  const assigned = appIntegration.grants[selected.id] || [];
  $('alternate').innerHTML = `<section class="panel integrations-panel"><div class="panel-heading"><div><h2>Your app library</h2><p>Give each agent the applications their work calls for.</p></div><button class="subtle" data-refresh-integrations>↻ Refresh</button></div>${!appIntegration.ready ? `<div class="empty">${escape(appIntegration.error || 'Finding installed apps…')}</div>` : `<div class="integration-toolbar"><label>Configure app access for<select id="integration-agent">${state.agents.map(a=>`<option value="${escape(a.id)}" ${a.id===selected.id?'selected':''}>${escape(a.name)} · ${escape(a.role)}</option>`).join('')}</select></label><div class="folder-setting"><small>ARTCRAFT WORK FOLDER</small><span title="${escape(appIntegration.workFolder)}">${escape(appIntegration.workFolder)}</span><button class="text-button" data-work-folder>Choose folder ↗</button></div><button class="primary" data-new-app-task>＋ App task</button></div><p class="integration-note">App tasks run real ArtCraft tools with the selected agent’s app access. Live AI specialists can discover and use their assigned apps. Each app keeps its headless document session until you close Agent Office or change the work folder.</p><div class="app-library">${appIntegration.apps.map(app=>`<article class="app-integration-card" style="--app-color:${app.color}"><div class="app-card-heading"><span class="app-monogram">${app.name.slice(0,1)}</span><div><h3>${app.name}</h3><p>${app.description}</p></div></div><span class="app-install-status ${app.installed?'installed':''}">${app.installed?'● CLI detected':'○ CLI not found'}</span><p class="app-access-copy">${app.confined?'File actions are limited to your work folder.':'This installed version cannot limit file access to a folder.'}</p>${!app.confined?`<label class="grant-label legacy-grant"><input type="checkbox" data-legacy-app="${app.id}" ${appIntegration.unrestricted.includes(app.id)?'checked':''}>Allow full local file access</label>`:''}<label class="grant-label"><input type="checkbox" data-grant-app="${app.id}" ${assigned.includes(app.id)?'checked':''} ${!app.installed?'disabled':''}>${escape(selected.name)} can use ${app.name}</label><div class="app-card-actions"><button class="subtle" data-open-craft="${app.id}" ${!app.desktopInstalled?'disabled':''}>Open app ↗</button><button class="text-button" data-locate-craft="${app.id}">Locate CLI</button><button class="text-button" data-app-action="${app.id}" ${!app.installed||!assigned.includes(app.id)?'disabled':''}>Run tool ↗</button></div></article>`).join('')}</div>`}</section>`;
}
function agentAppsSummary(agent) {
  const names = (appIntegration.grants[agent.id] || []).map(id=>appIntegration.apps.find(a=>a.id===id)?.name).filter(Boolean);
  return `<div class="detail-label">APPLICATION ACCESS</div><p class="detail-copy">${names.length?names.map(escape).join(', '):'No applications assigned yet.'}</p><button class="subtle" data-configure-agent="${escape(agent.id)}">Manage app access ↗</button>`;
}
async function openAppTask(appId) {
  if (!appIntegration.ready) { await loadIntegrations(); if (!appIntegration.ready) { toast(appIntegration.error); return; } }
  const form = $('app-task-form'); form.reset(); $('action-error').textContent = '';
  $('action-agent').innerHTML = state.agents.map(a=>`<option value="${escape(a.id)}">${escape(a.name)}</option>`).join('');
  $('action-agent').value = appIntegration.selectedAgent;
  $('app-task-dialog').showModal(); await refreshActionApps(appId);
}
async function refreshActionApps(preferred) {
  const grants = appIntegration.grants[$('action-agent').value] || [];
  const available = appIntegration.apps.filter(a=>a.installed&&grants.includes(a.id));
  $('action-app').innerHTML = available.map(a=>`<option value="${a.id}">${a.name}</option>`).join('');
  if (available.some(a=>a.id===preferred)) $('action-app').value = preferred;
  if (!available.length) { $('action-tool').innerHTML = ''; $('queue-app-action').disabled = true; $('action-description').textContent = 'Assign this agent an app in Integrations first.'; $('action-schema').textContent = ''; $('action-access').textContent = ''; return; }
  await refreshActionTools();
}
async function refreshActionTools() {
  const id = $('action-app').value; const revision = ++appIntegration.formRevision;
  $('queue-app-action').disabled = true; $('action-description').textContent = 'Reading tools from the installed app…'; $('action-tool').innerHTML = '';
  try {
    if (!appIntegration.tools.has(id)) appIntegration.tools.set(id,await nativeCall('appTools',id));
    if (revision!==appIntegration.formRevision) return;
    const tools = appIntegration.tools.get(id);
    $('action-tool').innerHTML = [...tools].sort((a,b)=>(/^list|command_list|doc_inspect|inspect_/.test(b.name)?1:0)-(/^list|command_list|doc_inspect|inspect_/.test(a.name)?1:0)).map(t=>`<option value="${escape(t.name)}">${escape(t.name)}</option>`).join('');
    const app = appIntegration.apps.find(a=>a.id===id); const allowed = app.confined || appIntegration.unrestricted.includes(id);
    $('action-access').textContent = app.confined ? `Files stay inside: ${appIntegration.workFolder}` : allowed ? 'This app has full local file access, as enabled in Integrations.' : 'Enable this app’s full local file access in Integrations before running tools.';
    $('queue-app-action').disabled = !allowed || !tools.length; updateActionTool();
  } catch(error) { if(revision===appIntegration.formRevision) $('action-description').textContent = error.message; }
}
function updateActionTool() {
  const tool = appIntegration.tools.get($('action-app').value)?.find(t=>t.name===$('action-tool').value);
  $('action-description').textContent = tool?.description || '';
  $('action-schema').textContent = JSON.stringify(tool?.inputSchema || {},null,2);
  const required = tool?.inputSchema?.required || []; const properties = tool?.inputSchema?.properties || {};
  const example = {};
  for (const key of required) { const p=properties[key] || {}; const type=Array.isArray(p.type)?p.type[0]:p.type; example[key] = p.default ?? (type==='object'?{}:type==='array'?[]:type==='boolean'?false:['number','integer'].includes(type)?0:''); }
  $('action-arguments').value = JSON.stringify(example,null,2); $('action-error').textContent = '';
}
function appJobDetail(job) {
  const app = appIntegration.apps.find(a=>a.id===job.action.appId); const agent = state.agents.find(a=>a.id===job.action.agentId);
  return `<div class="dialog-heading"><div><div class="eyebrow">${escape(job.id)} · REAL APP ACTION</div><h2>${escape(job.title)}</h2></div><button class="icon-button close-dialog" aria-label="Close">✕</button></div>${badge(job)}<p class="detail-copy">${escape(agent?.name || '')} → ${escape(app?.name || job.action.appId)} → ${escape(job.action.tool)}</p><div class="detail-label">TOOL ARGUMENTS</div><pre class="app-result">${escape(JSON.stringify(job.action.arguments,null,2))}</pre><div class="detail-label">${job.status==='failed'?'ACTION ERROR':'APP RESULT'}</div><pre class="app-result">${escape(job.error || job.artifacts.map(a=>a.text).join('\n') || (job.status==='running'?'Running the selected app tool…':'Waiting for the office queue.'))}</pre><p class="form-note">${job.status==='running'?'This real app action continues if you pause the office.':'App tasks are executed once. Interrupted actions are never automatically retried.'}</p>${job.status==='queued'?`<button class="danger-button" data-cancel="${escape(job.id)}">Cancel queued action</button>`:''}`;
}
async function runPendingAppTask() {
  const job = state.jobs.find(j=>!j.native&&j.status==='running'&&j.execution==='artcraft');
  if (!job || appIntegration.executing) return;
  appIntegration.executing = job.id;
  try {
    const result = await nativeCall('runAppTool',job.action);
    job.status = 'done'; job.step = 1; job.progress = 0;
    job.artifacts.push({agent:job.action.agentId,time:Date.now(),text:result.content?.map(c=>c.text).join('\n') || result.summary});
    E.log(state,job.action.agentId,`Completed real ${job.action.appId} action “${job.title}”.`,'complete');
  } catch(error) { job.status = 'failed'; job.error = error.message; E.log(state,job.action.agentId,`App action “${job.title}” failed: ${error.message}`,'error'); }
  finally { appIntegration.executing = null; save(); render(); }
}
let spotifyBusy = false;
async function refreshSpotify(action='status') {
  if (spotifyBusy || !window.desktop) return;
  spotifyBusy = true;
  try {
    const media = await nativeCall('spotify',action);
    $('spotify-title').textContent = media.available ? media.title || 'Spotify' : 'Spotify';
    $('spotify-artist').textContent = media.available ? media.artist || media.album || 'Playing on this PC' : media.message || 'Open Spotify and play a track to connect.';
    $('spotify-artist').title = $('spotify-artist').textContent;
    $('spotify-toggle').textContent = media.playing ? 'Ⅱ' : '▶'; $('spotify-toggle').setAttribute('aria-label',media.playing?'Pause Spotify':'Play Spotify');
    document.querySelector('[data-spotify="previous"]').disabled = !media.available || !media.canPrevious;
    document.querySelector('[data-spotify="next"]').disabled = !media.available || !media.canNext;
    $('spotify-toggle').disabled = !media.available || !media.canToggle;
    if(action!=='status') $('spotify-message').textContent = media.message || 'Spotify control sent.';
  } catch(error) { $('spotify-artist').textContent = error.message; }
  finally { spotifyBusy = false; }
}
function initializeDesktopIntegrations() { loadIntegrations(); refreshSpotify(); setInterval(()=>refreshSpotify(),5000); }
document.addEventListener('click',async event => {
  const b=event.target.closest('button'); if(!b)return;
  try {
    if(b.hasAttribute('data-refresh-integrations')) { appIntegration.tools.clear(); await loadIntegrations(); }
    if(b.hasAttribute('data-work-folder')) { appIntegration.workFolder = await nativeCall('chooseWorkFolder'); appIntegration.tools.clear(); renderIntegrations(); }
    if(b.dataset.openCraft) await nativeCall('openApp',b.dataset.openCraft);
    if(b.dataset.locateCraft) { await nativeCall('chooseApp',b.dataset.locateCraft); appIntegration.tools.clear(); await loadIntegrations(); }
    if(b.hasAttribute('data-new-app-task') || b.dataset.appAction) await openAppTask(b.dataset.appAction);
    if(b.dataset.configureAgent) { appIntegration.selectedAgent=b.dataset.configureAgent; $('detail-dialog').close(); state.view='integrations'; save(); render(); }
    if(b.dataset.spotify) await refreshSpotify(b.dataset.spotify);
  } catch(error) { toast(error.message); }
});
document.addEventListener('change',async event => {
  const input=event.target;
  try {
    if(input.id==='integration-agent') { appIntegration.selectedAgent=input.value; renderIntegrations(); }
    if(input.dataset.grantApp) {
      const id=appIntegration.selectedAgent; const current=appIntegration.grants[id] || [];
      const grants=input.checked?[...new Set([...current,input.dataset.grantApp])]:current.filter(a=>a!==input.dataset.grantApp);
      appIntegration.grants[id] = await nativeCall('saveAgentApps',id,grants); renderIntegrations();
    }
    if(input.dataset.legacyApp) { appIntegration.unrestricted=await nativeCall('legacyAccess',input.dataset.legacyApp,input.checked); renderIntegrations(); }
    if(input.id==='action-agent') await refreshActionApps();
    if(input.id==='action-app') await refreshActionTools();
    if(input.id==='action-tool') updateActionTool();
  } catch(error) { if(input.type==='checkbox')input.checked=!input.checked; toast(error.message); }
});
document.getElementById('app-task-form').addEventListener('submit',async event => {
  event.preventDefault(); const data=new FormData(event.target);
  try {
    const title=String(data.get('title')).trim(); if(!title)throw new Error('Give this app task a name.');
    const args=JSON.parse(data.get('arguments')); if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('Tool arguments must be a JSON object.');
    const appId=data.get('appId'); const agentId=data.get('agentId'); const tool=data.get('tool');
    const app=appIntegration.apps.find(a=>a.id===appId);
    if(!app || (!app.confined && !appIntegration.unrestricted.includes(appId)))throw new Error('Enable this app’s full local file access in Integrations first.');
    if(!appIntegration.grants[agentId]?.includes(appId))throw new Error('Give this agent access to the selected app first.');
    if(!appIntegration.tools.get(appId)?.some(t=>t.name===tool))throw new Error('Choose an app tool.');
    if(state.mode==='live') {
      const agent=state.agents.find(a=>a.id===agentId);
      const job=await nativeCall('aiSubmitApp',{title,agents:[{id:agent.id,name:agent.name,role:agent.role,description:agent.description || ''}],action:{agentId,appId,tool,arguments:args}});
      if(!state.jobs.some(j=>j.id===job.id))state.jobs.push(job);$('app-task-dialog').close();render();toast('Real app action added to the live queue.');return;
    }
    const job=E.task(title); Object.assign(job,{execution:'artcraft',flow:[agentId],action:{agentId,appId,tool,arguments:args}});
    state.jobs.push(job); E.log(state,agentId,`Queued real ${appId} action “${title}”.`,'start'); save(); $('app-task-dialog').close(); render(); toast('Real app action added to the queue.');
  } catch(error) { $('action-error').textContent=error.message; }
});
