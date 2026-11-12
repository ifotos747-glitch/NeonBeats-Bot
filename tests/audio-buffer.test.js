'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PassThrough}=require('node:stream');
const {bufferPcm,BYTES_PER_SECOND}=require('../src/audio-buffer');
test('PCM starts after configured prebuffer size',async()=>{
 const source=new PassThrough(),calls=[];
 const out=bufferPcm(source,()=>calls.push('ready'),{milliseconds:1000});
 source.write(Buffer.alloc(BYTES_PER_SECOND-100));
 assert.equal(calls.length,0);
 source.write(Buffer.alloc(100));
 assert.equal(calls.length,1);
 source.end();
 const result=[];for await(const chunk of out)result.push(chunk);
 assert.equal(Buffer.concat(result).length,BYTES_PER_SECOND);
});
test('short audio starts when source ends',async()=>{
 const source=new PassThrough(),calls=[];
 const out=bufferPcm(source,()=>calls.push('ready'),{milliseconds:2000});
 source.end(Buffer.alloc(1000));
 const result=[];for await(const chunk of out)result.push(chunk);
 assert.equal(Buffer.concat(result).length,1000);
 assert.equal(calls.length,1);
});

test('live radio keeps buffered PCM available throughout playback',async()=>{
 const {bufferLivePcm}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0,bytes=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:100,recoveryMs:200,maxMs:1000});
 live.stream.on('data',chunk=>{bytes+=chunk.length;});
 source.write(Buffer.alloc(BYTES_PER_SECOND));
 assert.equal(started,1);
 const initial=live.stats.bufferedMs;
 assert.ok(initial>=900);
 await new Promise(resolve=>setTimeout(resolve,120));
 assert.ok(bytes>0);
 assert.equal(live.stats.underruns,0);
 assert.ok(live.stats.bufferedMs<initial);
 assert.equal(live.stats.silenceMs,0);
 live.stop();source.destroy();
});
test('live radio inserts temporary silence on underrun, then recovers after refill',async()=>{
 const {bufferLivePcm,RADIO_FRAME_BYTES}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0,outputs=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:20,recoveryMs:120,maxMs:1000});
 live.stream.on('data',chunk=>{outputs+=chunk.length;});
 source.write(Buffer.alloc(RADIO_FRAME_BYTES*2,1));
 await new Promise(resolve=>setTimeout(resolve,125));
 assert.equal(started,1);
 assert.ok(live.stats.underruns>=1);
 assert.ok(live.stats.silenceMs>=20);
 source.write(Buffer.alloc(RADIO_FRAME_BYTES*20,2));
 await new Promise(resolve=>setTimeout(resolve,110));
 assert.ok(live.stats.playedBytes>RADIO_FRAME_BYTES*2);
 assert.ok(outputs>0);
 live.stop();source.destroy();
});
test('live radio handles a short finite stream and cleans up when ended',async()=>{
 const {bufferLivePcm,RADIO_FRAME_BYTES}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:1000,recoveryMs:200});
 source.end(Buffer.alloc(RADIO_FRAME_BYTES,1));
 const chunks=[];for await(const part of live.stream)chunks.push(part);
 assert.equal(started,1);
 assert.equal(Buffer.concat(chunks).length,RADIO_FRAME_BYTES);
 assert.equal(live.stats.playedBytes,RADIO_FRAME_BYTES);
});
