'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {diagnoseHttp,formatDiagnostic}=require('../src/diagnostics');

test('HTTP test recognizes audio response and first bytes',async()=>{
 const report=await diagnoseHttp('https://radio.example.org/stream',{
  fetchImpl:async()=>({
   status:200,ok:true,headers:new Headers({'content-type':'audio/mpeg'}),
   body:{getReader:()=>({read:async()=>({value:new Uint8Array([1,2,3,4])}),cancel:async()=>{}})}
  })
 });
 assert.equal(report.status,200);
 assert.equal(report.type,'audio/mpeg');
 assert.equal(report.bytes,4);
 assert.equal(report.ok,true);
 const s=formatDiagnostic('radio',{ok:false,bytes:0,exitCode:null,signal:null,durationMs:1000},null,report);
 assert.match(s,/Test HTTP Node.js: ✅/);
});
test('HTTP test handles HTTP 403 with no audio',async()=>{
 const report=await diagnoseHttp('https://radio.example.org/stream',{fetchImpl:async()=>({
  status:403,ok:false,headers:new Headers({'content-type':'text/html'})
 })});
 assert.equal(report.status,403);assert.equal(report.ok,false);
});
test('HTTP test does not follow redirects',async()=>{
 const report=await diagnoseHttp('https://radio.example.org/live',{
  fetchImpl:async(_url,init)=>{
   assert.equal(init.redirect,'manual');
   return {status:302,ok:false,headers:new Headers({'location':'https://cdn.example.net/live'})};
  }
 });
 assert.equal(report.status,302);
 assert.equal(report.redirectHost,'cdn.example.net');
});
test('HTTP test returns network error without exposing URL',async()=>{
 const report=await diagnoseHttp('https://radio.example.org/live?key=secret',{
  fetchImpl:async()=>{const e=new Error('internal');e.cause={code:'ENETUNREACH'};throw e;}
 });
 assert.equal(report.error,'ENETUNREACH');
 assert.doesNotMatch(JSON.stringify(report),/secret/);
});
