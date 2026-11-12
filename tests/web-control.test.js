'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {safeSnapshot,perform,startWebControl}=require('../src/web-control');
test('snapshots expose only safe playback metadata',()=>{
 const guild={id:'1471988860828516423'};
 const client={guilds:{cache:new Map([[guild.id,guild]])}};
 assert.deepEqual(safeSnapshot(client),[{
  id:guild.id,connected:false,channelId:null,nowSource:null,queueTracks:[],history:[],savedPlaylists:[],favorites:[],stats:{total:0,youtube:0,radio:0,other:0},queueTotal:0,nowPlaying:'',queue:[],
  volume:85,repeat:'off',dj:'off',playerStatus:'idle'
 }]);
});
test('web control is disabled without credentials',()=>{
 const prev={url:process.env.NEONBEATS_CONTROL_URL,secret:process.env.NEONBEATS_CONTROL_SECRET};
 try{
  delete process.env.NEONBEATS_CONTROL_URL;delete process.env.NEONBEATS_CONTROL_SECRET;
  assert.equal(startWebControl({guilds:{cache:new Map()}}),null);
 }finally{for(const [key,value] of Object.entries(prev)){const k=key==='url'?'NEONBEATS_CONTROL_URL':'NEONBEATS_CONTROL_SECRET';if(value===undefined)delete process.env[k];else process.env[k]=value;}}
});
test('remote commands do not control guilds not joined by bot',async()=>{
 const client={guilds:{cache:new Map()}};
 await assert.rejects(perform(client,{guild_id:'1471988860828516423',action:'stop',value:null}),/członkiem/);
});
test('remote commands validate guild IDs and actions',async()=>{
 const client={guilds:{cache:new Map()}};
 await assert.rejects(perform(client,{guild_id:'../../../../etc',action:'stop',value:null}),/Niepoprawne/);
 await assert.rejects(perform(client,{guild_id:'1471988860828516423',action:'eval',value:null}),/Niepoprawne/);
});
