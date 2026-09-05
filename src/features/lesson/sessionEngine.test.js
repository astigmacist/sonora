import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIVITY_STATE,
  REQUIRED_STAGE_IDS,
  SESSION_STATUS,
  STAGE_STATE,
  SessionEngineError,
  completeLessonSession,
  createDefaultLessonPlan,
  createLessonSession,
  getCompletionResult,
  getFirstAttemptAccuracy,
  getSessionProgress,
  restoreLessonSession,
  serializeLessonSession,
  startStageRecovery,
  submitActivity,
} from './sessionEngine.js';

const at = (minute) => new Date(`2026-08-31T12:${String(minute).padStart(2, '0')}:00.000Z`);

function submit(session, activityId, score = 1, minute = 1) {
  const activity = session.stages.flatMap((stage) => stage.activities).find((item) => item.id === activityId);
  return submitActivity(session, {
    activityId,
    ...(activity.scored ? { score } : {}),
    durationSeconds: 12,
    now: at(minute),
  });
}

function finishCurrentStage(session, scores = 1, startingMinute = 1) {
  const stage = session.stages.find((item) => item.id === session.currentStageId);
  let next = session;
  stage.activities.filter((activity) => activity.required && activity.state === ACTIVITY_STATE.AVAILABLE).forEach((activity, index) => {
    const score = typeof scores === 'function' ? scores(activity, index) : scores;
    next = submit(next, activity.id, score, startingMinute + index);
  });
  return next;
}

function finishLesson(session, scoreForActivity = () => 1) {
  let next = session;
  let minute = 1;
  while (next.status === SESSION_STATUS.IN_PROGRESS) {
    const stage = next.stages.find((item) => item.id === next.currentStageId);
    next = finishCurrentStage(next, (activity, index) => scoreForActivity(stage, activity, index), minute);
    minute += stage.activities.length;
  }
  return next;
}

test('default plan has seven ordered mandatory stages and 33 required activities', () => {
  const plan = createDefaultLessonPlan();
  assert.deepEqual(plan.map((stage) => stage.id), REQUIRED_STAGE_IDS);
  assert.equal(plan.flatMap((stage) => stage.activities).length, 33);
  assert.equal(plan.reduce((sum, stage) => sum + stage.weight, 0), 100);
  assert.ok(plan.every((stage) => stage.activities.every((activity) => activity.required)));
});

test('only the first stage is available and future-stage attempts are gated', () => {
  const session = createLessonSession({ lessonId: 'counting-stars', now: at(0) });
  assert.equal(session.currentStageId, 'onboarding');
  assert.equal(session.stages[0].state, STAGE_STATE.AVAILABLE);
  assert.ok(session.stages.slice(1).every((stage) => stage.state === STAGE_STATE.LOCKED));

  assert.throws(
    () => submit(session, 'quiz.meaning'),
    (error) => error instanceof SessionEngineError && error.code === 'STAGE_LOCKED',
  );
});

test('progress is based on submitted required activities, not navigation or stage count', () => {
  let session = createLessonSession({ lessonId: 'lovely', now: at(0) });
  assert.deepEqual(getSessionProgress(session), { completedActivities: 0, totalActivities: 33, percent: 0 });

  session = submit(session, 'onboarding.goal');
  assert.deepEqual(getSessionProgress(session), { completedActivities: 1, totalActivities: 33, percent: 3 });
  assert.equal(session.currentStageId, 'onboarding');

  session = submit(session, 'onboarding.source');
  assert.deepEqual(getSessionProgress(session), { completedActivities: 2, totalActivities: 33, percent: 6 });
  assert.equal(session.currentStageId, 'meaning');
});

test('failed stage requires recovery and retries do not rewrite first-attempt accuracy', () => {
  let session = createLessonSession({ lessonId: 'believer', now: at(0) });
  session = finishCurrentStage(session);
  session = submit(session, 'meaning.prediction', 1);
  session = submit(session, 'meaning.gist', 0);
  session = submit(session, 'meaning.mood', 0);

  assert.equal(session.status, SESSION_STATUS.RECOVERY_REQUIRED);
  assert.equal(session.stages[1].state, STAGE_STATE.RECOVERY_REQUIRED);
  assert.equal(session.currentStageId, 'meaning');
  assert.equal(getFirstAttemptAccuracy(session).percent, 33);
  assert.equal(getSessionProgress(session).completedActivities, 3);
  assert.throws(
    () => submit(session, 'meaning.gist', 1),
    (error) => error.code === 'RECOVERY_NOT_STARTED',
  );

  session = startStageRecovery(session, { now: at(7) });
  assert.equal(session.stages[1].round, 2);
  session = submit(session, 'meaning.gist', 1, 8);
  session = submit(session, 'meaning.mood', 1, 9);

  assert.equal(session.stages[1].state, STAGE_STATE.COMPLETED);
  assert.equal(session.currentStageId, 'vocabulary');
  assert.equal(getFirstAttemptAccuracy(session).percent, 33);
  assert.equal(getFirstAttemptAccuracy(session).attempted, 3);
  assert.equal(session.stages[1].activities[1].attempts.length, 2);
});

test('a session cannot complete before every mandatory stage passes', () => {
  const session = createLessonSession({ lessonId: 'flowers', now: at(0) });
  const provisional = getCompletionResult(session);
  assert.equal(provisional.completed, false);
  assert.equal(provisional.scorePercent, 0);
  assert.equal(provisional.progressPercent, 0);
  assert.throws(
    () => completeLessonSession(session),
    (error) => error instanceof SessionEngineError && error.code === 'SESSION_INCOMPLETE',
  );
});

test('completion result uses earned scores and can honestly report needs-review', () => {
  const initial = createLessonSession({ lessonId: 'someone-you-loved', now: at(0) });
  const desiredCorrect = {
    meaning: 2,
    vocabulary: 6,
    listening: 4,
    language: 4,
    quiz: 5,
    speaking: 1,
  };
  const counters = {};
  const ready = finishLesson(initial, (stage, activity) => {
    if (!activity.scored) return 1;
    if (activity.id === 'speaking.response') return 0.5;
    counters[stage.id] = (counters[stage.id] || 0) + 1;
    return counters[stage.id] <= (desiredCorrect[stage.id] ?? Infinity) ? 1 : 0;
  });

  assert.equal(ready.status, SESSION_STATUS.READY_TO_COMPLETE);
  const session = completeLessonSession(ready, { now: at(59) });
  assert.equal(session.status, SESSION_STATUS.COMPLETED_NEEDS_REVIEW);
  assert.equal(session.result.completed, true);
  assert.equal(session.result.mastered, false);
  assert.equal(session.result.progressPercent, 100);
  assert.equal(session.result.scorePercent, 70);
  assert.notEqual(session.result.scorePercent, 100);
  assert.deepEqual(session.result.needsReview.sort(), ['listening', 'meaning', 'quiz', 'speaking', 'vocabulary'].sort());
});

test('perfect mandatory work produces a mastered result derived from all activities', () => {
  const initial = createLessonSession({ lessonId: 'blinding-lights', now: at(0) });
  const ready = finishLesson(initial);
  const session = completeLessonSession(ready, { now: at(59) });

  assert.equal(session.status, SESSION_STATUS.MASTERED);
  assert.equal(session.result.scorePercent, 100);
  assert.equal(session.result.progressPercent, 100);
  assert.equal(session.result.completedActivities, 33);
  assert.equal(session.result.firstAttemptAccuracy.percent, 100);
  assert.equal(session.result.firstAttemptAccuracy.coveragePercent, 100);
});

test('serialize/restore preserves gating, attempts, recovery history and exact progress', () => {
  let session = createLessonSession({ lessonId: 'counting-stars', lessonVersion: 'v2', now: at(0) });
  session = finishCurrentStage(session);
  session = submit(session, 'meaning.prediction', 0);
  const before = getSessionProgress(session);

  const restored = restoreLessonSession(serializeLessonSession(session), { expectedLessonId: 'counting-stars' });
  assert.notStrictEqual(restored, session);
  assert.deepEqual(getSessionProgress(restored), before);
  assert.equal(restored.lessonVersion, 'v2');
  assert.equal(restored.currentStageId, 'meaning');
  assert.equal(restored.stages[1].activities[0].attempts[0].score, 0);
  assert.equal(restored.stages[2].state, STAGE_STATE.LOCKED);

  assert.throws(
    () => restoreLessonSession(serializeLessonSession(session), { expectedLessonId: 'lovely' }),
    (error) => error.code === 'LESSON_ID_MISMATCH',
  );
  assert.throws(
    () => restoreLessonSession('{bad json'),
    (error) => error.code === 'INVALID_SERIALIZED_SESSION',
  );
});
