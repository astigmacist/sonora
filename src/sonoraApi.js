const DEFAULT_API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:8765/api';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
  });
  if (!response.ok) {
    const error = new Error(`SONORA API ${response.status}`);
    error.status = response.status;
    try { error.payload = await response.json(); } catch { /* no response body */ }
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
};

export const sonoraApi = {
  capabilities: () => request('/capabilities'),
  getProfile: (profileId) => request(`/profiles/${encodeURIComponent(profileId)}`),
  createProfile: (payload) => request('/profiles', { method: 'POST', body: JSON.stringify(payload) }),
  words: (profileId) => request(`/profiles/${encodeURIComponent(profileId)}/words`),
  saveWord: (profileId, payload) => request(`/profiles/${encodeURIComponent(profileId)}/words`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteWord: (profileId, word) => request(`/profiles/${encodeURIComponent(profileId)}/words/by-name/${encodeURIComponent(word)}`, { method: 'DELETE' }),
  progress: (profileId) => request(`/profiles/${encodeURIComponent(profileId)}/progress`),
  saveProgress: (profileId, songId, payload) => request(`/profiles/${encodeURIComponent(profileId)}/progress/${encodeURIComponent(songId)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  dashboard: (profileId) => request(`/profiles/${encodeURIComponent(profileId)}/dashboard`),
  dueReviews: (profileId) => request(`/profiles/${encodeURIComponent(profileId)}/reviews/due`),
  reviewWord: (profileId, savedWordId, payload) => request(`/profiles/${encodeURIComponent(profileId)}/reviews/${savedWordId}/attempt`, { method: 'POST', body: JSON.stringify(payload) }),
  startSession: (profileId, payload) => request(`/profiles/${encodeURIComponent(profileId)}/sessions`, { method: 'POST', body: JSON.stringify(payload) }),
  getSession: (sessionId) => request(`/sessions/${encodeURIComponent(sessionId)}`),
  attempt: (sessionId, payload) => request(`/sessions/${encodeURIComponent(sessionId)}/attempts`, { method: 'POST', body: JSON.stringify(payload) }),
  completeSession: (sessionId) => request(`/sessions/${encodeURIComponent(sessionId)}/complete`, { method: 'POST' }),
  analyze: (payload) => request('/analyze', { method: 'POST', body: JSON.stringify(payload) }),
};

export const safeApi = async (operation, fallback = null) => {
  try { return await operation(); } catch { return fallback; }
};
