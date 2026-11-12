'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeYouTubeUrl,youtubeArgs,selectAudioProfile,cleanYtdlpError,isPyInstallerError,ytDlpEnvironment,ytDlpTempStatus}=require('../src/youtube');
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

test('PyInstaller extraction failures are diagnosed as hosting issues',()=>{
 const log='[PYI-126:ERROR] Failed to extract Cryptodome/Cipher/_ARC4.abi3.so: decompression resulted in return code -1!';
 assert.equal(isPyInstallerError(log),true);
 assert.match(cleanYtdlpError(log),/katalogu tymczasowym/);
 assert.equal(isPyInstallerError('ERROR: video is unavailable'),false);
});
test('custom temporary directory must be absolute',()=>{
 const before=process.env.YTDLP_TMPDIR;
 try{
  process.env.YTDLP_TMPDIR='relative-folder';
  assert.throws(()=>ytDlpEnvironment(),/pełną ścieżką/);
 }finally{
  if(before===undefined)delete process.env.YTDLP_TMPDIR;
  else process.env.YTDLP_TMPDIR=before;
 }
});

test('yt-dlp exposes a writable temporary directory and its free space',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const original=process.env.YTDLP_TMPDIR;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'neon-yt-tmp-'));
 try{
  process.env.YTDLP_TMPDIR=dir;
  const env=ytDlpEnvironment();
  assert.equal(env.TMPDIR,dir);
  assert.equal(env.TEMP,dir);
  const status=ytDlpTempStatus();
  assert.equal(status.path,dir);
  assert.equal(typeof status.availableMB,'number');
 }finally{
  if(original===undefined)delete process.env.YTDLP_TMPDIR;
  else process.env.YTDLP_TMPDIR=original;
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
