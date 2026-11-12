'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {PassThrough}=require('node:stream');
const {RadioHealth}=require('../src/radio-health');
const {pipeHttpAudio}=require('../src/network');

test('tracks gaps between consumed MP3 radio chunks without assuming packet loss',()=>{
 let now=1000;
 const h=new RadioHealth(()=>now);
 h.onChunk(1024);
 now+=300;h.onChunk(512);
 now+=650;h.onChunk(256);
 now+=2100;h.onChunk(128);
 const x=h.snapshot();
 assert.equal(x.httpBytes,1920);
 assert.equal(x.httpChunks,4);
 assert.equal(x.readGaps500,2);
 assert.equal(x.readGaps2000,1);
 assert.equal(x.maxReadGapMs,2100);
});

test('tracks MP3 decoder warnings from split stderr lines and sanitizes URLs',()=>{
 const h=new RadioHealth();
 h.onFFmpegData('[mp3float @ x] Header miss');
 assert.equal(h.snapshot().decoderWarnings,0);
 h.onFFmpegData('ing\nnormal FFmpeg output\n[mp3] Invalid data found at https://radio.example.com/x?secret=42\n');
 assert.equal(h.snapshot().decoderWarnings,2);
 assert.doesNotMatch(h.snapshot().lastDecoderWarning,/secret=42/);
 assert.equal(h.snapshot().httpBytes,0);
});

test('network metering preserves streamed bytes and redirects behavior',async()=>{
 const text='mp3 stream payload';
 const destination=new PassThrough();
 const collected=[],sizes=[];
 destination.on('data',c=>collected.push(c));
 const headers=new Headers({'content-type':'audio/mpeg'});
 const fetchImpl=async()=>new Response(new Blob([text]).stream(),{status:200,headers});
 await pipeHttpAudio('https://radio.example.com/live',destination,{
  fetchImpl,onChunk:size=>sizes.push(size)
 });
 assert.equal(Buffer.concat(collected).toString(),text);
 assert.equal(sizes.reduce((a,b)=>a+b,0),Buffer.byteLength(text));
 assert.ok(sizes.length>0);
});
