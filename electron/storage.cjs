'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
async function scanFolder(folder,{maxFiles=100000,maxDepth=20}={}){
  let bytes=0,count=0,skipped=0,limited=false;
  async function walk(dir,depth){
    if(depth>maxDepth){limited=true;return;}const entries=await fs.opendir(dir).catch(()=>null);if(!entries)return;
    for await(const entry of entries){
      if(count>=maxFiles){limited=true;break;}
      if(entry.isSymbolicLink()){skipped++;continue;}
      if(entry.isDirectory())await walk(path.join(dir,entry.name),depth+1);
      else if(entry.isFile()){count++;bytes+=(await fs.stat(path.join(dir,entry.name)).catch(()=>({size:0}))).size;}
    }
  }
  await walk(folder,0);return {folder,bytes,count,skipped,limited};
}
module.exports={scanFolder};
