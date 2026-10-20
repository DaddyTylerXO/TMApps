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
  if(typeof v.secret==='string' && v.secret.startsWith('otpauth://')) {
    const u=new URL(v.secret); if(!['totp','hotp'].includes(u.hostname)) throw Error('Unsupported authenticator type.');
    const p=u.searchParams, label=decodeURIComponent(u.pathname.slice(1));if(u.hostname==='hotp'&&!p.has('counter'))throw Error('HOTP URLs must include an initial counter.');
    v={...v,name:v.name||label,issuer:p.get('issuer')||'',secret:p.get('secret'),type:u.hostname,algorithm:(p.get('algorithm')||'SHA1').toLowerCase(),digits:Number(p.get('digits')||6),period:Number(p.get('period')||30),counter:Number(p.get('counter')||0)};
  }
  const e={id:typeof v.id==='string'?v.id:crypto.randomUUID(),name:String(v.name||'').trim(),issuer:String(v.issuer||'').trim(),secret:secret(v.secret).text,type:v.type||'totp',algorithm:(v.algorithm||'sha1').toLowerCase(),digits:Number(v.digits??6),period:Number(v.period??30),counter:Number(v.counter??0)};
  if(!e.name || e.name.length>120 || e.issuer.length>120 || !['totp','hotp'].includes(e.type) || !['sha1','sha256','sha512'].includes(e.algorithm) || ![6,8].includes(e.digits) || !Number.isInteger(e.period) || e.period<15 || e.period>120 || !Number.isSafeInteger(e.counter) || e.counter<0) throw Error('Check the name and advanced authenticator settings.');
  return e;
}
function code(e,time=Date.now()) {
  const count=e.type==='hotp'?e.counter:Math.floor(time/1000/e.period), b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(count));
  const key=secret(e.secret).bytes; let h; try{h=crypto.createHmac(e.algorithm,key).update(b).digest();}finally{key.fill(0);}
  const offset=h[h.length-1]&15; return String((h.readUInt32BE(offset)&0x7fffffff)%10**e.digits).padStart(e.digits,'0');
}
module.exports={secret,entry,code};
