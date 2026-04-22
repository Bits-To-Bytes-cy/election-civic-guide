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
  
  root.innerHTML = `
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h3 class="text-xl font-bold" style="color:var(--clr-text-heading)">🤖 Civic AI Assistant</h3>
      <div class="flex gap-2 items-center">
        <select id="lang-select" class="text-xs p-1 rounded border">
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="hi">हिन्दी</option>
        </select>
        <button id="auth-btn" class="btn-outline text-xs py-1 px-3" aria-label="Sign in with Google to save plan">Sign In to Save</button>
      </div>
    </div>
    <div id="chat-history" class="mb-4 space-y-3" style="max-height: 300px; overflow-y: auto; padding-right: 10px;">
      <div class="p-3 rounded-lg" style="background:rgba(79,70,229,0.1); border:1px solid var(--clr-primary-light);">
        <p class="text-sm" style="color:var(--clr-text)" id="greeting-text"><strong>AI:</strong> Hello! Ask me about voting!</p>
      </div>
    </div>
    <form id="chat-form" class="flex gap-2">
      <input type="text" id="chat-input" placeholder="Type your question..." class="flex-1 rounded-lg px-4 py-2 text-sm" style="background:var(--clr-bg);border:1px solid var(--clr-border);color:var(--clr-text);" required autocomplete="off" />
      <button type="submit" class="btn-primary px-4 py-2 text-sm" id="chat-btn">Send</button>
    </form>
    <div class="mt-4 hidden" id="save-plan-container">
      <button id="save-plan-btn" class="btn-outline text-xs w-full py-2">💾 Save Latest Plan to Firestore</button>
    </div>
  `;

  let lastAiResponse = '';

  $('#lang-select').addEventListener('change', async (e) => {
    const lang = e.target.value;
    try {
      const el = $('#greeting-text');
      const text = await Services.translateText('Hello! Ask me about voting!', lang);
      el.innerHTML = `<strong>AI:</strong> ${Services.escapeHTML(text)}`;
    } catch (err) { console.error('Translation failed', err); }
  });

  $('#auth-btn').addEventListener('click', async (e) => {
    try {
      e.target.textContent = 'Signing in...';
      const user = await Services.signIn();
      e.target.textContent = `Signed in as ${user.name}`;
      e.target.disabled = true;
      $('#save-plan-container').classList.remove('hidden');
    } catch (err) {
      e.target.textContent = 'Sign In Failed';
      console.error(err);
    }
  });

  $('#save-plan-btn').addEventListener('click', async (e) => {
    if (!lastAiResponse) return alert('No plan to save yet.');
    try {
      e.target.textContent = 'Saving...';
      await Services.saveUserPlan(lastAiResponse);
      e.target.textContent = '✅ Saved!';
      setTimeout(() => e.target.textContent = '💾 Save Latest Plan to Firestore', 3000);
    } catch (err) {
      alert('Failed to save plan: ' + err.message);
      e.target.textContent = '💾 Save Latest Plan to Firestore';
    }
  });

  $('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    appendChatMessage('You', msg);
    input.value = '';
    const btn = $('#chat-btn');
    btn.disabled = true;

    try {
      let reply = await Services.askGemini(msg);
      const lang = $('#lang-select').value;
      if (lang !== 'en') {
        reply = await Services.translateText(reply, lang);
      }
      lastAiResponse = reply;
      appendChatMessage('AI', reply);
    } catch (err) {
      appendChatMessage('Error', err.message);
    } finally {
      btn.disabled = false;
    }
  });
}

function appendChatMessage(sender, text) {
  const hist = $('#chat-history');
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
