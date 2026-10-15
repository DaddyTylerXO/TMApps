const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {resolveWithin}=require('./workspace.cjs');
function outputSnapshot(root,{exclude=[]}={}){
 const files=new Map();let count=0;
 function visit(relative,depth){if(depth>16)throw new Error('Output verification exceeded 16 folder levels.');const dir=resolveWithin(root,relative);for(const entry of fs.readdirSync(dir.target,{withFileTypes:true})){
   if(entry.isSymbolicLink()||['node_modules','.git','.codex','.agents'].includes(entry.name))continue;
   const name=path.join(relative,entry.name);const resolved=resolveWithin(root,name);if(exclude.some(file=>path.resolve(file)===resolved.target))continue;const info=fs.lstatSync(resolved.target);if(info.isSymbolicLink())continue;
   if(info.isDirectory())visit(name,depth+1);else if(info.isFile()){
    if(++count>5000)throw new Error('Output verification exceeded 5,000 project files.');
    const signature=info.size<=2000000?crypto.createHash('sha256').update(fs.readFileSync(resolved.target)).digest('hex'):info.size+':'+info.mtimeMs;
    files.set(name,{path:name,bytes:info.size,signature});
   }
 }}visit('',0);return files;
}
function changedOutputs(before,after){return [...after.values()].filter(file=>file.bytes>0&&before.get(file.path)?.signature!==file.signature);}
function saveGeneratedImage(home,root,item){
 let bytes;
 if(item.savedPath){let source;try{source=resolveWithin(root,item.savedPath).target;}catch{source=resolveWithin(path.join(home,'generated_images'),item.savedPath).target;}const info=fs.statSync(source);if(!info.isFile()||info.size>20000000)throw new Error('Generated image is unavailable or exceeds 20 MB.');bytes=fs.readFileSync(source);}
 else{let data=String(item.result || '').replace(/^data:image\/[\w+.-]+;base64,/,'');if(data.length>28000000||!data||!/^[A-Za-z0-9+/=\r\n]+$/.test(data))throw new Error('Codex did not return a saved image or valid image bytes.');bytes=Buffer.from(data,'base64');}
 const extension=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216?'jpg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
 if(!extension)throw new Error('Codex returned an unsupported image format.');
 const relative=path.join('generated','image-'+crypto.randomUUID()+'.'+extension);const target=resolveWithin(root,relative);fs.mkdirSync(path.dirname(target.target),{recursive:true});resolveWithin(root,relative);fs.writeFileSync(target.target,bytes,{flag:'wx'});return {path:relative,bytes:bytes.length};
}
module.exports={outputSnapshot,changedOutputs,saveGeneratedImage};
