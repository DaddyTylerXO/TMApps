'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const M=require('../ui/model.js');
const {runProcess,assTime:unused}=require('./export.cjs');
const {subtitles:legacySubtitles}=require('./export.cjs');
const atempo=speed=>{const parts=[];while(speed>2){parts.push('atempo=2');speed/=2;}while(speed<.5){parts.push('atempo=0.5');speed/=.5;}parts.push('atempo='+speed);return parts.join(',');};
const assTime=s=>{const cs=Math.round(s*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
const assText=s=>s.replace(/\\/g,'＼').replace(/{/g,'｛').replace(/}/g,'｝').replace(/\r?\n/g,'\\N');
const assColor=s=>'&H00'+s.slice(5,7)+s.slice(3,5)+s.slice(1,3);
function subtitles(project,w,h){
  const visible=project.items.filter(i=>['caption','text'].includes(i.type)&&!project.tracks.find(t=>t.id===i.trackId)?.hidden);
  let result=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n`;
  visible.forEach((i,index)=>{const s=i.style;result+=`Style: S${index},${s.font},${Math.round(h*s.size/100)},${assColor(s.color)},&H00FFFFFF,${assColor(s.outline)},&H80000000,-1,0,0,0,100,100,0,0,1,${s.outlineSize*h/1080},0,${s.align},${Math.round(w*.05)},${Math.round(w*.05)},${Math.round(h*.07)},1\n`;});
  result+='\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n';
  visible.forEach((i,index)=>{const animation=i.style.animation==='fade'?'{\\fad(180,180)}':i.style.animation==='pop'?'{\\fscx75\\fscy75\\t(0,180,\\fscx100\\fscy100)}':'';result+=`Dialogue: ${index},${assTime(i.start)},${assTime(i.start+i.duration)},S${index},,0,0,0,,${animation}${assText(i.text)}\n`;});return result;
}
function adjustment(a){
  const f=[];
  f.push(`eq=brightness=${a.brightness}:contrast=${a.contrast}:saturation=${a.saturation}:gamma=${1+a.brilliance*.5}`);
  if(a.sharpness||a.clarity)f.push(`unsharp=5:5:${a.sharpness+a.clarity*.5}:5:5:0`);
  if(a.hue)f.push(`hue=h=${a.hue}`);
  const hueColor={all:'r+y+g+c+b+m',reds:'r',greens:'g',blues:'b',yellows:'y',cyans:'c',magentas:'m'}[a.hslColor];
  if(a.hslHue||a.hslSaturation||a.hslLightness)f.push(`huesaturation=hue=${a.hslHue}:saturation=${a.hslSaturation}:intensity=${a.hslLightness}:colors=${hueColor}`);
  const radians=a.wheelHue*Math.PI/180,r=Math.cos(radians)*a.wheelStrength*.2,g=Math.cos(radians-2*Math.PI/3)*a.wheelStrength*.2,b=Math.cos(radians+2*Math.PI/3)*a.wheelStrength*.2;
  f.push(`colorbalance=rs=${a.shadows*.2}:gs=${a.shadows*.2}:bs=${a.shadows*.2}:rh=${a.highlights*.2}:gh=${a.highlights*.2}:bh=${a.highlights*.2}:rm=${Math.max(-1,Math.min(1,a.red+a.temperature*.15+r))}:gm=${Math.max(-1,Math.min(1,a.green+a.tint*.15+g))}:bm=${Math.max(-1,Math.min(1,a.blue-a.temperature*.15+b))}`);
  if(a.whites)f.push(`colorlevels=rimax=${1-Math.max(0,a.whites)*.25}:gimax=${1-Math.max(0,a.whites)*.25}:bimax=${1-Math.max(0,a.whites)*.25}:romax=${1+Math.min(0,a.whites)*.25}:gomax=${1+Math.min(0,a.whites)*.25}:bomax=${1+Math.min(0,a.whites)*.25}`);
  if(a.curveMid!==.5)f.push(`curves=all='0/0 0.5/${a.curveMid} 1/1'`);
  const presets={mono:'hue=s=0',warm:'colortemperature=temperature=7000',cool:'colortemperature=temperature=4500',vintage:'curves=preset=vintage',cinematic:'eq=contrast=1.15:saturation=0.8',vivid:'eq=saturation=1.4:contrast=1.08'};if(presets[a.filter])f.push(presets[a.filter]);
  if(a.blur>0)f.push(a.blurStyle==='box'?`boxblur=${Math.min(30,a.blur)}:2`:a.blurStyle==='pixelate'?`scale=iw/12:ih/12,scale=iw*12:ih*12:flags=neighbor`:`gblur=sigma=${a.blur}`);
  return f.join(',');
}
function expression(item,key,fallback){const keys=[...item.keyframes].sort((a,b)=>a.time-b.time);if(!keys.length)return String(fallback);let result=String(keys.at(-1)[key]);for(let n=keys.length-2;n>=0;n--){const a=keys[n],b=keys[n+1],u=`clip((t-${a.time})/${b.time-a.time},0,1)`,smooth=`(${u})*(${u})*(3-2*(${u}))`;result=`if(lt(t,${b.time}),${a[key]}+(${b[key]-a[key]})*(${smooth}),${result})`;}return `if(lt(t,${keys[0].time}),${keys[0][key]},${result})`;}
function maskFilter(crop){
  const expressions={circle:"if(lte(pow((X-W/2)/(W/2),2)+pow((Y-H/2)/(H/2),2),1),alpha(X,Y),0)",triangle:"if(lte(abs(X-W/2),(Y/H)*W/2),alpha(X,Y),0)",round:`if(lte(pow(max(abs(X-W/2)-(W/2-W*${crop.radius/100}),0),2)+pow(max(abs(Y-H/2)-(H/2-H*${crop.radius/100}),0),2),pow(min(W,H)*${crop.radius/100},2)),alpha(X,Y),0)`};
  return expressions[crop.shape]?`geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${expressions[crop.shape]}'`:null;
}
function buildArgs(project,media,output){
  const [w,h]=M.dimensions(project.settings),s=project.settings,duration=M.duration(project),args=['-hide_banner','-nostdin','-n','-filter_complex_threads','1'],f=[];
  const assets=project.items.filter(i=>['video','audio','image'].includes(i.type));const tracks=new Map(project.tracks.map(t=>[t.id,t]));
  args.push('-f','lavfi','-i',`color=c=${s.color}:s=${w}x${h}:r=${s.fps}:d=${duration}`);
  assets.forEach(i=>{const a=media.get(i.mediaId);if(i.type==='image')args.push('-loop','1','-t',String(M.length(i)),'-i',a.path);else args.push('-ss',String(i.in),'-t',String(i.out-i.in),'-i',a.path);});
  f.push('[0:v]format=rgba[canvas0]');let canvas='canvas0',layer=0;
  const ordered=assets.map((item,index)=>({item,input:index+1})).sort((a,b)=>project.tracks.findIndex(t=>t.id===a.item.trackId)-project.tracks.findIndex(t=>t.id===b.item.trackId)||a.item.start-b.item.start);
  const baseTrack=ordered.find(({item})=>item.type!=='audio'&&!tracks.get(item.trackId).hidden)?.item.trackId;
  for(const {item:i,input}of ordered){const track=tracks.get(i.trackId);if(i.type==='audio'||track.hidden)continue;const a=media.get(i.mediaId),c=i.crop,tr=i.transform,d=M.length(i),prefix='v'+input;let chain=[`setpts=(PTS-STARTPTS)/${i.speed}`],visualInput=input+':v';
    if(s.hdr==='smart'&&['smpte2084','arib-std-b67'].includes(a.transfer))chain.push('zscale=t=linear:npl=100','format=gbrpf32le','zscale=p=bt709','tonemap=hable:desat=0','zscale=t=bt709:m=bt709:r=tv');
    chain.push(`fps=${s.fps}`,`crop=w='trunc(iw*${(100-c.left-c.right)/100}/2)*2':h='trunc(ih*${(100-c.top-c.bottom)/100}/2)*2':x=iw*${c.left/100}:y=ih*${c.top/100}`);
    if(a.kind==='image'||a.alpha){f.push(`[${visualInput}]${chain.join(',')},format=rgba,split[${prefix}color][${prefix}alphaIn]`,`[${prefix}alphaIn]alphaextract[${prefix}alpha]`,`[${prefix}color]${adjustment(i.adjust)},format=rgb24[${prefix}graded]`,`[${prefix}graded][${prefix}alpha]alphamerge[${prefix}restored]`);visualInput=prefix+'restored';chain=[];}else chain.push(adjustment(i.adjust));
    if(c.shape==='square')chain.push("crop=w='min(iw,ih)':h='min(iw,ih)'");
    const slotW=Math.max(2,Math.round(w*tr.width/200)*2),slotH=Math.max(2,Math.round(h*tr.height/200)*2),cover=tr.fit==='cover'&&c.shape!=='square';
    chain.push(`scale=${slotW}:${slotH}:force_original_aspect_ratio=${cover?'increase':'decrease'}:force_divisible_by=2:flags=${s.upscale}`);if(cover)chain.push(`crop=${slotW}:${slotH}`);chain.push('setsar=1','format=rgba');
    if(i.chroma.enabled)chain.push(`colorkey=${i.chroma.quality==='auto'?(a.keyColor||i.chroma.color):i.chroma.color}:${i.chroma.similarity}:${i.chroma.blend}`);
    if(i.chroma.enabled&&i.chroma.quality==='detailed')chain.push('despill=type=green:mix=0.3');
    const mask=maskFilter(c);if(mask)chain.push(mask);if(tr.opacity!==1)chain.push(`colorchannelmixer=aa=${tr.opacity}`);
    if(tr.rotation)chain.push(`rotate=${tr.rotation}*PI/180:ow=rotw(${tr.rotation}*PI/180):oh=roth(${tr.rotation}*PI/180):c=none`);
    if(i.keyframes.length)chain.push(`scale=w='trunc(iw*(${expression(i,'zoom',1)})/2)*2':h='trunc(ih*(${expression(i,'zoom',1)})/2)*2':eval=frame`);
    if(i.transition.kind!=='none'&&i.transition.duration>0){const fade=Math.min(d/2,i.transition.duration);if(i.transition.kind==='fade')chain.push(`fade=t=in:st=0:d=${fade}:alpha=1`,`fade=t=out:st=${Math.max(0,d-fade)}:d=${fade}:alpha=1`);else chain.push(`fade=t=in:st=0:d=${fade}:alpha=1`);}
    chain.push(`trim=duration=${d}`,`setpts=PTS+${i.start}/TB`);f.push(`[${visualInput}]${chain.join(',')}[${prefix}]`);
    const useBlur=s.background==='blur'&&i.trackId===baseTrack;
    if(useBlur){
      f.push(`[${prefix}]split=2[${prefix}fg][${prefix}bg]`,`[${prefix}bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:2[back${input}]`,`[${canvas}][back${input}]overlay=0:0:eof_action=pass:enable='between(t,${i.start},${i.start+d})'[background${input}]`);canvas='background'+input;
    }
    const x=i.keyframes.length?expression(i,'x',tr.x).replace(/\bt\b/g,`(t-${i.start})`):String(tr.x),y=i.keyframes.length?expression(i,'y',tr.y).replace(/\bt\b/g,`(t-${i.start})`):String(tr.y);
    const next='canvas'+(++layer);let xpos=`(W-w)/2+W*(${x})/100`,ypos=`(H-h)/2+H*(${y})/100`;
    if(i.transition.kind==='wipeleft')xpos+=`-W*max(0,1-(t-${i.start})/${Math.max(.001,i.transition.duration)})`;
    if(i.transition.kind==='wiperight')xpos+=`+W*max(0,1-(t-${i.start})/${Math.max(.001,i.transition.duration)})`;
    f.push(`[${canvas}][${useBlur?prefix+'fg':prefix}]overlay=x='${xpos}':y='${ypos}':eof_action=pass:enable='between(t,${i.start},${i.start+d})'[${next}]`);canvas=next;
  }
  const trackAudio=new Map();assets.forEach((i,index)=>{const a=media.get(i.mediaId),track=tracks.get(i.trackId);if(i.type==='image'||!a.audio&&a.kind!=='audio'||i.muted||track.muted)return;const d=M.length(i),filters=['asetpts=PTS-STARTPTS',atempo(i.speed),'aresample=48000','aformat=sample_fmts=fltp:channel_layouts=stereo',`volume=${i.volume*(track.volume??1)}`];if(i.noise>0)filters.push(`afftdn=nr=${Math.max(.01,i.noise*30)}`);if(i.fadeIn>0)filters.push(`afade=t=in:d=${Math.min(d,i.fadeIn)}`);if(i.fadeOut>0)filters.push(`afade=t=out:st=${Math.max(0,d-i.fadeOut)}:d=${Math.min(d,i.fadeOut)}`);filters.push(`apad=whole_dur=${d}`,`atrim=duration=${d}`,`adelay=${Math.round(i.start*1000)}|${Math.round(i.start*1000)}`);const label='a'+index;f.push(`[${index+1}:a]${filters.join(',')}[${label}]`);if(!trackAudio.has(i.trackId))trackAudio.set(i.trackId,[]);trackAudio.get(i.trackId).push({label,item:i});});
  const trackLabels=new Map();let n=0;
  for(const [trackId,parts]of trackAudio){const label='track'+n++;f.push(parts.map(p=>`[${p.label}]`).join('')+`amix=inputs=${parts.length}:normalize=0[${label}]`);trackLabels.set(trackId,label);}
  // Each track can duck against one selected reference track. Split references so they also remain audible.
  const duckerRefs=new Map();for(const [tid,parts]of trackAudio){const duck=parts.find(p=>p.item.duck>0&&trackLabels.has(p.item.duckTrack)&&p.item.duckTrack!==tid)?.item;if(duck){const ref=duck.duckTrack;if(!duckerRefs.has(ref))duckerRefs.set(ref,[]);duckerRefs.get(ref).push({tid,duck});}}
  const finalTracks=new Map(trackLabels),sideInputs=[];for(const [ref,users]of duckerRefs){const original=trackLabels.get(ref),outs=[original+'keep',...users.map((_,i)=>original+'side'+i)];f.push(`[${original}]asplit=${outs.length}${outs.map(l=>`[${l}]`).join('')}`);finalTracks.set(ref,outs[0]);users.forEach((user,index)=>sideInputs.push({...user,label:outs[index+1]}));}
  for(const {tid,duck,label}of sideInputs){const output='ducked'+n++;f.push(`[${finalTracks.get(tid)}][${label}]sidechaincompress=threshold=${.2-.19*duck.duck}:ratio=${1+19*duck.duck}:attack=20:release=300[${output}]`);finalTracks.set(tid,output);}
  if(finalTracks.size)f.push([...finalTracks.values()].map(l=>`[${l}]`).join('')+`amix=inputs=${finalTracks.size}:normalize=0,alimiter=limit=0.95,apad,atrim=duration=${duration}[audio]`);else f.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${duration}[audio]`);
  if(project.items.some(i=>['text','caption'].includes(i.type))){f.push(`[${canvas}]ass=filename=captions.ass[captioned]`);canvas='captioned';}
  const format=s.format;let video=canvas;
  if(format==='gif'){const gw=s.gifWidth||480,gfps=s.gifFps||15;f.push(`[${canvas}]fps=${gfps},scale=${gw}:-2:flags=lanczos,split[paletteIn][gifIn]`,'[paletteIn]palettegen[palette]','[gifIn][palette]paletteuse[gif]');video='gif';}
  args.push('-filter_complex',f.join(';'));
  if(['wav','mp3'].includes(format))args.push('-map','[audio]','-vn','-c:a',format==='wav'?'pcm_s16le':'libmp3lame','-b:a','192k');
  else{args.push('-map',`[${video}]`);if(format==='gif')args.push('-an','-loop','0');else{const encoder=format==='webm'?'libvpx-vp9':format==='mov'&&s.encoder==='prores_ks'?'prores_ks':s.encoder==='libx265'?'libx265':'libx264';args.push('-map','[audio]','-c:v',encoder);if(['libx264','libx265'].includes(encoder))args.push('-preset',s.preset);if(encoder==='libvpx-vp9')args.push('-deadline','good','-cpu-used','4');if(encoder==='prores_ks')args.push('-profile:v','3','-pix_fmt','yuv422p10le');else args.push('-pix_fmt','yuv420p','-b:v',`${s.bitrate}M`);args.push('-c:a',format==='webm'?'libopus':'aac','-b:a','192k');if(['mp4','mov'].includes(format))args.push('-movflags','+faststart');args.push('-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709');}}
  // Consume otherwise-unused graph output pads for audio-only exports.
  if(['wav','mp3'].includes(format))f.push(`[${canvas}]nullsink`);else if(format==='gif')f.push('[audio]anullsink');
  const filterIndex=args.indexOf('-filter_complex');args[filterIndex+1]=f.join(';');
  args.push('-t',String(duration),'-progress','pipe:1','-nostats',output);return args;
}
async function exportVideo(binary,project,media,output,options){const temp=await fs.mkdtemp(path.join(options.tempRoot,'cut-render-'));try{const [w,h]=M.dimensions(project.settings);await fs.writeFile(path.join(temp,'captions.ass'),subtitles(project,w,h));const args=buildArgs(project,media,output),index=args.indexOf('-filter_complex');await fs.writeFile(path.join(temp,'render.ffgraph'),args[index+1]);args.splice(index,2,'-filter_complex_script','render.ffgraph');await runProcess(binary,args,{...options,cwd:temp});}finally{await fs.rm(temp,{recursive:true,force:true});}}
module.exports={buildArgs,exportVideo,adjustment,subtitles,atempo,expression,maskFilter};
