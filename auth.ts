import { TelegramApi } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';

// سكريبت للحصول على session string
async function generateSession() {
  const apiId = parseInt(process.env.API_ID!);
  const apiHash = process.env.API_HASH!;
  
  console.log('🔐 جاري إنشاء جلسة جديدة...');
  
  const stringSession = new StringSession('');
  const client = new TelegramApi(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('أدخل رقم الهاتف (مع رمز الدولة): '),
    password: async () => await input.text('أدخل كلمة المرور (إذا كانت مفعلة): '),
    phoneCode: async () => await input.text('أدخل رمز التأكيد: '),
    onError: (err) => console.log('خطأ:', err),
  });

  console.log('✅ تم إنشاء الجلسة بنجاح!');
  console.log('Session String:', client.session.save());
  
  await client.disconnect();
}

// تشغيل فقط إذا تم استدعاء الملف مباشرة
if (require.main === module) {
  generateSession().catch(console.error);
}

export { generateSession };
