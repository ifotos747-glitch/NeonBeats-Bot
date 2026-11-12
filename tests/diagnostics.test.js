'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {diagnoseStream,diagnoseLocalFFmpeg,formatDiagnostic,redactFFmpeg}=require('../src/diagnostics');

function fakeSpawn({stdout='',stderr='',code=0,signal=null}={}) {
 return (_binary,args)=>{
  assert.ok(args.includes('-i'));
  const child=new EventEmitter();
  child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();
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
 const r=await diagnoseStream('http://radio.example.org/live?token=private',{spawnProcess:fakeSpawn({stderr:'Invalid input stream',code:1}),pipeAudio:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.bytes,0);assert.equal(r.exitCode,1);
 assert.match(formatDiagnostic('Radio',r),/Invalid input stream/);
});
test('diagnosis reports actual output audio bytes',async()=>{
 const r=await diagnoseStream('https://radio.example.org/live.mp3',{spawnProcess:fakeSpawn({stdout:'12345678'}),pipeAudio:async()=>{}});
 assert.equal(r.ok,true);assert.equal(r.bytes,8);assert.equal(r.exitCode,0);
});
test('diagnosis reports signal when FFmpeg was terminated',async()=>{
 const r=await diagnoseStream('https://radio.example.org/live.mp3',{spawnProcess:fakeSpawn({code:null,signal:'SIGKILL'}),pipeAudio:async()=>{}});
 assert.equal(r.ok,false);assert.equal(r.exitCode,null);assert.equal(r.signal,'SIGKILL');
 assert.match(formatDiagnostic('Radio',r),/SIGKILL/);
});
test('local sine test is independent from network radio and yields bytes',async()=>{
 const r=await diagnoseLocalFFmpeg({spawnProcess:fakeSpawn({stdout:'abc'})});
 assert.equal(r.ok,true);assert.equal(r.bytes,3);
 assert.match(formatDiagnostic('Radio',r,r),/Test lokalny FFmpeg/);
});

test('diagnosis uses Node-to-FFmpeg stdin instead of FFmpeg HTTP (avoids SIGSEGV path)',async()=>{
 let argsUsed=null,piped=null;
 const spawnProcess=(_bin,args,opts)=>{
  argsUsed=args;
  assert.deepEqual(opts.stdio,['pipe','pipe','pipe']);
  return fakeSpawn({stdout:'pcm payload'})(_bin,args);
 };
 const r=await diagnoseStream('http://4stream.pl:18272/stream',{
  spawnProcess,
  pipeAudio:async(url,destination,{signal})=>{
   piped=url;
   assert.equal(signal.aborted,false);
   destination.write(Buffer.from('radio-mpeg'));
   destination.end();
  }
 });
 assert.deepEqual(argsUsed.slice(argsUsed.indexOf('-i'),argsUsed.indexOf('-i')+2),['-i','pipe:0']);
 assert.equal(argsUsed.includes('http://4stream.pl:18272/stream'),false);
 assert.equal(piped,'http://4stream.pl:18272/stream');
 assert.equal(r.ok,true);
 assert.equal(r.method,'node-pipe');
 assert.match(formatDiagnostic('Radio Club Dj',r),/Node.js → pipe:0/);
});

test('network failures are surfaced without unredacted URLs in radio diagnosis',async()=>{
 const r=await diagnoseStream('http://radio.example.org/stream?token=private',{
  spawnProcess:()=>{const e=new EventEmitter();e.stdin=new PassThrough();e.stdout=new PassThrough();e.stderr=new PassThrough();e.kill=()=>true;return e;},
  pipeAudio:async()=>{throw Error('Connection refused at http://radio.example.org/stream?token=private');}
 });
 assert.equal(r.ok,false);
 assert.doesNotMatch(r.error,/token=private/);
 assert.ok(r.error.length>0);
});
