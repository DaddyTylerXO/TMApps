const fs = require('node:fs');
const path = require('node:path');

const defaults = {model:'gpt-4.1-mini',maxCalls:20,maxOutputTokens:1800,autoConfinedApps:false};
function redact(message) { return String(message).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]'); }
class OpenAIConnection {
  constructor({directory,safeStorage,fetchImpl=globalThis.fetch,environment=process.env}) {
    this.file=path.join(directory,'openai.json'); this.safeStorage=safeStorage; this.fetch=fetchImpl; this.environment=environment; this.sessionKey='';
    this.config={...defaults}; try {this.config={...defaults,...JSON.parse(fs.readFileSync(this.file,'utf8'))};} catch {}
    if(typeof this.config.model!=='string'||!/^[a-zA-Z0-9_.:-]{1,100}$/.test(this.config.model))this.config.model=defaults.model;
    if(!Number.isInteger(this.config.maxCalls)||this.config.maxCalls<5||this.config.maxCalls>50)this.config.maxCalls=defaults.maxCalls;
    if(!Number.isInteger(this.config.maxOutputTokens)||this.config.maxOutputTokens<256||this.config.maxOutputTokens>8192)this.config.maxOutputTokens=defaults.maxOutputTokens;
    this.config.autoConfinedApps=this.config.autoConfinedApps===true;
  }
  key() {
    if(this.sessionKey)return this.sessionKey;
    if(this.config.encryptedKey && this.safeStorage?.isEncryptionAvailable()) {
      try{return this.safeStorage.decryptString(Buffer.from(this.config.encryptedKey,'base64'));}catch{}
    }
    return this.environment.OPENAI_API_KEY || '';
  }
  status() {return {model:this.config.model,maxCalls:this.config.maxCalls,maxOutputTokens:this.config.maxOutputTokens,autoConfinedApps:this.config.autoConfinedApps,hasKey:!!this.key(),keySource:this.sessionKey?'session':this.config.encryptedKey?'encrypted':this.environment.OPENAI_API_KEY?'environment':'none',verifiedAt:this.config.verifiedAt || null,canRemember:!!this.safeStorage?.isEncryptionAvailable()};}
  save(payload) {
    if(!payload || typeof payload.model!=='string' || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(payload.model))throw new Error('Enter a valid OpenAI model ID.');
    if(!Number.isInteger(payload.maxCalls)||payload.maxCalls<5||payload.maxCalls>50)throw new Error('Model call limit must be between 5 and 50.');
    if(!Number.isInteger(payload.maxOutputTokens)||payload.maxOutputTokens<256||payload.maxOutputTokens>8192)throw new Error('Response limit must be between 256 and 8192 tokens.');
    const next={...this.config,model:payload.model,maxCalls:payload.maxCalls,maxOutputTokens:payload.maxOutputTokens,autoConfinedApps:payload.autoConfinedApps===true};
    if(payload.model!==this.config.model)delete next.verifiedAt;
    const key=typeof payload.apiKey==='string'?payload.apiKey.trim():'';
    if(key) {
      if(key.length>512||/[\s\r\n]/.test(key))throw new Error('Enter an API key without whitespace.');
      if(payload.remember!==false) {
        if(!this.safeStorage?.isEncryptionAvailable())throw new Error('Encrypted key storage is unavailable. Uncheck Remember on this PC to use a session-only key.');
        next.encryptedKey=this.safeStorage.encryptString(key).toString('base64');
      } else delete next.encryptedKey;
      this.sessionKey=payload.remember===false?key:''; delete next.verifiedAt;
    }
    fs.writeFileSync(this.file,JSON.stringify(next,null,2),{mode:0o600}); this.config=next; return this.status();
  }
  forget() {this.sessionKey='';delete this.config.encryptedKey;delete this.config.verifiedAt;fs.writeFileSync(this.file,JSON.stringify(this.config,null,2));return this.status();}
  async request(endpoint,{body,signal}={}) {
    const key=this.key();if(!key)throw new Error('Connect your OpenAI API key in AI Connection first.');
    const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000);
    let response;
    try {response=await this.fetch('https://api.openai.com/v1/'+endpoint,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:combined});}
    catch(error) {if(signal?.aborted)throw signal.reason || new Error('Job cancelled.');throw new Error('OpenAI request did not finish. Check your internet connection and API access.');}
    const raw=await response.text();if(raw.length>8*1024*1024)throw new Error('OpenAI response exceeded the app limit.');
    let data;try{data=JSON.parse(raw);}catch{throw new Error(`OpenAI returned an unreadable response (${response.status}).`);}
    if(!response.ok)throw new Error(redact(data.error?.message || `OpenAI request failed (${response.status}).`));
    return data;
  }
  async verify() {const model=await this.request('models/'+encodeURIComponent(this.config.model));this.config.verifiedAt=Date.now();fs.writeFileSync(this.file,JSON.stringify(this.config,null,2));return {...this.status(),verifiedModel:model.id};}
  async respond({model,instructions,input,tools,maxOutputTokens,signal}) {
    return this.request('responses',{signal,body:{model,instructions,input,tools,store:false,parallel_tool_calls:false,max_output_tokens:maxOutputTokens}});
  }
}
module.exports={OpenAIConnection,defaults,redact};
