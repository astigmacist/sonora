const SESSION_SCHEMA_VERSION = 1;

export const REQUIRED_STAGE_IDS = Object.freeze([
  'onboarding',
  'meaning',
  'vocabulary',
  'listening',
  'language',
  'quiz',
  'speaking',
]);

export const SESSION_STATUS = Object.freeze({
  IN_PROGRESS: 'in_progress',
  RECOVERY_REQUIRED: 'recovery_required',
  READY_TO_COMPLETE: 'ready_to_complete',
  MASTERED: 'mastered',
  COMPLETED_NEEDS_REVIEW: 'completed_needs_review',
});

export const STAGE_STATE = Object.freeze({
  LOCKED: 'locked',
  AVAILABLE: 'available',
  IN_PROGRESS: 'in_progress',
  RECOVERY_REQUIRED: 'recovery_required',
  COMPLETED: 'completed',
});

export const ACTIVITY_STATE = Object.freeze({
  LOCKED: 'locked',
  AVAILABLE: 'available',
  COMPLETED: 'completed',
  RECOVERY_REQUIRED: 'recovery_required',
});

const FINAL_STATUSES = new Set([
  SESSION_STATUS.MASTERED,
  SESSION_STATUS.COMPLETED_NEEDS_REVIEW,
]);

const STAGE_BLUEPRINTS = Object.freeze([
  {
    id: 'onboarding',
    weight: 0,
    passScore: 0,
    activities: [
      ['onboarding.goal', 'goal_selection', 'planning', false],
      ['onboarding.source', 'source_confirmation', 'listening', false],
    ],
  },
  {
    id: 'meaning',
    weight: 10,
    passScore: 0.6,
    activities: [
      ['meaning.prediction', 'prediction', 'comprehension'],
      ['meaning.gist', 'single_choice', 'comprehension'],
      ['meaning.mood', 'evidence_choice', 'comprehension'],
    ],
  },
  {
    id: 'vocabulary',
    weight: 25,
    passScore: 0.7,
    activities: [
      ['vocabulary.word-1', 'word_recall', 'vocabulary'],
      ['vocabulary.word-2', 'word_recall', 'vocabulary'],
      ['vocabulary.word-3', 'word_recall', 'vocabulary'],
      ['vocabulary.word-4', 'word_recall', 'vocabulary'],
      ['vocabulary.word-5', 'word_recall', 'vocabulary'],
      ['vocabulary.word-6', 'word_recall', 'vocabulary'],
      ['vocabulary.collocation', 'matching', 'vocabulary'],
      ['vocabulary.production', 'production', 'vocabulary'],
    ],
  },
  {
    id: 'listening',
    weight: 25,
    passScore: 0.6,
    activities: [
      ['listening.gist', 'audio_gist', 'listening'],
      ['listening.detail-1', 'audio_detail', 'listening'],
      ['listening.detail-2', 'audio_detail', 'listening'],
      ['listening.order', 'audio_ordering', 'listening'],
      ['listening.target-words', 'audio_word_detection', 'listening'],
      ['listening.mood', 'audio_mood', 'listening'],
    ],
  },
  {
    id: 'language',
    weight: 15,
    passScore: 0.7,
    activities: [
      ['language.register-sort', 'register_sort', 'register'],
      ['language.standard-rewrite', 'rewrite', 'grammar'],
      ['language.context-friend', 'context_choice', 'register'],
      ['language.context-school', 'context_choice', 'register'],
      ['language.figure', 'language_feature', 'grammar'],
    ],
  },
  {
    id: 'quiz',
    weight: 15,
    passScore: 0.7,
    activities: [
      ['quiz.meaning', 'single_choice', 'comprehension'],
      ['quiz.vocabulary-1', 'single_choice', 'vocabulary'],
      ['quiz.vocabulary-2', 'single_choice', 'vocabulary'],
      ['quiz.listening-1', 'single_choice', 'listening'],
      ['quiz.listening-2', 'single_choice', 'listening'],
      ['quiz.register', 'single_choice', 'register'],
      ['quiz.grammar', 'single_choice', 'grammar'],
    ],
  },
  {
    id: 'speaking',
    weight: 10,
    passScore: 0,
    activities: [
      ['speaking.response', 'spoken_response', 'speaking', true, false],
      ['speaking.reflection', 'self_reflection', 'reflection', false],
    ],
  },
]);

export class SessionEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SessionEngineError';
    this.code = code;
  }
}

const fail = (code, message) => {
  throw new SessionEngineError(code, message);
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const timestamp = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail('INVALID_TIMESTAMP', 'A valid timestamp is required.');
  return date.toISOString();
};

const clampPercent = (value) => Math.max(0, Math.min(100, Math.round(value)));

const activityAttemptForRound = (activity, round) => (
  [...activity.attempts].reverse().find((attempt) => attempt.round === round) || null
);

const latestAttempt = (activity) => activity.attempts.at(-1) || null;

const normalizedAttemptScore = (activity, attempt) => (
  attempt ? attempt.score / activity.maxScore : 0
);

const scoredActivities = (stage) => stage.activities.filter((activity) => activity.required && activity.scored);

const requiredActivities = (stage) => stage.activities.filter((activity) => activity.required);

const stageScore = (stage) => {
  const activities = scoredActivities(stage);
  if (!activities.length) return 1;
  const score = activities.reduce((sum, activity) => (
    sum + normalizedAttemptScore(activity, latestAttempt(activity))
  ), 0);
  return score / activities.length;
};

const stageHasOutstandingActivities = (stage) => requiredActivities(stage).some((activity) => (
  activity.state === ACTIVITY_STATE.AVAILABLE
    || activity.state === ACTIVITY_STATE.LOCKED
    || activity.state === ACTIVITY_STATE.RECOVERY_REQUIRED
));

const stageCanBeEvaluated = (stage) => requiredActivities(stage).every((activity) => (
  activity.state === ACTIVITY_STATE.COMPLETED
));

const assertSevenStages = (stages) => {
  if (!Array.isArray(stages) || stages.length !== REQUIRED_STAGE_IDS.length) {
    fail('INVALID_PLAN', `A lesson plan must contain exactly ${REQUIRED_STAGE_IDS.length} stages.`);
  }
  stages.forEach((stage, index) => {
    if (stage.id !== REQUIRED_STAGE_IDS[index]) {
      fail('INVALID_PLAN', `Stage ${index + 1} must be "${REQUIRED_STAGE_IDS[index]}".`);
    }
  });
};

const validatePlan = (plan) => {
  assertSevenStages(plan);
  const ids = new Set();
  let totalWeight = 0;
  plan.forEach((stage) => {
    if (!Array.isArray(stage.activities) || !stage.activities.some((activity) => activity.required !== false)) {
      fail('INVALID_PLAN', `Stage "${stage.id}" must contain a required activity.`);
    }
    if (!Number.isFinite(stage.weight) || stage.weight < 0) fail('INVALID_PLAN', `Invalid weight for "${stage.id}".`);
    if (!Number.isFinite(stage.passScore) || stage.passScore < 0 || stage.passScore > 1) {
      fail('INVALID_PLAN', `Invalid pass score for "${stage.id}".`);
    }
    totalWeight += stage.weight;
    stage.activities.forEach((activity) => {
      if (!activity.id || ids.has(activity.id)) fail('INVALID_PLAN', `Duplicate or empty activity id "${activity.id}".`);
      ids.add(activity.id);
      if (!Number.isFinite(activity.maxScore) || activity.maxScore <= 0) {
        fail('INVALID_PLAN', `Invalid max score for "${activity.id}".`);
      }
    });
  });
  if (Math.abs(totalWeight - 100) > Number.EPSILON) {
    fail('INVALID_PLAN', 'Scored stage weights must add up to 100.');
  }
};

export function createDefaultLessonPlan() {
  return STAGE_BLUEPRINTS.map((stage) => ({
    id: stage.id,
    weight: stage.weight,
    passScore: stage.passScore,
    activities: stage.activities.map(([id, kind, skill, scored = true, accuracyEligible = scored]) => ({
      id,
      kind,
      skill,
      required: true,
      scored,
      accuracyEligible,
      maxScore: 1,
    })),
  }));
}

export function createLessonSession({
  lessonId,
  lessonVersion = null,
  plan = createDefaultLessonPlan(),
  now = new Date(),
} = {}) {
  if (typeof lessonId !== 'string' || !lessonId.trim()) fail('INVALID_LESSON_ID', 'lessonId is required.');
  validatePlan(plan);
  const createdAt = timestamp(now);
  const stages = clone(plan).map((stage, stageIndex) => ({
    ...stage,
    state: stageIndex === 0 ? STAGE_STATE.AVAILABLE : STAGE_STATE.LOCKED,
    round: 1,
    score: null,
    activities: stage.activities.map((activity) => ({
      ...activity,
      required: activity.required !== false,
      scored: activity.scored !== false,
      state: stageIndex === 0 ? ACTIVITY_STATE.AVAILABLE : ACTIVITY_STATE.LOCKED,
      attempts: [],
    })),
  }));

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    lessonId: lessonId.trim(),
    lessonVersion,
    status: SESSION_STATUS.IN_PROGRESS,
    currentStageId: REQUIRED_STAGE_IDS[0],
    stages,
    startedAt: createdAt,
    updatedAt: createdAt,
    completedAt: null,
    result: null,
  };
}

const findActivity = (session, activityId) => {
  for (let stageIndex = 0; stageIndex < session.stages.length; stageIndex += 1) {
    const activityIndex = session.stages[stageIndex].activities.findIndex((activity) => activity.id === activityId);
    if (activityIndex !== -1) return { stageIndex, activityIndex };
  }
  fail('ACTIVITY_NOT_FOUND', `Unknown activity "${activityId}".`);
};

const unlockNextStage = (session, completedStageIndex) => {
  const nextStage = session.stages[completedStageIndex + 1];
  if (!nextStage) {
    session.status = SESSION_STATUS.READY_TO_COMPLETE;
    session.currentStageId = null;
    return;
  }
  nextStage.state = STAGE_STATE.AVAILABLE;
  nextStage.activities.forEach((activity) => {
    if (activity.state === ACTIVITY_STATE.LOCKED) activity.state = ACTIVITY_STATE.AVAILABLE;
  });
  session.status = SESSION_STATUS.IN_PROGRESS;
  session.currentStageId = nextStage.id;
};

const evaluateStage = (session, stageIndex) => {
  const stage = session.stages[stageIndex];
  if (!stageCanBeEvaluated(stage)) return;
  const score = stageScore(stage);
  stage.score = score;
  if (score + Number.EPSILON >= stage.passScore) {
    stage.state = STAGE_STATE.COMPLETED;
    unlockNextStage(session, stageIndex);
    return;
  }

  const scored = scoredActivities(stage);
  let recovery = scored.filter((activity) => normalizedAttemptScore(activity, latestAttempt(activity)) < stage.passScore);
  if (!recovery.length && scored.length) {
    const lowest = Math.min(...scored.map((activity) => normalizedAttemptScore(activity, latestAttempt(activity))));
    recovery = scored.filter((activity) => normalizedAttemptScore(activity, latestAttempt(activity)) === lowest);
  }
  recovery.forEach((activity) => { activity.state = ACTIVITY_STATE.RECOVERY_REQUIRED; });
  stage.state = STAGE_STATE.RECOVERY_REQUIRED;
  session.status = SESSION_STATUS.RECOVERY_REQUIRED;
  session.currentStageId = stage.id;
};

export function submitActivity(session, {
  activityId,
  score,
  correct,
  durationSeconds = 0,
  response = null,
  now = new Date(),
} = {}) {
  validateSession(session);
  if (FINAL_STATUSES.has(session.status)) fail('SESSION_FINALIZED', 'A completed session cannot accept new attempts.');
  const next = clone(session);
  const { stageIndex, activityIndex } = findActivity(next, activityId);
  const stage = next.stages[stageIndex];
  const activity = stage.activities[activityIndex];

  if (![STAGE_STATE.AVAILABLE, STAGE_STATE.IN_PROGRESS].includes(stage.state)) {
    fail(stage.state === STAGE_STATE.RECOVERY_REQUIRED ? 'RECOVERY_NOT_STARTED' : 'STAGE_LOCKED', `Stage "${stage.id}" is not available.`);
  }
  if (activity.state !== ACTIVITY_STATE.AVAILABLE) {
    fail(activity.state === ACTIVITY_STATE.LOCKED ? 'ACTIVITY_LOCKED' : 'ACTIVITY_ALREADY_SUBMITTED', `Activity "${activityId}" is not available.`);
  }
  const effectiveScore = activity.scored ? score : activity.maxScore;
  if (!Number.isFinite(effectiveScore) || effectiveScore < 0 || effectiveScore > activity.maxScore) {
    fail('INVALID_SCORE', `score must be between 0 and ${activity.maxScore}.`);
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    fail('INVALID_DURATION', 'durationSeconds must be a non-negative number.');
  }

  const normalizedScore = effectiveScore / activity.maxScore;
  const attempt = {
    number: activity.attempts.length + 1,
    round: stage.round,
    score: effectiveScore,
    correct: typeof correct === 'boolean' ? correct : normalizedScore + Number.EPSILON >= stage.passScore,
    durationSeconds,
    response,
    submittedAt: timestamp(now),
  };
  activity.attempts.push(attempt);
  activity.state = ACTIVITY_STATE.COMPLETED;
  stage.state = STAGE_STATE.IN_PROGRESS;
  next.status = SESSION_STATUS.IN_PROGRESS;
  next.currentStageId = stage.id;
  next.updatedAt = attempt.submittedAt;

  if (!stageHasOutstandingActivities(stage)) evaluateStage(next, stageIndex);
  return next;
}

export function startStageRecovery(session, { stageId = session?.currentStageId, now = new Date() } = {}) {
  validateSession(session);
  if (FINAL_STATUSES.has(session.status)) fail('SESSION_FINALIZED', 'A completed session cannot be recovered.');
  const next = clone(session);
  const stage = next.stages.find((item) => item.id === stageId);
  if (!stage) fail('STAGE_NOT_FOUND', `Unknown stage "${stageId}".`);
  if (stage.state !== STAGE_STATE.RECOVERY_REQUIRED) {
    fail('RECOVERY_NOT_REQUIRED', `Stage "${stageId}" does not require recovery.`);
  }
  stage.round += 1;
  stage.state = STAGE_STATE.IN_PROGRESS;
  stage.activities.forEach((activity) => {
    if (activity.state === ACTIVITY_STATE.RECOVERY_REQUIRED) activity.state = ACTIVITY_STATE.AVAILABLE;
  });
  next.status = SESSION_STATUS.IN_PROGRESS;
  next.currentStageId = stage.id;
  next.updatedAt = timestamp(now);
  return next;
}

export function getFirstAttemptAccuracy(session) {
  validateSession(session);
  const activities = session.stages.flatMap((stage) => (
    scoredActivities(stage).filter((activity) => activity.accuracyEligible !== false)
  ));
  const attempted = activities.filter((activity) => activity.attempts.length > 0);
  const correct = attempted.filter((activity) => activity.attempts[0].correct).length;
  return {
    correct,
    attempted: attempted.length,
    total: activities.length,
    percent: attempted.length ? clampPercent(correct / attempted.length * 100) : 0,
    coveragePercent: activities.length ? clampPercent(attempted.length / activities.length * 100) : 100,
  };
}

export function getSessionProgress(session) {
  validateSession(session);
  const activities = session.stages.flatMap((stage) => requiredActivities(stage).map((activity) => ({ stage, activity })));
  const completed = activities.filter(({ stage, activity }) => (
    stage.state === STAGE_STATE.COMPLETED
      || activity.state === ACTIVITY_STATE.COMPLETED
  )).length;
  return {
    completedActivities: completed,
    totalActivities: activities.length,
    percent: activities.length ? clampPercent(completed / activities.length * 100) : 100,
  };
}

const completionScore = (session) => session.stages.reduce((sum, stage) => {
  if (!stage.weight) return sum;
  const score = stage.state === STAGE_STATE.COMPLETED ? stageScore(stage) : 0;
  return sum + score * stage.weight;
}, 0);

export function getCompletionResult(session) {
  validateSession(session);
  const progress = getSessionProgress(session);
  const firstAttemptAccuracy = getFirstAttemptAccuracy(session);
  const allStagesComplete = session.stages.every((stage) => stage.state === STAGE_STATE.COMPLETED);
  const scorePercent = clampPercent(completionScore(session));
  const stageResults = Object.fromEntries(session.stages.map((stage) => [stage.id, {
    state: stage.state,
    scorePercent: stage.state === STAGE_STATE.COMPLETED ? clampPercent(stageScore(stage) * 100) : null,
    rounds: stage.round,
  }]));
  const coreThresholdsMet = ['vocabulary', 'listening', 'quiz'].every((stageId) => {
    const stage = session.stages.find((item) => item.id === stageId);
    return stage?.state === STAGE_STATE.COMPLETED && stageScore(stage) + Number.EPSILON >= 0.7;
  });
  const speakingComplete = session.stages.find((stage) => stage.id === 'speaking')?.state === STAGE_STATE.COMPLETED;
  const mastered = allStagesComplete && scorePercent >= 80 && coreThresholdsMet && speakingComplete;
  const outcome = allStagesComplete
    ? mastered ? SESSION_STATUS.MASTERED : SESSION_STATUS.COMPLETED_NEEDS_REVIEW
    : session.status === SESSION_STATUS.RECOVERY_REQUIRED ? SESSION_STATUS.RECOVERY_REQUIRED : SESSION_STATUS.IN_PROGRESS;

  return {
    completed: allStagesComplete,
    mastered,
    outcome,
    scorePercent,
    progressPercent: progress.percent,
    completedActivities: progress.completedActivities,
    totalActivities: progress.totalActivities,
    firstAttemptAccuracy,
    stageResults,
    needsReview: session.stages
      .filter((stage) => stage.weight && (stage.state !== STAGE_STATE.COMPLETED || stageScore(stage) < 0.8))
      .map((stage) => stage.id),
  };
}

export function completeLessonSession(session, { now = new Date() } = {}) {
  validateSession(session);
  if (FINAL_STATUSES.has(session.status)) return clone(session);
  const result = getCompletionResult(session);
  if (!result.completed) {
    fail('SESSION_INCOMPLETE', `Cannot complete lesson at ${result.progressPercent}% activity progress.`);
  }
  const next = clone(session);
  next.status = result.outcome;
  next.currentStageId = null;
  next.completedAt = timestamp(now);
  next.updatedAt = next.completedAt;
  next.result = result;
  return next;
}

export function serializeLessonSession(session) {
  validateSession(session);
  return JSON.stringify(session);
}

export function restoreLessonSession(serialized, { expectedLessonId } = {}) {
  let session;
  try {
    session = typeof serialized === 'string' ? JSON.parse(serialized) : clone(serialized);
  } catch {
    fail('INVALID_SERIALIZED_SESSION', 'The serialized lesson session is not valid JSON.');
  }
  validateSession(session);
  if (expectedLessonId && session.lessonId !== expectedLessonId) {
    fail('LESSON_ID_MISMATCH', `Expected lesson "${expectedLessonId}", received "${session.lessonId}".`);
  }
  return clone(session);
}

export function validateSession(session) {
  if (!session || typeof session !== 'object') fail('INVALID_SESSION', 'A lesson session object is required.');
  if (session.schemaVersion !== SESSION_SCHEMA_VERSION) {
    fail('UNSUPPORTED_SESSION_VERSION', `Unsupported session schema version "${session.schemaVersion}".`);
  }
  if (typeof session.lessonId !== 'string' || !session.lessonId) fail('INVALID_SESSION', 'Session lessonId is missing.');
  assertSevenStages(session.stages);
  const ids = new Set();
  session.stages.forEach((stage) => {
    if (!Object.values(STAGE_STATE).includes(stage.state)) fail('INVALID_SESSION', `Invalid state for stage "${stage.id}".`);
    if (!Number.isInteger(stage.round) || stage.round < 1) fail('INVALID_SESSION', `Invalid round for stage "${stage.id}".`);
    if (!Array.isArray(stage.activities) || !stage.activities.length) fail('INVALID_SESSION', `Stage "${stage.id}" has no activities.`);
    stage.activities.forEach((activity) => {
      if (!activity.id || ids.has(activity.id)) fail('INVALID_SESSION', `Duplicate or empty activity id "${activity.id}".`);
      ids.add(activity.id);
      if (!Object.values(ACTIVITY_STATE).includes(activity.state)) fail('INVALID_SESSION', `Invalid state for activity "${activity.id}".`);
      if (!Number.isFinite(activity.maxScore) || activity.maxScore <= 0) fail('INVALID_SESSION', `Invalid maxScore for "${activity.id}".`);
      if (!Array.isArray(activity.attempts)) fail('INVALID_SESSION', `Attempts are missing for "${activity.id}".`);
      activity.attempts.forEach((attempt, index) => {
        if (attempt.number !== index + 1 || !Number.isInteger(attempt.round) || attempt.round < 1) {
          fail('INVALID_SESSION', `Invalid attempt sequence for "${activity.id}".`);
        }
        if (!Number.isFinite(attempt.score) || attempt.score < 0 || attempt.score > activity.maxScore) {
          fail('INVALID_SESSION', `Invalid attempt score for "${activity.id}".`);
        }
      });
    });
  });
  return true;
}
