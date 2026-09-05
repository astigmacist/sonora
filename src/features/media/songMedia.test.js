import test from 'node:test';
import assert from 'node:assert/strict';

import { songs } from '../../data.js';
import {
  hasEmbeddedMedia,
  isYouTubeVideoId,
  youtubeEmbedUrl,
} from './songMedia.js';

test('embed URLs use fixed official provider origins and privacy-enhanced YouTube', () => {
  assert.equal(
    youtubeEmbedUrl('4NRXx6U8ABQ'),
    'https://www.youtube-nocookie.com/embed/4NRXx6U8ABQ?rel=0&playsinline=1&enablejsapi=1',
  );
  assert.equal(
    youtubeEmbedUrl('4NRXx6U8ABQ', 'http://localhost:5173'),
    'https://www.youtube-nocookie.com/embed/4NRXx6U8ABQ?rel=0&playsinline=1&enablejsapi=1&origin=http%3A%2F%2Flocalhost%3A5173',
  );
});

test('untrusted or malformed media IDs never become iframe URLs', () => {
  assert.equal(isYouTubeVideoId('../bad-id'), false);
  assert.equal(youtubeEmbedUrl('bad'), null);
  assert.equal(hasEmbeddedMedia({ media: { provider: 'youtube', videoId: '4NRXx6U8ABQ', official: false } }), false);
});

test('every curated lesson has a distinct, reviewed official video', () => {
  assert.ok(songs.length >= 6);
  assert.ok(songs.every(hasEmbeddedMedia));
  assert.ok(songs.every((song) => song.media.verifiedAt === '2026-09-05'));
  assert.ok(songs.every((song) => song.media.channelLabel));
  assert.equal(new Set(songs.map((song) => song.media.videoId)).size, songs.length);
});
