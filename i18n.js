// Shared localization helper for 4XS Toolbox.
//
// Loaded first (before any other script) in every extension page (popup,
// options, fov-map, find-cams) and every content script bundle (Product
// Selector, search, product/category pages), so `AxisI18N` is available as
// a plain global wherever this extension injects UI.
//
// Exposes two things:
//   - AxisI18N.langCode: one of the 12 codes popup.js's LANGS list supports
//     (en/cs/ja/es/de/fr/ko/zh/sv/uk/ar/nl) - the language modules with
//     their own multi-language string tables (find-cams.js, find-cams-page.js)
//     key off this.
//   - AxisI18N.isJapanese: the older Japanese-only boolean, kept for the
//     modules that only ever got a Japanese translation pass (content.js,
//     products-content.js, search-content.js, fov-map.js, options.js) -
//     it's just `langCode === "ja"` now, computed the same way as before.
//
// langCode is picked in this order:
//   1. The user has explicitly picked a language from the popup's own
//      dropdown (axisPopupLang in chrome.storage.local - the full
//      12-language picker in popup.js/options.js). This is the strongest
//      signal: an explicit in-extension choice should win over guesses
//      from the browser or the page.
//   2. Japanese-specific heuristics, kept for backward compatibility with
//      the pre-langCode behavior: the user has explicitly selected JPY as
//      their currency (axisCurrency in chrome.storage.local - the same
//      setting the popup's currency toggle writes), the browser's own UI
//      language is Japanese (chrome.i18n.getUILanguage()), or (content
//      scripts only, since this file only has a `location` to look at when
//      it's actually running on an axis.com page) the page itself is the
//      Japanese-locale slice of axis.com, e.g. a URL path starting with
//      /ja-jp/ or /ja/ - same locale-prefix regex already used by
//      localeDefaultCurrency() in content.js/search-content.js/
//      products-content.js for currency defaulting. None of this is
//      generalized to the other 10 non-English languages - URL/currency
//      based auto-detection only ever existed for Japanese.
//   3. The browser's own UI language (chrome.i18n.getUILanguage()), if its
//      primary subtag matches one of the 12 supported codes.
//   4. Dutch ("nl") as the catch-all for everything else - a deliberate
//      choice so an unrecognized browser language is visibly Dutch rather
//      than silently indistinguishable from a browser that's genuinely set
//      to English. Matches the same "unmatched -> nl" rule in popup.js's
//      own detectLangCode().
//
// Each file that needs to react to a change (e.g. currency switched to/from
// JPY, or the language picker changed, while a page is already open) should
// call AxisI18N.onLanguageChange(fn) once at startup and re-render its own
// strings from there - this module only tracks the state and notifies
// listeners, it doesn't touch the DOM itself (each page/content-script
// updates its own UI its own way).
(function (global) {
  "use strict";

  // Must stay in sync with popup.js's LANGS list (the source of truth for
  // which languages this extension supports).
  const SUPPORTED = ["en", "cs", "ja", "es", "de", "fr", "ko", "zh", "sv", "uk", "ar", "nl"];

  function detectAxisUrlJapanese() {
    if (typeof location === "undefined") return false; // extension pages (popup/options/fov-map/find-cams) have no axis.com path to check
    try {
      const m = location.pathname.match(/^\/([a-z]{2})(?:-([a-z]{2}))?(?:\/|$)/i);
      if (!m) return false;
      const lang = m[1].toLowerCase();
      const region = (m[2] || "").toLowerCase();
      return (region || lang) === "jp" || lang === "ja";
    } catch (e) {
      return false;
    }
  }

  function detectBrowserJapanese() {
    try {
      const ui = global.chrome && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage();
      return !!(ui && ui.toLowerCase().startsWith("ja"));
    } catch (e) {
      return false;
    }
  }

  // Any of the 12 supported codes, from the browser's own UI language -
  // null if it doesn't match one we have a translation for.
  function detectBrowserLangCode() {
    try {
      const ui = global.chrome && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage();
      if (!ui) return null;
      const primary = ui.toLowerCase().split("-")[0];
      return SUPPORTED.includes(primary) ? primary : null;
    } catch (e) {
      return null;
    }
  }

  function computeLangCode(storedLang, storedCurrency) {
    if (storedLang && SUPPORTED.includes(storedLang)) return storedLang;
    if (storedCurrency === "JPY" || detectBrowserJapanese() || detectAxisUrlJapanese()) return "ja";
    return detectBrowserLangCode() || "nl";
  }

  let storedCurrency;
  let storedLang;
  let langCode = computeLangCode(undefined, undefined);
  const listeners = [];

  function recompute() {
    const next = computeLangCode(storedLang, storedCurrency);
    if (next !== langCode) {
      langCode = next;
      listeners.forEach((fn) => {
        try {
          fn(langCode);
        } catch (e) {
          /* one listener misbehaving shouldn't break the others */
        }
      });
    }
    return langCode;
  }

  function onLanguageChange(fn) {
    listeners.push(fn);
  }

  const api = {
    get langCode() {
      return langCode;
    },
    get isJapanese() {
      return langCode === "ja";
    },
    onLanguageChange,
  };
  global.AxisI18N = api;

  // Refine the synchronous OS/URL-based guess with the stored language
  // pick and currency choice as soon as they're available, and keep
  // listening for later changes (e.g. the user picks a different language
  // from the popup's dropdown, or flips its currency toggle to/from JPY,
  // while this page or content script is already running).
  if (global.chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["axisCurrency", "axisPopupLang"], (r) => {
      storedCurrency = r.axisCurrency;
      storedLang = r.axisPopupLang;
      recompute();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      let changed = false;
      if (changes.axisCurrency) {
        storedCurrency = changes.axisCurrency.newValue;
        changed = true;
      }
      if (changes.axisPopupLang) {
        storedLang = changes.axisPopupLang.newValue;
        changed = true;
      }
      if (changed) recompute();
    });
  }
})(typeof window !== "undefined" ? window : this);
