import os
import asyncio
import logging
from telethon import TelegramClient, events
from telethon.tl.types import DocumentAttributeVideo
import ffmpeg

# إعداد التسجيل
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# بيانات الـ API
API_ID = int(os.getenv('API_ID'))
API_HASH = os.getenv('API_HASH')
PHONE = os.getenv('PHONE_NUMBER')

# إنشاء العميل
client = TelegramClient('bot_session', API_ID, API_HASH)

class VideoProcessor:
    def __init__(self):
        self.resolutions = {
            '144p': (256, 144, '200k'),
            '240p': (426, 240, '400k'),
            '360p': (640, 360, '600k'),
            '480p': (854, 480, '1000k'),
            '720p': (1280, 720, '1500k')
        }
    
    async def convert_video(self, input_path, resolution):
        width, height, bitrate = self.resolutions[resolution]
        output_path = f"output_{resolution}_{os.path.basename(input_path)}"
        
        try:
            (
                ffmpeg
                .input(input_path)
                .video.filter('scale', width, height)
                .output(output_path,
                       video_bitrate=bitrate,
                       audio_bitrate='128k',
                       format='mp4',
                       preset='fast')
                .overwrite_output()
                .run(quiet=True)
            )
            return output_path
        except Exception as e:
            logger.error(f"خطأ في تحويل {resolution}: {e}")
            return None

processor = VideoProcessor()

@client.on(events.NewMessage(pattern='/start'))
async def start_handler(event):
    await event.respond(
        "🎬 أهلاً! أرسل لي فيديو وسأحوله لدقات مختلفة\n"
        "📱 الدقات: 144p, 240p, 360p, 480p, 720p"
    )

@client.on(events.NewMessage)
async def video_handler(event):
    if event.video or event.document:
        status_msg = await event.respond("📥 جاري التحميل...")
        
        try:
            # تحميل الفيديو
            input_path = await event.download_media(file="downloads/")
            await status_msg.edit("🔄 جاري التحويل...")
            
            # تحويل لكل دقة
            for resolution in processor.resolutions.keys():
                output_path = await processor.convert_video(input_path, resolution)
                
                if output_path and os.path.exists(output_path):
                    width, height, _ = processor.resolutions[resolution]
                    
                    await client.send_file(
                        event.chat_id,
                        output_path,
                        caption=f"📹 {resolution}",
                        attributes=[DocumentAttributeVideo(
                            duration=0,
                            w=width,
                            h=height,
                            supports_streaming=True
                        )]
                    )
                    os.remove(output_path)
            
            await status_msg.edit("✅ تم الانتهاء!")
            os.remove(input_path)
            
        except Exception as e:
            await status_msg.edit(f"❌ خطأ: {str(e)}")
            logger.error(f"خطأ في المعالجة: {e}")

async def main():
    """تشغيل البوت"""
    try:
        # بدء العميل بدون مصادقة تفاعلية
        await client.start()
        logger.info("✅ البوت بدأ العمل!")
        
        # إنشاء مجلد التحميلات
        os.makedirs('downloads', exist_ok=True)
        
        # استمرار التشغيل
        await client.run_until_disconnected()
        
    except Exception as e:
        logger.error(f"خطأ في تشغيل البوت: {e}")

if __name__ == '__main__':
    asyncio.run(main())
