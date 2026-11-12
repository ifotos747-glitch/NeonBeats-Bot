'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DATA}=require('./config'),{validatePublicUrl}=require('./media'),store=require('./store');
const FILE=path.join(DATA,'global-radios.json');
const norm=x=>String(x||'').trim().toLocaleLowerCase('pl');
function list(){if(!fs.existsSync(FILE))return [];const d=JSON.parse(fs.readFileSync(FILE,'utf8'));if(!Array.isArray(d))throw Error('Uszkodzony katalog radia');return d;}
function save(all){fs.mkdirSync(DATA,{recursive:true});const tmp=FILE+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(all,null,2),{mode:0o600});fs.renameSync(tmp,FILE);}
function valid(name,url){name=String(name||'').trim();if(name.length<2||name.length>70||/[@\r\n`]/.test(name))throw Error('Nazwa musi mieć 2–70 znaków.');const u=validatePublicUrl(url);if(/(?:^|\.)(youtube\.com|youtu\.be|spotify\.com)$/.test(u.hostname.toLowerCase()))throw Error('Wymagany strumień audio.');return{name,url:u.href};}
function find(x){return list().find(s=>s.id===x||norm(s.name)===norm(x));}
function search(q){return list().filter(s=>norm(s.name).includes(norm(q))).slice(0,25);}
function add(name,url){const all=list(),item=valid(name,url);if(all.some(x=>norm(x.name)===norm(item.name)))throw Error('Stacja o tej nazwie już istnieje.');if(all.length>=1000)throw Error('Limit 1000 stacji.');const st={id:crypto.randomUUID(),...item};all.push(st);save(all);return st;}
function edit(name,newName,url){const all=list(),st=all.find(x=>x.id===name||norm(x.name)===norm(name));if(!st)throw Error('Brak stacji.');const item=valid(newName||st.name,url||st.url);if(all.some(x=>x.id!==st.id&&norm(x.name)===norm(item.name)))throw Error('Nazwa zajęta.');Object.assign(st,item);save(all);return st;}
function remove(name){const all=list(),st=all.find(x=>x.id===name||norm(x.name)===norm(name));if(!st)throw Error('Brak stacji.');save(all.filter(x=>x.id!==st.id));return st;}
function favorites(guildId){const d=store.read(guildId),ids=new Set(list().map(x=>x.id));return(Array.isArray(d.radioFavorites)?d.radioFavorites:[]).filter(x=>ids.has(x));}
function favorite(guildId,id,on){if(!find(id))throw Error('Brak stacji.');const d=store.read(guildId),f=new Set(favorites(guildId));if(on){if(f.size>=50&&!f.has(id))throw Error('Limit 50 ulubionych.');f.add(id);}else f.delete(id);d.radioFavorites=[...f];store.write(guildId,d);}
function migrate(){const all=list(),names=new Set(all.map(s=>norm(s.name)));let added=0;if(!fs.existsSync(DATA))return 0;for(const file of fs.readdirSync(DATA)){if(!/^\d{15,24}\.json$/.test(file))continue;let d;try{d=JSON.parse(fs.readFileSync(path.join(DATA,file),'utf8'));}catch{continue;}for(const st of Array.isArray(d.radios)?d.radios:[]){try{const v=valid(st.name,st.url);if(names.has(norm(v.name)))continue;all.push({id:st.id||crypto.randomUUID(),...v});names.add(norm(v.name));added++;}catch{}}}if(added)save(all);return added;}
module.exports={list,find,search,add,edit,remove,favorites,favorite,migrate};
