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
   * Helper to resolve an API key from available sources.
   * Priority: UI input -> process.env -> window config.
   *
   * @param {string} inputId - DOM ID of the input field
   * @param {string} envVar - Name of the environment variable
   * @param {string} windowKey - Key name in window.__CIVIC_CONFIG__
   * @returns {string} The resolved API key
   * @throws {Error} If no key is found
   */
  function _resolveKey(inputId, envVar, windowKey, serviceName) {
    const inputEl = document.getElementById(inputId);
    const inputKey = inputEl ? inputEl.value.trim() : '';
    if (inputKey && inputKey.length > 10) return inputKey;

    try {
      if (typeof process !== 'undefined' && process.env && process.env[envVar] && !process.env[envVar].includes('YOUR_')) {
        return process.env[envVar];
      }
    } catch (_) {}

    if (typeof window.__CIVIC_CONFIG__ === 'object' && window.__CIVIC_CONFIG__[windowKey] && !window.__CIVIC_CONFIG__[windowKey].includes('YOUR_')) {
      return window.__CIVIC_CONFIG__[windowKey];
    }

    throw new Error(`Missing API Key for ${serviceName}. Please configure it.`);
  }

  function getCivicApiKey() { return _resolveKey('civic-api-key-input', 'CIVIC_API_KEY', 'civicApiKey', 'Google Civic Info'); }
  function getMapsApiKey() { return _resolveKey('maps-api-key-input', 'MAPS_API_KEY', 'mapsApiKey', 'Google Maps JS'); }
  function getGeminiApiKey() { return _resolveKey('gemini-api-key-input', 'GEMINI_API_KEY', 'geminiApiKey', 'Google Gemini AI'); }

  function isValidKeyFormat(key) {
    return typeof key === 'string' && key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
  }

  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Config = Object.freeze({
    CONFIG,
    getCivicApiKey,
    getMapsApiKey,
    getGeminiApiKey,
    isValidKeyFormat,
  });
})();
