import test from 'node:test';
import assert from 'node:assert/strict';
import {videoId,stamp,toSrt} from './utils.js';
test('aceita links de vídeo e descarta parâmetros de playlist',()=>{
  for(const link of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=anything','https://youtu.be/dQw4w9WgXcQ?t=2','https://m.youtube.com/shorts/dQw4w9WgXcQ','https://youtube.com/live/dQw4w9WgXcQ'])
    assert.equal(videoId(link),'dQw4w9WgXcQ');
});
test('rejeita outros hosts, credenciais, portas e IDs inválidos',()=>{
  for(const link of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','http://youtube.com/watch?v=dQw4w9WgXcQ','https://user@youtube.com/watch?v=dQw4w9WgXcQ','https://youtube.com:8888/watch?v=dQw4w9WgXcQ','https://youtu.be/no','https://localhost/','invalid'])
    assert.throws(()=>videoId(link));
});
test('SRT trata milissegundos, duração superior a uma hora e acentos',()=>{
  assert.equal(stamp(3661.9996),'01:01:02,000');
  assert.equal(toSrt([{text:' Olá! ',timestamp:[0.5,3661.025]}]),'1\n00:00:00,500 --> 01:01:01,025\nOlá!\n');
  assert.equal(toSrt([]),'');
});

