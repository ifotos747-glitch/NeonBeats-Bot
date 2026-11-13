'use strict';
const {Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits,StringSelectMenuBuilder}=require('discord.js');
const {execFile}=require('node:child_process');
const {ffmpegPath,BOT_NAME,VERSION,IDLE_MINUTES}=require('./config');
const {musicFiles,localFile,classifyInput}=require('./media');
const store=require('./store'),radio=require('./global-radio'),{sessions,ensureSession,audioBufferMs,MAX_MISSED_FRAMES,radioCodec}=require('./player');
const {diagnoseStream,diagnoseLocalFFmpeg,diagnoseHttp,formatDiagnostic}=require('./diagnostics');
const {normalizeYouTubeUrl,youtubeVideoTitle,ytDlpPath,ytDlpTempStatus,installYtDlp,updateYtDlp,ytDlpVersion,diagnoseYouTube}=require('./youtube');
const {MAX_PLAYLIST_ITEMS,isYouTubePlaylistUrl,loadYoutubePlaylist}=require('./youtube-playlist');
const {startWebControl}=require('./web-control');
const premium=require('./premium');
const {performanceSnapshot,performanceText}=require('./performance');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});
const hidden={flags:MessageFlags.Ephemeral};
function clean(x){return String(x||'').replace(/[\r\n*@<>]/g,' ').slice(0,140);}
function embed(title,body){return new EmbedBuilder().setColor(0x8e41f5).setTitle(title).setDescription(body).setFooter({text:'NeonBeats • '+VERSION});}
function panel(track=null,session=null){
 const row1=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('neon:pause').setLabel('Pauza').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:resume').setLabel('Wznów').setEmoji('▶️').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('neon:skip').setLabel('Pomiń').setEmoji('⏭️').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('neon:queue').setLabel('Kolejka').setEmoji('🎶').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:stop').setLabel('Stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger)
 );
 const row2=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('neon:down').setLabel('-10%').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:up').setLabel('+10%').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:now').setLabel('Teraz gra').setStyle(ButtonStyle.Secondary)
 );
 const row3=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('neon:shuffle').setLabel('Losuj kolejkę').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:repeat').setLabel(session?.repeatMode==='one'?'Powtarzanie: WŁ.':'Powtarzanie: WYŁ.').setEmoji('🔁').setStyle(session?.repeatMode==='one'?ButtonStyle.Success:ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('neon:refresh').setLabel('Odśwież').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
 );
 const next=session?.queue?.[0];
 const description=(track?'🎶 **Teraz gra:** '+clean(track.title):'⏹️ Nic nie gra')+
  '\n⏭️ **Następny:** '+(next?clean(next.title):'Brak w kolejce')+
  '\n📋 **Kolejka:** '+(session?.queue?.length||0)+' utworów'+
  '\n🔊 **Głośność:** '+(session?.volume??85)+'%'+
  '   •   🎚️ **DJ:** '+clean(session?.dj||'off')+
  '\n🔁 **Powtarzanie:** '+(session?.repeatMode==='one'?'jeden utwór':'wyłączone')+
  '\n🎧 **Status:** '+(session?.player?.state?.status||'nieznany');
 return {embeds:[embed('🎧 NEONBEATS • MUSIC CONTROL',description)],components:[row1,row2,row3]};
}
function requireAdmin(i){if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)&&i.guild?.ownerId!==i.user.id)throw Error('Wymagane uprawnienie Zarządzanie serwerem.');}
function requireOwner(i){
 if(!process.env.BOT_OWNER_ID||i.user.id!==process.env.BOT_OWNER_ID)
  throw Error('Globalny katalog: wymagane konto właściciela BOT_OWNER_ID.');
}
function radioMenu(items){
 return [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
  .setCustomId('neon:radio:select').setPlaceholder('📻 Wybierz stację')
  .addOptions(items.slice(0,25).map(st=>({label:clean(st.name).slice(0,100),value:st.id}))))];
}
function voice(i){const m=i.guild?.members.cache.get(i.user.id)||i.member,v=m?.voice?.channel;
 if(!v?.isVoiceBased?.())throw Error('Najpierw dołącz do kanału głosowego.');return v;}
function getSession(i){const s=sessions.get(i.guildId);if(!s)throw Error('Bot nie jest połączony.');
 if(voice(i).id!==s.channelId)throw Error('Dołącz do kanału, na którym jest bot.');return s;}
function join(i){const session=ensureSession(i.guild,voice(i),i.channel);session.panelFactory=panel;return session;}
async function enqueueYoutubePlaylist(i,source,{start=1,limit=MAX_PLAYLIST_ITEMS}={}){
 // Validate channel before contacting YouTube; no voice connection created yet.
 voice(i);
 if(!ytDlpPath())throw Error('Brak yt-dlp. Administrator: /youtube install.');
 const url=String(source||'');
 const s0=sessions.get(i.guildId);
 if(s0&&!s0.closed&&s0.queue.length>=100)throw Error('Kolejka jest pełna (100 utworów).');
 const result=await loadYoutubePlaylist(url,{start,limit});
 const s=join(i);
 const available=100-s.queue.length;
 if(available<1)throw Error('Kolejka jest pełna (100 utworów).');
 const tracks=result.tracks.slice(0,available);
 s.enqueueMany(tracks);
 return '✅ Playlista YouTube: dodano '+tracks.length+' utworów. Sprawdzony zakres: '+start+'–'+(start+limit-1)+'.'+
   '\nPominięto w otrzymanych metadanych: '+result.skipped+' (prywatne/niedostępne: '+result.reasons.unavailable+
   ', nierozpoznane identyfikatory: '+result.reasons.unrecognized+
   ', nieprawidłowe dane: '+result.reasons.invalidMetadata+').'+
   (result.partial?'\n⚠️ yt-dlp zgłosił problemy podczas odczytu.':'')+
   (tracks.length<result.tracks.length?'\n⚠️ Limit kolejki: nie wszystkie odczytane utwory dodano.':'')+
   '\nUwaga: YouTube może nie udostępniać audio każdego filmu podczas odtwarzania.';
}
function queueMessage(s){if(!s)return 'Kolejka jest pusta.';
 return [s.current?'Teraz gra: '+clean(s.current.title):'Nic nie gra',
  ...s.queue.slice(0,18).map((t,n)=>String(n+1)+'. '+clean(t.title)),
  s.queue.length>18?'i '+(s.queue.length-18)+' kolejnych':null].filter(Boolean).join('\n');}
function ffVersion(){return new Promise(resolve=>{
 execFile(ffmpegPath(),['-version'],{timeout:4500,windowsHide:true},(e,out)=>resolve(e?'NIEDOSTĘPNY':out.split('\n')[0].slice(0,95)));
});}
async function button(i){
 const a=i.customId.slice(5);
 if(a==='queue')return i.reply({content:queueMessage(sessions.get(i.guildId)),...hidden});
 if(a==='now')return i.reply({content:'💿 '+(sessions.get(i.guildId)?.current?.title||'Nic nie gra.'),...hidden});
 if(!['pause','resume','skip','stop','up','down','shuffle','repeat','refresh'].includes(a))return;
 const s=getSession(i);
 if(a==='refresh'){await s.showControlPanel(s.current);return i.reply({content:'🔄 Panel odświeżony.',...hidden});}
 if(a==='shuffle')return i.reply({content:s.shuffleQueue()?'🔀 Kolejka wymieszana.':'🔀 Potrzeba co najmniej 2 utworów w kolejce.',...hidden});
 if(a==='repeat')return i.reply({content:s.toggleRepeat()==='one'?'🔁 Powtarzanie utworu włączone.':'🔁 Powtarzanie wyłączone.',...hidden});
 if(a==='pause')return i.reply({content:s.pause()?'⏸️ Pauza.':'Nie można wstrzymać.',...hidden});
 if(a==='resume')return i.reply({content:s.resume()?'▶️ Wznowiono.':'Nie można wznowić.',...hidden});
 if(a==='skip')return i.reply({content:s.skip()?'⏭️ Pominięto.':'Nie ma utworu.',...hidden});
 if(a==='stop'){store.set247(i.guildId,null);s.stop();return i.reply({content:'⏹️ Zatrzymano muzykę i 24/7.',...hidden});}
 const p=Math.max(0,Math.min(150,s.volume+(a==='up'?10:-10)));s.setVolume(p);
 return i.reply({content:'🔊 Głośność '+p+'%',...hidden});
}
async function slash(i){
 const n=i.commandName;
 const sub=['radio','autodj','247','dj','playlist','youtube','premium'].includes(n)?i.options.getSubcommand():'';
 if(n==='neonhelp')return i.reply({embeds:[embed('🎧 NEONBEATS '+VERSION+' — KOMENDY',
  '/play /queue /nowplaying /pause /resume /skip /stop /leave /volume /panel\n'+
  '/radio szukaj|list|play|stop|ulubione|admin\n/youtube install|aktualizuj|napraw|status|diagnoza|playlista\n/autodj on|off\n/247 on|off|status\n'+
  '/dj preset|off|status\n/playlist save|load|list|delete\n/premium status [serwer-id] | lista\n/status /files /testaudio')],...hidden});
 if(n==='premium'){
  if(sub==='status'){
   const target=i.options.getString('serwer-id')||i.guildId;
   if(target!==i.guildId)premium.requireOwner(i.user.id);
   if(!/^\d{15,24}$/.test(target))throw Error('Podaj poprawne ID serwera Discord.');
   if(!client.guilds.cache.has(target))throw Error('NeonBeats nie jest członkiem podanego serwera.');
   const guild=client.guilds.cache.get(target),state=premium.status(target);
   const description='Serwer: '+clean(guild?.name||target)+'\nID: '+target+
    '\nStatus: '+(state.active?'👑 Premium AKTYWNE':'🔒 Free / nieaktywne')+
    '\nWygasa: '+(state.expiresAt?new Date(state.expiresAt).toISOString().slice(0,10):'brak')+
    '\nPozostało: '+state.daysLeft+' dni'+
    '\nLimit playlist: '+state.limits.playlists+
    '\nLimit ulubionych: '+state.limits.favorites;
   return i.reply({embeds:[embed('👑 NEONBEATS PREMIUM • STATUS',description)],...hidden});
  }
  if(sub==='lista'){
   premium.requireOwner(i.user.id);
   const servers=[...client.guilds.cache.values()].map(g=>({id:g.id,name:g.name}));
   const result=premium.list(servers,0);
   const rows=result.items.map(g=>'• '+clean(g.name)+' ('+g.id+') — '+(g.active?'👑 '+g.daysLeft+' dni':g.revoked?'cofnięte':'wygasłe'));
   const info='Łącznie: '+result.total+' | Aktywne: '+result.active+' | Nieaktywne: '+result.expired+
     '\n'+(rows.join('\n')||'Brak aktywacji.')+
     (result.pages>1?'\nPozostałe wyniki: Premium Admin Center w Web Control.':'');
   return i.reply({embeds:[embed('👑 PREMIUM • SERWERY',info)],...hidden});
  }
 }
 if(n==='panel'){const session=sessions.get(i.guildId);return i.reply(panel(session?.current||null,session));}
 if(n==='status'){
  await i.deferReply(hidden);const s=sessions.get(i.guildId),d=store.read(i.guildId),health=s?.radioHealth?.snapshot(),voice=s?.voiceHealth?.snapshot();
  return i.editReply({embeds:[embed('🧪 NEONBEATS • STATUS',
   'Wersja: '+VERSION+'\nNode: '+process.version+'\nFFmpeg: '+await ffVersion()+'\nVoice: '+
   (s?.connection.state.status||'brak')+'\nPlayer: '+(s?.player.state.status||'brak')+
   '\nAuto-rozłączenie przy bezczynności: '+(IDLE_MINUTES===0?'WYŁĄCZONE':IDLE_MINUTES+' min')+ '\nPliki: '+musicFiles().length+'\nStacje globalne: '+radio.list().length+
   '\n24/7: '+(d.alwaysOn?.mode||'wyłączony')+'\nDJ: '+d.dj+
   '\nTryb radia: '+(s?.radioOpus?'OPUS NATYWNY':(radioCodec()==='opus'&&s?.nativeOpusFailed?'PCM (powrót po błędzie)':'PCM'))+
   (s?.radioOpus?'\nProfil Opus: '+(s.radioOpusProfile==='robust-cbr'?'ROBUST CBR 96 kb/s':s.radioOpusProfile==='robust'?'ROBUST 96 kb/s':'STANDARD 128 kb/s'):'')+
   '\nBufor radia: '+audioBufferMs({kind:'radio'})+' ms | bufor YouTube: '+audioBufferMs({kind:'youtube-link'})+' ms'+
   '\nTolerancja krótkich przerw: '+MAX_MISSED_FRAMES*20+' ms'+
   (s?.radioStats?'\n📻 Radio live: bufor '+s.radioStats.bufferedMs+' ms (maks. '+s.radioStats.peakBufferedMs+' ms)'+
    (s.radioOpus?
     '\n📦 Opus: pakiety otrzymane '+s.radioStats.receivedPackets+' | podane do Voice '+s.radioStats.playedPackets+
     ' | opróżnienia bufora: '+s.radioStats.underruns:
     '\n📉 Odczyty bez PCM: '+s.radioStats.underruns+' | min. ciszy przy niedoborze: '+s.radioStats.silenceMs+' ms'):'')+
   (health?'\n📡 MP3 HTTP: '+health.httpBytes+' B | porcje: '+health.httpChunks+
    '\nPrzerwy odczytu >0,5s: '+health.readGaps500+' | >2s: '+health.readGaps2000+' | najdłuższa: '+health.maxReadGapMs+' ms'+
    '\nFFmpeg ostrzeżenia audio: '+health.decoderWarnings+
    (health.lastDecoderWarning?'\nOstatnie FFmpeg: '+clean(health.lastDecoderWarning):''):'')+
   (voice&&['radio','stream'].includes(s?.current?.kind)?
    '\n🎙️ Voice: odczyty '+voice.resourceReads+' | bez ramki '+voice.missingReads+
    ' (serie: '+voice.missingEpisodes+', maks.: '+voice.longestMissingSeries+')'+
    '\nRytm odczytu: przerwy >50ms '+voice.readGaps50+' | >100ms '+voice.readGaps100+
    ' | maks. '+voice.largestReadGapMs+' ms'+
    '\nWysyłanie lokalne: OK '+voice.dispatchSuccess+' | nieudane '+voice.dispatchFailed+
    ' | bez potwierdzenia '+voice.dispatchUnavailable+
    ' | przerwy >50ms '+voice.dispatchGaps50+' | maks. '+voice.largestDispatchGapMs+' ms':'')+
   '\n'+performanceText(performanceSnapshot(s))+
   (s?.lastError?'\nOstatni błąd: '+clean(s.lastError):''))]});
 }
 if(n==='files')return i.reply({content:'🎵 Pliki: '+(musicFiles().map(clean).join(', ')||'Brak'),...hidden});
 if(n==='youtube'){
  if(sub==='status'){
   const status=await ytDlpVersion();
   const temp=ytDlpTempStatus();
   const tempInfo='\n📁 Katalog tymczasowy: '+clean(temp.path)+
     (temp.availableMB===null?' | brak danych o wolnym miejscu':' | dostępne: '+temp.availableMB+' MB')+
     (temp.lowSpace?' ⚠️ Mało miejsca':'')+
     (temp.error?' | '+clean(temp.error):'');
   return i.reply({content:(status.ok?'✅ yt-dlp: '+status.description+' | Node: '+process.version:'⚠️ '+status.description)+tempInfo,...hidden});
  }
  if(sub==='napraw'){
   await i.deferReply(hidden);
   const info=await ytDlpVersion();
   const temp=ytDlpTempStatus();
   const details='\n📁 TMP: '+clean(temp.path)+
     (temp.availableMB===null?' | wolne miejsce nieznane':' | wolne: '+temp.availableMB+' MB')+
     (temp.lowSpace?' ⚠️ Mało miejsca':'')+
     (temp.error?' | '+clean(temp.error):'');
   return i.editReply({content:(info.ok?
     '✅ Silnik yt-dlp: '+clean(info.description)+'\nSprawdź /youtube diagnoza dla filmu.':
     '⚠️ '+clean(info.description)+'\nBłąd PYI oznacza problem rozpakowywania silnika na hostingu, nie formatu audio. Sprawdź katalog i wolne miejsce ALTARE.')+details});
  }
  if(sub==='playlista'){
   await i.deferReply(hidden);
   try{
    const message=await enqueueYoutubePlaylist(i,i.options.getString('url',true),{
     start:i.options.getInteger('od')||1,limit:i.options.getInteger('ile')||MAX_PLAYLIST_ITEMS
    });
    return i.editReply({content:message,allowedMentions:{parse:[]}});
   }catch(err){return i.editReply({content:'⚠️ '+clean(err.message)});}
  }
  requireAdmin(i);
  await i.deferReply(hidden);
  if(sub==='aktualizuj'){
   try{
    const message=await updateYtDlp();
    const info=await ytDlpVersion();
    return i.editReply({content:'✅ Aktualizacja YouTube: '+clean(message)+'\nSilnik: '+clean(info.description)});
   }catch(e){return i.editReply({content:'⚠️ '+clean(e.message)});}
  }
  if(sub==='install'){
   try{
    await installYtDlp();
    const info=await ytDlpVersion();
    return i.editReply({content:info.ok?'✅ Zainstalowano yt-dlp '+info.description+'. Użyj /play z linkiem YouTube.':'⚠️ Pobrano yt-dlp, lecz nie działa: '+info.description});
   }catch(e){return i.editReply({content:'❌ Instalacja YouTube: '+clean(e.message)});}
  }
  try{
   const url=normalizeYouTubeUrl(i.options.getString('url',true));
   const report=await diagnoseYouTube(url);
   return i.editReply({content:report.ok?'✅ YouTube dostępny: '+clean(report.title||'film'):'❌ YouTube: '+clean(report.message)+' | kod: '+(report.code===null?'brak':report.code)});
  }catch(e){return i.editReply({content:'❌ '+clean(e.message)});}
 }
 if(n==='play'||n==='testaudio'){
  const x=n==='testaudio'?localFile('demo.wav'):classifyInput(i.options.getString('source',true),radio.list());
  if(x.kind==='spotify-link')return i.reply({content:'Spotify nie udostępnia bezpośredniego audio dla tego bota. Wybierz plik lub uprawniony strumień.',...hidden});
  if(x.kind==='youtube-link'&&isYouTubePlaylistUrl(x.source)){
   await i.deferReply(hidden);
   try{
    const message=await enqueueYoutubePlaylist(i,x.source);
    return i.editReply({content:message,allowedMentions:{parse:[]}});
   }catch(err){return i.editReply({content:'⚠️ '+clean(err.message)});}
  }
  if(x.kind==='youtube-link'){
   const url=normalizeYouTubeUrl(x.source);
   if(!ytDlpPath())return i.reply({content:'⚠️ YouTube wymaga konfiguracji. Administrator: /youtube install.',...hidden});
   x.source=url;
   // Enqueue immediately: public YouTube title lookup is optional and must never
   // delay the Discord interaction or starting the stream on slow ALTARE hosts.
   x.title='YouTube • '+new URL(url).searchParams.get('v');
   const session=join(i);
   session.enqueue(x);
   void youtubeVideoTitle(url).then(title=>{
    if(!title||session.closed)return;
    if(session.current===x||session.queue.includes(x)){
     x.title=title;
     void session.showControlPanel(session.current);
    }
   }).catch(()=>{});
   return i.reply({content:'✅ Dodano do kolejki: '+clean(x.title),...hidden});
  }
  if(x.kind==='stream')requireAdmin(i);
  join(i).enqueue(x);return i.reply({content:'✅ Dodano: '+clean(x.title)});
 }
 if(n==='queue')return i.reply({content:queueMessage(sessions.get(i.guildId)),...hidden});
 if(n==='nowplaying')return i.reply({content:'💿 '+(sessions.get(i.guildId)?.current?.title||'Nic nie gra.'),...hidden});
 if(['pause','resume','skip','stop','leave','volume'].includes(n)){
  const s=getSession(i);
  if(n==='pause')return i.reply({content:s.pause()?'⏸️ Pauza':'Nic nie gra',...hidden});
  if(n==='resume')return i.reply({content:s.resume()?'▶️ Wznowiono':'Nic nie gra',...hidden});
  if(n==='skip')return i.reply({content:s.skip()?'⏭️ Pominięto':'Nic nie gra',...hidden});
  if(n==='volume'){const p=i.options.getInteger('procent',true);s.setVolume(p);return i.reply({content:'🔊 '+p+'%',...hidden});}
  store.set247(i.guildId,null);
  if(n==='stop'){s.stop();return i.reply({content:'⏹️ Zatrzymano',...hidden});}
  s.destroy();return i.reply({content:'👋 Rozłączono',...hidden});
 }
 if(n==='radio'){
  const d=store.read(i.guildId),name=i.options.getString('nazwa'),all=radio.list();
  if(i.options.getSubcommandGroup(false)==='admin'){
   requireOwner(i);
   if(sub==='dodaj'){const st=radio.add(name,i.options.getString('url',true));return i.reply({content:'✅ Dodano globalnie: '+clean(st.name),...hidden});}
   if(sub==='edytuj'){const st=radio.edit(name,i.options.getString('nowa-nazwa'),i.options.getString('url'));return i.reply({content:'✅ Edytowano: '+clean(st.name),...hidden});}
   if(sub==='usun'){radio.remove(name);return i.reply({content:'🗑️ Usunięto stację globalną.',...hidden});}
  }
  if(sub==='szukaj'){
   const found=radio.search(name||'');
   if(!found.length)return i.reply({content:'📻 Brak pasujących stacji.',...hidden});
   return i.reply({content:'📻 Wybierz stację:',components:radioMenu(found),...hidden});
  }
  if(sub==='ulubione'){
   const ids=new Set(radio.favorites(i.guildId)),items=all.filter(st=>ids.has(st.id));
   return i.reply({content:items.length?'❤️ Ulubione stacje serwera:':'❤️ Brak ulubionych stacji.',...(items.length?{components:radioMenu(items)}:{}),...hidden});
  }
  if(sub==='ulubione-dodaj'||sub==='ulubione-usun'){
   requireAdmin(i);
   const st=radio.find(name);if(!st)throw Error('Nie znaleziono stacji globalnej.');
   radio.favorite(i.guildId,st.id,sub==='ulubione-dodaj');
   return i.reply({content:'❤️ Zaktualizowano ulubione: '+clean(st.name),...hidden});
  }
  if(sub==='diagnoza'){
   requireAdmin(i);
   const st=radio.find(name);
   if(!st)throw Error('Nie znaleziono stacji.');
   await i.deferReply(hidden);
   const [report,local,http]=await Promise.all([diagnoseStream(st.url),diagnoseLocalFFmpeg(),diagnoseHttp(st.url)]);
   return i.editReply({content:formatDiagnostic(st.name,report,local,http),allowedMentions:{parse:[]}});
  }
  if(sub==='list')return i.reply({content:'📻 Katalog globalny: '+all.length+' stacji.',...(all.length?{components:radioMenu(all)}:{}),...hidden});
  if(sub==='add'){requireOwner(i);const st=radio.add(name,i.options.getString('url',true));
   return i.reply({content:'✅ Dodano '+clean(st.name),...hidden});}
  if(sub==='remove'){requireOwner(i);radio.remove(name);return i.reply({content:'🗑️ Usunięto stację',...hidden});}
  if(sub==='play'){
   const st=radio.find(name);
   if(!st)throw Error('Nie znaleziono stacji.');
   join(i).replace({kind:'radio',source:st.url,title:st.name,stationId:st.id});
   return i.reply({content:'📻 Odtwarzanie '+clean(st.name)});
  }
  const s=getSession(i);if(s.current?.kind!=='radio')throw Error('Radio nie gra.');
  if(d.alwaysOn?.mode==='radio'){s.alwaysOn=null;store.set247(i.guildId,null);}
  s.skip();return i.reply({content:'📻 Radio zatrzymane',...hidden});
 }
 if(n==='autodj'){
  if(sub==='on'){if(!musicFiles().length)throw Error('Nie ma plików music/.');
   const s=join(i);if(s.alwaysOn?.mode==='radio')throw Error('Wyłącz radio 24/7.');
   s.autodj=true;if(!s.current)void s.startNext();
   return i.reply({content:'🎧 AutoDJ włączony',...hidden});}
  const s=getSession(i);if(s.alwaysOn?.mode==='autodj')throw Error('Najpierw /247 off');
  s.autodj=false;return i.reply({content:'⏹️ AutoDJ wyłączony',...hidden});
 }
 if(n==='247'){
  const d=store.read(i.guildId);
  if(sub==='status')return i.reply({content:d.alwaysOn?'📡 '+d.alwaysOn.mode+' <#'+d.alwaysOn.channelId+'>':'24/7 wyłączony',...hidden});
  requireAdmin(i);
  if(sub==='off'){store.set247(i.guildId,null);const s=sessions.get(i.guildId);
   if(s){s.alwaysOn=null;if(s.current?.continuous)s.skip();}
   return i.reply({content:'📴 24/7 wyłączony',...hidden});}
  const mode=i.options.getString('tryb',true),v=voice(i);
  let stationId=null;
  if(mode==='radio'){
   const st=radio.find(i.options.getString('stacja'));
   if(!st)throw Error('Najpierw dodaj stację przez /radio add.');stationId=st.id;
  }
  if(mode==='autodj'&&!musicFiles().length)throw Error('Brak plików AutoDJ.');
  const cfg={mode,channelId:v.id,textChannelId:i.channelId,stationId};
  const s=ensureSession(i.guild,v,i.channel);s.alwaysOn=cfg;s.autodj=false;s.queue=[];
  store.set247(i.guildId,cfg);
  if(s.current)s.skip();else void s.startNext();
  return i.reply({content:'📡 Włączono 24/7: '+mode,...hidden});
 }
 if(n==='dj'){
  if(sub==='status')return i.reply({content:'🎚️ DJ: '+store.read(i.guildId).dj,...hidden});
  requireAdmin(i);
  const p=sub==='off'?'off':i.options.getString('efekt',true);
  store.setDJ(i.guildId,p);const s=sessions.get(i.guildId);if(s)s.setDJ(p);
  return i.reply({content:'🎚️ DJ: '+p,...hidden});
 }
 if(n==='playlist'){
  const d=store.read(i.guildId),name=i.options.getString('nazwa');
  if(sub==='list')return i.reply({content:'💾 Playlisty:\n'+(Object.entries(d.playlists).map(([k,v])=>clean(k)+' ('+v.length+')').join('\n')||'Brak'),...hidden});
  if(sub==='delete'){requireAdmin(i);store.deletePlaylist(i.guildId,name);return i.reply({content:'🗑️ Usunięto',...hidden});}
  if(sub==='save'){
   const s=getSession(i),tracks=[...(s.current&&!s.current.continuous?[s.current]:[]),...s.queue];
   if(!tracks.length)throw Error('Kolejka pusta.');
   const count=store.savePlaylist(i.guildId,name,tracks);
   return i.reply({content:'💾 Zapisano '+count+' utworów',...hidden});
  }
  const tracks=store.loadPlaylist(i.guildId,name);
  if(!tracks.length)throw Error('Playlista pusta.');
  const s=join(i);if(s.queue.length+tracks.length>100)throw Error('Limit kolejki 100.');
  for(const x of tracks)s.enqueue(x);
  return i.reply({content:'▶️ Dodano '+tracks.length+' utworów',...hidden});
 }
}
async function restore247(){
 for(const guild of client.guilds.cache.values()){
  try{
   const d=store.read(guild.id).alwaysOn;if(!d||sessions.has(guild.id))continue;
   const v=await guild.channels.fetch(d.channelId).catch(()=>null);
   const text=await guild.channels.fetch(d.textChannelId).catch(()=>null);
   if(!v?.isVoiceBased?.()||!v.joinable)continue;
   const s=ensureSession(guild,v,text||null);s.panelFactory=panel;s.alwaysOn=d;void s.startNext();
   console.log('📡 Przywrócono 24/7: '+d.mode);
  }catch(e){console.warn('NeonBeats 24/7:',e.message);}
 }
}
client.once(Events.ClientReady,async()=>{
 console.log('✅ '+BOT_NAME+' online jako '+client.user.tag);
 startWebControl(client);
 try{console.log('📻 Migracja stacji: '+radio.migrate());}catch(e){console.error('Migracja radia:',e.message);}await restore247();setInterval(()=>void restore247(),60_000).unref?.();
});
client.on(Events.InteractionCreate,async i=>{
 if(!i.inGuild()||(!i.isChatInputCommand()&&!i.isButton()&&!i.isStringSelectMenu()))return;
 try{
  if(i.isStringSelectMenu()&&i.customId==='neon:radio:select'){
   const st=radio.find(i.values[0]);if(!st)throw Error('Nie znaleziono stacji.');
   join(i).replace({kind:'radio',source:st.url,title:st.name,stationId:st.id});
   await i.update({content:'📻 Odtwarzanie: '+clean(st.name),components:[],allowedMentions:{parse:[]}});
  }else if(i.isButton()){if(i.customId.startsWith('neon:'))await button(i);}
  else await slash(i);
 }
 catch(e){console.error('NeonBeats command:',e.message);
  const content='⚠️ '+clean(e.message||'Błąd');
  if(i.deferred||i.replied)await i.followUp({content,...hidden}).catch(()=>{});
  else await i.reply({content,...hidden}).catch(()=>{});
 }
});
function start(){return client.login(process.env.DISCORD_TOKEN);}
module.exports={client,start,panel,queueMessage};
