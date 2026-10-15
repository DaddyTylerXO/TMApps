const E = OfficeEngine;
const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let state;
try { state = JSON.parse(localStorage.getItem('agent-office-v1')); if (state?.version !== 1 || !Array.isArray(state.jobs) || !Array.isArray(state.events)) state = null; } catch {}
state = E.upgrade(state || E.initial());
for (const job of state.jobs) if (job.execution === 'artcraft' && job.status === 'running') { job.status = 'failed'; job.error = 'Agent Office closed before this app action reported its result. Check the app output before starting a new action. It has not been retried.'; }
let filter = 'all';
let activeDetail = null;
function save() { try { localStorage.setItem('agent-office-v1', JSON.stringify({...state,jobs:state.jobs.filter(j=>!j.native),events:state.events.filter(e=>!e.native)})); } catch { toast('Storage is unavailable. Changes will last for this session.'); } }
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toast.timeout); toast.timeout = setTimeout(() => $('toast').classList.remove('show'), 3200); }
function running() { return state.jobs.find(j => j.status === 'running'); }
function owner(job) { const flow = E.workflow(job); return flow[Math.min(job.step, flow.length - 1)]; }
function assigned(agent) { return state.jobs.find(j => j.status === 'running' && owner(j) === agent.id); }
function progress(job) { return job.status === 'done' ? 100 : Math.round((job.step * 100 + job.progress) / E.workflow(job).length); }
function badge(job) { return `<span class="status ${job.status}">${job.pendingApproval?'Review app action':job.status === 'running' ? (state.paused && job.execution !== 'artcraft' ? 'Ⅱ Paused' : '● In progress') : job.status === 'done' ? (job.execution==='demo'?'Demo completed':job.native&&job.execution==='openai'&&!job.outputVerification?'Output unverified':'✓ Completed') : job.status === 'failed' ? '⚠ Failed' : job.status==='cancelled'?'Cancelled':job.status==='archived'?'Demo history':'Queued'}</span>`; }
function jobCard(job) {
  const agent = state.agents.find(a => a.id === owner(job));
  return `<button class="job" data-job="${escape(job.id)}"><div class="job-top"><span class="job-id">${escape(job.id)}</span>${badge(job)}</div><h3>${escape(job.title)}</h3><div class="job-meta"><span class="mini-avatar" style="color:${agent.color}">${escape(agent.glyph)}</span><span>${job.status === 'queued' ? 'Queued for ' + escape(agent.name) : escape(agent.name) + (job.status === 'done' ? ' · Completed' : ' · ' + escape(agent.role))}</span><span class="priority ${job.priority}"><i></i>${job.priority[0].toUpperCase() + job.priority.slice(1)}</span></div>${job.status === 'running' ? `<div class="progress"><b style="width:${progress(job)}%"></b></div>` : ''}</button>`;
}
function agentCard(agent) {
  const job = assigned(agent);
  const zone = E.zones.find(z => z.id === agent.zone);
  return `<button class="agent-card" data-agent="${escape(agent.id)}" style="--agent-color:${agent.color}"><div class="agent-top"><div class="agent-avatar">${escape(agent.glyph)}</div><div><strong>${escape(agent.name)}</strong><small>${escape(agent.role)}</small></div></div><span class="agent-zone" style="--zone-color:${zone.color}">${zone.name}</span><div class="agent-status ${job ? 'busy' : ''}"><i></i>${job ? state.paused ? 'Paused' : 'Working on a job' : 'Ready when you are'}</div><span class="agent-arrow">↗</span></button>`;
}
function eventCard(event) {
  const agent = state.agents.find(a => a.id === event.agent);
  const time = new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<div class="activity-event"><span class="event-dot">${event.kind === 'complete' ? '✓' : event.kind === 'system' ? '✦' : '↗'}</span><div><p><strong>${escape(agent?.name || 'Office')}</strong> ${escape(event.text)}</p><span class="event-time">${time} · ${event.execution==='openai'?'OPENAI':event.execution==='artcraft'?'APP ACTION':'WORKSPACE'}</span></div></div>`;
}
function render() {
  const active = running(); const done = state.jobs.filter(j => j.status === 'done' && (state.mode==='demo'||j.native)).length; const queued = state.jobs.filter(j => j.status === 'queued').length;
  const metrics = [
    ['Agents in your office', state.agents.length, '♧', `${active ? 1 : 0} working · ${state.agents.length - (active ? 1 : 0)} available`, ''],
    ['Jobs in progress', active ? '1' : '0', '◷', state.paused ? 'Office is paused' : active ? 'Good things are taking shape' : 'Ready for the next idea', active ? '1 active workflow' : ''],
    ['Completed jobs', done, '✓', done ? 'A little more done, together' : 'Every great team starts somewhere', ''],
    ['Team handoffs', state.events.filter(e => e.kind === 'handoff' && (state.mode==='demo'||e.execution==='openai')).length, '⇄', 'Ideas moving between minds', '']
  ];
  $('stats').innerHTML = metrics.map(([label, value, icon, foot]) => `<article class="stat"><div class="stat-label">${label}<span class="stat-icon">${icon}</span></div><div class="stat-value">${value}${label === 'Agents in your office' ? `<small>specialists</small>` : ''}</div><div class="stat-foot"><i></i>${foot}</div></article>`).join('');
  $('desks').innerHTML = state.agents.map((a, index) => `<button class="desk ${assigned(a) ? 'working' : ''} ${state.selected === a.id ? 'selected' : ''}" data-agent="${escape(a.id)}" style="left:${state.agents.length > 6 ? [20,50,80][index % 3] : a.x}%;top:${state.agents.length > 6 ? (105 + Math.floor(index / 3) * 125) + 'px' : a.y + '%'};--agent-color:${a.color}" aria-label="${escape(a.name)}, ${escape(a.role)}, ${assigned(a) ? 'working' : 'available'}">${assigned(a) ? `<span class="work-bubble">${state.paused ? 'Taking a breather' : 'Making progress…'}</span>` : ''}<span class="monitor"></span><span class="bot"></span><span class="desk-label"><i></i>${escape(a.name.toUpperCase())}</span></button>`).join('');
  $('office').style.height = state.agents.length > 6 ? (Math.ceil(state.agents.length / 3) * 125 + 160) + 'px' : '';
  $('office').classList.toggle('paused', state.paused);
  $('office-status').textContent = state.paused ? 'Office paused · take your time' : active ? `${state.agents.find(a => a.id === owner(active)).name} is moving things forward` : 'All systems feeling good';
  $('pause').innerHTML = `${state.paused ? '▷' : 'Ⅱ'} <span>${state.paused ? 'Resume office' : 'Pause office'}</span>`;
  const pending = state.jobs.filter(j => ['queued','running'].includes(j.status));
  $('queue').innerHTML = pending.slice(0, 4).map(jobCard).join('') || '<div class="empty">All caught up. Make room for a new idea. ✧</div>';
  $('queue-count').textContent = pending.length; $('nav-jobs').textContent = pending.length;
  $('team').innerHTML = state.agents.map(agentCard).join('');
  $('activity').innerHTML = state.events.slice(0, 3).map(eventCard).join('');
  const view = state.view || 'office';
  document.querySelectorAll('nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const titles = { office: ['Overview', 'Your team, in motion', 'A little coordination. A lot of possibility.'], agents: ['Agents', 'A few brilliant minds', 'Different specialties. Plenty of common ground.'], jobs: ['Jobs', 'Good work starts here', 'Follow every idea from the first spark to the final handoff.'], activity: ['Activity', 'A little office chatter', 'Every start, handoff, and finish. All in one place.'], zones: ['Zones', 'A place for every project', 'Eight color-coded zones. One connected office.'], appearance: ['Appearance', 'Make yourself at home', 'A workspace that feels right, day or night.'], integrations: ['Integrations', 'More tools for your team', 'Your ArtCraft library, connected to your office.'] };
  titles.projects=['Projects','Watch your projects take shape','Live folders, files, and agent deliverables.']; titles.completed=['Completed Jobs','A record of work done','Reopen past jobs and explore their saved results.']; const title = view==='ai'?['AI Connection','Connect your team','Connect Codex, Claude Code, or your OpenAI API account.']:titles[view] || titles.office;
  $('page-label').textContent = title[0]; $('page-title').innerHTML = `${title[1]}<span>.</span>`; $('page-subtitle').textContent = title[2];
  $('overview').hidden = view !== 'office'; $('alternate').hidden = view === 'office' || view === 'live';
  $('office-live').hidden = view !== 'live';
  const officeHost = view === 'live' ? $('office-live') : $('overview');
  if ($('office-workspace').parentElement !== officeHost) officeHost.append($('office-workspace'));
  $('open-live-office').hidden = view === 'live';
  if (view === 'live') {
    $('page-label').textContent = 'The Office Live';
    $('page-title').innerHTML = 'The Office Live<span>.</span>';
    $('page-subtitle').textContent = 'Watch your agents, follow the queue, and see work move between minds.';
  }
  if (view === 'agents') $('alternate').innerHTML = `<div class="panel"><div class="panel-heading"><div><h2>Your resident experts</h2><p>Select an agent to see their role and current work.</p></div><button class="subtle" data-add-agent>＋ Add agent</button></div><div class="team-grid full-team">${state.agents.map(agentCard).join('')}</div></div>`;
  if (view === 'jobs') $('alternate').innerHTML = `<div class="panel"><div class="filter-row">${['all', 'queued', 'running', 'done', 'failed', 'cancelled', 'archived'].map(f => `<button data-filter="${f}" class="${filter === f ? 'active' : ''}">${{all:'All jobs', queued:'Queued', running:'In progress', done:'Completed', failed:'Failed', cancelled:'Stopped', archived:'Demo history'}[f]}</button>`).join('')}</div><div class="all-jobs">${state.jobs.filter(j => filter === 'all' || j.status === filter).map(jobCard).join('') || '<div class="empty">No jobs here yet.</div>'}</div></div>`;
  if (view === 'activity') $('alternate').innerHTML = `<div class="panel"><div class="panel-heading"><div><h2>The office timeline</h2><p>The most recent 100 events are saved locally.</p></div><span class="live-badge">LOCAL DEMO</span></div><div class="activity-list">${state.events.map(eventCard).join('')}</div></div>`;
  renderFeatures(view);
  if(view==='ai')renderAI();
  if(view==='projects')renderProjects();
  if(view==='completed')renderCompletedJobs();
  if ($('detail-dialog').open && activeDetail) renderDetail();
}
function renderDetail() {
  function locationAction(job){if(job.status==='done'&&job.native&&job.workFolder){const bar=document.createElement('div');bar.className='job-location-actions';bar.innerHTML=`<button type="button" class="subtle" data-job-location="${escape(job.id)}">Open file location ↗</button><small>${escape(job.workFolder)}</small>`;const heading=$('detail').querySelector('.dialog-heading');heading?heading.after(bar):$('detail').prepend(bar);}}
  if (activeDetail.kind === 'agent') {
    const a = state.agents.find(a => a.id === activeDetail.id); const job = assigned(a);
    const descriptions = { atlas: 'Breaks a goal into stages and coordinates who works on what.', scout: 'Investigates context, gathers findings, and turns open questions into clear direction.', nova: 'Turns plans into implementation and passes work along for review.', pixel: 'Shapes the visual experience and prepares design direction for the developer.', sentinel: 'Reviews the work before the team calls a job complete.', echo: 'Turns research and findings into clear, useful written summaries.' };
    $('detail').innerHTML = `<div class="dialog-heading"><div class="detail-agent"><span class="agent-avatar" style="--agent-color:${a.color}">${escape(a.glyph)}</span><div><h2>${escape(a.name)}</h2><p>${escape(a.role)} · ${E.zones.find(z => z.id === a.zone).name}</p></div></div><button class="icon-button close-dialog" aria-label="Close">✕</button></div><p class="detail-copy">${escape(a.description || descriptions[a.id] || `A ${a.role.toLowerCase()} ready to collaborate on your next job.`)}</p><div class="detail-label">CURRENT WORK</div>${job ? jobCard(job) : '<p class="detail-copy">Available and ready for the next handoff.</p>'}<div class="detail-label">RECENT ACTIVITY</div>${state.events.filter(e => e.agent === a.id).slice(0, 3).map(eventCard).join('') || '<p class="detail-copy">A fresh start. Activity will appear as jobs progress.</p>'}<p class="form-note">${escape(a.name)} is a live specialist using its selected AI provider and assigned app permissions.</p>`;
    $('detail').insertAdjacentHTML('beforeend',agentAppsSummary(a));
  } else {
    const j = state.jobs.find(j => j.id === activeDetail.id); if (!j) { $('detail-dialog').close(); return; }
    if (j.execution === 'openai') { $('detail').innerHTML = liveJobDetail(j);locationAction(j); if(j.toolResults?.length)$('detail').insertAdjacentHTML('beforeend',`<details class="tool-schema"><summary>Actual tool results (${j.toolResults.length})</summary>${j.toolResults.map(result=>`<strong>${escape(result.agent)} · ${escape(result.tool)}</strong><pre class="app-result">${escape(result.result)}</pre>`).join('')}</details>`); return; }
    if (j.execution === 'artcraft') { $('detail').innerHTML = appJobDetail(j);locationAction(j); if(j.native&&j.status==='running')$('detail').insertAdjacentHTML('beforeend',`<button class="danger-button" data-ai-cancel="${escape(j.id)}" ${j.cancelRequested?'disabled':''}>${j.cancelRequested?'Stopping after the current action…':'Stop job'}</button>`); return; }
    const flow = E.workflow(j);
    $('detail').innerHTML = `<div class="dialog-heading"><div><div class="eyebrow">${escape(j.id)} · ${j.priority.toUpperCase()} PRIORITY</div><h2>${escape(j.title)}</h2></div><button class="icon-button close-dialog" aria-label="Close">✕</button></div>${badge(j)}<p class="detail-copy">${progress(j)}% complete · ${j.artifacts.length} of ${flow.length} demo stages finished.</p><div class="progress"><b style="width:${progress(j)}%"></b></div><div class="detail-label">COLLABORATION WORKFLOW</div><div class="workflow">${flow.map((id, i) => `<span class="${i < j.step ? 'finished' : i === j.step && j.status === 'running' ? 'current' : ''}">${i < j.step ? '✓ ' : ''}${escape(state.agents.find(a => a.id === id).name)}</span>`).join('')}</div><div class="detail-label">DEMO STAGE NOTES</div>${j.artifacts.map(a => `<div class="artifact">✓ ${escape(a.text)}</div>`).join('') || '<p class="detail-copy">Stage notes appear after each simulated handoff.</p>'}<p class="form-note">Progress and notes are simulated. This job does not generate code, research, or other AI output.</p>${j.status !== 'done' ? `<div class="detail-actions"><button class="danger-button" data-cancel="${escape(j.id)}">Cancel job</button></div>` : ''}`;
  }
}
function showDetail(kind, id) { activeDetail = { kind, id }; if (kind === 'agent') state.selected = id; renderDetail(); if (!$('detail-dialog').open) $('detail-dialog').showModal(); }
function newJob() { if(state.mode==='live'&&!ai.connection.hasKey){state.view='ai';save();render();toast('Connect OpenAI to start your first live job.');return;} prepareJobOptions(); $('job-dialog').showModal(); }
$('new-job').onclick = newJob; $('queue-add').onclick = newJob;
$('pause').onclick = async () => { if(state.mode==='live'){try{applyAISnapshot(await nativeCall('aiPause',!state.paused));render();}catch(error){toast(error.message);}return;} state.paused = !state.paused; E.log(state, 'atlas', state.paused ? 'Paused the office. All work is safely saved.' : 'Resumed the office. Back to making things happen.', 'system'); save(); render(); };
$('queue-more').onclick = () => { state.view = 'jobs'; filter = 'all'; save(); render(); };
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.matches('.close-dialog')) button.closest('dialog').close();
  if (button.dataset.view) { state.view = button.dataset.view; save(); render(); }
  if (button.dataset.agent) showDetail('agent', button.dataset.agent);
  if (button.dataset.job) showDetail('job', button.dataset.job);
  if (button.dataset.filter) { filter = button.dataset.filter; render(); }
  if (button.dataset.cancel) { const index = state.jobs.findIndex(j => j.id === button.dataset.cancel); if (index >= 0) {if(state.jobs[index].native){nativeCall('aiCancel',state.jobs[index].id).then(applyAISnapshot).catch(error=>toast(error.message));return;} E.log(state, 'atlas', `Cancelled “${state.jobs[index].title}”.`, 'system'); state.jobs.splice(index, 1); save(); $('detail-dialog').close(); render(); toast('Job cancelled. The team is ready for what’s next.'); } }
});
$('job-form').onsubmit = async event => { event.preventDefault(); const data = new FormData(event.target); const title = data.get('title').trim(); if (!title) { event.target.elements.title.setCustomValidity('Give this job a name.'); event.target.elements.title.reportValidity(); return; } if(state.mode==='live'){const submit=event.target.querySelector('button[type=submit]');submit.disabled=true;try{await createLiveJob(data);event.target.reset();$('job-dialog').close();render();toast('Live job queued.');}catch(error){toast(error.message);}finally{submit.disabled=false;}return;} const job = E.task(title, data.get('type'), data.get('priority')); const teammate = state.agents.find(a => a.id === data.get('teammate')); if (teammate) { job.flow = [...E.flows[job.type]]; job.flow.splice(job.flow.length - 1, 0, teammate.id); } job.projectId = data.get('projectId') || null; const project = state.projects.find(p => p.id === job.projectId); if (project) project.lastTouched = Date.now(); state.jobs.push(job); E.log(state, 'atlas', `Added “${job.title}” to the queue.`, 'start'); save(); event.target.reset(); $('job-dialog').close(); render(); toast('A new idea is on the board.'); };
$('job-form').elements.title.oninput = event => event.target.setCustomValidity('');
$('settings').onclick = () => { activeDetail = null; $('detail').innerHTML = `<div class="dialog-heading"><div><div class="eyebrow">YOUR WORKSPACE</div><h2>A little about this office.</h2></div><button class="icon-button close-dialog" aria-label="Close">✕</button></div><p class="detail-copy">Agent Office v0.2.0 runs live Codex, Claude Code, and OpenAI specialist workflows and real ArtCraft app tasks. Progress reflects actual work and handoffs.</p><p class="detail-copy">Jobs, stage notes, and activity are saved on this device. ArtCraft and Spotify integrations use installed local applications. Choose your provider in AI Connection. Queued jobs run by priority, then creation order.</p><p class="form-note">Jobs and deliverables are saved locally. Interrupted work is reported honestly and never automatically retried.</p><button class="subtle" id="export-data">↓ Export workspace</button>`; $('detail-dialog').showModal(); $('export-data').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = 'agent-office-workspace.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Workspace exported.'); }; };
document.querySelector('.brand').onclick = event => { event.preventDefault(); state.view = 'office'; render(); save(); };
document.addEventListener('keydown', event => { if (event.key === '1' && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector('dialog[open]') && !['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) { state.view = 'office'; render(); save(); } });
setInterval(() => { if (E.tick(state)) { save(); if (!['ai','appearance','integrations'].includes(state.view) && !document.querySelector('dialog[open]') && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) render(); } runPendingAppTask(); }, 2000);
function clock() { $('clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
clock(); setInterval(clock, 10000); render(); save(); initializeDesktopIntegrations(); initializeAI();
