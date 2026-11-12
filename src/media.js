'use strict';
const fs=require('node:fs'),path=require('node:path');
const {MUSIC}=require('./config');
const EXT=new Set(['.mp3','.wav','.ogg','.opus','.flac','.m4a','.aac','.webm']);
const YT=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be','www.youtu.be','youtube-nocookie.com','www.youtube-nocookie.com']);
const SPOTIFY=new Set(['open.spotify.com']);
function isPrivateHost(host){
 const h=String(host||'').toLowerCase().replace(/^\[|\]$/g,'');
 if(!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.includes(':')||/^\d+$/.test(h)||/^0x/i.test(h))return true;
 if(/^\d+\.\d+\.\d+\.\d+$/.test(h)){
 const p=h.split('.').map(Number);
 return p.some(n=>n>255)||p[0]===0||p[0]===10||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===192&&p[1]===168)||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===100&&p[1]>=64&&p[1]<=127);
 }
 return false;
}
function validatePublicUrl(source){
 if(typeof source!=='string'||source.length>600)throw Error('Nieprawidłowy adres.');
 let u;try{u=new URL(source);}catch{throw Error('Podaj poprawny URL http(s).');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||isPrivateHost(u.hostname))throw Error('Wymagany jest publiczny URL HTTP(S).');
 return u;
}
function musicFiles(){
 if(!fs.existsSync(MUSIC))return [];
 return fs.readdirSync(MUSIC).filter(f=>EXT.has(path.extname(f).toLowerCase())&&fs.statSync(path.join(MUSIC,f)).isFile()).sort();
}
function localFile(input){
 const name=String(input||'').trim();
 if(!name||name!==path.basename(name)||name.includes('/')||name.includes('\\')||!EXT.has(path.extname(name).toLowerCase()))throw Error('Podaj poprawną nazwę pliku z music/.');
 if(!musicFiles().includes(name))throw Error('Nie znaleziono pliku audio: '+name.slice(0,80));
 return {kind:'file',source:name,title:name.replace(/\.[^.]+$/,'').slice(0,140)};
}
function classifyInput(raw,radios=[]){
 const s=String(raw||'').trim();if(!s||s.length>600)throw Error('Podaj źródło muzyki.');
 const st=radios.find(r=>r.name.toLowerCase()===s.toLowerCase());
 if(st)return{kind:'radio',source:st.url,title:st.name,stationId:st.id};
 if(/^https?:\/\//i.test(s)){
 const u=validatePublicUrl(s),h=u.hostname.toLowerCase();
 if(YT.has(h))return{kind:'youtube-link',source:u.href,title:'YouTube'};
 if(SPOTIFY.has(h))return{kind:'spotify-link',source:u.href,title:'Spotify'};
 return{kind:'stream',source:u.href,title:'Strumień audio'};
 }
 return localFile(s);
}
function restoreTrack(obj){
 if(!obj||typeof obj!=='object')throw Error('Nieprawidłowy utwór na playliście.');
 if(obj.kind==='file')return localFile(obj.source);
 if(obj.kind==='youtube-link'){
  const u=validatePublicUrl(obj.source);
  if(!YT.has(u.hostname.toLowerCase()))throw Error('Niewłaściwy link YouTube.');
  return{kind:'youtube-link',source:u.href,title:String(obj.title||'YouTube').slice(0,140)};
 }
 if(['radio','stream'].includes(obj.kind)){
 const u=validatePublicUrl(obj.source);
 if(YT.has(u.hostname)||SPOTIFY.has(u.hostname))throw Error('YouTube i Spotify nie są bezpośrednim audio.');
 return{kind:obj.kind,source:u.href,title:String(obj.title||'Strumień').slice(0,140),stationId:obj.stationId||undefined};
 }
 throw Error('Nieznany rodzaj utworu.');
}
module.exports={EXT,isPrivateHost,validatePublicUrl,musicFiles,localFile,classifyInput,restoreTrack};
