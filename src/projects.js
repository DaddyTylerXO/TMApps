const projectView={selected:null,rootJob:null,data:null,error:'',folder:'',file:null,content:'',fileError:'',changes:[],loading:false,revision:0};
const projectPath=value=>String(value || '').replace(/\\/g,'/');
function projectJobLink(job){return job.native&&job.workFolder?`<button class="subtle" data-project-job="${escape(job.id)}">View project files ↗</button>`:'';}
function officeProjects(){
  const rows=state.projects.map(p=>({...p,jobs:state.jobs.filter(j=>j.projectId===p.id||(!j.projectId&&j.id===p.id))}));
  for(const job of state.jobs.filter(j=>j.native&&!rows.some(p=>p.jobs.includes(j)))){
    const id=job.projectId || job.id;let row=rows.find(p=>p.id===id);if(!row){row={id,name:job.title,status:job.status==='done'?'completed':'active',jobs:[]};rows.push(row);}row.jobs.push(job);
  }
  return rows.sort((a,b)=>Math.max(0,...b.jobs.map(j=>j.updated || j.created))-Math.max(0,...a.jobs.map(j=>j.updated || j.created)));
}
function projectRoots(project){const seen=new Set();const jobs=[...project.jobs];if(project.folderPath)jobs.push({id:'project:'+project.id,native:true,workFolder:project.folderPath,created:Number.MAX_SAFE_INTEGER});return jobs.filter(j=>j.native&&j.workFolder).sort((a,b)=>b.created-a.created).filter(j=>{if(seen.has(j.workFolder))return false;seen.add(j.workFolder);return true;});}
function selectProject(id){projectView.revision++;projectView.selected=id;projectView.rootJob=null;projectView.data=null;projectView.folder='';projectView.file=null;projectView.content='';projectView.error='';projectView.changes=[];state.projectSelection=id;save();renderProjects();}
function renderProjects(){
  const existingPreview=document.querySelector('.project-file-content');const selection=window.getSelection?.();
  if(existingPreview&&selection&&!selection.isCollapsed&&existingPreview.contains(selection.anchorNode))return;
  const fileScroll=document.querySelector('.project-files')?.scrollTop || 0;const previewScroll=existingPreview?.scrollTop || 0;
  const rows=officeProjects();let selected=rows.find(p=>p.id===(projectView.selected || state.projectSelection)) || rows[0];
  if(selected&&projectView.selected!==selected.id){projectView.selected=selected.id;projectView.data=null;projectView.rootJob=null;}
  const roots=selected?projectRoots(selected):[];
  if(!roots.some(j=>j.id===projectView.rootJob)){projectView.rootJob=roots[0]?.id || null;projectView.data=null;}
  const data=projectView.data;const entries=(data?.entries || []).filter(e=>projectPath(e.parent)===projectView.folder);
  const recent=projectView.changes.length?projectView.changes:(data?.entries || []).filter(e=>e.kind==='file').sort((a,b)=>b.modified-a.modified).slice(0,10).map(e=>({path:e.path,kind:'Updated',time:e.modified}));
  $('alternate').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>Project workspace</h2><p>Files and agent work, updated every two seconds while this tab is open.</p></div><button class="subtle" data-add-project="products">＋ New project</button></div><div class="project-workspace"><aside class="project-list">${rows.map(p=>`<button class="project-select ${p.id===selected?.id?'selected':''}" data-project-select="${escape(p.id)}"><strong>${escape(p.name)}</strong><small>${p.jobs.filter(j=>j.status==='running').length?'● Agents working':p.jobs.length+' jobs'} · ${escape(p.status)}</small></button>`).join('') || '<p class="empty">Create a project or give your agents a job to get started.</p>'}</aside><div class="project-browser">${selected?`<div class="project-browser-heading"><div><h3>${escape(selected.name)}</h3><p>${selected.jobs.length} linked jobs · ${selected.jobs.filter(j=>j.status==='done').length} completed</p></div><div class="ai-actions"><button class="subtle" data-project-new-job="${escape(selected.id)}">＋ Assign a job</button>${state.projects.some(p=>p.id===selected.id)?`<button class="text-button" data-project="${escape(selected.id)}">Edit project</button>`:''}</div></div>${roots.length?`<label>Project folder<select id="project-root">${roots.map(j=>`<option value="${escape(j.id)}" ${j.id===projectView.rootJob?'selected':''}>${escape(j.workFolder)}</option>`).join('')}</select></label><div class="project-folder-bar"><code>${escape(data?.root || roots.find(j=>j.id===projectView.rootJob)?.workFolder || '')}</code><button class="text-button" data-project-open>Open folder ↗</button><button class="text-button" data-project-refresh>↻ Refresh</button></div><p class="form-note" role="status">${escape(projectView.error || (data?'Checked '+new Date(data.checkedAt).toLocaleTimeString()+(data.truncated?' · Showing up to 1,000 entries / 9 folder levels.':''):'Loading project files…'))}</p><div class="project-file-layout"><div class="project-files"><div class="project-breadcrumb"><button class="text-button" data-project-up ${!projectView.folder?'disabled':''}>↑ Up</button><span>/${escape(projectView.folder)}</span></div>${entries.map(e=>`<button class="project-file ${e.path===projectView.file?'selected':''}" data-project-file="${escape(e.path)}" data-file-kind="${escape(e.kind)}"><span>${e.kind==='folder'?'▣':e.kind==='link'?'↗':'▤'} ${escape(e.name || e.path)}</span><small>${e.kind==='file'?formatProjectSize(e.size):escape(e.kind)}</small></button>`).join('') || `<p class="empty">${data?'This folder is empty. Agent-created files will appear here.':'Waiting for files…'}</p>`}</div><div class="project-preview"><div class="detail-label">${escape(projectView.file || 'FILE PREVIEW')}</div><pre class="project-file-content">${escape(projectView.fileError || (projectView.file?projectView.content:'Choose a text file to read its contents. Binary files stay in their original applications.'))}</pre></div></div><details class="project-changes" open><summary>Recent file changes</summary>${recent.map(c=>`<div><span>${escape(c.kind)} · ${escape(c.path)}</span><small>${new Date(c.time).toLocaleTimeString()}</small></div>`).join('') || '<p class="form-note">Changes will appear as agents create or update files.</p>'}</details>`:'<p class="empty">No folder yet. Assign a live job to create this project’s workspace.</p>'}<div class="detail-label">PROJECT JOBS</div><div class="all-jobs">${selected.jobs.map(jobCard).join('') || '<p class="empty">No jobs assigned yet.</p>'}</div>`:''}</div></div></section>`;
  const fileList=document.querySelector('.project-files');if(fileList)fileList.scrollTop=fileScroll;const preview=document.querySelector('.project-file-content');if(preview)preview.scrollTop=previewScroll;
  if(projectView.rootJob&&!projectView.data&&!projectView.loading&&!projectView.error)refreshProjectFiles();
}
function formatProjectSize(size){return size<1024?size+' B':size<1024*1024?(size/1024).toFixed(1)+' KB':(size/1024/1024).toFixed(1)+' MB';}
async function previewProjectFile(path){
  const id=projectView.rootJob;const revision=++projectView.revision;projectView.file=path;projectView.content='Loading…';projectView.fileError='';
  try{const result=await nativeCall('projectRead',{jobId:id,path});if(revision!==projectView.revision)return;projectView.content=result.content;}
  catch(error){if(revision!==projectView.revision)return;projectView.content='';projectView.fileError=error.message;}
  if(state.view==='projects')renderProjects();
}
async function refreshProjectFiles(){
  if(projectView.loading||!projectView.rootJob)return;const id=projectView.rootJob;projectView.loading=true;
  try{const data=await nativeCall('projectFiles',id);if(id!==projectView.rootJob)return;
    const old=projectView.data;let selectedChanged=false;
    if(old){const before=new Map(old.entries.map(e=>[e.path,e]));const after=new Map(data.entries.map(e=>[e.path,e]));const changes=[];
      for(const entry of data.entries){const prior=before.get(entry.path);if(!prior||prior.modified!==entry.modified||prior.size!==entry.size){changes.push({path:entry.path,kind:prior?'Updated':'Created',time:Date.now()});if(entry.path===projectView.file)selectedChanged=true;}}
      for(const entry of old.entries)if(!after.has(entry.path)&&!data.truncated){changes.push({path:entry.path,kind:'Removed',time:Date.now()});if(entry.path===projectView.file)selectedChanged=true;}
      projectView.changes=[...changes,...projectView.changes].slice(0,50);
    }
    projectView.data=data;projectView.error='';if(selectedChanged&&projectView.file)await previewProjectFile(projectView.file);
  }catch(error){if(id===projectView.rootJob)projectView.error=error.message;}
  finally{projectView.loading=false;if(state.view==='projects')renderProjects();}
}
function renderCompletedJobs(){const jobs=state.jobs.filter(j=>j.status==='done').sort((a,b)=>(b.finished || b.updated || b.created)-(a.finished || a.updated || a.created));$('alternate').innerHTML=`<section class="panel"><div class="panel-heading"><div><h2>Completed jobs</h2><p>Open a past job to read its deliverables, file locations, and tool results.</p></div><span class="count-badge">${jobs.length}</span></div><div class="all-jobs completed-jobs">${jobs.map(j=>`<div>${jobCard(j)}<p class="form-note completed-date">Completed ${new Date(j.finished || j.updated || j.created).toLocaleString()}${j.execution==='demo'?' · Demo history':''}</p></div>`).join('') || '<p class="empty">Completed work will be saved here.</p>'}</div></section>`;}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.projectSelect)selectProject(button.dataset.projectSelect);
  if(button.hasAttribute('data-project-refresh')){projectView.error='';refreshProjectFiles();}
  if(button.hasAttribute('data-project-open'))try{await nativeCall('projectOpen',projectView.rootJob);}catch(error){toast(error.message);}
  if(button.hasAttribute('data-project-up')){projectView.folder=projectView.folder.split('/').slice(0,-1).join('/');renderProjects();}
  if(button.dataset.projectFile){if(button.dataset.fileKind==='folder'){projectView.folder=projectPath(button.dataset.projectFile);renderProjects();}else if(button.dataset.fileKind==='file')previewProjectFile(button.dataset.projectFile);else toast('Linked files are not followed by the project browser.');}
  if(button.dataset.projectNewJob){const row=officeProjects().find(p=>p.id===button.dataset.projectNewJob);if(row&&!state.projects.some(p=>p.id===row.id)){state.projects.push({...E.project(row.name,'products'),id:row.id});save();}newJob();if($('job-dialog').open){const select=$('job-form').elements.projectId;if([...select.options].some(o=>o.value===button.dataset.projectNewJob))select.value=button.dataset.projectNewJob;}}
  if(button.dataset.projectJob){const row=officeProjects().find(p=>p.jobs.some(j=>j.id===button.dataset.projectJob));if(row){$('detail-dialog').close();state.view='projects';selectProject(row.id);projectView.rootJob=button.dataset.projectJob;projectView.data=null;render();}}
});
document.addEventListener('change',event=>{if(event.target.id==='project-root'){projectView.revision++;projectView.rootJob=event.target.value;projectView.data=null;projectView.folder='';projectView.file=null;projectView.changes=[];projectView.error='';renderProjects();}});
setInterval(()=>{if(state.view==='projects'&&!document.querySelector('dialog[open]'))refreshProjectFiles();},2000);
