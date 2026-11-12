'use strict';
require('dotenv').config();
const {envCheck, VERSION}=require('./src/config');
async function main(){
  envCheck();
  console.log('🎧 NeonBeats Bot '+VERSION+' — RADIO JITTER GUARD');
  await require('./src/register').register();
  await require('./src/bot').start();
}
main().catch(e=>{console.error('❌ Nie udało się uruchomić NeonBeats:',e.message);process.exitCode=1;});
