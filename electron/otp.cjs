'use strict';
const crypto = require('node:crypto');
function secret(value) {
  if(typeof value!=='string' || value.length>4096) throw Error('Enter a Base32 secret.');
  const s=value.toUpperCase().replace(/[\s-]/g,'').replace(/=+$/,'');
  if(!/^[A-Z2-7]{16,1024}$/.test(s)) throw Error('Use a Base32 secret of at least 16 characters.');
  let bits=0,acc=0; const out=[];
  for(const ch of s){acc=(acc<<5)|'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(ch);bits+=5;if(bits>=8){bits-=8;out.push((acc>>>bits)&255);}}
  if(bits && (acc&((1<<bits)-1))) throw Error('Invalid Base32 padding bits.');
  return {text:s,bytes:Buffer.from(out)};
}
function entry(value) {
  if(!value || typeof value!=='object') throw Error('Invalid authenticator.');
  let v={...value};
  if(typeof v.secret!=='string'||v.secret.length>4096||(v.name!==undefined&&(typeof v.name!=='string'||v.name.length>120))||(v.issuer!==undefined&&(typeof v.issuer!=='string'||v.issuer.length>120))||(v.id!==undefined&&(typeof v.id!=='string'||!v.id.length||v.id.length>128||/[\x00-\x1f\x7f]/.test(v.id))))throw Error('Invalid authenticator fields.');
  if(typeof v.secret==='string' && v.secret.startsWith('otpauth://')) {
    const u=new URL(v.secret); if(!['totp','hotp'].includes(u.hostname)||u.username||u.password||u.port||u.hash) throw Error('Unsupported authenticator URL.');
    const p=u.searchParams, label=decodeURIComponent(u.pathname.slice(1));if(u.hostname==='hotp'&&!p.has('counter'))throw Error('HOTP URLs must include an initial counter.');
    v={...v,name:v.name||label,issuer:p.get('issuer')||'',secret:p.get('secret'),type:u.hostname,algorithm:(p.get('algorithm')||'SHA1').toLowerCase(),digits:Number(p.get('digits')||6),period:Number(p.get('period')||30),counter:Number(p.get('counter')||0)};
  }
  const decoded=secret(v.secret);const normalized=decoded.text;decoded.bytes.fill(0);
  const e={id:typeof v.id==='string'?v.id:crypto.randomUUID(),name:String(v.name||'').trim(),issuer:String(v.issuer||'').trim(),secret:normalized,type:v.type||'totp',algorithm:(v.algorithm||'sha1').toLowerCase(),digits:Number(v.digits??6),period:Number(v.period??30),counter:Number(v.counter??0)};
  if(!e.name || e.name.length>120 || e.issuer.length>120 || !['totp','hotp'].includes(e.type) || !['sha1','sha256','sha512'].includes(e.algorithm) || ![6,8].includes(e.digits) || !Number.isInteger(e.period) || e.period<15 || e.period>120 || !Number.isSafeInteger(e.counter) || e.counter<0) throw Error('Check the name and advanced authenticator settings.');
  if(v.icon!==undefined){
    if(typeof v.icon!=='string'||!(/^(initial|shield|mail|cloud|work|game|key)$/.test(v.icon)||/^data:image\/png;base64,[A-Za-z0-9+/]{1,32768}={0,2}$/.test(v.icon)))throw Error('Invalid account icon.');
    if(v.icon.startsWith('data:')){const encoded=v.icon.slice(22),bytes=Buffer.from(encoded,'base64');if(bytes.toString('base64')!==encoded||bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==64||bytes.readUInt32BE(20)!==64)throw Error('Account icons must be normalized 64-pixel PNG images.');}
    e.icon=v.icon;
  }
  for(const field of ['hidden','autoRefresh'])if(v[field]!==undefined){if(typeof v[field]!=='boolean')throw Error('Invalid account option.');e[field]=v[field];}
  return e;
}
function code(e,time=Date.now()) {
  const count=e.type==='hotp'?e.counter:Math.floor(time/1000/e.period), b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(count));
  const key=secret(e.secret).bytes; let h; try{h=crypto.createHmac(e.algorithm,key).update(b).digest();}finally{key.fill(0);}
  const offset=h[h.length-1]&15; return String((h.readUInt32BE(offset)&0x7fffffff)%10**e.digits).padStart(e.digits,'0');
}
module.exports={secret,entry,code};
