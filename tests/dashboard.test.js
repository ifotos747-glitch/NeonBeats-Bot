'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../website/dashboard.html'),'utf8');

test('Web Control dashboard inline JavaScript parses cleanly',()=>{
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
 assert.ok(scripts.length>0,'Dashboard must contain its application script');
 for(const [,script] of scripts)new vm.Script(script,{filename:'dashboard.html'});
});

test('3.4 dashboard retains music, playlist, history, radio and visualizer controls',()=>{
 for(const id of ['loginPanel','controlPanel','guild','cover','radioCover','searchResults','historyList','savedLists','addPlaylist','saveListButton','logout','visualizer','vizBars','vizStatus','radioSearchQuery','radioSearchButton','radioSearchResults','djDescription']){
  assert.ok(html.includes('id="'+id+'"'),'Missing required Web Control element: '+id);
 }
});
