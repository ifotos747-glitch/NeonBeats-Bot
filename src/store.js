'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DATA,SNOWFLAKE}=require('./config');
const {validatePublicUrl,restoreTrack}=require('./media');
const {PRESETS}=require('./effects');
function location(id){if(!SNOWFLAKE.test(String(id)))throw Error('Niepoprawne ID serwera');return path.join(DATA,String(id)+'.json');}
function fresh(){return{version:1,radios:[],radioFavorites:[],playlists:{},history:[],favorites:[],stats:{total:0,youtube:0,radio:0,other:0},dj:'off',alwaysOn:null};}
function read(id){
 const file=location(id);if(!fs.existsSync(file))return fresh();
 let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw Error('Uszkodzony zapis serwera: '+path.basename(file));}
 const d=fresh();
 if(Array.isArray(data.radios))d.radios=data.radios.filter(x=>x&&typeof x.name==='string'&&typeof x.url==='string'&&typeof x.id==='string');
 if(Array.isArray(data.radioFavorites))d.radioFavorites=data.radioFavorites.filter(x=>typeof x==='string').slice(0,50);
 if(data.playlists&&typeof data.playlists==='object'&&!Array.isArray(data.playlists))d.playlists=data.playlists;
 if(Array.isArray(data.history))d.history=data.history.filter(x=>x&&typeof x.title==='string').slice(0,60);
 if(Array.isArray(data.favorites))d.favorites=data.favorites.filter(x=>x&&x.kind==='youtube-link'&&typeof x.source==='string'&&typeof x.title==='string').slice(0,100);
 if(data.stats&&typeof data.stats==='object')for(const k of ['total','youtube','radio','other'])d.stats[k]=Math.max(0,Math.floor(Number(data.stats[k])||0));
 if(Object.hasOwn(PRESETS,data.dj))d.dj=data.dj;
 if(data.alwaysOn&&['radio','autodj','silent'].includes(data.alwaysOn.mode))d.alwaysOn=data.alwaysOn;
 return d;
}
function write(id,d){
 const file=location(id);fs.mkdirSync(DATA,{recursive:true});
 const tmp=file+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(d,null,2),{mode:0o600});fs.renameSync(tmp,file);return d;
}
function addRadio(id,name,url){
 name=String(name||'').trim().slice(0,70);
 if(name.length<2||/[@\n\r`]/.test(name))throw Error('Nazwa stacji musi mieć 2-70 znaków.');
 const u=validatePublicUrl(url),h=u.hostname.toLowerCase();
 if(/(?:^|\.)(?:youtube\.com|youtu\.be|spotify\.com)$/.test(h))throw Error('Wymagany bezpośredni strumień, nie strona YouTube/Spotify.');
 const d=read(id);if(d.radios.length>=30)throw Error('Limit 30 stacji.');
 if(d.radios.some(r=>r.name.toLowerCase()===name.toLowerCase()))throw Error('Stacja o tej nazwie już istnieje.');
 const st={id:crypto.randomUUID(),name,url:u.href};d.radios.push(st);write(id,d);return st;
}
function removeRadio(id,name){
 const d=read(id),st=d.radios.find(r=>r.name.toLowerCase()===String(name).toLowerCase());
 if(!st)throw Error('Nie znaleziono stacji.');
 d.radios=d.radios.filter(r=>r.id!==st.id);
 if(d.alwaysOn?.stationId===st.id)d.alwaysOn=null;
 write(id,d);return st;
}
function savePlaylist(id,name,tracks){
 name=String(name||'').trim().slice(0,40);
 if(!name||/[@\n\r`]/.test(name))throw Error('Nieprawidłowa nazwa playlisty.');
 const d=read(id);
 if(!Object.hasOwn(d.playlists,name)&&Object.keys(d.playlists).length>=25)throw Error('Limit 25 playlist.');
 d.playlists[name]=tracks.filter(x=>x&&['file','radio','stream','youtube-link'].includes(x.kind)).slice(0,100).map(t=>({kind:t.kind,source:t.source,title:t.title,stationId:t.stationId}));
 write(id,d);return d.playlists[name].length;
}
function loadPlaylist(id,name){
 const d=read(id),list=d.playlists[String(name||'')];
 if(!Array.isArray(list))throw Error('Nie znaleziono playlisty.');
 return list.map(restoreTrack);
}
function deletePlaylist(id,name){
 const d=read(id);if(!Object.hasOwn(d.playlists,name))throw Error('Nie znaleziono playlisty.');
 delete d.playlists[name];write(id,d);
}
function recordPlay(id,track){
 if(!track||!track.title)return;
 const d=read(id),last=d.history[0];
 if(last&&last.source===track.source&&Date.now()-last.at<120000)return;
 d.history.unshift({title:String(track.title).slice(0,140),source:String(track.source||'').slice(0,500),kind:String(track.kind||''),at:Date.now()});
 d.stats.total++;
 d.stats[track.kind==='youtube-link'?'youtube':track.kind==='radio'?'radio':'other']++;
 d.history=d.history.slice(0,60);write(id,d);
}
function addFavorite(id,source,title){
 if(typeof source!=='string'||!/^https:\/\/www\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]{11}$/.test(source))throw Error('Ulubione: wymagany poprawny link do filmu YouTube.');
 const d=read(id);
 if(d.favorites.some(t=>t.source===source))return false;
 if(d.favorites.length>=100)throw Error('Limit 100 ulubionych utworów.');
 d.favorites.push({kind:'youtube-link',source,title:String(title||'YouTube').slice(0,140)});write(id,d);return true;
}
function removeFavorite(id,source){
 const d=read(id),before=d.favorites.length;
 d.favorites=d.favorites.filter(t=>t.source!==source);
 if(d.favorites.length===before)throw Error('Nie znaleziono ulubionego utworu.');
 write(id,d);
}
function setDJ(id,preset){
 if(!Object.hasOwn(PRESETS,preset))throw Error('Nieznany preset DJ.');
 const d=read(id);d.dj=preset;write(id,d);
}
function set247(id,config){const d=read(id);d.alwaysOn=config;write(id,d);}
module.exports={read,write,addRadio,removeRadio,savePlaylist,loadPlaylist,deletePlaylist,recordPlay,addFavorite,removeFavorite,setDJ,set247};
