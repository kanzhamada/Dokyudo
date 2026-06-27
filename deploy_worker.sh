#!/bin/bash

# Konfigurasi SSH STB
STB_USER="root"
STB_HOST="aml-s9xx-box"
STB_PATH="/root/stb-worker/"

echo "🚀 Deploying stb-worker to $STB_HOST..."

# Rsync akan meng-copy file yang berubah saja.
# --exclude mencegah folder venv, cache python, dan file .env ter-copy (agar .env di STB tidak tertimpa).
rsync -avz --progress \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='.env' \
    --exclude='.git/' \
    apps/stb-worker/ $STB_USER@$STB_HOST:$STB_PATH

echo "✅ Deploy selesai! Uvicorn di STB akan mendeteksi perubahan dan otomatis merestart worker."
