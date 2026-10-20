'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile), ffmpeg=require('ffmpeg-static'),ffprobe=require('ffprobe-static').path;
const {validate,dimensions,parseSrt}=require('../electron/project.cjs');
const {exportVideo,subtitles}=require('../electron/export.cjs');
const sample=()=>({schemaVersion:1,name:'Test edit',clips:[{mediaId:'a',in:.1,out:.6},{mediaId:'b',in:0,out:.4}],title:'Hello {world} \\ test',watermark:'@TMApps',captions:[{start:.1,end:.7,text:'A real caption\nTwo lines'}],overlay:{mediaId:'logo',x:90,y:10,width:20,opacity:.7},settings:{ratio:'9:16',resolution:480,fps:24,bitrate:5,background:'blur',color:'#17191f',hdr:'smart'}});
test('project validation, trim limits, SRT, and landscape/portrait dimensions',()=>{
  const media=new Map([['a',{kind:'video',duration:1}],['b',{kind:'video',duration:1}],['logo',{kind:'image'}]]),value=sample();
  assert.equal(validate(value,media).duration,.9);assert.deepEqual(dimensions({ratio:'16:9',resolution:2160}),[3840,2160]);assert.deepEqual(dimensions({ratio:'9:16',resolution:2160}),[2160,3840]);
  value.clips[0].out=2;assert.throws(()=>validate(value,media),/Clip end/);value.clips[0].out=.6;value.settings.fps=145;assert.throws(()=>validate(value,media),/Frame rate/);
  assert.deepEqual(parseSrt('1\r\n00:00:00,100 --> 00:00:01,250\r\n<b>hello</b>'),[{start:.1,end:1.25,text:'hello'}]);assert.throws(()=>parseSrt('1\ninvalid\ntext'),/Invalid/);
  const ass=subtitles(sample(),480,854);assert.ok(!ass.includes('{world}'));assert.ok(ass.includes('Two lines'));
});
test('real export joins trimmed audio + silent clips, renders captions, blurred background and transparent logo',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'tma-cut-test-'));
  try {
    const a=path.join(root,'clip a.mp4'),b=path.join(root,'clip b.mp4'),logo=path.join(root,'logo.png'),output=path.join(root,'final.mp4');
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=c=red:s=320x180:r=24:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',a],{windowsHide:true});
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=c=blue:s=180x320:r=24:d=1','-c:v','libx264','-pix_fmt','yuv420p',b],{windowsHide:true});
    await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=c=white@0.5:s=100x50,format=rgba','-frames:v','1',logo],{windowsHide:true});
    const media=new Map([['a',{kind:'video',path:a,duration:1,audio:true}],['b',{kind:'video',path:b,duration:1,audio:false}],['logo',{kind:'image',path:logo}]]),project=validate(sample(),media);let progressed=false;
    await exportVideo(ffmpeg,project,media,output,{tempRoot:root,onProgress:()=>progressed=true});
    const result=JSON.parse((await exec(ffprobe,['-v','error','-show_streams','-show_format','-of','json',output],{windowsHide:true})).stdout),v=result.streams.find(s=>s.codec_type==='video');
    assert.equal(v.width,480);assert.equal(v.height,854);assert.equal(v.r_frame_rate,'24/1');assert.equal(v.color_transfer,'bt709');assert.ok(result.streams.some(s=>s.codec_type==='audio'));assert.ok(Math.abs(+result.format.duration-.9)<.15);assert.ok(progressed);
    // Exercise solid canvas and the upper frame-rate range, with a real tiny 4K output.
    const high=validate({...sample(),clips:[{mediaId:'a',in:0,out:.05}],title:'',watermark:'',captions:[],overlay:null,settings:{...sample().settings,ratio:'16:9',resolution:2160,fps:144,bitrate:100,background:'solid'}},media);
    const highOutput=path.join(root,'4k.mp4');await exportVideo(ffmpeg,high,media,highOutput,{tempRoot:root});const probe=JSON.parse((await exec(ffprobe,['-v','error','-show_streams','-of','json',highOutput],{windowsHide:true})).stdout);assert.equal(probe.streams[0].width,3840);assert.equal(probe.streams[0].height,2160);assert.equal(probe.streams[0].r_frame_rate,'144/1');
    // Synthetic PQ input ensures Smart HDR executes the actual tone-map chain.
    const hdr=path.join(root,'hdr.mp4');await exec(ffmpeg,['-v','error','-f','lavfi','-i','color=c=gray:s=160x90:r=24:d=0.2','-vf','format=yuv420p10le','-c:v','libx265','-x265-params','log-level=error','-color_primaries','bt2020','-color_trc','smpte2084','-colorspace','bt2020nc',hdr],{windowsHide:true});
    media.set('hdr',{kind:'video',path:hdr,duration:.2,audio:false,transfer:'smpte2084'});const hdrProject=validate({...sample(),clips:[{mediaId:'hdr',in:0,out:.1}],title:'',watermark:'',captions:[],overlay:null,settings:{...sample().settings,background:'solid'}},media);await exportVideo(ffmpeg,hdrProject,media,path.join(root,'sdr.mp4'),{tempRoot:root});
    const cancel=new AbortController();cancel.abort();await assert.rejects(exportVideo(ffmpeg,project,media,path.join(root,'cancel.mp4'),{tempRoot:root,signal:cancel.signal}));
    const activeCancel=new AbortController(),timer=setTimeout(()=>activeCancel.abort(),30);
    try{await assert.rejects(exportVideo(ffmpeg,{...high,clips:[{mediaId:'a',in:0,out:1}],duration:1},media,path.join(root,'active-cancel.mp4'),{tempRoot:root,signal:activeCancel.signal}));}finally{clearTimeout(timer);}
    assert.equal((await fs.readdir(root)).filter(name=>name.startsWith('cut-export-')).length,0);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
