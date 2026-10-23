'use strict';
function dimensions(bytes){
  let width,height;
  if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.toString('ascii',12,16)==='IHDR'){width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20);}
  else if(bytes[0]===255&&bytes[1]===216){let i=2;while(i+4<bytes.length){if(bytes[i++]!==255)throw Error('Invalid JPEG.');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;const length=bytes.readUInt16BE(i);if(length<2||i+length>bytes.length)throw Error('Invalid JPEG.');if([192,193,194].includes(marker)&&length>=8){height=bytes.readUInt16BE(i+3);width=bytes.readUInt16BE(i+5);break;}i+=length;}}
  if(!width||!height||width>4096||height>4096||width*height>4*1024*1024)throw Error('Choose a PNG or JPEG no larger than 4 megapixels (maximum side 4096).');
  return{width,height};
}
module.exports={dimensions};
