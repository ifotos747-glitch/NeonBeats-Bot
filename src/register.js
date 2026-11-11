'use strict';
require('dotenv').config();
const {REST,Routes}=require('discord.js');
const {commands}=require('./commands');
const {envCheck}=require('./config');
async function register(){
 envCheck();
 const {DISCORD_TOKEN,CLIENT_ID,GUILD_ID}=process.env;
 const rest=new REST({version:'10'}).setToken(DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body:commands.map(c=>c.toJSON())});
 console.log('✅ Zarejestrowano '+commands.length+' komend NeonBeats na serwerze '+GUILD_ID);
}
if(require.main===module)register().catch(e=>{console.error('❌ Rejestracja:',e.message);process.exitCode=1;});
module.exports={register};
