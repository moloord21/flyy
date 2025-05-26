cat > auth.ts << 'EOF'
import { TelegramApi } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';
import * as dotenv from 'dotenv';

dotenv.config();

async function generateSession() {
  const apiId = parseInt(process.env.API_ID!);
  const apiHash = process.env.API_HASH!;
  
  if (!apiId || !apiHash) {
    console.error('❌ API_ID أو API_HASH غير موجود في ملف .env');
    return;
  }
  
  console.log('🔐 جاري إنشاء جلسة جديدة...');
  
  const stringSession = new StringSession('');
  const client = new TelegramApi(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text('أدخل رقم الهاتف (مع رمز الدولة مثل +201234567890): '),
      password: async () => await input.text('أدخل كلمة المرور (اتركها فارغة إذا لم تكن مفعلة): '),
      phoneCode: async () => await input.text('أدخل رمز التأكيد من تليجرام: '),
      onError: (err) => console.log('خطأ:', err),
    });

    console.log('✅ تم إنشاء الجلسة بنجاح!');
    console.log('\n📋 SESSION_STRING الخاص بك:');
    console.log('='.repeat(50));
    console.log(client.session.save());
    console.log('='.repeat(50));
    console.log('\n📝 انسخ السطر أعلاه وضعه في SESSION_STRING في ملف .env');
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ خطأ في إنشاء الجلسة:', error);
  }
}

generateSession().catch(console.error);
EOF
