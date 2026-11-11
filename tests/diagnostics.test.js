'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {diagnoseStream,diagnoseLocalFFmpeg,formatDiagnostic,redactFFmpeg}=require('../src/diagnostics');

function fakeSpawn({stdout='',stderr='',code=0,signal=null}={}) {
 return (_binary,args)=>{
  assert.ok(args.includes('-i'));
  const child=new EventEmitter();
  child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.kill=()=>true;
  process.nextTick(()=>{
   if(stdout)child.stdout.write(Buffer.from(stdout));
   if(stderr)child.stderr.write(stderr);
   child.stdout.end();child.stderr.end();
   child.emit('close',code,signal);
  });
  return child;
 };
}
test('redacts URLs and secret-looking headers in FFmpeg logs',()=>{
 const result=redactFFmpeg('https://radio.example.org/live?token=top-secret\nAuthorization: Bearer xyz\nHTTP error 403 Forbidden');
 assert.doesNotMatch(result,/top-secret|Bearer xyz|https:\/\//);
 assert.match(result,/403 Forbidden/);
});
test('diagnosis detects a rejected stream with no audio',async()=>{
 const r=await diagnoseStream('http://radio.example.org/live?token=private',{spawnProcess:fakeSpawn({stderr:'HTTP error 403 Forbidden',code:1})});
 assert.equal(r.ok,false);assert.equal(r.bytes,0);assert.equal(r.exitCode,1);
 assert.match(formatDiagnostic('Radio',r),/403 Forbidden/);
});
test('diagnosis reports actual output audio bytes',async()=>{
 const r=await diagnoseStream('https://radio.example.org/live.mp3',{spawnProcess:fakeSpawn({stdout:'12345678'})});
 assert.equal(r.ok,true);assert.equal(r.bytes,8);assert.equal(r.exitCode,0);
});
test('diagnosis reports signal when FFmpeg was terminated',async()=>{
 const r=await diagnoseStream('https://radio.example.org/live.mp3',{spawnProcess:fakeSpawn({code:null,signal:'SIGKILL'})});
 assert.equal(r.ok,false);assert.equal(r.exitCode,null);assert.equal(r.signal,'SIGKILL');
 assert.match(formatDiagnostic('Radio',r),/SIGKILL/);
});
test('local sine test is independent from network radio and yields bytes',async()=>{
 const r=await diagnoseLocalFFmpeg({spawnProcess:fakeSpawn({stdout:'abc'})});
 assert.equal(r.ok,true);assert.equal(r.bytes,3);
 assert.match(formatDiagnostic('Radio',r,r),/Test lokalny FFmpeg/);
});
