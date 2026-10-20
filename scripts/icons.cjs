const fs = require('node:fs');
const { PNG } = require('pngjs');
const png = new PNG({ width: 512, height: 512 });
for(let y=0;y<512;y++) for(let x=0;x<512;x++) {
  const rounded=(x,y,l,t,r,b,k)=>x>=l&&x<=r&&y>=t&&y<=b&&Math.hypot(Math.max(l+k-x,0,x-r+k),Math.max(t+k-y,0,y-b+k))<=k;
  const bg=rounded(x,y,0,0,511,511,116);
  const bubble=rounded(x,y,95,126,417,353,40)||(y>=310&&y<=414&&x>=152&&x<=235-(y-353)*83/61);
  const dot=[183,256,329].some(cx=>Math.hypot(x-cx,y-242)<=17);
  const white=bubble&&!dot; const i=(y*512+x)*4;
  png.data.set(white?[255,255,255,255]:[229,185,47,bg?255:0],i);
}
const bytes=PNG.sync.write(png); fs.mkdirSync('assets',{recursive:true});fs.writeFileSync('assets/icon.png',bytes);
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(bytes.length,14);header.writeUInt32LE(22,18);
fs.writeFileSync('assets/icon.ico',Buffer.concat([header,bytes]));
