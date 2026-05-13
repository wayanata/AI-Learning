/**
 * @param {import('better-sqlite3').Database} db
 */
function createProgressRepository(db) {
  const insert = db.prepare(`
    INSERT INTO progress (user_id, local_date, lesson_text, quiz_question)
    VALUES (?, ?, ?, ?)
  `);

  return {
    /**
     * @param {number} userId users.id
     * @param {string} localDate YYYY-MM-DD in user's timezone
     * @param {string} lessonText
     * @param {string} quizQuestion
     */
    record(userId, localDate, lessonText, quizQuestion) {
      insert.run(userId, localDate, lessonText, quizQuestion);
    },
  };
}

module.exports = { createProgressRepository };
