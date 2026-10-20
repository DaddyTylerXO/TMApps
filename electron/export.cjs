'use strict';
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { dimensions } = require('./project.cjs');
const isHdr = source => ['smpte2084','arib-std-b67'].includes(source.transfer);
function assTime(seconds) { const cs=Math.round(seconds*100); return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`; }
function assText(value) { return value.replace(/\\/g,'＼').replace(/{/g,'｛').replace(/}/g,'｝').replace(/\r?\n/g,'\\N'); }
function subtitles(project,w,h) {
  const size=Math.round(h*0.045), margin=Math.round(h*.07);
  let output=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\nStyle: Caption,Arial,${size},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.max(1,h/500)},0,2,${margin},${margin},${margin},1\nStyle: Title,Arial,${Math.round(size*1.4)},&H00FFFFFF,&H00FFFFFF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,8,${margin},${margin},${margin},1\nStyle: Brand,Arial,${Math.round(size*.65)},&H40FFFFFF,&H00FFFFFF,&H00101010,&H80000000,0,0,0,0,100,100,0,0,1,1,0,3,${margin},${margin},${Math.round(margin*.4)},1\n\n[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n`;
  const line=(style,start,end,text)=>`Dialogue: 0,${assTime(start)},${assTime(end)},${style},,0,0,0,,${assText(text)}\n`;
  for(const c of project.captions) output+=line('Caption',c.start,c.end,c.text);
  if(project.title) output+=line('Title',0,project.duration,project.title);
  if(project.watermark) output+=line('Brand',0,project.duration,project.watermark);
  return output;
}
function buildArgs(project,media,output) {
  const [w,h]=dimensions(project.settings),fps=project.settings.fps,filters=[],args=['-hide_banner','-nostdin','-n','-filter_complex_threads','1'];
  project.clips.forEach(c=>args.push('-ss',String(c.in),'-t',String(c.out-c.in),'-i',media.get(c.mediaId).path));
  if(project.overlay) args.push('-loop','1','-i',media.get(project.overlay.mediaId).path);
  const fit=`scale=${w}:${h}:force_original_aspect_ratio=decrease:force_divisible_by=2`,fill=`scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  project.clips.forEach((c,i)=>{
    const source=media.get(c.mediaId),duration=c.out-c.in;
    const tone=project.settings.hdr==='smart' && isHdr(source) ? 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,' : '';
    filters.push(`[${i}:v:0]setpts=PTS-STARTPTS,${tone}fps=${fps},setsar=1,format=yuv420p[base${i}]`);
    if(project.settings.background==='blur') {
      filters.push(`[base${i}]split=2[fg${i}][bg${i}]`,`[bg${i}]${fill},boxblur=20:2[blur${i}]`,`[fg${i}]${fit}[fit${i}]`,`[blur${i}][fit${i}]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1[v${i}]`);
    } else filters.push(`[base${i}]${fit},pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${project.settings.color},setsar=1[v${i}]`);
    if(source.audio) filters.push(`[${i}:a:0]atrim=duration=${duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${duration}[a${i}]`);
    else filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${i}]`);
  });
  filters.push(project.clips.map((_,i)=>`[v${i}][a${i}]`).join('')+`concat=n=${project.clips.length}:v=1:a=1[joined][audio]`);
  let video='joined';
  if(project.overlay) {
    const o=project.overlay;
    filters.push(`[${project.clips.length}:v]scale=${Math.round(w*o.width/100/2)*2}:-2,format=rgba,colorchannelmixer=aa=${o.opacity}[logo]`,`[joined][logo]overlay=x=(W-w)*${o.x/100}:y=(H-h)*${o.y/100}:shortest=1[branded]`); video='branded';
  }
  if(project.title || project.watermark || project.captions.length) { filters.push(`[${video}]ass=filename=captions.ass[captioned]`); video='captioned'; }
  args.push('-filter_complex',filters.join(';'),'-map',`[${video}]`,'-map','[audio]','-t',String(project.duration),'-c:v','libx264','-preset','fast','-pix_fmt','yuv420p','-b:v',`${project.settings.bitrate}M`,'-maxrate',`${project.settings.bitrate}M`,'-bufsize',`${project.settings.bitrate*2}M`,'-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-b:a','192k','-movflags','+faststart','-progress','pipe:1','-nostats',output);
  return args;
}
function runProcess(binary,args,{cwd,signal,onProgress}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{cwd,windowsHide:true,signal}); let errors='',buffer='',failure;
    child.stderr.on('data',chunk=>{errors=(errors+chunk).slice(-16000);});
    child.stdout.on('data',chunk=>{buffer+=chunk; const lines=buffer.split(/\r?\n/); buffer=lines.pop(); for(const line of lines) {const m=line.match(/^out_time_us=(\d+)/); if(m) onProgress?.(+m[1]/1e6);}});
    child.on('error',error=>{failure=error;}); child.on('close',code=>failure?reject(failure):code===0?resolve():reject(new Error(signal?.aborted?'Export cancelled.':`Video processing failed. ${errors.slice(-3000)}`)));
  });
}
async function exportVideo(binary,project,media,output,options) {
  const temp=await fs.mkdtemp(path.join(options.tempRoot,'cut-export-'));
  try { const [w,h]=dimensions(project.settings); await fs.writeFile(path.join(temp,'captions.ass'),subtitles(project,w,h)); await runProcess(binary,buildArgs(project,media,output),{...options,cwd:temp}); }
  finally { await fs.rm(temp,{recursive:true,force:true}); }
}
module.exports={buildArgs,subtitles,isHdr,runProcess,exportVideo};
