'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {MAX_PLAYLIST_ITEMS,isYouTubePlaylistUrl,normalizePlaylistUrl,parsePlaylistEntries,playlistArgs,videoIdFromItem,loadYoutubePlaylist}=require('../src/youtube-playlist');
test('recognizes YouTube and Music playlists',()=>{
 const list='PL1234567890ABCDEFGHI';
 for(const u of ['https://www.youtube.com/playlist?list='+list,
   'https://music.youtube.com/playlist?list='+list,
   'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list='+list,
   'https://youtu.be/dQw4w9WgXcQ?list='+list])
  assert.equal(normalizePlaylistUrl(u),'https://www.youtube.com/playlist?list='+list);
 assert.equal(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),false);
});
test('rejects untrusted hosts and invalid playlist ids',()=>{
 for(const u of ['https://evil.example/playlist?list=PL1234567890','http://localhost/playlist?list=PL1234567890',
  'https://www.youtube.com/playlist?list=x'])
  assert.throws(()=>normalizePlaylistUrl(u));
});
test('recognizes IDs from flat playlist URL fields when ID is missing',()=>{
 assert.equal(videoIdFromItem({url:'dQw4w9WgXcQ'}),'dQw4w9WgXcQ');
 assert.equal(videoIdFromItem({webpage_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'}),'dQw4w9WgXcQ');
 assert.equal(videoIdFromItem({url:'/watch?v=dQw4w9WgXcQ'}),'dQw4w9WgXcQ');
 assert.equal(videoIdFromItem({url:'https://evil.example/watch?v=dQw4w9WgXcQ'}),null);
});
test('only removes confirmed unavailable and invalid items',()=>{
 const lines=[
  {id:'AAAAAAAAAAA',title:'Pierwszy'},
  {id:'BBBBBBBBBBB',title:'Private video',availability:'private'},
  {url:'https://www.youtube.com/watch?v=CCCCCCCCCCC',title:'Trzeci'},
  {id:'DDDDDDDDDDD',title:null},
  {id:'not-valid',title:'Błędny'}
 ].map(v=>JSON.stringify(v)).join('\n');
 const p=parsePlaylistEntries(lines);
 assert.deepEqual(p.tracks.map(x=>x.source),[
  'https://www.youtube.com/watch?v=AAAAAAAAAAA',
  'https://www.youtube.com/watch?v=CCCCCCCCCCC',
  'https://www.youtube.com/watch?v=DDDDDDDDDDD'
 ]);
 assert.equal(p.skipped,2);
 assert.deepEqual(p.reasons,{unavailable:1,unrecognized:1,invalidMetadata:0});
});
test('supports 100 entries with position-based batches',()=>{
 assert.equal(MAX_PLAYLIST_ITEMS,100);
 const args=playlistArgs('https://www.youtube.com/playlist?list=PL1234567890',{start:101,limit:100});
 assert.equal(args[args.indexOf('--playlist-items')+1],'101:200');
 assert.ok(args.includes('--flat-playlist'));
 assert.ok(args.includes('--dump-json'));
 assert.ok(!args.includes('--no-playlist'));
 assert.throws(()=>playlistArgs('https://www.youtube.com/playlist?list=PL1234567890',{limit:101}));
});
test('metadata is loaded without media downloads',async()=>{
 const old=process.env.YTDLP_PATH;process.env.YTDLP_PATH='/fake/yt-dlp';
 try{
  const spawnMock=(_bin,args)=>{
   assert.ok(args.includes('--dump-json'));
   const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>true;
   process.nextTick(()=>{
    p.stdout.write(JSON.stringify({id:'dQw4w9WgXcQ',title:'Własny test'})+'\n');
    p.stdout.end();p.stderr.end();p.emit('close',0,null);
   });
   return p;
  };
  const r=await loadYoutubePlaylist('https://www.youtube.com/playlist?list=PL1234567890',{spawnProcess:spawnMock});
  assert.equal(r.tracks.length,1);
  assert.equal(r.examined,1);
 }finally{if(old===undefined)delete process.env.YTDLP_PATH;else process.env.YTDLP_PATH=old;}
});

test('playlist yt-dlp uses configured temporary directory',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neon-playlist-'));
 const previous={YTDLP_PATH:process.env.YTDLP_PATH,YTDLP_TMPDIR:process.env.YTDLP_TMPDIR};
 process.env.YTDLP_PATH='/fake/yt-dlp';process.env.YTDLP_TMPDIR=dir;
 try{
  const spawnMock=(_bin,_args,options)=>{
   assert.equal(options.env.TMPDIR,dir);
   const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>true;
   process.nextTick(()=>{p.stdout.end(JSON.stringify({id:'dQw4w9WgXcQ',title:'Remix'})+'\\n');p.stderr.end();p.emit('close',0,null);});
   return p;
  };
  const result=await loadYoutubePlaylist('https://www.youtube.com/playlist?list=PL1234567890',{spawnProcess:spawnMock});
  assert.equal(result.tracks.length,1);
 }finally{
  for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
test('playlist reports PYI library extraction failures instead of no public videos',async()=>{
 const prev=process.env.YTDLP_PATH;process.env.YTDLP_PATH='/fake/yt-dlp';
 try{
  const spawnMock=()=>{
   const p=new EventEmitter();p.stdout=new PassThrough();p.stderr=new PassThrough();p.kill=()=>true;
   process.nextTick(()=>{p.stdout.end();p.stderr.end('[PYI-99:ERROR] Failed to extract Cryptodome/Cipher/_ARC4.abi3.so');p.emit('close',255,null);});
   return p;
  };
  await assert.rejects(loadYoutubePlaylist('https://www.youtube.com/playlist?list=PL1234567890',{spawnProcess:spawnMock}),/Błąd uruchomienia yt-dlp/);
 }finally{if(prev===undefined)delete process.env.YTDLP_PATH;else process.env.YTDLP_PATH=prev;}
});
