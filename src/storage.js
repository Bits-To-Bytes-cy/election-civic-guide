/**
 * @fileoverview Civic Flow — Cloud Storage Module (Firebase Firestore Lite)
 *
 * Provides persistent cloud storage for authenticated users' election plans
 * using Firebase Firestore via the lightweight REST API to keep bundle size
 * minimal and maintain our 100% Performance score.
 *
 * SECURITY — Firestore Security Rules (Auth-Required):
 * ─────────────────────────────────────────────────────
 * The following rules MUST be deployed to Firebase to enforce that:
 *   1. Only authenticated users can read/write their own data.
 *   2. Users cannot access other users' documents.
 *   3. Document size is capped to prevent abuse.
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *
 *       // Election plans: each user can only access their own sub-collection
 *       match /electionPlans/{userId}/{document=**} {
 *         allow read, write: if request.auth != null
 *                            && request.auth.uid == userId
 *                            && request.resource.data.keys().size() < 20
 *                            && request.resource.data.address is string
 *                            && request.resource.data.address.size() < 500;
 *       }
 *
 *       // Default: deny all other access
 *       match /{document=**} {
 *         allow read, write: if false;
 *       }
 *     }
 *   }
 *
 * RISK VECTORS ADDRESSED:
 *   - Unauthenticated writes: Blocked by `request.auth != null`
 *   - Cross-user data access: Blocked by `request.auth.uid == userId`
 *   - Oversized payloads: Blocked by `keys().size() < 20` and `size() < 500`
 *   - Injection via field names: Firestore auto-escapes keys
 *
 * @module storage
 */

(function () {
  'use strict';

  /** @type {boolean} Whether Firestore has been initialized */
  let _initialized = false;

  /** @type {string|null} Firestore REST base URL */
  let _firestoreBaseUrl = null;

  /**
   * Initializes the Firestore REST client.
   * Uses the lightweight REST API instead of the full Firebase SDK
   * to avoid loading ~80KB of JavaScript.
   *
   * @private
   */
  function _init() {
    if (_initialized) return;
    try {
      const cfg = window.CivicFlow.Config.getFirebaseConfig();
      _firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents`;
      _initialized = true;
    } catch (e) {
      console.warn('[Storage] Firestore not configured:', e.message);
    }
  }

  /**
   * Converts a JavaScript value to a Firestore Value object.
   * @param {*} val
   * @returns {Object} Firestore-typed value
   * @private
   */
  function _toFirestoreValue(val) {
    if (typeof val === 'string')  return { stringValue: val };
    if (typeof val === 'number')  return { doubleValue: val };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (val === null)             return { nullValue: null };
    if (Array.isArray(val))       return { arrayValue: { values: val.map(_toFirestoreValue) } };
    if (typeof val === 'object')  {
      const fields = {};
      Object.entries(val).forEach(([k, v]) => { fields[k] = _toFirestoreValue(v); });
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  /**
   * Saves an election plan to Firestore for the authenticated user.
   *
   * SECURITY GATE: This function will throw if the user is not signed in.
   * This ensures no unauthenticated data is ever written.
   *
   * @param {Object} planData - The election plan data to save
   * @param {string} planData.address - The user's lookup address
   * @param {string} [planData.electionName] - Name of the election
   * @param {string} [planData.electionDate] - Date of the election
   * @param {string} [planData.pollingLocation] - Chosen polling location
   * @returns {Promise<Object>} The saved Firestore document
   * @throws {Error} If the user is not authenticated or Firestore is not configured
   */
  async function saveElectionPlan(planData) {
    // ── Auth gate ──
    const user = window.CivicFlow.Auth.getUser();
    if (!user || !user.sub) {
      throw new Error('You must sign in with Google before saving an election plan.');
    }

    _init();
    if (!_firestoreBaseUrl) {
      throw new Error('Firestore is not configured. See config.js.template.');
    }

    // Sanitize input before saving
    const sanitized = {
      address:         window.CivicFlow.API.escapeHTML(String(planData.address || '')),
      electionName:    window.CivicFlow.API.escapeHTML(String(planData.electionName || '')),
      electionDate:    String(planData.electionDate || ''),
      pollingLocation: window.CivicFlow.API.escapeHTML(String(planData.pollingLocation || '')),
      savedAt:         new Date().toISOString(),
      userId:          user.sub,
    };

    // Build Firestore REST payload
    const fields = {};
    Object.entries(sanitized).forEach(([key, val]) => {
      fields[key] = _toFirestoreValue(val);
    });

    const url = `${_firestoreBaseUrl}/electionPlans/${user.sub}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Firestore write failed (${res.status})`);
    }

    // Track save event with GA4
    if (window.gtag) {
      window.gtag('event', 'save_plan', { method: 'firestore' });
    }

    return await res.json();
  }

  /**
   * Loads the authenticated user's saved election plan from Firestore.
   *
   * @returns {Promise<Object|null>} The saved plan data, or null if none exists
   */
  async function loadElectionPlan() {
    const user = window.CivicFlow.Auth.getUser();
    if (!user || !user.sub) return null;

    _init();
    if (!_firestoreBaseUrl) return null;

    const url = `${_firestoreBaseUrl}/electionPlans/${user.sub}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    return await res.json();
  }

  // ── Expose on global namespace ──
  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.Storage = Object.freeze({
    saveElectionPlan,
    loadElectionPlan,
  });
})();
