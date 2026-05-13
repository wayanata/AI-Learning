const { config } = require('./config');
const { openDatabase } = require('./db/database');
const { createUserRepository } = require('./repositories/userRepository');
const { createProgressRepository } = require('./repositories/progressRepository');
const { createAnswersRepository } = require('./repositories/answersRepository');
const { createOpenAIService } = require('./services/openaiService');
const { startDailyScheduler } = require('./services/schedulerService');
const { registerHandlers } = require('./bot/handlers');

const TelegramBot = require('node-telegram-bot-api');

async function main() {
  const db = openDatabase(config.databasePath);
  const users = createUserRepository(db);
  const progress = createProgressRepository(db);
  const answers = createAnswersRepository(db);
  const openai = createOpenAIService(config);

  const bot = new TelegramBot(config.telegramBotToken, { polling: true });

  registerHandlers(bot, { users, answers, openai });

  const sendMessage = (chatId, text, options) => bot.sendMessage(chatId, text, options);

  startDailyScheduler({ db, users, progress, openai, sendMessage });

  // eslint-disable-next-line no-console
  console.log('Telegram learning agent is running (polling enabled).');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err);
  process.exit(1);
});
