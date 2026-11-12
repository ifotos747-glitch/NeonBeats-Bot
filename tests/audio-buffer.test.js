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

test('live PCM does not drain by a competing timer without a consumer',async()=>{
 const {bufferLivePcm}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:100,maxMs:1000});
 source.write(Buffer.alloc(BYTES_PER_SECOND,7));
 assert.equal(started,1);
 const atStart=live.stats.bufferedMs;
 await new Promise(resolve=>setTimeout(resolve,120));
 assert.equal(live.stats.bufferedMs,atStart);
 assert.equal(live.stats.playedBytes,0);
 assert.equal(live.stats.silenceMs,0);
 live.stop();source.destroy();
});

test('live PCM delivers data on downstream demand without a 20ms timer',async()=>{
 const {bufferLivePcm,RADIO_FRAME_BYTES}=require('../src/audio-buffer');
 const source=new PassThrough(),live=bufferLivePcm(source,()=>{},{
  milliseconds:100,maxMs:1000
 });
 const initial=Buffer.alloc(RADIO_FRAME_BYTES*25,3);
 source.write(initial);
 const chunks=[];let total=0;
 live.stream.on('data',part=>{chunks.push(part);total+=part.length;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(total,initial.length);
 assert.equal(Buffer.concat(chunks).compare(initial),0);
 live.stop();source.destroy();
});

test('live PCM detects true starvation and recovers when the source refills',async()=>{
 const {bufferLivePcm,RADIO_FRAME_BYTES}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:20,recoveryMs:120,maxMs:1000});
 const parts=[];live.stream.on('data',b=>parts.push(b));
 source.write(Buffer.alloc(RADIO_FRAME_BYTES*2,1));
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(started,1);
 assert.ok(live.stats.underruns>=1);
 const before=live.stats.playedBytes;
 source.write(Buffer.alloc(RADIO_FRAME_BYTES*20,2));
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(live.stats.playedBytes>before);
 assert.ok(parts.length>0);
 live.stop();source.destroy();
});

test('live radio ends cleanly with partial final frame and no 20ms polling',async()=>{
 const {bufferLivePcm,RADIO_FRAME_BYTES}=require('../src/audio-buffer');
 const source=new PassThrough();let started=0;
 const live=bufferLivePcm(source,()=>started++,{milliseconds:1000,recoveryMs:200});
 source.end(Buffer.alloc(RADIO_FRAME_BYTES/2,1));
 const chunks=[];for await(const part of live.stream)chunks.push(part);
 assert.equal(started,1);
 assert.equal(Buffer.concat(chunks).length,RADIO_FRAME_BYTES/2);
 assert.equal(live.stats.playedBytes,RADIO_FRAME_BYTES/2);
});
