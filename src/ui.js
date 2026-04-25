/**
 * @fileoverview Civic Flow — UI & Wizard Controller
 *
 * @module ui
 */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);

  /* ==========================================================
   *  UI: ELECTION STEPS (Static Content)
   * ========================================================== */

  const MAIN_STEPS = [
    { id: 1, title: 'Voter Registration', icon: '📋',
      summary: 'Register to vote in your jurisdiction before the deadline.',
      details: 'Most states allow online registration. Key documents include a government-issued ID and proof of residence.',
      tips: ['Check your state\'s deadline at vote.gov', 'Update registration if you\'ve moved'] },
    { id: 2, title: 'Understanding the Ballot', icon: '🗳️',
      summary: 'Learn about candidates, measures, and ballot structure.',
      details: 'Ballots contain federal, state, and local races plus ballot measures.',
      tips: ['Use nonpartisan voter guides', 'Read full text of ballot measures'] }
  ];

  function renderSteps() {
    const c = $('#steps-container');
    if (!c) return;
    c.innerHTML = MAIN_STEPS.map((s, i) => `
      <div class="card p-6 animate-fadeInUp delay-${i + 1}" id="step-${s.id}">
        <div class="flex items-start gap-4">
          <div class="step-number">${s.id}</div>
          <div class="flex-1">
            <h3 class="text-xl font-bold" style="color:var(--clr-text-heading)">${s.icon} ${s.title}</h3>
            <p class="text-sm mb-2" style="color:var(--clr-text-muted)">${s.summary}</p>
            <div class="hidden" id="details-${s.id}">
              <p class="mb-2 text-sm">${s.details}</p>
            </div>
            <button class="btn-outline mt-2 text-xs" onclick="CivicFlow.UI.toggleStep(${s.id})" id="btn-${s.id}">Learn More ↓</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  function toggleStep(id) {
    const d = $(`#details-${id}`), b = $(`#btn-${id}`);
    if (!d || !b) return;
    const show = d.classList.contains('hidden');
    d.classList.toggle('hidden');
    b.textContent = show ? 'Show Less ↑' : 'Learn More ↓';
  }

  /* ==========================================================
   *  UI: LOOKUP RENDERING & MAPS
   * ========================================================== */

  function renderResults(data) {
    const container = $('#lookup-results');
    if (!container) return;
    const API = window.CivicFlow.API;
    let html = '';

    if (data.election) {
      const calUrl = API.buildCalendarUrl(data.election.name, data.election.date);
      html += `
        <div class="card p-6 mb-4 animate-fadeInUp">
          <h3 class="text-lg font-bold">${data.election.name}</h3>
          <p class="text-sm mb-3">${data.election.date || 'Date not available'}</p>
          <div class="flex flex-wrap gap-2">
            <a href="${calUrl}" target="_blank" class="btn-primary text-sm no-underline">Save to Calendar</a>
            <button class="btn-outline text-sm" id="save-plan-btn" aria-label="Save this election plan to your Google account">
              💾 Save Plan
            </button>
          </div>
        </div>`;

      // Wire save plan button after DOM injection
      setTimeout(() => {
        const saveBtn = document.getElementById('save-plan-btn');
        if (saveBtn) {
          saveBtn.addEventListener('click', async () => {
            if (!window.CivicFlow.Storage) { alert('Storage module not loaded.'); return; }
            try {
              saveBtn.textContent = 'Saving...';
              saveBtn.disabled = true;
              await window.CivicFlow.Storage.saveElectionPlan({
                address: document.getElementById('address-input')?.value || '',
                electionName: data.election.name,
                electionDate: data.election.date,
                pollingLocation: data.pollingLocations?.[0]?.address || ''
              });
              saveBtn.textContent = '✅ Saved!';
            } catch (err) {
              saveBtn.textContent = '💾 Save Plan';
              saveBtn.disabled = false;
              alert(err.message);
            }
          });
        }
      }, 50);
    }

    const all = [...data.pollingLocations, ...data.earlyVoteSites, ...data.dropOffLocations];
    if (all.length > 0) {
      const loc = all[0];
      html += `
        <div class="card p-5 animate-fadeInUp">
          <h4 class="font-semibold" style="color:var(--clr-text-heading)">📍 ${loc.name}</h4>
          <p class="text-sm mb-1" style="color:var(--clr-text-muted)">${loc.address}</p>
          <p class="text-sm mb-3" style="color:var(--clr-text-muted)">🕐 ${loc.hours}</p>
          <div id="map-container" style="width:100%;height:400px;border-radius:12px;background:#1e293b;margin-top:12px;display:flex;align-items:center;justify-content:center;">
            <p style="color:#94a3b8;font-size:0.875rem;">Loading interactive map…</p>
          </div>
          <a href="${loc.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-outline inline-flex items-center gap-2 text-sm no-underline mt-3">
            Open in Google Maps ↗
          </a>
        </div>`;

      // Async: load Maps JS API and render marker after DOM injection
      setTimeout(() => {
        const mapEl = $('#map-container');
        if (mapEl) {
          API.renderMap(mapEl, loc.address, loc.name).catch(err => {
            mapEl.innerHTML = `
              <div style="padding:24px;text-align:center;">
                <p style="color:#f87171;font-size:0.875rem;margin-bottom:8px;">⚠️ Could not load map: ${API.escapeHTML(err.message)}</p>
                <a href="${loc.mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:var(--clr-accent-light);font-size:0.8rem;text-decoration:underline;">View on Google Maps instead →</a>
              </div>`;
          });
        }
      }, 100);
    } else if (!data.election) {
      // No election AND no locations — show a clear "not found" message
      html += `
        <div class="card p-6 text-center animate-fadeIn" style="border-color:var(--clr-border);">
          <p class="text-base mb-2" style="color:var(--clr-text-heading);">📭 No polling data found for this address</p>
          <p class="text-sm" style="color:var(--clr-text-muted);">There may not be an upcoming election in your area, or the address could not be matched. Try entering your full street address including city and state.</p>
        </div>`;
    }

    container.innerHTML = html || `<div class="card p-6 text-center animate-fadeIn"><p style="color:var(--clr-text-muted);">📭 No polling data found for this address. Please try a full street address.</p></div>`;
  }

  function renderError(message) {
    const c = $('#lookup-results');
    if (c) c.innerHTML = `<div class="card p-6 text-red-500 animate-fadeIn">⚠️ ${message}</div>`;
  }

  function renderLoading(show) {
    const c = $('#lookup-results');
    if (c && show) c.innerHTML = `<div class="card p-8 text-center animate-fadeIn"><p>Looking up election info…</p></div>`;
  }

  /* ==========================================================
   *  UI: GEMINI AI CHAT ASSISTANT
   * ========================================================== */

  function renderWizard() {
    const root = $('#election-wizard-root');
    if (!root) return;
    
    root.innerHTML = `
      <div class="flex items-center gap-3 mb-4">
        <h3 class="text-xl font-bold" style="color:var(--clr-text-heading)">🤖 Civic AI Assistant</h3>
      </div>
      <div id="chat-history" class="mb-4 space-y-3" style="max-height: 300px; overflow-y: auto; padding-right: 10px;">
        <div class="p-3 rounded-lg" style="background:rgba(79,70,229,0.1); border:1px solid var(--clr-primary-light);">
          <p class="text-sm" style="color:var(--clr-text)"><strong>AI:</strong> Hello! I am your Civic Flow AI Assistant. Ask me anything about voter registration, early voting, or election policies!</p>
        </div>
      </div>
      <form id="chat-form" class="flex gap-2">
        <input type="text" id="chat-input" placeholder="Type your question..." class="flex-1 rounded-lg px-4 py-2 text-sm" style="background:var(--clr-bg);border:1px solid var(--clr-border);color:var(--clr-text);" required autocomplete="off" />
        <button type="submit" class="btn-primary px-4 py-2 text-sm" id="chat-btn">Send</button>
      </form>
    `;

    $('#chat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('#chat-input');
      const msg = input.value.trim();
      if (!msg) return;

      appendChatMessage('You', msg);
      input.value = '';
      const btn = $('#chat-btn');
      btn.disabled = true;
      btn.textContent = '...';

      try {
        const reply = await window.CivicFlow.API.askGemini(msg);
        appendChatMessage('AI', reply);

        // ── GA4: track the AI query event ──
        if (window.CivicFlow.Analytics) {
          window.CivicFlow.Analytics.trackEvent('ai_query', { query_topic: msg.substring(0, 50) });
        }
      } catch (err) {
        appendChatMessage('Error', err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send';
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
    div.innerHTML = `<p class="text-sm" style="color:${color}"><strong>${sender}:</strong> ${window.CivicFlow.API.escapeHTML(text)}</p>`;
    
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }

  /* ==========================================================
   *  EXPORTS
   * ========================================================== */

  window.CivicFlow = window.CivicFlow || {};
  window.CivicFlow.UI = {
    renderSteps,
    toggleStep,
    renderResults,
    renderError,
    renderLoading,
    renderWizard
  };
})();
