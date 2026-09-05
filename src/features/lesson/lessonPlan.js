const DEFAULT_WORD_COUNT = 6;
const DEFAULT_LANGUAGE_NOTE_COUNT = 3;

const contentCount = (items, fallback, maximum) => (
  Array.isArray(items) && items.length
    ? Math.min(maximum, items.length)
    : fallback
);

/**
 * Build the canonical activity contract from the lesson that is actually
 * rendered. AI lessons intentionally allow a variable number of words and
 * language notes, so progress and backend completion must use the same shape.
 */
export const requiredActivitySuffixesForLesson = (lesson = null) => {
  const wordCount = contentCount(lesson?.words, DEFAULT_WORD_COUNT, 12);
  const languageNoteCount = contentCount(lesson?.languageLab, DEFAULT_LANGUAGE_NOTE_COUNT, 8);
  const retrievalCount = Math.min(3, wordCount);
  const checkpointCount = 1 + retrievalCount + (languageNoteCount ? 1 : 0);

  return [
    'setup:goal',
    'meaning:prediction', 'meaning:mood',
    // Existing ids stay wire-compatible while the visible listening flow now
    // uses them for a qualified sample, a gist decision and word detection.
    'listening:source', 'listening:gist', 'listening:words',
    ...Array.from({ length: wordCount }, (_, index) => `vocabulary:rate:${index}`),
    ...Array.from({ length: retrievalCount }, (_, index) => `vocabulary:meaning:${index}`),
    'vocabulary:context',
    ...Array.from({ length: languageNoteCount }, (_, index) => `language:register:${index}`),
    ...Array.from({ length: checkpointCount }, (_, index) => `checkpoint:q:${index}`),
    'speaking:response',
  ];
};

export const REQUIRED_ACTIVITY_SUFFIXES = Object.freeze(requiredActivitySuffixesForLesson());

export const requiredActivityIdsForSong = (songId, lesson = null) => {
  if (typeof songId !== 'string' || !songId.trim()) throw new TypeError('songId is required');
  return requiredActivitySuffixesForLesson(lesson).map((suffix) => `${songId}:${suffix}`);
};

export const completedRequiredActivityIds = (attempts, songId, lesson = null) => {
  const required = new Set(requiredActivityIdsForSong(songId, lesson));
  return [...new Set((attempts || []).map((attempt) => attempt?.activityId).filter((id) => required.has(id)))];
};

export const requiredActivityProgress = (attempts, songId, lesson = null) => {
  const total = requiredActivityIdsForSong(songId, lesson).length;
  const completed = completedRequiredActivityIds(attempts, songId, lesson).length;
  return { completed, total, percent: Math.round(completed / total * 100) };
};
