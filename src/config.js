/**
 * @fileoverview Civic Flow — Secure Configuration Module (ES6)
 *
 * @module config
 */

export const CONFIG = Object.freeze({
  BASE_URL: 'https://www.googleapis.com/civicinfo/v2',
  CACHE_TTL_MS: 5 * 60 * 1000,
  RATE_LIMIT_MS: 2000,
  REQUEST_TIMEOUT_MS: 10000,
  MAX_ADDRESS_LENGTH: 200,
  MAX_CACHE_SIZE: 50,
});

function _resolveKey(inputId, envVar, windowKey, serviceName, isObj = false) {
  // 1. UI Input (only for string keys)
  if (!isObj && inputId) {
    const inputEl = document.getElementById(inputId);
    const inputKey = inputEl ? inputEl.value.trim() : '';
    if (inputKey && inputKey.length > 5) return inputKey;
  }

  // 2. process.env
  try {
    if (typeof process !== 'undefined' && process.env && process.env[envVar] && !process.env[envVar].includes('YOUR_')) {
      return isObj ? JSON.parse(process.env[envVar]) : process.env[envVar];
    }
  } catch (_) {}

  // 3. window.__CIVIC_CONFIG__
  if (typeof window.__CIVIC_CONFIG__ === 'object' && window.__CIVIC_CONFIG__[windowKey]) {
    const val = window.__CIVIC_CONFIG__[windowKey];
    if (isObj || (typeof val === 'string' && !val.includes('YOUR_'))) return val;
  }

  throw new Error(`Missing Configuration for ${serviceName}. Please configure it.`);
}

export function getCivicApiKey() { return _resolveKey('civic-api-key-input', 'CIVIC_API_KEY', 'civicApiKey', 'Google Civic Info'); }
export function getMapsApiKey() { return _resolveKey('maps-api-key-input', 'MAPS_API_KEY', 'mapsApiKey', 'Google Maps JS'); }
export function getGeminiApiKey() { return _resolveKey('gemini-api-key-input', 'GEMINI_API_KEY', 'geminiApiKey', 'Google Gemini AI'); }
export function getTranslateApiKey() { return _resolveKey('translate-api-key-input', 'TRANSLATE_API_KEY', 'translateApiKey', 'Google Cloud Translation'); }
export function getGoogleClientId() { return _resolveKey('client-id-input', 'GOOGLE_CLIENT_ID', 'googleClientId', 'Google Auth'); }
export function getGaMeasurementId() { return _resolveKey('', 'GA_MEASUREMENT_ID', 'gaMeasurementId', 'Google Analytics'); }
export function getFirebaseConfig() { return _resolveKey('', 'FIREBASE_CONFIG', 'firebaseConfig', 'Firebase Firestore', true); }

export function isValidKeyFormat(key) {
  return typeof key === 'string' && key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
}
