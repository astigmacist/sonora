const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export const isYouTubeVideoId = (value) => typeof value === 'string' && YOUTUBE_VIDEO_ID.test(value);

export const youtubeEmbedUrl = (videoId, origin = '') => (
  isYouTubeVideoId(videoId)
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&playsinline=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`
    : null
);

export const hasEmbeddedMedia = (song) => (
  song?.media?.provider === 'youtube'
  && song.media.official === true
  && isYouTubeVideoId(song.media.videoId)
);

let youtubeApiPromise;

export const loadYouTubeIframeApi = () => {
  if (globalThis.YT?.Player) return Promise.resolve(globalThis.YT);
  if (!globalThis.document) return Promise.reject(new Error('YouTube player API requires a browser'));
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = globalThis.onYouTubeIframeAPIReady;
    globalThis.onYouTubeIframeAPIReady = () => {
      try { previousReady?.(); } finally { resolve(globalThis.YT); }
    };

    const existing = document.querySelector('script[data-sonora-youtube-api]');
    if (existing) return;
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.sonoraYoutubeApi = 'true';
    script.addEventListener('error', () => {
      youtubeApiPromise = undefined;
      reject(new Error('YouTube player API could not be loaded'));
    }, { once: true });
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
};
