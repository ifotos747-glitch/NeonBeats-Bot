'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {diagnoseHttp,formatDiagnostic}=require('../src/diagnostics');
const {openAudioResponse}=require('../src/network');
function httpResponse(status,{type='audio/mpeg',location=null,bodyText='123'}={}){
 return {
  status,ok:status>=200&&status<300,
  headers:new Headers({'content-type':type,...(location?{'location':location}:{})}),
  body:new Response(bodyText).body
 };
}
test('follows safe HTTP redirect and gets MP3 data',async()=>{
 let calls=0;
 const fakeFetch=async (url,opts)=>{
  assert.equal(opts.redirect,'manual');
  calls++;
  return calls===1?httpResponse(302,{location:'https://cdn.example.org/radio.mp3',type:'text/html'}):httpResponse(200);
 };
 const r=await diagnoseHttp('http://radio.example.org/radio.mp3',{fetchImpl:fakeFetch});
 assert.equal(r.ok,true);assert.equal(r.status,200);assert.equal(r.redirects,1);
 assert.equal(r.redirectHost,'cdn.example.org');assert.equal(calls,2);
 assert.match(formatDiagnostic('Radio',{ok:false,bytes:0,exitCode:null,signal:'SIGSEGV',durationMs:18},null,r),/Test HTTP Node.js: ✅/);
});
test('rejects redirects to localhost and private IP addresses',async()=>{
 for(const location of ['http://127.0.0.1/','http://localhost:8080/','http://192.168.1.3/']){
  await assert.rejects(()=>openAudioResponse('https://radio.example.org/live',{
   fetchImpl:async()=>httpResponse(302,{location})
  }),/publiczny URL HTTP/);
 }
});
test('rejects HTML landing pages instead of audio',async()=>{
 await assert.rejects(()=>openAudioResponse('https://radio.example.org/',{
  fetchImpl:async()=>httpResponse(200,{type:'text/html'})
 }),/stronę zamiast strumienia/);
});
test('HTTP status 403 reported without URL leaks',async()=>{
 const r=await diagnoseHttp('https://radio.example.org/stream?secret=abc',{
  fetchImpl:async()=>httpResponse(403,{type:'text/html'})
 });
 assert.equal(r.status,403);assert.equal(r.ok,false);
 assert.doesNotMatch(JSON.stringify(r),/secret=abc/);
});
test('network error reported safely',async()=>{
 const r=await diagnoseHttp('https://radio.example.org/stream',{
  fetchImpl:async()=>{const err=new Error('socket');err.cause={code:'ENETUNREACH'};throw err;}
 });
 assert.equal(r.error,'ENETUNREACH');
});
