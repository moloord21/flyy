from telethon.sync import TelegramClient, events
import os
import subprocess

api_id = int(os.getenv("API_ID"))
api_hash = os.getenv("API_HASH")
session_name = "video_bot"

client = TelegramClient(session_name, api_id, api_hash)

def convert_video(input_path, output_path, resolution):
    command = [
        'ffmpeg', '-i', input_path, '-vf', f'scale=-2:{resolution}',
        '-c:v', 'libx264', '-crf', '28', '-preset', 'fast',
        '-c:a', 'copy', output_path
    ]
    subprocess.run(command)

@client.on(events.NewMessage)
async def handler(event):
    if event.video or event.document:
        msg = await event.respond("⏬ جاري التحميل والمعالجة...")
        file = await event.download_media()

        qualities = [144, 240, 360, 480, 720]
        output_files = []

        for q in qualities:
            out_path = f"video_{q}p.mp4"
            convert_video(file, out_path, q)
            output_files.append((q, out_path))

        await msg.edit("✅ تم التحويل، جاري الإرسال...")

        for q, path in output_files:
            await client.send_file(event.chat_id, path, caption=f"{q}p")
            os.remove(path)

        os.remove(file)

client.start()
client.run_until_disconnected()
