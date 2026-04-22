/**
 * @fileoverview Civic Flow — API Handler Module (ES6 Singleton)
 *
 * @module api
 */

import * as Config from './config.js';

class GoogleServiceManager {
  constructor() {
    this._cache = new Map();
    this._lastRequestTime = 0;
    this._abortController = null;
    this.mapsLoaderPromise = null;
    this.authLoaderPromise = null;
    this.userToken = null;
    this.userId = null;
    this.db = null; // Firestore instance
  }

  /* ==========================================================
   *  UTILITIES & SECURITY
   * ========================================================== */

  sanitizeAddress(raw) {
    if (typeof raw !== 'string') throw new Error('Address must be a string.');
    let clean = raw.replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').replace(/\s+/g, ' ').trim();
    if (clean.length === 0) throw new Error('Please enter a valid address.');
    if (clean.length > Config.CONFIG.MAX_ADDRESS_LENGTH) throw new Error(`Address must be under ${Config.CONFIG.MAX_ADDRESS_LENGTH} chars.`);
    if (!/[a-zA-Z]/.test(clean) || !/\d/.test(clean)) throw new Error('Please enter a complete street address.');
    return clean;
  }

  escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  enforceRateLimit() {
    const now = Date.now();
    if (now - this._lastRequestTime < Config.CONFIG.RATE_LIMIT_MS) {
      throw new Error('Please wait before searching again.');
    }
    this._lastRequestTime = now;
  }

  trackEvent(eventName, params = {}) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
  }

  /* ==========================================================
   *  CIVIC INFO API
   * ========================================================== */

  async lookupAddress(rawAddress) {
    const address = this.sanitizeAddress(rawAddress);
    const cacheKey = 'civic_' + address.toLowerCase().replace(/\s+/g, '_');
    
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey).data;
    this.enforceRateLimit();

    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();

    const apiKey = Config.getCivicApiKey();
    const url = `${Config.CONFIG.BASE_URL}/voterinfo?key=${apiKey}&address=${encodeURIComponent(address)}&electionId=`;

    try {
      const res = await fetch(url, { signal: this._abortController.signal, headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`Civic API error (${res.status})`);
      const raw = await res.json();
      
      const parsed = this.parseVoterInfo(raw);
      this._cache.set(cacheKey, { data: parsed, timestamp: Date.now() });
      
      this.trackEvent('election_search_complete', { has_election: !!parsed.election });
      return parsed;
    } finally {
      this._abortController = null;
    }
  }

  parseVoterInfo(raw) {
    const result = { election: null, pollingLocations: [], earlyVoteSites: [], dropOffLocations: [] };
    if (raw.election && raw.election.id !== '0') {
      result.election = { name: this.escapeHTML(raw.election.name || 'Election'), date: raw.election.electionDay || '' };
    }
    const parseLoc = (loc) => {
      const addr = loc.address || {};
      const full = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
      return {
        name: this.escapeHTML(addr.locationName || 'Polling Location'),
        address: this.escapeHTML(full),
        hours: this.escapeHTML(loc.pollingHours || 'Contact local office'),
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`
      };
    };
    if (Array.isArray(raw.pollingLocations)) result.pollingLocations = raw.pollingLocations.map(parseLoc);
    if (Array.isArray(raw.earlyVoteSites)) result.earlyVoteSites = raw.earlyVoteSites.map(parseLoc);
    if (Array.isArray(raw.dropOffLocations)) result.dropOffLocations = raw.dropOffLocations.map(parseLoc);
    return result;
  }

  buildCalendarUrl(electionName, dateStr) {
    if (!dateStr) return '#';
    const d = dateStr.replace(/-/g, '');
    const p = new URLSearchParams({ action: 'TEMPLATE', text: electionName, dates: `${d}/${d}` });
    return `https://calendar.google.com/calendar/render?${p.toString()}`;
  }

  /* ==========================================================
   *  GOOGLE MAPS API
   * ========================================================== */

  loadGoogleMaps() {
    if (this.mapsLoaderPromise) return this.mapsLoaderPromise;
    this.mapsLoaderPromise = new Promise((resolve, reject) => {
      if (window.google && window.google.maps) return resolve();
      try {
        const key = Config.getMapsApiKey();
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=Function.prototype`;
        script.async = true; script.defer = true;
        script.onload = resolve; script.onerror = () => reject(new Error('Failed to load Maps'));
        document.head.appendChild(script);
      } catch (e) { reject(e); }
    });
    return this.mapsLoaderPromise;
  }

  async renderMap(container, addressStr, title) {
    await this.loadGoogleMaps();
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: addressStr }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const map = new window.google.maps.Map(container, { zoom: 15, center: results[0].geometry.location, disableDefaultUI: true });
          new window.google.maps.Marker({ map, position: results[0].geometry.location, title });
          resolve(map);
        } else reject(new Error('Geocode failed'));
      });
    });
  }

  /* ==========================================================
   *  GOOGLE GEMINI & TRANSLATE APIs
   * ========================================================== */

  async askGemini(promptText) {
    const key = Config.getGeminiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Nonpartisan civic assistant. Answer:\n" + promptText }] }] })
    });
    if (!res.ok) throw new Error(`Gemini Error: ${res.status}`);
    const data = await res.json();
    this.trackEvent('ai_advice_requested');
    return data.candidates[0].content.parts[0].text;
  }

  async translateText(text, targetLang) {
    if (targetLang === 'en') return text;
    const key = Config.getTranslateApiKey();
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, target: targetLang, format: 'text' })
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    return data.data.translations[0].translatedText;
  }

  /* ==========================================================
   *  LAZY AUTH & FIRESTORE LITE
   * ========================================================== */

  signIn() {
    if (this.authLoaderPromise) return this.authLoaderPromise;
    this.authLoaderPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true; script.defer = true;
      script.onload = () => {
        try {
          window.google.accounts.id.initialize({
            client_id: Config.getGoogleClientId(),
            callback: (res) => {
              this.userToken = res.credential;
              // Decode JWT payload for user ID
              const payload = JSON.parse(atob(res.credential.split('.')[1]));
              this.userId = payload.sub;
              resolve(payload);
            }
          });
          window.google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              reject(new Error('Sign-in prompt failed to display or was skipped.'));
            }
          });
        } catch (e) { reject(e); }
      };
      script.onerror = () => reject(new Error('Failed to load Google Auth'));
      document.head.appendChild(script);
    });
    return this.authLoaderPromise;
  }

  async initFirestore() {
    if (this.db) return this.db;
    const firebaseConfig = Config.getFirebaseConfig();
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-lite.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore-lite.js');
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    return this.db;
  }

  async saveUserPlan(planText) {
    if (!this.userId) throw new Error('You must be signed in to save a plan.');
    await this.initFirestore();
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore-lite.js');
    
    await addDoc(collection(this.db, 'user_plans'), {
      uid: this.userId,
      plan: planText,
      timestamp: Date.now()
    });
    
    this.trackEvent('plan_saved');
  }
}

export const Services = new GoogleServiceManager();
