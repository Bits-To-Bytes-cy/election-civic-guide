/**
 * @fileoverview Civic Flow — API Handler Module
 *
 * Encapsulates all communication with Google APIs (Civic, Maps, Gemini).
 *
 * @module api
 */

(function () {
  'use strict';

  let _cache = new Map();
  let _lastRequestTime = 0;
  let _abortController = null;

  function cfg() { return window.CivicFlow.Config.CONFIG; }

  /* ==========================================================
   *  SECURITY
   * ========================================================== */

  function sanitizeAddress(raw) {
    if (typeof raw !== 'string') throw new Error('Address must be a string.');
    let clean = raw.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length === 0) throw new Error('Please enter a valid address.');
    if (clean.length > cfg().MAX_ADDRESS_LENGTH) throw new Error(`Address must be under ${cfg().MAX_ADDRESS_LENGTH} characters.`);
    if (!/[a-zA-Z]/.test(clean) || !/\d/.test(clean)) throw new Error('Please enter a complete street address.');
    return clean;
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ==========================================================
   *  CACHING & RATE LIMITING
   * ========================================================== */

  function getCacheKey(address) { return 'civic_' + address.toLowerCase().replace(/\s+/g, '_'); }
  function getFromCache(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > cfg().CACHE_TTL_MS) { _cache.delete(key); return null; }
    return entry.data;
  }
  function setCache(key, data) {
    if (_cache.size >= cfg().MAX_CACHE_SIZE) _cache.delete(_cache.keys().next().value);
    _cache.set(key, { data, timestamp: Date.now() });
  }
  function clearCache() { _cache.clear(); }

  function enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed < cfg().RATE_LIMIT_MS) {
      throw new Error(`Please wait ${Math.ceil((cfg().RATE_LIMIT_MS - elapsed) / 1000)}s before searching again.`);
    }
    _lastRequestTime = now;
  }

  /* ==========================================================
   *  CIVIC INFO API
   * ========================================================== */

  async function fetchVoterInfo(address) {
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();

    const apiKey = window.CivicFlow.Config.getCivicApiKey();
    const url = `${cfg().BASE_URL}/voterinfo?key=${apiKey}&address=${encodeURIComponent(address)}&electionId=`;

    const timeoutId = setTimeout(() => _abortController.abort(), cfg().REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, { signal: _abortController.signal, headers: { 'Accept': 'application/json' } });
      clearTimeout(timeoutId);
      if (!res.ok) await _handleHttpError(res);
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Request timed out. Please check your connection.');
      throw err;
    } finally {
      _abortController = null;
    }
  }

  async function _handleHttpError(res) {
    const body = await res.json().catch(() => ({}));
    const fallback = body?.error?.message || `API error (${res.status})`;
    const messages = {
      400: 'No election info found for this address.',
      403: 'API key is invalid or exceeded quota.',
      429: 'Too many requests.',
    };
    throw new Error(messages[res.status] || fallback);
  }

  function parseVoterInfo(raw) {
    const result = { election: null, pollingLocations: [], earlyVoteSites: [], dropOffLocations: [] };
    if (raw.election && raw.election.id !== '0') {
      result.election = { name: escapeHTML(raw.election.name || 'Upcoming Election'), date: raw.election.electionDay || '' };
    }
    const parseLoc = (loc) => {
      const addr = loc.address || {};
      const full = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
      return {
        name: escapeHTML(addr.locationName || 'Polling Location'),
        address: escapeHTML(full),
        hours: escapeHTML(loc.pollingHours || 'Contact local office'),
        mapsUrl: buildMapsUrl(full)
      };
    };
    if (Array.isArray(raw.pollingLocations)) result.pollingLocations = raw.pollingLocations.map(parseLoc);
    if (Array.isArray(raw.earlyVoteSites)) result.earlyVoteSites = raw.earlyVoteSites.map(parseLoc);
    if (Array.isArray(raw.dropOffLocations)) result.dropOffLocations = raw.dropOffLocations.map(parseLoc);
    return result;
  }

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
   *  GOOGLE MAPS API
   * ========================================================== */

  let mapsLoaderPromise = null;
  function loadGoogleMaps() {
    if (mapsLoaderPromise) return mapsLoaderPromise;
    mapsLoaderPromise = new Promise((resolve, reject) => {
      if (window.google && window.google.maps) { resolve(); return; }
      try {
        const key = window.CivicFlow.Config.getMapsApiKey();
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=Function.prototype`;
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
      } catch (e) { reject(e); }
    });
    return mapsLoaderPromise;
  }

  async function renderMap(container, addressStr, title) {
    await loadGoogleMaps();
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: addressStr }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const map = new window.google.maps.Map(container, {
            zoom: 15, center: results[0].geometry.location, disableDefaultUI: true, zoomControl: true
          });
          new window.google.maps.Marker({ map, position: results[0].geometry.location, title: title });
          resolve(map);
        } else {
          reject(new Error('Geocode failed: ' + status));
        }
      });
    });
  }

  function buildMapsUrl(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  /* ==========================================================
   *  GOOGLE CALENDAR API (Template URLs)
   * ========================================================== */

  function buildCalendarUrl(electionName, dateStr, location) {
    if (!dateStr) return '#';
    const d = dateStr.replace(/-/g, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE', text: electionName || 'Election Day', dates: `${d}/${d}`,
      details: `Reminder: ${electionName}. Make sure to vote!\n\nPowered by Civic Flow`,
    });
    if (location) params.set('location', location);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /* ==========================================================
   *  GEMINI API
   * ========================================================== */

  async function askGemini(promptText) {
    // ── Graceful fail: check for a valid key before making the network call ──
    let key;
    try {
      key = window.CivicFlow.Config.getGeminiApiKey();
    } catch (_) {
      key = '';
    }
    if (!key || key === 'PASTE_YOUR_GEMINI_KEY_HERE' || key.includes('YOUR_')) {
      return 'Please configure your Gemini API Key in the settings to use the AI Guide. Click "Configure API Key" above the search bar to add it.';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${encodeURIComponent(key)}`;
    const payload = {
      contents: [{
        parts: [{ text: "You are a nonpartisan civic assistant. Provide a brief, factual answer about U.S. elections.\n\nUser: " + promptText }]
      }]
    };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Gemini API Error: ${res.status}`);
    const data = await res.json();
    try {
      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      throw new Error('Failed to parse Gemini response.');
    }
  }

  /* ==========================================================
   *  EXPORTS
   * ========================================================== */

  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.API = Object.freeze({
    lookupAddress, parseVoterInfo, sanitizeAddress, escapeHTML,
    buildMapsUrl, buildCalendarUrl, clearCache,
    loadGoogleMaps, renderMap, askGemini
  });
})();
