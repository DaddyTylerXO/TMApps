'use strict';
const fs=require('node:fs/promises'),{createReadStream}=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process'),{promisify}=require('node:util'),crypto=require('node:crypto');
const {runProcess}=require('./export.cjs');
const {read,atomic}=require('./store.cjs');
const exec=promisify(execFile);
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
class Secrets{
  constructor(root,safeStorage){this.file=path.join(root,'connections.json');this.safe=safeStorage;}
  async get(name){const saved=await read(this.file,{});if(!saved[name])return '';if(!this.safe.isEncryptionAvailable())throw new Error('The operating system credential store is unavailable.');return this.safe.decryptString(Buffer.from(saved[name],'base64'));}
  async set(name,value){if(!['speech','youtube','tiktok','acoustid','github'].includes(name)||typeof value!=='string'||value.length>10000)throw new Error('Invalid connection.');const data=await read(this.file,{});if(value){if(!this.safe.isEncryptionAvailable()||this.safe.getSelectedStorageBackend?.()==='basic_text')throw new Error('Secure credential storage is unavailable. Enable your OS keychain first.');data[name]=this.safe.encryptString(value).toString('base64');}else delete data[name];await atomic(this.file,data);}
  async status(){const data=await read(this.file,{});return Object.fromEntries(['speech','youtube','tiktok','acoustid','github'].map(k=>[k,!!data[k]]));}
}
async function checked(response){if(!response.ok)throw new Error(`Service request failed (${response.status}). ${String(await response.text()).slice(0,500)}`);return response;}
async function synthesize({text,voice,settings,secrets,root}){
  if(typeof text!=='string'||!text.trim()||text.length>10000)throw new Error('Enter up to 10,000 characters of speech.');const file=path.join(root,'generated',crypto.randomUUID()+'.wav');await fs.mkdir(path.dirname(file),{recursive:true});
  if(settings.ttsProvider==='windows'){
    if(process.platform!=='win32')throw new Error('Windows Microsoft voices are available only on Windows. Choose Azure Speech for macOS / Linux.');
    const request=path.join(root,'generated',crypto.randomUUID()+'.json');await fs.writeFile(request,JSON.stringify({text,voice,rate:settings.speechRate||0}));
    const script='Add-Type -AssemblyName System.Speech; $r=Get-Content -LiteralPath $env:TMA_CUT_TTS_REQUEST -Raw | ConvertFrom-Json; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { if($r.voice){ $s.SelectVoice($r.voice) }; $s.Rate=[int]$r.rate; $s.SetOutputToWaveFile($env:TMA_CUT_TTS_OUTPUT); $s.Speak([string]$r.text) } finally { $s.Dispose() }';
    try{await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:300000,env:{...process.env,TMA_CUT_TTS_REQUEST:request,TMA_CUT_TTS_OUTPUT:file}});}finally{await fs.rm(request,{force:true});}
  }else{
    voice=voice||'en-US-JennyNeural';
    const key=await secrets.get('speech'),region=settings.speechRegion;if(!key||!region)throw new Error('Configure Microsoft Azure Speech region and key in Settings → Connections, or choose Windows voices.');
    if(!/^[a-z][a-z0-9-]{1,45}$/.test(region)||! /^[\w-]+$/.test(voice))throw new Error('Invalid Speech voice or region.');
    const response=await checked(await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'riff-24khz-16bit-mono-pcm','User-Agent':'TMA-Cut'},body:`<speak version='1.0' xml:lang='${xml(settings.speechLanguage||'en-US')}'><voice name='${xml(voice)}'>${xml(text)}</voice></speak>`,signal:AbortSignal.timeout(120000)}));await fs.writeFile(file,Buffer.from(await response.arrayBuffer()));
  }
  return file;
}
async function voices(settings,secrets){
  if(settings.ttsProvider==='windows'){
    if(process.platform!=='win32')return [];
    const script='Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; try { @($s.GetInstalledVoices() | ForEach-Object { @{name=$_.VoiceInfo.Name; locale=$_.VoiceInfo.Culture.Name} }) | ConvertTo-Json -Compress } finally { $s.Dispose() }';const r=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:20000});const value=JSON.parse(r.stdout);return Array.isArray(value)?value:[value];
  }
  const key=await secrets.get('speech'),region=settings.speechRegion;if(!key||!region)throw new Error('Configure Azure Speech first.');const data=await (await checked(await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,{headers:{'Ocp-Apim-Subscription-Key':key},signal:AbortSignal.timeout(30000)}))).json();return data.map(v=>({name:v.ShortName,locale:v.Locale}));
}
async function transcribe({item,source,settings,ffmpeg,root,signal}){
  if(!settings.whisperExecutable||!settings.whisperModel)throw new Error('Select a local whisper.cpp executable and model in Settings → Captions. No model is bundled.');
  for(const file of [settings.whisperExecutable,settings.whisperModel]){if(!path.isAbsolute(file))throw new Error('Choose an absolute local Whisper path.');await fs.access(file);}
  const dir=await fs.mkdtemp(path.join(root,'transcribe-')),wav=path.join(dir,'speech.wav'),prefix=path.join(dir,'captions');
  try{await runProcess(ffmpeg,['-hide_banner','-nostdin','-n','-ss',String(item.in),'-t',String(item.out-item.in),'-i',source.path,'-vn','-ar','16000','-ac','1','-c:a','pcm_s16le',wav],{signal});await exec(settings.whisperExecutable,['-m',settings.whisperModel,'-f',wav,'-oj','-of',prefix,'-l',settings.captionLanguage||'auto','-t',String(Math.max(1,Math.min(8,settings.captionThreads||4)))],{windowsHide:true,signal,timeout:3600000,maxBuffer:8*1024**2});const result=JSON.parse(await fs.readFile(prefix+'.json','utf8'));if(!Array.isArray(result.transcription))throw new Error('Whisper did not return timed transcription.');return result.transcription.map(c=>({text:c.text.trim(),start:item.start+c.offsets.from/1000/item.speed,end:item.start+c.offsets.to/1000/item.speed})).filter(c=>c.text&&c.end>c.start);}finally{await fs.rm(dir,{recursive:true,force:true});}
}
async function copyrightLookup({source,settings,secrets}){
  if(!settings.fingerprintExecutable||!await secrets.get('acoustid'))return {configured:false,verdict:'Unknown',message:'Copyright cannot be determined locally. Configure fpcalc and an AcoustID key for recording identification. A match never proves ownership, licence, or upload clearance.'};
  const {stdout}=await exec(settings.fingerprintExecutable,['-json',source.path],{windowsHide:true,timeout:120000,maxBuffer:4*1024**2});const data=JSON.parse(stdout),key=await secrets.get('acoustid');const body=new URLSearchParams({client:key,duration:String(Math.round(data.duration)),fingerprint:data.fingerprint,meta:'recordings',format:'json'});const response=await (await checked(await fetch('https://api.acoustid.org/v2/lookup',{method:'POST',body,signal:AbortSignal.timeout(30000)}))).json();return {configured:true,verdict:'Unknown',matches:response.results||[],message:'Recording identification only. No match does not mean copyright-free. Verify licensing with the rights holder and destination platform.'};
}
async function youtubeUpload(file,title,token){
  const stat=await fs.stat(file);const init=await checked(await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(stat.size)},body:JSON.stringify({snippet:{title,description:'Created with TMA-Cut'},status:{privacyStatus:'private'}}),signal:AbortSignal.timeout(30000)}));const location=new URL(init.headers.get('location'));if(location.protocol!=='https:'||location.hostname!=='www.googleapis.com')throw new Error('Unexpected YouTube upload destination.');const response=await checked(await fetch(location,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(stat.size)},body:createReadStream(file),duplex:'half',signal:AbortSignal.timeout(3600000)}));const result=await response.json();return {message:'Uploaded privately to YouTube. Review the video and its thumbnail in YouTube Studio.',id:result.id};
}
async function tiktokUpload(file,title,token){
  const size=(await fs.stat(file)).size,chunk=Math.min(size,50*1024**2),count=Math.ceil(size/chunk);const response=await (await checked(await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({source_info:{source:'FILE_UPLOAD',video_size:size,chunk_size:chunk,total_chunk_count:count}}),signal:AbortSignal.timeout(30000)}))).json();if(response.error?.code&&response.error.code!=='ok')throw new Error(response.error.message||'TikTok rejected the upload.');const location=new URL(response.data.upload_url);if(location.protocol!=='https:'||!/(^|\.)(tiktokapis\.com|tiktokv\.com)$/.test(location.hostname))throw new Error('Unexpected TikTok upload destination.');const handle=await fs.open(file);try{for(let n=0;n<count;n++){const start=n*chunk,end=Math.min(size,start+chunk),buffer=Buffer.alloc(end-start);await handle.read(buffer,0,buffer.length,start);await checked(await fetch(location,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Range':`bytes ${start}-${end-1}/${size}`,'Content-Length':String(buffer.length)},body:buffer,signal:AbortSignal.timeout(600000)}));}}finally{await handle.close();}return {id:response.data.publish_id,message:'Sent to your TikTok inbox. Open TikTok to finish editing and publish the draft.'};
}
module.exports={Secrets,synthesize,voices,transcribe,copyrightLookup,youtubeUpload,tiktokUpload,xml};
