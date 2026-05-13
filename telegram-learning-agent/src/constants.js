/**
 * Allowed learning topics and proficiency levels.
 * Used by commands and OpenAI prompts.
 */

const TOPICS = ['IELTS', 'Japanese', 'Mandarin', 'German'];

const LEVELS = ['beginner', 'intermediate', 'advanced'];

/** Default IANA timezone for /schedule when user does not set one */
const DEFAULT_TIMEZONE = 'Asia/Makassar';

/** How long (minutes) we treat a pending quiz answer as valid */
const QUIZ_PENDING_TTL_MINUTES = 120;

module.exports = {
  TOPICS,
  LEVELS,
  DEFAULT_TIMEZONE,
  QUIZ_PENDING_TTL_MINUTES,
};
