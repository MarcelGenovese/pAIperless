#!/bin/bash

# Wir setzen die Pufferung auf 0, damit Logs sofort erscheinen
export PYTHONUNBUFFERED=1

echo "🚀 Starte DocAI Watcher (Hintergrund)..."
# Die Umleitung > /proc/1/fd/1 schickt die Logs an den Docker-Log-Kanal
python3 -u main.py > /proc/1/fd/1 2>&1 &

echo "🔄 Starte Google Sync Service (Vordergrund)..."
python3 -u sync_service.py
