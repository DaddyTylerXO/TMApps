// Deploy with --no-verify-jwt: issue verifies Auth itself; exchange uses PKCE.
// The service-role key exists only in the edge environment, never in a launcher.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const apps=new Set(['tma-mail','tma-safe','tma-padlock','tma-cut','tma-socialsmanager','tma-agent-office']);
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash=async(text:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const challenge=async(text:string)=>btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async request=>{
 try {
  if(request.method!=='POST')return reply({error:'POST required'},405);
  const text=await request.text();if(text.length>4096)return reply({error:'Request too large'},413);
  const body=JSON.parse(text);if(!apps.has(body.appId))return reply({error:'Unknown app'},400);
  if(body.action==='issue'){
   const bearer=request.headers.get('Authorization')?.replace(/^Bearer /,'');
   if(!bearer)return reply({error:'Sign in required'},401);
   const {data:{user},error}=await db.auth.getUser(bearer);if(error||!user?.email_confirmed_at)return reply({error:'Verified sign-in required'},401);
   const access=await db.from('app_access').select('enabled').eq('user_id',user.id).eq('app_id',body.appId).maybeSingle();
   if(!access.data?.enabled)return reply({error:'App access not approved'},403);
   if(!/^[A-Za-z0-9_-]{43}$/.test(body.challenge||''))return reply({error:'S256 PKCE challenge required'},400);
   // Limit active codes for a user/app, expire old codes, and never log tokens.
   await db.from('app_handoffs').delete().lt('expires_at',new Date().toISOString());
   await db.from('app_sessions').delete().lt('expires_at',new Date().toISOString());
   await db.from('app_handoffs').delete().eq('user_id',user.id).eq('app_id',body.appId);
   const code=random(),expiresAt=new Date(Date.now()+60000).toISOString();
   const write=await db.from('app_handoffs').insert({code_hash:await hash(code),user_id:user.id,app_id:body.appId,challenge:body.challenge,expires_at:expiresAt});if(write.error)throw write.error;
   return reply({code,expiresAt});
  }
  if(body.action==='exchange'){
   if(!/^[a-f0-9]{64}$/.test(body.code||'')||!/^[A-Za-z0-9._~-]{43,128}$/.test(body.verifier||''))return reply({error:'Invalid handoff'},400);
   const token=random();const result=await db.rpc('exchange_app_handoff',{p_hash:await hash(body.code),p_app:body.appId,p_challenge:await challenge(body.verifier),p_session_hash:await hash(token)});
   if(result.error||!result.data)return reply({error:'Expired, revoked, or consumed handoff'},401);
   return reply({appSession:token,expiresIn:2592000});
  }
  if(body.action==='profile'){
   if(!/^[a-f0-9]{64}$/.test(body.appSession||''))return reply({error:'Invalid app session'},401);
   const result=await db.from('app_sessions').select('user_id,app_id,expires_at').eq('token_hash',await hash(body.appSession)).eq('app_id',body.appId).maybeSingle();const session=result.data;
   if(!session||Date.parse(session.expires_at)<=Date.now())return reply({error:'Session expired'},401);
   const access=await db.from('app_access').select('enabled').eq('user_id',session.user_id).eq('app_id',body.appId).maybeSingle();if(!access.data?.enabled)return reply({error:'App access revoked'},403);
   const user=await db.auth.admin.getUserById(session.user_id);if(!user.data.user?.email_confirmed_at)return reply({error:'Account unavailable'},401);
   return reply({id:session.user_id,email:user.data.user.email,displayName:String(user.data.user.user_metadata?.display_name||'').slice(0,100),appId:body.appId});
  }
  return reply({error:'Unknown action'},400);
 }catch{return reply({error:'Request could not be completed'},400);}
});
