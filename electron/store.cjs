const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
class Store{
  constructor(root,secure){this.root=root;this.secure=secure;this.state={schemaVersion:1,accounts:[],drafts:[],history:[],dashboards:[],metricHistory:{}};}
  async load(){try{this.state=JSON.parse(await fs.readFile(path.join(this.root,'workspace.json'),'utf8'));if(this.state.schemaVersion!==1||!['accounts','drafts','history'].every(k=>Array.isArray(this.state[k])))throw Error('format');}catch(e){if(e.code!=='ENOENT')throw Error('The saved workspace could not be read. Your file has been preserved.');}return this;}
  seal(value){if(!this.secure.isEncryptionAvailable()||this.secure.getSelectedStorageBackend?.()==='basic_text')throw Error('Secure OS credential storage is unavailable. Enable your system keychain before connecting.');return this.secure.encryptString(JSON.stringify(value)).toString('base64');}
  unseal(value){try{return JSON.parse(this.secure.decryptString(Buffer.from(value,'base64')));}catch{throw Error('Your system keychain could not unlock this account. Reconnect it.');}}
  async save(){await fs.mkdir(this.root,{recursive:true,mode:0o700});const tmp=path.join(this.root,`workspace-${crypto.randomUUID()}.tmp`);await fs.writeFile(tmp,JSON.stringify(this.state,null,2),{mode:0o600});await fs.rename(tmp,path.join(this.root,'workspace.json'));}
  snapshot(){const {oauthClients,...state}=this.state;return {...state,accounts:this.state.accounts.map(({credentials,...a})=>a)};}
}
module.exports={Store};
