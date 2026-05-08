// JobSort browser extension — background service worker
// Handles API communication, auth token storage, and message passing.

const DEFAULT_API_URL = 'http://localhost:8000';

async function getSettings() {
  const result = await chrome.storage.local.get(['apiUrl', 'jwt']);
  return {
    apiUrl: result.apiUrl || DEFAULT_API_URL,
    jwt: result.jwt || null,
  };
}

async function apiCall(method, path, body) {
  const { apiUrl, jwt } = await getSettings();
  if (!jwt) return { error: 'Not authenticated. Click the JobSort icon to sign in.' };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };

  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      await chrome.storage.local.remove('jwt');
      return { error: 'Session expired. Please sign in again.' };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.detail || `Request failed (${res.status})` };
    }

    return { data: await res.json() };
  } catch (err) {
    return { error: `Cannot reach JobSort API at ${apiUrl}. Make sure the server is running.` };
  }
}

// Check if a job with this URL already exists
async function findJobByUrl(jobUrl) {
  const { apiUrl, jwt } = await getSettings();
  if (!jwt) return null;

  try {
    const res = await fetch(`${apiUrl}/api/jobs/`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const jobs = await res.json();
    return jobs.find((j) => j.job_url === jobUrl) || null;
  } catch {
    return null;
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveJob') {
    handleSaveJob(message.data).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (message.action === 'checkJob') {
    handleCheckJob(message.url).then(sendResponse);
    return true;
  }

  if (message.action === 'login') {
    handleLogin(message.credential).then(sendResponse);
    return true;
  }

  if (message.action === 'getStatus') {
    getSettings().then(({ jwt, apiUrl }) => {
      sendResponse({ authenticated: !!jwt, apiUrl });
    });
    return true;
  }

  if (message.action === 'logout') {
    chrome.storage.local.remove('jwt').then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.action === 'setApiUrl') {
    chrome.storage.local.set({ apiUrl: message.apiUrl }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function handleSaveJob(data) {
  // Check if already saved
  if (data.job_url) {
    const existing = await findJobByUrl(data.job_url);
    if (existing) {
      return { success: false, alreadySaved: true, error: 'This job is already in your JobSort board.' };
    }
  }

  const result = await apiCall('POST', '/api/jobs/', {
    job_title: data.job_title,
    company: data.company,
    job_description: data.job_description,
    job_url: data.job_url || window.location?.href || '',
    stage: 'Saved',
  });

  if (result.error) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

async function handleCheckJob(url) {
  const existing = await findJobByUrl(url);
  return { saved: !!existing, job: existing };
}

async function handleLogin(credential) {
  const { apiUrl } = await getSettings();

  try {
    const res = await fetch(`${apiUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.detail || 'Login failed' };
    }

    const { access_token } = await res.json();
    await chrome.storage.local.set({ jwt: access_token });

    // Fetch user info
    const userRes = await fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = userRes.ok ? await userRes.json() : null;

    return { success: true, user };
  } catch (err) {
    return { success: false, error: `Cannot reach JobSort API at ${apiUrl}.` };
  }
}
