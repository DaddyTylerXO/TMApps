'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
function generate(directory,{version=require('../package.json').version,platform=process.platform,arch=process.arch}={}) {
  if(!['darwin','linux'].includes(platform) || !['x64','arm64'].includes(arch)) throw new Error('Unsupported native build');
  const name=`TMApps-Launcher-${version}-${platform==='darwin'?'mac':'linux'}-${arch}.${platform==='darwin'?'dmg':'AppImage'}`;
  const file=path.join(directory,name);
  // AppImage uses x86_64 in its file-name macro; catalogs use Node's x64 name.
  if(!fs.existsSync(file) && platform==='linux' && arch==='x64') {
    const generated=path.join(directory,name.replace('-linux-x64.','-linux-x86_64.'));
    if(fs.existsSync(generated)) fs.renameSync(generated,file);
  }
  if(!fs.existsSync(file)) throw new Error(`Native installer missing: ${name}`);
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const metadata={version,platform,arch,filename:name,url:`https://github.com/DaddyTylerXO/TMApps/releases/download/tma-apps/${name}`,sha256};
  fs.writeFileSync(file+'.sha256',`${sha256}  ${name}\n`);
  fs.writeFileSync(path.join(directory,`metadata-${platform}-${arch}.json`),JSON.stringify(metadata,null,2));
  return metadata;
}
if(require.main===module) generate(path.join(__dirname,'../dist'));
module.exports=generate;
