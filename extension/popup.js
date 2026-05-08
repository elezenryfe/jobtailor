// JobSort browser extension — popup script
// Uses chrome.identity.launchWebAuthFlow for Google OAuth (no external scripts needed).

const DEFAULT_API_URL = 'http://localhost:8000';

// ── DOM refs ──────────────────────────────────────────────────

const loggedOutView = document.getElementById('logged-out-view');
const loggedInView = document.getElementById('logged-in-view');
const userStatus = document.getElementById('user-status');
const googleClientInput = document.getElementById('google-client-id');
const apiUrlOutInput = document.getElementById('api-url-out');
const apiUrlInput = document.getElementById('api-url');
const signinBtn = document.getElementById('signin-btn');
const loginError = document.getElementById('login-error');
const openDashboardBtn = document.getElementById('open-dashboard');
const logoutBtn = document.getElementById('logout-btn');
const saveSettingsBtn = document.getElementById('save-settings');
const saveSettingsOutBtn = document.getElementById('save-settings-out');

// ── Init ──────────────────────────────────────────────────────

async function init() {
  const { jwt, apiUrl, googleClientId } = await chrome.storage.local.get(['jwt', 'apiUrl', 'googleClientId']);
  const url = apiUrl || DEFAULT_API_URL;
  if (apiUrlInput) apiUrlInput.value = url;
  if (apiUrlOutInput) apiUrlOutInput.value = url;
  if (googleClientInput) googleClientInput.value = googleClientId || '';

  if (jwt) {
    showLoggedIn(jwt, url);
  } else {
    showLoggedOut(googleClientId);
  }
}

// ── Views ─────────────────────────────────────────────────────

function showLoggedOut() {
  loggedOutView.style.display = 'block';
  loggedInView.style.display = 'none';
}

function showLoggedIn(jwt, apiUrl) {
  loggedOutView.style.display = 'none';
  loggedInView.style.display = 'block';

  fetch(`${apiUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
    .then((r) => r.json())
    .then((u) => {
      if (u.email) userStatus.innerHTML = `✓ Connected as <strong>${u.email}</strong>`;
    })
    .catch(() => {});
}

// ── Google Sign-In via chrome.identity ────────────────────────

signinBtn.addEventListener('click', async () => {
  const clientId = googleClientInput.value.trim();
  if (!clientId) {
    loginError.style.display = 'block';
    loginError.textContent = 'Enter your Google Client ID first.';
    return;
  }

  loginError.style.display = 'none';
  signinBtn.disabled = true;
  signinBtn.innerHTML = '<span class="spinner"></span> Signing in...';

  // The redirect URL must match an authorized origin in Google Cloud Console.
  // chrome.identity.launchWebAuthFlow handles the redirect URI automatically
  // using https://<extension-id>.chromiumapp.org/
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('nonce', Math.random().toString(36).substring(2, 15));

  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    // Extract the id_token from the URL fragment or query
    const params = new URLSearchParams(
      responseUrl.includes('#') ? responseUrl.split('#')[1] : responseUrl.split('?')[1]
    );
    const idToken = params.get('id_token');

    if (!idToken) {
      throw new Error('No ID token in response');
    }

    // Exchange with our backend for a JobSort JWT
    const result = await chrome.runtime.sendMessage({
      action: 'login',
      credential: idToken,
    });

    if (result.success) {
      init();
    } else {
      loginError.style.display = 'block';
      loginError.textContent = result.error || 'Login failed';
    }
  } catch (err) {
    loginError.style.display = 'block';
    loginError.textContent = err.message || 'Login failed. Check your Client ID and Google Cloud Console settings.';
  } finally {
    signinBtn.disabled = false;
    signinBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    `;
  }
});

// ── Settings ──────────────────────────────────────────────────

async function saveSettings() {
  const apiUrl = (apiUrlInput.value || apiUrlOutInput.value || DEFAULT_API_URL).trim();
  const googleClientId = googleClientInput.value.trim();
  await chrome.storage.local.set({ apiUrl, googleClientId });
}

saveSettingsBtn.addEventListener('click', async () => {
  await saveSettings();
  saveSettingsBtn.textContent = 'Saved!';
  setTimeout(() => (saveSettingsBtn.textContent = 'Save Settings'), 1500);
});

saveSettingsOutBtn.addEventListener('click', async () => {
  await saveSettings();
  saveSettingsOutBtn.textContent = 'Saved!';
  setTimeout(() => (saveSettingsOutBtn.textContent = 'Save Settings'), 1500);
  init();
});

// ── Other buttons ─────────────────────────────────────────────

openDashboardBtn.addEventListener('click', async () => {
  const { apiUrl } = await chrome.storage.local.get('apiUrl');
  const url = (apiUrl || DEFAULT_API_URL).replace(':8000', ':5173');
  chrome.tabs.create({ url });
});

logoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'logout' });
  init();
});

// ── Start ─────────────────────────────────────────────────────

init();
