# Decupa ◧
Transcrição local com Whisper, sem assinatura, chave de API ou cota de minutos definida pelo aplicativo.

## Três formas de usar
| Fonte | Como funciona | Precisa de servidor? |
| --- | --- | --- |
| Link do YouTube | yt-dlp obtém o áudio e faster-whisper transcreve no computador | Sim, servidor local abaixo |
| Áudio da aba | Compartilhe uma aba com áudio, reproduza o vídeo e encerre a captura | Não |
| Arquivo | Selecione um áudio ou vídeo e transcreva no navegador | Não |

A interface pode ser publicada no GitHub Pages. O Pages **não executa Python**; colar um link não funciona sem o servidor local. A captura da aba é em tempo real, não baixa o vídeo. Arquivos e capturas são processados por Transformers.js em um Web Worker. O modelo é baixado de Hugging Face na primeira execução; o motor vem do jsDelivr. O áudio não é enviado a serviços de transcrição.

## Link direto: servidor local
Recomendado Python 3.11 ou 3.12. Não precisa de uma API paga.
```powershell
git clone https://github.com/GustavoCostaAM/youtube-transcriber.git
cd youtube-transcriber
py -3.11 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python server.py
```
No Linux/macOS: use `python3 -m venv .venv` e `.venv/bin/python` nos comandos seguintes.

Abra a interface publicada e escolha **Link do YouTube**. Se o navegador perguntar, permita ao site acessar o servidor local. Se o navegador bloquear a conexão do Pages com localhost, abra a interface também localmente, em outro terminal:
```sh
python -m http.server 8000 --bind 127.0.0.1
```
Acesse http://localhost:8000. O servidor de transcrição escuta apenas em 127.0.0.1:8765, valida Host e Origin e aceita somente URLs de vídeo do YouTube. Nunca o exponha à internet sem autenticação. Uma transcrição roda por vez para proteger a memória; não há cota de uso. Cancelar no navegador interrompe a espera, mas um trabalho já enviado ao servidor continua até acabar.

O download do YouTube pode precisar de um runtime JavaScript compatível (Node/Deno) e componentes do yt-dlp. Consulte a [documentação oficial](https://github.com/yt-dlp/yt-dlp#dependencies) se a extração falhar. Restrições de região, login, conteúdo privado, bloqueios e mudanças no YouTube podem impedir downloads. O aplicativo não contorna essas restrições. Mantenha yt-dlp atualizado:
```sh
python -m pip install --upgrade "yt-dlp[default]"
```
O modelo padrão do servidor é Whisper Base (CPU/int8). Defina `WHISPER_MODEL` antes de iniciar para usar outro modelo suportado pelo faster-whisper. O seletor do site controla somente o modelo no navegador.

## Áudio da aba
1. Abra o vídeo em outra aba no Chrome ou Edge desktop.
2. No Decupa, escolha **Áudio da aba** e inicie.
3. Selecione a aba do vídeo e marque **Compartilhar áudio da aba**.
4. Reproduza o vídeo e clique em **Encerrar captura**.
5. Aguarde a transcrição, revise e exporte.

## Limites reais
Não existe garantia de funcionamento ilimitado. CPU, RAM, armazenamento, velocidade, codecs do navegador e disponibilidade das dependências continuam sendo limites. A captura fica em memória até ser encerrada; arquivos são decodificados inteiros em memória e vídeos longos podem exigir o servidor local. O Whisper pode errar ou inventar texto, especialmente no silêncio. Não há identificação de falantes. Transmissões ao vivo em andamento não são aceitas por link. Use conteúdo que você tenha autorização para processar.

O resultado é editável. Copiar/TXT usam as edições; SRT usa os segmentos e tempos originais do modelo. Não há histórico persistido: exporte antes de fechar a página.

## Desenvolvimento e testes
Sem instalação de dependências JavaScript:
```sh
npm test
npm run check
python -m unittest discover -s . -p "test_*.py"
python -m http.server 8000 --bind 127.0.0.1
```
Os testes de servidor usam um transcritor simulado; não validam downloads reais do YouTube nem a qualidade do modelo. O fluxo completo deve ser verificado com áudio e vídeo reais no navegador.

## Publicar
Settings → Pages → Deploy from a branch → main → / (root). O arquivo .nojekyll dispensa Jekyll. CI executa testes JS/Python em pushes e pull requests.

## Componentes
- [Transformers.js](https://huggingface.co/docs/transformers.js) / [Whisper Tiny](https://huggingface.co/Xenova/whisper-tiny)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

Código deste projeto sob MIT. Modelos e dependências mantêm suas próprias licenças.

