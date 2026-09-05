import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, Bookmark, BookmarkCheck, Brain,
  Check, CheckCircle2, ChevronDown, Clock3, Compass, Headphones, Home,
  Languages, LibraryBig, Menu, Music2, Play, RotateCcw, Search, ShieldCheck,
  Sparkles, Target, Trash2, Volume2, X,
} from 'lucide-react';
import { lessons, songs as curatedSongs } from './data';
import { appCopy, interfaceLanguages } from './appCopy';
import LessonWorkspace from './LessonWorkspace';
import ResearchView from './ResearchView';
import { SongPlayerModal } from './SongPlayer';
import { safeApi, sonoraApi } from './sonoraApi';
import { requiredActivityIdsForSong } from './features/lesson/lessonPlan';
import { apiLessonToFrontend } from './features/lesson/generatedLesson';
import { hasEmbeddedMedia } from './features/media/songMedia';
import './redesign.css';

const PROFILE_KEY = 'sonora-profile-id';
const WORDS_KEY = 'sonora-saved-word-items-v2';
const SONGS_KEY = 'sonora-saved-songs-v2';
const RECORDS_KEY = 'sonora-lesson-records-v3';
const GENERATED_KEY = 'sonora-generated-lessons-v2';
const REMOTE_SESSIONS_KEY = 'sonora-remote-session-map-v1';

const allCuratedWords = Object.entries(lessons).flatMap(([songId, lesson]) => lesson.words.map((word) => ({ ...word, song_id: songId })));

const readJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

const getProfileId = () => {
  const existing = localStorage.getItem(PROFILE_KEY);
  if (existing) return existing;
  const id = `student-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  localStorage.setItem(PROFILE_KEY, id);
  return id;
};

const PROFILE_ID = getProfileId();

const migrateSavedWords = () => {
  const stored = readJson(WORDS_KEY, null);
  if (Array.isArray(stored)) return stored;
  const legacy = readJson('sonora-saved-words', []);
  const demoSeed = legacy.length === 2 && legacy.includes('fragile') && legacy.includes('escape');
  if (demoSeed && !localStorage.getItem('sonora-demo-seed-cleaned-v1')) {
    localStorage.setItem('sonora-demo-seed-cleaned-v1', 'true');
    return [];
  }
  return legacy.map((word) => allCuratedWords.find((item) => item.word === word) || { word, meaning: {} });
};

const migrateRecords = () => {
  const stored = readJson(RECORDS_KEY, {});
  return Object.fromEntries(Object.entries(stored).filter(([, record]) => {
    const legacyZeroTimeCompletion = record?.status === 'completed'
      && !record?.version
      && !(record?.result?.activeSeconds || record?.activeSeconds)
      && !(record?.attempts?.length);
    return !legacyZeroTimeCompletion;
  }));
};

const speakWord = (word) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.82;
  window.speechSynthesis.speak(utterance);
};

const routeFromHash = () => {
  const value = window.location.hash.replace(/^#\/?/, '') || 'home';
  const [view, id] = value.split('/');
  return { view: ['home', 'discover', 'library', 'progress', 'research', 'lesson'].includes(view) ? view : 'home', id };
};

const objectiveFirstAttempts = (record) => {
  const first = new Map();
  (record?.attempts || []).filter((attempt) => typeof attempt.correct === 'boolean').forEach((attempt) => {
    if (!first.has(attempt.activityId)) first.set(attempt.activityId, attempt);
  });
  return [...first.values()];
};

const recordContract = (record, song) => {
  if (record?.requiredActivityIds?.length) return record.requiredActivityIds;
  return requiredActivityIdsForSong(song.id);
};

const recordProgress = (record, song) => {
  const contract = recordContract(record, song);
  if (record?.status === 'completed' && !(record?.attempts?.length)) return 100;
  const required = new Set(contract);
  const completed = new Set((record?.attempts || []).map((attempt) => attempt.activityId).filter((id) => required.has(id))).size;
  return Math.round(completed / contract.length * 100);
};

const recordCompletedCount = (record, song) => {
  const contract = recordContract(record, song);
  if (record?.status === 'completed' && !(record?.attempts?.length)) return contract.length;
  const required = new Set(contract);
  return new Set((record?.attempts || []).map((attempt) => attempt.activityId).filter((id) => required.has(id))).size;
};

const backendSkill = (skill) => ({ setup: 'orientation', language: 'grammar' }[skill] || skill || 'practice');

function ProductApp() {
  const [lang, setLang] = useState(() => localStorage.getItem('sonora-language') || 'ru');
  const [route, setRoute] = useState(routeFromHash);
  const [navOpen, setNavOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [savedWordItems, setSavedWordItems] = useState(migrateSavedWords);
  const [savedSongs, setSavedSongs] = useState(() => new Set(readJson(SONGS_KEY, [])));
  const [records, setRecords] = useState(migrateRecords);
  const [generated, setGenerated] = useState(() => readJson(GENERATED_KEY, []));
  const [remoteSessions, setRemoteSessions] = useState(() => readJson(REMOTE_SESSIONS_KEY, {}));
  const [aiStatus, setAiStatus] = useState(null);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [playerSong, setPlayerSong] = useState(null);
  const c = appCopy[lang] || appCopy.en;

  const allLessons = useMemo(() => ({ ...lessons, ...Object.fromEntries(generated.map((item) => [item.song.id, item.lesson])) }), [generated]);
  const allSongs = useMemo(() => [...curatedSongs, ...generated.map((item) => item.song)].map((song) => ({
    ...song,
    activityCount: requiredActivityIdsForSong(song.id, allLessons[song.id]).length,
  })), [generated, allLessons]);
  const savedWordSet = useMemo(() => new Set(savedWordItems.map((item) => item.word)), [savedWordItems]);

  useEffect(() => {
    const handleHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', handleHash);
    if (!window.location.hash) window.history.replaceState(null, '', '#/home');
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => { localStorage.setItem('sonora-language', lang); }, [lang]);
  useEffect(() => { localStorage.setItem(WORDS_KEY, JSON.stringify(savedWordItems)); }, [savedWordItems]);
  useEffect(() => { localStorage.setItem(SONGS_KEY, JSON.stringify([...savedSongs])); }, [savedSongs]);
  useEffect(() => { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); }, [records]);
  useEffect(() => { localStorage.setItem(GENERATED_KEY, JSON.stringify(generated)); }, [generated]);
  useEffect(() => { localStorage.setItem(REMOTE_SESSIONS_KEY, JSON.stringify(remoteSessions)); }, [remoteSessions]);

  useEffect(() => {
    if (!analyzerOpen && !reviewOpen && !playerSong) return undefined;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialog = document.querySelector('.sn-modal-scrim [role="dialog"]');
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [])];
    const focusTimer = window.setTimeout(() => focusable()[0]?.focus(), 0);
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setAnalyzerOpen(false);
        setReviewOpen(false);
        setPlayerSong(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [analyzerOpen, reviewOpen, playerSong]);

  useEffect(() => {
    const sync = async () => {
      const profile = await safeApi(() => sonoraApi.getProfile(PROFILE_ID));
      if (!profile) await safeApi(() => sonoraApi.createProfile({ profile_id: PROFILE_ID, display_name: 'Local learner', interface_language: lang, current_level: 'B1', weekly_goal: 5 }));
      const [wordPayload, progressPayload, capabilityPayload] = await Promise.all([
        safeApi(() => sonoraApi.words(PROFILE_ID), { items: [] }),
        safeApi(() => sonoraApi.progress(PROFILE_ID), { items: [] }),
        safeApi(() => sonoraApi.capabilities(), { ai: { ready: false } }),
      ]);
      setAiStatus(capabilityPayload?.ai || { ready: false });
      if (wordPayload?.items?.length) {
        setSavedWordItems((current) => {
          const map = new Map(current.map((item) => [item.word.toLowerCase(), item]));
          wordPayload.items.forEach((item) => map.set(item.word.toLowerCase(), { ...map.get(item.word.toLowerCase()), ...item }));
          return [...map.values()];
        });
      }
      if (progressPayload?.items?.length) {
        setRecords((current) => {
          const next = { ...current };
          progressPayload.items.forEach((item) => {
            if (!next[item.song_id] && item.status === 'completed' && item.time_spent_seconds > 0) next[item.song_id] = { songId: item.song_id, status: 'completed', result: { accuracy: item.quiz_score || 0, activeSeconds: item.time_spent_seconds, wordsPractised: 0, mastery: (item.quiz_score || 0) >= 80 ? 'mastered' : 'review', completedAt: item.completed_at }, completedStages: [0, 1, 2, 3, 4, 5, 6], attempts: [] };
          });
          return next;
        });
      }
    };
    sync();
  }, []);

  const navigate = (view, id) => {
    setNavOpen(false);
    setPlayerSong(null);
    const target = `#/${view}${id ? `/${id}` : ''}`;
    if (window.location.hash === target) setRoute({ view, id }); else window.location.hash = target;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveRecord = (songId, record) => setRecords((current) => {
    const previous = current[songId];
    const terminalSync = new Set(['synced', 'failed', 'local_only']);
    const preserveTerminalSync = previous?.status === 'completed'
      && record?.status === 'completed'
      && terminalSync.has(previous.syncStatus)
      && record.syncStatus === 'pending';
    return {
      ...current,
      [songId]: preserveTerminalSync ? { ...record, syncStatus: previous.syncStatus } : record,
    };
  });

  const openLesson = async (song, restart = false) => {
    if (restart) {
      localStorage.removeItem(`sonora-lesson-v3:${song.id}`);
      setRecords((current) => { const next = { ...current }; delete next[song.id]; return next; });
    }
    const remote = await safeApi(() => sonoraApi.startSession(PROFILE_ID, {
      songId: song.id,
      lessonVersion: song.generated ? 'web-ai-v1' : 'interactive-v3',
      requiredActivityIds: requiredActivityIdsForSong(song.id, allLessons[song.id]),
      forceNew: restart,
    }));
    if (remote?.id) setRemoteSessions((current) => ({ ...current, [song.id]: remote.id }));
    navigate('lesson', song.id);
  };

  const toggleSong = (songId) => setSavedSongs((current) => {
    const next = new Set(current);
    next.has(songId) ? next.delete(songId) : next.add(songId);
    return next;
  });

  const toggleWord = (word, songId = null) => {
    const exists = savedWordSet.has(word.word);
    if (exists) {
      setSavedWordItems((current) => current.filter((item) => item.word !== word.word));
      safeApi(() => sonoraApi.deleteWord(PROFILE_ID, word.word));
      return;
    }
    const optimistic = { ...word, song_id: songId, mastery_level: 0, review_count: 0, next_review_at: new Date().toISOString() };
    setSavedWordItems((current) => [...current, optimistic]);
    safeApi(() => sonoraApi.saveWord(PROFILE_ID, {
      word: word.word,
      ipa: word.ipa,
      cefr: word.cefr,
      word_type: word.type,
      example: word.example,
      song_id: songId,
      meaning: word.meaning || {},
      mastery_level: 0,
    })).then((saved) => {
      if (!saved) return;
      setSavedWordItems((current) => current.map((item) => item.word === word.word ? { ...item, ...saved } : item));
    });
  };

  const activeSong = route.view === 'lesson' ? allSongs.find((song) => song.id === route.id) : null;
  const activeLesson = activeSong ? allLessons[activeSong.id] : null;

  if (route.view === 'lesson') {
    if (!activeSong || !activeLesson) return <NotFound onBack={() => navigate('discover')} />;
    return <LessonWorkspace song={activeSong} lesson={activeLesson} lang={lang} savedWords={savedWordSet} onToggleWord={(word) => toggleWord(word, activeSong.id)} onExit={() => navigate('home')} initialRecord={records[activeSong.id]} onSnapshot={(record) => saveRecord(activeSong.id, record)} onAttempt={(attempt) => {
      // The local session is authoritative offline. The backend receives only outcome metadata.
      const sessionId = remoteSessions[activeSong.id];
      if (sessionId) safeApi(() => sonoraApi.attempt(sessionId, {
        activityId: attempt.activityId,
        activityKind: attempt.skill,
        skill: backendSkill(attempt.skill),
        score: typeof attempt.correct === 'boolean' ? (attempt.correct ? 1 : 0) : 0,
        ...(typeof attempt.correct === 'boolean' ? { correct: attempt.correct } : {}),
        durationSeconds: attempt.durationSeconds || 1,
      }));
    }} onComplete={(result, completedRecord) => {
      const sessionId = remoteSessions[activeSong.id];
      const pendingRecord = { ...completedRecord, syncStatus: sessionId ? 'pending' : 'local_only' };
      saveRecord(activeSong.id, pendingRecord);
      if (!sessionId) return;
      const finalizeRemote = async () => {
        try {
          const remote = await sonoraApi.getSession(sessionId);
          for (const activityId of remote?.missing_activity_ids || []) {
            const attempt = completedRecord.attempts.find((item) => item.activityId === activityId);
            if (!attempt) throw new Error(`Missing local activity outcome: ${activityId}`);
            await sonoraApi.attempt(sessionId, {
              activityId,
              activityKind: attempt.skill,
              skill: backendSkill(attempt.skill),
              score: typeof attempt.correct === 'boolean' ? (attempt.correct ? 1 : 0) : 0,
              ...(typeof attempt.correct === 'boolean' ? { correct: attempt.correct } : {}),
              durationSeconds: attempt.durationSeconds || 1,
            });
          }
          await sonoraApi.completeSession(sessionId);
          saveRecord(activeSong.id, { ...completedRecord, syncStatus: 'synced' });
        } catch {
          saveRecord(activeSong.id, { ...completedRecord, syncStatus: 'failed' });
        }
      };
      finalizeRemote();
    }} />;
  }

  if (route.view === 'research') {
    return <div className="sn-research-route"><button className="sn-research-back" onClick={() => navigate('home')}><ArrowLeft />{c.backToStudent}</button><ResearchView lang={lang} /></div>;
  }

  return (
    <div className="sn-app">
      <Sidebar route={route.view} c={c} savedCount={savedWordItems.length + savedSongs.size} aiStatus={aiStatus} open={navOpen} close={() => setNavOpen(false)} navigate={navigate} openAnalyzer={() => setAnalyzerOpen(true)} />
      <div className="sn-main">
        <Topbar c={c} lang={lang} setLang={setLang} languageOpen={languageOpen} setLanguageOpen={setLanguageOpen} search={search} setSearch={setSearch} openMenu={() => setNavOpen(true)} navigate={navigate} />
        {route.view === 'home' && <HomePage c={c} songs={allSongs} records={records} savedWords={savedWordItems} openLesson={openLesson} openPlayer={setPlayerSong} navigate={navigate} openReview={() => setReviewOpen(true)} />}
        {route.view === 'discover' && <DiscoverPage c={c} songs={allSongs} records={records} savedSongs={savedSongs} toggleSong={toggleSong} openLesson={openLesson} openPlayer={setPlayerSong} search={search} setSearch={setSearch} openAnalyzer={() => setAnalyzerOpen(true)} />}
        {route.view === 'library' && <LibraryPage c={c} lang={lang} songs={allSongs} savedSongs={savedSongs} words={savedWordItems} openLesson={openLesson} openPlayer={setPlayerSong} removeWord={(word) => toggleWord(word)} removeSong={toggleSong} openReview={() => setReviewOpen(true)} />}
        {route.view === 'progress' && <ProgressPage c={c} songs={allSongs} records={records} savedWords={savedWordItems} openLesson={openLesson} />}
      </div>
      <MobileNav route={route.view} c={c} navigate={navigate} />
      {analyzerOpen && <AnalyzerModal c={c} lang={lang} aiStatus={aiStatus} songs={allSongs} close={() => setAnalyzerOpen(false)} openLesson={(song) => { setAnalyzerOpen(false); openLesson(song); }} saveGenerated={(payload) => {
        setGenerated((current) => [...current.filter((item) => item.song.id !== payload.song.id), payload]);
        setAnalyzerOpen(false);
        window.setTimeout(() => openLesson(payload.song), 0);
      }} />}
      {reviewOpen && <ReviewModal c={c} lang={lang} words={savedWordItems} updateWords={setSavedWordItems} close={() => setReviewOpen(false)} />}
      {playerSong && <SongPlayerModal song={playerSong} lang={lang} onClose={() => setPlayerSong(null)} onStartLesson={() => { const selected = playerSong; setPlayerSong(null); openLesson(selected, records[selected.id]?.status === 'completed'); }} />}
    </div>
  );
}

function Brand() { return <div className="sn-brand"><span><i /><i /><i /></span><strong>SONORA</strong></div>; }

function Sidebar({ route, c, savedCount, aiStatus, open, close, navigate, openAnalyzer }) {
  const items = [[Home, 'home', c.nav.home], [Compass, 'discover', c.nav.discover], [LibraryBig, 'library', c.nav.library], [BarChart3, 'progress', c.nav.progress]];
  return <><aside className={`sn-sidebar ${open ? 'open' : ''}`}><div className="sn-sidebar-head"><Brand /><button onClick={close} aria-label="Close"><X /></button></div><nav>{items.map(([Icon, id, label]) => <button key={id} aria-current={route === id ? 'page' : undefined} className={route === id ? 'active' : ''} onClick={() => navigate(id)}><Icon /><span>{label}</span>{id === 'library' && savedCount > 0 && <b>{savedCount}</b>}</button>)}</nav><div className="sn-sidebar-spacer" /><button className="sn-ai-card" onClick={openAnalyzer}><span><Sparkles /></span><div><strong>MiniMax M3 + fallback</strong><p>{aiStatus?.ready ? c.qwenReady : c.qwenOffline}</p></div><ArrowRight /></button><button className="sn-research-link" onClick={() => navigate('research')}><Target />{c.nav.research}</button><div className="sn-profile"><span>LL</span><div><strong>{c.localLearner}</strong><small>{c.level}</small></div></div></aside>{open && <button className="sn-nav-scrim" onClick={close} aria-label="Close navigation" />}</>;
}

function Topbar({ c, lang, setLang, languageOpen, setLanguageOpen, search, setSearch, openMenu, navigate }) {
  return <header className="sn-topbar"><button className="sn-menu" onClick={openMenu} aria-label={c.menu}><Menu /></button><div className="sn-mobile-brand"><Brand /></div><label className="sn-global-search"><Search /><input value={search} onFocus={() => navigate('discover')} onChange={(event) => setSearch(event.target.value)} placeholder={c.search} /></label><div className="sn-language"><button onClick={() => setLanguageOpen(!languageOpen)}><Languages /><span>{interfaceLanguages.find((item) => item.code === lang)?.short}</span><ChevronDown /></button>{languageOpen && <div role="menu"><small>{c.language}</small>{interfaceLanguages.map((item) => <button key={item.code} className={lang === item.code ? 'active' : ''} onClick={() => { setLang(item.code); setLanguageOpen(false); }}><span>{item.label}</span>{lang === item.code && <Check />}</button>)}</div>}</div></header>;
}

function HomePage({ c, songs, records, savedWords, openLesson, openPlayer, navigate, openReview }) {
  const recordEntries = Object.values(records);
  const activeRecord = recordEntries.find((record) => record.status === 'in_progress');
  const activeSong = songs.find((song) => song.id === activeRecord?.songId) || songs.find((song) => records[song.id]?.status !== 'completed') || songs[0];
  const activeProgress = activeRecord ? recordProgress(activeRecord, activeSong) : 0;
  const activityTotal = activeRecord?.requiredActivityIds?.length || activeSong.activityCount || 25;
  const completed = recordEntries.filter((record) => record.status === 'completed');
  const first = recordEntries.flatMap(objectiveFirstAttempts);
  const accuracy = first.length ? Math.round(first.filter((item) => item.correct).length / first.length * 100) : null;
  const seconds = recordEntries.reduce((sum, record) => sum + (record.result?.activeSeconds || record.activeSeconds || 0), 0);
  const due = savedWords.filter((word) => !word.next_review_at || new Date(word.next_review_at) <= new Date());
  const cta = activeRecord ? c.continueLesson : records[activeSong.id]?.status === 'completed' ? c.restartLesson : c.startFirst;
  return <main className="sn-page sn-home"><section className="sn-home-intro"><span className="sn-kicker">{c.homeEyebrow}</span><h1>{c.homeTitle}</h1><p>{c.homeSub}</p></section><section className="sn-today-card"><button className="sn-today-cover" onClick={() => hasEmbeddedMedia(activeSong) ? openPlayer(activeSong) : openLesson(activeSong)} aria-label={`${c.listenHere}: ${activeSong.title}`}><div className={`sn-cover sn-cover-large ${activeSong.cover}`}><Music2 /><span>{activeSong.title}</span><b><Play /></b></div></button><div className="sn-today-main"><span className="sn-kicker">{activeRecord ? c.nextStep : c.recommended}</span><div className="sn-today-title"><div><h2>{activeSong.title}</h2><p>{activeSong.artist}</p></div><span>{activeSong.level}</span></div><div className="sn-focus-row">{activeSong.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="sn-progress-line"><div><span>{recordCompletedCount(activeRecord, activeSong)} {c.of} {activityTotal} {c.activitiesDone}</span><strong>{activeProgress}%</strong></div><i><b style={{ width: `${activeProgress}%` }} /></i></div><div className="sn-today-actions"><button className="sn-primary" onClick={() => openLesson(activeSong, records[activeSong.id]?.status === 'completed')}>{cta}<ArrowRight /></button>{hasEmbeddedMedia(activeSong) && <button className="sn-secondary" onClick={() => openPlayer(activeSong)}><Headphones />{c.listenHere}</button>}</div></div><aside className="sn-today-plan"><strong>7</strong><span>{c.focusedStages}</span><ul><li><Headphones />{c.planListening}</li><li><BookOpen />{c.planWords}</li><li><Brain />{c.planCheckpoint}</li></ul></aside></section><section className="sn-real-stats"><div className="sn-section-heading"><div><span className="sn-kicker">{c.honestStats}</span><h2>{c.progressTitle}</h2></div><button onClick={() => navigate('progress')}>{c.nav.progress}<ArrowRight /></button></div><div className="sn-stat-grid"><StatCard icon={BookOpen} value={savedWords.length} label={c.wordsSaved} /><StatCard icon={Clock3} value={Math.floor(seconds / 60)} label={c.activeMinutes} /><StatCard icon={Target} value={accuracy === null ? '—' : `${accuracy}%`} label={c.firstAccuracy} /><StatCard icon={CheckCircle2} value={completed.length} label={c.lessonsDone} /></div></section><section className="sn-home-grid"><article className="sn-week-card"><div><span className="sn-kicker">{c.weeklyGoal}</span><h2>{completed.length} / 5</h2><p>{completed.length ? c.honestStats : c.weeklyEmpty}</p></div><div className="sn-goal-ring" style={{ '--goal': `${Math.min(100, completed.length / 5 * 100)}%` }}><span>{Math.min(100, Math.round(completed.length / 5 * 100))}%</span></div></article><article className="sn-review-card"><span><RotateCcw /></span><div><small>{c.reviewDue}</small><h2>{due.length}</h2><p>{due.length ? c.honestStats : c.nothingYet}</p></div><button disabled={!due.length} onClick={openReview}>{c.reviewNow}<ArrowRight /></button></article></section><section className="sn-song-section"><div className="sn-section-heading"><div><span className="sn-kicker">{c.recommended}</span><h2>{c.recommendedSub}</h2></div><button onClick={() => navigate('discover')}>{c.seeCatalog}<ArrowRight /></button></div><div className="sn-song-grid">{songs.slice(0, 3).map((song) => <CompactSong key={song.id} song={song} c={c} record={records[song.id]} listen={hasEmbeddedMedia(song) ? () => openPlayer(song) : null} open={() => openLesson(song, records[song.id]?.status === 'completed')} />)}</div></section></main>;
}

function StatCard({ icon: Icon, value, label }) { return <article><span><Icon /></span><div><strong>{value}</strong><p>{label}</p></div></article>; }

function DiscoverPage({ c, songs, records, savedSongs, toggleSong, openLesson, openPlayer, search, setSearch, openAnalyzer }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('level');
  const levelOrder = { A1: 1, A2: 2, 'A2–B1': 2.5, B1: 3, 'B1–B2': 3.5, B2: 4, C1: 5 };
  const visible = useMemo(() => songs.filter((song) => {
    const matchesSearch = `${song.title} ${song.artist} ${song.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'safe' && song.safety === 'safe') || song.tags.some((tag) => tag.toLowerCase().includes(filter));
    return matchesSearch && matchesFilter;
  }).sort((a, b) => sort === 'score' ? b.score - a.score : sort === 'duration' ? a.minutes - b.minutes : (levelOrder[a.level] || 9) - (levelOrder[b.level] || 9)), [songs, search, filter, sort]);
  const filters = [['all', c.all], ['safe', c.safe], ['vocabulary', c.vocabulary], ['listening', c.listening], ['idioms', c.idioms]];
  return <main className="sn-page sn-discover"><section className="sn-catalog-hero"><div><span className="sn-kicker">{c.catalogEyebrow}</span><h1>{c.catalogTitle}</h1><p>{c.catalogSub}</p><div><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c.search} /></label><button onClick={openAnalyzer}><Sparkles />{c.analyze}</button></div></div><div className="sn-catalog-visual"><span>SONORA</span><strong>{String(songs.length).padStart(2, '0')}</strong><small>{c.learningPaths}</small></div></section><section className="sn-catalog-tools"><div>{filters.map(([id, label]) => <button key={id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{id === 'safe' && <ShieldCheck />}{label}</button>)}</div><label><span>{visible.length} {c.results}</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="level">{c.sortLevel}</option><option value="score">{c.sortScore}</option><option value="duration">{c.sortDuration}</option></select></label></section>{visible.length ? <section className="sn-catalog-grid">{visible.map((song) => <SongCard key={song.id} song={song} c={c} saved={savedSongs.has(song.id)} record={records[song.id]} toggleSave={() => toggleSong(song.id)} listen={hasEmbeddedMedia(song) ? () => openPlayer(song) : null} open={() => openLesson(song, records[song.id]?.status === 'completed')} />)}</section> : <section className="sn-empty"><Search /><h2>{c.noSongs}</h2><button onClick={() => { setSearch(''); setFilter('all'); }}>{c.clearFilters}</button></section>}</main>;
}

function SongCard({ song, c, saved, record, toggleSave, listen, open }) {
  return <article className="sn-song-card"><button className="sn-song-open" onClick={listen || open} aria-label={`${listen ? c.listenHere : c.startLesson}: ${song.title}`} title={listen ? c.listenHere : c.startLesson}><div className={`sn-cover ${song.cover}`}><Music2 /><span>{song.title}</span><b>{listen ? <Play /> : <ArrowRight />}</b></div></button><div className="sn-song-copy"><div className="sn-song-overline"><span>{song.genre}</span><button className={saved ? 'saved' : ''} onClick={toggleSave} aria-label={saved ? c.savedSong : c.saveSong}>{saved ? <BookmarkCheck /> : <Bookmark />}</button></div><button className="sn-song-title" onClick={open}><h2>{song.title}</h2><p>{song.artist}</p></button><div className="sn-song-meta"><span>{song.level}</span><span><Clock3 />{song.minutes} {c.minutes}</span><span className={song.safety === 'safe' ? 'safe' : 'guided'}><ShieldCheck />{song.safety === 'safe' ? c.suitable : song.safety === 'not_recommended' ? c.notRecommended : c.guided}</span></div><div className="sn-tags">{song.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="sn-song-footer"><span><strong>{song.score}</strong>/100 {c.learningValue}</span><button onClick={open}>{record?.status === 'completed' ? c.restartLesson : record ? c.continueLesson : c.startLesson}<ArrowRight /></button></div></div></article>;
}

function CompactSong({ song, c, record, listen, open }) { return <article className="sn-compact-song"><div className={`sn-cover ${song.cover}`}><Music2 /><span>{song.title}</span></div><div><span>{song.artist}</span><h3>{song.title}</h3><p>{song.tags.slice(0, 2).join(' · ')}</p></div><div className="sn-compact-actions">{listen && <button className="listen" onClick={listen} aria-label={`${c.listenHere}: ${song.title}`} title={c.listenHere}><Headphones /></button>}<button onClick={open} aria-label={`${record ? c.continueLesson : c.startLesson}: ${song.title}`}><ArrowRight /></button></div></article>; }

function LibraryPage({ c, lang, songs, savedSongs, words, openLesson, openPlayer, removeWord, removeSong, openReview }) {
  const [tab, setTab] = useState('words');
  const collection = songs.filter((song) => savedSongs.has(song.id));
  const due = words.filter((word) => !word.next_review_at || new Date(word.next_review_at) <= new Date());
  return <main className="sn-page sn-library"><section className="sn-page-intro"><span className="sn-kicker">{c.libraryEyebrow}</span><h1>{c.libraryTitle}</h1><p>{c.librarySub}</p></section><nav className="sn-segmented"><button className={tab === 'words' ? 'active' : ''} onClick={() => setTab('words')}><BookOpen />{c.wordBank}<b>{words.length}</b></button><button className={tab === 'songs' ? 'active' : ''} onClick={() => setTab('songs')}><Music2 />{c.savedSongs}<b>{collection.length}</b></button></nav>{tab === 'words' && <><section className="sn-library-action"><div><span><Brain /></span><div><small>{c.dueToday}</small><h2>{due.length} {c.reviewDue.toLowerCase()}</h2></div></div><button disabled={!due.length} onClick={openReview}>{c.reviewNow}<ArrowRight /></button></section>{words.length ? <section className="sn-word-table"><div className="sn-word-table-head"><span>{c.wordColumn}</span><span>{c.meaningColumn}</span><span>{c.reviewColumn}</span><span /></div>{words.map((word) => <article key={word.word}><button className="sn-word-audio" onClick={() => speakWord(word.word)} aria-label={c.pronounce}><Volume2 /></button><div><strong>{word.word}</strong><span>{word.ipa || 'English'} · {word.cefr || '—'}</span></div><p>{word.meaning?.[lang] || word.definition || '—'}</p><div className="sn-mastery"><i><b style={{ width: `${(word.mastery_level || 0) / 5 * 100}%` }} /></i><span>{word.mastery_level || 0}/5</span></div><button className="sn-remove" onClick={() => removeWord(word)} aria-label={c.remove}><Trash2 /></button></article>)}</section> : <section className="sn-empty"><BookOpen /><h2>{c.noWords}</h2></section>}</>}{tab === 'songs' && (collection.length ? <section className="sn-library-songs">{collection.map((song) => <CompactSong key={song.id} song={song} c={c} listen={hasEmbeddedMedia(song) ? () => openPlayer(song) : null} open={() => openLesson(song)} />)}</section> : <section className="sn-empty"><Bookmark /><h2>{c.noSavedSongs}</h2></section>)}</main>;
}

function ProgressPage({ c, songs, records, savedWords, openLesson }) {
  const list = Object.values(records);
  const completed = list.filter((record) => record.status === 'completed');
  const first = list.flatMap(objectiveFirstAttempts);
  const accuracy = first.length ? Math.round(first.filter((item) => item.correct).length / first.length * 100) : null;
  const seconds = list.reduce((sum, record) => sum + (record.result?.activeSeconds || record.activeSeconds || 0), 0);
  const skills = ['meaning', 'listening', 'vocabulary', 'language'];
  const skillLabels = { meaning: c.meaningSkill, listening: c.listening, vocabulary: c.vocabulary, language: c.realEnglishSkill };
  const skillResults = skills.map((skill) => {
    const attempts = first.filter((item) => item.skill === skill);
    return { skill, attempts: attempts.length, score: attempts.length ? Math.round(attempts.filter((item) => item.correct).length / attempts.length * 100) : null };
  });
  return <main className="sn-page sn-progress-page"><section className="sn-page-intro"><span className="sn-kicker">{c.progressEyebrow}</span><h1>{c.progressTitle}</h1><p>{c.progressSub}</p></section><section className="sn-progress-summary"><StatCard icon={CheckCircle2} value={completed.length} label={c.lessonsDone} /><StatCard icon={BookOpen} value={savedWords.length} label={c.wordsSaved} /><StatCard icon={Clock3} value={Math.floor(seconds / 60)} label={c.activeMinutes} /><StatCard icon={Target} value={accuracy === null ? '—' : `${accuracy}%`} label={c.firstAccuracy} /></section><section className="sn-progress-layout"><article className="sn-skill-panel"><div className="sn-section-heading"><div><span className="sn-kicker">{c.skillBreakdown}</span><h2>{c.honestStats}</h2></div></div>{skillResults.map((item) => <div className="sn-skill-row" key={item.skill}><div><strong>{skillLabels[item.skill]}</strong><span>{item.attempts} {c.attempts}</span></div><i><b style={{ width: `${item.score || 0}%` }} /></i><span>{item.score === null ? '—' : `${item.score}%`}</span></div>)}</article><article className="sn-history-panel"><div className="sn-section-heading"><div><span className="sn-kicker">{c.recentLessons}</span><h2>{list.length || c.nothingYet}</h2></div></div>{list.length ? list.sort((a, b) => new Date(b.updatedAt || b.result?.completedAt || 0) - new Date(a.updatedAt || a.result?.completedAt || 0)).map((record) => { const song = songs.find((item) => item.id === record.songId); if (!song) return null; const progress = recordProgress(record, song); return <button key={record.songId} onClick={() => openLesson(song)}><div className={`sn-cover ${song.cover}`}><Music2 /><span>{song.title}</span></div><div><strong>{song.title}</strong><span>{record.status === 'completed' ? c.completed : c.inProgress}</span></div><i><b style={{ width: `${progress}%` }} /></i><em>{progress}%</em><ArrowRight /></button>; }) : <div className="sn-empty-inline"><BarChart3 /><p>{c.noProgress}</p></div>}</article></section><section className="sn-research-callout"><div><Target /><span><strong>{c.nav.research}</strong><p>{c.researchNote}</p></span></div><button onClick={() => { window.location.hash = '#/research'; }}>{c.openResearch}<ArrowRight /></button></section></main>;
}

function ReviewModal({ c, lang, words, updateWords, close }) {
  const due = words.filter((word) => !word.next_review_at || new Date(word.next_review_at) <= new Date());
  const queue = due.length ? due : words;
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const current = queue[index];
  const rate = (rating) => {
    const intervals = { again: 0, hard: 1, good: 3, easy: 7 };
    const changes = { again: -1, hard: 0, good: 1, easy: 2 };
    const nextDate = new Date(); nextDate.setDate(nextDate.getDate() + intervals[rating]);
    updateWords((items) => items.map((item) => item.word === current.word ? { ...item, mastery_level: Math.max(0, Math.min(5, (item.mastery_level || 0) + changes[rating])), review_count: (item.review_count || 0) + 1, next_review_at: nextDate.toISOString() } : item));
    if (current.id) safeApi(() => sonoraApi.reviewWord(PROFILE_ID, current.id, { rating, correct: rating !== 'again' }));
    if (index + 1 < queue.length) { setIndex(index + 1); setRevealed(false); } else setIndex(queue.length);
  };
  return <div className="sn-modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="sn-review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><button className="sn-modal-close" onClick={close} aria-label={c.close}><X /></button>{current ? <><span className="sn-kicker">{index + 1} / {queue.length}</span><h1 id="review-title">{c.reviewTitle}</h1><div className="sn-review-word"><button onClick={() => speakWord(current.word)} aria-label={c.pronounce}><Volume2 /></button><strong>{current.word}</strong><span>{current.ipa || current.cefr || 'English'}</span></div>{revealed ? <div className="sn-review-answer"><p>{current.meaning?.[lang] || current.definition || '—'}</p><blockquote>{current.example}</blockquote></div> : <button className="sn-primary sn-wide" onClick={() => setRevealed(true)}>{c.reveal}</button>}{revealed && <div className="sn-review-ratings"><button onClick={() => rate('again')}>{c.again}</button><button onClick={() => rate('hard')}>{c.hard}</button><button onClick={() => rate('good')}>{c.good}</button><button onClick={() => rate('easy')}>{c.easy}</button></div>}</> : <><div className="sn-result-symbol"><CheckCircle2 /></div><h1>{c.reviewDone}</h1><button className="sn-primary sn-wide" onClick={close}>{c.close}</button></>}</section></div>;
}

function AnalyzerModal({ c, lang, aiStatus, songs, close, openLesson, saveGenerated }) {
  const [artist, setArtist] = useState(''); const [title, setTitle] = useState(''); const [lyricsText, setLyricsText] = useState('');
  const [stage, setStage] = useState('form'); const [result, setResult] = useState(null); const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setStage('loading'); setError('');
    const payload = await safeApi(() => sonoraApi.analyze({ artist, title, lyrics: lyricsText, interface_language: lang, profile_id: PROFILE_ID, use_ai: true }));
    if (!payload) { setError(c.qwenRequired); setStage('form'); return; }
    setResult(payload); setStage('result');
  };
  const matched = songs.find((song) => song.title.toLowerCase() === title.trim().toLowerCase());
  const classroomFit = result?.analysis?.classroom_fit;
  const classroomFitLabel = classroomFit === 'safe' ? c.suitable : classroomFit === 'not_recommended' ? c.notRecommended : classroomFit === 'guided' ? c.guided : '—';
  const isAiResult = Boolean(result?.lesson);
  const buildGenerated = () => {
    if (!result?.lesson) return;
    const id = `ai-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || Date.now()}`;
    const lesson = apiLessonToFrontend(result.lesson);
    saveGenerated({
      song: {
        id, title, artist, level: result.lesson.level, minutes: 20,
        score: result.lesson.learning_score, safety: result.lesson.classroom_fit,
        cover: 'cover-blue', genre: 'AI lesson', tags: ['Vocabulary', 'Listening', 'Speaking'],
        generated: true, activityCount: requiredActivityIdsForSong(id, lesson).length,
      },
      lesson,
    });
  };
  return <div className="sn-modal-scrim" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="sn-analyzer-modal" role="dialog" aria-modal="true" aria-labelledby="analyzer-title"><button className="sn-modal-close" onClick={close} aria-label={c.close}><X /></button><header><span><Sparkles /></span><div><small>MINIMAX M3 · FREE ROUTER FALLBACK</small><h1 id="analyzer-title">{c.analyzerTitle}</h1><p>{c.analyzerSub}</p><b className={aiStatus?.ready ? 'ready' : 'offline'}>{aiStatus?.ready ? c.qwenReady : c.qwenOffline}</b></div></header>{stage === 'form' && <form onSubmit={submit}><div><label><span>{c.artist}</span><input required value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="OneRepublic" /></label><label><span>{c.songTitle}</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Counting Stars" /></label></div><label><span>{c.excerpt}</span><textarea required minLength={20} maxLength={1600} value={lyricsText} onChange={(event) => setLyricsText(event.target.value)} /></label>{error && <p className="sn-form-error">{error}</p>}<button className="sn-primary" type="submit"><Sparkles />{c.runAnalysis}</button></form>}{stage === 'loading' && <div className="sn-analyzer-loading"><span><Sparkles /></span><h2>{c.analyzing}</h2><i><b /></i></div>}{stage === 'result' && result && <div className="sn-analysis-result"><div className="sn-analysis-title"><div><span>{artist}</span><h2>{title}</h2><p>{isAiResult ? c.aiReview : c.basicEstimate}</p></div><strong>{result.analysis?.level}</strong></div><div className="sn-analysis-stats"><span><small>{c.learningValue}</small><strong>{isAiResult ? `${result.analysis?.learning_score}/100` : '—'}</strong></span><span><small>{c.usefulWords}</small><strong>{result.analysis?.useful_words?.length || 0}</strong></span><span><small>{c.safe}</small><strong>{classroomFitLabel}</strong></span></div><div className="sn-analysis-words">{result.analysis?.useful_words?.map((word) => <span key={word}>{word}</span>)}</div><div className="sn-analysis-actions"><button onClick={() => setStage('form')}><ArrowLeft />{c.edit}</button>{matched && <button className="sn-primary" onClick={() => openLesson(matched)}>{c.startLesson}<ArrowRight /></button>}{!matched && result.lesson && <button className="sn-primary" onClick={buildGenerated}>{c.useLesson}<ArrowRight /></button>}{!matched && !result.lesson && <p>{c.qwenRequired}</p>}</div></div>}</section></div>;
}

function MobileNav({ route, c, navigate }) { const items = [[Home, 'home', c.nav.home], [Compass, 'discover', c.nav.discover], [LibraryBig, 'library', c.nav.library], [BarChart3, 'progress', c.nav.progress]]; return <nav className="sn-mobile-nav">{items.map(([Icon, id, label]) => <button key={id} aria-current={route === id ? 'page' : undefined} className={route === id ? 'active' : ''} onClick={() => navigate(id)}><Icon /><span>{label}</span></button>)}</nav>; }
function NotFound({ onBack }) { return <main className="sn-not-found"><Music2 /><h1>Lesson not found</h1><button onClick={onBack}><ArrowLeft />Back to catalog</button></main>; }

export default ProductApp;
