'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {MAX_PLAYLIST_ITEMS,isYouTubePlaylistUrl,normalizePlaylistUrl,parsePlaylistEntries,playlistArgs,loadYoutubePlaylist}=require('../src/youtube-playlist');

test('recognizes Youtube and YouTube Music playlists',()=>{
 const playlist='PL1234567890ABCDEFGHI';
 for(const link of [
  'https://www.youtube.com/playlist?list='+playlist,
  'https://music.youtube.com/playlist?list='+playlist,
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list='+playlist,
  'https://youtu.be/dQw4w9WgXcQ?list='+playlist
 ]){
  assert.equal(isYouTubePlaylistUrl(link),true);
  assert.equal(normalizePlaylistUrl(link),'https://www.youtube.com/playlist?list='+playlist);
 }
 assert.equal(isYouTubePlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),false);
});
test('rejects unknown hosts and malformed playlist IDs',()=>{
 for(const link of [
  'https://example.org/playlist?list=PL1234567890',
  'http://localhost/playlist?list=PL1234567890',
  'https://www.youtube.com/playlist?list=bad',
  'https://www.youtube.com/channel/UC123?list=PL1234567890'
 ])assert.throws(()=>normalizePlaylistUrl(link));
});
test('playlist parser keeps order, filters unavailable items, excludes unsafe IDs',()=>{
 const raw=[
  {id:'AAAAAAAAAAA',title:'Pierwszy'},
  {id:'BBBBBBBBBBB',title:'Private video',availability:'private'},
  {id:'CCCCCCCCCCC',title:'Trzeci'},
  {id:'invalid',title:'Nieprawidłowy'}
 ].map(x=>JSON.stringify(x)).join('\n');
 const got=parsePlaylistEntries(raw);
 assert.deepEqual(got.tracks.map(t=>t.title),['Pierwszy','Trzeci']);
 assert.equal(got.skipped,2);
 assert.equal(got.tracks[0].kind,'youtube-link');
});
test('playlist caps metadata extraction to 50 videos',()=>{
 assert.equal(MAX_PLAYLIST_ITEMS,50);
 const args=playlistArgs('https://www.youtube.com/playlist?list=PL1234567890');
 assert.ok(args.includes('--flat-playlist'));
 assert.ok(args.includes('--dump-json'));
 assert.equal(args[args.indexOf('--playlist-end')+1],'50');
 assert.ok(!args.includes('--no-playlist'));
 assert.throws(()=>playlistArgs('https://www.youtube.com/playlist?list=PL1234567890',{limit:51}));
});
test('loads metadata from yt-dlp without downloading videos',async()=>{
 const oldEnv=process.env.YTDLP_PATH;
 process.env.YTDLP_PATH='/fake/yt-dlp';
 try{
  const mockedSpawn=()=>{
   const child=new EventEmitter();
   child.stdout=new PassThrough();child.stderr=new PassThrough();
   child.kill=()=>true;
   process.nextTick(()=>{
    child.stdout.write(JSON.stringify({id:'dQw4w9WgXcQ',title:'Własny test'})+'\n');
    child.stdout.end();child.stderr.end();
    child.emit('close',0,null);
   });
   return child;
  };
  const result=await loadYoutubePlaylist('https://www.youtube.com/playlist?list=PL1234567890',{spawnProcess:mockedSpawn});
  assert.equal(result.tracks.length,1);
  assert.equal(result.tracks[0].title,'Własny test');
 }finally{
  if(oldEnv===undefined)delete process.env.YTDLP_PATH;
  else process.env.YTDLP_PATH=oldEnv;
 }
});
