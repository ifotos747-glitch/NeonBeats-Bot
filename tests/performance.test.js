'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {scheduleGuildJob}=require('../src/web-control');
const {MusicSession}=require('../src/player');

test('slow command on one Discord guild does not block another',async()=>{
 const chains=new Map(),order=[];
 let release;
 const slow=scheduleGuildJob(chains,'guildA',()=>new Promise(resolve=>{release=()=>{order.push('A');resolve();};}));
 const fast=scheduleGuildJob(chains,'guildB',async()=>{order.push('B');});
 await fast;
 assert.deepEqual(order,['B']);
 assert.equal(typeof release,'function');
 release();
 await slow;
 assert.deepEqual(order,['B','A']);
});

test('commands stay ordered within one guild and release the queue',async()=>{
 const chains=new Map(),order=[];
 const first=scheduleGuildJob(chains,'same',async()=>{
  order.push('one');
  await new Promise(resolve=>setTimeout(resolve,20));
  order.push('two');
 });
 const second=scheduleGuildJob(chains,'same',async()=>{order.push('three');});
 await Promise.all([first,second]);
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(order,['one','two','three']);
 assert.equal(chains.size,0);
});

test('frequent panel updates coalesce to the most recent state',async()=>{
 let sends=0,edits=0;
 const obj={
  closed:false,current:{title:'First'},panelDirty:false,panelUpdate:null,panelLastEdit:0,
  panelMessage:null,panelChannelId:null,panelFactory(track){return {content:track.title};},
  textChannel:{id:'channel',async send(){sends++;return {async edit(payload){edits++;assert.equal(payload.content,'Updated');}};}},
  showControlPanel:MusicSession.prototype.showControlPanel
 };
 const one=obj.showControlPanel(obj.current);
 obj.current={title:'Updated'};
 const two=obj.showControlPanel(obj.current);
 const three=obj.showControlPanel(obj.current);
 await Promise.all([one,two,three]);
 assert.equal(sends,1);
 assert.equal(edits,1);
});

test('manual radio retries are bounded rather than stopping on first interruption',()=>{
 const obj={
  closed:false,current:{kind:'radio',source:'https://radio.example/live',title:'Test radio'},
  queue:[],lastError:'',retryCount:0,skipRequested:false,blockUntil:0,
  announce(){},cleanProcess(){},onIdle(){},player:{stop(){return false;}}
 };
 MusicSession.prototype.fail.call(obj,'Network interrupted');
 assert.equal(obj.queue.length,1);
 assert.equal(obj.queue[0].reconnectRetries,1);
 obj.queue=[];obj.current={...obj.current,reconnectRetries:3};
 MusicSession.prototype.fail.call(obj,'Network interrupted');
 assert.equal(obj.queue.length,0);
});
