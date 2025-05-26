FROM python:3.10-slim

# تثبيت ffmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean

# نسخ الملفات
WORKDIR /app
COPY . .

# تثبيت الباكدجات
RUN pip install --no-cache-dir -r requirements.txt

# الأمر الرئيسي للتشغيل
CMD ["python", "bot.py"]
