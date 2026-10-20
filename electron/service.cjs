const crypto=require('node:crypto');const providers=require('./providers.cjs');
class Service{
  constructor(store,fetcher=fetch){this.store=store;this.fetcher=fetcher;}
  snapshot(){return {...this.store.snapshot(),platforms:providers.PLATFORMS};}
  async account(id){const a=this.store.state.accounts.find(a=>a.id===id);if(!a)throw Error('Account no longer exists.');let auth={...this.store.unseal(a.credentials),id:a.id,platform:a.platform,label:a.label};if(auth.platform==='bluesky'){auth=await providers.refreshBluesky(auth,this.fetcher);a.credentials=this.store.seal(auth);await this.store.save();}return auth;}
  async connect(input){const auth=await providers.connect(input,this.fetcher);const duplicate=this.store.state.accounts.find(a=>a.platform===auth.platform&&(a.providerAccountId&&auth.accountId?a.providerAccountId===auth.accountId:a.label===auth.label));const id=duplicate?.id||crypto.randomUUID();const a={id,platform:auth.platform,label:auth.label,providerAccountId:auth.accountId,credentials:this.store.seal(auth),connectedAt:new Date().toISOString()};const metrics=await providers.analytics({...auth,id},this.fetcher);a.snapshot=metrics;this.store.state.accounts=this.store.state.accounts.filter(v=>v.id!==id).concat(a);await this.store.save();return this.snapshot();}
  async disconnect(id){this.store.state.accounts=this.store.state.accounts.filter(a=>a.id!==id);await this.store.save();return this.snapshot();}
  async refresh(){for(const a of this.store.state.accounts){if(a.cooldownUntil&&Date.parse(a.cooldownUntil)>Date.now())continue;try{a.snapshot=await providers.analytics(await this.account(a.id),this.fetcher);delete a.error;delete a.cooldownUntil;}catch(e){a.error=e.retryAfter?'Rate limit reached. Checks are temporarily paused; the last successful snapshot is shown.':'Could not refresh. Your last successful snapshot is shown. Check permissions or reconnect.';if(e.retryAfter)a.cooldownUntil=new Date(Date.now()+e.retryAfter*1000).toISOString();}}await this.store.save();return this.snapshot();}
  async draft(input){if(typeof input.text!=='string'||input.text.length>65000||typeof input.title!=='string'||input.title.length>300)throw Error('Draft is too large.');const d={id:input.id||crypto.randomUUID(),text:input.text,title:input.title,subreddit:String(input.subreddit||'').slice(0,21),mediaUrl:String(input.mediaUrl||'').slice(0,2048),accountIds:[...new Set(input.accountIds||[])].filter(id=>this.store.state.accounts.some(a=>a.id===id)),updatedAt:new Date().toISOString()};this.store.state.drafts=this.store.state.drafts.filter(v=>v.id!==d.id).concat(d);await this.store.save();return d;}
  async deleteDraft(id){this.store.state.drafts=this.store.state.drafts.filter(d=>d.id!==id);await this.store.save();return this.snapshot();}
  async publish(draftId){
    const d=this.store.state.drafts.find(d=>d.id===draftId);if(!d||!d.accountIds.length)throw Error('Select at least one connected account.');
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
      try{const result=await providers.publish(auth,d,this.fetcher);if(!result?.id)throw Error('Provider did not return a post ID.');h.status='published';h.remoteId=result.id;}catch(e){h.status=e instanceof providers.ProviderError&&!e.ambiguous?'failed':'uncertain';h.error=e instanceof providers.ProviderError?e.message:'The result could not be confirmed. Check the platform before posting again.';}
      await this.store.save();results.push(h);
    }
    return {results,state:this.snapshot()};
  }
}
module.exports={Service};
