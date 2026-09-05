import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Headphones, Music2, Pause, Play, ShieldCheck, X } from 'lucide-react';
import { hasEmbeddedMedia, loadYouTubeIframeApi, youtubeEmbedUrl } from './features/media/songMedia';

const playerCopy = {
  en: {
    eyebrow: 'LISTEN INSIDE SONORA', title: 'Official recording', sub: 'The full visible player stays on this page.',
    source: 'Playback source', youtube: 'YouTube · official video', official: 'Official embed',
    load: 'Load player', loading: 'Connecting…', ready: 'Ready to play', playing: 'Playing', paused: 'Paused', finished: 'Recording finished', error: 'Player unavailable on this network', close: 'Close player', lesson: 'Open the English lesson',
    sample: 'Focused listening sample', sampleDone: 'Listening checkpoint unlocked', seconds: 'sec',
    timerStart: 'Start 30-sec focus timer', timerPause: 'Pause focus timer', timerHint: 'Use after pressing Play if automatic tracking is blocked.',
    privacy: 'The player loads only after your click. YouTube may receive technical data and set cookies under its own policy.',
    storage: 'SONORA does not download or store this song. Playback is provided by the official artist channel through YouTube.',
    unavailable: 'No official embedded recording is attached to this lesson yet.',
  },
  kk: {
    eyebrow: 'SONORA ІШІНДЕ ТЫҢДА', title: 'Ресми жазба', sub: 'Толық әрі көрінетін плеер осы бетте қалады.',
    source: 'Ойнату көзі', youtube: 'YouTube · ресми видео', official: 'Ресми плеер',
    load: 'Плеерді жүктеу', loading: 'Қосылып жатыр…', ready: 'Ойнатуға дайын', playing: 'Ойнатылып жатыр', paused: 'Тоқтатылды', finished: 'Жазба аяқталды', error: 'Бұл желіде плеер ашылмады', close: 'Плеерді жабу', lesson: 'Ағылшын сабағын ашу',
    sample: 'Мақсатты тыңдалым үзіндісі', sampleDone: 'Тыңдалым кезеңі ашылды', seconds: 'сек',
    timerStart: '30 секундтық таймерді бастау', timerPause: 'Таймерді тоқтату', timerHint: 'Автоматты бақылау ашылмаса, Play басқаннан кейін қолдан.',
    privacy: 'Плеер сен басқаннан кейін ғана жүктеледі. YouTube өз ережесіне сай техникалық дерек алып, cookie қолдануы мүмкін.',
    storage: 'SONORA бұл әнді жүктеп алмайды және сақтамайды. Ойнатуды орындаушының ресми YouTube арнасы береді.',
    unavailable: 'Бұл сабаққа әзірге ресми кірістірілген жазба қосылмаған.',
  },
  ru: {
    eyebrow: 'СЛУШАЙ ВНУТРИ SONORA', title: 'Официальная запись', sub: 'Полный видимый плеер работает прямо на этой странице.',
    source: 'Источник воспроизведения', youtube: 'YouTube · официальное видео', official: 'Официальный плеер',
    load: 'Загрузить плеер', loading: 'Подключаем…', ready: 'Готов к воспроизведению', playing: 'Воспроизводится', paused: 'На паузе', finished: 'Запись завершена', error: 'Плеер недоступен в этой сети', close: 'Закрыть плеер', lesson: 'Открыть урок английского',
    sample: 'Фрагмент внимательного прослушивания', sampleDone: 'Этап аудирования разблокирован', seconds: 'сек',
    timerStart: 'Запустить таймер на 30 сек', timerPause: 'Поставить таймер на паузу', timerHint: 'Используй после Play, если автоматическое отслеживание заблокировано.',
    privacy: 'Плеер загрузится только после твоего нажатия. YouTube может получить технические данные и использовать cookie по своим правилам.',
    storage: 'SONORA не скачивает и не хранит эту песню. Воспроизведение идёт с официального YouTube-канала исполнителя.',
    unavailable: 'К этому уроку пока не привязана официальная встроенная запись.',
  },
};

export function EmbeddedSongPlayer({ song, lang = 'en', onActivate, onPlaying, onEnded, onQualified, qualifiedSeconds = 0, qualifiedComplete = false, showHeader = true }) {
  const c = playerCopy[lang] || playerCopy.en;
  const headingId = useId();
  const [status, setStatus] = useState('idle');
  const [engagedSeconds, setEngagedSeconds] = useState(qualifiedComplete ? qualifiedSeconds : 0);
  const [manualTracking, setManualTracking] = useState(false);
  const iframeRef = useRef(null);
  const playerRef = useRef(null);
  const connectionStartedRef = useRef(false);
  const disposedRef = useRef(false);
  const playingReportedRef = useRef(false);
  const endedReportedRef = useRef(false);
  const qualifiedReportedRef = useRef(qualifiedComplete);

  useEffect(() => {
    disposedRef.current = false;
    setStatus('idle');
    setEngagedSeconds(qualifiedComplete ? qualifiedSeconds : 0);
    setManualTracking(false);
    connectionStartedRef.current = false;
    playingReportedRef.current = false;
    endedReportedRef.current = false;
    qualifiedReportedRef.current = qualifiedComplete;
    return () => {
      disposedRef.current = true;
      try { playerRef.current?.destroy?.(); } catch { /* iframe unmount is enough */ }
      playerRef.current = null;
    };
  }, [song?.id]);

  const connectPlayerApi = () => {
    setStatus('ready');
    if (connectionStartedRef.current || !iframeRef.current) return;
    connectionStartedRef.current = true;
    loadYouTubeIframeApi().then((YT) => {
      if (disposedRef.current || !iframeRef.current) return;
      playerRef.current = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => !disposedRef.current && setStatus('ready'),
          onStateChange: (event) => {
            if (disposedRef.current) return;
            if (event.data === YT.PlayerState.PLAYING) {
              setStatus('playing');
              if (!playingReportedRef.current) {
                playingReportedRef.current = true;
                onPlaying?.();
              }
            } else if (event.data === YT.PlayerState.ENDED) {
              setStatus('finished');
              if (!endedReportedRef.current) {
                endedReportedRef.current = true;
                onEnded?.();
              }
            } else if (event.data === YT.PlayerState.PAUSED) setStatus('paused');
            else if (event.data === YT.PlayerState.BUFFERING) setStatus('loading');
          },
          onError: () => !disposedRef.current && setStatus('error'),
        },
      });
    }).catch(() => {
      if (!disposedRef.current) setStatus('ready');
    });
  };

  useEffect(() => {
    if (!qualifiedSeconds || qualifiedComplete || (status !== 'playing' && !manualTracking) || engagedSeconds >= qualifiedSeconds) return undefined;
    const timer = window.setInterval(() => setEngagedSeconds((current) => Math.min(qualifiedSeconds, current + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [status, manualTracking, qualifiedSeconds, qualifiedComplete, engagedSeconds]);

  useEffect(() => {
    if (!qualifiedSeconds || engagedSeconds < qualifiedSeconds || qualifiedReportedRef.current) return;
    qualifiedReportedRef.current = true;
    setManualTracking(false);
    onQualified?.();
  }, [engagedSeconds, qualifiedSeconds, onQualified]);

  if (!hasEmbeddedMedia(song)) {
    return <div className="sn-player-unavailable"><Music2 /><p>{c.unavailable}</p></div>;
  }

  const url = youtubeEmbedUrl(song.media.videoId, globalThis.location?.origin);
  const activate = () => {
    setStatus('loading');
    onActivate?.('youtube');
  };

  return <section className="sn-embedded-player" aria-labelledby={showHeader ? headingId : undefined} aria-label={showHeader ? undefined : `${song.title} — ${song.artist}`}>
    {showHeader && <div className="sn-player-heading">
      <div><span><Headphones /></span><div><small>{c.eyebrow}</small><h2 id={headingId}>{song.title}</h2><p>{song.artist}</p></div></div>
      <span className="sn-player-official"><CheckCircle2 />{c.official} · {song.media.channelLabel}</span>
    </div>}
    <div className="sn-player-source-row">
      <span>{c.source}</span>
      <strong>{c.youtube} · {song.media.channelLabel}</strong>
    </div>
    <div className="sn-player-frame youtube">
      {status === 'idle' ? <div className="sn-player-consent"><span><Play /></span><div><strong>{c.load}</strong><p>{c.privacy}</p></div><button type="button" onClick={activate}><Play />{c.load}</button></div> : <>
        <iframe
          ref={iframeRef}
          key={`${song.id}-youtube`}
          src={url}
          title={`${song.title} — ${c.youtube}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          onLoad={connectPlayerApi}
        />
        <span className={`sn-player-status ${status}`} aria-live="polite"><i />{c[status] || c.loading}</span>
      </>}
    </div>
    {qualifiedSeconds > 0 && <div className={`sn-player-proof ${(qualifiedComplete || engagedSeconds >= qualifiedSeconds) ? 'complete' : ''}`}>
      <div><span>{(qualifiedComplete || engagedSeconds >= qualifiedSeconds) ? <Check /> : <Headphones />}</span><div><strong>{(qualifiedComplete || engagedSeconds >= qualifiedSeconds) ? c.sampleDone : c.sample}</strong><p>{Math.min(qualifiedSeconds, engagedSeconds)} / {qualifiedSeconds} {c.seconds}</p></div></div>
      <i><b style={{ width: `${Math.min(100, (qualifiedComplete ? 1 : engagedSeconds / qualifiedSeconds) * 100)}%` }} /></i>
      {!qualifiedComplete && engagedSeconds < qualifiedSeconds && status !== 'idle' && status !== 'loading' && status !== 'playing' && <button type="button" className={manualTracking ? 'active' : ''} title={c.timerHint} onClick={() => setManualTracking((current) => !current)}>{manualTracking ? <Pause /> : <Play />}{manualTracking ? c.timerPause : c.timerStart}</button>}
    </div>}
    <p className="sn-player-storage"><ShieldCheck />{c.storage}</p>
  </section>;
}

export function SongPlayerModal({ song, lang = 'en', onClose, onStartLesson }) {
  const c = playerCopy[lang] || playerCopy.en;
  const titleId = useId();

  return <div className="sn-modal-scrim sn-player-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="sn-player-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><div><span className="sn-kicker">{c.title}</span><h1 id={titleId}>{song.title}</h1><p>{song.artist} · {c.sub}</p></div><button type="button" onClick={onClose} aria-label={c.close}><X /></button></header>
      <EmbeddedSongPlayer song={song} lang={lang} showHeader={false} />
      <footer><button type="button" className="sn-primary" onClick={onStartLesson}>{c.lesson}<ArrowRight /></button></footer>
    </section>
  </div>;
}
