/**
 * @fileoverview Civic Flow — Comprehensive Unit Test Suite
 *
 * Validates core logic, Google service integrations, and error handling.
 * All tests run in-browser with zero dependencies and zero network calls.
 * Mock implementations are provided for google.accounts.id (Auth),
 * Firestore REST (Storage), Gemini API, and Maps JS API.
 *
 * To run: Add <script src="test.js"></script> to index.html, then
 * open the browser Developer Console (F12) to see results.
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  //  MINIMAL TEST FRAMEWORK
  // ══════════════════════════════════════════════════════════

  let passed = 0;
  let failed = 0;
  const asyncQueue = [];

  function describe(name, fn) {
    console.group(`%c ${name} `, 'background:#1e1b4b;color:#a5b4fc;font-weight:bold;padding:2px 6px;border-radius:4px;');
    fn();
    console.groupEnd();
  }

  function it(name, fn) {
    const result = fn();
    if (result && typeof result.then === 'function') {
      // Async test — queue it
      asyncQueue.push(result.then(() => {
        console.log(`  ✅ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ❌ ${name}`);
        console.error('    ', err.message || err);
        failed++;
      }));
    } else {
      // Sync test — already completed
    }
  }

  // Sync test helper
  function syncTest(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}`);
      console.error('    ', err.message || err);
      failed++;
    }
  }

  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) throw new Error(`Expected «${expected}» but got «${actual}»`);
      },
      toBeTruthy() {
        if (!actual) throw new Error(`Expected truthy but got «${actual}»`);
      },
      toBeFalsy() {
        if (actual) throw new Error(`Expected falsy but got «${actual}»`);
      },
      toThrow(msgPart) {
        let threw = false;
        try { actual(); } catch (e) {
          threw = true;
          if (msgPart && !e.message.includes(msgPart)) {
            throw new Error(`Expected error containing "${msgPart}" but got "${e.message}"`);
          }
        }
        if (!threw) throw new Error('Expected function to throw but it did not.');
      }
    };
  }

  // ══════════════════════════════════════════════════════════
  //  GUARD
  // ══════════════════════════════════════════════════════════

  const API = window.CivicFlow?.API;
  if (!API) {
    console.error('CivicFlow.API not found. Ensure api.js loads before test.js.');
    return;
  }

  console.log('%c🚀 Civic Flow Test Suite v3.0', 'font-size:14px;font-weight:bold;color:#22d3ee;');
  console.log('Testing: Calendar, Address, Parsing, Gemini, Maps, Auth, Storage, Analytics\n');

  // ══════════════════════════════════════════════════════════
  //  1. GOOGLE CALENDAR LINK GENERATION
  // ══════════════════════════════════════════════════════════

  describe('Google Calendar Link Generation', () => {
    syncTest('generates a valid Google Calendar URL', () => {
      const url = API.buildCalendarUrl('General Election', '2026-11-03');
      expect(url.includes('action=TEMPLATE')).toBeTruthy();
      expect(url.includes('text=General+Election')).toBeTruthy();
      expect(url.includes('dates=20261103')).toBeTruthy();
    });

    syncTest('includes polling location if provided', () => {
      const url = API.buildCalendarUrl('Local Election', '2025-05-01', '123 Main St');
      expect(url.includes('location=123+Main+St')).toBeTruthy();
    });

    syncTest('returns "#" if date is missing', () => {
      expect(API.buildCalendarUrl('Unknown', '')).toBe('#');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  2. ADDRESS SANITISATION & VALIDATION
  // ══════════════════════════════════════════════════════════

  describe('Address Sanitisation & Validation', () => {
    syncTest('strips HTML tags and collapses whitespace', () => {
      expect(API.sanitizeAddress('  <b>123</b>   Main St  ')).toBe('123 Main St');
    });

    syncTest('throws for empty input', () => {
      expect(() => API.sanitizeAddress('   ')).toThrow('valid address');
    });

    syncTest('rejects zip-code-only input gracefully', () => {
      expect(() => API.sanitizeAddress('90210')).toThrow('complete street address');
    });
  });

  // ══════════════════════════════════════════════════════════
  //  3. CIVIC INFO RESPONSE PARSING
  // ══════════════════════════════════════════════════════════

  describe('Civic Info Response Parsing', () => {
    syncTest('handles empty API responses', () => {
      const parsed = API.parseVoterInfo({});
      expect(parsed.election).toBe(null);
      expect(parsed.pollingLocations.length).toBe(0);
    });

    syncTest('maps election details correctly', () => {
      const parsed = API.parseVoterInfo({ election: { name: 'State Primary', electionDay: '2024-08-15' } });
      expect(parsed.election.name).toBe('State Primary');
      expect(parsed.election.date).toBe('2024-08-15');
    });

    syncTest('escapes XSS in API responses', () => {
      const parsed = API.parseVoterInfo({ election: { name: '<script>alert(1)</script> Bad' } });
      expect(parsed.election.name.includes('<script>')).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  4. GEMINI AI — MOCK FETCH
  // ══════════════════════════════════════════════════════════

  describe('Gemini AI Integration (Mocked)', () => {
    it('parses a successful Gemini response', async () => {
      const origFetch = window.fetch;
      const origKey = window.CivicFlow.Config.getGeminiApiKey;
      window.CivicFlow.Config.getGeminiApiKey = () => 'MOCK_GEMINI_KEY_12345678';
      window.fetch = async (url) => {
        if (url.includes('gemini-3-flash')) {
          return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Mock answer' }] } }] }) };
        }
        return origFetch(url);
      };
      try {
        const reply = await API.askGemini('What is voting?');
        expect(reply).toBe('Mock answer');
      } finally {
        window.fetch = origFetch;
        window.CivicFlow.Config.getGeminiApiKey = origKey;
      }
    });

    it('throws on Gemini API failure (500)', async () => {
      const origFetch = window.fetch;
      const origKey = window.CivicFlow.Config.getGeminiApiKey;
      window.CivicFlow.Config.getGeminiApiKey = () => 'MOCK_GEMINI_KEY_12345678';
      window.fetch = async (url) => {
        if (url.includes('gemini-3-flash')) return { ok: false, status: 500 };
        return origFetch(url);
      };
      let threw = false;
      try { await API.askGemini('test'); } catch (e) { threw = true; expect(e.message.includes('500')).toBeTruthy(); }
      expect(threw).toBe(true);
      window.fetch = origFetch;
      window.CivicFlow.Config.getGeminiApiKey = origKey;
    });
  });

  // ══════════════════════════════════════════════════════════
  //  5. GOOGLE MAPS JS — MOCK LOADER
  // ══════════════════════════════════════════════════════════

  describe('Google Maps JS API (Mocked)', () => {
    it('handles Maps script load failure gracefully', async () => {
      const origKey = window.CivicFlow.Config.getMapsApiKey;
      window.CivicFlow.Config.getMapsApiKey = () => 'MOCK_MAPS_KEY_123456789';
      const origCreate = document.createElement.bind(document);
      document.createElement = (tag) => {
        const el = origCreate(tag);
        if (tag === 'script') {
          setTimeout(() => { if (el.onerror) el.onerror(new Error('Network error')); }, 10);
        }
        return el;
      };
      let threw = false;
      try { await API.loadGoogleMaps(); } catch (e) { threw = true; }
      expect(threw).toBe(true);
      document.createElement = origCreate;
      window.CivicFlow.Config.getMapsApiKey = origKey;
    });
  });

  // ══════════════════════════════════════════════════════════
  //  6. GOOGLE AUTH — MOCK google.accounts.id
  // ══════════════════════════════════════════════════════════

  describe('Google Auth Module (Mocked)', () => {
    it('signIn resolves with decoded user after GIS callback', async () => {
      if (!window.CivicFlow.Auth) { console.warn('  ⚠️  Auth module not loaded, skipping.'); return; }

      const origClientId = window.CivicFlow.Config.getGoogleClientId;
      window.CivicFlow.Config.getGoogleClientId = () => 'MOCK_CLIENT_ID.apps.googleusercontent.com';

      // Build a fake JWT (header.payload.signature)
      const fakePayload = { sub: '12345', name: 'Test User', email: 'test@example.com' };
      const fakeJwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.' +
                      btoa(JSON.stringify(fakePayload)) + '.fakesig';

      // Mock the GIS library
      const origGoogle = window.google;
      window.google = {
        accounts: {
          id: {
            initialize: (opts) => { opts._storedCallback = opts.callback; },
            prompt: (notif) => {
              // Simulate successful credential response
              const opts = window.google.accounts.id._lastOpts;
              if (opts && opts._storedCallback) {
                opts._storedCallback({ credential: fakeJwt });
              }
            },
            disableAutoSelect: () => {},
            renderButton: () => {},
            _lastOpts: null,
          }
        }
      };
      // Patch initialize to store opts for prompt to use
      const origInit = window.google.accounts.id.initialize;
      window.google.accounts.id.initialize = (opts) => {
        window.google.accounts.id._lastOpts = opts;
        origInit(opts);
      };

      // Trigger sign in
      try {
        const user = await window.CivicFlow.Auth.signIn();
        expect(user.name).toBe('Test User');
        expect(user.email).toBe('test@example.com');
        expect(window.CivicFlow.Auth.getUser()).toBeTruthy();
      } finally {
        window.CivicFlow.Auth.signOut();
        window.google = origGoogle;
        window.CivicFlow.Config.getGoogleClientId = origClientId;
      }
    });

    syncTest('getUser returns null when not signed in', () => {
      if (!window.CivicFlow.Auth) return;
      expect(window.CivicFlow.Auth.getUser()).toBe(null);
    });
  });

  // ══════════════════════════════════════════════════════════
  //  7. FIRESTORE STORAGE — MOCK saveElectionPlan
  // ══════════════════════════════════════════════════════════

  describe('Cloud Storage / Firestore (Mocked)', () => {
    it('saveElectionPlan throws when user is not authenticated', async () => {
      if (!window.CivicFlow.Storage) { console.warn('  ⚠️  Storage module not loaded, skipping.'); return; }

      let threw = false;
      try {
        await window.CivicFlow.Storage.saveElectionPlan({ address: '123 Main St' });
      } catch (e) {
        threw = true;
        expect(e.message.includes('sign in')).toBeTruthy();
      }
      expect(threw).toBe(true);
    });

    it('saveElectionPlan succeeds with mocked auth and fetch', async () => {
      if (!window.CivicFlow.Storage || !window.CivicFlow.Auth) return;

      // Mock authenticated user
      const origGetUser = window.CivicFlow.Auth.getUser;
      window.CivicFlow.Auth.getUser = () => ({ sub: 'test123', name: 'Tester', email: 'x@x.com' });

      // Mock Firebase config
      const origGetFb = window.CivicFlow.Config.getFirebaseConfig;
      window.CivicFlow.Config.getFirebaseConfig = () => ({ projectId: 'mock-project', apiKey: 'x', authDomain: 'x' });

      // Mock fetch for Firestore REST
      const origFetch = window.fetch;
      window.fetch = async (url, opts) => {
        if (url.includes('firestore.googleapis.com')) {
          return { ok: true, json: async () => ({ name: 'mock-doc', fields: {} }) };
        }
        return origFetch(url, opts);
      };

      try {
        const result = await window.CivicFlow.Storage.saveElectionPlan({
          address: '1600 Pennsylvania Ave',
          electionName: 'General Election',
          electionDate: '2026-11-03'
        });
        expect(result.name).toBe('mock-doc');
      } finally {
        window.CivicFlow.Auth.getUser = origGetUser;
        window.CivicFlow.Config.getFirebaseConfig = origGetFb;
        window.fetch = origFetch;
      }
    });
  });

  // ══════════════════════════════════════════════════════════
  //  8. GA4 ANALYTICS — MOCK gtag
  // ══════════════════════════════════════════════════════════

  describe('GA4 Analytics (Mocked)', () => {
    syncTest('trackEvent calls gtag with correct params', () => {
      if (!window.CivicFlow.Analytics) return;
      const calls = [];
      const origGtag = window.gtag;
      window.gtag = (...args) => calls.push(args);

      window.CivicFlow.Analytics.trackEvent('search', { search_term: 'test' });

      expect(calls.length).toBe(1);
      expect(calls[0][0]).toBe('event');
      expect(calls[0][1]).toBe('search');
      expect(calls[0][2].search_term).toBe('test');

      window.gtag = origGtag;
    });

    syncTest('trackEvent does not throw if gtag is undefined', () => {
      if (!window.CivicFlow.Analytics) return;
      const origGtag = window.gtag;
      window.gtag = undefined;
      // Should silently no-op, not crash
      window.CivicFlow.Analytics.trackEvent('test_event', {});
      window.gtag = origGtag;
    });
  });

  // ══════════════════════════════════════════════════════════
  //  RESULTS — wait for all async tests to complete
  // ══════════════════════════════════════════════════════════

  Promise.all(asyncQueue).finally(() => {
    const total = passed + failed;
    const color = failed === 0 ? '#22c55e' : '#ef4444';
    console.log(`\n%c🏁 Test Results: ${passed}/${total} Passed, ${failed} Failed`,
      `font-size:13px;font-weight:bold;color:${color};`);
  });
})();
