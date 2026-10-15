const readline = require('node:readline');
const lines = readline.createInterface({input:process.stdin});
lines.on('line',line=>{
  const message=JSON.parse(line); if(!message.id)return;
  if(message.method==='never')return;
  const result=message.method==='initialize'?{protocolVersion:'2025-06-18',capabilities:{tools:{}}}:message.method==='tools/list'?{tools:[{name:'inspect',inputSchema:{type:'object'}}]}:{content:[{type:'text',text:'real protocol response'}]};
  const response=JSON.stringify({jsonrpc:'2.0',id:message.id,result})+'\n';
  process.stdout.write('{"jsonrpc":"2.0","method":"notifications/message"}\n');
  const half=Math.floor(response.length/2); process.stdout.write(response.slice(0,half)); setImmediate(()=>process.stdout.write(response.slice(half)));
});
