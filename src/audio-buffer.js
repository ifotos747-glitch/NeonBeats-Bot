'use strict';
const {PassThrough}=require('node:stream');
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
 * Live-radio PCM jitter buffer. Unlike a startup-only PassThrough, this buffer
 * paces the output at 20ms/frame for the lifetime of the station, preserving
 * queued radio PCM during bursty network delivery. On underrun it outputs
 * bounded silence and refills before resuming, instead of restarting FFmpeg.
 *
 * Memory remains bounded by pausing FFmpeg stdout. No audio URLs are stored.
 * The returned stats object is live and may be shown in /status.
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
 const output=new PassThrough({highWaterMark:RADIO_FRAME_BYTES*15});
 const stats={bufferedMs:0,peakBufferedMs:0,underruns:0,silenceMs:0,receivedBytes:0,playedBytes:0,lastPcmAt:0};
 let chunks=[],offset=0,buffered=0,started=false,ended=false,paused=false,blocked=false,recovering=false,underflow=false,closed=false;
 function reportBuffer(){
  stats.bufferedMs=Math.round(buffered*1000/BYTES_PER_SECOND);
  stats.peakBufferedMs=Math.max(stats.peakBufferedMs,stats.bufferedMs);
 }
 function resumeSource(){
  if(paused&&buffered<capBytes/2&&!ended){paused=false;source.resume();}
 }
 function take(size){
  const result=Buffer.alloc(size);
  let at=0;
  while(at<size&&chunks.length){
   const first=chunks[0];
   const amount=Math.min(size-at,first.length-offset);
   first.copy(result,at,offset,offset+amount);
   offset+=amount;at+=amount;buffered-=amount;
   if(offset===first.length){chunks.shift();offset=0;}
  }
  stats.playedBytes+=at;
  reportBuffer();resumeSource();
  return result;
 }
 function tick(){
  if(closed||!started||blocked)return;
  if(ended&&buffered===0){output.end();cleanup();return;}
  if(recovering){
   if(buffered>=recoveryBytes||(ended&&buffered>0)){
    recovering=false;underflow=false;
   }else{
    stats.silenceMs+=RADIO_FRAME_MS;
    blocked=!output.write(Buffer.alloc(RADIO_FRAME_BYTES));
    return;
   }
  }
  if(buffered<RADIO_FRAME_BYTES&&!ended){
   if(!underflow){stats.underruns++;underflow=true;}
   recovering=true;
   stats.silenceMs+=RADIO_FRAME_MS;
   blocked=!output.write(Buffer.alloc(RADIO_FRAME_BYTES));
   return;
  }
  if(buffered===0&&ended){output.end();cleanup();return;}
  blocked=!output.write(take(RADIO_FRAME_BYTES));
 }
 function start(){
  if(started||closed)return;
  started=true;
  onReady();
 }
 function onData(chunk){
  if(closed||!chunk?.length)return;
  chunks.push(chunk);buffered+=chunk.length;stats.receivedBytes+=chunk.length;stats.lastPcmAt=Date.now();
  reportBuffer();
  if(!started&&buffered>=threshold)start();
  if(buffered>=capBytes&&!paused){paused=true;source.pause();}
 }
 function onEnd(){ended=true;if(!started)start();}
 function onError(){ended=true;if(!started)start();}
 function onDrain(){blocked=false;}
 const timer=setInterval(tick,RADIO_FRAME_MS);
 timer.unref?.();
 function cleanup(){
  if(closed)return;
  closed=true;clearInterval(timer);
  source.off('data',onData);source.off('end',onEnd);source.off('error',onError);
  output.off('drain',onDrain);
  chunks=[];buffered=0;reportBuffer();
  if(paused&&!ended)source.resume();
 }
 source.on('data',onData);source.once('end',onEnd);source.once('error',onError);
 output.on('drain',onDrain);output.once('close',cleanup);
 if(startMs===0)process.nextTick(start);
 return {stream:output,stats,stop:()=>{cleanup();output.destroy();}};
}

module.exports={bufferPcm,bufferLivePcm,BYTES_PER_SECOND,RADIO_FRAME_MS,RADIO_FRAME_BYTES};
