import test from 'node:test';
import assert from 'node:assert/strict';

import { apiLessonToFrontend } from './generatedLesson.js';

test('AI adapter preserves trilingual content, register and usage recommendation', () => {
  const generated = {
    meaning_en: 'idea', meaning_kk: 'идея', meaning_ru: 'идея',
    mood_en: 'mood', mood_kk: 'көңіл күй', mood_ru: 'настроение',
    cultural_context_en: 'context', cultural_context_kk: 'контекст', cultural_context_ru: 'контекст',
    words: [{
      word: "ain't", pronunciation: '/eɪnt/', cefr: 'B1', register: 'slang',
      recommendation: 'avoid_formally', meaning_en: 'is not', meaning_kk: 'емес',
      meaning_ru: 'не является', example: "It ain't suitable for formal writing.",
    }],
    language_notes: [{
      song_form: "ain't", standard_form: 'is not', note_en: 'informal',
      note_kk: 'бейресми', note_ru: 'неформально',
    }],
    quiz: {
      question_en: 'Question?', question_kk: 'Сұрақ?', question_ru: 'Вопрос?',
      options_en: ['a', 'b', 'c'], options_kk: ['а', 'б', 'в'], options_ru: ['а', 'б', 'в'],
      correct_index: 1,
    },
  };

  const lesson = apiLessonToFrontend(generated);

  assert.equal(lesson.words[0].register, 'slang');
  assert.equal(lesson.words[0].type, 'slang');
  assert.equal(lesson.words[0].recommendation, 'avoid_formally');
  assert.deepEqual(lesson.words[0].meaning, { en: 'is not', kk: 'емес', ru: 'не является' });
  assert.equal(lesson.meaning.kk.mood, 'көңіл күй');
  assert.equal(lesson.languageLab[0].note.ru, 'неформально');
  assert.equal(lesson.quiz.correct, 1);
});
