/**
 * @fileoverview Civic Flow — UI Controller (ES6)
 *
 * @module ui
 */

import { Services } from './api.js';

const $ = (s) => document.querySelector(s);

export const UI = {
  renderResults,
  renderError,
  renderLoading,
  renderWizard
};

function renderResults(data) {
  const container = $('#lookup-results');
  if (!container) return;
  let html = '';

  if (data.election) {
    const calUrl = Services.buildCalendarUrl(data.election.name, data.election.date);
    html += `
      <div class="card p-6 mb-4 animate-fadeInUp">
        <h3 class="text-lg font-bold">${data.election.name}</h3>
        <p class="text-sm mb-3">${data.election.date || 'Date not available'}</p>
        <a href="${calUrl}" target="_blank" class="btn-primary text-sm no-underline">Save to Calendar</a>
      </div>`;
  }

  const all = [...data.pollingLocations, ...data.earlyVoteSites, ...data.dropOffLocations];
  if (all.length > 0) {
    const loc = all[0];
    html += `
      <div class="card p-5 animate-fadeInUp">
        <h4 class="font-semibold" style="color:var(--clr-text-heading)">📍 ${loc.name}</h4>
        <p class="text-sm mb-1" style="color:var(--clr-text-muted)">${loc.address}</p>
        <p class="text-sm mb-3" style="color:var(--clr-text-muted)">🕐 ${loc.hours}</p>
        <div id="map-container" style="width: 100%; height: 250px; border-radius: 8px; background: #eee; margin-top: 10px;"></div>
      </div>`;
    
    setTimeout(() => {
      const mapEl = $('#map-container');
      if (mapEl) Services.renderMap(mapEl, loc.address, loc.name).catch(() => {});
    }, 50);
  }
  
  container.innerHTML = html || `<div class="card p-6 text-center"><p>No Results Found</p></div>`;
}

function renderError(message) {
  const c = $('#lookup-results');
  if (c) c.innerHTML = `<div class="card p-6 text-red-500 animate-fadeIn">⚠️ ${message}</div>`;
}

function renderLoading(show) {
  const c = $('#lookup-results');
  if (c && show) c.innerHTML = `<div class="card p-8 text-center animate-fadeIn"><p>Looking up election info…</p></div>`;
}

function renderWizard() {
  const root = $('#election-wizard-root');
  if (!root) return;

  // Add a custom sign-in button to the container since script is lazy-loaded
  const authContainer = $('#google-auth-container');
  if (authContainer) {
    authContainer.innerHTML = `<button id="custom-auth-btn" class="btn-outline text-xs py-1 px-3" aria-label="Sign in with Google to save plan">Sign In to Save</button>`;
  }

  let lastAiResponse = '';

  const langPicker = $('#language-picker');
  if (langPicker) {
    langPicker.addEventListener('change', async (e) => {
      const lang = e.target.value;
      try {
        const el = $('#greeting-text');
        if (el) {
          const text = await Services.translateText('Hello! Ask me about voting!', lang);
          el.innerHTML = `<strong>AI:</strong> ${Services.escapeHTML(text)}`;
        }
      } catch (err) { console.error('Translation failed', err); }
    });
  }

  const customAuthBtn = $('#custom-auth-btn');
  if (customAuthBtn) {
    customAuthBtn.addEventListener('click', async (e) => {
      try {
        e.target.textContent = 'Signing in...';
        const user = await Services.signIn();
        e.target.textContent = `Signed in as ${user.name}`;
        e.target.disabled = true;
        const saveBtn = $('#save-plan-btn');
        if (saveBtn) saveBtn.classList.remove('hidden');
      } catch (err) {
        e.target.textContent = 'Sign In Failed';
        console.error(err);
      }
    });
  }

  const savePlanBtn = $('#save-plan-btn');
  if (savePlanBtn) {
    savePlanBtn.addEventListener('click', async (e) => {
      if (!lastAiResponse) return alert('No plan to save yet.');
      try {
        e.target.textContent = 'Saving...';
        await Services.saveUserPlan(lastAiResponse);
        e.target.textContent = '✅ Saved!';
        setTimeout(() => e.target.textContent = 'Save Plan to Profile', 3000);
      } catch (err) {
        alert('Failed to save plan: ' + err.message);
        e.target.textContent = 'Save Plan to Profile';
      }
    });
  }

  const chatForm = $('#chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#chat-input');
      const msg = input.value.trim();
      if (!msg) return;

      appendChatMessage('You', msg);
      input.value = '';
      const btn = $('#send-btn');
      if (btn) btn.disabled = true;

      try {
        let reply = await Services.askGemini(msg);
        const lang = langPicker ? langPicker.value : 'en';
        if (lang !== 'en') {
          reply = await Services.translateText(reply, lang);
        }
        lastAiResponse = reply;
        appendChatMessage('AI', reply);
      } catch (err) {
        appendChatMessage('Error', err.message);
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
}

function appendChatMessage(sender, text) {
  const hist = $('#chat-window');
  if (!hist) return;
  const isUser = sender === 'You';
  const bg = isUser ? 'rgba(255,255,255,0.05)' : 'rgba(79,70,229,0.1)';
  const color = isUser ? 'var(--clr-text-muted)' : 'var(--clr-text)';
  
  const div = document.createElement('div');
  div.className = 'p-3 rounded-lg animate-fadeIn';
  div.style = `background:${bg}; border:1px solid var(--clr-border);`;
  div.innerHTML = `<p class="text-sm" style="color:${color}"><strong>${sender}:</strong> ${Services.escapeHTML(text)}</p>`;
  
  hist.appendChild(div);
  hist.scrollTop = hist.scrollHeight;
}
