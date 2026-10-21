const PLATFORMS = [
  {id:'youtube',name:'YouTube',color:'#ff6666',mark:'▶',publish:false,help:'Browser sign-in for channel totals and read-only YouTube Analytics. Configure your Google Desktop client locally. Video uploads are not available.',docs:'https://developers.google.com/youtube/v3/guides/authentication'},
  {id:'twitch',name:'Twitch',color:'#b69aff',mark:'◈',publish:false,help:'Browser sign-in with your locally configured Twitch app. Read follower totals and live viewers; no chat or moderation actions.',docs:'https://dev.twitch.tv/docs/authentication/'},
  {id:'kick',name:'Kick',color:'#a5ec6b',mark:'K',publish:false,help:'Browser sign-in with your locally configured Kick app. Shows your channel identity and current stream viewers.',docs:'https://docs.kick.com/'},
  {id:'tiktok',name:'TikTok',color:'#86e5e5',mark:'♪',publish:false,help:'Requires an approved TikTok app with user.info.basic and user.info.stats. Publishing needs additional audit and is not available in this beta.',docs:'https://developers.tiktok.com/doc/display-api-get-started/'},
  {id:'instagram',name:'Instagram',color:'#eaa1d8',mark:'◎',publish:true,help:'Professional account required. Supply an Instagram Login token and account ID. Publishes one publicly accessible JPEG image with a caption.',docs:'https://developers.facebook.com/docs/instagram-platform/'},
  {id:'facebook',name:'Facebook',color:'#91b9ff',mark:'f',publish:true,help:'Facebook Pages only. Requires a Page access token and Page ID with pages_read_engagement and pages_manage_posts.',docs:'https://developers.facebook.com/docs/pages-api/'},
  {id:'x',name:'X',color:'#e1e4ed',mark:'𝕏',publish:true,help:'Requires a registered X developer app and user OAuth 2 token with users.read, tweet.read and tweet.write. API access may incur charges.',docs:'https://docs.x.com/'},
  {id:'bluesky',name:'Bluesky',color:'#8bc7ff',mark:'☁',publish:true,help:'Connect with your handle and a revocable app password. No developer API key required. Text publishing, follower totals, and recent post engagement.',docs:'https://bsky.app/settings/app-passwords'},
  {id:'reddit',name:'Reddit',color:'#ffac81',mark:'●',publish:true,help:'Requires approved Reddit API access and an OAuth token with identity, read and submit. Publishes text to a chosen subreddit. Karma is reported separately from followers.',docs:'https://www.reddit.com/dev/api/'}
];
class ProviderError extends Error { constructor(message,ambiguous=false){super(message);this.name='ProviderError';this.ambiguous=ambiguous;} }
async function request(url,{token,method='GET',body,headers={},form=false,fetcher=fetch}={}) {
  const response=await fetcher(url,{method,headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{}),...headers},body:body?(form?new URLSearchParams(body).toString():JSON.stringify(body)):undefined,signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok){const error=new ProviderError(response.status===401?'Sign-in expired. Reconnect this account.':response.status===429?'Rate limit reached. Automatic checks are paused for this account.':`Provider request failed (${response.status}). Check account permissions and setup.`,![400,401,403,404,422,429].includes(response.status));error.status=response.status;if(response.status===429){const raw=response.headers?.get('retry-after');const seconds=Number(raw)||((Date.parse(raw)-Date.now())/1000);error.retryAfter=Math.max(30,Math.min(86400,Number.isFinite(seconds)&&seconds>0?seconds:300));}throw error;}
  const data=await response.json();
  if((data.error&&data.error.code!=='ok') || data.json?.errors?.length) throw new ProviderError('The platform rejected this request. Check the account permissions and post requirements.');
  return data;
}
const count=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
function normalize(account,profile,metrics){return {id:account.id,accountId:String(profile.id||profile.did||account.accountId||''),platform:account.platform,...(profile.reportPeriod?{reportPeriod:profile.reportPeriod}:{}),label:profile.username||profile.handle||profile.name||profile.displayName||account.label,metrics:Object.fromEntries(Object.entries(metrics).map(([k,v])=>[k,v===undefined||v===null?null:count(v)])),updatedAt:new Date().toISOString()};}
async function connect(input,fetcher=fetch){
  const p=PLATFORMS.find(p=>p.id===input.platform); if(!p)throw new ProviderError('Unknown platform.');
  let a={platform:p.id,token:String(input.token||'').trim(),accountId:String(input.accountId||'').trim(),clientId:String(input.clientId||'').trim()};
  if(p.id==='bluesky'){
    const handle=String(input.handle||'').trim().replace(/^@/,'');
    if(!handle||!input.password) throw new ProviderError('Enter your handle and app password.');
    const s=await request('https://bsky.social/xrpc/com.atproto.server.createSession',{method:'POST',body:{identifier:handle,password:input.password},fetcher});
    // Restrict token forwarding to Bluesky's hosted PDS fleet.
    const endpoint=s.didDoc?.service?.find(v=>v.id==='#atproto_pds')?.serviceEndpoint;
    if(endpoint){const u=new URL(endpoint);if(u.protocol!=='https:'||u.port||u.username||u.password||!(u.hostname==='bsky.social'||u.hostname.endsWith('.host.bsky.network')))throw new ProviderError('This beta supports Bluesky hosted accounts only.');}
    a={...a,service:endpoint?new URL(endpoint).origin:'https://bsky.social',token:s.accessJwt,refreshToken:s.refreshJwt,accountId:s.did,label:s.handle};
  }else if(!a.token)throw new ProviderError('Enter a user access token from your registered provider app.');
  if(['instagram','facebook'].includes(p.id)&&!/^[0-9]+$/.test(a.accountId))throw new ProviderError('Enter the numeric Page or professional account ID.');
  if(p.id==='twitch'&&!a.clientId)throw new ProviderError('Twitch also requires your registered client ID.');
  const snapshot=await analytics({...a,id:'new'},fetcher); return {...a,label:snapshot.label,accountId:snapshot.accountId||a.accountId};
}
async function analytics(a,fetcher=fetch){
  const get=(url,headers)=>request(url,{token:a.token,headers,fetcher}); let p,m;
  switch(a.platform){
    case 'bluesky': {
      p=await get(`${a.service||'https://bsky.social'}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(a.accountId)}`);
      const feed=await get(`${a.service||'https://bsky.social'}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(a.accountId)}&limit=100&filter=posts_no_replies`);
      const own=feed.feed.filter(x=>x.post.author.did===a.accountId);m={followers:p.followersCount,posts:p.postsCount,recentLikes:own.reduce((s,x)=>s+(x.post.likeCount||0),0),recentReplies:own.reduce((s,x)=>s+(x.post.replyCount||0),0),recentReposts:own.reduce((s,x)=>s+(x.post.repostCount||0),0)};break;
    }
    case 'youtube': {
      p=(await get('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true')).items?.[0];if(!p)throw new ProviderError('No YouTube channel found.');
      m={followers:p.statistics.hiddenSubscriberCount?null:p.statistics.subscriberCount,views:p.statistics.viewCount,posts:p.statistics.videoCount};p={id:p.id,name:p.snippet.title};
      if(a.oauth){const end=new Date(),start=new Date(end.getTime()-27*86400000);const period={start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};const params=new URLSearchParams({ids:'channel==MINE',startDate:period.start,endDate:period.end,metrics:'views,likes,estimatedMinutesWatched,subscribersGained,subscribersLost'});const report=await get('https://youtubeanalytics.googleapis.com/v2/reports?'+params);const row=report.rows?.[0];const values=Object.fromEntries((report.columnHeaders||[]).map((column,index)=>[column.name,row?.[index]??null]));Object.assign(m,{periodViews:values.views,periodLikes:values.likes,watchMinutes:values.estimatedMinutesWatched,subscribersGained:values.subscribersGained,subscribersLost:values.subscribersLost});p.reportPeriod=period;}
      break;
    }
    case 'twitch': {
      const headers={'Client-Id':a.clientId};p=(await get('https://api.twitch.tv/helix/users',headers)).data?.[0];if(!p)throw new ProviderError('No Twitch user found.');
      const f=await get(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${encodeURIComponent(p.id)}`,headers);
      const s=(await get(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(p.id)}`,headers)).data?.[0];m={followers:f.total,liveViewers:s?.viewer_count??0};p={id:p.id,name:p.display_name};break;
    }
    case 'kick': {
      const user=(await get('https://api.kick.com/public/v1/users')).data?.[0];if(!user)throw new ProviderError('No Kick user found.');
      p=(await get(`https://api.kick.com/public/v1/channels?broadcaster_user_id=${user.user_id}`)).data?.[0];if(!p)throw new ProviderError('No Kick channel found.');m={liveViewers:p.stream?.viewer_count??0};p={id:user.user_id,name:user.name};break;
    }
    case 'tiktok':{const r=await get('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,follower_count,likes_count,video_count');if(r.error?.code&&r.error.code!=='ok')throw new ProviderError('TikTok rejected this request. Check your token and scopes.');p=r.data?.user;if(!p)throw new ProviderError('No TikTok user found.');m={followers:p.follower_count,likes:p.likes_count,posts:p.video_count};p={id:p.open_id,name:p.display_name};break;}
    case 'instagram':p=await get(`https://graph.instagram.com/v24.0/${a.accountId}?fields=id,username,followers_count,media_count`);m={followers:p.followers_count,posts:p.media_count};break;
    case 'facebook':p=await get(`https://graph.facebook.com/v24.0/${a.accountId}?fields=id,name,followers_count`);m={followers:p.followers_count};break;
    case 'x':p=(await get('https://api.x.com/2/users/me?user.fields=public_metrics')).data;if(!p)throw new ProviderError('No X user found.');m={followers:p.public_metrics.followers_count,posts:p.public_metrics.tweet_count};break;
    case 'reddit':p=await get('https://oauth.reddit.com/api/v1/me',{'User-Agent':'desktop:com.tmapps.socialsmanager:v0.1.0 (by /u/DaddyTylerXO)'});m={karma:p.total_karma};break;
    default:throw new ProviderError('Unknown platform.');
  }
  return normalize(a,p,m);
}
function validatePost(platform,d){
  if(!PLATFORMS.find(p=>p.id===platform)?.publish)throw new ProviderError('Publishing is not available for this platform in this beta.');
  if(typeof d.text!=='string'||!d.text.trim())throw new ProviderError('Write some post text first.');
  const max={bluesky:300,x:280,reddit:40000,facebook:63206,instagram:2200}[platform];
  const length=platform==='bluesky'?[...new Intl.Segmenter('en',{granularity:'grapheme'}).segment(d.text)].length:[...d.text].length;
  if(length>max)throw new ProviderError(`This post exceeds the ${max} character limit for ${platform}.`);
  if(platform==='reddit'&&(!d.title?.trim()||d.title.length>300||!/^[A-Za-z0-9_]{2,21}$/.test(d.subreddit||'')))throw new ProviderError('Reddit needs a title (up to 300 characters) and a subreddit name without r/.');
  if(platform==='instagram'){let u;try{u=new URL(d.mediaUrl);}catch{}if(!u||u.protocol!=='https:'||u.username||u.password)throw new ProviderError('Instagram requires a public HTTPS JPEG image URL.');}
}
async function publish(a,d,fetcher=fetch){
  validatePost(a.platform,d);
  const post=(url,body,form=false)=>request(url,{token:a.token,method:'POST',body,form,fetcher});
  switch(a.platform){
    case 'bluesky':{const r=await post(`${a.service||'https://bsky.social'}/xrpc/com.atproto.repo.createRecord`,{repo:a.accountId,collection:'app.bsky.feed.post',record:{$type:'app.bsky.feed.post',text:d.text,createdAt:new Date().toISOString()}});return {id:r.uri};}
    case 'x':return {id:(await post('https://api.x.com/2/tweets',{text:d.text})).data?.id};
    case 'facebook':return {id:(await post(`https://graph.facebook.com/v24.0/${a.accountId}/feed`,{message:d.text})).id};
    case 'reddit':{const r=await request('https://oauth.reddit.com/api/submit',{token:a.token,method:'POST',form:true,body:{api_type:'json',kind:'self',sr:d.subreddit,title:d.title,text:d.text},headers:{'User-Agent':'desktop:com.tmapps.socialsmanager:v0.1.0 (by /u/DaddyTylerXO)'},fetcher});return {id:r.json?.data?.name};}
    case 'instagram':{const container=await post(`https://graph.instagram.com/v24.0/${a.accountId}/media`,{image_url:d.mediaUrl,caption:d.text});return {id:(await post(`https://graph.instagram.com/v24.0/${a.accountId}/media_publish`,{creation_id:container.id})).id};}
  }
}
async function refreshBluesky(a,fetcher=fetch){const s=await request(`${a.service||'https://bsky.social'}/xrpc/com.atproto.server.refreshSession`,{token:a.refreshToken,method:'POST',fetcher});return {...a,token:s.accessJwt,refreshToken:s.refreshJwt};}
module.exports={PLATFORMS,ProviderError,request,connect,analytics,publish,validatePost,refreshBluesky};
