'use strict';
require('dotenv').config();
const {REST,Routes}=require('discord.js');
const {commands}=require('./commands');
const {envCheck}=require('./config');
async function register(){
 envCheck();
 const {DISCORD_TOKEN,CLIENT_ID,GUILD_ID}=process.env;
 const rest=new REST({version:'10'}).setToken(DISCORD_TOKEN);
 const bot=await rest.get('/users/@me');
 console.log('🔎 Zalogowany bot Discord: '+bot.username+' (ID: '+bot.id+')');
 console.log('🔎 CLIENT_ID aplikacji: '+CLIENT_ID);
 if(bot.id!==CLIENT_ID)throw Error('CLIENT_ID różni się od ID bota z DISCORD_TOKEN. Komendy trafiają do innej aplikacji!');
 const payload=commands.map(c=>c.toJSON());
 const expected=payload.map(c=>c.name).sort();
 if(!expected.includes('premium'))throw Error('Brak /premium w aktualnym kodzie src/commands.js');
 const verify=async(scope,route)=>{
  const actual=await rest.get(route);
  if(!Array.isArray(actual))throw Error('Discord nie zwrócił listy komend: '+scope);
  const names=actual.map(c=>c.name).sort(),missing=expected.filter(name=>!names.includes(name));
  console.log('📋 Discord API — '+scope+': '+names.join(', '));
  if(missing.length)throw Error('Discord nie zapisał komend '+scope+': '+missing.join(', '));
  const p=actual.find(c=>c.name==='premium');
  const subs=(p?.options||[]).map(c=>c.name);
  if(!subs.includes('status')||!subs.includes('lista'))throw Error('Discord zwrócił niepełną komendę /premium ('+scope+').');
  console.log('👑 Potwierdzono w Discord API: /premium status i /premium lista ('+scope+').');
 };
 // Register immediately in the configured test guild. Guild commands take precedence
 // over global commands with the same name, preventing duplicate slash entries.
 if(GUILD_ID&&/^\d{15,24}$/.test(GUILD_ID)){
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:payload});
  await verify('serwer '+GUILD_ID,Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID));
  console.log('✅ Zarejestrowano '+payload.length+' komend na serwerze '+GUILD_ID+' (natychmiastowa aktualizacja).');
 }
 await rest.put(Routes.applicationCommands(CLIENT_ID),{body:payload});
 await verify('globalne',Routes.applicationCommands(CLIENT_ID));
 console.log('✅ Zarejestrowano '+payload.length+' komend globalnych NeonBeats (propagacja Discord może potrwać).');
 console.log('👑 Komendy Premium: /premium status oraz /premium lista.');
}
if(require.main===module)register().catch(e=>{console.error('❌ Rejestracja:',e.message);process.exitCode=1;});
module.exports={register};
