'use strict';
const test=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {SuiteAuth,config}=require('../electron/auth.cjs');
const {content,media,redact,issue}=require('../electron/experience.cjs');
test('KB references resolve and galleries use actual trusted media within capacity',()=>{
 const ids=new Set(content.articles.map(a=>a.id));assert.equal(ids.size,12);
 for(const a of content.articles) for(const reference of a.body.match(/Launcher-KB\d+/g)||[])assert.ok(ids.has(reference));
 for(const value of Object.values(content.apps)){assert.ok(value.screenshots.length<=10);assert.ok(value.screenshots.every(s=>media(s.url)));assert.ok(!value.video||media(value.video));}
 assert.equal(media('https://raw.githubusercontent.com.attacker.test/DaddyTylerXO/TMApps/file.png'),false);
});
test('support drafts redact credentials and private paths and choose matching GitHub questions',()=>{
 const text=redact('token=secret password=private Bearer abc123 user@example.com\nC:\\Users\\Person\\private.txt');
 assert.ok(!/secret|private|abc123|user@example.com|Person/.test(text));
 for(const kind of ['feature','bug','issue','crash']){const u=new URL(issue(kind,text));assert.equal(u.origin,'https://github.com');assert.ok(u.searchParams.get('title').includes(kind));assert.ok(u.searchParams.has('body'));}
 assert.throws(()=>issue('arbitrary'));
});
test('sign-in requires public configuration and keeps refresh tokens out of renderer status',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tmapps-auth-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 assert.equal(config({}),null);assert.throws(()=>config({url:'http://example.com',publicKey:'sb_publishable_test'}));
 const privileged=['e30',Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url'),'sig'].join('.');assert.throws(()=>config({url:'https://example.com',publicKey:privileged}));
 const requests=[];const fetcher=async(url,options)=>{requests.push({url,options});let value={};if(url.includes('/verify'))value={access_token:'private-access',refresh_token:'private-refresh',expires_in:3600};else if(url.endsWith('/user'))value={id:'user-1',email:'verified@example.com',email_confirmed_at:'2026-10-21'};else if(url.includes('/app_access')&&options.method==='GET')value=[{app_id:'tma-cut',enabled:true}];return new Response(JSON.stringify(value),{status:200});};
 const vault={available:()=>true,encrypt:text=>Buffer.from(Buffer.from(text).toString('base64')),decrypt:bytes=>Buffer.from(bytes.toString(),'base64').toString()};
 const auth=new SuiteAuth({root,configuration:{url:'https://example.com',publicKey:'sb_publishable_test'},vault,fetcher});
 await auth.send('verified@example.com');const status=await auth.verify('verified@example.com','123456');assert.equal(status.email,'verified@example.com');assert.deepEqual(status.allowedApps,['tma-cut']);assert.ok(!JSON.stringify(status).includes('private-access'));
 assert.ok(!(await fs.readFile(path.join(root,'auth-session.bin'),'utf8')).includes('private-refresh'));await auth.access(['tma-cut']);assert.ok(requests.some(r=>r.options.headers.Authorization==='Bearer private-access'));await assert.rejects(auth.access(['unknown-app']));await auth.logout();assert.equal((await auth.status()).email,null);
});
test('Linux without a secure vault keeps sign-in only in memory',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'tmapps-memory-auth-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const auth=new SuiteAuth({root,configuration:{url:'https://example.com',publicKey:'sb_publishable_test'},vault:{available:()=>false},fetcher:async url=>new Response(JSON.stringify(url.includes('/verify')?{access_token:'access',refresh_token:'refresh',expires_in:3600}:url.endsWith('/user')?{id:'user',email:'verified@example.com',email_confirmed_at:'now'}:[]))});
 const status=await auth.verify('verified@example.com','123456');assert.equal(status.persistent,false);await assert.rejects(fs.access(path.join(root,'auth-session.bin')));
});
