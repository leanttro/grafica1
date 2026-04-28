import os
import re
import fitz  # PyMuPDF - Requer: pip install PyMuPDF
from flask import (
    Flask, send_from_directory, jsonify,
    request, session, redirect, url_for, Response
)

# ── Configurações ──────────────────────────────────────────────────────────────
HOST       = "0.0.0.0"
PORT       = int(os.environ.get("PORT", 5000))
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
ENTRY      = "home.html"          # Página inicial agora é o home
SECRET_KEY = os.environ.get("SECRET_KEY", "")

# Extensões de arquivo que podem ser servidas ao cliente
ALLOWED_EXTENSIONS = {".html", ".js", ".css", ".png", ".jpg", ".jpeg",
                      ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf"}

# Arquivos HTML que são de sistema (não são templates de lacre)
SYSTEM_HTML_FILES = {
    "home.html",
    "editor.html",
    "editor_dtf.html",
    "editor_serigrafia.html",
    "editor_mouse.html",
}
# ──────────────────────────────────────────────────────────────────────────────

if not SECRET_KEY:
    raise RuntimeError(
        "Variável de ambiente SECRET_KEY não definida. "
        "Defina-a antes de iniciar o servidor."
    )

app = Flask(__name__, static_folder=BASE_DIR)
app.secret_key = SECRET_KEY
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


def load_users() -> dict:
    """
    Lê todas as variáveis de ambiente que começam com USER
    (ex: USER1, USER2, USER_fulano) e retorna {username: senha}.
    O username é a parte depois de USER (em minúsculas).
    """
    users = {}
    pattern = re.compile(r'^USER(.+)$')
    for key, value in os.environ.items():
        m = pattern.match(key)
        if m:
            username = m.group(1).lstrip('_').lower()  # USER_Fulano → fulano
            users[username] = value
    return users


def friendly_name(filename: str) -> str:
    """
    Converte o nome do arquivo em um nome amigável para exibição.
    Ex: lacre2x1-1.html → Lacre 2x1-1
        branco.html      → Branco
        1x1cm_numerado.html → 1x1cm Numerado
    """
    name = filename.replace(".html", "")
    # Substitui underscores por espaço, preserva hífens
    name = name.replace("_", " ")
    # Capitaliza cada palavra
    name = " ".join(word.capitalize() for word in name.split())
    return name


LOGIN_PAGE = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Leanttro</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: #0f0f10;
    color: #f0f0f1;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: #18181b;
    border: 1px solid #2e2e32;
    border-radius: 12px;
    padding: 40px 36px;
    width: 100%;
    max-width: 360px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .brand { font-size: 13px; font-weight: 600; color: #f0f0f1; }
  .brand span { color: #71717a; font-weight: 400; }
  h1 { font-size: 20px; font-weight: 600; }
  .fields { display: flex; flex-direction: column; gap: 14px; }
  label { font-size: 10px; font-weight: 700; letter-spacing: 1.2px;
          text-transform: uppercase; color: #71717a; display: block; margin-bottom: 6px; }
  input {
    width: 100%; background: #222226; border: 1px solid #2e2e32;
    border-radius: 8px; color: #f0f0f1; font-family: inherit;
    font-size: 14px; padding: 10px 14px; outline: none;
    transition: border-color 0.15s;
  }
  input:focus { border-color: #2563eb; }
  .error {
    font-size: 12px; color: #f87171;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.2);
    border-radius: 8px; padding: 10px 12px;
    display: {display_error};
  }
  button {
    width: 100%; padding: 12px; background: #2563eb; border: none;
    border-radius: 8px; color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: opacity 0.15s;
  }
  button:hover { opacity: 0.88; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">Leanttro <span>/ Editor de Lacre</span></div>
    <h1>Entrar</h1>
    <form method="POST" action="/login">
      <div class="fields">
        <div>
          <label>Usuário</label>
          <input type="text" name="username" autocomplete="username" required autofocus>
        </div>
        <div>
          <label>Senha</label>
          <input type="password" name="password" autocomplete="current-password" required>
        </div>
        <div class="error">{error_msg}</div>
        <button type="submit">Entrar</button>
      </div>
    </form>
  </div>
</body>
</html>"""


def render_login(error: str = "") -> str:
    return LOGIN_PAGE.replace(
        "{display_error}", "block" if error else "none"
    ).replace("{error_msg}", error)


def login_required(f):
    """Decorator que redireciona para /login se não houver sessão ativa."""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


# ── Rotas de autenticação ──────────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if session.get("user"):
        return redirect("/")

    if request.method == "POST":
        username = request.form.get("username", "").strip().lower()
        password = request.form.get("password", "")
        users = load_users()

        if username in users and users[username] == password:
            session["user"] = username
            return redirect("/")
        return Response(render_login("Usuário ou senha incorretos."), status=401, mimetype="text/html")

    return Response(render_login(), mimetype="text/html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Rotas protegidas ───────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    """Página inicial — Central de Editores."""
    return send_from_directory(BASE_DIR, "home.html")


@app.route("/lacre")
@login_required
def lacre():
    """Editor de Lacre / Etiqueta Digital."""
    return send_from_directory(BASE_DIR, "editor.html")


@app.route("/serigrafia")
@login_required
def serigrafia():
    """Editor de Serigrafia."""
    return send_from_directory(BASE_DIR, "editor_serigrafia.html")


@app.route("/dtf")
@login_required
def dtf():
    """Editor DTF / Transfer."""
    return send_from_directory(BASE_DIR, "editor_dtf.html")


@app.route("/mousepad")
@login_required
def mousepad():
    """Editor de Mouse Pad."""
    return send_from_directory(BASE_DIR, "editor_mouse.html")


@app.route("/api/convert-pdf-to-svg", methods=["POST"])
@login_required
def convert_pdf_to_svg():
    if 'file' not in request.files:
        return Response("Nenhum arquivo enviado.", status=400)

    file = request.files['file']
    if file.filename == '':
        return Response("Arquivo inválido.", status=400)

    try:
        pdf_bytes = file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[0]
        svg_content = page.get_svg_image()
        doc.close()
        return Response(svg_content, mimetype="image/svg+xml")
    except Exception as e:
        return Response(f"Erro ao converter PDF: {str(e)}", status=500)


@app.route("/api/templates")
@login_required
def list_templates():
    """
    Lista todos os arquivos .html do diretório que não são arquivos de sistema.
    Qualquer novo template adicionado aparece automaticamente — sem precisar
    alterar este arquivo.
    """
    templates = []

    for fname in sorted(os.listdir(BASE_DIR)):
        if not fname.endswith(".html"):
            continue
        if fname in SYSTEM_HTML_FILES:
            continue

        templates.append({
            "file": fname,
            "name": friendly_name(fname),
        })

    return jsonify(templates)


@app.route("/<path:filename>")
@login_required
def static_files(filename):
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return Response("Acesso negado.", status=403)
    return send_from_directory(BASE_DIR, filename)


# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 48)
    print("  Editor de Lacre — Leanttro Tecnologia")
    print(f"  Servidor: http://127.0.0.1:{PORT}/")
    print(f"  Home:      http://127.0.0.1:{PORT}/")
    print(f"  Lacre:     http://127.0.0.1:{PORT}/lacre")
    print(f"  Serigrafia:http://127.0.0.1:{PORT}/serigrafia")
    print(f"  DTF:       http://127.0.0.1:{PORT}/dtf")
    print(f"  Mouse Pad: http://127.0.0.1:{PORT}/mousepad")
    users = load_users()
    print(f"  Usuários carregados: {list(users.keys()) or '(nenhum)'}")
    print("  Pressione Ctrl+C para encerrar.")
    print("=" * 48)
    app.run(host=HOST, port=PORT, debug=False)
