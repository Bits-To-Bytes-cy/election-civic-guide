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

  console.log(`\n🏁 Test Results: ${passed} Passed, ${failed} Failed`);
})();
