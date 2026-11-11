'use strict';
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {validatePublicUrl}=require('./media');

const REDIRECTS=new Set([301,302,303,307,308]);

async function openAudioResponse(rawUrl,{fetchImpl=fetch,signal,maxRedirects=5}={}){
 let url=validatePublicUrl(rawUrl).href;
 for(let hop=0;hop<=maxRedirects;hop++){
  // No automatic redirects: validate each new target before connecting.
  const response=await fetchImpl(url,{
   method:'GET',redirect:'manual',signal,
   headers:{'User-Agent':'NeonBeatsBot/1.0','Accept':'audio/*,*/*;q=0.8','Icy-MetaData':'0'}
  });
  if(REDIRECTS.has(response.status)){
   const location=response.headers.get('location');
   if(response.body?.cancel)await response.body.cancel().catch(()=>{});
   if(!location)throw Error('HTTP '+response.status+': brak adresu przekierowania');
   if(hop===maxRedirects)throw Error('Zbyt wiele przekierowań HTTP');
   url=validatePublicUrl(new URL(location,url).href).href;
   continue;
  }
  if(!response.ok){
   if(response.body?.cancel)await response.body.cancel().catch(()=>{});
   throw Error('HTTP '+response.status);
  }
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(/(?:text\/html|application\/json)/.test(type)){
   if(response.body?.cancel)await response.body.cancel().catch(()=>{});
   throw Error('Serwer zwrócił stronę zamiast strumienia audio ('+type.slice(0,40)+')');
  }
  if(!response.body)throw Error('Brak danych odpowiedzi HTTP');
  return{response,finalHost:new URL(url).hostname,redirects:hop};
 }
 throw Error('Zbyt wiele przekierowań HTTP');
}

async function pipeHttpAudio(url,destination,{signal,fetchImpl=fetch}={}){
 const {response}=await openAudioResponse(url,{signal,fetchImpl});
 await pipeline(Readable.fromWeb(response.body),destination,{signal});
}
module.exports={openAudioResponse,pipeHttpAudio};
