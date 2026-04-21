/**
 * @fileoverview Civic Flow — Secure Configuration Module
 *
 * Centralises all application configuration and API key management.
 * API keys are resolved from (in priority order):
 *   1. Runtime UI input (browser-only, never persisted to disk)
 *   2. process.env.CIVIC_API_KEY (for Node.js / build-tool environments)
 *   3. Window-level override: window.__CIVIC_CONFIG__.apiKey
 *
 * SECURITY: No API key is ever hardcoded. See .env.example for setup.
 *
 * @module config
 */

(function () {
  'use strict';

  /**
   * Application configuration constants.
   * Frozen to prevent runtime mutation.
   * @readonly
   * @enum {string|number}
   */
  const CONFIG = Object.freeze({
    /** Base URL for the Google Civic Information API v2 */
    BASE_URL: 'https://www.googleapis.com/civicinfo/v2',

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

    /** localStorage key prefix for cached API responses */
    STORAGE_KEY_CACHE: 'civicflow-cache',
  });

  /**
   * Resolves the Google Civic Information API key from available sources.
   * Priority: UI input → process.env → window config → error.
   *
   * @returns {string} A valid API key string
   * @throws {Error} If no API key is available from any source
   */
  function getApiKey() {
    // 1. Check UI input field (runtime, browser-only)
    const inputEl = document.getElementById('api-key-input');
    const inputKey = inputEl ? inputEl.value.trim() : '';
    if (inputKey && inputKey.length > 10) {
      return inputKey;
    }

    // 2. Check process.env (available when using a build tool like Vite/Webpack)
    try {
      if (typeof process !== 'undefined' &&
          process.env &&
          process.env.CIVIC_API_KEY &&
          process.env.CIVIC_API_KEY !== 'your_google_civic_api_key_here') {
        return process.env.CIVIC_API_KEY;
      }
    } catch (_) {
      // process is not defined in plain browser environments — expected
    }

    // 3. Check window-level config (for manual injection via <script>)
    if (typeof window.__CIVIC_CONFIG__ === 'object' &&
        window.__CIVIC_CONFIG__.apiKey &&
        window.__CIVIC_CONFIG__.apiKey.length > 10) {
      return window.__CIVIC_CONFIG__.apiKey;
    }

    throw new Error(
      'Please enter your Google Civic Information API key. ' +
      'See .env.example for setup instructions.'
    );
  }

  /**
   * Validates that an API key looks structurally correct.
   * Does NOT verify the key against the API — only checks format.
   *
   * @param {string} key - The API key to validate
   * @returns {boolean} True if the key has a valid format
   */
  function isValidKeyFormat(key) {
    return typeof key === 'string' && key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
  }

  // Expose on global namespace
  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Config = Object.freeze({
    CONFIG,
    getApiKey,
    isValidKeyFormat,
  });
})();
