'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
async function prune(context){
  const root=path.resolve(context.appOutDir),platform=context.electronPlatformName,arch=({0:'ia32',1:'x64',3:'arm',4:'arm64'})[context.arch];if(!['win32','darwin','linux'].includes(platform)||!arch)throw new Error('Unsupported package architecture.');
  const bin=path.join(root,...(platform==='darwin'?['TMA-Cut.app','Contents','Resources']:['resources']),'app.asar.unpacked','node_modules','ffprobe-static','bin');
  const remove=async target=>{const rel=path.relative(root,target);if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Package pruning escaped the build output.');await fs.rm(target,{recursive:true,force:true});};
  for(const entry of await fs.readdir(bin,{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=path.join(bin,entry.name);if(entry.name!==platform)await remove(folder);else for(const child of await fs.readdir(folder,{withFileTypes:true}))if(child.isDirectory()&&child.name!==arch)await remove(path.join(folder,child.name));}
  console.log('TMA-Cut packaging: retained only '+platform+' '+arch+' FFprobe binaries.');
}
module.exports=prune;
