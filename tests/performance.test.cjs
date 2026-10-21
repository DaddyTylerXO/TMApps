'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),M=require('../ui/model.js');
test('large timeline validation and bounded history stay within a CPU and memory budget',()=>{
  const p=M.create(),source={id:'source',kind:'video',name:'Performance fixture',duration:60,audio:true},media=new Map([['source',source]]);p.tracks=[];for(let t=0;t<40;t++){const track={id:M.id(),name:'Track '+t,kind:'video',volume:1,muted:false,hidden:false};p.tracks.push(track);for(let n=0;n<50;n++){const item=M.clip(source,track.id,n*10);item.out=10;p.items.push(item);}}
  const start=performance.now(),validated=M.validate(p,media),elapsed=performance.now()-start;assert.equal(validated.items.length,2000);assert.ok(elapsed<5000,`Validation took ${elapsed.toFixed(0)}ms`);const h=new M.History(validated);for(let n=0;n<30;n++)h.edit(project=>{project.items[0].start=n;});const bytes=h.past.reduce((sum,snapshot)=>sum+JSON.stringify(snapshot).length*2,0);assert.ok(bytes<=32*1024**2||h.past.length===1);console.log('Performance: 2,000 items / 40 tracks validated in '+elapsed.toFixed(1)+'ms; history '+(bytes/1024**2).toFixed(1)+' MB.');
});
