// Thin REST client for the ClearMind API (Interoperability NFR: JSON over REST).
// Every call attaches the session token; a 401 clears it so the app falls back
// to the sign-in screen rather than looping on a dead session.

const TOKEN_KEY = 'clearmind.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private browsing - the session simply will not persist */
  }
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Reliability NFR: the caller keeps the entry so it can be resubmitted.
    throw new ApiError('Could not reach ClearMind. Check your connection and try again.', 0, null);
  }

  if (response.status === 401 && auth) setToken(null);

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(data?.error || 'Something went wrong.', response.status, data);
  }
  return data;
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/auth/me'),

  submitCheckIn: (payload) => request('/checkins', { method: 'POST', body: payload }),
  listCheckIns: ({ from, to } = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    return request(`/checkins${qs ? `?${qs}` : ''}`);
  },
  deleteCheckIn: (id) => request(`/checkins/${id}`, { method: 'DELETE' }),

  weeklyReport: () => request('/reports/weekly'),
  trend: (days = 30) => request(`/reports/trend?days=${days}`),

  recommendations: () => request('/resources/recommendations'),
  crisisResources: () => request('/resources/crisis'),

  myPractitionerProfile: () => request('/resources/practitioner/me'),
  savePractitionerProfile: (payload) =>
    request('/resources/practitioner', { method: 'POST', body: payload }),
  mySchoolResources: () => request('/resources/school/mine'),
  saveSchoolResource: (payload) => request('/resources/school', { method: 'POST', body: payload }),
  importResources: (payload) => request('/resources/import', { method: 'POST', body: payload }),

  // FR-7 connections
  setDiscoverability: (payload) =>
    request('/connections/discoverability', { method: 'PATCH', body: payload }),
  discoverableStudents: () => request('/connections/students'),
  sendConnectionRequest: (payload) => request('/connections', { method: 'POST', body: payload }),
  listConnections: () => request('/connections'),
  respondToConnection: (id, decision) =>
    request(`/connections/${id}/respond`, { method: 'POST', body: { decision } }),

  deleteAllCheckIns: () => request('/account/checkins', { method: 'DELETE' }),
  exportMyData: () => request('/account/export'),
};
