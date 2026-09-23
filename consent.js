/* ============================================================
   EIAAW Solutions — consent gate for analytics + advertising tags
   Loaded synchronously in <head>, before anything else can track.

   Nothing third-party loads until the visitor opts in (Thailand, Vietnam,
   Indonesia, Korea and China expect prior consent for non-essential
   tracking; it is also the safe reading of Malaysia's PDPA). Choices are
   per purpose: analytics (Google Analytics) and advertising (Meta Pixel).
   The banner that collects the choice lives in eiaaw-connect.js.
   ============================================================ */
(function () {
  var GA_ID = 'G-5E80XYYKK7';
  var META_ID = '1516303113491153';
  var KEY = 'eiaawConsent';
  var VERSION = 1;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
  gtag('js', new Date());

  function loadGA() {
    if (window.__eiaawGA) return;
    window.__eiaawGA = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('config', GA_ID);
  }

  function loadMeta() {
    if (window.fbq) { window.fbq('consent', 'grant'); return; }
    /* Standard Meta Pixel bootstrap */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_ID);
    window.fbq('track', 'PageView');
  }

  function apply(c) {
    gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.ads ? 'granted' : 'denied',
      ad_user_data: c.ads ? 'granted' : 'denied',
      ad_personalization: c.ads ? 'granted' : 'denied'
    });
    if (c.analytics) loadGA();
    if (c.ads) loadMeta();
    else if (window.fbq) window.fbq('consent', 'revoke');
  }

  // The choice is also kept in a cookie on .eiaawsolutions.com so product
  // sites (e.g. smt.eiaawsolutions.com, which uses the same GA4 property)
  // honour it without asking again, and vice versa.
  var COOKIE = 'eiaaw_consent';
  var SHARED = /(^|\.)eiaawsolutions\.com$/.test(location.hostname);

  function valid(c) { return c && c.v === VERSION ? c : null; }

  function read() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (m) {
      try { var fromCookie = valid(JSON.parse(decodeURIComponent(m[1]))); if (fromCookie) return fromCookie; } catch (e) { /* fall through */ }
    }
    try { return valid(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return null; }
  }

  function writeCookie(c) {
    document.cookie = COOKIE + '=' + encodeURIComponent(JSON.stringify(c)) + '; max-age=15552000; path=/; SameSite=Lax' +
      (SHARED ? '; domain=.eiaawsolutions.com' : '') + (location.protocol === 'https:' ? '; Secure' : '');
  }

  // Public API for the banner (eiaaw-connect.js).
  window.EIAAWConsent = {
    get: read,
    set: function (analytics, ads) {
      var c = { v: VERSION, analytics: !!analytics, ads: !!ads, ts: new Date().toISOString() };
      try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* private mode: choice lasts this page only */ }
      writeCookie(c);
      apply(c);
      return c;
    }
  };

  var saved = read();
  if (saved) apply(saved);
})();
