import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let transcriber, loadedModel;
self.onmessage = async ({data}) => {
  try {
    if (!transcriber || loadedModel !== data.model) {
      if (transcriber) await transcriber.dispose();
      loadedModel = data.model;
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-'+data.model, {
        quantized: true,
        progress_callback: p => self.postMessage({type:'progress', message: p.status==='progress' ? 'Baixando modelo: '+Math.round(p.progress)+'%' : 'Preparando Whisper…'})
      });
    }
    self.postMessage({type:'progress',message:'Transcrevendo no seu computador. Vídeos longos podem levar bastante tempo…'});
    const result = await transcriber(data.audio, {language:data.language,task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:true});
    const duration = data.audio.length / 16000;
    result.chunks = (result.chunks || []).map(c=>({...c,timestamp:[c.timestamp[0] ?? 0,c.timestamp[1] ?? duration]}));
    self.postMessage({type:'done', result});
  } catch (e) { self.postMessage({type:'error',message:e.message || String(e)}); }
};

