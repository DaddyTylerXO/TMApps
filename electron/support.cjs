'use strict';
const {version}=require('../package.json');
const ROOT='https://github.com/DaddyTylerXO/TMApps';
const fs=require('node:fs'),path=require('node:path');
const categories=['renderer-exit','main-exception','main-rejection','load-failure'];
const links={feature:ROOT+'/issues/new?template=feature-request.md&title=%5BPadlock%5D%20Feature%20request',bug:ROOT+'/issues/new?template=bug-report.md&title=%5BPadlock%5D%20Bug%20report',issue:ROOT+'/issues/new?template=general-issue.md&title=%5BPadlock%5D%20Issue',help:ROOT+'/tree/TMA-Padlock/docs',discussions:ROOT+'/discussions',library:ROOT+'/blob/TMA-Padlock/docs/KB%20Library.docx'};
// Keep a small, allowlisted diagnostic. Never record error messages, paths,
// account data, arbitrary stack traces, passwords or renderer-provided payloads.
class Diagnostics {
  constructor(){this.events=[];}
  initialize(file){this.file=file;try{if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>4096)return;const data=JSON.parse(fs.readFileSync(file,'utf8'));if(Array.isArray(data))this.events=data.filter(e=>e&&categories.includes(e.kind)&&typeof e.time==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.time)).slice(-10).map(({kind,time})=>({kind,time}));}catch{}}
  record(kind){if(!categories.includes(kind))return;this.events.push({time:new Date().toISOString(),kind});this.events=this.events.slice(-10);if(this.file)try{fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+require('node:crypto').randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(this.events),{mode:0o600,flag:'wx'});fs.renameSync(tmp,this.file);}finally{try{fs.unlinkSync(tmp);}catch{}}}catch{}}
  text(){return JSON.stringify({app:'TMA-Padlock',version,platform:process.platform,arch:process.arch,events:this.events},null,2);}
}
function reportURL(value,diagnostics){
  if(!value||!['bug','issue','feature','crash'].includes(value.kind)||typeof value.description!=='string'||value.description.length>2000||typeof value.includeDiagnostic!=='boolean')throw Error('Invalid report.');
  const diagnostic=JSON.parse(diagnostics.text());diagnostic.events=diagnostic.events.slice(-3);
  const body=`App: TMA-Padlock ${version}\n\n${value.description}\n\n${value.includeDiagnostic?JSON.stringify(diagnostic):'Diagnostics not included.'}`;
  const url=new URL(ROOT+'/issues/new');url.searchParams.set('template',value.kind==='feature'?'feature-request.md':value.kind==='issue'?'general-issue.md':'bug-report.md');url.searchParams.set('title','[Padlock] '+value.kind+' report');url.searchParams.set('body',body);if(url.href.length>2000)throw Error('Report is too long for your browser link. Shorten the description or turn off diagnostics.');return url.href;
}
module.exports={links,Diagnostics,reportURL};
