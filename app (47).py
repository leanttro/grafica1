"""
app.py — Servidor do Editor de Lacre (Leanttro Tecnologia)

Desenvolvimento:
  python app.py

Produção (via Docker / Dokploy):
  gunicorn app:app --bind 0.0.0.0:8000
"""

import os
from flask import Flask, send_from_directory

# ── Configurações ──────────────────────────────────────────────────────────────
HOST      = "0.0.0.0"
PORT      = int(os.environ.get("PORT", 5000))
BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
ENTRY     = "editor.html"
# ──────────────────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=BASE_DIR)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0  # sem cache em dev


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, ENTRY)


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


if __name__ == "__main__":
    print("=" * 48)
    print("  Editor de Lacre — Leanttro Tecnologia")
    print(f"  Servidor: http://127.0.0.1:{PORT}/")
    print("  Pressione Ctrl+C para encerrar.")
    print("=" * 48)
    app.run(host=HOST, port=PORT, debug=False)
