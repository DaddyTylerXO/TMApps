const crypto=require('node:crypto');
const http=require('node:http');
const {request}=require('./providers.cjs');
const REDIRECT='http://127.0.0.1:43821/oauth/callback';
const PROVIDERS={
  youtube:{authorize:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',revoke:'https://oauth2.googleapis.com/revoke',pkce:true,secret:false,scopes:['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/yt-analytics.readonly']},
  twitch:{authorize:'https://id.twitch.tv/oauth2/authorize',token:'https://id.twitch.tv/oauth2/token',revoke:'https://id.twitch.tv/oauth2/revoke',pkce:false,secret:true,scopes:['moderator:read:followers']},
  kick:{authorize:'https://id.kick.com/oauth/authorize',token:'https://id.kick.com/oauth/token',revoke:'https://id.kick.com/oauth/revoke',pkce:true,secret:true,scopes:['user:read','channel:read']}
};
function validateConfig(platform,input){
  const provider=PROVIDERS[platform];if(!provider)throw Error('This provider does not have browser sign-in yet.');
  const clientId=String(input.clientId||'').trim(),clientSecret=String(input.clientSecret||'').trim();
  if(!clientId||clientId.length>1024||/[\s\r\n]/.test(clientId))throw Error('Enter a valid client ID in local settings.');
  if(clientSecret.length>2048||/[\r\n]/.test(clientSecret)||provider.secret&&!clientSecret)throw Error('This provider requires its client secret in local settings.');
  let redirect;try{redirect=new URL(input.redirectUri||REDIRECT);}catch{throw Error('Use a loopback callback URL.');}
  if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||!redirect.port||+redirect.port<1024||redirect.pathname!=='/oauth/callback'||redirect.search||redirect.hash||redirect.username||redirect.password)throw Error('Use http://127.0.0.1:PORT/oauth/callback, with a port of 1024 or higher.');
  return {clientId,clientSecret,redirectUri:redirect.href};
}
function authorization(platform,config){
  const provider=PROVIDERS[platform];const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
  const url=new URL(provider.authorize);const params={response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,scope:provider.scopes.join(' '),state};
  if(provider.pkce)Object.assign(params,{code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
  if(platform==='youtube')Object.assign(params,{access_type:'offline',prompt:'consent'});
  if(platform==='twitch')params.force_verify='true';
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return {url:url.href,state,verifier,redirectUri:config.redirectUri};
}
function equalState(a,b){const aa=Buffer.from(a||''),bb=Buffer.from(b||'');return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);}
async function browserCode(flow,openExternal,{timeoutMs=180000}={}){
  const redirect=new URL(flow.redirectUri);let finish,timer,done=false;
  const pending=new Promise((resolve,reject)=>finish=(error,code)=>{if(done)return;done=true;clearTimeout(timer);server.close();if(error)reject(error);else resolve(code);});
  // Attach a rejection handler before opening a browser, which may fail independently.
  pending.catch(()=>{});
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");res.setHeader('Referrer-Policy','no-referrer');
    if(req.method!=='GET'||req.headers.host!==redirect.host||!req.url||req.url.length>16384){res.writeHead(400);res.end('Invalid callback.');return;}
    const url=new URL(req.url,redirect.origin);
    if(url.pathname!==redirect.pathname){res.writeHead(404);res.end('Not found.');return;}
    if(!equalState(url.searchParams.get('state'),flow.state)){res.writeHead(400);res.end('Invalid sign-in state. Return to the application.');return;}
    if(url.searchParams.has('error')){res.end('Sign-in cancelled. Return to TMA-SocialsManager.');finish(Error('Sign-in was cancelled or denied.'));return;}
    const code=url.searchParams.get('code');if(!code||code.length>8192){res.writeHead(400);res.end('No authorization code.');return;}
    res.end('Sign-in received. You can close this tab and return to TMA-SocialsManager.');finish(null,code);
  });
  server.requestTimeout=15000;server.headersTimeout=15000;server.on('error',()=>finish(Error('The sign-in callback port is unavailable. Close another sign-in attempt or choose another port in local settings.')));
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);server.listen(+redirect.port,'127.0.0.1');}).catch(()=>{throw Error('The sign-in callback port is unavailable.');});
  timer=setTimeout(()=>finish(Error('Sign-in timed out. Please try again.')),timeoutMs);timer.unref?.();
  try{await openExternal(flow.url);return await pending;}catch(error){finish(Error('Sign-in could not complete. Please try again.'));throw error;}
}
function tokenState(platform,result,config,previous={}){
  if(typeof result.access_token!=='string'||!result.access_token)throw Error('The provider did not return an access token.');
  return {...previous,platform,oauth:true,clientId:config.clientId,token:result.access_token,refreshToken:result.refresh_token||previous.refreshToken||'',expiresAt:Date.now()+Math.max(0,Number(result.expires_in)||0)*1000,scopes:PROVIDERS[platform].scopes,validatedAt:platform==='twitch'?Date.now():undefined};
}
class OAuth{
  constructor(store,{fetcher=fetch,openExternal,authorize=browserCode}={}){Object.assign(this,{store,fetcher,openExternal,authorize});}
  settings(){return Object.fromEntries(Object.keys(PROVIDERS).map(platform=>{const stored=this.store.state.oauthClients?.[platform];let redirectUri=REDIRECT;try{if(stored)redirectUri=this.store.unseal(stored).redirectUri;}catch{}return [platform,{configured:!!stored,redirectUri}];}));}
  config(platform){const sealed=this.store.state.oauthClients?.[platform];if(!sealed)throw Error('Configure this provider in Settings → Provider sign-in first.');return validateConfig(platform,this.store.unseal(sealed));}
  async save(input){const config=validateConfig(input.platform,input);this.store.state.oauthClients||={};this.store.state.oauthClients[input.platform]=this.store.seal(config);await this.store.save();return this.settings();}
  async remove(platform){if(!PROVIDERS[platform])throw Error('Unknown provider.');delete this.store.state.oauthClients?.[platform];await this.store.save();return this.settings();}
  async signIn(platform){const config=this.config(platform),provider=PROVIDERS[platform],flow=authorization(platform,config);const code=await this.authorize(flow,this.openExternal);
    const body={grant_type:'authorization_code',client_id:config.clientId,redirect_uri:config.redirectUri,code};if(config.clientSecret)body.client_secret=config.clientSecret;if(provider.pkce)body.code_verifier=flow.verifier;
    const result=await request(provider.token,{method:'POST',body,form:true,fetcher:this.fetcher});const auth=tokenState(platform,result,config);
    if(platform==='twitch')await this.validateTwitch(auth);
    return auth;
  }
  async validateTwitch(auth){const data=await request('https://id.twitch.tv/oauth2/validate',{headers:{Authorization:`OAuth ${auth.token}`},fetcher:this.fetcher});if(data.client_id!==auth.clientId||!data.user_id)throw Error('The Twitch token belongs to a different app or is not a user token.');auth.validatedAt=Date.now();return auth;}
  async refresh(auth){const config=this.config(auth.platform);if(auth.clientId!==config.clientId)throw Error('The OAuth client changed. Reconnect this account.');
    if(auth.expiresAt<Date.now()+60000){if(!auth.refreshToken)throw Error('Sign-in expired. Reconnect this account.');const body={grant_type:'refresh_token',client_id:config.clientId,refresh_token:auth.refreshToken};if(config.clientSecret)body.client_secret=config.clientSecret;let result;try{result=await request(PROVIDERS[auth.platform].token,{method:'POST',form:true,body,fetcher:this.fetcher});}catch(error){if(error.status===400||error.status===401)error.revoked=true;throw error;}auth=tokenState(auth.platform,result,config,auth);}
    if(auth.platform==='twitch'&&(!auth.validatedAt||Date.now()-auth.validatedAt>=3600000))await this.validateTwitch(auth);return auth;
  }
  async revoke(auth){if(!auth.oauth||!PROVIDERS[auth.platform])return;const provider=PROVIDERS[auth.platform],config=this.config(auth.platform);const body={token:auth.refreshToken||auth.token};if(auth.platform!=='youtube')Object.assign(body,{client_id:config.clientId,token:auth.token});
    const response=await this.fetcher(provider.revoke,{method:'POST',body:new URLSearchParams(body),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)throw Error('Remote revocation could not be confirmed. Remove access in the provider security settings.');
  }
}
module.exports={OAuth,PROVIDERS,REDIRECT,validateConfig,authorization,browserCode,equalState};
