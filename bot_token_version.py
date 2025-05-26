import os
from telegram.ext import Application, MessageHandler, filters
import asyncio

BOT_TOKEN = os.getenv('BOT_TOKEN')

async def handle_video(update, context):
    await update.message.reply_text("🔄 جاري المعالجة...")
    # نفس منطق المعالجة...

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.VIDEO, handle_video))
    app.run_polling()

if __name__ == '__main__':
    main()
