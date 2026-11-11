'use strict';
const {Client,GatewayIntentBits,Events,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags,PermissionFlagsBits}=require('discord.js');
const {execFile}=require('node:child_process');
const {ffmpegPath,BOT_NAME,VERSION}=require('./config');
const {musicFiles,localFile,classifyInput}=require('./media');
const store=require('./store'),{sessions,ensureSession}=require('./player');
const {diagnoseStream,formatDiagnostic}=require('./diagnostics');
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates]});
const hidden={flags:MessageFlags.Ephemeral};
function clean(x){return String(x||'').replace(/[\r\n*@<>]/g,' ').slice(0,140);}
function embed(title,body){return new EmbedBuilder().setColor(0x8e41f5).setTitle(title).setDescription(body).setFooter({text:'NeonBeats • '+VERSION});}
function panel(){
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
 return {embeds:[embed('🎧 NEONBEATS • MUSIC CONTROL','Sterowanie muzyką, kolejką i głośnością.\nRadio 24/7 • AutoDJ • DJ FX')],components:[row1,row2]};
}
function requireAdmin(i){if(!i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)&&i.guild?.ownerId!==i.user.id)throw Error('Wymagane uprawnienie Zarządzanie serwerem.');}
function voice(i){const m=i.guild?.members.cache.get(i.user.id)||i.member,v=m?.voice?.channel;
 if(!v?.isVoiceBased?.())throw Error('Najpierw dołącz do kanału głosowego.');return v;}
function getSession(i){const s=sessions.get(i.guildId);if(!s)throw Error('Bot nie jest połączony.');
 if(voice(i).id!==s.channelId)throw Error('Dołącz do kanału, na którym jest bot.');return s;}
function join(i){return ensureSession(i.guild,voice(i),i.channel);}
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
 if(!['pause','resume','skip','stop','up','down'].includes(a))return;
 const s=getSession(i);
 if(a==='pause')return i.reply({content:s.pause()?'⏸️ Pauza.':'Nie można wstrzymać.',...hidden});
 if(a==='resume')return i.reply({content:s.resume()?'▶️ Wznowiono.':'Nie można wznowić.',...hidden});
 if(a==='skip')return i.reply({content:s.skip()?'⏭️ Pominięto.':'Nie ma utworu.',...hidden});
 if(a==='stop'){store.set247(i.guildId,null);s.stop();return i.reply({content:'⏹️ Zatrzymano muzykę i 24/7.',...hidden});}
 const p=Math.max(0,Math.min(150,s.volume+(a==='up'?10:-10)));s.setVolume(p);
 return i.reply({content:'🔊 Głośność '+p+'%',...hidden});
}
async function slash(i){
 const n=i.commandName;
 const sub=['radio','autodj','247','dj','playlist'].includes(n)?i.options.getSubcommand():'';
 if(n==='neonhelp')return i.reply({embeds:[embed('🎧 NEONBEATS 1.0 — KOMENDY',
  '/play /queue /nowplaying /pause /resume /skip /stop /leave /volume /panel\n'+
  '/radio add|remove|list|play|stop|diagnoza\n/autodj on|off\n/247 on|off|status\n'+
  '/dj preset|off|status\n/playlist save|load|list|delete\n/status /files /testaudio')],...hidden});
 if(n==='panel')return i.reply(panel());
 if(n==='status'){
  await i.deferReply(hidden);const s=sessions.get(i.guildId),d=store.read(i.guildId);
  return i.editReply({embeds:[embed('🧪 NEONBEATS • STATUS',
   'Wersja: '+VERSION+'\nNode: '+process.version+'\nFFmpeg: '+await ffVersion()+'\nVoice: '+
   (s?.connection.state.status||'brak')+'\nPlayer: '+(s?.player.state.status||'brak')+
   '\nPliki: '+musicFiles().length+'\nStacje: '+d.radios.length+
   '\n24/7: '+(d.alwaysOn?.mode||'wyłączony')+'\nDJ: '+d.dj+
   (s?.lastError?'\nOstatni błąd: '+clean(s.lastError):''))]});
 }
 if(n==='files')return i.reply({content:'🎵 Pliki: '+(musicFiles().map(clean).join(', ')||'Brak'),...hidden});
 if(n==='play'||n==='testaudio'){
  const x=n==='testaudio'?localFile('demo.wav'):classifyInput(i.options.getString('source',true),store.read(i.guildId).radios);
  if(x.kind==='youtube-link'||x.kind==='spotify-link')return i.reply({content:
   'Rozpoznano '+x.title+'. Oficjalne API nie udostępnia pełnego strumienia audio do retransmisji na Discorda. Podaj plik music/ lub uprawniony strumień.',...hidden});
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
  const d=store.read(i.guildId),name=i.options.getString('nazwa');
  if(sub==='diagnoza'){
   requireAdmin(i);
   const st=d.radios.find(r=>r.name.toLowerCase()===String(name||'').toLowerCase());
   if(!st)throw Error('Nie znaleziono stacji.');
   await i.deferReply(hidden);
   const report=await diagnoseStream(st.url);
   return i.editReply({content:formatDiagnostic(st.name,report),allowedMentions:{parse:[]}});
  }
  if(sub==='list')return i.reply({content:'📻 Stacje:\n'+(d.radios.map(r=>clean(r.name)).join('\n')||'Brak stacji'),...hidden});
  if(sub==='add'){requireAdmin(i);const st=store.addRadio(i.guildId,name,i.options.getString('url',true));
   return i.reply({content:'✅ Dodano '+clean(st.name),...hidden});}
  if(sub==='remove'){requireAdmin(i);store.removeRadio(i.guildId,name);return i.reply({content:'🗑️ Usunięto stację',...hidden});}
  if(sub==='play'){
   const st=d.radios.find(r=>r.name.toLowerCase()===String(name).toLowerCase());
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
   const st=d.radios.find(r=>r.name.toLowerCase()===String(i.options.getString('stacja')||'').toLowerCase());
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
   const s=ensureSession(guild,v,text||null);s.alwaysOn=d;void s.startNext();
   console.log('📡 Przywrócono 24/7: '+d.mode);
  }catch(e){console.warn('NeonBeats 24/7:',e.message);}
 }
}
client.once(Events.ClientReady,async()=>{
 console.log('✅ '+BOT_NAME+' online jako '+client.user.tag);
 await restore247();setInterval(()=>void restore247(),60_000).unref?.();
});
client.on(Events.InteractionCreate,async i=>{
 if(!i.inGuild()||(!i.isChatInputCommand()&&!i.isButton()))return;
 try{if(i.isButton()){if(i.customId.startsWith('neon:'))await button(i);}else await slash(i);}
 catch(e){console.error('NeonBeats command:',e.message);
  const content='⚠️ '+clean(e.message||'Błąd');
  if(i.deferred||i.replied)await i.followUp({content,...hidden}).catch(()=>{});
  else await i.reply({content,...hidden}).catch(()=>{});
 }
});
function start(){return client.login(process.env.DISCORD_TOKEN);}
module.exports={client,start,panel,queueMessage};
