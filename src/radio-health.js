'use strict';

// Input-side observations. These are not proof of packet loss: backpressure from
// a full decoded PCM buffer can also delay reading a healthy HTTP stream.
class RadioHealth {
 constructor(now=Date.now){
  this.now=now;
  this.httpBytes=0;
  this.httpChunks=0;
  this.lastChunkAt=null;
  this.longGaps=0;
  this.veryLongGaps=0;
  this.maxReadGapMs=0;
  this.ffmpegWarnings=0;
  this.lastWarning='';
  this.lineBuffer='';
 }
 onChunk(size){
  if(!Number.isFinite(size)||size<=0)return;
  const now=this.now();
  if(this.lastChunkAt!==null){
   const gap=Math.max(0,now-this.lastChunkAt);
   this.maxReadGapMs=Math.max(this.maxReadGapMs,gap);
   if(gap>=500)this.longGaps++;
   if(gap>=2000)this.veryLongGaps++;
  }
  this.lastChunkAt=now;
  this.httpBytes+=size;this.httpChunks++;
 }
 onFFmpegData(chunk){
  this.lineBuffer=(this.lineBuffer+String(chunk)).slice(-1600);
  let end;
  while((end=this.lineBuffer.indexOf('\n'))!==-1){
   const line=this.lineBuffer.slice(0,end).trim();
   this.lineBuffer=this.lineBuffer.slice(end+1);
   this.inspectLine(line);
  }
 }
 inspectLine(line){
  if(!/(?:error|invalid|corrupt|header missing|illegal|overread|decod|packet|missing frame)/i.test(line))return;
  this.ffmpegWarnings++;
  this.lastWarning=line
   .replace(/https?:\/\/\S+/gi,'[URL]')
   .replace(/(?:authorization|cookie|set-cookie|x-api-key)\s*:\s*\S+/gi,'[UKRYTO]')
   .replace(/[\r\n<>@`]/g,' ').slice(0,135);
 }
 snapshot(){
  return {
   httpBytes:this.httpBytes,httpChunks:this.httpChunks,
   readGaps500:this.longGaps,readGaps2000:this.veryLongGaps,
   maxReadGapMs:this.maxReadGapMs,
   decoderWarnings:this.ffmpegWarnings,lastDecoderWarning:this.lastWarning
  };
 }
}
module.exports={RadioHealth};
