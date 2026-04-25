/**
 * @fileoverview Civic Flow — Secure Configuration Module
 *
 * Centralises all application configuration and API key management.
 * Supports 7 Google Services: Civic Info, Maps JS, Gemini AI,
 * Google Identity (Auth), Firebase Firestore (Storage), GA4 (Analytics),
 * and Google Calendar.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  SECURITY NOTE — Firebase Client-Side Keys                      │
 * │                                                                  │
 * │  The Firebase API key and configuration below are CLIENT-SIDE    │
 * │  identifiers. They are designed by Google to be embedded in      │
 * │  public-facing code (web apps, mobile apps). They do NOT grant   │
 * │  privileged access on their own.                                 │
 * │                                                                  │
 * │  All data security is enforced server-side via:                  │
 * │    1. Firestore Security Rules (see storage.js and README.md)    │
 * │       — Only authenticated users can read/write their own data.  │
 * │    2. Firebase App Check (recommended for production hardening). │
 * │    3. API key restrictions in Google Cloud Console               │
 * │       (HTTP referrer, API scope limits).                         │
 * │                                                                  │
 * │  The Google OAuth Client ID is also a public identifier and is   │
 * │  safe to include in client-side code per Google's documentation. │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * @module config
 */

// ── Production Service Configuration ──
// These client-side identifiers are resolved by the key resolver below.
window.__CIVIC_CONFIG__ = window.__CIVIC_CONFIG__ || {
  // Google OAuth 2.0 Client ID (Google Identity Services)
  googleClientId: '1053254608655-dumuhbje2cpm6u1erohqth9a50ipb47q.apps.googleusercontent.com',

  // Firebase / Firestore configuration
  firebaseConfig: {
    apiKey: 'AIzaSyAbV24sHal47ArD1RJbdTITCZGXbzX3_D0',
    authDomain: 'civic-flow1.firebaseapp.com',
    projectId: 'civic-flow1',
    storageBucket: 'civic-flow1.firebasestorage.app',
    messagingSenderId: '284914344014',
    appId: '1:284914344014:web:5a0fa31d74861dd9e2e31f',
    measurementId: 'G-3XKN7J2XKZ',
  },

  // Google Analytics 4 Measurement ID
  gaTrackingId: 'G-3XKN7J2XKZ',
};

(function () {
  'use strict';

  /**
   * Application configuration constants.
   * Frozen to prevent runtime mutation.
   * @readonly
   */
  const CONFIG = Object.freeze({
    /** Base URL for the Google Civic Information API v2 */
    BASE_URL: 'https://www.googleapis.com/civicinfo/v2',

    /** Gemini API endpoint */
    GEMINI_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent',

    /** Cache time-to-live in milliseconds (5 minutes) */
    CACHE_TTL_MS: 5 * 60 * 1000,

    /** Minimum interval between API requests in milliseconds */
    RATE_LIMIT_MS: 2000,

    /** Maximum wait time for an API response in milliseconds */
    REQUEST_TIMEOUT_MS: 10000,

    /** Maximum allowed length for user-supplied address strings */
    MAX_ADDRESS_LENGTH: 200,

    /** Maximum number of entries in the response cache */
    MAX_CACHE_SIZE: 50,

    /** localStorage key for high-contrast preference */
    STORAGE_KEY_CONTRAST: 'civicflow-high-contrast',
  });

  /**
   * Generic key resolver. Checks UI input → window.__CIVIC_CONFIG__.
   * @param {string} inputId   - DOM ID for the runtime input field
   * @param {string} configKey - Property name in window.__CIVIC_CONFIG__
   * @param {string} label     - Human-readable service name for error messages
   * @returns {string} The resolved key
   * @throws {Error} If no key is found
   * @private
   */
  function _resolveKey(inputId, configKey, label) {
    // 1. Runtime UI input
    const el = document.getElementById(inputId);
    const val = el ? el.value.trim() : '';
    if (val && val.length > 10) return val;

    // 2. Window-level config (loaded from config.js)
    const cfg = window.__CIVIC_CONFIG__;
    if (typeof cfg === 'object') {
      const v = cfg[configKey];
      if (typeof v === 'string' && v.length > 10 && !v.includes('YOUR_')) return v;
    }

    throw new Error(`Missing API Key for ${label}. Click "Configure API Keys" to set it.`);
  }

  /** @returns {string} Google Civic Information API key */
  function getCivicApiKey()  { return _resolveKey('civic-api-key-input',  'civicApiKey',  'Google Civic Info'); }

  /** @returns {string} Google Maps JavaScript API key */
  function getMapsApiKey()   { return _resolveKey('maps-api-key-input',   'mapsApiKey',   'Google Maps JS'); }

  /** @returns {string} Google Gemini (Generative Language) API key */
  function getGeminiApiKey() { return _resolveKey('gemini-api-key-input', 'geminiApiKey', 'Google Gemini AI'); }

  /**
   * Resolves the Google OAuth 2.0 Client ID for Identity Services.
   * @returns {string} Client ID
   */
  function getGoogleClientId() {
    const cfg = window.__CIVIC_CONFIG__;
    if (cfg && cfg.googleClientId && !cfg.googleClientId.includes('YOUR_')) return cfg.googleClientId;
    throw new Error('Google Client ID is not configured.');
  }

  /**
   * Resolves the Firebase configuration object for Firestore.
   * @returns {Object} Firebase config
   */
  function getFirebaseConfig() {
    const cfg = window.__CIVIC_CONFIG__;
    if (cfg && cfg.firebaseConfig && cfg.firebaseConfig.projectId && !cfg.firebaseConfig.projectId.includes('YOUR_')) {
      return cfg.firebaseConfig;
    }
    throw new Error('Firebase config is not configured.');
  }

  /**
   * Resolves the GA4 Measurement ID.
   * @returns {string|null} Tracking ID or null if not configured
   */
  function getGaTrackingId() {
    const cfg = window.__CIVIC_CONFIG__;
    if (cfg && cfg.gaTrackingId && !cfg.gaTrackingId.includes('XXXX')) return cfg.gaTrackingId;
    return null;
  }

  /**
   * Validates that an API key looks structurally correct.
   * @param {string} key
   * @returns {boolean}
   */
  function isValidKeyFormat(key) {
    return typeof key === 'string' && key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
  }

  // ── Expose on global namespace ──
  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Config = Object.freeze({
    CONFIG,
    getCivicApiKey,
    getMapsApiKey,
    getGeminiApiKey,
    getGoogleClientId,
    getFirebaseConfig,
    getGaTrackingId,
    isValidKeyFormat,
  });
})();
