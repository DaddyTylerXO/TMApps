'use strict';
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{Readable}=require('node:stream');
const types={mp4:'video/mp4',m4v:'video/mp4',mov:'video/quicktime',webm:'video/webm',mkv:'video/x-matroska',avi:'video/x-msvideo',mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',flac:'audio/flac',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp'};
async function mediaResponse(file,request){
  const {size}=await fsp.stat(file),headers={'Accept-Ranges':'bytes','Access-Control-Allow-Origin':'*','Content-Type':types[path.extname(file).slice(1).toLowerCase()]||'application/octet-stream'};
  let start=0,end=size-1,status=200;const range=request.headers.get('range');
  if(range){
    const match=/^bytes=(\d*)-(\d*)$/.exec(range);let valid=!!match&&!!(match[1]||match[2]);
    if(valid){if(!match[1]){const suffix=Number(match[2]);valid=Number.isSafeInteger(suffix)&&suffix>0;start=Math.max(0,size-suffix);}else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}valid=valid&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start;}
    if(!valid)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+size,'Content-Length':'0'}});
    end=Math.min(end,size-1);status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length']=String(Math.max(0,end-start+1));
  const body=request.method==='HEAD'||!size?null:Readable.toWeb(fs.createReadStream(file,{start,end}));
  return new Response(body,{status,headers});
}
module.exports={mediaResponse};
