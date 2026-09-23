/* ============================================================
   EIAAW Solutions — Connect layer
   Wires Talk-to-us, Talk-to-the-agent, and the floating chatbot
   to the live Sales Agent API at sa.eiaawsolutions.com.
   ============================================================ */
(function () {
  const API = 'https://sa.eiaawsolutions.com';
  const SUBMIT_LABEL = 'Send enquiry <span class="arrow">&rarr;</span>';

  // Conversion events for GA4 + Meta Pixel. Without these, analytics only sees
  // page views and can't tell which traffic converts. No personal data is sent —
  // only which channel the visitor used. consent.js decides whether either tag
  // is actually loaded; without consent the calls go nowhere.
  function track(gaEvent, metaEvent, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', gaEvent, params || {}); } catch (e) { /* analytics must never break the UI */ }
    try { if (metaEvent && typeof window.fbq === 'function') window.fbq('track', metaEvent, params || {}); } catch (e) { /* same */ }
  }

  // Explicit, unticked consent before we collect contact details — required by
  // the stricter APAC regimes (Indonesia, Vietnam, Korea, China, Thailand) and
  // good evidence under Malaysia's PDPA. The record rides along in fields the
  // sa endpoints already store (enquiry email body / CRM lead note).
  const PRIVACY_VERSION = '2026-09-24';
  function consentField(id) {
    return `<label class="eiaaw-consent" for="${id}"><input type="checkbox" id="${id}"><span>I agree that EIAAW may use these details to reply to me, including through service providers outside my country, as described in the <a href="/privacy.html" target="_blank" rel="noopener">privacy notice</a>.</span></label>`;
  }
  function consentRecord() {
    return `Consent: agreed to privacy notice (${PRIVACY_VERSION}) on ${new Date().toISOString()} via ${location.href}`;
  }
  const CONSENT_ERR = 'Please tick the box so we can use your details to reply.';

  // ---------- Modal: Talk to us ----------
  function ensureContactModal() {
    if (document.getElementById('eiaaw-contact-modal')) return;
    const wrap = document.createElement('div');
    wrap.id = 'eiaaw-contact-modal';
    wrap.className = 'eiaaw-modal';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `
      <div class="eiaaw-modal-panel" role="dialog" aria-modal="true" aria-labelledby="eiaaw-contact-title">
        <button class="eiaaw-modal-close" aria-label="Close">&times;</button>

        <div data-view="form">
          <span class="eyebrow">Talk to us</span>
          <h3 id="eiaaw-contact-title">Tell us what you&rsquo;re working on.</h3>
          <p class="eiaaw-modal-lead">We read every message. Expect a reply within one working day from <strong>eiaawsolutions@gmail.com</strong>.</p>

          <div class="eiaaw-field">
            <label for="ec-name">Name</label>
            <input id="ec-name" type="text" autocomplete="name" maxlength="80" required>
          </div>
          <div class="eiaaw-row">
            <div class="eiaaw-field">
              <label for="ec-email">Email</label>
              <input id="ec-email" type="email" autocomplete="email" maxlength="120" required>
            </div>
            <div class="eiaaw-field">
              <label for="ec-phone">Phone <small>(optional)</small></label>
              <input id="ec-phone" type="tel" autocomplete="tel" maxlength="32">
            </div>
          </div>
          <div class="eiaaw-field">
            <label for="ec-company">Company <small>(optional)</small></label>
            <input id="ec-company" type="text" autocomplete="organization" maxlength="120">
          </div>
          <div class="eiaaw-field">
            <label for="ec-message">What would you like to explore?</label>
            <textarea id="ec-message" rows="4" maxlength="2000" required placeholder="A few lines about your team, your goals, and the outcome you&rsquo;re after."></textarea>
          </div>

          <div class="eiaaw-modal-err" id="ec-error" hidden></div>
          ${consentField('ec-consent')}

          <div class="eiaaw-modal-actions">
            <button type="button" class="btn btn-primary btn-lg magnetic" id="ec-submit">Send enquiry <span class="arrow">&rarr;</span></button>
            <button type="button" class="btn btn-ghost" data-view-switch="agent">Prefer to talk? Call the AI agent</button>
          </div>
        </div>

        <div data-view="success" hidden>
          <span class="eyebrow">Message sent</span>
          <h3>Thanks &mdash; we&rsquo;ll be in touch.</h3>
          <p class="eiaaw-modal-lead">Your enquiry just landed at <strong>eiaawsolutions@gmail.com</strong>. In the meantime you&rsquo;re welcome to keep exploring, or try the voice agent for a quick conversation.</p>
          <div class="eiaaw-modal-actions">
            <button type="button" class="btn btn-primary btn-lg magnetic" id="ec-agent-cta">Talk to the agent <span class="arrow">&rarr;</span></button>
            <button type="button" class="btn btn-ghost eiaaw-modal-close-sec">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) closeContact();
      if (e.target.classList.contains('eiaaw-modal-close') || e.target.classList.contains('eiaaw-modal-close-sec')) closeContact();
      const sw = e.target.dataset?.viewSwitch;
      if (sw === 'agent') { closeContact(); startAgentCall(); }
    });
    wrap.querySelector('#ec-submit').addEventListener('click', submitContact);
    wrap.querySelector('#ec-agent-cta').addEventListener('click', () => { closeContact(); startAgentCall(); });
  }

  // A successful send leaves the button disabled and reading "Sending…" — it is
  // never reset, because the whole form is hidden at that point. Re-opening the
  // modal un-hides that stale, disabled button, so a second enquiry can never be
  // sent. Reset the submit chrome on every open.
  function resetSubmit(modal) {
    const btn = modal.querySelector('#ec-submit');
    btn.disabled = false;
    btn.innerHTML = SUBMIT_LABEL;
    const err = modal.querySelector('#ec-error');
    err.hidden = true;
    err.textContent = '';
  }

  function openContact(prefill) {
    ensureContactModal();
    const modal = document.getElementById('eiaaw-contact-modal');
    modal.querySelector('[data-view="form"]').hidden = false;
    modal.querySelector('[data-view="success"]').hidden = true;
    resetSubmit(modal);
    if (prefill) {
      const set = (id, v) => { if (v != null) { const el = modal.querySelector(id); if (el) el.value = v; } };
      set('#ec-name', prefill.name);
      set('#ec-email', prefill.email);
      set('#ec-phone', prefill.phone);
      set('#ec-company', prefill.company);
      set('#ec-message', prefill.message);
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => modal.querySelector('#ec-name').focus(), 30);
  }

  function closeContact() {
    const modal = document.getElementById('eiaaw-contact-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  async function submitContact() {
    const modal = document.getElementById('eiaaw-contact-modal');
    const name = modal.querySelector('#ec-name').value.trim();
    const email = modal.querySelector('#ec-email').value.trim();
    const phone = modal.querySelector('#ec-phone').value.trim();
    const company = modal.querySelector('#ec-company').value.trim();
    const message = modal.querySelector('#ec-message').value.trim();
    const errEl = modal.querySelector('#ec-error');
    const btn = modal.querySelector('#ec-submit');

    if (!name || !email || !message) {
      errEl.textContent = 'Please fill in your name, email, and message.';
      errEl.hidden = false;
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errEl.textContent = 'Please enter a valid email address.';
      errEl.hidden = false;
      return;
    }
    if (!modal.querySelector('#ec-consent').checked) {
      errEl.textContent = CONSENT_ERR;
      errEl.hidden = false;
      return;
    }

    errEl.hidden = true;
    btn.disabled = true;
    btn.innerHTML = 'Sending&hellip;';

    try {
      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, company, message: `${message}\n\n— ${consentRecord()}` }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.error) {
        errEl.textContent = data.error;
        errEl.hidden = false;
        btn.disabled = false;
        btn.innerHTML = SUBMIT_LABEL;
        return;
      }
      modal.querySelector('[data-view="form"]').hidden = true;
      modal.querySelector('[data-view="success"]').hidden = false;
      track('generate_lead', 'Lead', { lead_source: 'contact_form', page: location.pathname });
      // Sent — drop the message so a re-opened form never re-submits stale text.
      // Name/email/company stay, so a follow-up enquiry is quick to write.
      modal.querySelector('#ec-message').value = '';
    } catch (e) {
      errEl.textContent = 'Connection issue. You can also email eiaawsolutions@gmail.com directly.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.innerHTML = SUBMIT_LABEL;
    }
  }

  // ---------- Talk to the agent ----------
  async function startAgentCall() {
    track('start_voice_agent', 'Contact', { lead_source: 'voice_agent', page: location.pathname });
    try {
      const res = await fetch(`${API}/api/voice/public-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'eiaawsolutions.com' }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.callUrl) {
        window.open(data.callUrl, '_blank', 'noopener');
      } else {
        // Fallback: open the contact form
        openContact({ message: 'I tried to reach the AI agent but it was unavailable. Please help me book a demo.' });
      }
    } catch (e) {
      openContact({ message: 'I tried to reach the AI agent but it was unavailable. Please help me book a demo.' });
    }
  }

  // ---------- Chatbot ----------
  function ensureChatPanel() {
    if (document.getElementById('eiaaw-chat-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'eiaaw-chat-panel';
    panel.className = 'eiaaw-chat-panel';
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `
      <div class="eiaaw-chat-head">
        <div>
          <strong>EIAAW assistant</strong>
          <small>Ethical AI &middot; Always honest</small>
        </div>
        <button class="eiaaw-chat-close" aria-label="Close chat">&times;</button>
      </div>
      <div class="eiaaw-chat-msgs" id="eiaaw-chat-msgs" role="log" aria-live="polite"></div>
      <div class="eiaaw-chat-quick" id="eiaaw-chat-quick"></div>
      <form class="eiaaw-chat-form" id="eiaaw-chat-form">
        <input type="text" id="eiaaw-chat-input" placeholder="Ask about our products, ethics, or pricing&hellip;" maxlength="500" autocomplete="off">
        <button type="submit" aria-label="Send">&rarr;</button>
      </form>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.eiaaw-chat-close').addEventListener('click', toggleChat);
    panel.querySelector('#eiaaw-chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = panel.querySelector('#eiaaw-chat-input');
      const v = input.value.trim();
      if (!v) return;
      input.value = '';
      handleUserMessage(v);
    });

    // Seed greeting + quick replies
    addBotMessage("Hi &mdash; I'm the EIAAW assistant. I can explain our products, share our ethics framework, or help you book a session. What brings you here?");
    renderQuickReplies([
      { label: 'Which product fits my team?', msg: 'Which of your four products (Sales Agent, Ai Ads Agency, Workforce, Social Media Team) fits my team?' },
      { label: 'What does it cost?', msg: 'What does each EIAAW product cost?' },
      { label: 'Book a session', action: 'book' },
      { label: 'Talk to the agent', action: 'agent' },
    ]);
  }

  let chatHistory = [];
  function addBotMessage(html) {
    const msgs = document.getElementById('eiaaw-chat-msgs');
    const el = document.createElement('div');
    el.className = 'eiaaw-chat-bubble bot';
    el.innerHTML = html;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    chatHistory.push({ role: 'assistant', content: el.textContent });
  }
  function addUserMessage(text) {
    const msgs = document.getElementById('eiaaw-chat-msgs');
    const el = document.createElement('div');
    el.className = 'eiaaw-chat-bubble user';
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    chatHistory.push({ role: 'user', content: text });
  }
  function addTyping() {
    const msgs = document.getElementById('eiaaw-chat-msgs');
    const el = document.createElement('div');
    el.className = 'eiaaw-chat-bubble bot typing';
    el.id = 'eiaaw-chat-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function removeTyping() {
    document.getElementById('eiaaw-chat-typing')?.remove();
  }
  function renderQuickReplies(items) {
    const qr = document.getElementById('eiaaw-chat-quick');
    qr.innerHTML = '';
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eiaaw-chat-chip';
      btn.textContent = it.label;
      btn.addEventListener('click', () => {
        qr.innerHTML = '';
        if (it.action === 'book') {
          addUserMessage('I\u2019d like to book a session.');
          addBotMessage("Great &mdash; I\u2019ll open a short enquiry form. Fill it in and our team will lock in a time. Want to try the voice agent instead?");
          renderQuickReplies([
            { label: 'Open the form', action: 'form' },
            { label: 'Talk to the agent', action: 'agent' },
          ]);
        } else if (it.action === 'form') {
          openContact({ message: 'I would like to book a session / demo with your team.' });
        } else if (it.action === 'agent') {
          addUserMessage('Talk to the agent.');
          addBotMessage("Connecting you to the AI agent in a new tab&hellip;");
          startAgentCall();
        } else if (it.msg) {
          handleUserMessage(it.msg);
        }
      });
      qr.appendChild(btn);
    });
  }

  // ---------- Pre-chat lead gate ----------
  // The AI never answers until we've captured name + email + phone. Details are
  // sent to the sa CRM as an inbound lead (source chatbot_parent). Asked once
  // per browsing session.
  let gatePassed = false;
  try { gatePassed = sessionStorage.getItem('eiaawChatGate') === '1'; } catch (e) { /* private mode */ }

  function renderGate(pendingText) {
    const msgs = document.getElementById('eiaaw-chat-msgs');
    document.getElementById('eiaaw-chat-quick').innerHTML = '';
    if (document.getElementById('eiaaw-gate')) return;
    const wrap = document.createElement('div');
    wrap.id = 'eiaaw-gate';
    wrap.className = 'eiaaw-chat-bubble bot eiaaw-gate';
    wrap.innerHTML = `
      <p style="margin:0 0 8px">Quick intro before we chat &mdash; so our team can follow up if you'd like.</p>
      <div class="eiaaw-field"><input id="eg-name" type="text" placeholder="Your name" maxlength="120" autocomplete="name"></div>
      <div class="eiaaw-field"><input id="eg-email" type="email" placeholder="Email" maxlength="160" autocomplete="email"></div>
      <div class="eiaaw-field"><input id="eg-phone" type="tel" placeholder="Phone" maxlength="40" autocomplete="tel"></div>
      <div class="eiaaw-field"><input id="eg-company" type="text" placeholder="Company (optional)" maxlength="160" autocomplete="organization"></div>
      <div class="eiaaw-modal-err" id="eg-error" hidden></div>
      ${consentField('eg-consent')}
      <button type="button" class="btn btn-primary" id="eg-submit" style="width:100%">Start chatting <span class="arrow">&rarr;</span></button>`;
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
    wrap.querySelector('#eg-submit').addEventListener('click', () => submitGate(pendingText));
    wrap.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); submitGate(pendingText); }
    }));
    wrap.querySelector('#eg-name').focus();
  }

  async function submitGate(pendingText) {
    const name = document.getElementById('eg-name').value.trim();
    const email = document.getElementById('eg-email').value.trim();
    const phone = document.getElementById('eg-phone').value.trim();
    const company = document.getElementById('eg-company').value.trim();
    const err = document.getElementById('eg-error');
    const showErr = (m) => { err.textContent = m; err.hidden = false; };
    if (!name || !email || !phone) return showErr('Please add your name, email, and phone to continue.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Please enter a valid email address.');
    if (String(phone).replace(/\D/g, '').length < 7) return showErr('Please enter a valid phone number.');
    if (!document.getElementById('eg-consent').checked) return showErr(CONSENT_ERR);
    const btn = document.getElementById('eg-submit');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await fetch(`${API}/api/forms/public/lead-intake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, company, site: 'parent', page: location.pathname, message: consentRecord() }),
      });
      track('generate_lead', 'Lead', { lead_source: 'chat_gate', page: location.pathname });
    } catch (e) { /* soft-fail: never trap the visitor behind a network error */ }
    gatePassed = true;
    try { sessionStorage.setItem('eiaawChatGate', '1'); } catch (e) { /* private mode */ }
    document.getElementById('eiaaw-gate')?.remove();
    if (pendingText) handleUserMessage(pendingText);
  }

  async function handleUserMessage(text) {
    // Hard gate: capture visitor details before the AI answers anything.
    if (!gatePassed) { renderGate(text); return; }
    addUserMessage(text);
    addTyping();
    try {
      const res = await fetch(`${API}/api/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, source: 'eiaawsolutions.com' }),
      });
      const data = await res.json().catch(() => ({}));
      removeTyping();
      if (data.error) {
        addBotMessage(`${escapeHtml(data.error)}<br>You can also email <a href="mailto:eiaawsolutions@gmail.com">eiaawsolutions@gmail.com</a>.`);
      } else {
        addBotMessage(escapeHtml(data.response || "I'm having trouble right now &mdash; please try the contact form."));
      }
      // After every real reply offer next-step actions
      renderQuickReplies([
        { label: 'Book a session', action: 'book' },
        { label: 'Talk to the agent', action: 'agent' },
        { label: 'Send a message', action: 'form' },
      ]);
    } catch (e) {
      removeTyping();
      addBotMessage('I can\u2019t reach the server right now. Please use the form below or email <a href="mailto:eiaawsolutions@gmail.com">eiaawsolutions@gmail.com</a>.');
      renderQuickReplies([{ label: 'Open the form', action: 'form' }]);
    }
  }

  function toggleChat() {
    ensureChatPanel();
    const panel = document.getElementById('eiaaw-chat-panel');
    const open = panel.classList.toggle('open');
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) setTimeout(() => panel.querySelector('#eiaaw-chat-input')?.focus(), 50);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- Cookie choices (drives consent.js) ----------
  // Accept and Reject get equal visual weight — no nudging toward "yes".
  function showConsentBanner() {
    if (!window.EIAAWConsent) return; // page without the consent gate
    let bar = document.getElementById('eiaaw-cookie');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'eiaaw-cookie';
      bar.className = 'eiaaw-cookie';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Cookie choices');
      bar.innerHTML = `
        <p><strong>Your choice.</strong> With your permission we use cookies to see which pages help visitors (Google Analytics) and to measure our ads (Meta). Nothing loads unless you say yes. <a href="/privacy.html#cookies">Details</a></p>
        <div class="eiaaw-cookie-actions">
          <button type="button" class="btn btn-primary" data-consent="all">Accept all</button>
          <button type="button" class="btn btn-outline" data-consent="analytics">Analytics only</button>
          <button type="button" class="btn btn-outline" data-consent="none">Reject all</button>
        </div>`;
      bar.addEventListener('click', (e) => {
        const choice = e.target.closest('[data-consent]')?.dataset.consent;
        if (!choice) return;
        window.EIAAWConsent.set(choice !== 'none', choice === 'all');
        bar.hidden = true;
      });
      document.body.appendChild(bar);
    }
    bar.hidden = false;
  }

  // ---------- Public API ----------
  window.EIAAW = { openContact, closeContact, startAgentCall, toggleChat, showConsentBanner };

  // Click-throughs to the product sites (sa., ads., ep., smt.) are the main way
  // visitors act on this site, but GA's automatic outbound-click tracking can
  // treat sibling subdomains as internal and skip them — so record them here.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || a.hostname === location.hostname || !/\.eiaawsolutions\.com$/.test(a.hostname)) return;
    track('select_content', null, {
      content_type: 'product_site',
      content_id: a.hostname.split('.')[0],
      link_url: a.href,
      page: location.pathname,
    });
  });

  // Hook explicit CTAs
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-eiaaw]');
    if (!t) return;
    const act = t.dataset.eiaaw;
    if (act === 'contact') { e.preventDefault(); openContact(); }
    else if (act === 'agent') { e.preventDefault(); startAgentCall(); }
    else if (act === 'chat') { e.preventDefault(); toggleChat(); }
    else if (act === 'cookies') { e.preventDefault(); showConsentBanner(); }
  });

  // Bind the floating chat toggle
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.chat-toggle').forEach(btn => {
      btn.addEventListener('click', (ev) => { ev.preventDefault(); toggleChat(); }, { capture: true });
    });
    if (window.EIAAWConsent && !window.EIAAWConsent.get()) showConsentBanner();
    maybeOpenFromHash();
  });

  // Deep-link support: #chat opens the chatbot, #contact opens the enquiry form,
  // #agent starts the voice agent. Lets external links (Facebook, email, etc.)
  // land users straight into the channel they came for.
  function maybeOpenFromHash() {
    const h = (window.location.hash || '').toLowerCase();
    if (!h) return;
    if (h === '#chat' || h.startsWith('#chat?')) {
      const panel = document.getElementById('eiaaw-chat-panel');
      if (!panel || !panel.classList.contains('open')) toggleChat();
    } else if (h === '#contact') {
      openContact();
    } else if (h === '#agent') {
      startAgentCall();
    } else if (h === '#cookies') {
      showConsentBanner();
    }
  }
  window.addEventListener('hashchange', maybeOpenFromHash);
})();
