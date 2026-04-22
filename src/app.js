/**
 * @fileoverview Civic Flow — Application Bootstrapper
 * 
 * Initializes the application, binds DOM events, handles themes,
 * and orchestrates interactions between the UI and API layers.
 * 
 * @module app
 */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /**
   * Binds high contrast toggle functionality.
   */
  function initContrast() {
    const toggle = $('#contrast-toggle'), track = $('#contrast-track'), label = $('#contrast-label');
    if (!toggle) return;
    const storageKey = window.CivicFlow.Config?.CONFIG?.STORAGE_KEY_CONTRAST || 'civicflow-hc';

    if (localStorage.getItem(storageKey) === 'true') {
      document.documentElement.setAttribute('data-theme', 'high-contrast');
      track.classList.add('active');
      label.textContent = 'High Contrast: On';
    }

    toggle.addEventListener('click', () => {
      const on = track.classList.toggle('active');
      document.documentElement[on ? 'setAttribute' : 'removeAttribute']('data-theme', 'high-contrast');
      localStorage.setItem(storageKey, String(on));
      label.textContent = `High Contrast: ${on ? 'On' : 'Off'}`;
    });
  }

  /**
   * Binds form submission for address lookup.
   */
  function initLookupForm() {
    const form = $('#address-lookup-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#address-input');
      if (!input) return;
      try {
        window.CivicFlow.UI.renderLoading(true);
        const data = await window.CivicFlow.API.lookupAddress(input.value);
        window.CivicFlow.UI.renderResults(data);
      } catch (err) {
        window.CivicFlow.UI.renderError(err.message || 'Error occurred.');
      }
    });

    const keyToggle = $('#api-key-toggle'), keyPanel = $('#api-key-panel');
    if (keyToggle && keyPanel) keyToggle.addEventListener('click', () => keyPanel.classList.toggle('hidden'));
  }

  /**
   * Initializes smooth scrolling for anchor links.
   */
  function initNavigation() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const t = $(a.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
      });
    });
    const el = $('#footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  /**
   * Application entry point.
   */
  function initApp() {
    if (!window.CivicFlow) {
      console.error('Modules failed to load.');
      return;
    }
    
    // Init components from ui.js
    if (window.CivicFlow.UI.renderSteps) window.CivicFlow.UI.renderSteps();
    if (window.CivicFlow.UI.renderWizard) window.CivicFlow.UI.renderWizard();

    // Bind local event listeners
    initContrast();
    initLookupForm();
    initNavigation();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', initApp)
    : initApp();
})();
