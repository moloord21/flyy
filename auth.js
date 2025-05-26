const { TelegramApi } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

async function generateSession() {
  console.log('🔐 مرحباً! هنعمل Session String للبوت');
  
  const apiId = await question('أدخل API_ID (الرقم من my.telegram.org): ');
  const apiHash = await question('أدخل API_HASH (النص من my.telegram.org): ');
  
  const stringSession = new StringSession('');
  const client = new TelegramApi(stringSession, parseInt(apiId), apiHash);

  try {
    await client.start({
      phoneNumber: async () => await question('أدخل رقم الهاتف مع الكود (مثل +201234567890): '),
      phoneCode: async () => await question('أدخل رمز التأكيد من تليجرام: '),
      password: async () => await question('كلمة المرور (لو مش عندك اضغط Enter): '),
    });

    console.log('\n🎉 تمام! تم إنشاء Session بنجاح');
    console.log('📋 انسخ النص ده واحطه في SESSION_STRING:');
    console.log('=' .repeat(60));
    console.log(client.session.save());
    console.log('=' .repeat(60));
    
    await client.disconnect();
  } catch (error) {
    console.error('❌ في خطأ:', error);
  }
  
  rl.close();
}

generateSession();
