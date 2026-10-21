const crypto=require('node:crypto');const providers=require('./providers.cjs');
const {recordSample,mutate}=require('./dashboards.cjs');
class Service{
  constructor(store,fetcher=fetch){this.store=store;this.fetcher=fetcher;this.store.state.dashboards||=[];this.store.state.metricHistory||={};for(const account of this.store.state.accounts)recordSample(this.store.state,account);}
  async dashboardAction(input){const previous=structuredClone(this.store.state.dashboards),presets=structuredClone(this.store.state.widgetPresets||[]);try{const result=mutate(this.store.state,input);await this.store.save();return {state:this.snapshot(),...result};}catch(error){this.store.state.dashboards=previous;this.store.state.widgetPresets=presets;throw error;}}
  snapshot(){return {...this.store.snapshot(),platforms:providers.PLATFORMS};}
  async connectOAuth(auth){const metrics=await providers.analytics({...auth,id:'new'},this.fetcher);auth={...auth,accountId:metrics.accountId,label:metrics.label};const old=this.store.state.accounts.find(a=>a.platform===auth.platform&&a.providerAccountId===auth.accountId);const account={id:old?.id||crypto.randomUUID(),platform:auth.platform,label:auth.label,providerAccountId:auth.accountId,credentials:this.store.seal(auth),connectedAt:new Date().toISOString(),snapshot:{...metrics,id:old?.id||''}};account.snapshot.id=account.id;recordSample(this.store.state,account);this.store.state.accounts=this.store.state.accounts.filter(a=>a.id!==account.id).concat(account);await this.store.save();return this.snapshot();}
  purgeAccount(id){this.store.state.accounts=this.store.state.accounts.filter(a=>a.id!==id);delete this.store.state.metricHistory?.[id];this.store.state.history=this.store.state.history.filter(h=>h.accountId!==id);this.store.state.drafts.forEach(d=>{if(d.accountIds)d.accountIds=d.accountIds.filter(accountId=>accountId!==id);});}
  pruneYouTube(){let changed=false;for(const a of [...this.store.state.accounts])if(a.platform==='youtube'&&Date.now()-Date.parse(a.snapshot?.updatedAt||a.connectedAt)>30*86400000){this.purgeAccount(a.id);changed=true;}return changed;}
  async account(id){const a=this.store.state.accounts.find(a=>a.id===id);if(!a)throw Error('Account no longer exists.');let auth={...this.store.unseal(a.credentials),id:a.id,platform:a.platform,label:a.label};if(auth.platform==='bluesky'){auth=await providers.refreshBluesky(auth,this.fetcher);a.credentials=this.store.seal(auth);await this.store.save();}else if(auth.oauth&&this.oauth){auth=await this.oauth.refresh(auth);a.credentials=this.store.seal(auth);await this.store.save();}return auth;}
  async connect(input){const auth=await providers.connect(input,this.fetcher);const duplicate=this.store.state.accounts.find(a=>a.platform===auth.platform&&(a.providerAccountId&&auth.accountId?a.providerAccountId===auth.accountId:a.label===auth.label));const id=duplicate?.id||crypto.randomUUID();const a={id,platform:auth.platform,label:auth.label,providerAccountId:auth.accountId,credentials:this.store.seal(auth),connectedAt:new Date().toISOString()};const metrics=await providers.analytics({...auth,id},this.fetcher);a.snapshot=metrics;recordSample(this.store.state,a);this.store.state.accounts=this.store.state.accounts.filter(v=>v.id!==id).concat(a);await this.store.save();return this.snapshot();}
  async disconnect(id){this.purgeAccount(id);await this.store.save();return this.snapshot();}
  async refresh(accountIds){for(const a of [...this.store.state.accounts]){if(Array.isArray(accountIds)&&!accountIds.includes(a.id))continue;a.lastAttemptAt=new Date().toISOString();if(a.cooldownUntil&&Date.parse(a.cooldownUntil)>Date.now())continue;try{a.snapshot=await providers.analytics(await this.account(a.id),this.fetcher);recordSample(this.store.state,a);delete a.error;delete a.cooldownUntil;}catch(e){if(a.platform==='youtube'&&(e.status===401||e.revoked)){this.purgeAccount(a.id);continue;}a.error=e.retryAfter?'Rate limit reached. Checks are temporarily paused; the last successful snapshot is shown.':'Could not refresh. Your last successful snapshot is shown. Check permissions or reconnect.';if(e.retryAfter)a.cooldownUntil=new Date(Date.now()+e.retryAfter*1000).toISOString();}}await this.store.save();return this.snapshot();}
  async draft(input){if(typeof input.text!=='string'||input.text.length>65000||typeof input.title!=='string'||input.title.length>300)throw Error('Draft is too large.');const d={id:input.id||crypto.randomUUID(),text:input.text,title:input.title,subreddit:String(input.subreddit||'').slice(0,21),mediaUrl:String(input.mediaUrl||'').slice(0,2048),boardId:String(input.boardId||'').slice(0,30),altText:String(input.altText||'').slice(0,1000),attachment:input.attachment&&/^[a-f0-9-]{36}\.(jpg|png)$/.test(input.attachment.id)?{id:input.attachment.id}:null,accountIds:[...new Set(input.accountIds||[])].filter(id=>this.store.state.accounts.some(a=>a.id===id)),updatedAt:new Date().toISOString()};this.store.state.drafts=this.store.state.drafts.filter(v=>v.id!==d.id).concat(d);await this.store.save();return d;}
  async deleteDraft(id){this.store.state.drafts=this.store.state.drafts.filter(d=>d.id!==id);await this.store.save();return this.snapshot();}
  async publish(draftId){
    const d=this.store.state.drafts.find(d=>d.id===draftId);if(!d||!d.accountIds.length)throw Error('Select at least one connected account.');
    const postDraft={...d,...(d.attachment&&this.media?{media:await this.media.read(d.attachment)}:{})};
    const targets=d.accountIds.map(id=>this.store.state.accounts.find(a=>a.id===id));if(targets.some(a=>!a))throw Error('One of the selected accounts was disconnected.');
    targets.forEach(a=>providers.validatePost(a.platform,d));
    // Persist an intent before every external mutation. Ambiguous failures are never retried automatically.
    const results=[];
    for(const a of targets){
      const previous=this.store.state.history.find(h=>h.draftId===d.id&&h.accountId===a.id&&h.status!=='failed');
      if(previous){results.push({...previous,status:previous.status==='published'?'already published':'check platform before retrying'});continue;}
      const auth=await this.account(a.id);
      const h={id:crypto.randomUUID(),draftId:d.id,accountId:a.id,platform:a.platform,label:a.label,text:d.text,title:d.title,status:'sending',createdAt:new Date().toISOString()};
      this.store.state.history.push(h);await this.store.save();
      try{const result=await providers.publish(auth,postDraft,this.fetcher);if(!result?.id)throw Error('Provider did not return a post ID.');h.status='published';h.remoteId=result.id;}catch(e){h.status=e instanceof providers.ProviderError&&!e.ambiguous?'failed':'uncertain';h.error=e instanceof providers.ProviderError?e.message:'The result could not be confirmed. Check the platform before posting again.';}
      await this.store.save();results.push(h);
    }
    return {results,state:this.snapshot()};
  }
}
module.exports={Service};
