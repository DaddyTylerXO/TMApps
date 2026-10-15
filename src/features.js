let editingProject = null;
function suggestedProjectFolder(name){let value=String(name || '').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim().replace(/[ .]+$/g,'').slice(0,90) || 'new-project';return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)?'project-'+value:value;}
function updateProjectFolderPreview(){const form=$('project-form');const parent=form.elements.projectParentFolder.value;const name=form.elements.projectFolderName.value;$('project-folder-preview').textContent=parent?parent.replace(/[\\/]+$/,'')+'\\'+name:'Default projects location / '+name;}
function setProjectFolderFields(info,locked){const form=$('project-form');form.dataset.folderLocked=String(locked);form.elements.projectParentFolder.value=info.parentFolder || '';form.elements.projectFolderName.value=info.folderName || suggestedProjectFolder(form.elements.name.value);form.elements.projectFolderName.disabled=locked;$('choose-project-folder').disabled=locked||!window.desktop?.projectFolderChoose;$('project-folder-note').textContent=locked?'This project already has a saved location. Renaming the project does not move its files.':'A new folder will be created here when you save. Choose an unused folder name.';if(info.folderPath)form.projectFolderRecord=info;updateProjectFolderPreview();}
function zoneOptions() { return OfficeEngine.zones.map(z => `<option value="${z.id}">${z.name}</option>`).join(''); }
function projectCard(project) {
  const zone = E.zones.find(z => z.id === project.zone);
  const stale = E.stale(project);
  return `<button class="project-card project-${project.status}" data-project="${escape(project.id)}" style="--zone-color:${zone.color}" aria-label="${escape(project.name)}, ${project.status}${stale ? ', untouched for at least 7 days' : ''}"><span class="project-icon">${zone.icon}${project.status === 'completed' ? '<span class="gold-check" aria-label="Completed">✓</span>' : ''}</span><span class="project-copy"><strong>${escape(project.name)}</strong><small>${project.status[0].toUpperCase() + project.status.slice(1)}</small></span>${stale ? '<span class="stale-badge" title="Untouched for 7 or more days">!<span class="sr-only"> Untouched for at least 7 days</span></span>' : '<span class="project-edit">↗</span>'}</button>`;
}
function zoneCards(compact = false) {
  return E.zones.map(z => {
    const projects = state.projects.filter(p => p.zone === z.id);
    const agents = state.agents.filter(a => a.zone === z.id);
    return `<article class="zone-card" style="--zone-color:${z.color}"><div class="zone-heading"><span class="zone-icon">${z.icon}</span><h3>${z.name}</h3><span class="zone-count">${projects.length}</span><button class="zone-add" data-add-project="${z.id}" aria-label="Add project to ${z.name}">＋</button></div><p class="zone-description">${z.description}</p><div class="zone-projects">${projects.map(projectCard).join('') || '<p class="zone-empty">A little room for your next idea.</p>'}</div>${!compact ? `<div class="zone-agents">${agents.length ? agents.map(a => `<button data-agent="${escape(a.id)}" class="zone-agent" style="--agent-color:${a.color}"><span>${escape(a.glyph)}</span>${escape(a.name)}</button>`).join('') : '<span>No resident agents yet</span>'}</div>` : ''}</article>`;
  }).join('');
}
function applyAppearance() {
  const a = state.appearance;
  const dark = a.theme === 'dark' || (a.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('reduce-motion', !!a.reducedMotion);
  document.documentElement.style.setProperty('--text-scale',a.textSize / 100);
  document.documentElement.classList.toggle('text-large',a.textSize >= 140);
}
function renderFeatures(view) {
  applyAppearance();
  $('nav-agent-count').textContent = state.agents.length;
  document.querySelector('.team-panel .count-badge').textContent = state.agents.length;
  document.querySelector('.office-footer>span:last-child').textContent = `${state.agents.length} desks · 1 team`;
  $('zone-overview').innerHTML = zoneCards(true);
  if (view === 'zones') $('alternate').innerHTML = `<section class="panel zones-panel"><div class="panel-heading"><div><h2>The project neighborhood</h2><p>Choose a project to update its status, move it, or mark it as touched.</p></div><button class="subtle" data-add-project="products">＋ New project</button></div><div class="project-legend"><span>▣ Active · solid</span><span>▧ Prototype · dashed</span><span class="completed-key">✓ Completed · gold check</span><span>Ⅱ Paused</span><span class="stale-key">● Untouched for 7+ days</span></div><div class="zone-grid">${zoneCards()}</div><p class="zone-note">Project changes and linked live job activity refresh the last-touched time.</p></section>`;
  if (view === 'appearance') $('alternate').innerHTML = `<section class="panel appearance-panel"><div class="panel-heading"><div><h2>Appearance</h2><p>Saved on this device and restored when you return.</p></div><span class="count-badge">PERSONAL</span></div><div class="appearance-body"><h3>Color theme</h3><p>Set the mood for your office.</p><div class="theme-options">${['light','dark','system'].map(theme => `<button class="theme-option ${state.appearance.theme === theme ? 'selected' : ''}" data-theme-option="${theme}" aria-pressed="${state.appearance.theme === theme}"><span class="theme-preview ${theme}"><b></b><i></i><i></i><i></i></span><strong>${theme === 'system' ? 'Follow system' : theme[0].toUpperCase() + theme.slice(1)}</strong><span>${state.appearance.theme === theme ? '✓ Selected' : theme === 'system' ? 'Match your device' : 'Choose theme'}</span></button>`).join('')}</div><div class="motion-setting"><div><h3>Reduce motion</h3><p>Keep agent animations and warning badges still.</p></div><label class="switch-label"><input id="reduce-motion" type="checkbox" ${state.appearance.reducedMotion ? 'checked' : ''}> Reduce motion</label></div></div></section>`;
  if (view === 'appearance') document.querySelector('.appearance-body').insertAdjacentHTML('afterbegin', `<div class="text-size-setting"><div><h3>Text size</h3><p>Make labels, controls, and reading text easier to see.</p></div><div class="size-controls"><button type="button" class="subtle" data-text-step="-10" aria-label="Decrease text size">A−</button><label class="sr-only" for="text-size">Text size</label><input id="text-size" type="range" min="100" max="200" step="10" value="${state.appearance.textSize}"><output id="text-size-value" for="text-size">${state.appearance.textSize}%</output><button type="button" class="subtle" data-text-step="10" aria-label="Increase text size">A＋</button><button type="button" class="text-button" data-text-reset>Reset</button></div></div>`);
  if (view === 'integrations') renderIntegrations();
  if(view==='appearance')document.querySelector('.appearance-body').insertAdjacentHTML('afterbegin',officeAppearanceOptions());
  renderOfficeAppearance();
  document.querySelectorAll('.agent-card[data-agent]').forEach(card=>{if(state.agents.find(a=>a.id===card.dataset.agent)?.provider==='claude')card.querySelector('.agent-top small').textContent+=' · Claude Code';});
}
function openAgentForm() {
  const form=$('agent-form');if(!form.elements.provider){const field=document.createElement('label');field.innerHTML='AI provider<select name="provider"><option value="default">Office default</option><option value="claude">Claude Code</option></select>';form.querySelector('button[type="submit"]').before(field);}form.elements.provider.value='default';
  $('agent-zone').innerHTML = zoneOptions(); $('agent-zone').value = 'products';
  $('agent-dialog').showModal();
}
function openProjectForm(id, zone = 'products') {
  editingProject = id;
  const project = state.projects.find(p => p.id === id);
  const form = $('project-form'); form.reset();
  $('project-zone').innerHTML = zoneOptions();
  $('project-form-title').textContent = project ? 'Update your project.' : 'Create a project.';
  form.elements.name.value = project?.name || '';
  form.elements.zone.value = project?.zone || zone;
  form.elements.status.value = project?.status || (zone === 'archive' ? 'paused' : 'active');
  if(!$('project-folder-settings')){const fields=document.createElement('div');fields.id='project-folder-settings';fields.innerHTML='<label>Folder location on this device<input name="projectParentFolder" id="project-parent-folder" readonly placeholder="Default projects location"></label><button type="button" class="subtle" id="choose-project-folder">Choose location…</button><label>Folder name<input name="projectFolderName" id="project-folder-name" maxlength="100" required autocomplete="off"></label><p class="form-note" id="project-folder-note"></p><p class="form-note project-folder-preview" id="project-folder-preview"></p><p class="form-note ai-error" id="project-folder-error" role="alert"></p>';form.querySelector('button[type="submit"]').before(fields);}
  form.dataset.folderNameEdited='false';form.dataset.parentEdited='false';form.dataset.folderRequest=String(Date.now()+Math.random());form.projectFolderRecord=null;$('project-folder-error').textContent='';
  const oldJob=id&&state.jobs.find(j=>j.projectId===id&&j.native&&j.workFolder);const location=project?.folderPath || oldJob?.workFolder;const known=project?.folderPath?project:{parentFolder:location?location.replace(/[\\/][^\\/]+[\\/]?$/,''):'',folderName:location?location.split(/[\\/]/).filter(Boolean).at(-1):suggestedProjectFolder(project?.name)};
  setProjectFolderFields(known,!!location);const request=form.dataset.folderRequest;
  if(window.desktop?.projectFolderInfo)nativeCall('projectFolderInfo',id).then(info=>{if(form.dataset.folderRequest!==request||!$('project-dialog').open||form.dataset.parentEdited==='true')return;if(info.folderPath)setProjectFolderFields(info,true);else if(!location){form.elements.projectParentFolder.value=info.parentFolder || '';updateProjectFolderPreview();}}).catch(error=>{if(form.dataset.folderRequest===request)$('project-folder-error').textContent=error.message;});
  let touched = $('project-touched');
  if (!touched) { touched = document.createElement('p'); touched.id = 'project-touched'; touched.className = 'form-note'; form.querySelector('button[type="submit"]').before(touched); }
  touched.textContent = project ? `Last touched: ${new Date(project.lastTouched).toLocaleString()}. Saving refreshes this timestamp.` : '';
  $('project-dialog').showModal();
}
function prepareJobOptions() {
  const form = $('job-form');
  let options = $('job-options');
  if (!options) { options = document.createElement('div'); options.id = 'job-options'; options.className = 'form-row'; form.querySelector('.form-note').before(options); }
  options.innerHTML = `<label>Project (optional)<select name="projectId"><option value="">No linked project</option>${state.projects.map(p => `<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('')}</select></label><label>Additional teammate<select name="teammate"><option value="">Default team</option>${state.agents.filter(a => !E.agents.some(defaultAgent => defaultAgent.id === a.id)).map(a => `<option value="${escape(a.id)}">${escape(a.name)} · ${escape(a.role)}</option>`).join('')}</select></label>`;
}
document.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.id === 'new-agent' || button.hasAttribute('data-add-agent')) openAgentForm();
  if (button.hasAttribute('data-add-project')) openProjectForm(null, button.dataset.addProject);
  if (button.dataset.project) openProjectForm(button.dataset.project);
  if (button.dataset.themeOption) { state.appearance.theme = button.dataset.themeOption; save(); render(); toast('Appearance saved.'); }
  if (button.dataset.textStep || button.hasAttribute('data-text-reset')) {
    state.appearance.textSize = button.hasAttribute('data-text-reset') ? 100 : Math.min(200,Math.max(100,state.appearance.textSize + Number(button.dataset.textStep)));
    applyAppearance(); save(); render();
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'text-size') { state.appearance.textSize = Number(event.target.value); applyAppearance(); $('text-size-value').textContent = state.appearance.textSize + '%'; save(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'reduce-motion') { state.appearance.reducedMotion = event.target.checked; applyAppearance(); save(); }
});
document.getElementById('agent-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target; const data = new FormData(form); const name = data.get('name').trim();
  if (!name) { form.elements.name.setCustomValidity('Give this agent a name.'); form.elements.name.reportValidity(); return; }
  if (state.agents.some(a => a.name.toLowerCase() === name.toLowerCase())) { form.elements.name.setCustomValidity('An agent with this name already exists.'); form.elements.name.reportValidity(); return; }
  const agent = { id: 'agent-' + crypto.randomUUID(), name, role: data.get('role'), provider:data.get('provider')==='claude'?'claude':'default',zone: data.get('zone'), description: data.get('description').trim(), color: data.get('color'), glyph: [...name][0].toUpperCase(), x:50, y:50 };
  state.agents.push(agent); E.log(state, agent.id, `Joined the ${E.zones.find(z => z.id === agent.zone).name} zone as ${agent.role}.`, 'system');
  save(); form.reset(); $('agent-dialog').close(); render(); toast(`${name} has joined the team.`);
});
document.getElementById('agent-form').elements.name.addEventListener('input', event => event.target.setCustomValidity(''));
document.getElementById('project-form').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target; const data = new FormData(form); const name = data.get('name').trim();
  if (!name) { form.elements.name.setCustomValidity('Give this project a name.'); form.elements.name.reportValidity(); return; }
  const project = state.projects.find(p => p.id === editingProject);const next=project || E.project(name,data.get('zone'),data.get('status'));const submit=form.querySelector('button[type="submit"]');
  let folder=form.projectFolderRecord;
  if(form.dataset.folderLocked!=='true'&&window.desktop?.projectFolderSave){submit.disabled=true;try{folder=await nativeCall('projectFolderSave',{projectId:next.id,parentFolder:data.get('projectParentFolder'),folderName:data.get('projectFolderName')});}catch(error){$('project-folder-error').textContent=error.message;return;}finally{submit.disabled=false;}}
  Object.assign(next,{name,zone:data.get('zone'),status:data.get('status'),lastTouched:Date.now()},folder?{folderPath:folder.folderPath,folderName:folder.folderName,parentFolder:folder.parentFolder}:{});
  if(!project)state.projects.push(next);
  E.log(state, 'atlas', `${project ? 'Updated' : 'Created'} project “${name}” in ${data.get('zone').toUpperCase()}.`, 'system');
  save(); $('project-dialog').close(); render(); toast('Project saved. Last-touched time updated.');
});
document.getElementById('project-form').elements.name.addEventListener('input', event => event.target.setCustomValidity(''));
document.addEventListener('input',event=>{const form=$('project-form');if(event.target===form.elements.name&&form.dataset.folderLocked!=='true'&&form.dataset.folderNameEdited!=='true'){form.elements.projectFolderName.value=suggestedProjectFolder(event.target.value);updateProjectFolderPreview();}if(event.target.id==='project-folder-name'){form.dataset.folderNameEdited='true';updateProjectFolderPreview();}});
document.addEventListener('click',async event=>{if(!event.target.closest('#choose-project-folder'))return;const form=$('project-form');const request=form.dataset.folderRequest;try{const selected=await nativeCall('projectFolderChoose');if(selected&&form.dataset.folderRequest===request){form.dataset.parentEdited='true';form.elements.projectParentFolder.value=selected;updateProjectFolderPreview();}}catch(error){$('project-folder-error').textContent=error.message;}});
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.appearance.theme === 'system') applyAppearance(); });
setInterval(() => {
  document.querySelectorAll('[data-project]').forEach(button => {
    const project = state.projects.find(p => p.id === button.dataset.project);
    if (project && !!button.querySelector('.stale-badge') !== E.stale(project)) {
      const template = document.createElement('template'); template.innerHTML = projectCard(project);
      button.innerHTML = template.content.firstElementChild.innerHTML;
      button.setAttribute('aria-label', template.content.firstElementChild.getAttribute('aria-label'));
    }
  });
}, 60000);
