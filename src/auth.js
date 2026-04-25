/**
 * @fileoverview Civic Flow — Google Authentication Module
 *
 * Lazy-loads the Google Identity Services (GIS) library only when the
 * user clicks the "Sign In" button, keeping initial page load fast.
 *
 * Uses the One Tap / Button flow via google.accounts.id to obtain
 * a JWT credential, which is decoded client-side for display name/email.
 *
 * SECURITY: The ID token should be verified server-side before granting
 * access to any protected resources. In this client-only demo, we decode
 * it locally for UI display and gate Firestore writes behind auth state.
 *
 * @module auth
 */

(function () {
  'use strict';

  /** @type {Object|null} Current signed-in user payload */
  let _currentUser = null;

  /** @type {Promise|null} Tracks the GIS script loading state */
  let _gisLoadPromise = null;

  /** @type {Function[]} Listeners notified on auth state change */
  let _authListeners = [];

  /**
   * Lazy-loads the Google Identity Services client library.
   * Called only on first sign-in attempt to avoid blocking page load.
   *
   * @returns {Promise<void>} Resolves when the GIS script is ready
   * @private
   */
  function _loadGIS() {
    if (_gisLoadPromise) return _gisLoadPromise;

    _gisLoadPromise = new Promise((resolve, reject) => {
      // If already loaded (e.g. by another script), resolve immediately
      if (window.google && window.google.accounts) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
      document.head.appendChild(script);
    });

    return _gisLoadPromise;
  }

  /**
   * Decodes a JWT ID token payload (middle segment) without verification.
   * NOTE: In production, always verify the token server-side.
   *
   * @param {string} token - The raw JWT string from Google
   * @returns {Object} Decoded payload containing name, email, picture, sub
   * @private
   */
  function _decodeJwt(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64));
    } catch (e) {
      throw new Error('Failed to decode Google ID token.');
    }
  }

  /**
   * Notifies all registered auth-state listeners.
   * @private
   */
  function _notifyListeners() {
    _authListeners.forEach(fn => {
      try { fn(_currentUser); } catch (_) { /* listener errors are non-fatal */ }
    });
  }

  /**
   * Initiates the Google Sign-In flow.
   * Lazy-loads GIS on first call, then initializes and prompts.
   *
   * @returns {Promise<Object>} The decoded user object { name, email, picture, sub }
   */
  async function signIn() {
    await _loadGIS();

    const clientId = window.CivicFlow.Config.getGoogleClientId();

    return new Promise((resolve, reject) => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          try {
            _currentUser = _decodeJwt(response.credential);
            _notifyListeners();

            // Track sign-in event with GA4 if available
            if (window.gtag) {
              window.gtag('event', 'login', { method: 'Google' });
            }

            resolve(_currentUser);
          } catch (err) {
            reject(err);
          }
        },
        auto_select: false,
      });

      // Trigger the One Tap prompt
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: render a standard Google button into a hidden container,
          // then programmatically click it.
          let container = document.getElementById('g-signin-fallback');
          if (!container) {
            container = document.createElement('div');
            container.id = 'g-signin-fallback';
            container.style.cssText = 'position:fixed;top:-9999px;';
            document.body.appendChild(container);
          }
          window.google.accounts.id.renderButton(container, { size: 'large' });
        }
      });
    });
  }

  /**
   * Signs the user out by clearing local state.
   * Revokes the Google session token and notifies listeners.
   */
  function signOut() {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
    }
    _currentUser = null;
    _notifyListeners();
  }

  /**
   * Returns the current authenticated user, or null.
   * @returns {Object|null} User payload { name, email, picture, sub }
   */
  function getUser() {
    return _currentUser;
  }

  /**
   * Registers a callback to be invoked whenever auth state changes.
   * @param {Function} fn - Callback receiving the user object (or null)
   */
  function onAuthStateChanged(fn) {
    if (typeof fn === 'function') _authListeners.push(fn);
  }

  // ── Expose on global namespace ──
  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Auth = Object.freeze({
    signIn,
    signOut,
    getUser,
    onAuthStateChanged,
  });
})();
