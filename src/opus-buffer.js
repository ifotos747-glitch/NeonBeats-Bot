'use strict';
const {Readable}=require('node:stream');
const prism=require('prism-media');

// FFmpeg emits Ogg/Opus with an explicit 20 ms frame duration; demuxed
// packets can go directly to Discord Voice without any JS Opus re-encoding.
// Buffer Opus packets rather than raw bytes, so starts only after whole frames.
const FRAME_MS=20;
function bufferOpusRadio(source,onReady,{milliseconds=2000,maxMs=6000}={}){
 const startupFrames=Math.max(1,Math.min(150,Math.ceil(Number(milliseconds||0)/FRAME_MS)));
 const maxFrames=Math.max(startupFrames+25,Math.min(500,Math.ceil(Number(maxMs||6000)/FRAME_MS)));
 const demux=new prism.opus.OggDemuxer();
 const stats={bufferedMs:0,peakBufferedMs:0,underruns:0,receivedPackets:0,playedPackets:0};
 const packets=[];
 let started=false,waiting=false,ended=false,paused=false,closed=false,underflow=false;
 const out=new Readable({objectMode:true,highWaterMark:4,read(){pump();}});
 function report(){stats.bufferedMs=packets.length*FRAME_MS;stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);}
 function resume(){
  if(paused&&!ended&&packets.length<maxFrames/2){paused=false;demux.resume();}
 }
 function pump(){
  if(closed)return;
  if(!started){waiting=true;return;}
  if(packets.length){
   waiting=false;underflow=false;
   out.push(packets.shift());
   stats.playedPackets++;report();resume();
  }else if(ended){
   out.push(null);cleanup();
  }else{
   waiting=true;
   if(!underflow){underflow=true;stats.underruns++;}
  }
 }
 function start(){
  if(closed||started)return;
  started=true;
  onReady();
  if(waiting)pump();
 }
 function onPacket(packet){
  if(closed||!packet?.length)return;
  packets.push(packet);stats.receivedPackets++;report();
  if(!started&&packets.length>=startupFrames)start();
  if(started&&waiting)pump();
  if(packets.length>=maxFrames&&!paused){paused=true;demux.pause();}
 }
 function onEnd(){ended=true;if(!started)start();if(waiting)pump();}
 function onError(error){if(!closed)out.destroy(error);}
 function cleanup(){
  if(closed)return;
  closed=true;source.unpipe(demux);
  demux.off('data',onPacket);demux.off('end',onEnd);demux.off('error',onError);
  packets.length=0;report();
  demux.destroy();
 }
 demux.on('data',onPacket);demux.once('end',onEnd);demux.once('error',onError);
 out.once('close',cleanup);
 source.pipe(demux);
 return{stream:out,stats,stop:()=>{cleanup();out.destroy();}};
}
module.exports={bufferOpusRadio,FRAME_MS};
