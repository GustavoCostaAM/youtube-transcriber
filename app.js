import { videoId, toSrt } from './utils.js';
const $ = id => document.getElementById(id);
let mode = 'youtube', worker, recorder, stream, chunks = [], controller, busy = false, run = 0, discardCapture = false;
function status(text) { $('status').textContent = text; }
function setBusy(value) {
  busy = value;
  $('start').disabled = value;
  $('cancel').hidden = !value;
  $('progress').hidden = !value;
  for (const el of document.querySelectorAll('.tab, #language, #model, #media, #url')) el.disabled = value;
}
function updateExports() {
  const text = $('output').value.trim();
  $('count').textContent = (text ? text.split(/\s+/).length : 0)+' palavras';
  $('copy').disabled = $('txt').disabled = !text;
  $('srt').disabled = !chunks.length;
}
function result(data) {
  chunks = data.chunks || [];
  $('output').value = data.text || '';
  updateExports();
  status(data.text?.trim() ? 'Transcrição concluída. Revise o texto antes de usar.' : 'Nenhuma fala foi identificada neste áudio.');
  setBusy(false);
}
function fail(error) {
  status(error.name === 'AbortError' ? 'Operação cancelada.' : 'Não foi possível concluir: '+error.message);
  setBusy(false);
}
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click',()=>{
  mode = button.dataset.mode;
  document.querySelectorAll('.tab').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  for (const name of ['youtube','file','tab']) $(name).hidden = name !== mode;
  $('start').textContent = mode === 'tab' ? 'Capturar áudio da aba ↗' : mode === 'file' ? 'Transcrever arquivo ↗' : 'Transcrever vídeo ↗';
  status('Pronto para começar.');
}));
function transcribe(audio, token) {
  if (token !== run) return;
  worker ||= new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage = ({data})=>{
    if (token !== run) return;
    if (data.type==='progress') status(data.message);
    if (data.type==='done') result(data.result);
    if (data.type==='error') {worker.terminate();worker=null;fail(new Error(data.message));}
  };
  worker.onerror = ()=>{worker?.terminate();worker=null;fail(new Error('Falha ao carregar o motor. Verifique sua conexão e o suporte a WebAssembly.'));};
  worker.postMessage({audio,model:$('model').value,language:$('language').value},[audio.buffer]);
}
async function decode(blob, token) {
  status('Preparando áudio…');
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (token !== run) return;
    const offline = new OfflineAudioContext(1,Math.ceil(decoded.duration*16000),16000);
    const source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    transcribe(rendered.getChannelData(0).slice(),token);
  } finally { await context.close(); }
}
function stopTracks() { stream?.getTracks().forEach(t=>t.stop()); stream=null; $('stop').hidden=true; }
async function capture(token) {
  if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) throw new Error('Use Chrome ou Edge desktop para capturar uma aba.');
  stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:true,preferCurrentTab:false});
  if (token !== run) {stopTracks(); return;}
  if (!stream.getAudioTracks().length) {stopTracks(); throw new Error('Selecione uma aba com a opção Compartilhar áudio marcada.');}
  const parts = [];
  discardCapture = false;
  recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks()));
  recorder.ondataavailable = e => {if(e.data.size) parts.push(e.data);};
  recorder.onerror = ()=>{discardCapture=true;stopTracks();fail(new Error('A captura de áudio falhou.'));};
  recorder.onstop = async ()=>{
    const mime = recorder.mimeType;
    recorder=null; stopTracks();
    if (discardCapture || token !== run) return;
    try { await decode(new Blob(parts,{type:mime}),token); } catch(e) {if(token===run) fail(e);}
  };
  stream.getVideoTracks()[0].onended = ()=>{if(recorder?.state==='recording') recorder.stop();};
  recorder.start(1000);
  $('stop').hidden=false;
  status('Capturando áudio. Reproduza o vídeo e clique em Encerrar captura ao terminar. A captura usa memória enquanto estiver ativa.');
}
$('stop').onclick = ()=>{if(recorder?.state==='recording') recorder.stop();};
$('cancel').onclick = ()=>{
  run++; discardCapture=true; controller?.abort(); worker?.terminate();worker=null;
  if(recorder?.state==='recording') recorder.stop();
  stopTracks();setBusy(false);status('Operação cancelada. A última transcrição foi preservada. Um trabalho já enviado ao servidor local pode continuar até terminar.');
};
$('start').onclick = async ()=>{
  if(busy) return;
  const token = ++run;
  setBusy(true);
  try {
    if(mode==='youtube') {
      const id=videoId($('url').value.trim());
      controller=new AbortController();
      status('O servidor local vai baixar o áudio e transcrever. O primeiro uso também baixa o modelo. Aguarde…');
      let response;
      try {
        response=await fetch('http://localhost:8765/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://www.youtube.com/watch?v='+id,language:$('language').value}),signal:controller.signal});
      } catch(e) {
        if(e.name==='AbortError') throw e;
        throw new Error('Servidor local indisponível ou acesso bloqueado pelo navegador. Inicie-o conforme o README, permita acesso à rede local se solicitado, ou use Áudio da aba.');
      }
      const data=await response.json();
      if(!response.ok) throw new Error(data.error || 'O servidor retornou um erro.');
      if(token===run) result(data);
    } else if(mode==='file') {
      const file=$('media').files[0];
      if(!file) throw new Error('Selecione um arquivo de áudio ou vídeo.');
      await decode(file,token);
    } else await capture(token);
  } catch(e) {if(token===run) fail(e);}
};
$('output').addEventListener('input',updateExports);
$('copy').onclick = async ()=>{try {await navigator.clipboard.writeText($('output').value);status('Texto copiado.');}catch{status('Não foi possível copiar. Selecione o texto e use Ctrl+C.');}};
function download(text,extension,type) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const link=document.createElement('a');link.href=url;link.download='decupa-transcricao.'+extension;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('txt').onclick = ()=>download($('output').value,'txt','text/plain;charset=utf-8');
$('srt').onclick = ()=>download(toSrt(chunks),'srt','application/x-subrip;charset=utf-8');
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});

