'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {opusProfile,opusOutputArgs}=require('../src/opus-profile');
const {bufferOpusRadio}=require('../src/opus-buffer');
const {ffmpegPath}=require('../src/config');

test('robust radio transport must be explicitly enabled; standard matches 3.7.8',()=>{
 assert.equal(opusProfile({}),'standard');
 assert.equal(opusProfile({NEONBEATS_RADIO_OPUS_PROFILE:'anything'}),'standard');
 assert.equal(opusProfile({NEONBEATS_RADIO_OPUS_PROFILE:'robust'}),'robust');
 assert.equal(opusProfile({NEONBEATS_RADIO_OPUS_PROFILE:'robust-cbr'}),'robust-cbr');
 const baseline=opusOutputArgs();
 assert.deepEqual(baseline.slice(-6),['-b:a','128k','-vbr','on','-f','opus','pipe:1'].slice(-6));
 assert.ok(!baseline.includes('-fec'));
 const robust=opusOutputArgs('robust');
 assert.ok(robust.includes('96k'));
 assert.ok(robust.includes('constrained'));
 assert.ok(robust.includes('-fec'));
 assert.ok(robust.includes('-packet_loss'));
 const cbr=opusOutputArgs('robust-cbr');
 assert.deepEqual(cbr.map((x,i)=>i===cbr.indexOf('-vbr')+1?'PROFILE':x),
  robust.map((x,i)=>i===robust.indexOf('-vbr')+1?'PROFILE':x));
 assert.equal(cbr[cbr.indexOf('-vbr')+1],'off');
 assert.equal(robust[robust.indexOf('-vbr')+1],'constrained');
});

test('FFmpeg robust encoder produces valid 20ms Opus packets for the existing buffer',{timeout:20000},async()=>{
 const args=['-nostdin','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=550:sample_rate=48000:duration=3',
  ...opusOutputArgs('robust')];
 const child=spawn(ffmpegPath(),args,{stdio:['ignore','pipe','pipe']});
 let stderr='';
 child.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-900);});
 const kill=setTimeout(()=>child.kill('SIGKILL'),13000);kill.unref?.();
 let started=0,packets=0;
 const buffered=bufferOpusRadio(child.stdout,()=>started++,{milliseconds:200,maxMs:1000});
 try{
  for await(const packet of buffered.stream){
   assert.ok(Buffer.isBuffer(packet)&&packet.length>0);
   packets++;
  }
  const code=await new Promise((resolve,reject)=>{
   if(child.exitCode!==null)return resolve(child.exitCode);
   child.once('error',reject);child.once('close',resolve);
  });
  assert.equal(code,0,stderr);
  assert.equal(started,1);
  assert.ok(packets>=120,'Expected around 150 packets, got '+packets);
  assert.equal(buffered.stats.receivedPackets,packets);
  assert.equal(buffered.stats.playedPackets,packets);
 }finally{
  clearTimeout(kill);
  buffered.stop();
  if(child.exitCode===null)child.kill('SIGKILL');
 }
});

test('FFmpeg robust CBR encoder produces valid 20ms Discord Opus packets',{timeout:20000},async()=>{
 const args=['-nostdin','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3',
  ...opusOutputArgs('robust-cbr')];
 const child=spawn(ffmpegPath(),args,{stdio:['ignore','pipe','pipe']});
 let stderr='';child.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-1000);});
 const kill=setTimeout(()=>child.kill('SIGKILL'),14000);kill.unref?.();
 const buffering=bufferOpusRadio(child.stdout,()=>{}, {milliseconds:200,maxMs:1000});
 let packets=0,smallest=Infinity,largest=0;
 try{
  for await(const packet of buffering.stream){
   assert.ok(Buffer.isBuffer(packet)&&packet.length>0);
   packets++;smallest=Math.min(smallest,packet.length);largest=Math.max(largest,packet.length);
  }
  const code=await new Promise((resolve,reject)=>{
   if(child.exitCode!==null)return resolve(child.exitCode);
   child.once('error',reject);child.once('close',resolve);
  });
  assert.equal(code,0,stderr);
  assert.ok(packets>=120,'Expected ~150 20ms packets, got '+packets);
  assert.equal(buffering.stats.receivedPackets,packets);
  assert.equal(buffering.stats.playedPackets,packets);
  assert.ok(largest>0&&smallest>0);
 }finally{clearTimeout(kill);buffering.stop();if(child.exitCode===null)child.kill('SIGKILL');}
});
