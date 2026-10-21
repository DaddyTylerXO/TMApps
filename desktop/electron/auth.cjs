'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const IDS = ['tma-mail','tma-safe','tma-padlock','tma-cut','tma-socialsmanager','tma-agent-office'];
function config(value) {
  if (!value?.url || !value?.publicKey) return null;
  const url = new URL(value.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an HTTPS Supabase project origin.');
  if (!value.publicKey.startsWith('sb_publishable_')) { let claims; try { claims = JSON.parse(Buffer.from(value.publicKey.split('.')[1], 'base64url')); } catch {} if (claims?.role !== 'anon') throw new Error('Only a public publishable/anon key belongs in launcher configuration.'); }
  return { url: url.origin, publicKey: value.publicKey };
}
class SuiteAuth {
  constructor({ root, configuration, vault, fetcher = fetch }) { this.root=root; this.config=config(configuration); this.vault=vault; this.fetch=fetcher; this.session=null; this.loaded=false; }
  async request(route, value, authenticated=false, method='POST') {
    if (!this.config) throw new Error('TMApps sign-in is not configured. See the deployment guide in Help.');
    const headers = { apikey: this.config.publicKey, 'Content-Type': 'application/json' }; if (authenticated) headers.Authorization = 'Bearer ' + this.session.access_token;
    if(route.startsWith('/rest/')) headers.Prefer = 'resolution=merge-duplicates';
    const response=await this.fetch(this.config.url+route,{method,headers,body:method==='GET'?undefined:JSON.stringify(value),signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!response.ok) throw new Error('Sign-in service returned HTTP '+response.status+'. Check the code or service configuration.');
    return response.status===204 ? {} : JSON.parse((await response.text())||'{}');
  }
  async load() {
    if(this.loaded)return;this.loaded=true;if(!this.config || !this.vault.available())return;
    try { const saved=JSON.parse(await this.vault.decrypt(await fs.readFile(path.join(this.root,'auth-session.bin')))); if(saved.origin===this.config.url) this.session=saved.session; } catch {}
  }
  async persist() { if(!this.vault.available())return;await fs.mkdir(this.root,{recursive:true});await fs.writeFile(path.join(this.root,'auth-session.bin'),await this.vault.encrypt(JSON.stringify({origin:this.config.url,session:this.session})),{mode:0o600}); }
  async ready() {
    await this.load();if(!this.session)return false;
    if(this.session.expires_at*1000<Date.now()+60000){try{const next=await this.request('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token});next.expires_at=Math.floor(Date.now()/1000)+next.expires_in;this.session=next;await this.persist();}catch{this.session=null;await fs.rm(path.join(this.root,'auth-session.bin'),{force:true});return false;}}
    return true;
  }
  async status() {
    const base={configured:!!this.config,persistent:this.vault.available(),email:null,allowedApps:[],warning:this.configurationError||null};if(!this.config || !await this.ready())return base;
    const user=await this.request('/auth/v1/user',null,true,'GET');if(!user.email_confirmed_at)throw new Error('Verify your email before linking apps.');this.user=user;
    const rows=await this.request('/rest/v1/app_access?select=app_id,enabled',null,true,'GET');return {...base,email:user.email,allowedApps:rows.filter(r=>r.enabled&&IDS.includes(r.app_id)).map(r=>r.app_id)};
  }
  async send(email) { if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email||''))throw new Error('Enter your email address.');await this.request('/auth/v1/otp',{email,create_user:true});return {notice:'If allowed by the service, a sign-in code has been sent. Check your email.'}; }
  async verify(email,code) {
    if(!/^\d{6,8}$/.test(code||''))throw new Error('Enter the email verification code.');
    const session=await this.request('/auth/v1/verify',{email,token:code,type:'email'});if(!session.access_token||!session.refresh_token)throw new Error('The service did not return a session.');session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;this.session=session;this.loaded=true;
    const status=await this.status();await this.persist();return status;
  }
  async access(ids) { if(!Array.isArray(ids)||ids.some(id=>!IDS.includes(id)))throw new Error('Unknown app access.');const status=await this.status();if(!status.email)throw new Error('Sign in before linking apps.');await this.request('/rest/v1/app_access',IDS.map(app_id=>({user_id:this.user.id,app_id,enabled:ids.includes(app_id)})),true);return this.status(); }
  async handoff(appId, challenge) { const status=await this.status(); if(!status.allowedApps.includes(appId)||!/^[A-Za-z0-9_-]{43}$/.test(challenge||''))throw new Error('Approved app access and a PKCE challenge are required.');return this.request('/functions/v1/app-session',{action:'issue',appId,challenge},true); }
  async logout() {try{if(await this.ready())await this.request('/auth/v1/logout?scope=local',{},true);}finally{this.session=null;await fs.rm(path.join(this.root,'auth-session.bin'),{force:true});}return this.status();}
}
module.exports={SuiteAuth,config,IDS};
