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
