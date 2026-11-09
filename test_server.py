import io
import json
import unittest
from email.message import Message
from unittest.mock import patch
from server import Handler, canonical_url

class TestBridge(unittest.TestCase):
    def test_urls(self):
        self.assertEqual(canonical_url("https://youtu.be/dQw4w9WgXcQ?t=2"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
        for value in [None, "http://youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://user@youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/invalid"]:
            with self.assertRaises(ValueError):
                canonical_url(value)

    def request(self, origin, body, host="localhost:8765"):
        handler = Handler.__new__(Handler)
        raw = json.dumps(body).encode()
        handler.headers = Message()
        for key, value in {"Host": host, "Origin": origin, "Content-Type": "application/json", "Content-Length": str(len(raw))}.items():
            handler.headers[key] = value
        handler.path = "/transcribe"
        handler.rfile = io.BytesIO(raw)
        handler.wfile = io.BytesIO()
        handler.send_response = lambda status: setattr(handler, "response_status", status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        handler.do_POST()
        return handler.response_status, json.loads(handler.wfile.getvalue())

    def test_http_origin_validation_and_success(self):
        body = {"url": "https://youtu.be/dQw4w9WgXcQ", "language": "portuguese"}
        self.assertEqual(self.request("https://evil.test", body)[0], 403)
        self.assertEqual(self.request("http://localhost:8000", body, "evil.test:8765")[0], 403)
        self.assertEqual(self.request("http://localhost:8000", {"url": "https://localhost"})[0], 400)
        with patch("server.transcribe", return_value={"text": "Olá", "chunks": []}) as mock:
            status, result = self.request("https://gustavocostaam.github.io", body)
            self.assertEqual(status, 200)
            self.assertEqual(result["text"], "Olá")
            mock.assert_called_once_with("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "portuguese")

if __name__ == "__main__":
    unittest.main()

