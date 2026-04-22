/**
 * @fileoverview Civic Flow — Unit tests for core logic
 * 
 * A standalone test file that validates address parsing,
 * API response handling, and Google Calendar link generation.
 * 
 * To run: Open index.html in a browser, then copy/paste this file
 * into the Developer Console, or temporarily add <script src="test.js"></script>
 * to your index.html. Results will be printed to the console.
 */

(function () {
  'use strict';

  // --- Minimal Testing Framework ---
  let passed = 0;
  let failed = 0;

  function describe(name, fn) {
    console.group(`%c ${name} `, 'background: #222; color: #bada55; font-weight: bold;');
    fn();
    console.groupEnd();
  }

  function it(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${name}`);
      console.error(err);
      failed++;
    }
  }

  function expect(actual) {
    return {
      toBe(expected) {
        if (actual !== expected) throw new Error(`Expected ${expected} but received ${actual}`);
      },
      toBeTruthy() {
        if (!actual) throw new Error(`Expected truthy but received ${actual}`);
      },
      toThrow(expectedMsgPart) {
        let threw = false;
        try { actual(); } catch (e) {
          threw = true;
          if (expectedMsgPart && !e.message.includes(expectedMsgPart)) {
            throw new Error(`Expected error containing "${expectedMsgPart}" but got "${e.message}"`);
          }
        }
        if (!threw) throw new Error('Expected function to throw an error, but it did not.');
      }
    };
  }

  // --- Test Suite ---
  const API = window.CivicFlow?.API;
  
  if (!API) {
    console.error('CivicFlow.API not found. Make sure api.js is loaded before running tests.');
    return;
  }

  console.log('🚀 Starting Civic Flow Test Suite...');

  describe('Google Calendar Link Generation', () => {
    it('generates a valid Google Calendar URL for an election', () => {
      const url = API.buildCalendarUrl('General Election', '2026-11-03');
      expect(url.includes('action=TEMPLATE')).toBeTruthy();
      expect(url.includes('text=General+Election')).toBeTruthy();
      expect(url.includes('dates=20261103%2F20261103')).toBeTruthy();
    });

    it('includes the polling location if provided', () => {
      const url = API.buildCalendarUrl('Local Election', '2025-05-01', '123 Main St');
      expect(url.includes('location=123+Main+St')).toBeTruthy();
    });

    it('returns "#" if the date is missing', () => {
      const url = API.buildCalendarUrl('Unknown Election', '');
      expect(url).toBe('#');
    });
  });

  describe('Address Sanitisation & Validation', () => {
    it('cleans up whitespace and HTML tags', () => {
      const clean = API.sanitizeAddress('  <b>123</b>   Main St  ');
      expect(clean).toBe('123 Main St');
    });

    it('throws an error for empty input', () => {
      expect(() => API.sanitizeAddress('   ')).toThrow('valid address');
    });

    it('gracefully handles invalid zip codes without crashing', () => {
      expect(() => API.sanitizeAddress('90210')).toThrow('Please enter a complete street address');
    });
  });

  describe('Address-to-Election-Data Mapping (Response Parsing)', () => {
    it('gracefully handles empty API responses', () => {
      const parsed = API.parseVoterInfo({});
      expect(parsed.election).toBe(null);
      expect(parsed.pollingLocations.length).toBe(0);
    });

    it('correctly maps election details', () => {
      const raw = { election: { name: 'State Primary', electionDay: '2024-08-15' } };
      const parsed = API.parseVoterInfo(raw);
      expect(parsed.election.name).toBe('State Primary');
      expect(parsed.election.date).toBe('2024-08-15');
    });

    it('escapes malicious HTML in API responses to prevent XSS', () => {
      const raw = { election: { name: '<script>alert("hacked")</script> Bad Election' } };
      const parsed = API.parseVoterInfo(raw);
      expect(parsed.election.name.includes('<script>')).toBe(false);
    });
  });

  describe('Gemini AI Chat Integration', () => {
    it('successfully parses a Gemini API response', async () => {
      // Mock the global fetch
      const originalFetch = window.fetch;
      window.fetch = async (url, options) => {
        if (url.includes('gemini-3-flash:generateContent')) {
          return {
            ok: true,
            json: async () => ({
              candidates: [{ content: { parts: [{ text: "Mocked AI Response" }] } }]
            })
          };
        }
        return originalFetch(url, options);
      };

      try {
        // Stub the Config to return a fake key for testing
        const originalGetKey = window.CivicFlow.Config.getGeminiApiKey;
        window.CivicFlow.Config.getGeminiApiKey = () => 'FAKE_TEST_KEY';
        
        const response = await API.askGemini('What is voting?');
        expect(response).toBe('Mocked AI Response');

        // Restore stubs
        window.CivicFlow.Config.getGeminiApiKey = originalGetKey;
      } finally {
        window.fetch = originalFetch;
      }
    });

    it('throws an error when Gemini API fails', async () => {
      const originalFetch = window.fetch;
      window.fetch = async (url) => {
        if (url.includes('gemini-3-flash')) {
          return { ok: false, status: 500 };
        }
        return originalFetch(url);
      };

      try {
        const originalGetKey = window.CivicFlow.Config.getGeminiApiKey;
        window.CivicFlow.Config.getGeminiApiKey = () => 'FAKE_TEST_KEY';
        
        let threw = false;
        try {
          await API.askGemini('Hello?');
        } catch (e) {
          threw = true;
          expect(e.message.includes('500')).toBeTruthy();
        }
        expect(threw).toBe(true);

        window.CivicFlow.Config.getGeminiApiKey = originalGetKey;
      } finally {
        window.fetch = originalFetch;
      }
    });
  });

  describe('Google Maps JS API Loading', () => {
    it('does not crash if Maps API fails to load', async () => {
      const originalGetKey = window.CivicFlow.Config.getMapsApiKey;
      window.CivicFlow.Config.getMapsApiKey = () => 'FAKE_KEY';
      
      // Override document.createElement to simulate a script error
      const originalCreate = document.createElement;
      document.createElement = (tagName) => {
        if (tagName === 'script') {
          const script = originalCreate.call(document, 'script');
          // Simulate immediate failure
          setTimeout(() => { if (script.onerror) script.onerror(new Error('Network error')); }, 10);
          return script;
        }
        return originalCreate.call(document, tagName);
      };

      let threw = false;
      try {
        await API.loadGoogleMaps();
      } catch (e) {
        threw = true;
      }
      expect(threw).toBe(true);

      document.createElement = originalCreate;
      window.CivicFlow.Config.getMapsApiKey = originalGetKey;
    });
  });

  // Delay the final result print slightly because we used async tests
  setTimeout(() => {
    console.log(`\n🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  }, 100);
})();
