FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# 1. System-Updates & Tesseract Installation
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-deu \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 2. Ordnerstruktur
RUN mkdir -p /app/in /app/out /app/error /app/processing /app/keys /app/logs /app/state

# 3. Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Skripte kopieren
COPY templates ./templates
COPY main.py .
COPY sync_service.py .
COPY entrypoint.sh .

# 5. Entrypoint ausführbar machen
RUN chmod +x entrypoint.sh

# WICHTIG: Startet das Shell-Skript, das beide Python-Dienste lenkt
ENTRYPOINT ["/app/entrypoint.sh"]
