import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REQUIRED_ACTIVITY_SUFFIXES,
  completedRequiredActivityIds,
  requiredActivityIdsForSong,
  requiredActivitySuffixesForLesson,
  requiredActivityProgress,
} from './lessonPlan.js';

test('the production lesson contract contains 25 unique required interactions', () => {
  assert.equal(REQUIRED_ACTIVITY_SUFFIXES.length, 25);
  assert.equal(new Set(REQUIRED_ACTIVITY_SUFFIXES).size, 25);
  assert.deepEqual(REQUIRED_ACTIVITY_SUFFIXES.slice(0, 3), ['setup:goal', 'meaning:prediction', 'meaning:mood']);
  assert.equal(REQUIRED_ACTIVITY_SUFFIXES.at(-1), 'speaking:response');
});

test('production progress ignores retries and optional activity events', () => {
  const required = requiredActivityIdsForSong('lovely');
  const attempts = [
    { activityId: required[0] },
    { activityId: required[0] },
    { activityId: required[1] },
    { activityId: 'lovely:listening:source-open' },
    { activityId: 'another-song:setup:goal' },
  ];
  assert.deepEqual(completedRequiredActivityIds(attempts, 'lovely'), required.slice(0, 2));
  assert.deepEqual(requiredActivityProgress(attempts, 'lovely'), { completed: 2, total: 25, percent: 8 });
});

test('AI lesson contract follows the content that is actually rendered', () => {
  const compact = { words: Array.from({ length: 4 }), languageLab: Array.from({ length: 2 }) };
  const expanded = { words: Array.from({ length: 8 }), languageLab: Array.from({ length: 4 }) };

  assert.equal(requiredActivitySuffixesForLesson(compact).length, 22);
  assert.equal(requiredActivitySuffixesForLesson(expanded).length, 28);
  assert.equal(requiredActivityIdsForSong('ai-song', compact).length, 22);
  assert.ok(requiredActivitySuffixesForLesson(expanded).includes('vocabulary:rate:7'));
  assert.ok(requiredActivitySuffixesForLesson(expanded).includes('language:register:3'));
});

test('dynamic progress cannot announce 100 percent while lesson activities are missing', () => {
  const lesson = { words: Array.from({ length: 4 }), languageLab: Array.from({ length: 2 }) };
  const required = requiredActivityIdsForSong('ai-song', lesson);
  const attempts = required.slice(0, -1).map((activityId) => ({ activityId }));

  assert.deepEqual(requiredActivityProgress(attempts, 'ai-song', lesson), {
    completed: 21,
    total: 22,
    percent: 95,
  });
});
