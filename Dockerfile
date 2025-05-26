FROM python:3.11-slim

# تثبيت FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# إنشاء مجلد للتحميلات
RUN mkdir -p downloads

CMD ["python", "main.py"]
