/**
 * @fileoverview Civic Flow — Unit tests for core logic
 */

(function () {
  'use strict';

  // Wait for DOM to ensure modules are loaded
  document.addEventListener('DOMContentLoaded', () => {
    const API = window.CivicFlow.API;
    const Config = window.CivicFlow.Config;

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

      it('gracefully handles invalid zip codes / non-address input without crashing', () => {
        // Just a zip code without a street address violates the validation regex
        // because we want a full street address. The application should throw a managed error,
        // rather than crashing silently.
        expect(() => API.sanitizeAddress('90210')).toThrow('Please enter a complete street address');
        expect(() => API.sanitizeAddress('No numbers here')).toThrow('complete street address');
      });
      
      it('throws an error if input is too long', () => {
        const longStr = '123 Main St ' + 'A'.repeat(250);
        expect(() => API.sanitizeAddress(longStr)).toThrow('characters');
      });
    });

    describe('Address-to-Election-Data Mapping (Response Parsing)', () => {
      it('gracefully handles empty or malformed API responses', () => {
        const parsed = API.parseVoterInfo({});
        expect(parsed.election).toBe(null);
        expect(parsed.pollingLocations.length).toBe(0);
        expect(parsed.earlyVoteSites.length).toBe(0);
      });

      it('correctly maps election details', () => {
        const raw = {
          election: {
            id: '2000',
            name: 'State Primary',
            electionDay: '2024-08-15',
            ocdDivisionId: 'ocd-division/country:us/state:ny'
          }
        };
        const parsed = API.parseVoterInfo(raw);
        expect(parsed.election.name).toBe('State Primary');
        expect(parsed.election.date).toBe('2024-08-15');
      });

      it('correctly maps polling locations, merging address fields', () => {
        const raw = {
          pollingLocations: [
            {
              address: {
                locationName: 'Community Center',
                line1: '100 Main St',
                city: 'Springfield',
                state: 'IL',
                zip: '62701'
              },
              pollingHours: '7 AM - 7 PM'
            }
          ]
        };
        const parsed = API.parseVoterInfo(raw);
        expect(parsed.pollingLocations.length).toBe(1);
        const loc = parsed.pollingLocations[0];
        
        expect(loc.name).toBe('Community Center');
        expect(loc.address).toBe('100 Main St, Springfield, IL, 62701');
        expect(loc.hours).toBe('7 AM - 7 PM');
        // Check Maps URL formatting
        expect(loc.mapsUrl.includes('100%20Main%20St')).toBeTruthy();
      });
      
      it('escapes malicious HTML in API responses to prevent XSS', () => {
        const raw = {
          election: {
            id: '123',
            name: '<script>alert("hacked")</script> Bad Election'
          }
        };
        const parsed = API.parseVoterInfo(raw);
        // The escapeHTML function converts < to &lt; (or similar mechanisms built via textNode)
        expect(parsed.election.name.includes('<script>')).toBe(false);
      });
    });

    // Run tests and render output
    window.TestRunner.render('test-results-container');
  });
})();
