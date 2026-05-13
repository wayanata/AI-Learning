/**
 * @param {import('better-sqlite3').Database} db
 */
function createAnswersRepository(db) {
  const insert = db.prepare(`
    INSERT INTO answers (user_id, question_text, user_reply, feedback_text)
    VALUES (?, ?, ?, ?)
  `);

  return {
    /**
     * @param {number} userId users.id
     * @param {string} questionText
     * @param {string} userReply
     * @param {string} feedbackText
     */
    record(userId, questionText, userReply, feedbackText) {
      insert.run(userId, questionText, userReply, feedbackText);
    },
  };
}

module.exports = { createAnswersRepository };
