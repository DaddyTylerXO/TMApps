'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util'),{entry,code}=require('./otp.cjs');
const derive=promisify(crypto.scrypt), AAD=Buffer.from('TMA-Padlock/v1');
async function key(password,salt){if(typeof password!=='string'||password.length>1024)throw Error('Invalid password.');return derive(password,salt,32,{N:65536,r:8,p:1,maxmem:128*1024*1024});}
function seal(data,k){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',k,iv);c.setAAD(AAD);const bytes=Buffer.concat([c.update(JSON.stringify(data)),c.final()]);return{iv:iv.toString('base64'),tag:c.getAuthTag().toString('base64'),data:bytes.toString('base64')};}
function open(v,k){const d=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(v.iv,'base64'),{authTagLength:16});d.setAAD(AAD);d.setAuthTag(Buffer.from(v.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(v.data,'base64')),d.final()]).toString());}
class Vault{
  constructor(file,storage){this.file=file;this.storage=storage;this.epoch=0;}
  deviceAvailable(){return !!this.storage?.isEncryptionAvailable() && (!this.storage.getSelectedStorageBackend || !['basic_text','unknown'].includes(this.storage.getSelectedStorageBackend()));}
  lock(){this.epoch++;this.key?.fill(0);this.key=null;this.data=null;this.header=null;}
  require(){if(!this.key)throw Error('Unlock your vault first.');}
  async read(file=this.file){if((await fs.stat(file)).size>8*1024*1024)throw Error('Vault too large.');const h=JSON.parse(await fs.readFile(file,'utf8'));if(h.version!==1||!['password','device'].includes(h.mode))throw Error('Unsupported vault.');return h;}
  async status(){try{const h=await this.read();return{exists:true,mode:h.mode,deviceAvailable:this.deviceAvailable(),unlocked:!!this.key};}catch(e){if(e.code==='ENOENT')return{exists:false,deviceAvailable:this.deviceAvailable(),unlocked:false};throw e;}}
  async create(password,mode){try{await fs.access(this.file);throw Error('A vault already exists.');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(!['password','device'].includes(mode))throw Error('Choose vault protection.');
    if(mode==='password' && password.length<12)throw Error('Use a master password of at least 12 characters.');
    if(mode==='device'&&!this.deviceAvailable())throw Error('Secure device storage unavailable. Use a master password.');
    const epoch=this.epoch,salt=crypto.randomBytes(16),k=mode==='password'?await key(password,salt):crypto.randomBytes(32);
    if(epoch!==this.epoch){k.fill(0);throw Error('Vault locked.');}
    this.key=k;this.header={version:1,mode,salt:salt.toString('base64'),...(mode==='device'?{wrapped:this.storage.encryptString(k.toString('base64')).toString('base64')}:{})};this.data={entries:[]};
    try{await this.save();}catch(e){this.lock();throw e;}return this.list();
  }
  async unlock(password){this.lock();const epoch=this.epoch,h=await this.read();let k;
    try{if(h.mode==='device'){if(!this.deviceAvailable())throw Error();k=Buffer.from(this.storage.decryptString(Buffer.from(h.wrapped,'base64')),'base64');}else{k=await key(password,Buffer.from(h.salt,'base64'));}
      const data=open(h,k);if(!Array.isArray(data.entries)||data.entries.length>2000)throw Error();data.entries=data.entries.map(entry);if(new Set(data.entries.map(e=>e.id)).size!==data.entries.length)throw Error();
      if(epoch!==this.epoch)throw Error();this.key=k;this.data=data;this.header=h;return this.list();
    }catch{k?.fill(0);throw Error('Could not unlock. Check the password, device account, or vault file.');}
  }
  list(){this.require();return this.data.entries.map(({secret,...e})=>({...e,code:code({...e,secret}),remaining:e.type==='totp'?e.period-Math.floor(Date.now()/1000)%e.period:null}));}
  async save(){this.require();await fs.mkdir(path.dirname(this.file),{recursive:true});const temp=this.file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify({...this.header,...seal(this.data,this.key)}),{mode:0o600,flag:'wx'});await fs.rename(temp,this.file);}finally{await fs.rm(temp,{force:true});}}
  async mutate(fn){this.require();const before=structuredClone(this.data);try{fn();await this.save();return this.list();}catch(e){this.data=before;throw e;}}
  async add(value){const e=entry(value);return this.mutate(()=>{if(this.data.entries.length>=2000)throw Error('Vault entry limit reached.');if(this.data.entries.some(x=>x.id===e.id))throw Error('Duplicate entry.');this.data.entries.push(e);});}
  find(id){this.require();const e=this.data.entries.find(e=>e.id===id);if(!e)throw Error('Authenticator not found.');return e;}
  async rename(id,name){return this.mutate(()=>{const e=this.find(id);e.name=entry({...e,name}).name;});}
  async remove(id){this.find(id);return this.mutate(()=>{this.data.entries=this.data.entries.filter(e=>e.id!==id);});}
  async advance(id){return this.mutate(()=>{const e=this.find(id);if(e.type!=='hotp'||e.counter>=Number.MAX_SAFE_INTEGER)throw Error('Cannot advance this authenticator.');e.counter++;});}
}
module.exports={Vault,seal,open,key};
