const { DateTime } = require('luxon');
const { DEFAULT_TIMEZONE, QUIZ_PENDING_TTL_MINUTES } = require('../constants');

/**
 * @param {import('better-sqlite3').Database} db
 */
function createUserRepository(db) {
  const insertUser = db.prepare(`
    INSERT INTO users (chat_id) VALUES (?)
    ON CONFLICT(chat_id) DO UPDATE SET chat_id = excluded.chat_id
    RETURNING *
  `);

  const selectByChatId = db.prepare(`SELECT * FROM users WHERE chat_id = ?`);

  const updateTopic = db.prepare(`
    UPDATE users SET topic = ? WHERE chat_id = ?
    RETURNING *
  `);

  const updateLevel = db.prepare(`
    UPDATE users SET level = ? WHERE chat_id = ?
    RETURNING *
  `);

  const updateSchedule = db.prepare(`
    UPDATE users SET schedule_time = ?, timezone = COALESCE(?, timezone) WHERE chat_id = ?
    RETURNING *
  `);

  const setActiveQuiz = db.prepare(`
    UPDATE users
    SET active_quiz_message_id = ?, active_quiz_question = ?, active_quiz_at = ?
    WHERE chat_id = ?
    RETURNING *
  `);

  const clearActiveQuiz = db.prepare(`
    UPDATE users
    SET active_quiz_message_id = NULL, active_quiz_question = NULL, active_quiz_at = NULL
    WHERE chat_id = ?
  `);

  const setLastDailySentDate = db.prepare(`
    UPDATE users SET last_daily_sent_date = ? WHERE id = ?
  `);

  const selectUsersForScheduler = db.prepare(`
    SELECT * FROM users
    WHERE topic IS NOT NULL
      AND level IS NOT NULL
      AND schedule_time IS NOT NULL
      AND schedule_time != ''
  `);

  return {
    upsertUserByChatId(chatId) {
      return insertUser.get(String(chatId));
    },

    findByChatId(chatId) {
      return selectByChatId.get(String(chatId));
    },

    setTopic(chatId, topic) {
      return updateTopic.get(topic, String(chatId));
    },

    setLevel(chatId, level) {
      return updateLevel.get(level, String(chatId));
    },

    /**
     * @param {string} chatId
     * @param {string} scheduleTime "HH:mm" 24h
     * @param {string} [timezone] IANA zone; defaults kept if null/undefined
     */
    setSchedule(chatId, scheduleTime, timezone) {
      const tz = timezone && String(timezone).trim() ? String(timezone).trim() : null;
      return updateSchedule.get(scheduleTime, tz, String(chatId));
    },

    setActiveQuizState(chatId, messageId, questionText) {
      const at = DateTime.utc().toISO();
      return setActiveQuiz.get(messageId, questionText, at, String(chatId));
    },

    clearActiveQuizState(chatId) {
      clearActiveQuiz.run(String(chatId));
    },

    markDailySent(userId, localDateYYYYMMDD) {
      setLastDailySentDate.run(localDateYYYYMMDD, userId);
    },

    getUsersForScheduler() {
      return selectUsersForScheduler.all();
    },

    /**
     * True if user has a quiz pending and TTL not expired.
     * @param {object} user row from users table
     */
    hasActiveQuizPending(user) {
      if (!user || !user.active_quiz_question) return false;
      if (!user.active_quiz_at) return false;
      const started = DateTime.fromISO(user.active_quiz_at, { zone: 'utc' });
      if (!started.isValid) return false;
      const age = DateTime.utc().diff(started, 'minutes').minutes;
      return age <= QUIZ_PENDING_TTL_MINUTES;
    },

    getTimezoneForUser(user) {
      return user?.timezone && String(user.timezone).trim()
        ? String(user.timezone).trim()
        : DEFAULT_TIMEZONE;
    },
  };
}

module.exports = { createUserRepository };
