const OpenAI = require('openai');

/**
 * Try to parse JSON from model output (handles optional markdown fences).
 * @param {string} raw
 */
function parseJsonLoose(raw) {
  let text = String(raw).trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence) {
    text = fence[1].trim();
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model output');
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * @param {{ openaiApiKey: string, openaiModel: string }} config
 */
function createOpenAIService(config) {
  const client = new OpenAI({ apiKey: config.openaiApiKey });

  /**
   * @param {string} input
   * @param {string} [instructions]
   */
  async function completeText(input, instructions) {
    const response = await client.responses.create({
      model: config.openaiModel,
      ...(instructions ? { instructions } : {}),
      input,
    });

    const text =
      typeof response.output_text === 'string'
        ? response.output_text.trim()
        : '';

    if (!text) {
      throw new Error('OpenAI returned no text (output_text empty).');
    }
    return text;
  }

  const baseInstructions =
    'You are a concise language and exam tutor. Follow output format instructions exactly.';

  return {
    /**
     * One short quiz question for topic + level.
     * @param {string} topic
     * @param {string} level
     */
    async generateQuizQuestion(topic, level) {
      const input = [
        `Topic: ${topic}`,
        `Level: ${level}`,
        '',
        'Write exactly ONE short question suitable for Telegram (max ~400 characters).',
        'Return ONLY valid JSON with this shape:',
        '{"question":"..."}',
      ].join('\n');

      const raw = await completeText(input, baseInstructions);
      const data = parseJsonLoose(raw);
      if (!data.question || typeof data.question !== 'string') {
        throw new Error('Invalid quiz JSON from model');
      }
      return String(data.question).trim();
    },

    /**
     * Daily micro-lesson plus one follow-up question.
     * @param {string} topic
     * @param {string} level
     */
    async generateDailyLessonAndQuestion(topic, level) {
      const input = [
        `Topic: ${topic}`,
        `Level: ${level}`,
        '',
        'Create a short daily learning block:',
        '- "lesson": 2–4 short paragraphs or bullet points (plain text, Telegram-friendly, under ~900 chars total).',
        '- "question": ONE short question related to the lesson (under ~400 chars).',
        '',
        'Return ONLY valid JSON:',
        '{"lesson":"...","question":"..."}',
      ].join('\n');

      const raw = await completeText(input, baseInstructions);
      const data = parseJsonLoose(raw);
      if (!data.lesson || !data.question) {
        throw new Error('Invalid daily lesson JSON from model');
      }
      return {
        lesson: String(data.lesson).trim(),
        question: String(data.question).trim(),
      };
    },

    /**
     * Grade user answer; explanations must be in Indonesian.
     * @param {string} topic
     * @param {string} level
     * @param {string} question
     * @param {string} userAnswer
     */
    async evaluateQuizAnswer(topic, level, question, userAnswer) {
      const input = [
        `Topic: ${topic}`,
        `Level: ${level}`,
        '',
        `Question:\n${question}`,
        '',
        `Learner answer:\n${userAnswer}`,
        '',
        'Evaluate the answer.',
        'Return ONLY valid JSON with keys:',
        '- "correction": brief verdict (can be English or the study language, keep short)',
        '- "explanation_id": explanation and teaching notes **in Indonesian** (Bahasa Indonesia)',
        '- "better_version": a model/improved learner response appropriate to the question (same language style the question expects)',
      ].join('\n');

      const raw = await completeText(input, baseInstructions);
      const data = parseJsonLoose(raw);
      const correction = data.correction != null ? String(data.correction).trim() : '';
      const explanationId =
        data.explanation_id != null ? String(data.explanation_id).trim() : '';
      const betterVersion =
        data.better_version != null ? String(data.better_version).trim() : '';

      if (!explanationId) {
        throw new Error('Model did not return explanation_id (Indonesian explanation)');
      }

      return { correction, explanationId, betterVersion };
    },
  };
}

module.exports = { createOpenAIService, parseJsonLoose };
