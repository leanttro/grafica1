# ── Build Stage ───────────────────────────────────────────────────────────────
FROM python:3.12-slim

# Metadados
LABEL maintainer="Leanttro Tecnologia"
LABEL description="Editor de Lacre de Segurança"

# Diretório de trabalho
WORKDIR /app

# Dependências Python primeiro (aproveita cache do Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o restante do projeto
COPY . .

# Porta exposta (Gunicorn vai escutar aqui)
EXPOSE 8000

# Comando de produção
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "60"]
