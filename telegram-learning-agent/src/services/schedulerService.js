const cron = require('node-cron');
const { DateTime } = require('luxon');
const { escapeHtml } = require('../utils/html');

/**
 * Start a lightweight cron that runs every minute and sends daily content
 * when local clock matches the user's schedule (once per local calendar day).
 *
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {ReturnType<typeof import('../repositories/userRepository').createUserRepository>} deps.users
 * @param {ReturnType<typeof import('../repositories/progressRepository').createProgressRepository>} deps.progress
 * @param {ReturnType<typeof import('./openaiService').createOpenAIService>} deps.openai
 * @param {(chatId: string | number, text: string, options?: object) => Promise<{ message_id: number }>} deps.sendMessage
 */
function startDailyScheduler(deps) {
  const { db, users, progress, openai, sendMessage } = deps;

  cron.schedule(
    '* * * * *',
    async () => {
      const rows = users.getUsersForScheduler();
      for (const user of rows) {
        try {
          await maybeSendDailyForUser(user);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[scheduler] user id=${user.id} chat=${user.chat_id}`, err);
        }
      }
    },
    { timezone: 'UTC' }
  );

  /**
   * @param {object} user
   */
  async function maybeSendDailyForUser(user) {
    const tz = users.getTimezoneForUser(user);
    const nowLocal = DateTime.now().setZone(tz);
    if (!nowLocal.isValid) {
      throw new Error(`Invalid timezone on user ${user.id}: ${tz}`);
    }

    const schedule = String(user.schedule_time || '').trim();
    const parts = schedule.split(':');
    if (parts.length < 2) return;

    const sh = Number(parts[0]);
    const sm = Number(parts[1]);
    if (!Number.isFinite(sh) || !Number.isFinite(sm)) return;

    const localKey = nowLocal.toFormat('HH:mm');
    const targetKey = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
    if (localKey !== targetKey) return;

    const today = nowLocal.toFormat('yyyy-MM-dd');
    if (user.last_daily_sent_date === today) return;

    const topic = String(user.topic);
    const level = String(user.level);

    const { lesson, question } = await openai.generateDailyLessonAndQuestion(topic, level);

    const header = '📚 <b>Pelajaran harian</b>';
    const bodyLesson = escapeHtml(lesson);
    const bodyQ = `\n\n❓ <b>Pertanyaan</b>\n${escapeHtml(question)}`;

    const sent = await sendMessage(user.chat_id, `${header}\n\n${bodyLesson}${bodyQ}`, {
      parse_mode: 'HTML',
    });

    db.transaction(() => {
      progress.record(user.id, today, lesson, question);
      users.markDailySent(user.id, today);
      users.setActiveQuizState(user.chat_id, sent.message_id, question);
    })();
  }
}

module.exports = { startDailyScheduler };
