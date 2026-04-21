/**
 * @fileoverview Civic Flow — UI & Wizard Controller
 *
 * Organizes all DOM manipulation, rendering logic, and the interactive
 * Election 101 wizard. Reads data from API module and Config.
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
      details: 'Every citizen\'s journey begins with registration. Most states allow online registration, while some require mail-in or in-person enrollment. Key documents include a government-issued ID, proof of residence, and your Social Security number.',
      tips: ['Check your state\'s deadline at vote.gov', 'Update registration if you\'ve moved'] },
    { id: 2, title: 'Understanding the Ballot', icon: '🗳️',
      summary: 'Learn about candidates, measures, and ballot structure.',
      details: 'Ballots contain federal, state, and local races plus ballot measures. Federal races include President, Senate, and House.',
      tips: ['Use nonpartisan voter guides', 'Read full text of ballot measures'] },
    { id: 3, title: 'Voting Methods', icon: '✉️',
      summary: 'Choose how to cast your vote — in-person, by mail, or early.',
      details: 'Modern elections offer multiple ways to vote: traditional in-person on Election Day, early voting at designated locations, and mail-in/absentee voting.',
      tips: ['Early voting often has shorter lines', 'Request mail ballots well before the deadline'] },
    { id: 4, title: 'Election Day', icon: '🏛️',
      summary: 'Know your rights and what to expect at the polls.',
      details: 'Polls are typically open 7 AM – 8 PM. Bring required ID, check in, receive your ballot, mark choices privately, and submit.',
      tips: ['Ask for a replacement if you make a mistake', 'You can\'t be turned away if in line at closing'] },
    { id: 5, title: 'Counting & Results', icon: '📊',
      summary: 'Understand how votes are tallied and results certified.',
      details: 'After polls close, workers count ballots. In-person votes are usually tallied electronically the same night.',
      tips: ['Election night results are projections', 'Certification takes days to weeks'] },
    { id: 6, title: 'Post-Election Engagement', icon: '🤝',
      summary: 'Stay engaged — democracy doesn\'t stop at the ballot.',
      details: 'After an election, stay engaged by attending town halls, contacting representatives, and joining community organizations.',
      tips: ['Subscribe to officials\' newsletters', 'Volunteer as a poll worker next time'] }
  ];

  /**
   * Renders the 6-step election education cards.
   */
  function renderSteps() {
    const c = $('#steps-container');
    if (!c) return;
    c.innerHTML = MAIN_STEPS.map((s, i) => `
      <div class="card p-6 md:p-8 animate-fadeInUp delay-${i + 1}" id="step-${s.id}">
        <div class="flex items-start gap-4 md:gap-6">
          <div class="step-number">${s.id}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <span class="text-2xl">${s.icon}</span>
              <h3 class="text-xl md:text-2xl font-bold" style="color:var(--clr-text-heading)">${s.title}</h3>
            </div>
            <p class="text-sm md:text-base mb-4" style="color:var(--clr-text-muted)">${s.summary}</p>
            <div class="step-details hidden" id="details-${s.id}">
              <p class="mb-4 leading-relaxed">${s.details}</p>
              <div class="rounded-xl p-4" style="background:rgba(79,70,229,0.08);border:1px solid var(--clr-border)">
                <p class="font-semibold mb-2 text-sm" style="color:var(--clr-primary-light)">💡 Quick Tips</p>
                <ul class="space-y-1">
                  ${s.tips.map(t => `<li class="flex items-start gap-2 text-sm" style="color:var(--clr-text-muted)"><span style="color:var(--clr-accent)">▸</span><span>${t}</span></li>`).join('')}
                </ul>
              </div>
            </div>
            <button class="btn-outline mt-4 text-sm" onclick="CivicFlow.UI.toggleStep(${s.id})" aria-expanded="false" aria-controls="details-${s.id}" id="btn-${s.id}">Learn More ↓</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * Toggles detail panels.
   * @param {number} id 
   */
  function toggleStep(id) {
    const d = $(`#details-${id}`), b = $(`#btn-${id}`);
    if (!d || !b) return;
    const show = d.classList.contains('hidden');
    d.classList.toggle('hidden');
    b.setAttribute('aria-expanded', String(show));
    b.textContent = show ? 'Show Less ↑' : 'Learn More ↓';
    if (show) d.classList.add('animate-fadeIn');
  }

  /* ==========================================================
   *  UI: LOOKUP RENDERING
   * ========================================================== */

  /**
   * Render lookup results.
   * @param {Object} data 
   */
  function renderResults(data) {
    const container = $('#lookup-results');
    if (!container) return;
    const API = window.CivicFlow.API;
    let html = '';

    if (data.election) {
      const calUrl = API.buildCalendarUrl(data.election.name, data.election.date);
      const fmt = data.election.date ? new Date(data.election.date + 'T00:00:00').toLocaleDateString() : 'Date not available';
      html += `
        <div class="card p-6 animate-fadeInUp" id="election-result">
          <div class="flex items-start gap-4">
            <div class="step-number" style="width:44px;height:44px;font-size:1.1rem;">📅</div>
            <div class="flex-1">
              <h3 class="text-lg font-bold mb-1" style="color:var(--clr-text-heading)">${data.election.name}</h3>
              <p class="text-sm mb-3" style="color:var(--clr-text-muted)"><strong style="color:var(--clr-accent-light)">${fmt}</strong></p>
              <a href="${calUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary inline-flex items-center gap-2 text-sm no-underline" style="padding:0.5rem 1.2rem;">
                Save to Google Calendar
              </a>
            </div>
          </div>
        </div>`;
    }

    const all = [...data.pollingLocations, ...data.earlyVoteSites, ...data.dropOffLocations];
    if (all.length > 0) {
      html += `<div class="mt-4"><h3 class="text-lg font-bold mb-4" style="color:var(--clr-text-heading)">📍 Locations (${all.length})</h3><div class="space-y-4">`;
      all.forEach((loc, i) => {
        html += `
          <div class="card p-5 animate-fadeInUp delay-${Math.min(i+1,6)}">
            <h4 class="font-semibold" style="color:var(--clr-text-heading)">${loc.name}</h4>
            <p class="text-sm mb-1" style="color:var(--clr-text-muted)">📍 ${loc.address}</p>
            <p class="text-sm mb-3" style="color:var(--clr-text-muted)">🕐 ${loc.hours}</p>
            <a href="${loc.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-outline inline-flex items-center gap-2 text-sm no-underline">
              View on Google Maps
            </a>
          </div>`;
      });
      html += `</div></div>`;
    }
    container.innerHTML = html || `<div class="card p-6 text-center animate-fadeIn"><p>No Results Found</p></div>`;
  }

  function renderError(message) {
    const c = $('#lookup-results');
    if (c) c.innerHTML = `<div class="card p-6 animate-fadeIn" style="border-color:#ef4444;"><p style="color:#f87171">⚠️ ${window.CivicFlow.API.escapeHTML(message)}</p></div>`;
  }

  function renderLoading(show) {
    const c = $('#lookup-results');
    if (c && show) c.innerHTML = `<div class="card p-8 text-center animate-fadeIn"><p>Looking up election info…</p></div>`;
  }

  /* ==========================================================
   *  WIZARD COMPONENT
   * ========================================================== */

  const STATES = [{abbr:'CA',name:'California'}, {abbr:'NY',name:'New York'}, {abbr:'TX',name:'Texas'}]; // Truncated for brevity
  const WIZARD_STEPS = [
    { id: 'register', title: 'How to Register to Vote', icon: '📋', renderContent: () => `<p>Register at vote.gov.</p>` },
    { id: 'research', title: 'Research Candidates Safely', icon: '🔍', renderContent: () => `<p>Use Ballotpedia.</p>` },
    { id: 'polls',    title: 'What to Bring to the Polls', icon: '🏛️', renderContent: () => `<p>Bring your ID.</p>` }
  ];
  let currentStep = 0;

  /**
   * Renders the wizard UI.
   */
  function renderWizard() {
    const root = $('#election-wizard-root');
    if (!root) return;
    const step = WIZARD_STEPS[currentStep];
    const isFirst = currentStep === 0, isLast = currentStep === WIZARD_STEPS.length - 1;

    root.innerHTML = `
      <div id="wizard-live" class="sr-only" aria-live="polite">Step ${currentStep+1} of ${WIZARD_STEPS.length}: ${step.title}</div>
      <div class="flex items-center gap-3 mb-6">
        <h3 class="text-xl md:text-2xl font-bold" style="color:var(--clr-text-heading)">${step.icon} ${step.title}</h3>
      </div>
      <div class="animate-fadeIn">${step.renderContent()}</div>
      <div class="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
        <button class="btn-outline text-sm ${isFirst?'invisible':''}" onclick="CivicFlow.UI.goToWizardStep(${currentStep-1})">Previous</button>
        <span class="text-xs font-medium">${currentStep+1} / ${WIZARD_STEPS.length}</span>
        ${isLast 
          ? `<button class="btn-primary text-sm" onclick="CivicFlow.UI.goToWizardStep(0)">Start Over</button>`
          : `<button class="btn-primary text-sm" onclick="CivicFlow.UI.goToWizardStep(${currentStep+1})">Next</button>`}
      </div>`;
  }

  /**
   * Navigates wizard.
   * @param {number} step 
   */
  function goToWizardStep(step) {
    if (step >= 0 && step < WIZARD_STEPS.length) {
      currentStep = step;
      renderWizard();
    }
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
    renderWizard,
    goToWizardStep
  };
})();
