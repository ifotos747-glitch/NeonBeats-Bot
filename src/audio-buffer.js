'use strict';
const {PassThrough,Readable}=require('node:stream');
// FFmpeg outputs 48 kHz stereo signed 16-bit PCM (192000 bytes/s).
// Hold a short amount of decoded audio before voice playback to cushion network jitter.
const BYTES_PER_SECOND=48000*2*2;
function bufferPcm(source,onReady,{milliseconds=1800}={}){
 const threshold=Math.min(BYTES_PER_SECOND*5,Math.max(0,Math.floor(milliseconds*BYTES_PER_SECOND/1000)));
 const output=new PassThrough({highWaterMark:BYTES_PER_SECOND*8});
 let received=0,started=false;
 function start(){if(started)return;started=true;onReady();}
 source.on('data',chunk=>{
  received+=chunk.length;
  if(!output.write(chunk))source.pause();
  if(received>=threshold)start();
 });
 output.on('drain',()=>source.resume());
 source.once('end',()=>{output.end();start();});
 source.once('error',()=>{output.end();start();});
 return output;
}

/**
 * A demand-driven PCM reservoir for live radio.
 *
 * Discord Voice already requests a 20ms frame roughly every 20ms. Adding
 * another setInterval(20ms) clock caused asynchronous frame scheduling and
 * intermittent empty reads despite a full PCM buffer. A Readable _read()
 * now supplies frames when the consumer needs them.
 *
 * Input backpressure limits decoded PCM held in memory. A short dropout is
 * reported here; Discord Voice supplies its own silence packets while the
 * reservoir refills. No extra audio clock is created.
 */
const RADIO_FRAME_MS=20;
const RADIO_FRAME_BYTES=BYTES_PER_SECOND*RADIO_FRAME_MS/1000;
function bufferLivePcm(source,onReady,{milliseconds=1000,recoveryMs=400,maxMs=6000}={}){
 const startMs=Math.max(0,Math.min(3000,Math.round(Number(milliseconds)||0)));
 const recovery=Math.max(100,Math.min(1200,Math.round(Number(recoveryMs)||400)));
 const cap=Math.max(startMs+500,Math.min(10000,Math.round(Number(maxMs)||6000)));
 const threshold=Math.floor(startMs*BYTES_PER_SECOND/1000);
 const recoveryBytes=Math.floor(recovery*BYTES_PER_SECOND/1000);
 const capBytes=Math.floor(cap*BYTES_PER_SECOND/1000);
 const stats={bufferedMs:0,peakBufferedMs:0,underruns:0,silenceMs:0,receivedBytes:0,playedBytes:0,lastPcmAt:0};
 let chunks=[],offset=0,buffered=0,started=false,ended=false,paused=false;
 let recovering=false,underflow=false,waiting=false,closed=false;
 const output=new Readable({highWaterMark:RADIO_FRAME_BYTES*4,read(){pump();}});
 function reportBuffer(){
  stats.bufferedMs=Math.round(buffered*1000/BYTES_PER_SECOND);
  stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);
 }
 function resumeSource(){
  if(paused&&!ended&&buffered<capBytes/2){paused=false;source.resume();}
 }
 function take(size){
  const result=Buffer.alloc(size);
  let at=0;
  while(at<size&&chunks.length){
   const first=chunks[0],amount=Math.min(size-at,first.length-offset);
   first.copy(result,at,offset,offset+amount);
   offset+=amount;at+=amount;buffered-=amount;
   if(offset===first.length){chunks.shift();offset=0;}
  }
  stats.playedBytes+=at;
  reportBuffer();resumeSource();
  return result;
 }
 function pump(){
  if(closed)return;
  if(!started){waiting=true;return;}
  if(recovering){
   if(buffered<recoveryBytes&&!ended){waiting=true;return;}
   recovering=false;underflow=false;
  }
  if(buffered>=RADIO_FRAME_BYTES){
   waiting=false;
   output.push(take(RADIO_FRAME_BYTES));
   return;
  }
  if(ended){
   if(buffered>0)output.push(take(buffered));
   output.push(null);
   cleanup();
   return;
  }
  // The voice player, rather than a competing timer, handles silence packets.
  if(!underflow){
   underflow=true;stats.underruns++;
   stats.silenceMs+=RADIO_FRAME_MS; // lower bound, not an exact duration
  }
  recovering=true;waiting=true;
 }
 function start(){
  if(closed||started)return;
  started=true;
  onReady();
  if(waiting)pump();
 }
 function onData(chunk){
  if(closed||!chunk?.length)return;
  chunks.push(chunk);buffered+=chunk.length;stats.receivedBytes+=chunk.length;stats.lastPcmAt=Date.now();
  reportBuffer();
  if(!started&&buffered>=threshold)start();
  if(started&&waiting)pump();
  if(buffered>=capBytes&&!paused){paused=true;source.pause();}
 }
 function onEnd(){
  ended=true;
  if(!started)start();
  if(waiting)pump();
 }
 function onError(){onEnd();}
 function cleanup(){
  if(closed)return;
  closed=true;
  source.off('data',onData);
  source.off('end',onEnd);
  source.off('error',onError);
  output.off('close',cleanup);
  chunks=[];buffered=0;reportBuffer();
  if(paused&&!ended)source.resume();
 }
 source.on('data',onData);
 source.once('end',onEnd);
 source.once('error',onError);
 output.once('close',cleanup);
 if(startMs===0)process.nextTick(start);
 return{stream:output,stats,stop:()=>{cleanup();output.destroy();}};
}

module.exports={bufferPcm,bufferLivePcm,BYTES_PER_SECOND,RADIO_FRAME_MS,RADIO_FRAME_BYTES};
