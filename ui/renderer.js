'use strict';
const $=id=>document.getElementById(id), api=window.cut;
const initial=()=>({schemaVersion:1,name:'Untitled edit',clips:[],captions:[],title:'',watermark:'',overlay:null,settings:{ratio:'16:9',background:'solid',color:'#17191f',resolution:1080,fps:30,bitrate:15,hdr:'smart'}});
let project=initial(),assets=new Map(),selected=-1,playhead=0,activeClip=-1,playing=false,busy=false,dirty=false,exported=false;
let undo=[],redo=[];
const total=()=>project.clips.reduce((sum,c)=>sum+c.out-c.in,0);
const durationText=n=>{n=Math.max(0,n||0);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;};
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
function notice(message){$('notice').textContent=message;}
async function call(method,value){const result=await api[method](value);if(!result.ok)throw new Error(result.error);return result.data;}
function act(fn){return async event=>{try{await fn(event);}catch(error){notice(error.message);if($('export-dialog').open)$('export-status').textContent=error.message;}};}
function change(){undo.push(JSON.stringify(project));if(undo.length>60)undo.shift();redo=[];dirty=true;exported=false;$('share-options').hidden=true;}
function mark(){dirty=true;exported=false;$('share-options').hidden=true;$('project-state').textContent='Unsaved changes';}
function syncInputs(){
  $('project-name').value=project.name;$('title').value=project.title;$('watermark').value=project.watermark;
  for(const key of ['ratio','background','color','resolution','fps','bitrate','hdr'])$(key).value=project.settings[key];
  if(project.overlay)for(const key of ['width','x','y','opacity'])$('overlay-'+key).value=project.overlay[key];
}
function render(){
  $('undo').disabled=!undo.length||busy;$('redo').disabled=!redo.length||busy;$('project-state').textContent=dirty?'Unsaved changes':'Ready when you are';
  $('media-count').textContent=[...assets.values()].filter(a=>a.kind==='video').length;
  $('empty-library').hidden=assets.size>0;$('media-list').replaceChildren();
  for(const item of assets.values())if(item.kind==='video'){
    const row=el('div',undefined,'media-item'),icon=el('span','▶'),info=el('div'),name=el('strong',item.name),meta=el('small',`${durationText(item.duration)} · ${item.width} × ${item.height}`),add=el('button','＋');
    name.title=item.name;info.append(name,meta);add.title='Add '+item.name+' to timeline';add.disabled=busy;add.onclick=()=>addClip(item);row.append(icon,info,add);$('media-list').append(row);
  }
  $('timeline-track').replaceChildren();
  if(!project.clips.length)$('timeline-track').append(el('p','Import footage, then add clips to start your edit.','hint'));
  project.clips.forEach((clip,index)=>{
    const button=el('button',undefined,'clip'+(index===selected?' active':''));button.dataset.index=index;button.setAttribute('aria-pressed',index===selected);button.disabled=busy;button.style.width=Math.min(250,140+(clip.out-clip.in)*2)+'px';
    button.append(el('strong',`${String(index+1).padStart(2,'0')}  ${assets.get(clip.mediaId)?.name||'Missing clip'}`),el('small',`${(clip.out-clip.in).toFixed(2)}s · ${clip.in.toFixed(2)} → ${clip.out.toFixed(2)}`));
    button.onclick=()=>{selected=index;playing=false;seek(project.clips.slice(0,index).reduce((s,c)=>s+c.out-c.in,0));render();};$('timeline-track').append(button);
  });
  const clip=project.clips[selected];
  $('selected-clip').textContent=clip?assets.get(clip.mediaId)?.name:'Select a clip to trim';
  for(const id of ['trim-in','trim-out','apply-trim','move-left','move-right','remove-clip'])$(id).disabled=!clip||busy;
  $('move-left').disabled=!clip||selected===0||busy;$('move-right').disabled=!clip||selected===project.clips.length-1||busy;
  $('trim-in').value=clip?.in??0;$('trim-out').value=clip?.out??0;
  $('duration').textContent=`${project.clips.length} clip${project.clips.length===1?'':'s'} · ${total().toFixed(1)}s`;
  $('scrub').max=total();$('scrub').disabled=!clip||busy;$('play').disabled=!project.clips.length;
  $('import').disabled=busy;$('import-empty').disabled=busy;$('add-clips').disabled=busy;
  $('open-project').disabled=busy;$('save-project').disabled=busy||!project.clips.length;$('export-open').disabled=busy||!project.clips.length;
  $('preview-empty').hidden=!!project.clips.length;$('video').hidden=!project.clips.length;
  const [a,b]=project.settings.ratio.split(':').map(Number),ratio=a/b;
  fitStage();
  $('stage').style.backgroundColor=project.settings.color;$('preview-ratio').textContent=project.settings.ratio+' canvas';$('blur-video').style.opacity=project.settings.background==='blur'&&project.clips.length?'1':'0';$('color-label').hidden=project.settings.background!=='solid';
  const captionSize=ratio>=1?.045/ratio*100:.045*100;
  $('preview-caption').style.fontSize=captionSize+'cqw';$('preview-title').style.fontSize=captionSize*1.4+'cqw';$('preview-watermark').style.fontSize=captionSize*.65+'cqw';
  $('captions-list').replaceChildren();project.captions.forEach((caption,index)=>{const item=el('div',undefined,'caption-item'),remove=el('button','Remove');item.append(el('small',`${caption.start.toFixed(2)}s → ${caption.end.toFixed(2)}s`),el('p',caption.text),remove);remove.onclick=()=>{change();project.captions.splice(index,1);render();};$('captions-list').append(item);});
  $('overlay-controls').hidden=!project.overlay;$('preview-overlay').hidden=!project.overlay;
  if(project.overlay){const o=project.overlay;$('overlay-name').textContent=assets.get(o.mediaId)?.name;$('preview-overlay').src=assets.get(o.mediaId)?.url;$('preview-overlay').style.width=o.width+'%';$('preview-overlay').style.left=o.x+'%';$('preview-overlay').style.top=o.y+'%';$('preview-overlay').style.transform=`translate(-${o.x}%, -${o.y}%)`;$('preview-overlay').style.opacity=o.opacity;$('width-output').textContent=o.width+'%';}
  $('bitrate-output').textContent=project.settings.bitrate+' Mbps';summary();paint();
}
function paint(){
  $('time').textContent=`${durationText(playhead)} / ${durationText(total())}`;$('scrub').value=playhead;$('play').textContent=playing?'Ⅱ':'▶';
  $('preview-title').textContent=project.clips.length?project.title:'';$('preview-watermark').textContent=project.clips.length?project.watermark:'';
  $('preview-caption').textContent=project.captions.filter(c=>playhead>=c.start&&playhead<c.end).map(c=>c.text).join('\n');
}
function fitStage(){const area=document.querySelector('.stage-area'),[a,b]=project.settings.ratio.split(':').map(Number),ratio=a/b;const width=Math.min(Math.max(0,area.clientWidth-44),Math.max(0,area.clientHeight-44)*ratio);if(width){$('stage').style.width=width+'px';$('stage').style.height=width/ratio+'px';}}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(fitStage).observe(document.querySelector('.stage-area'));
function locate(seconds){let start=0;for(let i=0;i<project.clips.length;i++){const c=project.clips[i],end=start+c.out-c.in;if(seconds<end||i===project.clips.length-1)return {index:i,source:c.in+Math.min(seconds-start,c.out-c.in),start};start=end;}return null;}
function seek(seconds){
  playhead=Math.max(0,Math.min(total(),seconds));const point=locate(playhead);if(!point){$('video').removeAttribute('src');$('blur-video').removeAttribute('src');activeClip=-1;paint();return;}
  const source=assets.get(project.clips[point.index].mediaId),video=$('video'),blur=$('blur-video');
  if(activeClip!==point.index||video.getAttribute('src')!==source.url){activeClip=point.index;video.src=source.url;blur.src=source.url;$('preview-warning').hidden=true;}
  const apply=()=>{video.currentTime=Math.max(0,point.source);blur.currentTime=Math.max(0,point.source);if(playing){video.play().catch(()=>{playing=false;paint();});if(project.settings.background==='blur')blur.play().catch(()=>{});}else{video.pause();blur.pause();}};
  if(video.readyState>=1)apply();else video.addEventListener('loadedmetadata',apply,{once:true});paint();
}
function addClip(item){if(busy)return;change();project.clips.push({mediaId:item.id,in:0,out:item.duration});selected=project.clips.length-1;playing=false;seek(total()-item.duration);render();}
async function importVideos(){if(busy)return;const result=await call('importVideos');if(!result)return;result.media.forEach(item=>assets.set(item.id,item));if(result.media.length){change();for(const item of result.media)project.clips.push({mediaId:item.id,in:0,out:item.duration});selected=Math.max(0,selected);playing=false;seek(playhead);render();}notice(result.errors.length?result.errors.join(' · '):`${result.media.length} video${result.media.length===1?'':'s'} added. Make yourself at home.`);}
function panel(name){document.querySelectorAll('.panel').forEach(p=>p.hidden=p.id!=='panel-'+name);document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.panel===name));}
function summary(){const s=project.settings,[a,b]=s.ratio.split(':').map(Number),ratio=a/b,even=n=>Math.round(n/2)*2,w=ratio>=1?even(s.resolution*ratio):s.resolution,h=ratio>=1?s.resolution:even(s.resolution/ratio);$('export-summary').textContent=`${w} × ${h} · ${s.fps} fps · ${s.bitrate} Mbps\n${total().toFixed(1)} seconds · About ${((s.bitrate+.192)*total()/8).toFixed(1)} MB`;}
for(const id of ['import','import-empty','add-clips'])$(id).onclick=act(importVideos);
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>panel(b.dataset.panel));
for(const key of ['ratio','background','color','resolution','fps','bitrate','hdr'])$(key).addEventListener('change',()=>{change();project.settings[key]=['resolution','fps','bitrate'].includes(key)?Number($(key).value):$(key).value;render();});
$('bitrate').oninput=()=>{$('bitrate-output').textContent=$('bitrate').value+' Mbps';};
document.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{change();project.settings.ratio=b.dataset.ratio;syncInputs();render();});
for(const id of ['title','watermark']){ $(id).addEventListener('focus',()=>change());$(id).addEventListener('input',()=>{project[id]=$(id).value;mark();paint();}); }
$('project-name').addEventListener('focus',()=>change());$('project-name').addEventListener('input',()=>{project.name=$('project-name').value;mark();});
$('apply-trim').onclick=act(()=>{const clip=project.clips[selected],start=+$('trim-in').value,end=+$('trim-out').value;if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end-start<.04||end>assets.get(clip.mediaId).duration)throw new Error('Trim points must be inside the clip, with at least 0.04 seconds between them.');change();clip.in=start;clip.out=end;clampCaptions();playing=false;seek(Math.min(playhead,total()));render();notice('Trim applied.');});
function clampCaptions(){const duration=total();const old=project.captions.length;project.captions=project.captions.map(c=>({...c,end:Math.min(c.end,duration)})).filter(c=>c.start<c.end);if(old!==project.captions.length)notice('Captions outside the shortened timeline were removed.');}
$('remove-clip').onclick=()=>{change();project.clips.splice(selected,1);selected=Math.min(selected,project.clips.length-1);clampCaptions();playing=false;activeClip=-1;seek(Math.min(playhead,total()));render();};
for(const [id,offset] of [['move-left',-1],['move-right',1]])$(id).onclick=()=>{change();const target=selected+offset;[project.clips[selected],project.clips[target]]=[project.clips[target],project.clips[selected]];selected=target;activeClip=-1;playing=false;seek(playhead);render();};
$('play').onclick=()=>{playing=!playing;if(playing&&playhead>=total()-.02)playhead=0;seek(playhead);};
$('scrub').oninput=()=>{playing=false;seek(+$('scrub').value);};
$('video').addEventListener('timeupdate',()=>{if(!playing||activeClip<0)return;const c=project.clips[activeClip];const offset=project.clips.slice(0,activeClip).reduce((s,c)=>s+c.out-c.in,0);playhead=offset+Math.max(0,$('video').currentTime-c.in);if($('video').currentTime>=c.out-.035){if(activeClip<project.clips.length-1)seek(offset+c.out-c.in+.001);else{playing=false;$('video').pause();$('blur-video').pause();playhead=total();}}else if(project.settings.background==='blur'&&Math.abs($('video').currentTime-$('blur-video').currentTime)>.12)$('blur-video').currentTime=$('video').currentTime;paint();});
$('video').addEventListener('ended',()=>{if(!playing)return;const point=locate(playhead);if(point&&activeClip<project.clips.length-1)seek(project.clips.slice(0,activeClip+1).reduce((s,c)=>s+c.out-c.in,0)+.001);else{playing=false;paint();}});
$('video').addEventListener('error',()=>{$('preview-warning').hidden=false;playing=false;paint();});
$('mute').onclick=()=>{$('video').muted=!$('video').muted;$('mute').textContent=$('video').muted?'Sound off':'Sound on';};
$('add-caption').onclick=act(()=>{const text=$('caption-text').value.trim(),start=+$('caption-start').value,end=+$('caption-end').value;if(!text||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>total())throw new Error('Add caption text and times within the edited video.');change();project.captions.push({text,start,end});project.captions.sort((a,b)=>a.start-b.start);$('caption-text').value='';render();});
$('import-srt').onclick=act(async()=>{const captions=await call('importCaptions');if(!captions)return;if(captions.some(c=>c.start<0||c.end>total()))throw new Error('SRT captions must fit inside the edited timeline.');change();project.captions.push(...captions);project.captions.sort((a,b)=>a.start-b.start);render();notice(`${captions.length} captions imported.`);});
$('overlay-import').onclick=act(async()=>{const result=await call('importOverlay');if(!result)return;if(result.errors.length)throw new Error(result.errors.join(' · '));const image=result.media[0];if(!image)return;assets.set(image.id,image);change();project.overlay={mediaId:image.id,x:95,y:5,width:20,opacity:1};syncInputs();render();});
for(const key of ['width','x','y','opacity'])$('overlay-'+key).oninput=()=>{if(!project.overlay)return;change();project.overlay[key]=+$('overlay-'+key).value;render();};
$('overlay-remove').onclick=()=>{change();project.overlay=null;render();};
$('save-project').onclick=act(async()=>{const name=await call('saveProject',project);if(name){dirty=false;render();notice('Saved '+name+'. Keep source media with your project.');}});
$('open-project').onclick=act(async()=>{if(dirty&&!window.confirm('Open another edit? Unsaved changes will be lost.'))return;const result=await call('openProject');if(!result)return;playing=false;assets=new Map(result.media.map(x=>[x.id,x]));project=result.project;undo=[];redo=[];dirty=false;exported=false;selected=0;activeClip=-1;syncInputs();seek(0);render();notice('Edit opened.');});
function restoreHistory(from,to){if(!from.length||busy)return;to.push(JSON.stringify(project));project=JSON.parse(from.pop());selected=Math.min(selected,project.clips.length-1);dirty=true;exported=false;playing=false;activeClip=-1;syncInputs();seek(Math.min(playhead,total()));render();}
$('undo').onclick=()=>restoreHistory(undo,redo);$('redo').onclick=()=>restoreHistory(redo,undo);
document.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select'))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();if(event.shiftKey)restoreHistory(redo,undo);else restoreHistory(undo,redo);}if(event.code==='Space'&&!$('export-dialog').open){event.preventDefault();$('play').click();}});
$('export-open').onclick=()=>{summary();$('export-status').textContent='';$('share-options').hidden=!exported;$('export-dialog').showModal();};
$('export-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('export').onclick=act(async()=>{
  if(busy)return;const s=project.settings;if(!Number.isInteger(s.fps)||s.fps<24||s.fps>144)throw new Error('Choose a whole frame rate from 24 to 144 fps.');
  busy=true;playing=false;seek(playhead);document.body.classList.add('busy');$('export').disabled=true;$('close-export').disabled=true;$('cancel-export').hidden=false;$('export-progress').hidden=false;$('export-progress').value=0;$('share-options').hidden=true;$('export-status').textContent='Choose where to save your MP4…';
  $('export-dialog').querySelectorAll('select,input').forEach(x=>x.disabled=true);render();
  try{const result=await call('exportVideo',project);if(result){exported=true;$('export-status').textContent='Exported '+result.name;$('share-options').hidden=false;notice('Your final cut is ready.');}else $('export-status').textContent='Export not started.';}
  finally{busy=false;document.body.classList.remove('busy');$('export').disabled=false;$('close-export').disabled=false;$('cancel-export').hidden=true;$('export-dialog').querySelectorAll('select,input').forEach(x=>x.disabled=false);render();}
});
$('cancel-export').onclick=act(()=>call('cancelExport'));$('reveal').onclick=act(()=>call('revealExport'));
document.querySelectorAll('[data-share]').forEach(b=>b.onclick=act(()=>call('share',b.dataset.share)));
api.onProgress(data=>{$('export-progress').value=data.percent;$('export-status').textContent=`Rendering your story… ${data.percent}%`;});
api.onCommand(command=>{if(command==='import')act(importVideos)();});
window.cutSmoke=()=>({ok:!!$('stage')&&!!$('timeline-track')&&document.querySelectorAll('[data-panel]').length===4,nodeAvailable:typeof require!=='undefined',panels:4,exportDisabled:$('export-open').disabled,title:document.title});
window.cutTest={getProject:()=>project,getAssets:()=>assets,importVideos,seek,render,total};
syncInputs();render();
