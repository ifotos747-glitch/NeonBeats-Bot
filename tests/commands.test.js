'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let commands;
try{({commands}=require('../src/commands'));}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
test('slash commands are valid and distinct',{skip:!commands?'discord.js installed by CI':false},()=>{
 const defs=commands.map(c=>c.toJSON()),names=defs.map(c=>c.name);
 assert.equal(new Set(names).size,names.length);
 for(const required of ['play','radio','247','autodj','dj','playlist','panel','status','testaudio'])assert.ok(names.includes(required));
 assert.ok(defs.length>=15);
});
