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
 source.once('error',err=>{output.destroy(err);});
 return output;
}
module.exports={bufferPcm,BYTES_PER_SECOND};
