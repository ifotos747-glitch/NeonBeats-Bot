'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {MusicSession}=require('../src/player');

function mockSession(repeatMode='off'){
 const current={kind:'youtube-link',title:'Pierwszy remix',source:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'};
 const next={kind:'youtube-link',title:'Drugi remix',source:'https://www.youtube.com/watch?v=AAAAAAAAAAA'};
 let started=0;
 const obj={closed:false,current,queue:[next],repeatMode,skipRequested:false,starting:false,resource:{},
  cleanProcess(){},startNext(){started++;},showControlPanel(){},player:{state:{status:'playing'}}};
 return {obj,current,next,getStarted:()=>started};
}
test('natural end advances to next queued song',()=>{
 const {obj,next,getStarted}=mockSession('off');
 MusicSession.prototype.onIdle.call(obj);
 assert.deepEqual(obj.queue,[next]);
 assert.equal(obj.current,null);
 assert.equal(getStarted(),1);
});
test('repeat one queues finished track before the next one',()=>{
 const {obj,current,next}=mockSession('one');
 MusicSession.prototype.onIdle.call(obj);
 assert.equal(obj.queue[0].source,current.source);
 assert.equal(obj.queue[1],next);
});
test('skip bypasses repeat one and advances',()=>{
 const {obj,next,getStarted}=mockSession('one');
 obj.skipRequested=true;
 MusicSession.prototype.onIdle.call(obj);
 assert.deepEqual(obj.queue,[next]);
 assert.equal(obj.skipRequested,false);
 assert.equal(getStarted(),1);
});
test('shuffle preserves every queued track and keeps the current song',()=>{
 const {obj,current}=mockSession();
 obj.queue=[...Array.from({length:12},(_,i)=>({title:'Song '+i}))];
 const before=obj.queue.map(x=>x.title).sort();
 assert.equal(MusicSession.prototype.shuffleQueue.call(obj),true);
 assert.deepEqual(obj.queue.map(x=>x.title).sort(),before);
 assert.equal(obj.current,current);
});
test('repeat button toggles on and off',()=>{
 const {obj}=mockSession();
 assert.equal(MusicSession.prototype.toggleRepeat.call(obj),'one');
 assert.equal(MusicSession.prototype.toggleRepeat.call(obj),'off');
});
