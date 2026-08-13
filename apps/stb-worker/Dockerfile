# --- STAGE 1: Builder ---
FROM python:3.12-slim AS builder

# Set env agar python tidak membuat file pyc
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

# Buat virtual environment agar mudah dipindah ke stage akhir
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
# Install dependensi (pip cache akan dibuang otomatis saat pindah stage)
RUN pip install --no-cache-dir -r requirements.txt

# --- STAGE 2: Final Image ---
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Menggunakan venv dari stage builder
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# LibreOffice Writer untuk konversi docx -> pdf (headless).
# Hanya paket writer + font, bukan suite penuh, supaya image tidak membengkak.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy HANYA virtual environment dari stage builder (ukuran sangat menyusut)
COPY --from=builder /opt/venv /opt/venv

# Copy source code aplikasi
COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
