'use strict';
const {Readable}=require('node:stream');
const {createAudioResource,StreamType}=require('@discordjs/voice');

// FFmpeg emits Ogg/Opus frames of exactly 20ms. The built-in Voice demuxer
// extracts real Opus packets; buffering Ogg byte counts was only an estimate
// and could reach zero even while the downstream decoder held plenty of audio.
const FRAME_MS=20;
function bufferOpusRadio(source,onReady,{milliseconds=2000,maxMs=6000,recoveryMs=300}={}){
 const startupFrames=Math.max(1,Math.min(150,Math.ceil((Number(milliseconds)||0)/FRAME_MS)));
 const maxFrames=Math.max(startupFrames+25,Math.min(500,Math.ceil((Number(maxMs)||6000)/FRAME_MS)));
 const refillFrames=Math.max(2,Math.min(50,Math.ceil((Number(recoveryMs)||300)/FRAME_MS)));
 const demuxResource=createAudioResource(source,{inputType:StreamType.OggOpus,inlineVolume:false});
 const packetSource=demuxResource.playStream;
 const packets=[];
 let started=false,ended=false,closed=false,waiting=false,paused=false,refilling=false,missingEpisode=false;
 const stats={receivedPackets:0,playedPackets:0,peakBufferedMs:0,underruns:0};
 const stream=new Readable({objectMode:true,highWaterMark:4,read(){pump();}});
 Object.defineProperty(stats,'bufferedMs',{enumerable:true,get(){
  return (packets.length+stream.readableLength)*FRAME_MS;
 }});
 function reportPeak(){
  stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);
 }
 function resume(){
  if(paused&&!ended&&packets.length<maxFrames/2){
   paused=false;packetSource.resume();
  }
 }
 function pump(){
  if(closed)return;
  if(!started){waiting=true;return;}
  if(refilling){
   if(packets.length<refillFrames&&!ended){waiting=true;return;}
   refilling=false;missingEpisode=false;
  }
  if(packets.length){
   waiting=false;
   const packet=packets.shift();
   stats.playedPackets++;
   stream.push(packet);
   resume();
  }else if(ended){
   stream.push(null);
   cleanup();
  }else{
   waiting=true;refilling=true;
   if(!missingEpisode){missingEpisode=true;stats.underruns++;}
  }
 }
 function start(){
  if(started||closed)return;
  started=true;
  onReady();
  if(waiting)pump();
 }
 function onPacket(packet){
  if(closed||!Buffer.isBuffer(packet)||packet.length===0)return;
  packets.push(packet);
  stats.receivedPackets++;
  reportPeak();
  if(!started&&packets.length>=startupFrames)start();
  if(started&&waiting)pump();
  if(packets.length>=maxFrames&&!paused){paused=true;packetSource.pause();}
 }
 function onEnd(){
  if(closed)return;
  ended=true;
  if(!started)start();
  if(waiting)pump();
 }
 function onError(err){if(!closed)stream.destroy(err);}
 function cleanup(){
  if(closed)return;
  closed=true;
  packetSource.off('data',onPacket);
  packetSource.off('end',onEnd);
  packetSource.off('error',onError);
  packetSource.destroy();
  packets.length=0;
 }
 packetSource.on('data',onPacket);
 packetSource.once('end',onEnd);
 packetSource.once('error',onError);
 stream.once('close',cleanup);
 return{stream,stats,stop:()=>{cleanup();stream.destroy();}};
}
module.exports={bufferOpusRadio,FRAME_MS};
