require('dotenv').config();

const path = require('path');

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

const config = {
  telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  openaiModel: requireEnv('OPENAI_MODEL'),
  /** Where SQLite file is stored */
  databasePath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'learning.db'),
};

module.exports = { config };
