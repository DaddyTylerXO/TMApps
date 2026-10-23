'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const MAX=4*1024*1024;
function normalize(image) {
 const size=image.getSize();if(image.isEmpty()||size.width>8192||size.height>8192)throw Error('Choose a PNG or JPEG photo up to 8192 pixels.');
 const side=Math.min(size.width,size.height),cropped=image.crop({x:Math.floor((size.width-side)/2),y:Math.floor((size.height-side)/2),width:side,height:side});
 const bytes=cropped.resize({width:128,height:128,quality:'good'}).toPNG();if(bytes.length>100000)throw Error('Photo is too large.');return bytes;
}
function setupPhoto({root,window,dialog,nativeImage}) {
 const file=path.join(root,'profile-photo.png');
 return async ({action,data}={})=>{
  if(action==='read'){try{return 'data:image/png;base64,'+(await fs.readFile(file)).toString('base64');}catch{return null;}}
  if(action==='choose'){
   const result=await dialog.showOpenDialog(window,{title:'Choose profile photo',properties:['openFile'],filters:[{name:'Profile photos',extensions:['png','jpg','jpeg']}]});
   if(result.canceled)return null;const selected=result.filePaths[0];if((await fs.stat(selected)).size>MAX)throw Error('Choose a photo smaller than 4 MB.');
   return 'data:image/png;base64,'+normalize(nativeImage.createFromBuffer(await fs.readFile(selected))).toString('base64');
  }
  if(action==='save'){
   if(data===null){await fs.rm(file,{force:true});return null;}
   if(typeof data!=='string'||data.length>140000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data))throw Error('Invalid profile photo.');
   const bytes=normalize(nativeImage.createFromBuffer(Buffer.from(data.split(',')[1],'base64')));
   await fs.mkdir(root,{recursive:true});const temp=file+'.tmp';await fs.writeFile(temp,bytes,{mode:0o600});await fs.rename(temp,file);return 'data:image/png;base64,'+bytes.toString('base64');
  }
  throw Error('Unknown photo action.');
 };
}
module.exports={setupPhoto,normalize};
