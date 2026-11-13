'use strict';
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.NEONBEATS_DATA_DIR || path.join(ROOT, 'data'));
const MUSIC = path.resolve(process.env.NEONBEATS_MUSIC_DIR || path.join(ROOT, 'music'));
const BOT_NAME = 'NeonBeats Bot';
function hostLabel(env=process.env){
 const raw=String(env.NEONBEATS_HOST_LABEL||'').trim().replace(/[^a-zA-Z0-9 _.-]/g,'');
 return raw.slice(0,36)||'nieoznaczony';
}
const HOST_LABEL=hostLabel();
const VERSION = require('../package.json').version;
// 0 disables automatic disconnect while idle; 2..120 sets a timeout.
// Missing or malformed values retain the previous 15-minute default.
function parseIdleMinutes(raw){
 if(raw===undefined||raw===null||String(raw).trim()==='')return 15;
 const minutes=Number(raw);
 if(!Number.isFinite(minutes)||minutes<0)return 15;
 if(minutes===0)return 0;
 return Math.max(2,Math.min(120,minutes));
}
const IDLE_MINUTES = parseIdleMinutes(process.env.IDLE_MINUTES);
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
module.exports={ROOT,DATA,MUSIC,BOT_NAME,HOST_LABEL,hostLabel,VERSION,IDLE_MINUTES,parseIdleMinutes,SNOWFLAKE,envCheck,ffmpegPath};
