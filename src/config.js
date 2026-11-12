'use strict';
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.NEONBEATS_DATA_DIR || path.join(ROOT, 'data'));
const MUSIC = path.resolve(process.env.NEONBEATS_MUSIC_DIR || path.join(ROOT, 'music'));
const BOT_NAME = 'NeonBeats Bot';
const VERSION = require('../package.json').version;
const IDLE_MINUTES = Math.max(2, Math.min(120, Number(process.env.IDLE_MINUTES) || 15));
const SNOWFLAKE = /^\d{15,24}$/;
function envCheck() {
 const {DISCORD_TOKEN, CLIENT_ID, GUILD_ID}=process.env;
 if (!DISCORD_TOKEN || DISCORD_TOKEN.startsWith('WPISZ_')) throw Error('Ustaw prywatny DISCORD_TOKEN w .env.');
 if (!SNOWFLAKE.test(String(CLIENT_ID||''))) throw Error('Wprowadź prawidłowe CLIENT_ID.');
 if (GUILD_ID && !SNOWFLAKE.test(String(GUILD_ID))) throw Error('Wprowadź prawidłowe GUILD_ID.');
}
function ffmpegPath(){
 if(process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
 try{const f=require('ffmpeg-static');if(f&&fs.existsSync(f))return f;}catch{}
 return 'ffmpeg';
}
module.exports={ROOT,DATA,MUSIC,BOT_NAME,VERSION,IDLE_MINUTES,SNOWFLAKE,envCheck,ffmpegPath};
