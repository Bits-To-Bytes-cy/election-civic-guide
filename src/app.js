/**
 * @fileoverview Civic Flow — Application Bootstrapper (ES6)
 *
 * @module app
 */

import { UI } from './ui.js';
import { Services } from './api.js';

const $ = (s) => document.querySelector(s);

function initLookupForm() {
  const form = $('#address-lookup-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#address-input');
    if (!input) return;
    try {
      UI.renderLoading(true);
      const data = await Services.lookupAddress(input.value);
      UI.renderResults(data);
      Services.trackEvent('search_performed', { search_term: 'address_lookup' });
    } catch (err) {
      UI.renderError(err.message || 'Error occurred.');
    }
  });

  const keyToggle = $('#api-key-toggle'), keyPanel = $('#api-key-panel');
  if (keyToggle && keyPanel) keyToggle.addEventListener('click', () => keyPanel.classList.toggle('hidden'));
}

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

function initApp() {
  UI.renderWizard();
  initLookupForm();
  initNavigation();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', initApp)
  : initApp();
