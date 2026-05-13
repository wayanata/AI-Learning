const { DateTime } = require('luxon');
const { TOPICS, LEVELS, DEFAULT_TIMEZONE } = require('../constants');
const { escapeHtml } = require('../utils/html');
const { parseScheduleTime } = require('../utils/timeParse');

/**
 * @param {import('node-telegram-bot-api')} bot
 * @param {object} deps
 * @param {ReturnType<typeof import('../repositories/userRepository').createUserRepository>} deps.users
 * @param {ReturnType<typeof import('../repositories/answersRepository').createAnswersRepository>} deps.answers
 * @param {ReturnType<typeof import('../services/openaiService').createOpenAIService>} deps.openai
 */
function registerHandlers(bot, deps) {
  const { users, answers, openai } = deps;

  bot.onText(/^\/start(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    users.upsertUserByChatId(String(chatId));

    await bot.sendMessage(
      chatId,
      [
        '👋 <b>Selamat datang!</b>',
        '',
        'Chat ID kamu sudah disimpan. Aku akan mengirim pengingat belajar harian sesuai jadwal.',
        '',
        '<b>Langkah berikutnya</b>',
        `1) Pilih topik: ${TOPICS.map((t) => `<code>/topic ${t}</code>`).join(' · ')}`,
        '2) Pilih level: <code>/level beginner</code> / <code>intermediate</code> / <code>advanced</code>',
        '3) Atur jam pengingat: <code>/schedule 08:30</code> (zona waktu bawaan: Asia/Makassar)',
        '4) Latihan kapan saja: <code>/quiz</code>',
        '',
        'Kamu bisa membalas pesan kuis untuk mendapat koreksi + penjelasan (Bahasa Indonesia).',
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/^\/topic(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const raw = match[1] ? String(match[1]).trim() : '';

    if (!raw) {
      await bot.sendMessage(
        chatId,
        [
          'Pilih salah satu topik (contoh: <code>/topic Japanese</code>):',
          '',
          TOPICS.map((t) => `• <code>/topic ${t}</code>`).join('\n'),
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    const topic = TOPICS.find((t) => t.toLowerCase() === raw.toLowerCase());
    if (!topic) {
      await bot.sendMessage(
        chatId,
        `Topik tidak dikenali. Gunakan salah satu: ${TOPICS.join(', ')}.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    users.upsertUserByChatId(String(chatId));
    users.setTopic(String(chatId), topic);

    await bot.sendMessage(
      chatId,
      `Topik disimpan: <b>${escapeHtml(topic)}</b>. Lanjutkan dengan <code>/level ...</code>.`,
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/^\/level(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const raw = match[1] ? String(match[1]).trim().toLowerCase() : '';

    if (!raw) {
      await bot.sendMessage(
        chatId,
        [
          'Pilih level (contoh: <code>/level intermediate</code>):',
          '',
          LEVELS.map((l) => `• <code>/level ${l}</code>`).join('\n'),
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    const level = LEVELS.find((l) => l === raw);
    if (!level) {
      await bot.sendMessage(
        chatId,
        `Level tidak dikenali. Gunakan: ${LEVELS.join(', ')}.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    users.upsertUserByChatId(String(chatId));
    users.setLevel(String(chatId), level);

    await bot.sendMessage(
      chatId,
      `Level disimpan: <b>${escapeHtml(level)}</b>. Atur jadwal dengan <code>/schedule HH:mm</code>.`,
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/^\/schedule(?:\s+(.+))?$/, async (msg, match) => {
    const chatId = msg.chat.id;
    const rest = match[1] ? String(match[1]).trim() : '';

    if (!rest) {
      await bot.sendMessage(
        chatId,
        [
          'Atur jam pengingat harian (format 24 jam).',
          '',
          'Contoh:',
          '• <code>/schedule 08:30</code> (zona waktu bawaan: Asia/Makassar)',
          '• <code>/schedule 08:30 Asia/Jakarta</code>',
        ].join('\n'),
        { parse_mode: 'HTML' }
      );
      return;
    }

    const tokens = rest.split(/\s+/).filter(Boolean);
    const timeToken = tokens[0];
    const tzRaw = tokens.slice(1).join(' ').trim();
    const tz = tzRaw || null;

    const parsed = parseScheduleTime(timeToken);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, parsed.error);
      return;
    }

    if (tz) {
      const probe = DateTime.now().setZone(tz);
      if (!probe.isValid) {
        await bot.sendMessage(
          chatId,
          'Zona waktu tidak valid. Contoh yang benar: <code>Asia/Makassar</code>.',
          { parse_mode: 'HTML' }
        );
        return;
      }
    }

    users.upsertUserByChatId(String(chatId));
    const updated = users.setSchedule(String(chatId), parsed.value, tz);

    const usedTz = users.getTimezoneForUser(updated);
    await bot.sendMessage(
      chatId,
      [
        'Jadwal disimpan.',
        `• Jam lokal: <b>${escapeHtml(parsed.value)}</b>`,
        `• Zona waktu: <b>${escapeHtml(usedTz)}</b>`,
        '',
        `Catatan: bawaan zona waktu adalah <code>${DEFAULT_TIMEZONE}</code> jika kamu tidak menulis zona waktu.`,
      ].join('\n'),
      { parse_mode: 'HTML' }
    );
  });

  bot.onText(/^\/quiz(?:\s|$)/, async (msg) => {
    const chatId = msg.chat.id;
    const user = users.findByChatId(String(chatId));
    if (!user) {
      await bot.sendMessage(chatId, 'Mulai dulu dengan /start.');
      return;
    }
    if (!user.topic || !user.level) {
      await bot.sendMessage(
        chatId,
        'Lengkapi dulu /topic dan /level sebelum /quiz.',
        { parse_mode: 'HTML' }
      );
      return;
    }

    await bot.sendChatAction(chatId, 'typing');

    try {
      const question = await openai.generateQuizQuestion(String(user.topic), String(user.level));
      const text = [
        '❓ <b>Kuis</b>',
        escapeHtml(question),
        '',
        '<i>Balas pesan ini (reply) dengan jawabanmu.</i>',
      ].join('\n');

      const sent = await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
      users.setActiveQuizState(String(chatId), sent.message_id, question);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[quiz]', err);
      await bot.sendMessage(
        chatId,
        'Maaf, gagal membuat kuis sekarang. Coba lagi beberapa saat lagi.',
        { parse_mode: 'HTML' }
      );
    }
  });

  bot.on('message', async (msg) => {
    if (!msg.text) return;
    const text = msg.text.trim();
    if (text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const user = users.findByChatId(String(chatId));
    if (!user || !users.hasActiveQuizPending(user)) return;

    if (!user.topic || !user.level || !user.active_quiz_question) return;

    const expectedId = user.active_quiz_message_id;
    if (expectedId != null && msg.reply_to_message) {
      const repliedId = Number(msg.reply_to_message.message_id);
      if (Number.isFinite(repliedId) && repliedId !== Number(expectedId)) {
        return;
      }
    }

    await bot.sendChatAction(chatId, 'typing');

    try {
      const feedback = await openai.evaluateQuizAnswer(
        String(user.topic),
        String(user.level),
        String(user.active_quiz_question),
        text
      );

      const feedbackText = JSON.stringify(feedback);

      const pretty = [
        '✅ <b>Hasil koreksi</b>',
        feedback.correction ? `• <b>Koreksi</b>: ${escapeHtml(feedback.correction)}` : null,
        `• <b>Penjelasan (ID)</b>:\n${escapeHtml(feedback.explanationId)}`,
        feedback.betterVersion
          ? `• <b>Versi lebih baik</b>:\n${escapeHtml(feedback.betterVersion)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      answers.record(user.id, String(user.active_quiz_question), text, feedbackText);
      users.clearActiveQuizState(String(chatId));

      await bot.sendMessage(chatId, pretty, { parse_mode: 'HTML' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[quiz-answer]', err);
      await bot.sendMessage(
        chatId,
        'Maaf, gagal mengevaluasi jawaban. Coba kirim ulang jawabanmu.',
        { parse_mode: 'HTML' }
      );
    }
  });
}

module.exports = { registerHandlers };
