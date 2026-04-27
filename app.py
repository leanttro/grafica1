"""
app.py — Servidor do Editor de Lacre (Leanttro Tecnologia)

Desenvolvimento:
  python app.py

Produção (via Docker / Dokploy):
  gunicorn app:app --bind 0.0.0.0:8000
"""

import os
import re
from flask import Flask, send_from_directory, jsonify

# ── Configurações ──────────────────────────────────────────────────────────────
HOST     = "0.0.0.0"
PORT     = int(os.environ.get("PORT", 5000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENTRY    = "editor.html"
# ──────────────────────────────────────────────────────────────────────────────

app = Flask(__name__, static_folder=BASE_DIR)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0  # sem cache em dev


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, ENTRY)


@app.route("/api/templates")
def list_templates():
    """
    Varre a pasta do projeto e retorna todos os arquivos lacre*.html
    em ordem numérica. O editor.html consome essa rota ao iniciar.

    Exemplo de resposta:
    [
      { "file": "lacre1.html", "name": "Lacre 1" },
      { "file": "lacre2.html", "name": "Lacre 2" }
    ]
    """
    pattern = re.compile(r'^lacre(\d+)\.html$', re.IGNORECASE)
    templates = []

    for fname in os.listdir(BASE_DIR):
        m = pattern.match(fname)
        if m:
            num = int(m.group(1))
            templates.append({
                "file": fname,
                "name": f"Lacre {num}",
                "order": num
            })

    templates.sort(key=lambda t: t["order"])

    # Remove o campo auxiliar 'order' antes de enviar
    for t in templates:
        del t["order"]

    return jsonify(templates)


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
