import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FlaskConical,
  Headphones,
  Languages,
  LockKeyhole,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import './research.css';

export const researchCopy = {
  en: {
    eyebrow: 'DARIN RESEARCH WORKSPACE',
    title: 'Learning impact, made visible.',
    subtitle: 'Evidence dashboard for the study of AI-assisted English learning through popular songs.',
    live: 'DEMO · SYNTHETIC DATA',
    export: 'Export CSV',
    exported: 'CSV downloaded',
    tabs: { overview: 'Overview', cohort: 'Cohort data', methodology: 'Methodology' },
    scope: { participants: 'Participants', duration: 'Study duration', lessons: 'Song lessons', completion: 'Completion rate' },
    units: { students: 'students', weeks: 'weeks', lessons: 'lessons' },
    outcome: 'Sample outcome',
    outcomeTitle: 'Illustrative song-group improvement',
    outcomeText: 'Synthetic average gain across vocabulary, listening and speaking',
    outcomeVs: 'vs +4.3 pts in the control group',
    confidence: 'Descriptive result',
    confidenceNote: 'Final significance testing follows after data collection.',
    pre: 'Pre-test',
    post: 'Post-test',
    points: 'pts',
    skillsTitle: 'Pre-test → post-test',
    skillsSub: 'Mean scores in the experimental group',
    skill: { vocabulary: 'Vocabulary', listening: 'Listening', speaking: 'Speaking' },
    skillNote: {
      vocabulary: 'Target words in context',
      listening: 'Meaning & detail recognition',
      speaking: 'Rubric-scored oral response',
    },
    compareTitle: 'Gain by study group',
    compareSub: 'Change in percentage points, not relative percent',
    experimental: 'SONORA group',
    control: 'Control group',
    insightLabel: 'Early signal',
    insightTitle: 'Vocabulary shows the strongest improvement.',
    insightText: 'Repeated exposure, contextual explanations and retrieval practice appear to be the main contributors. This is an interpretation, not yet a causal conclusion.',
    readMethod: 'See methodology',
    qualityTitle: 'Planned evidence protocol',
    qualityItems: ['Equal study time planned', 'Equivalent parallel tests planned', 'Teacher scoring planned', 'Anonymous participant codes planned'],
    cohortEyebrow: 'SYNTHETIC SAMPLE DATASET',
    cohortTitle: 'Participant results',
    cohortSub: 'Fictional codes and scores demonstrate the future dashboard; these are not study results.',
    filter: { all: 'All participants', experimental: 'SONORA', control: 'Control' },
    showing: 'Showing',
    records: 'records',
    table: {
      id: 'Participant', group: 'Group', sessions: 'Sessions', completion: 'Completion',
      vocabulary: 'Vocabulary', listening: 'Listening', speaking: 'Speaking', gain: 'Avg. gain',
    },
    methodEyebrow: 'RESEARCH PROTOCOL · V1.0',
    methodTitle: 'A controlled, measurable study',
    methodSub: 'The platform is the learning instrument; the research asks whether the method improves language skills.',
    questionLabel: 'Research question',
    question: 'To what extent does AI-assisted learning through popular English songs improve teenagers’ vocabulary, listening comprehension and speaking skills?',
    hypothesisLabel: 'Hypothesis',
    hypothesis: 'Teenagers completing song-based lessons will show larger gains than teenagers studying equivalent material through conventional exercises.',
    designTitle: 'Study design',
    design: [
      { title: 'Baseline', meta: 'Day 1', text: 'Equivalent vocabulary, listening and speaking pre-tests.' },
      { title: 'Intervention', meta: '4 weeks', text: 'Three 25-minute sessions weekly; equal study time in both groups.' },
      { title: 'Outcome', meta: 'Day 28', text: 'Parallel post-tests and teacher-rated speaking responses.' },
      { title: 'Analysis', meta: 'After collection', text: 'Mean gain, group difference, effect size and limitations.' },
    ],
    instrumentsTitle: 'Measurement instruments',
    instruments: [
      { title: 'Vocabulary test', text: '30 items: meaning, collocation and use in a new context.', tag: '0–100' },
      { title: 'Listening test', text: 'Two unseen clips with gist and detail questions.', tag: '0–100' },
      { title: 'Speaking rubric', text: 'Fluency, accuracy, vocabulary and intelligibility; two raters.', tag: '4 criteria' },
    ],
    safeguardsTitle: 'Ethics & safeguards',
    safeguards: [
      'Parent/guardian consent and voluntary student assent',
      'Participant codes instead of names in the research dataset',
      'No full copyrighted lyrics stored in participant records',
      'AI feedback is advisory; teacher scores are used for research',
    ],
    noteTitle: 'Interpret results responsibly',
    noteText: 'This dashboard reports a school-level sample. Findings should be described as evidence from this cohort, not proof for all teenagers. Missing sessions, prior music exposure and teacher effects must be reported as limitations.',
    updated: 'Last updated',
    updatedValue: 'Aug 31, 2026 · 18:40',
  },
  kk: {
    eyebrow: '«ДАРЫН» ЗЕРТТЕУ КАБИНЕТІ',
    title: 'Оқу нәтижесі — анық әрі өлшемді.',
    subtitle: 'Танымал әндер арқылы ЖИ көмегімен ағылшын үйрену зерттеуінің дәлелдер панелі.',
    live: 'ДЕМО · СИНТЕТИКАЛЫҚ ДЕРЕК',
    export: 'CSV жүктеу',
    exported: 'CSV жүктелді',
    tabs: { overview: 'Шолу', cohort: 'Қатысушылар', methodology: 'Әдістеме' },
    scope: { participants: 'Қатысушылар', duration: 'Зерттеу ұзақтығы', lessons: 'Ән сабақтары', completion: 'Аяқтау көрсеткіші' },
    units: { students: 'оқушы', weeks: 'апта', lessons: 'сабақ' },
    outcome: 'Үлгі нәтиже',
    outcomeTitle: 'Әнмен оқыту өсімінің көрнекі үлгісі',
    outcomeText: 'Сөздік қор, тыңдалым және сөйлеу бойынша синтетикалық орташа өсім',
    outcomeVs: 'бақылау тобында +4,3 ұпай',
    confidence: 'Сипаттамалық нәтиже',
    confidenceNote: 'Маңыздылықтың қорытынды талдауы деректер толық жиналған соң жасалады.',
    pre: 'Бастапқы тест',
    post: 'Қорытынды тест',
    points: 'ұпай',
    skillsTitle: 'Бастапқы тест → қорытынды тест',
    skillsSub: 'Эксперименттік топтың орташа көрсеткіші',
    skill: { vocabulary: 'Сөздік қор', listening: 'Тыңдалым', speaking: 'Сөйлеу' },
    skillNote: {
      vocabulary: 'Сөздерді контексте қолдану',
      listening: 'Негізгі ой мен детальді түсіну',
      speaking: 'Рубрикамен бағаланған жауап',
    },
    compareTitle: 'Топтар бойынша өсім',
    compareSub: 'Салыстырмалы пайыз емес, пайыздық ұпайдағы өзгеріс',
    experimental: 'SONORA тобы',
    control: 'Бақылау тобы',
    insightLabel: 'Алғашқы белгі',
    insightTitle: 'Ең жоғары өсім сөздік қорда байқалды.',
    insightText: 'Контекстегі қайталау, түсіндірмелер және еске түсіру жаттығулары негізгі фактор болуы мүмкін. Бұл — әзірге себеп-салдар қорытындысы емес, түсіндіру ғана.',
    readMethod: 'Әдістемені көру',
    qualityTitle: 'Жоспарланған зерттеу хаттамасы',
    qualityItems: ['Бірдей оқу уақыты жоспарланған', 'Балама параллель тесттер жоспарланған', 'Мұғалім бағалауы жоспарланған', 'Аноним қатысушы кодтары жоспарланған'],
    cohortEyebrow: 'СИНТЕТИКАЛЫҚ ҮЛГІ ДЕРЕКТЕР',
    cohortTitle: 'Қатысушылар нәтижесі',
    cohortSub: 'Ойдан шығарылған кодтар мен ұпайлар болашақ панельді көрсетеді; бұлар зерттеу нәтижесі емес.',
    filter: { all: 'Барлық қатысушы', experimental: 'SONORA', control: 'Бақылау' },
    showing: 'Көрсетілді:',
    records: 'жазба',
    table: {
      id: 'Қатысушы', group: 'Топ', sessions: 'Сессия', completion: 'Аяқталуы',
      vocabulary: 'Сөздік қор', listening: 'Тыңдалым', speaking: 'Сөйлеу', gain: 'Орташа өсім',
    },
    methodEyebrow: 'ЗЕРТТЕУ ХАТТАМАСЫ · V1.0',
    methodTitle: 'Бақыланатын әрі өлшенетін зерттеу',
    methodSub: 'Платформа — оқу құралы; зерттеу әдістің тілдік дағдыларға әсерін тексереді.',
    questionLabel: 'Зерттеу сұрағы',
    question: 'Танымал ағылшын әндерін ЖИ көмегімен қолдану жасөспірімдердің сөздік қорын, тыңдалымын және сөйлеу дағдысын қаншалықты жақсартады?',
    hypothesisLabel: 'Болжам',
    hypothesis: 'Әнге негізделген сабақтарды орындаған жасөспірімдер дәстүрлі жаттығулармен бірдей материалды оқығандарға қарағанда жоғары өсім көрсетеді.',
    designTitle: 'Зерттеу дизайны',
    design: [
      { title: 'Бастапқы өлшем', meta: '1-күн', text: 'Сөздік қор, тыңдалым және сөйлеу бойынша тең pre-test.' },
      { title: 'Интервенция', meta: '4 апта', text: 'Аптасына үш рет 25 минут; екі топтың оқу уақыты тең.' },
      { title: 'Қорытынды өлшем', meta: '28-күн', text: 'Параллель post-test және мұғалім бағалаған ауызша жауап.' },
      { title: 'Талдау', meta: 'Деректерден кейін', text: 'Орташа өсім, топ айырмасы, әсер көлемі және шектеулер.' },
    ],
    instrumentsTitle: 'Бағалау құралдары',
    instruments: [
      { title: 'Сөздік қоры тесті', text: '30 тапсырма: мағына, тіркес және жаңа контексте қолдану.', tag: '0–100' },
      { title: 'Тыңдалым тесті', text: 'Бұрын берілмеген екі үзінді: негізгі ой және деталь сұрақтары.', tag: '0–100' },
      { title: 'Сөйлеу рубрикасы', text: 'Еркіндік, дәлдік, сөздік қор, түсініктілік; екі бағалаушы.', tag: '4 критерий' },
    ],
    safeguardsTitle: 'Этика және қауіпсіздік',
    safeguards: [
      'Ата-ана/қамқоршы келісімі және оқушының ерікті келісімі',
      'Зерттеу деректерінде есімнің орнына қатысушы коды',
      'Толық авторлық ән мәтіні қатысушы жазбасында сақталмайды',
      'ЖИ пікірі кеңес ретінде; зерттеуде мұғалім бағасы қолданылады',
    ],
    noteTitle: 'Нәтижені жауапкершілікпен түсіндіріңіз',
    noteText: 'Бұл панель мектеп деңгейіндегі іріктемені көрсетеді. Қорытындыны барлық жасөспірімге ортақ дәлел емес, осы топтың нәтижесі деп сипаттау керек. Қатыспаған сабақтар, музыкалық тәжірибе және мұғалім әсері шектеу ретінде көрсетіледі.',
    updated: 'Соңғы жаңарту',
    updatedValue: '31 тамыз 2026 · 18:40',
  },
  ru: {
    eyebrow: 'ИССЛЕДОВАТЕЛЬСКИЙ КАБИНЕТ «ДАРЫН»',
    title: 'Эффект обучения — наглядно и измеримо.',
    subtitle: 'Панель доказательств исследования английского через популярные песни с поддержкой ИИ.',
    live: 'ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ',
    export: 'Скачать CSV',
    exported: 'CSV скачан',
    tabs: { overview: 'Обзор', cohort: 'Участники', methodology: 'Методология' },
    scope: { participants: 'Участники', duration: 'Длительность', lessons: 'Уроки по песням', completion: 'Завершение' },
    units: { students: 'учеников', weeks: 'недели', lessons: 'уроков' },
    outcome: 'Пример результата',
    outcomeTitle: 'Иллюстрация роста группы с песнями',
    outcomeText: 'Синтетический средний прирост по лексике, аудированию и говорению',
    outcomeVs: 'против +4,3 балла в контрольной группе',
    confidence: 'Описательный результат',
    confidenceNote: 'Итоговая проверка значимости выполняется после завершения сбора данных.',
    pre: 'Входной тест',
    post: 'Итоговый тест',
    points: 'балла',
    skillsTitle: 'Входной тест → итоговый тест',
    skillsSub: 'Средние результаты экспериментальной группы',
    skill: { vocabulary: 'Словарный запас', listening: 'Аудирование', speaking: 'Говорение' },
    skillNote: {
      vocabulary: 'Целевые слова в контексте',
      listening: 'Понимание смысла и деталей',
      speaking: 'Устный ответ по критериям',
    },
    compareTitle: 'Прирост по группам',
    compareSub: 'Изменение в процентных пунктах, не относительный процент',
    experimental: 'Группа SONORA',
    control: 'Контрольная группа',
    insightLabel: 'Предварительный сигнал',
    insightTitle: 'Наибольший рост показывает словарный запас.',
    insightText: 'Вероятные факторы — повторение, объяснения в контексте и упражнения на припоминание. Это интерпретация, а не окончательный причинно-следственный вывод.',
    readMethod: 'Смотреть методологию',
    qualityTitle: 'Запланированный протокол',
    qualityItems: ['Равное время обучения запланировано', 'Эквивалентные параллельные тесты запланированы', 'Оценка учителем запланирована', 'Анонимные коды участников запланированы'],
    cohortEyebrow: 'СИНТЕТИЧЕСКИЙ ДЕМО-ДАТАСЕТ',
    cohortTitle: 'Результаты участников',
    cohortSub: 'Вымышленные коды и баллы показывают будущий экран; это не результаты исследования.',
    filter: { all: 'Все участники', experimental: 'SONORA', control: 'Контроль' },
    showing: 'Показано',
    records: 'записей',
    table: {
      id: 'Участник', group: 'Группа', sessions: 'Сессии', completion: 'Завершение',
      vocabulary: 'Словарь', listening: 'Аудирование', speaking: 'Говорение', gain: 'Средний рост',
    },
    methodEyebrow: 'ПРОТОКОЛ ИССЛЕДОВАНИЯ · V1.0',
    methodTitle: 'Контролируемое измеримое исследование',
    methodSub: 'Платформа — инструмент обучения; исследование проверяет влияние метода на языковые навыки.',
    questionLabel: 'Исследовательский вопрос',
    question: 'В какой степени обучение через популярные английские песни с поддержкой ИИ улучшает словарный запас, аудирование и говорение подростков?',
    hypothesisLabel: 'Гипотеза',
    hypothesis: 'Подростки, проходящие уроки на основе песен, покажут больший прирост, чем подростки, изучающие эквивалентный материал с помощью обычных упражнений.',
    designTitle: 'Дизайн исследования',
    design: [
      { title: 'Исходный уровень', meta: 'День 1', text: 'Сопоставимые входные тесты словаря, аудирования и говорения.' },
      { title: 'Интервенция', meta: '4 недели', text: 'Три занятия по 25 минут в неделю; учебное время групп одинаково.' },
      { title: 'Итоговый замер', meta: 'День 28', text: 'Параллельные итоговые тесты и оценка устного ответа учителем.' },
      { title: 'Анализ', meta: 'После сбора', text: 'Средний прирост, разница групп, размер эффекта и ограничения.' },
    ],
    instrumentsTitle: 'Инструменты измерения',
    instruments: [
      { title: 'Тест словарного запаса', text: '30 заданий: значение, сочетаемость и использование в новом контексте.', tag: '0–100' },
      { title: 'Тест аудирования', text: 'Два незнакомых фрагмента с вопросами на общий смысл и детали.', tag: '0–100' },
      { title: 'Рубрика говорения', text: 'Беглость, точность, словарь и понятность; два оценщика.', tag: '4 критерия' },
    ],
    safeguardsTitle: 'Этика и безопасность',
    safeguards: [
      'Согласие родителя/опекуна и добровольное согласие ученика',
      'Коды участников вместо имён в исследовательских данных',
      'Полные защищённые тексты песен не хранятся в записях участников',
      'Обратная связь ИИ носит рекомендательный характер; для исследования используется оценка учителя',
    ],
    noteTitle: 'Интерпретируйте результаты ответственно',
    noteText: 'Панель показывает выборку одной школы. Выводы следует описывать как результат этой группы, а не доказательство для всех подростков. Пропущенные занятия, музыкальный опыт и влияние учителя необходимо указать как ограничения.',
    updated: 'Последнее обновление',
    updatedValue: '31 августа 2026 · 18:40',
  },
};

const cohort = [
  ['SL-01', 'experimental', 12, 100, 48, 69, 46, 64, 50, 66],
  ['SL-02', 'experimental', 11, 92, 55, 73, 51, 66, 54, 67],
  ['SL-03', 'experimental', 12, 100, 43, 65, 45, 61, 47, 60],
  ['SL-04', 'experimental', 10, 83, 62, 76, 58, 70, 60, 71],
  ['SL-05', 'experimental', 12, 100, 51, 72, 49, 66, 53, 68],
  ['SL-06', 'experimental', 11, 92, 58, 75, 56, 69, 57, 71],
  ['SL-07', 'experimental', 9, 75, 46, 60, 44, 56, 48, 57],
  ['SL-08', 'experimental', 12, 100, 53, 74, 50, 67, 55, 69],
  ['SL-09', 'experimental', 11, 92, 60, 76, 57, 71, 61, 73],
  ['SL-10', 'experimental', 10, 83, 49, 66, 47, 60, 51, 63],
  ['SL-11', 'experimental', 12, 100, 56, 77, 53, 70, 58, 72],
  ['SL-12', 'experimental', 11, 92, 45, 64, 43, 58, 46, 59],
  ['SL-13', 'experimental', 12, 100, 64, 80, 61, 74, 63, 76],
  ['SL-14', 'experimental', 10, 83, 52, 68, 48, 62, 52, 64],
  ['SL-15', 'experimental', 11, 92, 57, 75, 54, 68, 59, 72],
  ['CT-01', 'control', 12, 100, 50, 55, 47, 51, 51, 55],
  ['CT-02', 'control', 11, 92, 56, 61, 52, 56, 55, 60],
  ['CT-03', 'control', 12, 100, 44, 49, 45, 48, 48, 52],
  ['CT-04', 'control', 10, 83, 61, 65, 57, 62, 59, 63],
  ['CT-05', 'control', 12, 100, 52, 58, 50, 54, 53, 57],
  ['CT-06', 'control', 11, 92, 58, 62, 55, 60, 57, 62],
  ['CT-07', 'control', 9, 75, 47, 50, 43, 47, 49, 51],
  ['CT-08', 'control', 12, 100, 54, 59, 51, 55, 54, 59],
  ['CT-09', 'control', 11, 92, 59, 64, 56, 61, 60, 64],
  ['CT-10', 'control', 10, 83, 48, 53, 46, 50, 50, 54],
  ['CT-11', 'control', 12, 100, 57, 62, 52, 57, 58, 63],
  ['CT-12', 'control', 11, 92, 46, 51, 44, 48, 47, 51],
  ['CT-13', 'control', 12, 100, 63, 67, 60, 65, 62, 66],
  ['CT-14', 'control', 10, 83, 51, 56, 49, 53, 51, 56],
  ['CT-15', 'control', 11, 92, 56, 61, 53, 57, 58, 62],
].map(([id, group, sessions, completion, vocabularyPre, vocabularyPost, listeningPre, listeningPost, speakingPre, speakingPost]) => ({
  id, group, sessions, completion, vocabularyPre, vocabularyPost, listeningPre, listeningPost, speakingPre, speakingPost,
}));

const skillMeta = {
  vocabulary: { icon: Languages, tone: 'lime' },
  listening: { icon: Headphones, tone: 'blue' },
  speaking: { icon: MessageCircleMore, tone: 'violet' },
};

const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const oneDecimal = (value) => Math.round(value * 10) / 10;
const formatNumber = (value, lang) => oneDecimal(value).toLocaleString(lang === 'kk' ? 'kk-KZ' : lang === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function groupMetrics(rows) {
  return ['vocabulary', 'listening', 'speaking'].reduce((result, skill) => {
    const pre = mean(rows, `${skill}Pre`);
    const post = mean(rows, `${skill}Post`);
    result[skill] = { pre, post, gain: post - pre };
    return result;
  }, {});
}

function ResearchView({ lang = 'en', className = '' }) {
  const safeLang = researchCopy[lang] ? lang : 'en';
  const c = researchCopy[safeLang];
  const [activeTab, setActiveTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [exported, setExported] = useState(false);

  const experimentalRows = useMemo(() => cohort.filter((row) => row.group === 'experimental'), []);
  const controlRows = useMemo(() => cohort.filter((row) => row.group === 'control'), []);
  const experiment = useMemo(() => groupMetrics(experimentalRows), [experimentalRows]);
  const control = useMemo(() => groupMetrics(controlRows), [controlRows]);
  const overallGain = useMemo(() => mean(Object.values(experiment), 'gain'), [experiment]);
  const visibleRows = useMemo(() => filter === 'all' ? cohort : cohort.filter((row) => row.group === filter), [filter]);

  const goToMethodology = () => {
    setActiveTab('methodology');
    requestAnimationFrame(() => document.querySelector('.research-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const downloadCsv = () => {
    const headers = ['participant_id', 'group', 'sessions', 'completion_percent', 'vocabulary_pre', 'vocabulary_post', 'listening_pre', 'listening_post', 'speaking_pre', 'speaking_post', 'average_gain'];
    const csvRows = cohort.map((row) => {
      const gain = ((row.vocabularyPost - row.vocabularyPre) + (row.listeningPost - row.listeningPre) + (row.speakingPost - row.speakingPre)) / 3;
      return [row.id, row.group, row.sessions, row.completion, row.vocabularyPre, row.vocabularyPost, row.listeningPre, row.listeningPost, row.speakingPre, row.speakingPost, oneDecimal(gain)];
    });
    const csv = [headers, ...csvRows].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sonora-daryn-synthetic-sample.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    window.setTimeout(() => setExported(false), 2200);
  };

  return (
    <div className={`research-view ${className}`.trim()}>
      <header className="rh-header">
        <div>
          <div className="rh-eyebrow"><FlaskConical size={14} />{c.eyebrow}</div>
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
        </div>
        <div className="rh-header-actions">
          <div className="rh-study-state"><span />{c.live}</div>
          <button className={`rh-export ${exported ? 'is-done' : ''}`} type="button" onClick={downloadCsv}>
            {exported ? <Check size={17} /> : <Download size={17} />}
            {exported ? c.exported : c.export}
          </button>
        </div>
      </header>

      <nav className="rh-tabs" aria-label="Research sections">
        {Object.entries(c.tabs).map(([id, label]) => (
          <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)} type="button">
            {id === 'overview' && <BarChart3 size={16} />}
            {id === 'cohort' && <Users size={16} />}
            {id === 'methodology' && <FileCheck2 size={16} />}
            {label}
          </button>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <Overview
          c={c}
          lang={safeLang}
          experiment={experiment}
          control={control}
          overallGain={overallGain}
          goToMethodology={goToMethodology}
        />
      )}
      {activeTab === 'cohort' && <CohortView c={c} lang={safeLang} filter={filter} setFilter={setFilter} rows={visibleRows} />}
      {activeTab === 'methodology' && <MethodologyView c={c} />}

      <footer className="rh-footer">
        <span><Database size={13} />SONORA · {c.cohortEyebrow}</span>
        <span>{c.updated}: {c.updatedValue}</span>
      </footer>
    </div>
  );
}

function Overview({ c, lang, experiment, control, overallGain, goToMethodology }) {
  const scope = [
    { icon: Users, value: '30', label: c.scope.participants, unit: c.units.students, tone: 'lime' },
    { icon: CalendarDays, value: '4', label: c.scope.duration, unit: c.units.weeks, tone: 'violet' },
    { icon: BookOpenCheck, value: '12', label: c.scope.lessons, unit: c.units.lessons, tone: 'blue' },
    { icon: Activity, value: '91%', label: c.scope.completion, unit: 'demo', tone: 'coral' },
  ];

  return (
    <div className="rh-content rh-enter">
      <section className="rh-scope-grid">
        {scope.map(({ icon: Icon, value, label, unit, tone }) => (
          <article className="rh-scope-card" key={label}>
            <div className={`rh-scope-icon ${tone}`}><Icon size={18} /></div>
            <div><span>{label}</span><strong>{value}</strong><small>{unit}</small></div>
          </article>
        ))}
      </section>

      <section className="rh-outcome-grid">
        <article className="rh-primary-outcome">
          <div className="rh-outcome-copy">
            <div className="rh-mini-label"><Sparkles size={13} />{c.outcome}</div>
            <h2>{c.outcomeTitle}</h2>
            <p>{c.outcomeText}</p>
            <div className="rh-delta-line"><strong>+{formatNumber(overallGain, lang)}</strong><span>{c.points}</span><em>{c.outcomeVs}</em></div>
          </div>
          <div className="rh-gain-orbit" style={{ '--gain': `${Math.min(overallGain / 20 * 360, 360)}deg` }}>
            <div><TrendingUp size={21} /><strong>+{formatNumber(overallGain, lang)}</strong><span>{c.points}</span></div>
          </div>
          <div className="rh-confidence"><CircleHelp size={14} /><div><strong>{c.confidence}</strong><span>{c.confidenceNote}</span></div></div>
        </article>

        <article className="rh-quality-card">
          <div className="rh-quality-head"><div><span>{c.qualityTitle}</span><strong>PLAN</strong></div><ShieldCheck size={23} /></div>
          <div className="rh-quality-list">
            {c.qualityItems.map((item) => <div key={item}><span><Check size={11} /></span>{item}</div>)}
          </div>
        </article>
      </section>

      <section className="rh-section-head">
        <div><span>{c.skillsSub}</span><h2>{c.skillsTitle}</h2></div>
        <div className="rh-prepost-legend"><span><i />{c.pre}</span><span><i />{c.post}</span></div>
      </section>

      <section className="rh-skills-grid">
        {Object.entries(skillMeta).map(([skill, { icon: Icon, tone }]) => {
          const metric = experiment[skill];
          return (
            <article className={`rh-skill-card ${tone}`} key={skill}>
              <div className="rh-skill-top"><div className="rh-skill-icon"><Icon size={19} /></div><span>+{formatNumber(metric.gain, lang)}</span></div>
              <h3>{c.skill[skill]}</h3>
              <p>{c.skillNote[skill]}</p>
              <div className="rh-score-pair">
                <div><span>{c.pre}</span><strong>{formatNumber(metric.pre, lang)}</strong></div>
                <ArrowUpRight size={20} />
                <div><span>{c.post}</span><strong>{formatNumber(metric.post, lang)}</strong></div>
              </div>
              <div className="rh-score-track"><span className="pre" style={{ width: `${metric.pre}%` }} /><span className="post" style={{ width: `${metric.post}%` }} /></div>
            </article>
          );
        })}
      </section>

      <section className="rh-analysis-grid">
        <article className="rh-comparison-card">
          <div className="rh-card-head">
            <div><span>{c.compareSub}</span><h2>{c.compareTitle}</h2></div>
            <div className="rh-group-legend"><span><i />{c.experimental}</span><span><i />{c.control}</span></div>
          </div>
          <div className="rh-bars-chart">
            {[0, 5, 10, 15, 20].map((tick) => <span className="rh-gridline" key={tick} style={{ left: `${tick * 5}%` }}><small>{tick}</small></span>)}
            {Object.keys(skillMeta).map((skill) => (
              <div className="rh-chart-row" key={skill}>
                <strong>{c.skill[skill]}</strong>
                <div><span className="experimental" style={{ width: `${experiment[skill].gain * 5}%` }}><b>+{formatNumber(experiment[skill].gain, lang)}</b></span></div>
                <div><span className="control" style={{ width: `${control[skill].gain * 5}%` }}><b>+{formatNumber(control[skill].gain, lang)}</b></span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="rh-insight-card">
          <div className="rh-insight-icon"><Target size={23} /></div>
          <span>{c.insightLabel}</span>
          <h2>{c.insightTitle}</h2>
          <p>{c.insightText}</p>
          <button onClick={goToMethodology} type="button">{c.readMethod}<ArrowUpRight size={15} /></button>
        </article>
      </section>
    </div>
  );
}

function CohortView({ c, lang, filter, setFilter, rows }) {
  return (
    <div className="rh-content rh-enter">
      <section className="rh-view-intro">
        <div><div className="rh-eyebrow"><LockKeyhole size={13} />{c.cohortEyebrow}</div><h2>{c.cohortTitle}</h2><p>{c.cohortSub}</p></div>
        <div className="rh-filter-wrap">
          <div className="rh-filter-label"><ChevronDown size={13} />{c.showing} {rows.length} {c.records}</div>
          <div className="rh-filter-tabs">
            {Object.entries(c.filter).map(([id, label]) => <button className={filter === id ? 'active' : ''} key={id} onClick={() => setFilter(id)} type="button">{label}</button>)}
          </div>
        </div>
      </section>

      <section className="rh-table-card">
        <div className="rh-table-scroll">
          <table>
            <thead><tr>
              <th>{c.table.id}</th><th>{c.table.group}</th><th>{c.table.sessions}</th><th>{c.table.completion}</th>
              <th>{c.table.vocabulary}<small>{c.pre} → {c.post}</small></th>
              <th>{c.table.listening}<small>{c.pre} → {c.post}</small></th>
              <th>{c.table.speaking}<small>{c.pre} → {c.post}</small></th><th>{c.table.gain}</th>
            </tr></thead>
            <tbody>
              {rows.map((row) => {
                const gain = ((row.vocabularyPost - row.vocabularyPre) + (row.listeningPost - row.listeningPre) + (row.speakingPost - row.speakingPre)) / 3;
                return <tr key={row.id}>
                  <td><strong className="rh-participant"><span>{row.id.slice(0, 2)}</span>{row.id}</strong></td>
                  <td><span className={`rh-group-badge ${row.group}`}>{row.group === 'experimental' ? c.experimental : c.control}</span></td>
                  <td><span className="rh-session"><Clock3 size={12} />{row.sessions}/12</span></td>
                  <td><div className="rh-completion"><span><i style={{ width: `${row.completion}%` }} /></span><b>{row.completion}%</b></div></td>
                  <td><ScoreTransition pre={row.vocabularyPre} post={row.vocabularyPost} /></td>
                  <td><ScoreTransition pre={row.listeningPre} post={row.listeningPost} /></td>
                  <td><ScoreTransition pre={row.speakingPre} post={row.speakingPost} /></td>
                  <td><strong className="rh-gain-pill">+{formatNumber(gain, lang)}</strong></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        <div className="rh-table-foot"><ShieldCheck size={14} />{c.cohortSub}</div>
      </section>
    </div>
  );
}

function ScoreTransition({ pre, post }) {
  return <span className="rh-score-transition"><b>{pre}</b><ArrowUpRight size={12} /><strong>{post}</strong></span>;
}

function MethodologyView({ c }) {
  const instrumentIcons = [Languages, Headphones, MessageCircleMore];
  return (
    <div className="rh-content rh-enter">
      <section className="rh-view-intro rh-method-intro">
        <div><div className="rh-eyebrow"><FileCheck2 size={13} />{c.methodEyebrow}</div><h2>{c.methodTitle}</h2><p>{c.methodSub}</p></div>
        <div className="rh-protocol-stamp"><ShieldCheck size={21} /><div><span>Protocol</span><strong>DARYN-ENG-2026-01</strong></div></div>
      </section>

      <section className="rh-question-grid">
        <article className="rh-question-card primary"><span>01 · {c.questionLabel}</span><h3>{c.question}</h3></article>
        <article className="rh-question-card"><span>02 · {c.hypothesisLabel}</span><h3>{c.hypothesis}</h3></article>
      </section>

      <section className="rh-method-section">
        <div className="rh-method-heading"><span>03</span><h2>{c.designTitle}</h2></div>
        <div className="rh-timeline">
          {c.design.map((item, index) => (
            <article key={item.title}><div className="rh-timeline-number">{String(index + 1).padStart(2, '0')}</div><span>{item.meta}</span><h3>{item.title}</h3><p>{item.text}</p></article>
          ))}
        </div>
      </section>

      <section className="rh-method-section">
        <div className="rh-method-heading"><span>04</span><h2>{c.instrumentsTitle}</h2></div>
        <div className="rh-instruments">
          {c.instruments.map((item, index) => {
            const Icon = instrumentIcons[index];
            return <article key={item.title}><div><Icon size={20} /></div><span>{item.tag}</span><h3>{item.title}</h3><p>{item.text}</p></article>;
          })}
        </div>
      </section>

      <section className="rh-safeguards-grid">
        <article className="rh-safeguards">
          <div className="rh-method-heading"><span>05</span><h2>{c.safeguardsTitle}</h2></div>
          <div>{c.safeguards.map((item) => <p key={item}><span><Check size={12} /></span>{item}</p>)}</div>
        </article>
        <article className="rh-responsible-note"><CircleHelp size={24} /><div><span>{c.noteTitle}</span><p>{c.noteText}</p></div></article>
      </section>
    </div>
  );
}

export default ResearchView;
