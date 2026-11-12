'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeYouTubeUrl,youtubeArgs,selectAudioProfile,cleanYtdlpError}=require('../src/youtube');
test('accepts video, shorts and music links',()=>{
 const id='dQw4w9WgXcQ',expected='https://www.youtube.com/watch?v='+id;
 for(const url of [
  'https://www.youtube.com/watch?v='+id+'&list=123',
  'https://youtu.be/'+id+'?t=5',
  'https://music.youtube.com/watch?v='+id,
  'https://www.youtube.com/shorts/'+id,
  'https://www.youtube.com/embed/'+id,
  'https://www.youtube-nocookie.com/embed/'+id
 ])assert.equal(normalizeYouTubeUrl(url),expected);
});
test('rejects channels, playlists, malformed IDs and private hosts',()=>{
 for(const url of [
  'https://evil.example/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/playlist?list=PL123',
  'https://www.youtube.com/watch?v=bad',
  'http://127.0.0.1/watch?v=dQw4w9WgXcQ'
 ])assert.throws(()=>normalizeYouTubeUrl(url));
});
test('yt-dlp uses Node runtime and one video',()=>{
 const args=youtubeArgs('https://youtu.be/dQw4w9WgXcQ',true);
 assert.ok(args.includes('--no-playlist'));
 assert.ok(args.includes('--js-runtimes'));
 assert.ok(args.includes('-o'));
 assert.equal(args[args.length-1],'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});
test('redacts URLs and does not ask users for cookies',()=>{
 const msg=cleanYtdlpError('ERROR: Sign in to confirm you are not a bot: https://example.org/abc?secret=xyz');
 assert.match(msg,/weryfikacji/);
 assert.doesNotMatch(msg,/secret=xyz/);
});

test('YouTube compatibility options are bounded and secure',()=>{
 const args=youtubeArgs('https://youtu.be/dQw4w9WgXcQ',true);
 assert.deepEqual(args.slice(args.indexOf('--retries'),args.indexOf('--retries')+2),['--retries','5']);
 assert.ok(args.includes('--ignore-config'));
 assert.ok(args.includes('--no-playlist'));
});

test('remix retries use alternate yt-dlp audio formats',()=>{
 const url='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
 assert.deepEqual([0,1,2,3].map(selectAudioProfile),['default','m4a','webm','webm']);
 const formats=[0,1,2].map(attempt=>{
  const args=youtubeArgs(url,true,{profile:selectAudioProfile(attempt)});
  return args[args.indexOf('-f')+1];
 });
 assert.equal(new Set(formats).size,3);
 assert.match(formats[1],/m4a/);
 assert.match(formats[2],/webm/);
 assert.throws(()=>youtubeArgs(url,true,{profile:'unknown'}));
});
