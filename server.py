"""Loopback-only YouTube transcription bridge. No account, API key or app quota."""
import json
import os
import re
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ALLOWED_ORIGINS = {
    "https://gustavocostaam.github.io",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
}
LANGUAGES = {"portuguese": "pt", "english": "en", "spanish": "es", "french": "fr", "german": "de"}
MODEL_LOCK = threading.Lock()
MODEL = None

def canonical_url(value):
    if not isinstance(value, str):
        raise ValueError("Informe um link do YouTube.")
    u = urlparse(value)
    if u.scheme != "https" or u.username or u.password or u.port:
        raise ValueError("Use um link HTTPS do YouTube.")
    if u.hostname == "youtu.be":
        video = u.path.strip("/").split("/")[0]
    elif u.hostname in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        match = re.fullmatch(r"/(?:shorts|embed|live)/([^/]+)/?", u.path)
        video = parse_qs(u.query).get("v", [""])[0] if u.path == "/watch" else (match[1] if match else "")
    else:
        raise ValueError("Somente links do YouTube são aceitos.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video):
        raise ValueError("ID de vídeo inválido.")
    return "https://www.youtube.com/watch?v=" + video

def transcribe(url, language):
    # Lazy imports let validation tests run without downloading a model.
    from yt_dlp import YoutubeDL
    from faster_whisper import WhisperModel
    global MODEL
    with tempfile.TemporaryDirectory(prefix="decupa-") as directory:
        options = {
            "format": "bestaudio/best", "noplaylist": True,
            "outtmpl": str(Path(directory) / "audio.%(ext)s"),
            "quiet": True, "no_warnings": True,
            "restrictfilenames": True,
            # Reject ongoing live broadcasts; completed videos have no app duration cap.
            "match_filter": lambda info, *, incomplete=False: "Aguarde a transmissão terminar." if info.get("is_live") else None,
        }
        with YoutubeDL(options) as downloader:
            info = downloader.extract_info(url, download=True)
            if not info:
                raise ValueError("Vídeo indisponível ou transmissão ao vivo ainda ativa.")
            filename = downloader.prepare_filename(info)
        if MODEL is None:
            MODEL = WhisperModel(os.environ.get("WHISPER_MODEL", "base"), device="cpu", compute_type="int8")
        segments, metadata = MODEL.transcribe(filename, language=LANGUAGES[language], vad_filter=True)
        chunks = [{"text": s.text.strip(), "timestamp": [s.start, s.end]} for s in segments]
        return {"text": " ".join(s["text"] for s in chunks), "chunks": chunks, "language": metadata.language}

class Handler(BaseHTTPRequestHandler):
    def allowed(self):
        # Also protect against DNS rebinding and cross-origin drive-by requests.
        return self.headers.get("Host") in {"localhost:8765", "127.0.0.1:8765"} and self.headers.get("Origin") in ALLOWED_ORIGINS

    def response(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.response(200 if self.allowed() else 403, {})

    def do_POST(self):
        if not self.allowed():
            return self.response(403, {"error": "Origem ou host não autorizado."})
        if self.path != "/transcribe":
            return self.response(404, {"error": "Rota não encontrada."})
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 8192:
                return self.response(400, {"error": "Pedido JSON inválido."})
            if self.headers.get_content_type() != "application/json":
                return self.response(415, {"error": "Envie application/json."})
            body = json.loads(self.rfile.read(size))
            if not isinstance(body, dict):
                raise ValueError("Pedido JSON inválido.")
            url = canonical_url(body.get("url"))
            language = body.get("language", "portuguese")
            if language not in LANGUAGES:
                raise ValueError("Idioma não suportado.")
        except (ValueError, TypeError) as error:
            return self.response(400, {"error": str(error)})
        if not MODEL_LOCK.acquire(blocking=False):
            return self.response(409, {"error": "Uma transcrição já está em andamento neste computador. Aguarde a conclusão."})
        try:
            self.response(200, transcribe(url, language))
        except Exception:
            self.response(502, {"error": "Falha ao obter ou transcrever o vídeo. Ele pode estar privado, restrito ou bloqueado pelo YouTube. Atualize yt-dlp e consulte o terminal."})
            import traceback
            traceback.print_exc()
        finally:
            MODEL_LOCK.release()

if __name__ == "__main__":
    print("Decupa em http://localhost:8765 — mantenha este terminal aberto.")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()

