'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {pipeHttpAudio}=require('./network');
const {spawnYouTube,cleanYtdlpError}=require('./youtube');
const {joinVoiceChannel,createAudioPlayer,createAudioResource,AudioPlayerStatus,VoiceConnectionStatus,NoSubscriberBehavior,StreamType,entersState}=require('@discordjs/voice');
const {MUSIC,ffmpegPath,IDLE_MINUTES}=require('./config');
const {musicFiles}=require('./media'),{filterFor}=require('./effects'),store=require('./store');
const sessions=new Map(),MAX_QUEUE=100;
function clean(s){return String(s||'Utwór').replace(/[\r\n\t*_<>@]/g,' ').slice(0,100);}
function errorText(s){return String(s||'').replace(/https?:\/\/[^\s]+/gi,'[URL]').replace(/[\r\n]+/g,' ').slice(-200);}
class MusicSession{
 constructor(guild,voiceChannel,textChannel){
  this.guildId=guild.id;this.channelId=voiceChannel.id;this.textChannel=textChannel;
  this.queue=[];this.current=null;this.volume=85;this.autodj=false;this.autodjIndex=0;
  this.alwaysOn=null;this.dj=store.read(guild.id).dj;
  this.process=null;this.ytProcess=null;this.netAbort=null;this.timer=null;this.retry=null;this.startupTimer=null;this.blockUntil=0;
  this.lastError='';this.closed=false;this.starting=false;this.retryCount=0;
  this.connection=joinVoiceChannel({channelId:voiceChannel.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});
  this.player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause}});
  this.connection.subscribe(this.player);
  this.player.on(AudioPlayerStatus.Idle,()=>this.onIdle());
  this.player.on('error',e=>this.fail('Discord Voice: '+e.message));
  this.connection.on('error',e=>this.fail('Połączenie głosowe: '+e.message));
  this.connection.on(VoiceConnectionStatus.Disconnected,()=>{
    if(this.closed)return;
    void Promise.race([entersState(this.connection,VoiceConnectionStatus.Signalling,5_000),entersState(this.connection,VoiceConnectionStatus.Connecting,5_000)])
      .catch(()=>{if(!this.closed&&this.connection.state.status===VoiceConnectionStatus.Disconnected)this.destroy();});
  });
 }
 announce(message){if(this.textChannel?.send)void this.textChannel.send({content:String(message).slice(0,1700),allowedMentions:{parse:[]}}).catch(()=>{});}
 clearTimer(){clearTimeout(this.timer);this.timer=null;}
 setRetry(ms){clearTimeout(this.retry);this.retry=setTimeout(()=>{this.retry=null;void this.startNext();},ms);this.retry.unref?.();}
 cleanProcess(){clearTimeout(this.startupTimer);this.startupTimer=null;
   if(this.netAbort){this.netAbort.abort();this.netAbort=null;}
   if(this.ytProcess){const yt=this.ytProcess;this.ytProcess=null;try{yt.kill('SIGKILL');}catch{}}
   if(this.process){const p=this.process;this.process=null;if(!p.killed)try{p.kill('SIGKILL');}catch{}}
 }
 chooseNext(){
  if(this.queue.length)return this.queue.shift();
  if(this.alwaysOn?.mode==='radio'){
    const st=store.read(this.guildId).radios.find(r=>r.id===this.alwaysOn.stationId);
    if(!st){this.announce('⚠️ Radio 24/7 nie istnieje — wyłączam tryb.');this.alwaysOn=null;store.set247(this.guildId,null);return null;}
    return{kind:'radio',source:st.url,title:st.name,stationId:st.id,continuous:true};
  }
  if(this.autodj||this.alwaysOn?.mode==='autodj'){
    const files=musicFiles();if(files.length){const f=files[this.autodjIndex++%files.length];return{kind:'file',source:f,title:f,continuous:true};}
  }
  return null;
 }
 enqueueMany(tracks){
  if(this.closed)throw Error('Bot nie jest połączony.');
  if(!Array.isArray(tracks)||tracks.length<1)throw Error('Playlista jest pusta.');
  if(this.queue.length+tracks.length>MAX_QUEUE)throw Error('Limit kolejki 100 utworów.');
  this.queue.push(...tracks);
  this.clearTimer();
  if(!this.current&&!this.starting){
   clearTimeout(this.retry);this.retry=null;void this.startNext();
  }else if(this.current?.continuous)this.skip();
  return tracks.length;
 }
 enqueue(track){
  if(this.closed)throw Error('Bot nie jest połączony.');
  if(this.queue.length>=MAX_QUEUE)throw Error('Kolejka osiągnęła limit 100.');
  this.queue.push(track);this.clearTimer();
  if(!this.current&&!this.starting){clearTimeout(this.retry);this.retry=null;void this.startNext();}
  else if(this.current?.continuous)this.skip();
  return this.queue.length;
 }
 replace(track){this.queue=[track];this.autodj=false;this.blockUntil=0;this.clearTimer();
   clearTimeout(this.retry);this.retry=null;if(this.current)this.skip();else void this.startNext();}
 skip(){if(!this.current)return false;this.cleanProcess();if(!this.player.stop(true))this.onIdle();return true;}
 pause(){return this.player.pause();}
 resume(){return this.player.unpause();}
 setVolume(percent){this.volume=percent;if(this.resource?.volume)this.resource.volume.setVolume(percent/100);}
 setDJ(preset){this.dj=preset;if(this.current){this.queue.unshift({...this.current});this.skip();return true;}return false;}
 stop(){this.queue=[];this.autodj=false;this.alwaysOn=null;this.blockUntil=0;clearTimeout(this.retry);this.retry=null;this.clearTimer();if(this.current)this.skip();}
 onIdle(){if(this.closed)return;this.cleanProcess();this.resource=null;this.current=null;if(!this.starting)void this.startNext();}
 fail(message){
  if(this.closed)return;
  this.lastError=errorText(message);console.error('[NEON AUDIO '+this.guildId+'] '+this.lastError);
  this.announce('⚠️ NeonBeats — błąd audio: '+this.lastError);this.cleanProcess();
  this.retryCount=Math.min(6,this.retryCount+1);
  const delay=Math.min(60_000,3000*2**Math.min(4,this.retryCount));
  if(this.current?.continuous)this.blockUntil=Date.now()+delay;
  if(!this.player.stop(true))this.onIdle();
 }
 async startNext(){
  if(this.closed||this.starting||this.current)return;
  this.starting=true;
  try{
   this.clearTimer();clearTimeout(this.retry);this.retry=null;
   if(!this.queue.length&&this.blockUntil&&Date.now()<this.blockUntil){this.setRetry(this.blockUntil-Date.now());return;}
   const item=this.chooseNext();
   if(!item){
    if(this.alwaysOn?.mode==='autodj'||this.autodj){this.setRetry(30_000);return;}
    if(this.alwaysOn?.mode==='silent')return;
    this.timer=setTimeout(()=>this.destroy(),IDLE_MINUTES*60_000);this.timer.unref?.();return;
   }
   this.current=item;
   await entersState(this.connection,VoiceConnectionStatus.Ready,20_000);
   if(this.closed||this.current!==item)return;
   this.beginPlayback(item);
  }catch(e){this.fail('Nie można rozpocząć muzyki: '+e.message);}
  finally{this.starting=false;
    if(!this.closed&&!this.current&&!this.retry&&!this.timer&&(this.queue.length||this.autodj||this.alwaysOn?.mode==='radio'||this.alwaysOn?.mode==='autodj'))
      setImmediate(()=>void this.startNext());
  }
 }
 async feedNetwork(track,child){
  const controller=new AbortController();
  this.netAbort=controller;
  // Header timeout only; live audio is intentionally streamed indefinitely.
  const deadline=setTimeout(()=>controller.abort(),16000);
  deadline.unref?.();
  try{
   await pipeHttpAudio(track.source,child.stdin,{signal:controller.signal,onConnected:()=>clearTimeout(deadline)});
  }catch(err){
   if(!this.closed&&this.process===child){
    const reason=controller.signal.aborted?'upłynął limit połączenia HTTP':errorText(err?.message||err);
    this.fail('Pobieranie radia: '+reason);
   }
  }finally{
   clearTimeout(deadline);
   if(this.netAbort===controller)this.netAbort=null;
  }
 }
 feedYouTube(track,child){
  let yt;
  try{yt=spawnYouTube(track.source);}
  catch(err){this.fail('YouTube: '+errorText(err.message));return;}
  this.ytProcess=yt;
  let transferred=0,stderr='';
  yt.stdout.on('data',b=>{transferred+=b.length;});
  yt.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-3500);});
  yt.stdout.pipe(child.stdin);
  child.stdin.on('error',()=>{});
  yt.once('error',err=>{
   if(this.ytProcess===yt&&this.process===child)this.fail('yt-dlp: '+(err.code||err.message));
  });
  yt.once('close',(code,signal)=>{
   if(this.ytProcess!==yt||this.process!==child||this.closed)return;
   this.ytProcess=null;
   if(code!==0||transferred===0){
    this.fail('YouTube: '+cleanYtdlpError(stderr)+' (kod: '+(code??'brak')+', sygnał: '+(signal||'brak')+')');
   }
  });
 }
 beginPlayback(track){
  // Avoid FFmpeg's network reader (SIGSEGV on some hosts) for MP3/AAC-style radio.
  // Preserve native FFmpeg handling of HLS/playlist manifests.
  const viaYouTube=track.kind==='youtube-link';
  const viaNode=track.kind!=='file'&&!viaYouTube&&!/\.(?:m3u8|m3u|pls)(?:$|[?#])/i.test(track.source);
  const input=track.kind==='file'?['-i',path.join(MUSIC,track.source)]
    :(viaNode||viaYouTube)?['-i','pipe:0']
    :['-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','4','-rw_timeout','15000000','-i',track.source];
  const filter=filterFor(this.dj);
  const args=['-nostdin','-hide_banner','-loglevel','error',...input,'-vn','-sn','-dn',...(filter?['-af',filter]:[]),
    '-ac','2','-ar','48000','-f','s16le','pipe:1'];
  const child=spawn(ffmpegPath(),args,{stdio:[(viaNode||viaYouTube)?'pipe':'ignore','pipe','pipe'],windowsHide:true});
  this.process=child;let bytes=0,stderr='';
  child.stdout.on('data',b=>{bytes+=b.length;});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-1300);});
  child.once('error',e=>{if(this.process===child)this.fail('FFmpeg: '+(e.code||e.message));});
  child.once('close',(code,signal)=>{
    if(this.closed||this.process!==child||child.killed)return;
    if(code!==0||bytes===0)this.fail('FFmpeg: '+(errorText(stderr)||('brak danych audio (kod: '+(code===null?'brak':code)+', sygnał: '+(signal||'brak')+', bajty: '+bytes+')')));
    else this.retryCount=0;
  });
  this.resource=createAudioResource(child.stdout,{inputType:StreamType.Raw,inlineVolume:true,metadata:track});
  this.resource.volume.setVolume(this.volume/100);
  this.player.play(this.resource);
  if(viaNode)void this.feedNetwork(track,child);
  if(viaYouTube)this.feedYouTube(track,child);
  this.announce('🎶 NeonBeats teraz gra: '+clean(track.title)+' · DJ: '+this.dj);
  // YouTube extraction can take longer than direct local/radio audio.
  const startupLimit=viaYouTube?90_000:30_000;
  this.startupTimer=setTimeout(()=>{
    if(this.current===track&&this.player.state.status!==AudioPlayerStatus.Playing)
      this.fail(viaYouTube?'YouTube: nie uruchomiono audio w 90 sekundach. Sprawdź /youtube diagnoza.':'Dźwięk nie wystartował w 30 sekund.');
  },startupLimit);this.startupTimer.unref?.();
  this.player.once(AudioPlayerStatus.Playing,()=>{clearTimeout(this.startupTimer);this.startupTimer=null;this.retryCount=0;});
 }
 destroy(){if(this.closed)return;this.closed=true;this.clearTimer();clearTimeout(this.retry);this.cleanProcess();
   this.queue=[];this.player.stop(true);this.connection.destroy();sessions.delete(this.guildId);}
}
function ensureSession(guild,voiceChannel,textChannel){
 let s=sessions.get(guild.id);if(s?.closed){sessions.delete(guild.id);s=null;}
 if(s&&s.channelId!==voiceChannel.id)throw Error('NeonBeats gra na innym kanale głosowym — dołącz do niego.');
 if(!s){s=new MusicSession(guild,voiceChannel,textChannel);sessions.set(guild.id,s);}
 s.textChannel=textChannel;return s;
}
module.exports={MusicSession,sessions,ensureSession,clean,MAX_QUEUE};
