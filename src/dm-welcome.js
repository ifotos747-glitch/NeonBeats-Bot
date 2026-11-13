'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {DATA,VERSION}=require('./config');
const FILE=path.join(DATA,'dm-welcome.json');
const inFlight=new Set();
let loaded=null;
function userKey(userId){return createHash('sha256').update(String(userId)).digest('hex');}
function readState(){
 if(loaded!==null)return loaded;
 try{
  const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
  loaded=new Set(Array.isArray(data?.welcomed)?data.welcomed.filter(x=>/^[a-f0-9]{64}$/.test(x)):[]);
 }catch(e){
  if(e.code!=='ENOENT')console.warn('NeonBeats DM welcome: cannot read saved greetings:',e.message);
  loaded=new Set();
 }
 return loaded;
}
function persist(state){
 fs.mkdirSync(DATA,{recursive:true});
 const tmp=FILE+'.'+process.pid+'.tmp';
 fs.writeFileSync(tmp,JSON.stringify({version:1,welcomed:[...state]},null,2),{mode:0o600});
 fs.renameSync(tmp,FILE);
}
function makeWelcomeEmbed(){
 const {EmbedBuilder}=require('discord.js');
 return new EmbedBuilder()
  .setColor(0x8e41f5)
  .setTitle('🎧 Witaj w NeonBeats!')
  .setDescription('Cześć! 👋 Jestem **NeonBeats**, botem muzycznym Discord. Pomagam odtwarzać muzykę, słuchać radia i zarządzać odtwarzaniem na serwerach.')
  .addFields(
   {name:'📻 Radio internetowe',value:'Wyszukiwanie stacji, globalna lista oraz radio 24/7.',inline:false},
   {name:'🎵 YouTube i playlisty',value:'Odtwarzanie obsługiwanych materiałów i playlist YouTube na kanałach głosowych serwerów.',inline:false},
   {name:'🎚️ Muzyka i AutoDJ',value:'Kolejka, głośność, ulubione utwory, efekty DJ i AutoDJ.',inline:false},
   {name:'🚀 Jak zacząć?',value:'Dodaj mnie do serwera, dołącz do kanału głosowego i użyj `/neonhelp`, `/radio szukaj` albo `/play` **na serwerze**.',inline:false}
  )
  .setFooter({text:'NeonBeats • '+VERSION+' | Dzięki za wiadomość!'});
}
// DM opens and user installation events do not grant permission to send an
// unsolicited welcome. The first user-authored 1:1 DM triggers a single reply.
async function welcomeDirectMessage(message){
 if(!message||message.author?.bot||message.guildId!==null||message.channel?.type!==1)return false;
 const id=message.author?.id;
 if(!/^\d{15,24}$/.test(String(id||'')))return false;
 const key=userKey(id),state=readState();
 if(state.has(key)||inFlight.has(key))return false;
 inFlight.add(key);
 try{
  await message.channel.send({embeds:[makeWelcomeEmbed()],allowedMentions:{parse:[]}});
  state.add(key);
  try{persist(state);}catch(err){console.error('NeonBeats DM welcome persistence:',err.message);}
  return true;
 }catch(err){
  console.warn('NeonBeats DM welcome could not be sent:',err.message);
  return false;
 }finally{inFlight.delete(key);}
}
module.exports={welcomeDirectMessage,makeWelcomeEmbed,userKey};
