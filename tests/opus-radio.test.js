'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {bufferOpusRadio}=require('../src/opus-buffer');
const {ffmpegPath}=require('../src/config');
const {createAudioResource,StreamType}=require('@discordjs/voice');
const {radioCodec}=require('../src/player');

test('radio codec A/B mode is opt-in and defaults to the original PCM engine',()=>{
 assert.equal(radioCodec({}), 'pcm');
 assert.equal(radioCodec({NEONBEATS_RADIO_CODEC:'pcm'}),'pcm');
 assert.equal(radioCodec({NEONBEATS_RADIO_CODEC:'opus'}),'opus');
 assert.equal(radioCodec({NEONBEATS_RADIO_CODEC:'OpUs'}),'opus');
 assert.equal(radioCodec({NEONBEATS_RADIO_CODEC:'other'}),'pcm');
});

test('native FFmpeg Opus is demuxed and buffered into Discord-ready packets', {timeout:18000},async()=>{
 const args=[
  '-nostdin','-hide_banner','-loglevel','error',
  '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=3',
  '-ac','2','-ar','48000','-c:a','libopus','-application','audio',
  '-frame_duration','20','-b:a','128k','-f','opus','pipe:1'
 ];
 const child=spawn(ffmpegPath(),args,{stdio:['ignore','pipe','pipe']});
 let stderr='';
 child.stderr.on('data',chunk=>{stderr+=String(chunk).slice(-250);});
 const timer=setTimeout(()=>child.kill('SIGKILL'),12000);timer.unref?.();
 try{
  let started=0,packets=0,bytes=0;
  const buffering=bufferOpusRadio(child.stdout,()=>started++,{milliseconds:200,maxMs:1000});
  const resource=createAudioResource(buffering.stream,{inputType:StreamType.Opus,inlineVolume:false});
  assert.equal(resource.volume,undefined);
  for await(const packet of resource.playStream){
   assert.ok(Buffer.isBuffer(packet));
   assert.ok(packet.length>1);
   packets++;bytes+=packet.length;
  }
  const code=await new Promise((resolve,reject)=>{
   if(child.exitCode!==null)return resolve(child.exitCode);
   child.once('error',reject);child.once('close',resolve);
  });
  assert.equal(code,0,stderr);
  assert.equal(started,1);
  assert.ok(packets>=120,'expected 3s of ~20ms native Opus packets, got '+packets);
  assert.ok(bytes>1000,'expected encoded audio');
  assert.equal(buffering.stats.receivedPackets,packets);
  assert.equal(buffering.stats.playedPackets,packets);
  buffering.stop();
 } finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}
});
