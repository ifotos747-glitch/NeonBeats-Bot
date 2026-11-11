'use strict';
const {spawn}=require('node:child_process');
const {ffmpegPath}=require('./config');
const {validatePublicUrl}=require('./media');

function redactFFmpeg(raw) {
 return String(raw||'')
  .replace(/\x1b\[[0-9;]*m/g,'')
  .replace(/https?:\/\/[^\s"'<>]+/gi,'[UKRYTY_URL]')
  .replace(/\b(authorization|cookie|set-cookie|x-api-key)\s*:\s*[^\r\n]*/gi,'$1: [UKRYTO]')
  .replace(/\bBearer\s+[a-z0-9._~+/-]+/gi,'Bearer [UKRYTO]')
  .replace(/[@<>\x60]/g,' ')
  .replace(/\r/g,'\n')
  .split('\n').map(s=>s.trim().slice(0,230)).filter(Boolean)
  .slice(-8).join('\n').slice(-1400);
}

function diagnoseStream(rawUrl,{spawnProcess=spawn,timeoutMs=20000}={}) {
 const url=validatePublicUrl(rawUrl).href;
 return new Promise(resolve=>{
  let bytes=0,stderr='',done=false,timedOut=false,timer=null;
  const finish=(exitCode,signal,err)=>{
   if(done)return;
   done=true;clearTimeout(timer);
   resolve({
    ok:bytes>0,bytes,exitCode,signal,timedOut,
    error:err?String(err.code||err.message||err).slice(0,100):'',
    details:redactFFmpeg(stderr)
   });
  };
  let child;
  try{
   child=spawnProcess(ffmpegPath(),[
    '-nostdin','-hide_banner','-loglevel','info',
    '-rw_timeout','12000000','-i',url,
    '-t','5','-vn','-sn','-dn',
    '-ac','2','-ar','48000','-f','s16le','pipe:1'
   ],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  }catch(err){finish(null,null,err);return;}
  child.stdout?.on('data',chunk=>{bytes+=chunk.length;});
  child.stderr?.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-12000);});
  child.once('error',err=>finish(null,null,err));
  child.once('close',(code,signal)=>finish(code,signal,null));
  timer=setTimeout(()=>{timedOut=true;try{child.kill('SIGKILL');}catch(err){finish(null,null,err);}},timeoutMs);
  timer.unref?.();
 });
}
function formatDiagnostic(name,r){
 const safeName=String(name||'stacja').replace(/[@<>\x60\r\n]/g,' ').slice(0,70);
 const state=r.ok?'✅ Odebrano dane audio':'❌ Nie odebrano danych audio';
 let body='🔎 Diagnostyka radia: '+safeName+'\n'+state+
  '\nDane PCM: '+r.bytes+' bajtów'+
  '\nKod FFmpeg: '+(r.exitCode===null?'brak':r.exitCode)+
  (r.timedOut?'\n⏱️ Przekroczono limit 20 sekund':'')+
  (r.error?'\nBłąd procesu: '+r.error:'')+
  (r.details?'\n\nSzczegóły FFmpeg:\n'+r.details:'\n\nFFmpeg nie zwrócił dodatkowego opisu.');
 return body.slice(0,1850);
}
module.exports={diagnoseStream,formatDiagnostic,redactFFmpeg};
