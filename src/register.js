'use strict';
require('dotenv').config();
const {REST,Routes}=require('discord.js');
const {commands}=require('./commands');
const {envCheck}=require('./config');
async function register(){
 envCheck();
 const {DISCORD_TOKEN,CLIENT_ID,GUILD_ID}=process.env;
 const rest=new REST({version:'10'}).setToken(DISCORD_TOKEN);
 const payload=commands.map(c=>c.toJSON());
 // Register immediately in the configured test guild. Guild commands take precedence
 // over global commands with the same name, preventing duplicate slash entries.
 if(GUILD_ID&&/^\d{15,24}$/.test(GUILD_ID)){
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:payload});
  console.log('✅ Zarejestrowano '+payload.length+' komend na serwerze '+GUILD_ID+' (natychmiastowa aktualizacja).');
 }
 await rest.put(Routes.applicationCommands(CLIENT_ID),{body:payload});
 console.log('✅ Zarejestrowano '+payload.length+' komend globalnych NeonBeats (propagacja Discord może potrwać).');
 console.log('👑 Komendy Premium: /premium status oraz /premium lista.');
}
if(require.main===module)register().catch(e=>{console.error('❌ Rejestracja:',e.message);process.exitCode=1;});
module.exports={register};
