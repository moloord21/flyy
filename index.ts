import { TelegramApi } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';
import { Api } from 'telegram/tl';

// إعدادات التطبيق
const apiId = parseInt(process.env.API_ID!);
const apiHash = process.env.API_HASH!;
const botToken = process.env.BOT_TOKEN!;
const stringSession = new StringSession(process.env.SESSION_STRING || '');

let client: TelegramApi;

// جودات الفيديو المختلفة
const VIDEO_QUALITIES = {
  '144p': { width: 256, height: 144, bitrate: '200k', maxSize: '5MB' },
  '240p': { width: 426, height: 240, bitrate: '400k', maxSize: '10MB' },
  '360p': { width: 640, height: 360, bitrate: '800k', maxSize: '20MB' },
  '480p': { width: 854, height: 480, bitrate: '1200k', maxSize: '30MB' },
  '720p': { width: 1280, height: 720, bitrate: '2500k', maxSize: '50MB' },
  '1080p': { width: 1920, height: 1080, bitrate: '5000k', maxSize: '100MB' }
};

// تهيئة العميل
async function initializeClient() {
  try {
    client = new TelegramApi(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      botAuthToken: botToken,
    });

    console.log('✅ تم تهيئة العميل بنجاح');
    return client;
  } catch (error) {
    console.error('❌ خطأ في تهيئة العميل:', error);
    throw error;
  }
}

// معالج الرسائل
async function setupMessageHandler() {
  // رسالة البداية
  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.message) return;

    const text = message.message.toLowerCase();
    const chatId = message.peerId;

    if (text === '/start') {
      await client.sendMessage(chatId, {
        message: `🎬 مرحباً بك في بوت تحويل الفيديوهات!

📤 أرسل لي أي فيديو وسأقوم بتحويله إلى جودات مختلفة:

${Object.entries(VIDEO_QUALITIES).map(([quality, settings]) => 
  `🎯 ${quality} - (${settings.maxSize})`
).join('\n')}

✨ مميزات البوت:
• يدعم ملفات حتى 2GB
• تحويل سريع وعالي الجودة
• 6 جودات مختلفة
• واجهة عربية سهلة

أرسل فيديو للبدء! 🚀`
      });
    }
  }, new NewMessage({ pattern: /\/start/ }));

  // معالج الفيديوهات
  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message || !message.media) return;

    // التحقق من نوع الملف
    if (!(message.media instanceof Api.MessageMediaDocument)) return;
    
    const document = message.media.document;
    if (!(document instanceof Api.Document)) return;

    // التحقق من أن الملف فيديو
    const isVideo = document.mimeType?.startsWith('video/') || 
                   document.attributes?.some(attr => attr instanceof Api.DocumentAttributeVideo);

    if (!isVideo) {
      await client.sendMessage(message.peerId, {
        message: '❌ يرجى إرسال ملف فيديو صالح!'
      });
      return;
    }

    const chatId = message.peerId;
    const fileSize = document.size;
    const fileName = getFileName(document);

    try {
      // رسالة البداية
      const statusMessage = await client.sendMessage(chatId, {
        message: `📥 جاري تحميل الفيديو...
📊 حجم الملف: ${formatFileSize(fileSize)}
📁 اسم الملف: ${fileName}`
      });

      // تحميل الفيديو
      const inputPath = path.join('/tmp', `input_${Date.now()}_${fileName}`);
      await downloadFile(document, inputPath, chatId, statusMessage.id);

      // تحديث الرسالة
      await client.editMessage(chatId, {
        message: statusMessage.id,
        text: '🔄 جاري تحويل الفيديو إلى جودات مختلفة...\n⏳ هذا قد يستغرق بعض الوقت حسب حجم الفيديو'
      });

      // معلومات الفيديو
      const videoInfo = await getVideoInfo(inputPath);
      console.log('معلومات الفيديو:', videoInfo);

      let convertedCount = 0;
      const totalQualities = Object.keys(VIDEO_QUALITIES).length;

      // تحويل إلى جودات مختلفة
      for (const [quality, settings] of Object.entries(VIDEO_QUALITIES)) {
        try {
          const outputPath = path.join('/tmp', `output_${quality}_${Date.now()}.mp4`);
          
          // تحديث التقدم
          await client.editMessage(chatId, {
            message: statusMessage.id,
            text: `🎬 جاري التحويل إلى جودة ${quality}...\n📊 ${convertedCount}/${totalQualities} مكتمل`
          });

          // التحويل
          await convertVideo(inputPath, outputPath, settings, videoInfo);

          // رفع الفيديو المحول
          await uploadConvertedVideo(chatId, outputPath, quality, settings);

          convertedCount++;

          // حذف الملف المؤقت
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }

        } catch (error) {
          console.error(`خطأ في تحويل ${quality}:`, error);
          await client.sendMessage(chatId, {
            message: `❌ خطأ في تحويل الفيديو إلى جودة ${quality}`
          });
        }
      }

      // حذف الملف الأصلي
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      // رسالة الانتهاء
      await client.editMessage(chatId, {
        message: statusMessage.id,
        text: `✅ تم تحويل الفيديو بنجاح!
🎯 تم إنشاء ${convertedCount} جودة مختلفة
📤 تم رفع جميع الملفات

أرسل فيديو آخر للمتابعة! 🚀`
      });

    } catch (error) {
      console.error('خطأ في معالجة الفيديو:', error);
      await client.sendMessage(chatId, {
        message: `❌ حدث خطأ أثناء معالجة الفيديو:
${error.message}

يرجى المحاولة مرة أخرى مع فيديو آخر.`
      });
    }
  }, new NewMessage({ incoming: true }));
}

// تحميل الملف
async function downloadFile(document: Api.Document, outputPath: string, chatId: any, messageId: number) {
  const buffer = await client.downloadMedia(document, {
    progressCallback: async (downloaded, total) => {
      const percentage = Math.round((downloaded / total) * 100);
      if (percentage % 10 === 0) { // تحديث كل 10%
        await client.editMessage(chatId, {
          message: messageId,
          text: `📥 جاري التحميل... ${percentage}%\n${'█'.repeat(percentage/5)}${'░'.repeat(20-percentage/5)}`
        });
      }
    }
  });

  fs.writeFileSync(outputPath, buffer as Buffer);
}

// الحصول على معلومات الفيديو
function getVideoInfo(inputPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

// تحويل الفيديو
function convertVideo(inputPath: string, outputPath: string, settings: any, videoInfo: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const originalWidth = videoInfo.streams[0].width;
    const originalHeight = videoInfo.streams[0].height;

    // حساب الأبعاد مع المحافظة على النسبة
    const aspectRatio = originalWidth / originalHeight;
    let { width, height } = settings;

    if (width / height > aspectRatio) {
      width = Math.round(height * aspectRatio);
    } else {
      height = Math.round(width / aspectRatio);
    }

    // التأكد من أن الأرقام زوجية (مطلوب لبعض الكودكس)
    width = width % 2 === 0 ? width : width - 1;
    height = height % 2 === 0 ? height : height - 1;

    ffmpeg(inputPath)
      .size(`${width}x${height}`)
      .videoBitrate(settings.bitrate)
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate('128k')
      .format('mp4')
      .outputOptions([
        '-preset fast',
        '-crf 23',
        '-movflags +faststart'
      ])
      .on('progress', (progress) => {
        console.log(`تقدم ${settings.width}x${settings.height}: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        console.log(`✅ تم تحويل ${settings.width}x${settings.height}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`❌ خطأ في تحويل ${settings.width}x${settings.height}:`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

// رفع الفيديو المحول
async function uploadConvertedVideo(chatId: any, filePath: string, quality: string, settings: any) {
  const fileSize = fs.statSync(filePath).size;
  const fileName = `video_${quality}_${Date.now()}.mp4`;

  await client.sendFile(chatId, {
    file: filePath,
    caption: `🎬 فيديو بجودة ${quality}
📊 الدقة: ${settings.width}x${settings.height}
📁 الحجم: ${formatFileSize(fileSize)}
⚡ معدل البت: ${settings.bitrate}

#${quality.replace('p', 'P')} #VideoConverter`,
    attributes: [
      new Api.DocumentAttributeVideo({
        duration: 0,
        w: settings.width,
        h: settings.height,
        supportsStreaming: true
      }),
      new Api.DocumentAttributeFilename({
        fileName: fileName
      })
    ]
  });
}

// مساعدات
function getFileName(document: Api.Document): string {
  const fileNameAttr = document.attributes?.find(
    attr => attr instanceof Api.DocumentAttributeFilename
  ) as Api.DocumentAttributeFilename;
  
  return fileNameAttr?.fileName || `video_${Date.now()}.mp4`;
}

function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// دالة Vercel
export default async (req: any, res: any) => {
  try {
    if (!client) {
      await initializeClient();
      await setupMessageHandler();
    }

    res.status(200).json({ 
      message: 'Telegram Client Bot is running!',
      status: 'active',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// تشغيل محلي
if (process.env.NODE_ENV !== 'production') {
  (async () => {
    try {
      await initializeClient();
      await setupMessageHandler();
      console.log('🚀 البوت يعمل محلياً...');
    } catch (error) {
      console.error('خطأ في تشغيل البوت:', error);
    }
  })();
}
