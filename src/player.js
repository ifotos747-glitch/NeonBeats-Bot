'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {randomInt}=require('node:crypto');
const {pipeHttpAudio}=require('./network');
const {RadioHealth}=require('./radio-health');
const {bufferPcm,bufferLivePcm}=require('./audio-buffer');
const {bufferOpusRadio}=require('./opus-buffer');
const {spawnYouTube,cleanYtdlpError,selectAudioProfile,isPyInstallerError}=require('./youtube');
const {joinVoiceChannel,createAudioPlayer,createAudioResource,AudioPlayerStatus,VoiceConnectionStatus,NoSubscriberBehavior,StreamType,entersState}=require('@discordjs/voice');
const {MUSIC,ffmpegPath,IDLE_MINUTES}=require('./config');
const {musicFiles}=require('./media'),{filterFor}=require('./effects'),store=require('./store'),radio=require('./global-radio');
const sessions=new Map(),MAX_QUEUE=100;
// Discord Voice normally stops after five missed 20ms packets (~100ms).
// Live HTTP radio can legitimately stall for a fraction of a second.
const MAX_MISSED_FRAMES=100; // 2 seconds of recoverable silence, without tearing down voice.
const RADIO_RETRY_WINDOW_MS=120000;
function retryRadioTrack(track,at=Date.now()){
 if(!track||!['radio','stream'].includes(track.kind)||track.continuous)return null;
 const windowAt=Number(track.radioRetryWindowAt)||at;
 const reset=at-windowAt>=RADIO_RETRY_WINDOW_MS;
 const attempts=reset?0:(Number(track.reconnectRetries)||0);
 if(attempts>=3)return null;
 return {...track,reconnectRetries:attempts+1,radioRetryWindowAt:reset?at:windowAt};
}
function audioBufferMs(track,env=process.env){
 const radio=['radio','stream'].includes(track?.kind);
 const key=radio?'NEONBEATS_RADIO_PREBUFFER_MS':'NEONBEATS_PREBUFFER_MS';
 const raw=env[key]??(radio?'1000':env.NEONBEATS_PREBUFFER_MS);
 const n=Number(raw);
 return Number.isFinite(n)?Math.max(0,Math.min(radio?3000:800,Math.round(n))):(radio?1000:280);
}
function radioCodec(env=process.env){return String(env.NEONBEATS_RADIO_CODEC||'pcm').trim().toLowerCase()==='opus'?'opus':'pcm';}
function shouldRetryYouTube(track,message){
 if(track?.kind!=='youtube-link'||(track.compatRetries||0)>=2)return false;
 if(isPyInstallerError(message)||/rozpakować bibliotek|\bPYI\b|\bkod:\s*255\b/i.test(String(message||'')))return false;
 return !/(?:sign in|log ?in|not a bot|cookie|private|deleted|copyright|drm|not available|unavailable|403|404|members.only|age.restricted|unsupported url)/i.test(String(message||''));
}
function clean(s){return String(s||'Utwór').replace(/[\r\n\t*_<>@]/g,' ').slice(0,100);}
function errorText(s){return String(s||'').replace(/https?:\/\/[^\s]+/gi,'[URL]').replace(/[\r\n]+/g,' ').slice(-200);}
class MusicSession{
 constructor(guild,voiceChannel,textChannel){
  this.guildId=guild.id;this.channelId=voiceChannel.id;this.textChannel=textChannel;
  this.queue=[];this.current=null;this.volume=85;this.autodj=false;this.autodjIndex=0;
  this.alwaysOn=null;this.dj=store.read(guild.id).dj;
  this.process=null;this.ytProcess=null;this.netAbort=null;this.radioBuffer=null;this.radioStats=null;this.radioHealth=null;this.radioOpus=false;this.nativeOpusFailed=false;this.timer=null;this.retry=null;this.startupTimer=null;this.watchdog=null;this.blockUntil=0;
  this.lastError='';this.closed=false;this.starting=false;this.retryCount=0;
  this.panelFactory=null;this.panelMessage=null;this.panelChannelId=null;this.panelUpdate=null;this.panelDirty=false;this.panelLastEdit=0;
  this.repeatMode='off';this.skipRequested=false;this.playedCount=0;this.playingSince=0;
  this.connection=joinVoiceChannel({channelId:voiceChannel.id,guildId:guild.id,adapterCreator:guild.voiceAdapterCreator,selfDeaf:true,selfMute:false});
  this.player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause,maxMissedFrames:MAX_MISSED_FRAMES}});
  this.connection.subscribe(this.player);
  this.player.on(AudioPlayerStatus.Idle,()=>this.onIdle());
  this.player.on(AudioPlayerStatus.Playing,()=>{
   clearTimeout(this.startupTimer);this.startupTimer=null;this.playingSince=Date.now();
   if(this.current){this.playedCount++;void this.showControlPanel(this.current);}
  });
  this.player.on('error',e=>this.fail('Discord Voice: '+e.message));
  this.connection.on('error',e=>this.fail('Połączenie głosowe: '+e.message));
  this.connection.on(VoiceConnectionStatus.Disconnected,()=>{
    if(this.closed)return;
    void Promise.race([entersState(this.connection,VoiceConnectionStatus.Signalling,12_000),entersState(this.connection,VoiceConnectionStatus.Connecting,12_000)])
      .catch(()=>{if(!this.closed&&this.connection.state.status===VoiceConnectionStatus.Disconnected)this.destroy();});
  });
 }
 showControlPanel(track){
  if(!this.panelFactory||!this.textChannel?.send)return Promise.resolve();
  // Batch rapid changes into the latest state instead of accumulating an
  // unbounded chain of Discord message edits (and hitting REST rate limits).
  this.panelDirty=true;
  if(this.panelUpdate)return this.panelUpdate;
  this.panelUpdate=(async()=>{
   while(this.panelDirty&&!this.closed){
    this.panelDirty=false;
    const wait=Math.max(0,800-(Date.now()-this.panelLastEdit));
    if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    if(this.closed)return;
    const channel=this.textChannel;
    if(!channel?.send)continue;
    const payload=this.panelFactory(this.current,this);
    if(this.panelMessage&&this.panelChannelId===channel.id){
     try{await this.panelMessage.edit(payload);this.panelLastEdit=Date.now();continue;}
     catch{this.panelMessage=null;}
    }
    const message=await channel.send({...payload,allowedMentions:{parse:[]}});
    if(this.closed)return;
    this.panelMessage=message;this.panelChannelId=channel.id;this.panelLastEdit=Date.now();
   }
  })().catch(err=>console.warn('[NEON PANEL] '+String(err?.message||err).slice(0,150)))
    .finally(()=>{this.panelUpdate=null;if(this.panelDirty&&!this.closed)void this.showControlPanel(this.current);});
  return this.panelUpdate;
 }
 announce(message){if(this.textChannel?.send)void this.textChannel.send({content:String(message).slice(0,1700),allowedMentions:{parse:[]}}).catch(()=>{});}
 clearTimer(){clearTimeout(this.timer);this.timer=null;}
 setRetry(ms){clearTimeout(this.retry);this.retry=setTimeout(()=>{this.retry=null;void this.startNext();},ms);this.retry.unref?.();}
 cleanProcess(){clearTimeout(this.startupTimer);this.startupTimer=null;
   if(this.radioBuffer){this.radioBuffer.stop();this.radioBuffer=null;}
   clearInterval(this.watchdog);this.watchdog=null;
   if(this.netAbort){this.netAbort.abort();this.netAbort=null;}
   if(this.ytProcess){const yt=this.ytProcess;this.ytProcess=null;try{yt.kill('SIGKILL');}catch{}}
   if(this.process){const p=this.process;this.process=null;if(!p.killed)try{p.kill('SIGKILL');}catch{}}
 }
 chooseNext(){
  if(this.queue.length)return this.queue.shift();
  if(this.alwaysOn?.mode==='radio'){
    const st=radio.find(this.alwaysOn.stationId);
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
  if(this.current)void this.showControlPanel(this.current);
  if(!this.current&&!this.starting){
   clearTimeout(this.retry);this.retry=null;void this.startNext();
  }else if(this.current?.continuous)this.skip();
  return tracks.length;
 }
 enqueue(track){
  if(this.closed)throw Error('Bot nie jest połączony.');
  if(this.queue.length>=MAX_QUEUE)throw Error('Kolejka osiągnęła limit 100.');
  this.queue.push(track);this.clearTimer();
  if(this.current)void this.showControlPanel(this.current);
  if(!this.current&&!this.starting){clearTimeout(this.retry);this.retry=null;void this.startNext();}
  else if(this.current?.continuous)this.skip();
  return this.queue.length;
 }
 replace(track){this.queue=[track];this.autodj=false;this.blockUntil=0;this.clearTimer();
   clearTimeout(this.retry);this.retry=null;if(this.current)this.skip();else void this.startNext();}
 skip(){if(!this.current)return false;this.skipRequested=true;this.cleanProcess();if(!this.player.stop(true))this.onIdle();return true;}
 pause(){const ok=this.player.pause();if(ok)void this.showControlPanel(this.current);return ok;}
 resume(){const ok=this.player.unpause();if(ok)void this.showControlPanel(this.current);return ok;}
 setVolume(percent){
  this.volume=percent;
  if(this.resource?.volume)this.resource.volume.setVolume(percent/100);
  else if(this.radioOpus&&this.current){
   // In Opus radio mode FFmpeg applies volume before encoding. Restart the
   // current station so live volume controls remain functional.
   if(!this.current.continuous)this.queue.unshift({...this.current});
   this.skip();
  }
  void this.showControlPanel(this.current);
 }
 toggleRepeat(){this.repeatMode=this.repeatMode==='one'?'off':'one';void this.showControlPanel(this.current);return this.repeatMode;}
 shuffleQueue(){
  if(this.queue.length<2)return false;
  for(let i=this.queue.length-1;i>0;i--){const j=randomInt(i+1);[this.queue[i],this.queue[j]]=[this.queue[j],this.queue[i]];}
  void this.showControlPanel(this.current);return true;
 }
 setDJ(preset){this.dj=preset;if(this.current){this.queue.unshift({...this.current});this.skip();return true;}return false;}
 stop(){this.queue=[];this.autodj=false;this.alwaysOn=null;this.repeatMode='off';this.blockUntil=0;clearTimeout(this.retry);this.retry=null;this.clearTimer();if(this.current)this.skip();else void this.showControlPanel(null);}
 onIdle(){
  if(this.closed)return;
  const previous=this.current,skipped=this.skipRequested;
  this.skipRequested=false;
  if(previous&&this.repeatMode==='one'&&!skipped&&!previous.continuous&&!['radio','stream'].includes(previous.kind)){
   this.queue.unshift({...previous,compatRetries:0});
  }else if(previous&&!skipped&&['radio','stream'].includes(previous.kind)){
   // Short dropouts can exhaust Discord's incoming frames without an HTTP error.
   // The station must reconnect even if FFmpeg exits cleanly.
   if(previous.continuous){
    if(this.playingSince&&Date.now()-this.playingSince>90000)this.retryCount=0;
    this.retryCount=Math.min(6,this.retryCount+1);
    this.blockUntil=Date.now()+Math.min(45000,1500*2**Math.min(4,this.retryCount));
   }else{
    const next=retryRadioTrack(previous);
    if(next){this.queue.unshift(next);this.blockUntil=Date.now()+next.reconnectRetries*2000;}
    else this.announce('⚠️ Radio: przerwy w sygnale powtarzają się. Sprawdź adres stacji lub /radio diagnoza.');
   }
  }
  this.cleanProcess();this.resource=null;this.current=null;this.playingSince=0;
  if(!this.starting)void this.startNext();
 }
 fail(message){
  if(this.closed)return;
  this.lastError=errorText(message);console.error('[NEON AUDIO '+this.guildId+'] '+this.lastError);
  if(this.radioOpus&&!this.nativeOpusFailed&&/^(?:FFmpeg:|Discord Voice:|Dźwięk nie wystartował)/.test(String(message))){
   this.nativeOpusFailed=true;
   this.announce('⚠️ Eksperymentalna ścieżka Opus nie działa na tym hostingu — wracam do trybu PCM.');
  }
  this.announce('⚠️ NeonBeats — błąd audio: '+this.lastError);
  const item=this.current;
  if(shouldRetryYouTube(item,message)){
   const attempt=(item.compatRetries||0)+1;
   this.queue.unshift({...item,compatRetries:attempt});
   this.announce('🔄 YouTube: ponawiam '+attempt+'/2 z alternatywnym formatem audio: '+clean(item.title));
   this.blockUntil=Date.now()+attempt*2000;
  }else if(item&&['radio','stream'].includes(item.kind)&&!item.continuous){
   const next=retryRadioTrack(item);
   if(next){
    this.queue.unshift(next);
    this.blockUntil=Date.now()+next.reconnectRetries*2500;
    this.announce('🔄 Radio: próba ponownego połączenia '+next.reconnectRetries+'/3: '+clean(item.title));
   }
  }
  this.skipRequested=true;
  this.cleanProcess();
  if(item?.continuous&&this.playingSince&&Date.now()-this.playingSince>90000)this.retryCount=0;
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
   if(this.blockUntil&&Date.now()<this.blockUntil){this.setRetry(this.blockUntil-Date.now());return;}
   const item=this.chooseNext();
   if(!item){
    if(this.alwaysOn?.mode==='autodj'||this.autodj){this.setRetry(30_000);return;}
    if(this.alwaysOn?.mode==='silent')return;
    void this.showControlPanel(null);
   this.timer=setTimeout(()=>this.destroy(),IDLE_MINUTES*60_000);this.timer.unref?.();return;
   }
   this.current=item;
   this.skipRequested=false;
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
   await pipeHttpAudio(track.source,child.stdin,{signal:controller.signal,onConnected:()=>clearTimeout(deadline),
    onChunk:size=>{if(!this.closed&&this.current===track&&this.process===child)this.radioHealth?.onChunk(size);}});
   // Some Icecast/Shoutcast servers end the HTTP stream with a successful EOF.
   // For live radio that is a disconnect, not a completed song.
   if(!controller.signal.aborted&&!this.closed&&this.current===track&&this.process===child)
    this.fail('Radio: serwer stacji zamknął strumień audio.');
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
  try{yt=spawnYouTube(track.source,{profile:selectAudioProfile(track.compatRetries||0)});}
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
  const liveRadio=track.kind==='radio'||track.kind==='stream';
  const opusRadio=liveRadio&&radioCodec()==='opus'&&!this.nativeOpusFailed;
  this.radioOpus=opusRadio;
  const viaNode=track.kind!=='file'&&!viaYouTube&&!/\.(?:m3u8|m3u|pls)(?:$|[?#])/i.test(track.source);
  const input=track.kind==='file'?['-i',path.join(MUSIC,track.source)]
    :(viaNode||viaYouTube)?['-i','pipe:0']
    :['-reconnect','1','-reconnect_streamed','1','-reconnect_delay_max','4','-rw_timeout','15000000','-i',track.source];
  const premium=require('./premium');
  const allowedDJ=premium.PREMIUM_DJ.has(this.dj)&&!premium.status(this.guildId).active?'off':this.dj;
  const filter=filterFor(allowedDJ);
  const radioFilter=opusRadio?[filter,'volume='+Math.max(0,Math.min(1.5,this.volume/100)).toFixed(3)].filter(Boolean).join(','):filter;
  const outputArgs=opusRadio?
   ['-ac','2','-ar','48000','-c:a','libopus','-application','audio','-frame_duration','20',
    '-b:a','128k','-vbr','on','-f','opus','pipe:1']:
   ['-ac','2','-ar','48000','-f','s16le','pipe:1'];
  const args=['-nostdin','-hide_banner','-loglevel',liveRadio?'warning':'error','-threads','2','-filter_threads','1',
   ...input,'-vn','-sn','-dn',...(radioFilter?['-af',radioFilter]:[]),...outputArgs];
  const child=spawn(ffmpegPath(),args,{stdio:[(viaNode||viaYouTube)?'pipe':'ignore','pipe','pipe'],windowsHide:true});
  this.process=child;this.radioHealth=liveRadio?new RadioHealth():null;
  let bytes=0,stderr='',lastPcm=Date.now();
  child.stdout.on('data',b=>{bytes+=b.length;lastPcm=Date.now();});
  child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-1300);
   if(this.process===child)this.radioHealth?.onFFmpegData(b);
  });
  child.once('error',e=>{if(this.process===child)this.fail('FFmpeg: '+(e.code||e.message));});
  child.once('close',(code,signal)=>{
    if(this.closed||this.process!==child||child.killed)return;
    if(code!==0||bytes===0)this.fail('FFmpeg: '+(errorText(stderr)||('brak danych audio (kod: '+(code===null?'brak':code)+', sygnał: '+(signal||'brak')+', bajty: '+bytes+')')));
    // A clean FFmpeg exit alone does not prove that a live radio source is stable.
  });
  // Radio gets a larger initial cushion than YouTube, because a live stream
  // cannot request missing packets again. Both values remain configurable.
  const prebufferMs=audioBufferMs(track);
  const buffered=track.kind!=='file'&&prebufferMs>0;
  const startVoice=()=>{
   if(!this.closed&&this.current===track&&this.process===child)this.player.play(this.resource);
  };
  let inputPcm=child.stdout;
  this.radioStats=null;
  if(opusRadio){
   // FFmpeg encodes Opus; buffer demuxes real 20ms packets via Voice's Ogg parser.
   // No JS Opus encoder or PCM volume transformer in this opt-in comparison.
   this.radioBuffer=bufferOpusRadio(child.stdout,startVoice,{milliseconds:prebufferMs});
   this.radioStats=this.radioBuffer.stats;
   inputPcm=this.radioBuffer.stream;
  }else if(liveRadio){
   this.radioBuffer=bufferLivePcm(child.stdout,startVoice,{
    milliseconds:prebufferMs,
    recoveryMs:Math.min(700,Math.max(250,Math.round(prebufferMs/2)))
   });
   this.radioStats=this.radioBuffer.stats;
   inputPcm=this.radioBuffer.stream;
  }else if(buffered){
   inputPcm=bufferPcm(child.stdout,startVoice,{milliseconds:prebufferMs});
  }
  this.resource=createAudioResource(inputPcm,{
   inputType:opusRadio?StreamType.Opus:StreamType.Raw,
   inlineVolume:!opusRadio,metadata:track
  });
  if(this.resource.volume)this.resource.volume.setVolume(this.volume/100);
  if(!liveRadio&&!buffered)this.player.play(this.resource);
  // Recover from a stuck network/YouTube stream, not from ordinary pauses.
  if(track.kind!=='file'){
   this.watchdog=setInterval(()=>{
    if(this.closed||this.current!==track||this.process!==child||!bytes)return;
    if(this.player.state.status===AudioPlayerStatus.Playing&&Date.now()-lastPcm>30000)
     this.fail('Strumień audio nie przesyła danych przez 30 sekund. Ponawiam połączenie.');
   },5000);
   this.watchdog.unref?.();
  }
  if(viaNode)void this.feedNetwork(track,child);
  if(viaYouTube)this.feedYouTube(track,child);
  this.announce('🎶 NeonBeats teraz gra: '+clean(track.title)+' · DJ: '+this.dj);
  // YouTube extraction can take longer than direct local/radio audio.
  const startupLimit=viaYouTube?90_000:30_000;
  this.startupTimer=setTimeout(()=>{
    if(this.current===track&&this.player.state.status!==AudioPlayerStatus.Playing)
      this.fail(viaYouTube?'YouTube: nie uruchomiono audio w 90 sekundach. Sprawdź /youtube diagnoza.':'Dźwięk nie wystartował w 30 sekund.');
  },startupLimit);this.startupTimer.unref?.();

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
module.exports={MusicSession,sessions,ensureSession,clean,MAX_QUEUE,MAX_MISSED_FRAMES,audioBufferMs,retryRadioTrack,radioCodec,shouldRetryYouTube};
