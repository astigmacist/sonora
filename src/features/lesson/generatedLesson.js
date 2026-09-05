/** Convert the server's structured AI lesson into the trilingual UI shape. */
export const apiLessonToFrontend = (generated) => ({
  meaning: {
    en: { idea: generated.meaning_en, mood: generated.mood_en, culture: generated.cultural_context_en },
    kk: { idea: generated.meaning_kk, mood: generated.mood_kk, culture: generated.cultural_context_kk },
    ru: { idea: generated.meaning_ru, mood: generated.mood_ru, culture: generated.cultural_context_ru },
  },
  words: generated.words.map((item) => ({
    word: item.word,
    ipa: item.pronunciation,
    cefr: item.cefr,
    type: item.register,
    register: item.register,
    recommendation: item.recommendation,
    meaning: { en: item.meaning_en, kk: item.meaning_kk, ru: item.meaning_ru },
    example: item.example,
  })),
  languageLab: generated.language_notes.map((item) => ({
    song: item.song_form,
    standard: item.standard_form,
    note: { en: item.note_en, kk: item.note_kk, ru: item.note_ru },
  })),
  quiz: {
    question: { en: generated.quiz.question_en, kk: generated.quiz.question_kk, ru: generated.quiz.question_ru },
    answers: { en: generated.quiz.options_en, kk: generated.quiz.options_kk, ru: generated.quiz.options_ru },
    correct: generated.quiz.correct_index,
  },
});
