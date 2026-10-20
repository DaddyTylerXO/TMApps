const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const version=require('../package.json').version;
const platform=process.platform==='win32'?'windows':process.platform==='darwin'?'macos':'linux';const arch=process.arch;const ext={windows:'.zip',macos:'.tar.gz',linux:'.AppImage'}[platform];
const filename=fs.readdirSync('dist').find(n=>n.endsWith(ext)&&(n.includes(`-${arch}.`)||(arch==='x64'&&n.includes('-x86_64.'))));if(!filename)throw Error('Package not found.');
const sha256=crypto.createHash('sha256').update(fs.readFileSync(path.join('dist',filename))).digest('hex');
const executable=platform==='windows'?'TMA-SocialsManager.exe':platform==='macos'?'TMA-SocialsManager.app/Contents/MacOS/TMA-SocialsManager':filename;
fs.writeFileSync(path.join('dist',`metadata-${platform}-${arch}.json`),JSON.stringify({version,platform,arch,filename,sha256,executable,format:platform==='windows'?'zip':platform==='macos'?'tar.gz':'appimage'},null,2));fs.writeFileSync(path.join('dist',filename+'.sha256'),`${sha256}  ${filename}\n`);
