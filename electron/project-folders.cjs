const fs=require('node:fs');const path=require('node:path');const {resolveWithin}=require('./workspace.cjs');
function validFolderName(name){if(typeof name!=='string'||!name||name.length>100||/[<>:"/\\|?*\x00-\x1f]/.test(name)||/[ .]$/.test(name)||name==='.'||name==='..'||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))throw new Error('Use a folder name of 1–100 characters without Windows reserved names, slashes, or trailing spaces/dots.');return name;}
class ProjectFolders{
 constructor({directory,defaultParent}){this.file=path.join(directory,'project-folders.json');this.defaultParent=defaultParent;this.locations=new Map();try{for(const item of JSON.parse(fs.readFileSync(this.file,'utf8')))if(item&&typeof item.id==='string')this.locations.set(item.id,item);}catch{}}
 info(id){return this.locations.get(id) || {parentFolder:this.defaultParent(),folderName:'',folderPath:null};}
 list(){return [...this.locations.values()];}
 get(id){const item=this.locations.get(id);if(!item)return null;const resolved=resolveWithin(item.parentFolder,item.folderName);if(!fs.statSync(resolved.target).isDirectory()||fs.realpathSync(resolved.target)!==item.folderPath)throw new Error('The saved project folder moved or was replaced. Restore its original location before running this project.');return item;}
 create(payload){
  if(!payload||typeof payload.projectId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(payload.projectId))throw new Error('Choose a valid project.');
  const name=validFolderName(payload.folderName);const requested=payload.parentFolder || this.defaultParent();if(typeof requested!=='string'||!path.isAbsolute(requested))throw new Error('Choose an absolute folder location on this device.');
  if(path.resolve(requested)===path.resolve(this.defaultParent()))fs.mkdirSync(requested,{recursive:true});
  const parent=fs.realpathSync(requested);if(!fs.statSync(parent).isDirectory())throw new Error('Choose an existing parent folder.');
  const existing=this.locations.get(payload.projectId);if(existing){if(existing.parentFolder!==parent||existing.folderName!==name)throw new Error('This project already has a folder. Its files will stay in their saved location.');return this.get(payload.projectId);}
  const resolved=resolveWithin(parent,name);try{fs.lstatSync(resolved.target);throw new Error('A folder or file with this name already exists. Choose a different folder name.');}catch(error){if(error.code!=='ENOENT')throw error;}
  fs.mkdirSync(resolved.target);const item={id:payload.projectId,parentFolder:parent,folderName:name,folderPath:fs.realpathSync(resolved.target)};this.locations.set(item.id,item);
  try{const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify(this.list(),null,2));fs.renameSync(temp,this.file);}catch(error){this.locations.delete(item.id);throw error;}return item;
 }
}
module.exports={ProjectFolders,validFolderName};
