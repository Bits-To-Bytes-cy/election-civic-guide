/**
 * @fileoverview Civic Flow — API Handler Module
 *
 * Encapsulates all communication with the Google Civic Information API.
 * Responsibilities: input sanitisation, HTTP requests with timeouts and
 * abort controllers, response parsing, caching, rate limiting, and
 * URL builders for Google Calendar / Google Maps.
 *
 * @module apiHandler
 */

(function () {
  'use strict';

  /* ========== Module-level state ========== */

  /** @type {Map<string, {data: Object, timestamp: number}>} */
  let _cache = new Map();

  /** @type {number} Timestamp of the last outbound request */
  let _lastRequestTime = 0;

  /** @type {AbortController|null} Controller for the current in-flight request */
  let _abortController = null;

  /* ===== Shorthand config access ===== */

  /**
   * Returns the frozen CONFIG object from the config module.
   * @returns {Object}
   */
  function cfg() {
    return window.CivicFlow.Config.CONFIG;
  }

  /* ==========================================================
   *  SECURITY — Input Sanitisation
   * ========================================================== */

  /**
   * Sanitises and validates a user-provided address string.
   * Strips HTML/script tags, removes control characters,
   * collapses whitespace, enforces max length, and checks
   * for a plausible street-address pattern.
   *
   * @param {string} raw - Raw user input from the address field
   * @returns {string} Cleaned and validated address
   * @throws {Error} If the input is empty, too long, or malformed
   */
  function sanitizeAddress(raw) {
    if (typeof raw !== 'string') {
      throw new Error('Address must be a string.');
    }

    let clean = raw.replace(/<[^>]*>/g, '');       // strip HTML tags
    clean = clean.replace(/[\x00-\x1F\x7F]/g, ''); // remove control chars
    clean = clean.replace(/\s+/g, ' ').trim();      // collapse whitespace

    if (clean.length === 0) {
      throw new Error('Please enter a valid address.');
    }
    if (clean.length > cfg().MAX_ADDRESS_LENGTH) {
      throw new Error(
        `Address must be under ${cfg().MAX_ADDRESS_LENGTH} characters.`
      );
    }
    if (!/[a-zA-Z]/.test(clean) || !/\d/.test(clean)) {
      throw new Error(
        'Please enter a complete street address ' +
        '(e.g. "1600 Pennsylvania Ave NW, Washington, DC 20500").'
      );
    }

    return clean;
  }

  /**
   * Escapes a string for safe insertion into innerHTML.
   * Creates a text node to leverage the browser's built-in encoding.
   *
   * @param {string} str - Untrusted string
   * @returns {string} HTML-safe string
   */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ==========================================================
   *  EFFICIENCY — Caching
   * ========================================================== */

  /**
   * Derives a normalised cache key from an address string.
   *
   * @param {string} address - Sanitised address
   * @returns {string} Cache key
   */
  function getCacheKey(address) {
    return 'civic_' + address.toLowerCase().replace(/\s+/g, '_');
  }

  /**
   * Retrieves a cached response if it exists and has not expired.
   *
   * @param {string} key - Cache key from {@link getCacheKey}
   * @returns {Object|null} Cached data or null
   */
  function getFromCache(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > cfg().CACHE_TTL_MS) {
      _cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Stores a response in the cache. Evicts the oldest entry
   * if the cache exceeds {@link CONFIG.MAX_CACHE_SIZE}.
   *
   * @param {string} key  - Cache key
   * @param {Object} data - Parsed API response to store
   */
  function setCache(key, data) {
    if (_cache.size >= cfg().MAX_CACHE_SIZE) {
      const oldest = _cache.keys().next().value;
      _cache.delete(oldest);
    }
    _cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clears all entries from the response cache.
   */
  function clearCache() {
    _cache.clear();
  }

  /* ==========================================================
   *  EFFICIENCY — Rate Limiting
   * ========================================================== */

  /**
   * Enforces a minimum interval between consecutive API requests.
   * Throws a user-friendly error if the caller is requesting too fast.
   *
   * @throws {Error} If called within {@link CONFIG.RATE_LIMIT_MS} of the last request
   */
  function enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed < cfg().RATE_LIMIT_MS) {
      const wait = Math.ceil((cfg().RATE_LIMIT_MS - elapsed) / 1000);
      throw new Error(`Please wait ${wait}s before searching again.`);
    }
    _lastRequestTime = now;
  }

  /* ==========================================================
   *  CORE — API Requests
   * ========================================================== */

  /**
   * Fetches voter information from the Google Civic Information API.
   * Automatically cancels any in-flight request and applies a timeout.
   *
   * @param {string} address - Sanitised address string
   * @returns {Promise<Object>} Raw JSON response from the API
   * @throws {Error} On network failure, timeout, or HTTP error
   */
  async function fetchVoterInfo(address) {
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    const apiKey = window.CivicFlow.Config.getApiKey();
    const params = new URLSearchParams({
      key: apiKey,
      address: address,
      electionId: '',
    });
    const url = `${cfg().BASE_URL}/voterinfo?${params.toString()}`;

    const timeoutId = setTimeout(
      () => _abortController.abort(),
      cfg().REQUEST_TIMEOUT_MS
    );

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: _abortController.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        await _handleHttpError(res);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw err;
    } finally {
      _abortController = null;
    }
  }

  /**
   * Fetches the list of available elections.
   *
   * @returns {Promise<Object>} JSON containing an `elections` array
   * @throws {Error} On network failure, timeout, or HTTP error
   */
  async function fetchElections() {
    const apiKey = window.CivicFlow.Config.getApiKey();
    const url = `${cfg().BASE_URL}/elections?key=${encodeURIComponent(apiKey)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      cfg().REQUEST_TIMEOUT_MS
    );

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Failed to fetch elections (${res.status})`);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Request timed out.');
      throw err;
    }
  }

  /**
   * Translates HTTP error status codes into user-friendly messages.
   *
   * @param {Response} res - The fetch Response object
   * @throws {Error} Always throws with a descriptive message
   * @private
   */
  async function _handleHttpError(res) {
    const body = await res.json().catch(() => ({}));
    const fallback = body?.error?.message || `API error (${res.status})`;

    const messages = {
      400: 'No election info found for this address. There may not be an upcoming election in your area.',
      403: 'API key is invalid or has exceeded its quota. Please check your configuration.',
      429: 'Too many requests. Please try again in a few minutes.',
    };
    throw new Error(messages[res.status] || fallback);
  }

  /* ==========================================================
   *  DATA — Response Parsing
   * ========================================================== */

  /**
   * Parses the raw Civic Info API response into a clean,
   * UI-ready data structure.
   *
   * @param {Object} raw - Raw API JSON response
   * @returns {{
   *   election: {name:string, date:string, ocdId:string}|null,
   *   pollingLocations: Array<Object>,
   *   earlyVoteSites: Array<Object>,
   *   dropOffLocations: Array<Object>
   * }} Parsed voter information
   */
  function parseVoterInfo(raw) {
    const result = {
      election: null,
      pollingLocations: [],
      earlyVoteSites: [],
      dropOffLocations: [],
    };

    if (raw.election && raw.election.id !== '0') {
      result.election = {
        name: escapeHTML(raw.election.name || 'Upcoming Election'),
        date: raw.election.electionDay || '',
        ocdId: raw.election.ocdDivisionId || '',
      };
    }

    if (Array.isArray(raw.pollingLocations)) {
      result.pollingLocations = raw.pollingLocations.map(_parseLocation);
    }
    if (Array.isArray(raw.earlyVoteSites)) {
      result.earlyVoteSites = raw.earlyVoteSites.map(_parseLocation);
    }
    if (Array.isArray(raw.dropOffLocations)) {
      result.dropOffLocations = raw.dropOffLocations.map(_parseLocation);
    }

    return result;
  }

  /**
   * Normalises a single polling location object from the API.
   *
   * @param {Object} loc - Raw location object from the API
   * @returns {{name:string, address:string, hours:string, notes:string, mapsUrl:string}}
   * @private
   */
  function _parseLocation(loc) {
    const addr = loc.address || {};
    const full = [addr.line1, addr.line2, addr.line3, addr.city, addr.state, addr.zip]
      .filter(Boolean)
      .join(', ');
    return {
      name: escapeHTML(addr.locationName || 'Polling Location'),
      address: escapeHTML(full),
      hours: escapeHTML(loc.pollingHours || 'Contact local election office for hours'),
      notes: escapeHTML(loc.notes || ''),
      mapsUrl: buildMapsUrl(full),
    };
  }

  /* ==========================================================
   *  URL BUILDERS — Google Maps & Calendar
   * ========================================================== */

  /**
   * Builds a Google Maps search URL for a given address.
   *
   * @param {string} address - Street address to search
   * @returns {string} Full Google Maps URL
   */
  function buildMapsUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  /**
   * Builds a Google Calendar "add event" URL for an election date.
   *
   * @param {string} electionName - Display name of the election
   * @param {string} dateStr      - Election date in YYYY-MM-DD format
   * @param {string} [location]   - Optional location for the calendar event
   * @returns {string} Google Calendar URL (or '#' if dateStr is missing)
   */
  function buildCalendarUrl(electionName, dateStr, location) {
    if (!dateStr) return '#';
    const d = dateStr.replace(/-/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: electionName || 'Election Day',
      dates: `${d}/${d}`,
      details: `Reminder: ${electionName}. Make sure to vote!\n\nPowered by Civic Flow`,
    });
    if (location) params.set('location', location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /* ==========================================================
   *  ORCHESTRATION — Main Lookup
   * ========================================================== */

  /**
   * Primary entry point for address lookups. Validates input,
   * checks cache, enforces rate limits, fetches data, caches
   * the result, and returns parsed voter information.
   *
   * @param {string} rawAddress - Raw user input from the form
   * @returns {Promise<Object>} Parsed voter info (see {@link parseVoterInfo})
   * @throws {Error} On validation, rate-limit, network, or API errors
   */
  async function lookupAddress(rawAddress) {
    const address = sanitizeAddress(rawAddress);

    const cacheKey = getCacheKey(address);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    enforceRateLimit();

    const raw = await fetchVoterInfo(address);
    const parsed = parseVoterInfo(raw);
    setCache(cacheKey, parsed);

    return parsed;
  }

  /* ==========================================================
   *  PUBLIC API
   * ========================================================== */

  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.API = Object.freeze({
    lookupAddress,
    fetchElections,
    parseVoterInfo,
    sanitizeAddress,
    escapeHTML,
    buildMapsUrl,
    buildCalendarUrl,
    clearCache,
  });
})();
