'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
function setup(){
  const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../ui/index.html'),'utf8'),{runScripts:'outside-only',url:'file:///tma-cut/ui/index.html'}),w=dom.window;
  const a={id:'a',kind:'video',name:'<script>not HTML</script>.mp4',duration:5,width:1920,height:1080,url:'cut-media://asset/a'};
  w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.play=async function(){};w.confirm=()=>true;
  w.cut={importVideos:async()=>({ok:true,data:{media:[a],errors:[]}}),onProgress:()=>{},onCommand:()=>{}};
  w.eval(fs.readFileSync(path.join(__dirname,'../ui/renderer.js'),'utf8'));return dom;
}
test('editor imports media, trims, reorders, undoes, and renders captions without interpreting HTML',async()=>{
  const dom=setup(),w=dom.window,$=id=>w.document.getElementById(id);
  try{
    assert.equal(w.cutSmoke().nodeAvailable,false);assert.equal($('export-open').disabled,true);
    await w.cutTest.importVideos();assert.equal(w.cutTest.total(),5);assert.equal($('timeline-track').querySelectorAll('button').length,1);assert.equal($('export-open').disabled,false);assert.equal($('media-list').querySelector('script'),null);
    $('trim-in').value='1';$('trim-out').value='3';await $('apply-trim').onclick();assert.equal(w.cutTest.total(),2);
    $('undo').click();assert.equal(w.cutTest.total(),5);$('redo').click();assert.equal(w.cutTest.total(),2);
    $('caption-text').value='<b>literal caption</b>';$('caption-start').value='0';$('caption-end').value='1';await $('add-caption').onclick();w.cutTest.seek(.5);assert.equal($('preview-caption').textContent,'<b>literal caption</b>');assert.equal($('preview-caption').children.length,0);
    $('media-list').querySelector('button').click();assert.equal(w.cutTest.getProject().clips.length,2);$('move-left').click();assert.equal(w.cutTest.getProject().clips[0].out,5);$('remove-clip').click();assert.equal(w.cutTest.total(),2);
    $('trim-in').value='-1';await $('apply-trim').onclick();assert.match($('notice').textContent,/Trim points/);assert.equal(w.cutTest.total(),2);
  }finally{w.close();}
});
