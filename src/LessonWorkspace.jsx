import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, Check, CheckCircle2, CircleAlert,
  Clock3, Headphones, Lightbulb, LockKeyhole, MessageCircleMore, Mic2,
  Music2, RotateCcw, ShieldCheck, Sparkles, Square, Target, Volume2,
} from 'lucide-react';
import { requiredActivityIdsForSong } from './features/lesson/lessonPlan';
import { hasEmbeddedMedia } from './features/media/songMedia';
import { EmbeddedSongPlayer } from './SongPlayer';

const STORAGE_VERSION = 3;

const stageCopy = {
  en: {
    stages: ['Set a goal', 'Discover meaning', 'Listening lab', 'Vocabulary workout', 'Real English', 'Mastery check', 'Speak & reflect'],
    back: 'Leave lesson', lessonPath: 'Lesson path', stage: 'Stage', completed: 'completed', activitiesDone: 'required actions complete', locked: 'Finish the current stage first',
    setupTitle: 'What do you want from this song?', setupSub: 'Choose a focus. You will still practise every skill, but feedback will prioritise your goal.',
    goals: [['meaning', 'Understand the story', 'Meaning, mood and metaphor'], ['listening', 'Hear more clearly', 'Gist, detail and target words'], ['vocabulary', 'Keep useful words', 'Meaning, context and recall'], ['speaking', 'Talk with confidence', 'A structured personal response']],
    setupNote: 'Required interactions: {count}. Future stages unlock only after you do the work.',
    meaningTitle: 'Predict, then uncover the meaning', meaningSub: 'Make your own interpretation before reading SONORA’s curated explanation.',
    prediction: 'Before reading the explanation, what do you think this song may mean?', predictionPlaceholder: 'Write one honest prediction in your own words…', saveReflection: 'Save my prediction', reflectionHint: 'Write at least 12 characters.',
    predictionOptions: ['A personal or emotional conflict', 'Step-by-step instructions', 'A factual news report'],
    moodQuestion: 'Which mood best fits the song’s language?', moodOptions: ['Emotionally expressive and reflective', 'Neutral and technical', 'Purely comic'],
    reveal: 'Curated explanation', keyIdea: 'Main idea', mood: 'Mood & message', culture: 'Cultural lens', yourAnswer: 'Your choice',
    listeningTitle: 'Listen with a purpose', listeningSub: 'Play the official recording inside SONORA, identify the main idea, then train detail listening with a new example.',
    openRecording: 'Load the official player', sourceNote: 'Thirty seconds of active playback unlocks the next listening task automatically.', listened: 'Focused sample completed',
    gist: 'What is the central direction of the song?', gistOptions: ['An inner experience or life choice', 'A product advertisement', 'Travel directions'],
    ttsPrompt: 'Now hear a new example sentence. Which target word did you hear?', playSentence: 'Play practice sentence', replay: 'Play again',
    noRecordingTitle: 'No reviewed recording yet', noRecordingSub: 'AI-created lessons never guess a media link. Continue in practice-only mode with the copyright-safe sentence below.', practiceOnly: 'Use practice-only mode',
    vocabTitle: 'Turn this song’s words into active vocabulary', vocabSub: 'Rate every word honestly, hear it, then retrieve meanings without translation first.',
    know: 'I know it', learning: 'New / learning', meaningQuestion: 'Choose the best meaning for', contextQuestion: 'Which word completes this new sentence?',
    helpfulTranslation: 'Translation support', saved: 'Saved', save: 'Save word', pronounce: 'Hear pronunciation', example: 'New example',
    languageTitle: 'Move between song English and school English', languageSub: 'Choose the standard form. Feedback explains register, rhythm and context.',
    songSpokenLabel: 'SONG / SPOKEN FORM', englishResponseLabel: 'ENGLISH RESPONSE',
    chooseStandard: 'Which form belongs in school or formal writing?', suitableFor: 'Use the song form mainly for listening and informal context.',
    registerLabels: { standard: 'Standard', informal: 'Informal', slang: 'Slang', vulgar: 'Vulgar', offensive: 'Offensive' },
    recommendationLabels: { learn_and_use: 'Learn and use', understand_only: 'Understand, use with care', avoid_formally: 'Avoid in formal English' },
    checkpointTitle: 'Prove what you can retrieve', checkpointSub: 'Five mixed questions. You need at least 70%. Wrong answers return as a focused retry.',
    question: 'Question', submitCheck: 'Check five answers', retryWrong: 'Retry incorrect answers', passed: 'Checkpoint passed', score: 'Checkpoint score',
    speakingTitle: 'Make the language yours', speakingSub: 'Give a short English response. Voice recognition is optional; typing is always available.',
    speakingPrompt: 'What is the song’s main message, and how does it connect to real life?',
    goalPrompts: { meaning: 'Explain the song’s main message and one metaphor.', listening: 'Describe what became clearer after listening.', vocabulary: 'Explain the message using at least one target word.', speaking: 'Give your personal response and support it with a reason.' },
    useWords: 'Use at least one target word and write or say 20+ words.',
    startMic: 'Use microphone', stopMic: 'Stop', micUnavailable: 'Voice recognition is unavailable or permission was denied. Type your answer below.',
    response: 'Your English response', responsePlaceholder: 'I think the main message is…', words: 'words', targetUsed: 'target word used', targetMissing: 'add a target word',
    rubric: 'Honest response rubric', content: 'Developed idea', targetVocabulary: 'Target vocabulary', structure: 'Clear connection', submission: 'Response submitted',
    continue: 'Complete stage', finish: 'Finish lesson', incomplete: 'Complete every required activity to continue.',
    resultTitle: 'A real lesson result', resultSub: 'This result is calculated from your attempts and active time — no preset XP or demo percentages.',
    accuracy: 'First-attempt accuracy', activeTime: 'Active learning', practised: 'Words practised', mastery: 'Outcome', mastered: 'Mastered', review: 'Review recommended',
    home: 'Return to learning', minutes: 'min', privacy: 'Only completion metrics are stored. SONORA does not save audio or the full speaking response.',
    syncPending: 'Syncing verified completion…', syncDone: 'Completion verified by the server', syncFailed: 'Saved on this device · server sync needs retry', syncLocal: 'Saved on this device',
    correct: 'Correct', notQuite: 'Not yet', sourceOpened: 'Official player started',
  },
  kk: {
    stages: ['Мақсат', 'Мағынаны ашу', 'Тыңдалым', 'Сөздік жаттығу', 'Шынайы ағылшын', 'Қорытынды тест', 'Сөйлеу'],
    back: 'Сабақтан шығу', lessonPath: 'Сабақ жолы', stage: 'Кезең', completed: 'орындалды', activitiesDone: 'міндетті әрекет орындалды', locked: 'Алдымен ағымдағы кезеңді аяқта',
    setupTitle: 'Бұл әннен нені үйренгің келеді?', setupSub: 'Негізгі мақсатыңды таңда. Барлық дағды орындалады, бірақ кері байланыс мақсатыңа басымдық береді.',
    goals: [['meaning', 'Оқиғаны түсіну', 'Мағына, көңіл күй және метафора'], ['listening', 'Анығырақ есту', 'Жалпы ой, деталь және негізгі сөздер'], ['vocabulary', 'Пайдалы сөздерді сақтау', 'Мағына, контекст және еске түсіру'], ['speaking', 'Сенімді сөйлеу', 'Құрылымды жеке жауап']],
    setupNote: 'Міндетті әрекет: {count}. Келесі кезеңдер жұмысты орындағаннан кейін ғана ашылады.',
    meaningTitle: 'Болжа, содан кейін мағынасын аш', meaningSub: 'SONORA түсіндірмесін оқымай тұрып, өз ойыңды қалыптастыр.',
    prediction: 'Түсіндірмені оқымай тұрып, әннің мағынасын өз сөзіңмен болжа.', predictionPlaceholder: 'Өз болжамыңды бір сөйлеммен жаз…', saveReflection: 'Болжамды сақтау', reflectionHint: 'Кемінде 12 таңба жаз.',
    predictionOptions: ['Жеке немесе эмоциялық қайшылық', 'Қадамдық нұсқаулық', 'Нақты жаңалық'],
    moodQuestion: 'Әннің тіліне қай көңіл күй сәйкес?', moodOptions: ['Эмоциялық әрі ойлы', 'Бейтарап және техникалық', 'Тек күлкілі'],
    reveal: 'Дайындалған түсіндірме', keyIdea: 'Негізгі ой', mood: 'Көңіл күй мен идея', culture: 'Мәдени контекст', yourAnswer: 'Сенің таңдауың',
    listeningTitle: 'Мақсатпен тыңда', listeningSub: 'Ресми жазбаны SONORA ішінде тыңдап, негізгі ойды анықта, кейін жаңа сөйлеммен детальды тыңдалымды жаттықтыр.',
    openRecording: 'Ресми плеерді жүктеу', sourceNote: '30 секунд белсенді ойнатудан кейін келесі тыңдалым тапсырмасы автоматты түрде ашылады.', listened: 'Мақсатты үзінді тыңдалды',
    gist: 'Әннің негізгі бағыты қандай?', gistOptions: ['Ішкі сезім немесе өмірлік таңдау', 'Өнім жарнамасы', 'Жол көрсету'],
    ttsPrompt: 'Жаңа мысалды тыңда. Қай негізгі сөз айтылды?', playSentence: 'Жаттығу сөйлемін тыңдау', replay: 'Қайта тыңдау',
    noRecordingTitle: 'Тексерілген жазба әзірге жоқ', noRecordingSub: 'ЖИ жасаған сабаққа медиа сілтеме болжап қосылмайды. Төмендегі авторлық құқыққа қауіпсіз сөйлеммен жаттығу режимін жалғастыр.', practiceOnly: 'Тек жаттығу режимін қолдану',
    vocabTitle: 'Әндегі сөздерді белсенді қорға айналдыр', vocabSub: 'Әр сөзді адал бағала, айтылуын тыңда және аудармасыз мағынасын еске түсір.',
    know: 'Білемін', learning: 'Жаңа / үйреніп жүрмін', meaningQuestion: 'Дұрыс мағынаны таңда:', contextQuestion: 'Жаңа сөйлемді қай сөз толықтырады?',
    helpfulTranslation: 'Аударма көмегі', saved: 'Сақталды', save: 'Сөзді сақтау', pronounce: 'Айтылуын тыңдау', example: 'Жаңа мысал',
    languageTitle: 'Әндегі және мектептегі ағылшын арасында ауыс', languageSub: 'Стандартты форманы таңда. Түсіндірме регистр, ырғақ және контексті көрсетеді.',
    songSpokenLabel: 'ӘНДЕГІ / АУЫЗЕКІ ФОРМА', englishResponseLabel: 'АҒЫЛШЫНША ЖАУАП',
    chooseStandard: 'Мектепте немесе ресми жазуда қай форма дұрыс?', suitableFor: 'Әндегі форманы негізінен тыңдалымда және бейресми ортада түсін.',
    registerLabels: { standard: 'Стандартты', informal: 'Бейресми', slang: 'Сленг', vulgar: 'Дөрекі', offensive: 'Қорлайтын' },
    recommendationLabels: { learn_and_use: 'Үйрен және қолдан', understand_only: 'Түсін, абайлап қолдан', avoid_formally: 'Ресми тілде қолданба' },
    checkpointTitle: 'Нені есте сақтағаныңды дәлелде', checkpointSub: 'Бес аралас сұрақ. Кемінде 70% керек. Қате жауаптар қысқа қайталауға оралады.',
    question: 'Сұрақ', submitCheck: 'Бес жауапты тексеру', retryWrong: 'Қателерді қайталау', passed: 'Тест өтті', score: 'Тест нәтижесі',
    speakingTitle: 'Тілді өзіңдікі ет', speakingSub: 'Ағылшынша қысқа жауап бер. Дауысты тану міндетті емес, мәтін әрдайым қолжетімді.',
    speakingPrompt: 'Әннің негізгі ойы қандай және ол шынайы өмірмен қалай байланысты?',
    goalPrompts: { meaning: 'Әннің негізгі ойын және бір метафорасын түсіндір.', listening: 'Тыңдағаннан кейін не анығырақ болғанын сипатта.', vocabulary: 'Негізгі ойды кемінде бір жаңа сөзбен түсіндір.', speaking: 'Жеке пікіріңді айтып, себебін келтір.' },
    useWords: 'Кемінде бір негізгі сөзді қолданып, 20+ сөз жаз немесе айт.',
    startMic: 'Микрофонды қолдану', stopMic: 'Тоқтату', micUnavailable: 'Дауысты тану қолжетімсіз немесе рұқсат берілмеді. Жауапты төменге жаз.',
    response: 'Ағылшынша жауабың', responsePlaceholder: 'I think the main message is…', words: 'сөз', targetUsed: 'негізгі сөз қолданылды', targetMissing: 'негізгі сөз қос',
    rubric: 'Адал жауап рубрикасы', content: 'Ой ашылды', targetVocabulary: 'Негізгі сөз', structure: 'Айқын байланыс', submission: 'Жауап жіберілді',
    continue: 'Кезеңді аяқтау', finish: 'Сабақты аяқтау', incomplete: 'Жалғастыру үшін барлық міндетті әрекетті орында.',
    resultTitle: 'Нақты сабақ нәтижесі', resultSub: 'Нәтиже сенің талпыныстарың мен белсенді уақытыңнан есептелді — дайын XP немесе демо пайыз жоқ.',
    accuracy: 'Алғашқы талпыныс дәлдігі', activeTime: 'Белсенді оқу', practised: 'Жаттығылған сөз', mastery: 'Қорытынды', mastered: 'Меңгерілді', review: 'Қайталау ұсынылады',
    home: 'Оқуға қайту', minutes: 'мин', privacy: 'Тек орындалу метрикалары сақталады. SONORA аудио мен толық сөйлеу жауабын сақтамайды.',
    syncPending: 'Нәтиже сервермен тексеріліп жатыр…', syncDone: 'Нәтиже серверде расталды', syncFailed: 'Құрылғыда сақталды · сервермен синхрондау қажет', syncLocal: 'Осы құрылғыда сақталды',
    correct: 'Дұрыс', notQuite: 'Әзірге қате', sourceOpened: 'Ресми плеер іске қосылды',
  },
  ru: {
    stages: ['Поставить цель', 'Раскрыть смысл', 'Аудирование', 'Тренировка слов', 'Живой английский', 'Итоговая проверка', 'Говорение'],
    back: 'Выйти из урока', lessonPath: 'Маршрут урока', stage: 'Этап', completed: 'выполнено', activitiesDone: 'обязательных действий выполнено', locked: 'Сначала заверши текущий этап',
    setupTitle: 'Что ты хочешь получить от этой песни?', setupSub: 'Выбери главный фокус. Ты всё равно потренируешь все навыки, но обратная связь учтёт твою цель.',
    goals: [['meaning', 'Понять историю', 'Смысл, настроение и метафора'], ['listening', 'Слышать яснее', 'Общий смысл, детали и ключевые слова'], ['vocabulary', 'Запомнить полезные слова', 'Значение, контекст и извлечение из памяти'], ['speaking', 'Говорить увереннее', 'Структурированный личный ответ']],
    setupNote: 'Обязательных действий: {count}. Следующие этапы открываются только после реальной работы.',
    meaningTitle: 'Сначала предположи, затем раскрой смысл', meaningSub: 'Сформулируй свою интерпретацию до того, как прочитаешь подготовленное объяснение SONORA.',
    prediction: 'Как ты понимаешь возможный смысл песни до чтения объяснения?', predictionPlaceholder: 'Запиши одно честное предположение своими словами…', saveReflection: 'Сохранить предположение', reflectionHint: 'Напиши не менее 12 символов.',
    predictionOptions: ['Личный или эмоциональный конфликт', 'Пошаговую инструкцию', 'Фактический новостной репортаж'],
    moodQuestion: 'Какое настроение лучше соответствует языку песни?', moodOptions: ['Эмоциональное и задумчивое', 'Нейтральное и техническое', 'Только комическое'],
    reveal: 'Подготовленное объяснение', keyIdea: 'Главная идея', mood: 'Настроение и посыл', culture: 'Культурный контекст', yourAnswer: 'Твой выбор',
    listeningTitle: 'Слушай с конкретной задачей', listeningSub: 'Включи официальную запись внутри SONORA, определи главную идею, затем потренируй детали на новом примере.',
    openRecording: 'Загрузить официальный плеер', sourceNote: 'После 30 секунд активного воспроизведения следующее задание откроется автоматически.', listened: 'Фрагмент внимательно прослушан',
    gist: 'Каково главное направление песни?', gistOptions: ['Внутреннее переживание или жизненный выбор', 'Реклама товара', 'Указания маршрута'],
    ttsPrompt: 'Теперь прослушай новое предложение. Какое ключевое слово прозвучало?', playSentence: 'Включить учебное предложение', replay: 'Прослушать ещё раз',
    noRecordingTitle: 'Проверенной записи пока нет', noRecordingSub: 'Для созданных ИИ уроков SONORA не угадывает медиассылку. Продолжи в режиме практики с безопасным новым предложением ниже.', practiceOnly: 'Продолжить без записи песни',
    vocabTitle: 'Преврати слова этой песни в активный словарь', vocabSub: 'Честно оцени каждое слово, послушай его и извлеки значение из памяти до перевода.',
    know: 'Уже знаю', learning: 'Новое / учу', meaningQuestion: 'Выбери лучшее значение для', contextQuestion: 'Какое слово завершает новое предложение?',
    helpfulTranslation: 'Подсказка-перевод', saved: 'Сохранено', save: 'Сохранить слово', pronounce: 'Прослушать произношение', example: 'Новый пример',
    languageTitle: 'Переключайся между языком песни и школьным английским', languageSub: 'Выбери стандартную форму. Объяснение покажет регистр, ритм и контекст.',
    songSpokenLabel: 'ФОРМА ИЗ ПЕСНИ / РЕЧИ', englishResponseLabel: 'ОТВЕТ НА АНГЛИЙСКОМ',
    chooseStandard: 'Какая форма подходит для школы или официального письма?', suitableFor: 'Форму из песни важно понимать на слух и использовать только в подходящем неформальном контексте.',
    registerLabels: { standard: 'Стандартная', informal: 'Разговорная', slang: 'Сленг', vulgar: 'Грубая', offensive: 'Оскорбительная' },
    recommendationLabels: { learn_and_use: 'Можно учить и использовать', understand_only: 'Важно понимать, применять осторожно', avoid_formally: 'Не использовать в формальной речи' },
    checkpointTitle: 'Проверь, что можешь вспомнить', checkpointSub: 'Пять смешанных вопросов. Нужно минимум 70%. Ошибки вернутся в короткой повторной попытке.',
    question: 'Вопрос', submitCheck: 'Проверить пять ответов', retryWrong: 'Повторить ошибки', passed: 'Проверка пройдена', score: 'Результат проверки',
    speakingTitle: 'Сделай язык своим', speakingSub: 'Дай короткий ответ на английском. Распознавание голоса необязательно — печатать можно всегда.',
    speakingPrompt: 'Какова главная идея песни и как она связана с реальной жизнью?',
    goalPrompts: { meaning: 'Объясни главную идею песни и одну метафору.', listening: 'Опиши, что стало понятнее после прослушивания.', vocabulary: 'Объясни идею, используя минимум одно новое слово.', speaking: 'Выскажи личное мнение и подкрепи его причиной.' },
    useWords: 'Используй хотя бы одно ключевое слово и напиши или скажи 20+ слов.',
    startMic: 'Использовать микрофон', stopMic: 'Остановить', micUnavailable: 'Распознавание голоса недоступно или доступ запрещён. Напечатай ответ ниже.',
    response: 'Твой ответ на английском', responsePlaceholder: 'I think the main message is…', words: 'слов', targetUsed: 'ключевое слово использовано', targetMissing: 'добавь ключевое слово',
    rubric: 'Честная рубрика ответа', content: 'Мысль раскрыта', targetVocabulary: 'Ключевая лексика', structure: 'Ясная связь', submission: 'Ответ отправлен',
    continue: 'Завершить этап', finish: 'Завершить урок', incomplete: 'Выполни все обязательные действия, чтобы продолжить.',
    resultTitle: 'Настоящий результат урока', resultSub: 'Результат рассчитан по твоим попыткам и активному времени — никаких заранее заданных XP и демо-процентов.',
    accuracy: 'Точность первых попыток', activeTime: 'Активное обучение', practised: 'Слов отработано', mastery: 'Итог', mastered: 'Освоено', review: 'Нужно повторение',
    home: 'Вернуться к обучению', minutes: 'мин', privacy: 'Хранятся только метрики выполнения. SONORA не сохраняет аудио и полный ответ для говорения.',
    syncPending: 'Подтверждаем результат на сервере…', syncDone: 'Результат подтверждён сервером', syncFailed: 'Сохранено на устройстве · нужна повторная синхронизация', syncLocal: 'Сохранено на этом устройстве',
    correct: 'Верно', notQuite: 'Пока неверно', sourceOpened: 'Официальный плеер запущен',
  },
};

const stageIcons = [Target, Lightbulb, Headphones, BookOpen, Sparkles, Brain, MessageCircleMore];

const cleanWords = (text = '') => text.trim().split(/\s+/).filter(Boolean);
const normalise = (text = '') => text.toLowerCase().replace(/[^a-z']/g, '');

const speak = (text) => {
  if (!('speechSynthesis' in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.88;
  window.speechSynthesis.speak(utterance);
  return true;
};

const makeOptions = (items, correctIndex, position) => {
  const others = items.map((_, index) => index).filter((index) => index !== correctIndex);
  const selected = [correctIndex, ...others.slice(0, 2)];
  while (selected.length < 3) selected.push(correctIndex);
  const targetPosition = position % 3;
  const current = selected.indexOf(correctIndex);
  [selected[current], selected[targetPosition]] = [selected[targetPosition], selected[current]];
  return { indexes: selected, correct: targetPosition };
};

const makeTextOptions = (correctValue, distractors, position) => {
  const seen = new Set();
  const candidates = [correctValue, ...distractors, 'No change', 'Use the song form unchanged']
    .map((value) => String(value || '').trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
  const targetPosition = position % candidates.length;
  const current = candidates.indexOf(String(correctValue || '').trim());
  [candidates[current], candidates[targetPosition]] = [candidates[targetPosition], candidates[current]];
  return { options: candidates, correct: targetPosition };
};

const initialState = (song, lesson) => ({
  version: STORAGE_VERSION,
  songId: song.id,
  requiredActivityIds: requiredActivityIdsForSong(song.id, lesson),
  status: 'in_progress',
  currentStage: 0,
  completedStages: [],
  answers: {},
  attempts: [],
  activeSeconds: 0,
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  result: null,
});

const restoreState = (song, lesson, supplied) => {
  const requiredActivityIds = requiredActivityIdsForSong(song.id, lesson);
  if (supplied?.version === STORAGE_VERSION && supplied.songId === song.id) return { ...supplied, requiredActivityIds };
  try {
    const parsed = JSON.parse(localStorage.getItem(`sonora-lesson-v${STORAGE_VERSION}:${song.id}`));
    if (parsed?.version === STORAGE_VERSION) return { ...parsed, requiredActivityIds };
  } catch { /* start a clean lesson */ }
  return initialState(song, lesson);
};

const scoreAttempts = (attempts) => {
  const first = new Map();
  attempts.filter((attempt) => typeof attempt.correct === 'boolean').forEach((attempt) => {
    if (!first.has(attempt.activityId)) first.set(attempt.activityId, attempt);
  });
  const values = [...first.values()];
  return values.length ? Math.round(values.filter((item) => item.correct).length / values.length * 100) : 0;
};

export default function LessonWorkspace({
  song, lesson, lang, savedWords, onToggleWord, onExit, onSnapshot, onAttempt, onComplete, initialRecord,
}) {
  const c = stageCopy[lang] || stageCopy.en;
  const [session, setSession] = useState(() => restoreState(song, lesson, initialRecord));
  const [message, setMessage] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingDraft, setSpeakingDraft] = useState('');
  const recognitionRef = useRef(null);
  const timerRef = useRef(0);
  const activityClockRef = useRef(Date.now());
  const stageButtonRefs = useRef([]);
  const stageIndex = session.currentStage;
  const answers = session.answers;
  const requiredActivityIds = session.requiredActivityIds?.length
    ? session.requiredActivityIds
    : requiredActivityIdsForSong(song.id, lesson);
  const requiredIds = new Set(requiredActivityIds);
  const totalRequired = requiredActivityIds.length;

  const updateSession = (recipe) => {
    setSession((current) => {
      const next = typeof recipe === 'function' ? recipe(current) : { ...current, ...recipe };
      const stamped = { ...next, updatedAt: new Date().toISOString() };
      localStorage.setItem(`sonora-lesson-v${STORAGE_VERSION}:${song.id}`, JSON.stringify(stamped));
      queueMicrotask(() => onSnapshot?.(stamped));
      return stamped;
    });
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        timerRef.current += 1;
        if (timerRef.current % 5 === 0) updateSession((current) => ({ ...current, activeSeconds: current.activeSeconds + 5 }));
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [song.id]);

  useEffect(() => {
    let settleFrame;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      if (window.matchMedia?.('(max-width: 900px)').matches) {
        const activeButton = stageButtonRefs.current[stageIndex];
        const stepper = activeButton?.closest('.sn-stepper');
        if (activeButton && stepper) {
          stepper.scrollTo({
            left: activeButton.offsetLeft - (stepper.clientWidth - activeButton.offsetWidth) / 2,
            behavior: 'smooth',
          });
        }
      }
      settleFrame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (settleFrame) window.cancelAnimationFrame(settleFrame);
    };
  }, [stageIndex]);

  const record = (activityId, skill, answer, correct = null) => {
    const fullId = `${song.id}:${activityId}`;
    const durationSeconds = Math.max(1, Math.min(300, Math.round((Date.now() - activityClockRef.current) / 1000)));
    activityClockRef.current = Date.now();
    let created;
    updateSession((current) => {
      const attemptNumber = current.attempts.filter((item) => item.activityId === fullId).length + 1;
      created = { activityId: fullId, skill, answer, correct, durationSeconds, attemptNumber, at: new Date().toISOString() };
      return { ...current, attempts: [...current.attempts, created] };
    });
    queueMicrotask(() => onAttempt?.(created));
  };

  const setAnswer = (key, value, { skill, correct = null, activityId = key } = {}) => {
    updateSession((current) => ({ ...current, answers: { ...current.answers, [key]: value } }));
    if (skill) record(activityId, skill, value, correct);
    setMessage('');
  };

  const wordMeaningQuestions = useMemo(() => lesson.words.slice(0, 3).map((word, index) => ({
    word,
    ...makeOptions(lesson.words, index, index + 1),
  })), [lesson]);

  const listeningWord = lesson.words[Math.min(2, lesson.words.length - 1)];
  const listeningOptions = useMemo(() => makeOptions(lesson.words, Math.min(2, lesson.words.length - 1), 2), [lesson]);

  const registerQuestions = useMemo(() => lesson.languageLab.map((item, index) => {
    const alternatives = lesson.languageLab
      .filter((_, itemIndex) => itemIndex !== index)
      .flatMap((entry) => [entry.standard, entry.song]);
    return { item, ...makeTextOptions(item.standard, [item.song, ...alternatives], index + 2) };
  }), [lesson]);

  const checkpoint = useMemo(() => {
    const questions = [{
      id: 'meaning', prompt: lesson.quiz.question[lang], options: lesson.quiz.answers[lang], correct: lesson.quiz.correct, skill: 'meaning',
    }];
    lesson.words.slice(0, 3).forEach((word, index) => {
      const choice = makeOptions(lesson.words, index, index);
      questions.push({ id: `word-${index}`, prompt: `${c.meaningQuestion} “${word.word}”?`, options: choice.indexes.map((idx) => lesson.words[idx].meaning[lang]), correct: choice.correct, skill: 'vocabulary' });
    });
    const note = lesson.languageLab[0];
    questions.push({ id: 'register', prompt: `${c.chooseStandard} “${note.song}”`, options: [note.standard, note.song, lesson.languageLab[1]?.song || 'no change'], correct: 0, skill: 'language' });
    return questions;
  }, [lesson, lang, c.meaningQuestion, c.chooseStandard]);

  const checkpointAnswered = checkpoint.every((question) => answers[`quiz:${question.id}`] !== undefined && answers[`quiz:${question.id}`] !== null);
  const checkpointScore = checkpointAnswered ? Math.round(checkpoint.filter((question) => answers[`quiz:${question.id}`] === question.correct).length / checkpoint.length * 100) : 0;
  const checkpointSubmitted = Boolean(answers.checkpointSubmitted);

  const submitCheckpoint = () => {
    if (!checkpointAnswered) return;
    const previouslyLocked = new Set(answers.checkpointLocked || []);
    checkpoint.forEach((question, index) => {
      if (previouslyLocked.has(question.id)) return;
      const answer = answers[`quiz:${question.id}`];
      record(`checkpoint:q:${index}`, question.skill, answer, answer === question.correct);
    });
    const checkpointLocked = checkpoint
      .filter((question) => answers[`quiz:${question.id}`] === question.correct)
      .map((question) => question.id);
    updateSession((current) => ({
      ...current,
      answers: {
        ...current.answers,
        checkpointSubmitted: true,
        checkpointLocked: [...new Set([...(current.answers.checkpointLocked || []), ...checkpointLocked])],
      },
    }));
    setMessage('');
  };

  const retryCheckpoint = () => {
    updateSession((current) => {
      const locked = new Set(current.answers.checkpointLocked || []);
      const nextAnswers = { ...current.answers, checkpointSubmitted: false };
      checkpoint.forEach((question) => {
        if (!locked.has(question.id)) delete nextAnswers[`quiz:${question.id}`];
      });
      return { ...current, answers: nextAnswers };
    });
    setMessage('');
  };

  // The full speaking response stays only in volatile component memory. We persist
  // derived counts and rubric results, never audio or the transcript itself.
  const speakingText = speakingDraft;
  const speakingWords = cleanWords(speakingText);
  const normalizedSpeaking = ` ${speakingWords.map(normalise).filter(Boolean).join(' ')} `;
  const targetMatches = lesson.words.filter((word) => {
    const phrase = cleanWords(word.word).map(normalise).filter(Boolean).join(' ');
    return phrase && normalizedSpeaking.includes(` ${phrase} `);
  });
  const speakingValid = speakingWords.length >= 20 && targetMatches.length >= 1;
  const speakingRubric = {
    content: Math.min(4, Math.floor(speakingWords.length / 6)),
    vocabulary: Math.min(2, targetMatches.length * 2),
    structure: /\b(because|although|however|so|but|i think|in my view)\b/i.test(speakingText) ? 2 : speakingWords.length >= 25 ? 1 : 0,
    submission: speakingValid ? 2 : 0,
  };
  const speakingScore = Object.values(speakingRubric).reduce((sum, value) => sum + value, 0);

  const stageValid = [
    Boolean(answers.goal),
    Boolean(answers.predictionSubmitted) && answers.mood !== undefined,
    Boolean(answers.sourceDone) && answers.listeningGist !== undefined && Boolean(answers.ttsPlayed) && answers.listeningWord !== undefined,
    lesson.words.every((_, index) => answers[`rating:${index}`]) && wordMeaningQuestions.every((_, index) => answers[`vocab:${index}`] !== undefined) && answers.vocabContext !== undefined,
    registerQuestions.every((_, index) => answers[`register:${index}`] !== undefined),
    checkpointAnswered && checkpointSubmitted && checkpointScore >= 70,
    speakingValid,
  ];

  const completeStage = () => {
    if (!stageValid[stageIndex]) {
      setMessage(c.incomplete);
      return;
    }
    if (stageIndex < 6) {
      const nextStage = stageIndex + 1;
      updateSession((current) => ({
        ...current,
        currentStage: nextStage,
        completedStages: [...new Set([...current.completedStages, stageIndex])],
      }));
      return;
    }
    const speakingAttempt = {
      activityId: `${song.id}:speaking:response`,
      skill: 'speaking',
      answer: { wordCount: speakingWords.length, targetWordsUsed: targetMatches.length, rubricScore: speakingScore },
      correct: null,
      durationSeconds: Math.max(1, Math.min(300, Math.round((Date.now() - activityClockRef.current) / 1000))),
      attemptNumber: 1,
      at: new Date().toISOString(),
    };
    const finalAttempts = session.attempts.some((item) => item.activityId === speakingAttempt.activityId)
      ? session.attempts
      : [...session.attempts, speakingAttempt];
    const accuracy = scoreAttempts(finalAttempts);
    const result = {
      songId: song.id,
      accuracy,
      activeSeconds: session.activeSeconds + timerRef.current % 5,
      wordsPractised: lesson.words.length,
      speakingScore,
      checkpointScore,
      mastery: accuracy >= 75 && checkpointScore >= 80 ? 'mastered' : 'review',
      attempts: finalAttempts.length,
      completedAt: new Date().toISOString(),
    };
    const completedSession = { ...session, attempts: finalAttempts, status: 'completed', syncStatus: 'pending', currentStage: 6, completedStages: [0, 1, 2, 3, 4, 5, 6], result };
    updateSession(completedSession);
    onComplete?.(result, completedSession);
  };

  const goToStage = (index) => {
    const unlocked = index <= Math.max(0, ...session.completedStages.map((value) => value + 1), session.currentStage);
    if (!unlocked) { setMessage(c.locked); return; }
    updateSession((current) => ({ ...current, currentStage: index }));
  };

  const startRecognition = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setAnswer('speechError', true); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.onstart = () => { setListening(true); setAnswer('speechError', false); };
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map((result) => result[0].transcript).join(' ');
      setSpeakingDraft(text);
    };
    recognition.onerror = () => { setListening(false); setAnswer('speechError', true); };
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  if (session.status === 'completed' && session.result) {
    const result = session.result;
    const syncStatus = initialRecord?.syncStatus || session.syncStatus || 'local_only';
    const syncLabel = { pending: c.syncPending, synced: c.syncDone, failed: c.syncFailed, local_only: c.syncLocal }[syncStatus] || c.syncLocal;
    return (
      <div className="sn-lesson sn-lesson-result">
        <header className="sn-lesson-bar"><button onClick={onExit}><ArrowLeft />{c.back}</button><LessonBrand /><span className="sn-status-complete"><CheckCircle2 />100%</span></header>
        <main className="sn-result-card">
          <div className="sn-result-symbol"><CheckCircle2 /></div>
          <span className="sn-kicker">{song.title} · {song.artist}</span>
          <h1>{c.resultTitle}</h1><p>{c.resultSub}</p>
          <div className="sn-result-grid">
            <ResultMetric value={`${result.accuracy}%`} label={c.accuracy} />
            <ResultMetric value={`${Math.max(1, Math.floor(result.activeSeconds / 60))} ${c.minutes}`} label={c.activeTime} />
            <ResultMetric value={result.wordsPractised} label={c.practised} />
            <ResultMetric value={result.mastery === 'mastered' ? c.mastered : c.review} label={c.mastery} />
          </div>
          <p className="sn-privacy"><ShieldCheck />{c.privacy}</p>
          <p className={`sn-sync-status ${syncStatus}`} aria-live="polite">{syncLabel}</p>
          <button className="sn-primary sn-wide" onClick={onExit}>{c.home}<ArrowRight /></button>
        </main>
      </div>
    );
  }

  const completedRequired = new Set(session.attempts.map((attempt) => attempt.activityId).filter((id) => requiredIds.has(id))).size;
  const progress = Math.round(completedRequired / totalRequired * 100);
  const StageIcon = stageIcons[stageIndex];

  return (
    <div className="sn-lesson">
      <header className="sn-lesson-bar">
        <button onClick={onExit}><ArrowLeft />{c.back}</button>
        <LessonBrand />
        <div className="sn-lesson-progress"><span>{progress}%</span><i><b style={{ width: `${progress}%` }} /></i></div>
      </header>

      <aside className="sn-stepper" aria-label={c.lessonPath}>
        <div className="sn-stepper-song"><div className={`sn-cover ${song.cover}`}><Music2 /><span>{song.title}</span></div><div><strong>{song.title}</strong><span>{song.artist}</span></div></div>
        <span className="sn-stepper-label">{c.lessonPath}</span>
        <nav>
          {c.stages.map((label, index) => {
            const Icon = stageIcons[index];
            const done = session.completedStages.includes(index);
            const available = index <= Math.max(0, ...session.completedStages.map((value) => value + 1), session.currentStage);
            return <button key={label} ref={(node) => { stageButtonRefs.current[index] = node; }} aria-current={index === stageIndex ? 'step' : undefined} className={`${index === stageIndex ? 'active' : ''} ${done ? 'done' : ''}`} disabled={!available} onClick={() => goToStage(index)}><span>{done ? <Check /> : available ? <Icon /> : <LockKeyhole />}</span><div><strong>{label}</strong><small>{done ? c.completed : `${c.stage} ${index + 1}`}</small></div></button>;
          })}
        </nav>
        <div className="sn-stepper-meta"><Clock3 /><span>{Math.max(0, Math.floor(session.activeSeconds / 60))} {c.minutes}</span><strong>{completedRequired}</strong><span>{c.completed}</span></div>
      </aside>

      <main className="sn-activity-shell">
        <header className="sn-stage-head"><span className="sn-stage-icon"><StageIcon /></span><div><span className="sn-kicker">{c.stage} {stageIndex + 1} / 7 · {song.level}</span><h1>{[
          c.setupTitle, c.meaningTitle, c.listeningTitle, c.vocabTitle, c.languageTitle, c.checkpointTitle, c.speakingTitle,
        ][stageIndex]}</h1><p>{[
          c.setupSub, c.meaningSub, c.listeningSub, c.vocabSub, c.languageSub, c.checkpointSub, c.speakingSub,
        ][stageIndex]}</p></div></header>

        {stageIndex === 0 && <SetupStage c={c} answers={answers} requiredCount={totalRequired} choose={(goal) => setAnswer('goal', goal, { skill: 'setup', activityId: 'setup:goal' })} />}
        {stageIndex === 1 && <MeaningStage c={c} lang={lang} lesson={lesson} answers={answers} choose={setAnswer} />}
        {stageIndex === 2 && <ListeningStage c={c} lang={lang} song={song} lesson={lesson} listeningWord={listeningWord} listeningOptions={listeningOptions} answers={answers} choose={setAnswer} />}
        {stageIndex === 3 && <VocabularyStage c={c} lang={lang} lesson={lesson} questions={wordMeaningQuestions} answers={answers} choose={setAnswer} savedWords={savedWords} onToggleWord={onToggleWord} />}
        {stageIndex === 4 && <LanguageStage c={c} lang={lang} questions={registerQuestions} answers={answers} choose={setAnswer} />}
        {stageIndex === 5 && <CheckpointStage c={c} questions={checkpoint} answers={answers} choose={setAnswer} answered={checkpointAnswered} submitted={checkpointSubmitted} score={checkpointScore} submit={submitCheckpoint} retry={retryCheckpoint} />}
        {stageIndex === 6 && <SpeakingStage c={c} lesson={lesson} answers={answers} text={speakingText} setText={setSpeakingDraft} words={speakingWords} targetMatches={targetMatches} listening={listening} startRecognition={startRecognition} rubric={speakingRubric} score={speakingScore} />}

        {message && <div className="sn-inline-error"><CircleAlert />{message}</div>}
        <footer className="sn-stage-footer"><span>{completedRequired} / {totalRequired} {c.activitiesDone}</span><button className="sn-primary" disabled={!stageValid[stageIndex]} onClick={completeStage}>{stageIndex === 6 ? c.finish : c.continue}<ArrowRight /></button></footer>
      </main>
    </div>
  );
}

function LessonBrand() { return <div className="sn-lesson-brand"><span><i /><i /><i /></span>SONORA</div>; }
function ResultMetric({ value, label }) { return <div><strong>{value}</strong><span>{label}</span></div>; }

function OptionGroup({ options, value, onChange, correct, reveal = false, disabled = false, lockedIndexes = [] }) {
  return <div className="sn-options" role="radiogroup">{options.map((option, index) => { const locked = disabled || lockedIndexes.includes(index); return <button type="button" role="radio" aria-checked={value === index} disabled={locked} key={`${option}-${index}`} className={`${value === index ? 'selected' : ''} ${reveal && index === correct ? 'correct' : ''} ${reveal && value === index && value !== correct ? 'wrong' : ''}`} onClick={() => onChange(index)}><span>{String.fromCharCode(65 + index)}</span><p>{option}</p>{reveal && index === correct && <CheckCircle2 />}</button>; })}</div>;
}

function SetupStage({ c, answers, requiredCount, choose }) {
  return <section className="sn-stage-body"><div className="sn-goal-grid">{c.goals.map(([id, title, sub], index) => { const Icon = stageIcons[[1, 2, 3, 6][index]]; return <button type="button" aria-pressed={answers.goal === id} key={id} className={answers.goal === id ? 'selected' : ''} onClick={() => choose(id)}><span><Icon /></span><strong>{title}</strong><p>{sub}</p>{answers.goal === id && <CheckCircle2 />}</button>; })}</div><div className="sn-info-strip"><Target /><p>{c.setupNote.replace('{count}', requiredCount)}</p></div></section>;
}

function MeaningStage({ c, lang, lesson, answers, choose }) {
  const predictionDone = Boolean(answers.predictionSubmitted);
  const moodDone = answers.mood !== undefined;
  const predictionReady = (answers.prediction || '').trim().length >= 12;
  return <section className="sn-stage-body sn-two-column"><div className="sn-task-stack"><article className="sn-task-card sn-reflection-card"><span className="sn-task-count">1</span><h2>{c.prediction}</h2><textarea value={answers.prediction || ''} readOnly={predictionDone} onChange={(event) => choose('prediction', event.target.value)} placeholder={c.predictionPlaceholder} maxLength={320} /><div><small>{c.reflectionHint}</small><button type="button" disabled={!predictionReady || predictionDone} onClick={() => choose('predictionSubmitted', true, { skill: 'meaning', activityId: 'meaning:prediction' })}>{predictionDone ? <Check /> : <ArrowRight />}{c.saveReflection}</button></div></article><article className="sn-task-card"><span className="sn-task-count">2</span><h2>{c.moodQuestion}</h2><OptionGroup options={c.moodOptions} value={answers.mood} reveal={false} onChange={(value) => choose('mood', value, { skill: 'meaning', activityId: 'meaning:mood' })} /></article></div><aside className={`sn-reveal-panel ${predictionDone && moodDone ? 'revealed' : ''}`}><span><Sparkles />{c.reveal}</span>{predictionDone && moodDone ? <><h3>{c.keyIdea}</h3><p>{lesson.meaning[lang].idea}</p><h3>{c.mood}</h3><p>{lesson.meaning[lang].mood}</p><h3>{c.culture}</h3><p>{lesson.meaning[lang].culture}</p></> : <div className="sn-reveal-locked"><LockKeyhole /><p>{c.meaningSub}</p></div>}</aside></section>;
}

function ListeningStage({ c, lang, song, lesson, listeningWord, listeningOptions, answers, choose }) {
  const listeningAnswered = answers.listeningWord !== undefined;
  const gistAnswered = answers.listeningGist !== undefined;
  const playPractice = () => {
    if (!speak(listeningWord.example) || answers.ttsPlayed) return;
    choose('ttsPlayed', true);
  };
  const markPlayerStarted = () => {
    if (!answers.sourceOpened) choose('sourceOpened', true, { skill: 'listening', activityId: 'listening:source-open' });
  };
  const completeSample = () => {
    if (!answers.sourceDone) choose('sourceDone', true, { skill: 'listening', activityId: 'listening:source' });
  };
  return <section className="sn-stage-body">
    <article className="sn-listening-media-card">
      {hasEmbeddedMedia(song) ? <EmbeddedSongPlayer song={song} lang={lang} onPlaying={markPlayerStarted} onQualified={completeSample} qualifiedSeconds={30} qualifiedComplete={Boolean(answers.sourceDone)} /> : <div className="sn-practice-only"><span><Music2 /></span><div><h2>{c.noRecordingTitle}</h2><p>{c.noRecordingSub}</p></div><button type="button" disabled={Boolean(answers.sourceDone)} onClick={() => choose('sourceDone', 'practice-only', { skill: 'listening', activityId: 'listening:source' })}>{answers.sourceDone ? <Check /> : <ArrowRight />}{answers.sourceDone ? c.listened : c.practiceOnly}</button></div>}
      <p className="sn-listening-instruction"><Headphones />{c.sourceNote}</p>
    </article>
    <div className="sn-listening-tasks">
      <article className="sn-task-card"><span className="sn-task-count">2</span><h2>{c.gist}</h2><OptionGroup disabled={!answers.sourceDone} options={c.gistOptions} value={answers.listeningGist} correct={0} reveal={gistAnswered} onChange={(value) => choose('listeningGist', value, { skill: 'listening', correct: value === 0, activityId: 'listening:gist' })} /></article>
      <article className="sn-task-card sn-listen-card sn-listen-focus"><span className="sn-task-count">3</span><h2>{c.ttsPrompt}</h2><button type="button" className="sn-audio-button" disabled={!gistAnswered} onClick={playPractice}><Volume2 />{answers.ttsPlayed ? c.replay : c.playSentence}</button><OptionGroup disabled={!answers.ttsPlayed} options={listeningOptions.indexes.map((index) => lesson.words[index].word)} value={answers.listeningWord} correct={listeningOptions.correct} reveal={listeningAnswered} onChange={(value) => choose('listeningWord', value, { skill: 'listening', correct: value === listeningOptions.correct, activityId: 'listening:words' })} /></article>
    </div>
  </section>;
}

function VocabularyStage({ c, lang, lesson, questions, answers, choose, savedWords, onToggleWord }) {
  const contextWord = lesson.words[3] || lesson.words[0];
  const contextOptions = makeOptions(lesson.words, Math.min(3, lesson.words.length - 1), 1);
  const contextSentence = contextWord.example.replace(new RegExp(contextWord.word, 'i'), '_____');
  return <section className="sn-stage-body"><div className="sn-word-deck">{lesson.words.map((word, index) => { const register = word.register || word.type || 'standard'; const guidance = word.recommendation && c.recommendationLabels[word.recommendation]; return <article key={word.word} className={answers[`rating:${index}`] ? 'rated' : ''}><div className="sn-word-top"><span>{word.cefr}</span><div><button aria-label={c.pronounce} onClick={() => speak(word.word)}><Volume2 /></button><button className={savedWords.has(word.word) ? 'saved' : ''} onClick={() => onToggleWord(word)}>{savedWords.has(word.word) ? c.saved : c.save}</button></div></div><div className={`sn-register-badge ${register}`}>{c.registerLabels[register] || register}</div><h2>{word.word}</h2><p className="sn-ipa">{word.ipa}</p><details><summary>{c.helpfulTranslation}</summary><p>{word.meaning[lang]}</p><blockquote>{word.example}</blockquote></details>{guidance && <p className={`sn-usage-guidance ${word.recommendation}`}><ShieldCheck />{guidance}</p>}<div className="sn-rating"><button className={answers[`rating:${index}`] === 'learning' ? 'active' : ''} onClick={() => choose(`rating:${index}`, 'learning', { skill: 'vocabulary', activityId: `vocabulary:rate:${index}` })}>{c.learning}</button><button className={answers[`rating:${index}`] === 'know' ? 'active' : ''} onClick={() => choose(`rating:${index}`, 'know', { skill: 'vocabulary', activityId: `vocabulary:rate:${index}` })}>{c.know}</button></div></article>; })}</div><div className="sn-retrieval-grid">{questions.map((question, index) => <article className="sn-task-card" key={question.word.word}><span className="sn-task-count">{index + 1}</span><h2>{c.meaningQuestion} “{question.word.word}”?</h2><OptionGroup options={question.indexes.map((itemIndex) => lesson.words[itemIndex].meaning[lang])} value={answers[`vocab:${index}`]} correct={question.correct} reveal={answers[`vocab:${index}`] !== undefined} onChange={(value) => choose(`vocab:${index}`, value, { skill: 'vocabulary', correct: value === question.correct, activityId: `vocabulary:meaning:${index}` })} /></article>)}</div><article className="sn-task-card sn-context-task"><span className="sn-task-count">4</span><h2>{c.contextQuestion}</h2><blockquote>{contextSentence}</blockquote><OptionGroup options={contextOptions.indexes.map((index) => lesson.words[index].word)} value={answers.vocabContext} correct={contextOptions.correct} reveal={answers.vocabContext !== undefined} onChange={(value) => choose('vocabContext', value, { skill: 'vocabulary', correct: value === contextOptions.correct, activityId: 'vocabulary:context' })} /></article></section>;
}

function LanguageStage({ c, lang, questions, answers, choose }) {
  return <section className="sn-stage-body sn-language-list">{questions.map(({ item, options, correct }, index) => { const value = answers[`register:${index}`]; return <article key={`${item.song}-${index}`} className="sn-register-card"><div className="sn-register-source"><span>{index + 1}</span><div><small>{c.songSpokenLabel}</small><strong>{item.song}</strong></div><ArrowRight /></div><div className="sn-register-task"><h2>{c.chooseStandard}</h2><OptionGroup options={options} value={value} correct={correct} reveal={value !== undefined} onChange={(choice) => choose(`register:${index}`, choice, { skill: 'language', correct: choice === correct, activityId: `language:register:${index}` })} />{value !== undefined && <p className="sn-register-note"><Lightbulb />{item.note[lang]}</p>}</div></article>; })}<div className="sn-info-strip"><ShieldCheck /><p>{c.suitableFor}</p></div></section>;
}

function CheckpointStage({ c, questions, answers, choose, answered, submitted, score, submit, retry }) {
  const answeredCount = questions.filter((question) => answers[`quiz:${question.id}`] !== undefined && answers[`quiz:${question.id}`] !== null).length;
  const lockedQuestions = new Set(answers.checkpointLocked || []);
  return <section className="sn-stage-body"><div className="sn-quiz-progress"><span>{answeredCount} / {questions.length}</span><i><b style={{ width: `${answeredCount / questions.length * 100}%` }} /></i>{submitted && <strong className={score >= 70 ? 'pass' : 'fail'}>{score}%</strong>}</div><div className="sn-checkpoint-list">{questions.map((question, index) => { const value = answers[`quiz:${question.id}`]; const locked = lockedQuestions.has(question.id); return <article className="sn-task-card" key={question.id}><span className="sn-kicker">{c.question} {index + 1} / {questions.length}</span><h2>{question.prompt}</h2><OptionGroup options={question.options} value={value} correct={question.correct} reveal={submitted || locked} disabled={submitted || locked} onChange={(choice) => choose(`quiz:${question.id}`, choice)} /></article>; })}</div>{!submitted && <button type="button" className="sn-primary sn-checkpoint-submit" disabled={!answered} onClick={submit}>{c.submitCheck}<CheckCircle2 /></button>}{submitted && <div className={`sn-checkpoint-result ${score >= 70 ? 'pass' : 'retry'}`} aria-live="polite">{score >= 70 ? <CheckCircle2 /> : <RotateCcw />}<div><strong>{score >= 70 ? c.passed : `${c.score}: ${score}%`}</strong><p>{score >= 70 ? c.correct : c.retryWrong}</p></div>{score < 70 && <button type="button" onClick={retry}>{c.retryWrong}</button>}</div>}</section>;
}

function SpeakingStage({ c, lesson, answers, text, setText, words, targetMatches, listening, startRecognition, rubric, score }) {
  const prompt = c.goalPrompts[answers.goal] || c.speakingPrompt;
  return <section className="sn-stage-body sn-speaking-layout"><article className="sn-speaking-prompt"><span><MessageCircleMore /></span><small>{c.englishResponseLabel}</small><h2>{prompt}</h2><p>{c.useWords}</p><div>{lesson.words.slice(0, 4).map((word) => <b key={word.word}>{word.word}</b>)}</div></article><article className="sn-response-card"><div className="sn-response-tools"><label>{c.response}</label><button className={listening ? 'recording' : ''} onClick={startRecognition}>{listening ? <Square /> : <Mic2 />}{listening ? c.stopMic : c.startMic}</button></div>{answers.speechError && <p className="sn-mic-error"><CircleAlert />{c.micUnavailable}</p>}<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={c.responsePlaceholder} /><div className="sn-response-meta"><span className={words.length >= 20 ? 'good' : ''}>{words.length} / 20 {c.words}</span><span className={targetMatches.length ? 'good' : ''}>{targetMatches.length ? <Check /> : <CircleAlert />}{targetMatches.length ? c.targetUsed : c.targetMissing}</span></div><div className="sn-rubric"><div className="sn-rubric-head"><strong>{c.rubric}</strong><span>{score} / 10</span></div><RubricRow label={c.content} value={rubric.content} max={4} /><RubricRow label={c.targetVocabulary} value={rubric.vocabulary} max={2} /><RubricRow label={c.structure} value={rubric.structure} max={2} /><RubricRow label={c.submission} value={rubric.submission} max={2} /></div></article><p className="sn-privacy"><ShieldCheck />{c.privacy}</p></section>;
}

function RubricRow({ label, value, max }) { return <div><span>{label}</span><i><b style={{ width: `${value / max * 100}%` }} /></i><em>{value}/{max}</em></div>; }
