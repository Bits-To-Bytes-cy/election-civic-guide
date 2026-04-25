/**
 * @fileoverview Civic Flow — Application Bootstrapper
 *
 * Initializes the application, binds DOM events, handles themes,
 * wires Google Auth / Storage / Analytics, and orchestrates
 * interactions between the UI, API, Auth, and Storage layers.
 *
 * @module app
 */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ==========================================================
   *  GA4 ANALYTICS — Runtime config override
   * ========================================================== */

  /**
   * Re-configures GA4 with the real Measurement ID from config.js.
   * The placeholder in the HTML <head> ensures gtag() is available
   * immediately; this call swaps in the real ID once config loads.
   */
  function initAnalytics() {
    const trackingId = window.CivicFlow.Config.getGaTrackingId();
    if (trackingId && window.gtag) {
      window.gtag('config', trackingId, { send_page_view: true });
    }
  }

  /**
   * Sends a custom GA4 event.
   * @param {string} eventName - GA4 event name (e.g. 'search', 'ai_query')
   * @param {Object} [params]  - Optional event parameters
   */
  function trackEvent(eventName, params) {
    if (window.gtag) {
      window.gtag('event', eventName, params || {});
    }
  }

  /* ==========================================================
   *  HIGH CONTRAST TOGGLE
   * ========================================================== */

  function initContrast() {
    const toggle = $('#contrast-toggle'), track = $('#contrast-track'), label = $('#contrast-label');
    if (!toggle) return;
    const storageKey = window.CivicFlow.Config?.CONFIG?.STORAGE_KEY_CONTRAST || 'civicflow-hc';

    if (localStorage.getItem(storageKey) === 'true') {
      document.documentElement.setAttribute('data-theme', 'high-contrast');
      if (track) track.classList.add('active');
      if (label) label.textContent = 'High Contrast: On';
    }

    toggle.addEventListener('click', () => {
      const on = track.classList.toggle('active');
      document.documentElement[on ? 'setAttribute' : 'removeAttribute']('data-theme', 'high-contrast');
      localStorage.setItem(storageKey, String(on));
      if (label) label.textContent = `High Contrast: ${on ? 'On' : 'Off'}`;
    });
  }

  /* ==========================================================
   *  ADDRESS LOOKUP FORM (with GA4 tracking)
   * ========================================================== */

  function initLookupForm() {
    const form = $('#address-lookup-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#address-input');
      if (!input) return;

      try {
        window.CivicFlow.UI.renderLoading(true);
        const data = await window.CivicFlow.API.lookupAddress(input.value);
        window.CivicFlow.UI.renderResults(data);

        // ── GA4: track the address search event ──
        trackEvent('search', { search_term: 'election_lookup' });
      } catch (err) {
        window.CivicFlow.UI.renderError(err.message || 'Error occurred.');
      }
    });

    // API key panel toggle
    const keyToggle = $('#api-key-toggle'), keyPanel = $('#api-key-panel');
    if (keyToggle && keyPanel) {
      keyToggle.addEventListener('click', () => keyPanel.classList.toggle('hidden'));
    }
  }

  /* ==========================================================
   *  GOOGLE AUTH — Sign In Button
   * ========================================================== */

  /**
   * Wires the header Sign In / Sign Out button to CivicFlow.Auth.
   * The GIS script is lazy-loaded only when the user clicks Sign In.
   */
  function initAuth() {
    const btn = $('#google-signin-btn');
    const label = $('#signin-label');
    if (!btn || !label) return;

    // Listen for auth state changes to update button text
    if (window.CivicFlow.Auth) {
      window.CivicFlow.Auth.onAuthStateChanged((user) => {
        if (user) {
          label.textContent = user.name || 'Signed In';
          btn.setAttribute('aria-label', `Signed in as ${user.email}. Click to sign out.`);
        } else {
          label.textContent = 'Sign In';
          btn.setAttribute('aria-label', 'Sign in with Google to save your election plan');
        }
      });
    }

    btn.addEventListener('click', async () => {
      if (!window.CivicFlow.Auth) return;

      const currentUser = window.CivicFlow.Auth.getUser();
      if (currentUser) {
        // Sign out
        window.CivicFlow.Auth.signOut();
      } else {
        // Sign in — GIS script is lazy-loaded here
        try {
          label.textContent = 'Loading...';
          await window.CivicFlow.Auth.signIn();
        } catch (err) {
          console.warn('[Auth]', err.message);
          label.textContent = 'Sign In';
        }
      }
    });
  }

  /* ==========================================================
   *  NAVIGATION
   * ========================================================== */

  function initNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const t = $(a.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
      });
    });
    const el = $('#footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ==========================================================
   *  BOOTSTRAP
   * ========================================================== */

  function initApp() {
    if (!window.CivicFlow) {
      console.error('[App] CivicFlow namespace not found.');
      return;
    }

    // Render UI components
    if (window.CivicFlow.UI?.renderSteps)  window.CivicFlow.UI.renderSteps();
    if (window.CivicFlow.UI?.renderWizard) window.CivicFlow.UI.renderWizard();

    // Bind event listeners
    initContrast();
    initLookupForm();
    initNavigation();
    initAuth();

    // Configure GA4 with the real tracking ID
    initAnalytics();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initApp)
    : initApp();

  // Expose trackEvent so other modules (e.g. ui.js chat) can fire events
  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Analytics = { trackEvent };
})();
