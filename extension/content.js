// JobSort browser extension — content script
// Injects a floating "Adapt my resume to this job" button on job posting pages.

(function () {
  'use strict';

  // Bail out if the extension was reloaded and this script is orphaned.
  if (!chrome.runtime?.id) return;

  const BUTTON_ID = 'jobsort-adapt-btn';

  // ── Mutable state ──────────────────────────────────────────────

  let currentJob = null;
  let buttonState = 'idle'; // idle | loading | success | error | already-saved
  let initLock = false;
  let contextInvalid = false;
  let lastUrl = window.location.href;
  let urlPoller = null;
  let observer = null;

  // ── Extension context guard ────────────────────────────────────

  async function sendMessage(msg) {
    if (contextInvalid) return null;
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (err) {
      if (err.message?.includes('Extension context invalidated')) {
        shutdown();
      }
      throw err;
    }
  }

  function shutdown() {
    contextInvalid = true;
    if (urlPoller) clearInterval(urlPoller);
    if (observer) observer.disconnect();
    const btn = document.getElementById(BUTTON_ID);
    if (btn) btn.remove();
  }

  // ── Button creation ────────────────────────────────────────────

  function createButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.innerHTML = `
      <span class="jobsort-btn-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
        </svg>
      </span>
      <span class="jobsort-btn-label">Adapt my resume to this job</span>
    `;
    btn.title = 'Save this job to JobSort and adapt your resume';

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: '9999',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 18px',
      background: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: '9999px',
      fontSize: '14px',
      fontWeight: '600',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
      transition: 'all 0.2s ease',
      outline: 'none',
      whiteSpace: 'nowrap',
    });

    btn.addEventListener('mouseenter', () => {
      if (buttonState === 'idle') {
        btn.style.background = '#1d4ed8';
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.45)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (buttonState === 'idle') {
        btn.style.background = '#2563eb';
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.35)';
      }
    });

    btn.addEventListener('click', handleClick);
    document.body.appendChild(btn);
  }

  // ── Button state management ────────────────────────────────────

  function setButtonState(state, message) {
    buttonState = state;
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    const label = btn.querySelector('.jobsort-btn-label');

    switch (state) {
      case 'loading':
        btn.style.background = '#6366f1';
        btn.style.cursor = 'wait';
        btn.style.opacity = '0.85';
        label.textContent = 'Saving to JobSort...';
        break;

      case 'success':
        btn.style.background = '#10b981';
        btn.style.cursor = 'default';
        btn.style.opacity = '1';
        btn.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.35)';
        label.textContent = 'Saved to JobSort ✓';
        setTimeout(() => setButtonState('idle'), 3000);
        break;

      case 'error':
        btn.style.background = '#ef4444';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.35)';
        label.textContent = message || 'Failed — try again';
        setTimeout(() => setButtonState('idle'), 4000);
        break;

      case 'already-saved':
        btn.style.background = '#6366f1';
        btn.style.cursor = 'default';
        btn.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)';
        label.textContent = 'Already saved ✓';
        setTimeout(() => setButtonState('idle'), 3000);
        break;

      default: // idle
        btn.style.background = '#2563eb';
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
        btn.style.boxShadow = '0 4px 14px rgba(37, 99, 235, 0.35)';
        label.textContent = 'Adapt my resume to this job';
        break;
    }
  }

  // ── Click handler ──────────────────────────────────────────────

  async function handleClick() {
    if (contextInvalid) return;
    if (buttonState === 'loading' || buttonState === 'success') return;
    if (!currentJob) return;

    setButtonState('loading');

    try {
      const response = await sendMessage({
        action: 'saveJob',
        data: {
          job_title: currentJob.job_title,
          company: currentJob.company,
          job_description: currentJob.job_description,
          job_url: window.location.href,
        },
      });

      if (!response) return; // context invalidated during call

      if (response.success) {
        setButtonState('success');
      } else if (response.alreadySaved) {
        setButtonState('already-saved');
      } else {
        const msg = response.error || 'Failed — try again';
        if (msg.includes('Not authenticated')) {
          setButtonState('error', 'Sign in first — click the JobSort icon (🧩 in Chrome toolbar)');
        } else {
          setButtonState('error', msg);
        }
      }
    } catch {
      if (!contextInvalid) {
        setButtonState('error', 'Extension error — reload the page');
      }
    }
  }

  // ── Scrape and initialize ──────────────────────────────────────

  async function init() {
    if (contextInvalid || initLock) return;
    initLock = true;

    try {
      if (typeof Scrapers === 'undefined') return;
      currentJob = Scrapers.scrape();
      if (!currentJob) return;

      try {
        const response = await sendMessage({
          action: 'checkJob',
          url: window.location.href,
        });

        if (!response) return; // context invalidated

        if (response.saved) {
          currentJob = null;
          createButton();
          setButtonState('already-saved');
        } else {
          createButton();
          setButtonState('idle');
        }
      } catch {
        if (contextInvalid) return;
        createButton();
        setButtonState('idle');
      }
    } finally {
      initLock = false;
    }
  }

  // ── SPA navigation handling ────────────────────────────────────

  function checkUrlChange() {
    if (contextInvalid) return;
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      const old = document.getElementById(BUTTON_ID);
      if (old) old.remove();
      buttonState = 'idle';
      currentJob = null;
      setTimeout(init, 1500);
    }
  }

  urlPoller = setInterval(checkUrlChange, 1500);

  observer = new MutationObserver(() => {
    if (contextInvalid) return;
    if (!document.getElementById(BUTTON_ID) && document.readyState === 'complete') {
      init();
    }
  });

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }

  observer.observe(document.body, { childList: true, subtree: true });
})();
