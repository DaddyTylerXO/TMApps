'use strict';
const fs=require('node:fs/promises'),{constants}=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function readBounded(file,limit=8*1024*1024){
  const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>limit)throw Error('Choose a regular vault file within the size limit.');
  const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0)|(constants.O_NONBLOCK||0));
  try{const stat=await handle.stat();if(!stat.isFile()||stat.size>limit)throw Error('Invalid vault file.');const chunks=[];let total=0;
    while(total<=limit){const buffer=Buffer.alloc(Math.min(65536,limit+1-total));const{bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;total+=bytesRead;if(total>limit)throw Error('Vault exceeds the size limit.');chunks.push(buffer.subarray(0,bytesRead));}
    return Buffer.concat(chunks,total);
  }finally{await handle.close();}
}
async function atomicWrite(file,bytes,{exclusive=false,guard=()=>{}}={}){
  await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';let handle;
  try{guard();handle=await fs.open(temp,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;guard();if(exclusive)await fs.link(temp,file);else for(let attempt=0;;attempt++){guard();try{await fs.rename(temp,file);break;}catch(e){if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=10)throw e;await new Promise(r=>setTimeout(r,50*(attempt+1)));}}}
  finally{await handle?.close();await fs.rm(temp,{force:true});}
}
module.exports={readBounded,atomicWrite};
