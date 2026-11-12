'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {VoiceHealth}=require('../src/voice-health');

test('preserves AudioResource.read output while counting short misses that later reset',()=>{
 let time=1000,status='playing';
 const health=new VoiceHealth({now:()=>time,getStatus:()=>status});
 const frames=[Buffer.from([1]),null,null,Buffer.from([2]),null,Buffer.from([3])];
 const resource={read(){return frames.shift()??null;}};
 const original=resource.read;
 health.reset(true);health.attachResource(resource);
 assert.deepEqual(resource.read(),Buffer.from([1]));
 time+=20;assert.equal(resource.read(),null);
 time+=20;assert.equal(resource.read(),null);
 time+=65;assert.deepEqual(resource.read(),Buffer.from([2]));
 time+=20;assert.equal(resource.read(),null);
 time+=20;assert.deepEqual(resource.read(),Buffer.from([3]));
 const s=health.snapshot();
 assert.equal(s.resourceReads,6);
 assert.equal(s.missingReads,3);
 assert.equal(s.missingEpisodes,2);
 assert.equal(s.longestMissingSeries,2);
 assert.equal(s.readGaps50,1);
 assert.equal(s.largestReadGapMs,65);
 status='paused';time+=3000;resource.read();
 assert.equal(health.snapshot().resourceReads,6);
 health.close();assert.equal(resource.read,original);
});

test('preserves dispatch return values, counts explicit false and unavailable separately',()=>{
 let time=0;
 let result=true;
 const health=new VoiceHealth({now:()=>time,getStatus:()=> 'playing'});
 const connection={dispatchAudio(){return result;}};
 const original=connection.dispatchAudio;
 health.reset(true);health.attachConnection(connection);
 assert.equal(connection.dispatchAudio(),true);
 time+=20;result=false;assert.equal(connection.dispatchAudio(),false);
 time+=120;result=undefined;assert.equal(connection.dispatchAudio(),undefined);
 const s=health.snapshot();
 assert.equal(s.dispatchAttempts,3);
 assert.equal(s.dispatchSuccess,1);
 assert.equal(s.dispatchFailed,1);
 assert.equal(s.dispatchUnavailable,1);
 assert.equal(s.dispatchGaps100,1);
 assert.equal(s.largestDispatchGapMs,120);
 health.close();
 assert.equal(connection.dispatchAudio,original);
});

test('new radio track clears counters and does not count paused or file playback',()=>{
 let status='playing',time=0;
 const h=new VoiceHealth({now:()=>time,getStatus:()=>status});
 h.reset(true);
 h.observeRead(null);
 assert.equal(h.snapshot().missingReads,1);
 h.reset(false);
 h.observeRead(null);
 assert.equal(h.snapshot().missingReads,0);
 h.reset(true);
 status='paused';time+=2000;h.observeDispatch(false);h.observeRead(null);
 assert.equal(h.snapshot().resourceReads,0);
 assert.equal(h.snapshot().dispatchAttempts,0);
 status='playing';h.clearTiming();time+=20;h.observeRead(Buffer.from([1]));
 assert.equal(h.snapshot().readGaps50,0);
});
