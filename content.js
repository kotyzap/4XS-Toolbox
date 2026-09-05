(function () {
  "use strict";

  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};
  let CHIPSETS = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};
  let FOVS = (typeof FOV_DATA !== "undefined" && FOV_DATA.fov) || {};

  // ---------------------------------------------------------------------
  // Japanese localization - see i18n.js (loaded before this file, per
  // manifest.json) for the isJapanese detection logic (JPY currency
  // selected, Japanese browser/OS language, or - the one signal unique to
  // content scripts - this very page being the /ja-jp/ (or /ja/) locale of
  // axis.com, via the same locale-prefix check localeDefaultCurrency() below
  // already uses for currency defaulting).
  // ---------------------------------------------------------------------
  const JA = {
    fovMapToolButton: "FoVマップ",
    quickLinkScanner: "IPスキャナー",
    quickLinkMsrp: "MSRP一覧",
    priceSourceEur: "AXIS Price List (2026年7月, EUR)",
    priceSourceEurApprox: "EURのリスト価格なし — 現在のUSD/EURレートでUSDから概算",
    priceSourceJpy: "USD建てリスト価格からFX換算、USD/JPYリアルタイムレート",
    priceSourceUsd: "AXIS Price List (2026年7月, EUR) からFX換算",
    partNumberSuffix: (part) => ` — 型番 #${part}`,
    variantSuffix: (variant) => ` — ${variant}`,
    noteSuffix: (note) => ` (${note})`,
    samePriceTitle: (sourceLabel, count) => `${sourceLabel} — ${count} バリエーション、同一価格`,
    rangeTitle: (sourceLabel, count, minLabel, maxLabel) =>
      `${sourceLabel} — ${count} バリエーションの価格帯 (${minLabel} 〜 ${maxLabel})`,
    lowest: "最安",
    highest: "最高",
    chipsetTooltipPrefix: "チップセット (CamStreamerアプリ対応データより): ",
    chipsetTooltipCsSuffix: " — CamStreamer対応",
    filterPanelTitle: "フィルター",
    hideChipsetsLabel: "チップセットを非表示",
    hideChipsetsTitle: "各カードのチップセットバッジを非表示にします - 上のチップセットによる絞り込みは引き続き機能します",
    filterPanelToggleTitle: "折りたたむ/展開する",
    sortSeriesLabel: "シリーズを価格の安い順に並べ替え",
    angleFieldLabel: "必要な画角",
    fovOff: "オフ",
    angleSliderTitle: "この角度以上をカバーできるカメラのみ表示します(PTZはパン動作による360°全周対応も含みます)。FOV Mapでコーンを描いた場合と同じ条件です",
    presetCamstreamerLabel: "CamStreamer対応",
    presetCamstreamerTitle: "CamStreamer対応チップセットである ARTPEC-9、ARTPEC-8、ARTPEC-6/7 を選択",
    acapFieldLabel: "ACAP",
    acapBaseballTrackerLabel: "CamStreamer: Baseball Tracker",
    acapBaseballTrackerTitle: "CamStreamerのBaseball Trackerアプリが対応するチップセット (ARTPEC-9、ARTPEC-8) を選択",
    acapPlaneTrackerLabel: "CamStreamer: PlaneTracker",
    acapPlaneTrackerTitle: "CamStreamerのPlaneTrackerアプリが対応するチップセット (ARTPEC-9、ARTPEC-8、ARTPEC-6/7) を選択 (ARTPEC-7要件だが、データ上ARTPEC-6と分離不可)",
    acapLpvV3Label: "AXIS License Plate Verifier (v3.x)",
    acapLpvV3Title: "AXIS License Plate Verifier 3.xが対応する唯一のチップセット、ARTPEC-9とARTPEC-8を選択 (Axisリリースノートより)",
    acapLpvV2Label: "AXIS License Plate Verifier (v2.x)",
    acapLpvV2Title: "AXIS License Plate Verifier 2.xが対応するARTPEC-6/7を選択 (Axisリリースノートより)",
    filterClearButton: "クリア",
    filterCountText: (visible, total) => `${visible} / ${total} 件を表示`,
    compareChipsetRowLabel: "チップセット",
    comparePriceRowLabel: "価格",
    favToggleTitle: "お気に入り登録 - このシリーズ全体がページの一番上に移動します",
    favoritesPanelLabel: "🧡 お気に入り",
    favoritesPanelEmpty: "お気に入りはまだありません - カメラのカードで♡をクリックしてください。",
  };
  const isJa = () => typeof AxisI18N !== "undefined" && AxisI18N.isJapanese;
  function t(key, enFallback, ...args) {
    if (!isJa()) return enFallback;
    const v = JA[key];
    if (v === undefined) return enFallback;
    return typeof v === "function" ? v(...args) : v;
  }

  function normalize(s) {
    return (s || "")
      .toUpperCase()
      // Axis's rebuilt Product Selector (Aug 2026) renders model names with
      // a non-breaking hyphen (U+2011) instead of a plain "-" (also
      // guarding U+2010/2012/2013/2014, other dash look-alikes seen in the
      // wild); the bundled catalog/price list only ever uses plain "-", so
      // without this every hyphenated model name silently failed to match.
      .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-")
      .replace(/®|™/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeBare(s) {
    return normalize(s).replace(/^AXIS\s+/, "");
  }

  // ---------------------------------------------------------------------
  // Favorites - a "♡ -> 🧡" per-model marker on each product card, shared
  // via chrome.storage.local ("axisFavorites", an array of
  // normalizeBare(name) keys) with the toolbar popup, so favoriting a
  // camera anywhere shows it favorited everywhere. Favorited series are
  // reordered to the very top of the Product Selector page (see
  // sortSeriesByPrice further down), and the Filters panel gets its own
  // small "Favorites" list (buildFilterPanel) to review/unfavorite.
  // Declared this early (rather than down by the other filter-panel state)
  // because chrome.storage.local.get() below reads FAVORITES_KEY well
  // before that point in the file - a const/let referenced before its own
  // declaration line runs is a ReferenceError, not just "undefined".
  // ---------------------------------------------------------------------
  const FAVORITES_KEY = "axisFavorites";
  let favorites = new Set();

  // Declared up here for exactly the reason FAVORITES_KEY above is: the
  // chrome.storage.local.get() further down runs at IIFE time and reads
  // CATEGORIES_KEY, and a const referenced before its own declaration line
  // has run is a ReferenceError that kills the whole content script - which
  // is precisely what happened when this block first shipped lower down and
  // the Filters panel stopped appearing altogether. The functions that use
  // these live further down (function declarations hoist; const does not).
  // ---------------------------------------------------------------------
  // Quick-link buttons in the Filters panel.
  //
  // Same buttons and styling as the toolbar popup, so the two surfaces read
  // as one product. No "Selector" link here - this IS the Product Selector
  // page. Nothing in this block filters anything; it sits above the filter
  // controls and is purely navigation.
  //
  // The panel is 220px wide (610px with the FoV Map column open), so buttons
  // go TWO per row - about 84px of content each, the same budget the popup's
  // four-up category row has, which is why the same labels and 12px icons
  // work here unchanged.
  //
  // THIRD COPY of the icon set (popup.js and products-content.js have the
  // other two). Each content script is its own IIFE in its own world, so
  // there is nothing to share with; change one, change all three.
  // ---------------------------------------------------------------------
  const CATEGORIES_KEY = "axisFavoriteCategories";
  const MAX_FAVORITE_CATEGORIES = 4;
  const CATEGORY_LABELS = {
    "network-cameras": "Cameras",
    "network-intercoms": "Intercoms",
    "video-analytics": "Analytics",
    "management-software": "Software",
    "radar-devices": "Radar",
    "accessories": "Extras",
    "access-control": "Access",
    "network-audio": "Audio",
    "body-worn": "Body worn",
    "storage-and-recorders": "Storage",
    "system-devices": "System",
    "explosion-protected-devices": "Ex-proof",
  };
  const CATEGORY_ICONS = {
    "network-cameras":
      '<rect x="3" y="7.5" width="13" height="8.5" rx="2"/><path d="M16 10.5h3.2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H16"/><path d="M9.5 16v3.5M6 20.5h7"/>',
    "network-intercoms":
      '<rect x="6" y="3" width="12" height="18" rx="2.5"/><path d="M9.5 7.5h5M9.5 10.5h5"/><circle cx="12" cy="16" r="2"/>',
    "video-analytics":
      '<path d="M4 8.5V4.5h4M16 4.5h4v4M20 15.5v4h-4M8 19.5H4v-4"/><circle cx="12" cy="10" r="2.2"/><path d="M8.4 17.2a3.6 3.6 0 0 1 7.2 0"/>',
    "management-software":
      '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M3 8.4h18"/><path d="M12 17v4M8.5 21h7"/>',
    "radar-devices":
      '<path d="M4.5 14a7.5 7.5 0 0 1 15 0"/><path d="M8.9 14a3.1 3.1 0 0 1 6.2 0"/><path d="M12 14v6.3M9 20.3h6"/>',
    "accessories":
      '<path d="M17.6 4.6a4.6 4.6 0 0 0-5.8 5.8L4.5 17.7V20h2.3l7.3-7.3a4.6 4.6 0 0 0 5.8-5.8l-2.6 2.6-2.3-2.3z"/>',
    "access-control":
      '<rect x="3" y="5" width="11" height="14" rx="2"/><rect x="5.6" y="8" width="3.6" height="3" rx="0.6"/><path d="M17.6 9.2a4.2 4.2 0 0 1 0 5.6M20.4 6.6a8 8 0 0 1 0 10.8"/>',
    "network-audio":
      '<path d="M3.5 9.5h3L11 6v12L6.5 14.5h-3z"/><path d="M14.6 9.4a4 4 0 0 1 0 5.2M17.4 6.8a7.8 7.8 0 0 1 0 10.4"/>',
    "body-worn":
      '<rect x="5.5" y="3.5" width="11" height="17" rx="2.5"/><circle cx="11" cy="10" r="3"/><path d="M19 7.5h0.5v6H19"/>',
    "storage-and-recorders":
      '<rect x="3" y="5" width="18" height="5.5" rx="1.5"/><rect x="3" y="13.5" width="18" height="5.5" rx="1.5"/><path d="M15 7.75h3M15 16.25h3"/><circle cx="6.6" cy="7.75" r="1" fill="currentColor" stroke="none"/><circle cx="6.6" cy="16.25" r="1" fill="currentColor" stroke="none"/>',
    "system-devices":
      '<circle cx="12" cy="12" r="2.6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><path d="M12 14.6V20M6.5 6.5l3.7 3.7M17.5 6.5l-3.7 3.7"/><circle cx="12" cy="20" r="1.6"/>',
    "explosion-protected-devices":
      '<path d="M12 3l7.6 4.4v8.8L12 20.6 4.4 16.2V7.4z"/><path d="M12 9c1.7 1.8 2.7 3 2.7 4.4a2.7 2.7 0 0 1-5.4 0c0-.9.4-1.7 1.1-2.5"/>',
  };
  const LINK_ICONS = {
    products:
      '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    myaxis:
      '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>',
    // The same glyphs the popup's IP Utility Scanner and Chipset & MSRP
    // tabs use, so a button and its destination look alike.
    scanner:
      '<circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><path d="M12 7.5a4.5 4.5 0 0 1 4.5 4.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/><path d="M4.4 15.6A8.5 8.5 0 0 0 12 20.5"/>',
    msrp:
      '<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10.5" y="10.5" width="3" height="3" rx="0.5"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  };
  let favoriteCategories = [];
  let quickLinksRowsEl = null;

  let renderFavoritesList = null; // set by buildFilterPanel once the panel's Favorites section exists

  function isFavorite(name) {
    return favorites.has(favoriteKeyFor(name));
  }

  function saveFavorites() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [FAVORITES_KEY]: Array.from(favorites) });
    }
  }

  function applyFavoriteBadge(card, name) {
    const fav = isFavorite(name);
    card.classList.toggle("axis-favorited", fav);
    let el = card.querySelector(".axis-fav-badge");
    if (!el) {
      el = document.createElement("span");
      el.className = "axis-fav-badge";
      el.title = t("favToggleTitle", "Favorite this camera - moves its whole series to the top of the page");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(name);
      });
      const target = getImgContainer(card);
      target.appendChild(el);
    }
    el.textContent = fav ? "🧡" : "♡";
  }

  function refreshAllFavoriteBadges() {
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      const nameEl = card.querySelector(NAME_SELECTOR);
      const name = nameEl && nameEl.textContent.trim();
      if (name) applyFavoriteBadge(card, name);
    });
  }

  function toggleFavorite(name) {
    const key = favoriteKeyFor(name);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveFavorites();
    refreshAllFavoriteBadges();
    sortSeriesByPrice(); // re-ranks series - always runs regardless of the price-sort toggle, since favorited-on-top applies either way
    if (renderFavoritesList) renderFavoritesList();
  }

  // strip a trailing frame-rate token like "30 FPS" / "8.3 FPS" from a variant label
  function stripFps(s) {
    return (s || "").replace(/\b\d+(\.\d+)?\s*FPS\b/gi, "").trim();
  }

  // JPY prices read as long strings of digits (¥372,274) compared to EUR/USD,
  // so they're rounded up to the nearest 1,000 yen and expressed in 万 (man,
  // 10,000) units instead - e.g. ¥372,274 -> ¥37.3万. Trailing ".0" is
  // dropped for round-万 amounts.
  function fmtJpyMan(n) {
    const rounded = Math.ceil(n / 1000) * 1000;
    let man = (rounded / 10000).toFixed(1);
    if (man.endsWith(".0")) man = man.slice(0, -2);
    return "¥" + man + "万";
  }

  // EUR is the one "final" defined price (the actual AXIS Price List figure);
  // USD, GBP, and JPY are always FX-derived at whatever rate happened to be
  // in effect, so they're approximations, not list prices - round to whole
  // units (no cents) to avoid implying false precision.
  function fmtPrice(n, currency, exact, approx) {
    const prefix = approx ? "~" : "";
    if (currency === "JPY") return prefix + fmtJpyMan(n);
    if (currency === "USD") {
      const digits = Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
      return prefix + "$" + digits;
    }
    if (currency === "GBP") {
      const digits = Math.round(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
      return prefix + "£" + digits;
    }
    return prefix + "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // "USD" uses each variant's msrp field - the catalog's base price, sourced
  // from Axis's public Q1/Q2 2026 comparison-table price list (USD), with a
  // subset of products carrying August 2026 US$ updates on top (see
  // catalog-data.js). "EUR" uses msrp_eur, which is only present on the
  // subset of products with an August 2026 EUR update. "JPY" has no
  // baked-in field at all - it's derived live from msrp (USD) using
  // whatever USD/JPY rate background.js last cached (see fxRates below),
  // computed on the fly instead of at bundle-build time.
  // Locale-based first-run default: if the user has never explicitly picked
  // a currency, infer one from the page's own locale prefix (e.g. /ja-jp/,
  // /en-us/) rather than always defaulting to EUR - Japanese locales get
  // JPY, Americas locales get USD, everything else (including bare/no
  // locale prefix) keeps the original EUR default.
  function localeDefaultCurrency() {
    const m = location.pathname.match(/^\/([a-z]{2})(?:-([a-z]{2}))?(?:\/|$)/i);
    if (!m) return null;
    const lang = m[1].toLowerCase();
    const region = (m[2] || "").toLowerCase();
    const code = region || lang;
    if (code === "jp" || lang === "ja") return "JPY";
    if (code === "gb" || code === "uk") return "GBP";
    const AMERICAS = ["us", "ca", "mx", "br", "ar", "cl", "co", "pe", "cr", "do", "gt", "ec", "uy", "pa", "bo", "py", "sv", "hn", "ni", "ve", "pr"];
    if (AMERICAS.includes(code)) return "USD";
    return "EUR";
  }

  let currentCurrency = "EUR";
  // "OFF" = the user chose to hide prices entirely (a 4th option in the
  // popup's currency toggle). Everything else about the extension keeps
  // working - chipset badges, FOV filtering, cheapest-first sorting - only
  // the price *display* is suppressed. Prices are still computed, because
  // the sort order and the series-vs-single-model badge logic depend on
  // them; see the individual guards below.
  const pricesHidden = () => currentCurrency === "OFF";
  let fxRates = null; // { usd, jpy, date } - populated from chrome.storage.local

  // Resolves the price to show for one variant in the currently selected
  // currency. EUR uses the real msrp_eur list price when the catalog has
  // one; when it doesn't (a chunk of SKUs - mostly US/Canada-only and
  // 2N-branded products - have no EUR list price at all), it falls back to
  // FX-converting the USD figure instead of showing nothing, marked
  // approx:true so the caller can flag it with a "~" prefix. JPY has no
  // baked-in field at all - it's always FX-derived from USD, so it's
  // always approx:true. Returns null only when there's truly no price to
  // show (missing msrp, or FX rate not cached yet for the EUR/JPY fallback).
  function resolvePrice(v) {
    if (currentCurrency === "EUR") {
      if (v.msrp_eur != null) return { value: v.msrp_eur, approx: false };
      if (v.msrp != null && fxRates && typeof fxRates.usd === "number") {
        return { value: v.msrp / fxRates.usd, approx: true }; // USD ÷ (USD-per-EUR) = EUR
      }
      return null;
    }
    if (currentCurrency === "JPY") {
      if (v.msrp != null && fxRates && typeof fxRates.jpy === "number" && typeof fxRates.usd === "number") {
        return { value: v.msrp * (fxRates.jpy / fxRates.usd), approx: true }; // JPY-per-EUR ÷ USD-per-EUR = JPY-per-USD
      }
      return null;
    }
    if (currentCurrency === "GBP") {
      if (v.msrp != null && fxRates && typeof fxRates.gbp === "number" && typeof fxRates.usd === "number") {
        return { value: v.msrp * (fxRates.gbp / fxRates.usd), approx: true }; // GBP-per-EUR ÷ USD-per-EUR = GBP-per-USD
      }
      return null;
    }
    if (v.msrp != null) return { value: v.msrp, approx: false };
    return null;
  }

  // ---------------------------------------------------------------------
  // Price matching (base: public Axis Q1/Q2 2026 price list, USD; a subset of
  // products also carry August 2026 US$/EUR updates - see catalog-data.js)
  // ---------------------------------------------------------------------

  const modelKeys = Object.keys(MODELS);
  const normIndex = new Map();
  const canonicalByNorm = new Map();
  for (const key of modelKeys) {
    normIndex.set(normalize(key), MODELS[key]);
    canonicalByNorm.set(normalize(key), key);
  }
  const sortedNormKeys = Array.from(normIndex.keys()).sort((a, b) => b.length - a.length);

  // Resolves any display name (a short catalog-exact name like "AXIS M1135
  // Mk II" from this page's own cards, or a longer variant like "AXIS M1135
  // Mk II Box Camera" as shown elsewhere on axis.com - e.g. product/category
  // pages) to the one canonical catalog key, using the exact same
  // exact/prefix-match resolution as findMatch() below. Favorites are keyed
  // off this canonical name (normalizeBare'd) rather than each surface's own
  // raw display text, so favoriting a camera on one page is recognized as
  // the same camera everywhere else on the site - different pages otherwise
  // show different-length names for what's really the same catalog model,
  // which silently produced different (mismatched) favorite keys before.
  function favoriteKeyFor(displayName) {
    const norm = normalize(displayName);
    if (canonicalByNorm.has(norm)) return normalizeBare(canonicalByNorm.get(norm));
    for (const key of sortedNormKeys) {
      if (norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return normalizeBare(canonicalByNorm.get(key));
      }
    }
    let bestKey = null;
    for (const key of sortedNormKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    // No catalog match at all (e.g. a name the extension doesn't recognize) -
    // fall back to the raw name itself rather than returning nothing, so
    // favoriting still works, just without cross-page name normalization.
    return normalizeBare(bestKey ? canonicalByNorm.get(bestKey) : displayName);
  }

  function findMatch(displayName) {
    const norm = normalize(displayName);
    if (normIndex.has(norm)) {
      return { variants: normIndex.get(norm), remainder: "" };
    }
    for (const key of sortedNormKeys) {
      if (norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return { variants: normIndex.get(key), remainder: norm.slice(key.length).trim() };
      }
    }
    let bestKey = null;
    for (const key of sortedNormKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    if (bestKey) return { variants: normIndex.get(bestKey), remainder: "" };
    return null;
  }

  function isBulkPack(v) {
    return !!(v.note && /\bpcs\b/i.test(v.note));
  }

  // Adds model keys the current catalog has never seen (an uploaded price
  // list can name products this extension's bundled catalog-data.js
  // predates), keyed exactly the way materializeNewProducts() in options.js
  // built them. Unlike price overrides on existing SKUs, brand-new keys also
  // have to be registered into the lookup indices above - those were built
  // once from the bundled MODELS at script load, before this ever runs, so a
  // plain MODELS[key] = ... assignment alone would leave findMatch()/
  // favoriteKeyFor() unable to find it.
  function registerNewProducts(newProducts) {
    if (!newProducts) return;
    let added = false;
    for (const key in newProducts) {
      if (MODELS[key]) continue; // already present (bundled or a prior update)
      MODELS[key] = newProducts[key];
      modelKeys.push(key);
      const norm = normalize(key);
      normIndex.set(norm, MODELS[key]);
      canonicalByNorm.set(norm, key);
      sortedNormKeys.push(norm);
      added = true;
    }
    if (added) sortedNormKeys.sort((a, b) => b.length - a.length);
  }

  // Applies a chrome.storage.local "catalogOverride" record (written by the
  // options page after a monthly .xls drop) onto the bundled catalog in
  // place, keyed by each variant's own part_number. MODELS is shared by
  // reference with normIndex/findMatch, so this reaches every lookup path
  // without rebuilding any index.
  function applyCatalogOverride(override) {
    if (!override) return;
    registerNewProducts(override.newProducts);
    if (!override.overrides) return;
    for (const model in MODELS) {
      for (const v of MODELS[model]) {
        const o = v.part_number && override.overrides[v.part_number];
        if (o) {
          // Only touch fields the override actually carries - a USD-sourced
          // monthly update has no msrp_eur key, and must not blank out
          // whatever EUR price the variant already had.
          if (o.msrp_eur !== undefined) v.msrp_eur = o.msrp_eur;
          if (o.msrp !== undefined) v.msrp = o.msrp;
          if (o.msrp_display !== undefined) v.msrp_display = o.msrp_display;
          // msrp_exact marks a directly-sourced USD price (no FX conversion).
          // Reset it whenever a new override touches msrp but doesn't itself
          // carry msrp_exact:true, so a stale flag from an earlier USD upload
          // can't linger after a later EUR/JPY upload.
          if (o.msrp_exact !== undefined) v.msrp_exact = o.msrp_exact;
          else if (o.msrp !== undefined) v.msrp_exact = false;
        }
      }
    }
  }

  function pickVariant(match) {
    let variants = match.variants.filter((v) => resolvePrice(v) != null);
    if (variants.length === 0) return null;
    const singleUnit = variants.filter((v) => !isBulkPack(v));
    if (singleUnit.length > 0) variants = singleUnit;
    if (variants.length === 1) return { single: variants[0] };

    const remainder = match.remainder;
    if (remainder) {
      for (const v of variants) {
        if (!v.variant) continue;
        const lens = normalize(stripFps(v.variant));
        if (lens && remainder.includes(lens)) return { single: v };
      }
    }
    let min = variants[0], max = variants[0];
    let minP = resolvePrice(min).value, maxP = resolvePrice(max).value;
    for (const v of variants) {
      const p = resolvePrice(v).value;
      if (p < minP) { min = v; minP = p; }
      if (p > maxP) { max = v; maxP = p; }
    }
    return { range: { min, max, count: variants.length } };
  }

  function priceBadgeFor(name) {
    const match = findMatch(name);
    if (!match) return null;
    const picked = pickVariant(match);
    if (!picked) return null;

    if (picked.single) {
      const v = picked.single;
      const resolved = resolvePrice(v);
      if (!resolved) return null; // rate not cached yet for the EUR/JPY fallback
      const { value: val, approx } = resolved;
      const exact = currentCurrency === "USD" && !!v.msrp_exact;
      const sourceLabel =
        currentCurrency === "EUR"
          ? approx
            ? t("priceSourceEurApprox", "No EUR list price — estimated from USD at the current USD/EUR rate")
            : t("priceSourceEur", "AXIS Price List (EUR)")
          : currentCurrency === "JPY"
          ? t("priceSourceJpy", "FX-derived from USD list price, live USD/JPY rate")
          : currentCurrency === "GBP"
          ? t("priceSourceGbp", "FX-derived from USD list price, live USD/GBP rate")
          : exact
          ? t("priceSourceUsdExact", "AXIS US Price List (direct USD)")
          : t("priceSourceUsd", "FX-derived from AXIS Price List (Jul 2026, EUR)");
      let title = sourceLabel;
      if (v.part_number) title += t("partNumberSuffix", " — Part #" + v.part_number, v.part_number);
      if (v.variant) title += t("variantSuffix", " — " + v.variant, v.variant);
      if (v.note) title += t("noteSuffix", " (" + v.note + ")", v.note);
      return { text: fmtPrice(val, currentCurrency, exact, approx), title, minPrice: val };
    }

    const { min, max, count } = picked.range;
    const minResolved = resolvePrice(min);
    const maxResolved = resolvePrice(max);
    if (!minResolved || !maxResolved) return null;
    const minVal = minResolved.value, maxVal = maxResolved.value;
    const rangeApprox = minResolved.approx || maxResolved.approx;
    const rangeExact = currentCurrency === "USD" && !!min.msrp_exact && !!max.msrp_exact;
    const sourceLabel =
      currentCurrency === "EUR"
        ? rangeApprox
          ? t("priceSourceEurApprox", "No EUR list price — estimated from USD at the current USD/EUR rate")
          : t("priceSourceEur", "AXIS Price List (EUR)")
        : currentCurrency === "JPY"
        ? t("priceSourceJpy", "FX-derived from USD list price, live USD/JPY rate")
        : currentCurrency === "GBP"
        ? t("priceSourceGbp", "FX-derived from USD list price, live USD/GBP rate")
        : rangeExact
        ? t("priceSourceUsdExact", "AXIS US Price List (direct USD)")
        : t("priceSourceUsd", "FX-derived from AXIS Price List (Jul 2026, EUR)");
    if (minVal === maxVal) {
      return {
        text: fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox),
        title: t("samePriceTitle", sourceLabel + " — " + count + " variants, same price", sourceLabel, count),
        minPrice: minVal,
      };
    }
    const text = fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox) + "–" + fmtPrice(maxVal, currentCurrency, rangeExact, rangeApprox);
    const lowestWord = t("lowest", "lowest");
    const highestWord = t("highest", "highest");
    const minLabel = min.variant || min.part_number || lowestWord;
    const maxLabel = max.variant || max.part_number || highestWord;
    const title = t(
      "rangeTitle",
      sourceLabel + " — range across " + count + " variants (" + minLabel + " to " + maxLabel + ")",
      sourceLabel,
      count,
      minLabel,
      maxLabel
    );
    return { text, title, minPrice: minVal };
  }

  // ---------------------------------------------------------------------
  // Chipset matching (CamStreamer supported-camera data)
  // ---------------------------------------------------------------------

  let chipsetIndex = new Map();
  let sortedChipsetKeys = [];

  function rebuildChipsetIndex() {
    chipsetIndex = new Map();
    for (const key of Object.keys(CHIPSETS)) {
      chipsetIndex.set(normalize(key), CHIPSETS[key]);
    }
    sortedChipsetKeys = Array.from(chipsetIndex.keys()).sort((a, b) => b.length - a.length);
  }
  rebuildChipsetIndex();

  function lookupChipset(norm) {
    if (chipsetIndex.has(norm)) return chipsetIndex.get(norm);
    for (const key of sortedChipsetKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return chipsetIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedChipsetKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    return bestKey ? chipsetIndex.get(bestKey) : null;
  }

  function chipsetFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupChipset(norm);
    if (direct) return direct;
    // Axis stainless/marine variants insert an "S" right after the dash
    // (e.g. Q3538-SLVE vs the base Q3538-LVE), but CamStreamer doesn't
    // always list the marine SKU separately. When it does list both, they
    // share the same chipset (e.g. M4337-PLVE / M4337-SPLVE are both
    // ARTPEC-9), so falling back to the base variant here is a reasonable bet.
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupChipset(demarined) : null;
  }

  // ---------------------------------------------------------------------
  // Field-of-view matching (fov-data.js - starts empty, populated over time;
  // see that file's header comment for how entries get added)
  // ---------------------------------------------------------------------

  let fovIndex = new Map();
  let sortedFovKeys = [];

  function rebuildFovIndex() {
    fovIndex = new Map();
    for (const key of Object.keys(FOVS)) {
      fovIndex.set(normalize(key), FOVS[key]);
    }
    sortedFovKeys = Array.from(fovIndex.keys()).sort((a, b) => b.length - a.length);
  }
  rebuildFovIndex();

  function lookupFov(norm) {
    if (fovIndex.has(norm)) return fovIndex.get(norm);
    for (const key of sortedFovKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return fovIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedFovKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) {
        bestKey = key;
      }
    }
    return bestKey ? fovIndex.get(bestKey) : null;
  }

  // Returns { min, max } (degrees, horizontal) or null if we have no data for
  // this model yet. Same base/marine-variant fallback as chipsetFor.
  function fovFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupFov(norm);
    if (direct) return direct;
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupFov(demarined) : null;
  }

  // ---------------------------------------------------------------------
  // FOV map filter - camera classification & coverable-angle logic, ported
  // as-is from fov-map.js (see that file's own comments) so the floating
  // map panel on this page matches the standalone tool's semantics exactly:
  // a PTZ's "coverable" angle is the full 360° it can pan across, not its
  // optical zoom width.
  // ---------------------------------------------------------------------

  const MULTISENSOR_MODELS = new Set([
    "P3747-PLVE",
    "M4327-P",
    "P3818-PVE",
    "P4708-PLVE",
  ]);

  function cameraClassOf(section, fov) {
    if (fov && fov.min === 360 && fov.max === 360) return "panoramic";
    if (/pan\/tilt\/zoom/i.test(section || "")) return "ptz";
    if (/panoramic/i.test(section || "")) return "panoramic";
    if (fov && fov.max >= 180) return "panoramic";
    return "fixed";
  }

  function coverableAngle(row) {
    if (!row.fov) return null;
    return row.cameraClass === "ptz" ? 360 : row.fov.max;
  }

  // Presets: chipset labels covered by CamStreamer ACAPs (ARTPEC 6 through 9;
  // 6 and 7 share one combined bucket in our data since CamStreamer's own
  // compatibility listing doesn't separate them). Declared here (rather than
  // down with the other filter-panel presets) because MAP_CATALOG_ROWS below
  // needs it too.
  const CAMSTREAMER_ACAPS_PRESET = ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"];

  // One row per model+variant, carrying just what the map-filter match needs:
  // the bare (normalized, "AXIS " stripped) model name that card.dataset.axisModel
  // is set to, plus the coverable angle and CamStreamer support flag.
  const MAP_CATALOG_ROWS = [];
  for (const modelKey of Object.keys(MODELS)) {
    for (const entry of MODELS[modelKey]) {
      const displayName = entry.variant ? `${modelKey} ${entry.variant}` : modelKey;
      const bare = normalizeBare(modelKey);
      const fov = fovFor(displayName);
      const chipset = chipsetFor(displayName);
      const cameraClass = cameraClassOf(entry.section, fov);
      const row = {
        bare,
        fov,
        camstreamerSupported: chipset ? CAMSTREAMER_ACAPS_PRESET.includes(chipset) : false,
        cameraClass,
      };
      row.coverable = coverableAngle(row);
      MAP_CATALOG_ROWS.push(row);
    }
  }

  // ---------------------------------------------------------------------
  // DOM injection
  // ---------------------------------------------------------------------

  const PROCESSED_ATTR = "data-axis-msrp-done";
  // Axis rebuilt the Product Selector's markup (Aug 2026) and dropped the
  // old BEM-style classnames (productCardDesktop__*, productLayout__*,
  // productSelector__*) in favor of unnamed/auto-generated Tailwind utility
  // classes that offer nothing stable to select on. Cards and series
  // wrappers are instead identified by Axis's own URL routing convention -
  // a link to /support/tools/product-selector/product/<id> - which is far
  // less likely to churn than generated utility classes. Each card has two
  // such links (one wrapping the thumbnail image, one wrapping the visible
  // name); :has() tells them apart by whether they contain an <img>.
  const PRODUCT_LINK_SELECTOR = 'a[href*="/support/tools/product-selector/product/"]';
  const CARD_SELECTOR = `article:has(${PRODUCT_LINK_SELECTOR})`;
  const NAME_SELECTOR = `${PRODUCT_LINK_SELECTOR}:not(:has(img))`;
  const IMG_CONTAINER_SELECTOR = `${PRODUCT_LINK_SELECTOR}:has(img)`;

  // Marker class applied to whatever IMG_CONTAINER_SELECTOR resolves to, so
  // badge positioning (content.css) doesn't depend on an Axis classname
  // either - see getImgContainer() below.
  const IMG_CONTAINER_CLASS = "axis-img-container";
  function getImgContainer(card) {
    const el = card.querySelector(IMG_CONTAINER_SELECTOR) || card;
    el.classList.add(IMG_CONTAINER_CLASS);
    return el;
  }

  // ---------------------------------------------------------------------
  // Series grouping: sort-by-price and hide-empty-series
  // ---------------------------------------------------------------------

  function loadBoolSetting(key, defaultVal) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultVal;
      return raw === "1";
    } catch (e) {
      return defaultVal;
    }
  }
  function saveBoolSetting(key, val) {
    try {
      localStorage.setItem(key, val ? "1" : "0");
    } catch (e) {
      /* ignore quota/availability errors */
    }
  }

  let sortEnabled = loadBoolSetting("axisSortSeriesV1", true);
  // Always on now - no longer user-configurable (was a checkbox in the panel).
  const hideEmptySeries = true;
  // "Hide Chipsets" - hides only the visible chipset badge (like the
  // currency toggle's "hide prices" OFF state does for prices). Filtering
  // and sorting still work off data-axis-chipset, which is set either way.
  let chipsetsHidden = loadBoolSetting("axisChipsetsHiddenV1", false);
  let originalSeriesOrder = null;

  // No stable "series wrapper" class/link exists anymore (see note above),
  // so wrappers are derived from the cards themselves: each card's nearest
  // <section> ancestor is its series wrapper. The order-based reorder
  // below only has a visual effect on a flex/grid parent - the real shared
  // parent of every wrapper turned out to be a plain block list on the
  // rebuilt site, which silently ignored `order` - so it's switched to
  // flex column once, the first time it's seen.
  let seriesParentPrepped = null;
  function getSeriesWrappers() {
    const wrappers = new Set();
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      const wrapper = card.closest("section") || card.parentElement;
      if (wrapper) wrappers.add(wrapper);
    });
    const list = Array.from(wrappers);
    if (list.length) {
      const parent = list[0].parentElement;
      if (parent && parent !== seriesParentPrepped) {
        parent.style.display = "flex";
        parent.style.flexDirection = "column";
        seriesParentPrepped = parent;
      }
    }
    return list;
  }

  function captureOriginalSeriesOrderOnce() {
    if (originalSeriesOrder) return;
    const wrappers = getSeriesWrappers();
    if (wrappers.length > 5) originalSeriesOrder = wrappers;
  }

  // Only counts cards that are currently visible (i.e. not hidden by the
  // chipset filter), so series rank by the cheapest item you can actually
  // see right now, not by a hidden/filtered-out SKU elsewhere in the series.
  // Callers must apply the chipset filter first so card.style.display is current.
  function wrapperMinPrice(wrapper) {
    let min = Infinity;
    wrapper.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (card.style.display === "none") return;
      const p = parseFloat(card.dataset.axisPrice);
      if (!isNaN(p) && p < min) min = p;
    });
    return min;
  }

  // The series container is a flex layout whose own React code re-renders and
  // reconciles child DOM order (it appears to virtualize/window the ~60
  // series for performance). Physically moving nodes with appendChild fights
  // that reconciliation - our move wins for a moment, then a later re-render
  // silently restores some or all wrappers to their original position,
  // producing a half-sorted, half-original order. Setting the CSS `order`
  // property instead reorders visually without moving any DOM node, so
  // there's nothing for React (or our own MutationObserver, which only
  // watches childList) to fight over or undo.
  function applyOrderRanks(rankedWrappers) {
    rankedWrappers.forEach((w, i) => {
      const rank = String(i);
      if (w.style.order !== rank) w.style.order = rank;
    });
  }

  // Same "currently visible only" rule as wrapperMinPrice - a favorited
  // model hidden by the active chipset/angle filter doesn't drag its whole
  // series to the top of a list you can't even see it in right now.
  function wrapperHasFavorite(wrapper) {
    return Array.from(wrapper.querySelectorAll(CARD_SELECTOR)).some(
      (card) => card.style.display !== "none" && favorites.has(card.dataset.axisModel)
    );
  }

  // Favorited series always rank above non-favorited ones (this is the
  // "Category with hearts on top of the page" behavior) - independent of
  // the "sort series by cheapest price" checkbox, which only decides how
  // the two groups (favorited / not) are each ordered internally: by price
  // when that checkbox is on, or back to the page's own original order
  // when it's off.
  function sortSeriesByPrice() {
    const wrappers = getSeriesWrappers();
    const originalIndex = new Map();
    (originalSeriesOrder || wrappers).forEach((w, i) => originalIndex.set(w, i));
    const ranked = wrappers.map((w) => ({
      w,
      fav: wrapperHasFavorite(w) ? 0 : 1,
      price: wrapperMinPrice(w),
      orig: originalIndex.has(w) ? originalIndex.get(w) : Number.MAX_SAFE_INTEGER,
    }));
    ranked.sort((a, b) => {
      if (a.fav !== b.fav) return a.fav - b.fav;
      return sortEnabled ? a.price - b.price : a.orig - b.orig;
    });
    applyOrderRanks(ranked.map((x) => x.w));
  }

  function updateSeriesVisibility() {
    const wrappers = getSeriesWrappers();
    if (!hideEmptySeries) {
      wrappers.forEach((w) => w.style.removeProperty("display"));
      return;
    }
    wrappers.forEach((w) => {
      const anyVisible = Array.from(w.querySelectorAll(CARD_SELECTOR)).some(
        (c) => c.style.display !== "none"
      );
      w.style.display = anyVisible ? "" : "none";
    });
  }

  function applyChipsetLabel(card, name) {
    const label = chipsetFor(name);
    let el = card.querySelector(".axis-chipset-badge");
    if (!label) {
      if (el) el.remove();
      card.removeAttribute("data-axis-chipset");
      return;
    }
    if (chipsetsHidden) {
      // Filtering/sorting by chipset still needs data-axis-chipset - only
      // the visible badge itself is suppressed.
      if (el) el.remove();
      card.setAttribute("data-axis-chipset", label);
      return;
    }
    if (!el) {
      el = document.createElement("span");
      el.className = "axis-chipset-badge";
      const target = getImgContainer(card);
      target.appendChild(el);
    }
    // A green stroke on the dark badge turned out too subtle to notice at a
    // glance, so CamStreamer ACAPs support (ARTPEC-9/8/6-7) is flagged with
    // a checkmark appended to the label text instead.
    const acapSupported = CAMSTREAMER_ACAPS_PRESET.includes(label);
    el.textContent = acapSupported ? label + " ✅" : label;
    el.title =
      t("chipsetTooltipPrefix", "Chipset (via CamStreamer app-compatibility data): ") + label +
      (acapSupported ? t("chipsetTooltipCsSuffix", " — CamStreamer Support") : "");
    card.setAttribute("data-axis-chipset", label);
  }

  // Re-applies every already-processed card's chipset badge under the
  // current chipsetsHidden setting, the same way refreshPriceBadges() does
  // for a live currency/hide-prices change.
  function refreshChipsetBadges() {
    observer.disconnect();
    try {
      document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
        if (!card.hasAttribute(PROCESSED_ATTR)) return;
        const nameEl = card.querySelector(NAME_SELECTOR);
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        if (!name) return;
        applyChipsetLabel(card, name);
      });
      injectProductPageBadges();
    } finally {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ---------------------------------------------------------------------
  // Standalone comparison page (axis.com/support/tools/product-selector/
  // comparison) - like the grid above, Axis's Aug 2026 rebuild replaced the
  // old BEM classnames (.compare__container, .compare__accordion-title-fixed,
  // .compare__property-title, etc.) with unnamed Tailwind utility classes.
  // Two things on this page have no non-visual hook at all and are still
  // matched by their current classes below (getCompare2Template) - if Axis
  // reshuffles those, this fails soft (returns early, retried on the next
  // mutation) rather than throwing. Everything else - which product is in
  // which column - is derived without any classname: this page renders
  // exactly one <article> per compared product (nothing else on the page
  // uses that tag), and each article's product name is its only leaf <div>
  // with text (no link wraps it here, unlike the grid).
  // ---------------------------------------------------------------------

  const COMPARE2_PROCESSED_ATTR = "data-axis-compare2-done";

  function getCompare2Container(root) {
    // Critical guard: the grid page (product-selector's own root URL) also
    // uses <article> for every one of its ~470 product cards, so without
    // this check this function would grab the wrong "container" there and
    // corrupt the grid instead of a no-op. Only the standalone comparison
    // route may run any of this.
    if (!location.pathname.includes("/product-selector/comparison")) return null;
    const scope = root || document;
    const art = scope.querySelector("article");
    return art ? art.closest("main") : null;
  }

  function getCompare2Names(container) {
    return Array.from(container.querySelectorAll("article"))
      .map((art) => {
        const leaf = Array.from(art.querySelectorAll("div")).find(
          (d) => d.children.length === 0 && d.textContent.trim()
        );
        return leaf ? leaf.textContent.trim() : "";
      })
      .filter(Boolean);
  }

  // Favorite hearts on the comparison page's own header cards - reuses
  // applyFavoriteBadge() as-is (same toggle/storage/sync behavior as the
  // grid), just against these <article> cards instead of grid CARD_SELECTOR
  // cards. IMG_CONTAINER_SELECTOR doesn't match here, so
  // applyFavoriteBadge() falls back to appending onto the article itself
  // (already position:relative); "axis-compare2-card" repositions it via
  // CSS to the top-left corner so it doesn't collide with the "✕" remove
  // button the site itself already puts top-right. Runs on every pass
  // (not gated by the rows fingerprint) since favorite state can change at
  // any time from the popup, and re-render can wipe these same as the rows.
  function injectCompare2Favorites(container) {
    container.querySelectorAll("article").forEach((art) => {
      const leaf = Array.from(art.querySelectorAll("div")).find(
        (d) => d.children.length === 0 && d.textContent.trim()
      );
      const name = leaf && leaf.textContent.trim();
      if (!name) return;
      art.classList.add("axis-compare2-card");
      applyFavoriteBadge(art, name);
    });
  }

  // The first category's first subsection ("Image sensor" for cameras,
  // "Streaming" for switches, etc.), used as a clone template to get
  // pixel-identical markup. Structure (current build):
  //   subsection                          .flex.flex-col.gap-s
  //     └ header block                    subsection.children[0]
  //         └ header text                 .children[0]
  //     └ rows container                  subsection.children[1]
  //         └ row                         .children[0] (only the first is kept)
  //             └ row grid                row.children[0]
  //                 ├ label cell wrap     .children[0]
  //                 │   └ label text      .children[0]
  //                 └ values cell wrap    .children[1]
  //                     └ values row      .children[0]
  //                         └ cell wrap × N, each .children[0] is the value text
  function getCompare2Template(container) {
    // ".flex.flex-col.gap-s" alone also matches each header <article> card
    // itself (its own class list happens to contain that same substring),
    // so the first true match has to explicitly skip anything inside one.
    const subsection = Array.from(container.querySelectorAll(".flex.flex-col.gap-s")).find(
      (el) => !el.closest("article")
    );
    if (!subsection || subsection.children.length < 2) return null;
    const rowsContainer = subsection.children[1];
    const row = rowsContainer.children[0];
    if (!row) return null;
    const rowGrid = row.children[0];
    if (!rowGrid || rowGrid.children.length < 2) return null;
    return { subsection, rowsContainer, row, rowGrid };
  }

  function buildCompare2Section(labelText, kind, cellTexts, names, template) {
    const wrap = template.subsection.cloneNode(true);
    wrap.classList.add("axis-compare2-row");

    const headerBlock = wrap.children[0];
    const headerText = headerBlock && headerBlock.children[0];
    if (headerText) headerText.textContent = labelText;

    const rowsContainer = wrap.children[1];
    const row = rowsContainer.children[0]; // keep only the template's first row
    rowsContainer.innerHTML = "";
    rowsContainer.appendChild(row);

    const rowGrid = row.children[0];
    const labelCellWrap = rowGrid.children[0];
    const rowLabelTextEl = labelCellWrap && labelCellWrap.children[0];
    if (rowLabelTextEl) rowLabelTextEl.textContent = labelText;

    const valuesCellWrap = rowGrid.children[1];
    const valuesRow = valuesCellWrap && valuesCellWrap.children[0];
    if (!valuesRow) return wrap;

    // Re-use the real per-column cells rather than building new elements
    // from scratch - React lays this out with per-column sizing that isn't
    // reproducible from nothing, so content is overwritten in place instead.
    const cells = Array.from(valuesRow.children);
    const displayed = cellTexts.map((v) => (v == null ? "–" : v));
    cells.forEach((cell, i) => {
      cell.classList.add("axis-compare2-cell");
      cell.dataset.axisCompare2Kind = kind;
      cell.dataset.axisCompare2Name = names[i] || "";
      const textEl = cell.children[0] || cell;
      textEl.textContent = i < displayed.length ? displayed[i] : "–";
    });

    return wrap;
  }

  // Re-runs whenever the product set on the page changes (tracked via a
  // fingerprint of the compared product names, since this is a client-routed
  // SPA page and our own MutationObserver-driven scheduleInject() can fire
  // many times against the same product set before anything meaningful
  // changes). teardownComparisonTable2() forces a rebuild on currency/
  // chipset/catalog-override updates, which don't change the fingerprint.
  function injectComparisonTable2(root) {
    const container = getCompare2Container(root);
    if (!container) return;

    const names = getCompare2Names(container);
    if (names.length === 0) return;

    injectCompare2Favorites(container);

    const fingerprint = names.join("|");
    // Also rebuild if the fingerprint still matches but our rows are gone -
    // this page's own React re-renders can silently wipe injected nodes out
    // (same reconciliation issue noted for series reordering above) even
    // when the compared product set hasn't changed, and the fingerprint
    // alone can't tell that apart from "already up to date".
    const alreadyInjected = container.getAttribute(COMPARE2_PROCESSED_ATTR) === fingerprint;
    if (alreadyInjected && container.querySelector(".axis-compare2-row")) return;
    container.querySelectorAll(".axis-compare2-row").forEach((el) => el.remove());

    const template = getCompare2Template(container);
    if (!template) return; // rows not rendered yet, or Axis reshuffled the layout - retry on the next mutation

    const priceCells = [];
    const chipsetCells = [];
    let anyPrice = false;
    let anyChipset = false;

    names.forEach((name) => {
      const badge = priceBadgeFor(name);
      priceCells.push(badge ? badge.text : null);
      if (badge) anyPrice = true;

      const chipset = chipsetFor(name);
      if (chipset) {
        anyChipset = true;
        const acap = CAMSTREAMER_ACAPS_PRESET.includes(chipset);
        chipsetCells.push(chipset + (acap ? " ✅" : ""));
      } else {
        chipsetCells.push(null);
      }
    });

    if (anyPrice || anyChipset) {
      // insertBefore(x, template.subsection) always lands x immediately
      // adjacent to the template, so inserting Chipset first and Price
      // second pushes Chipset to the top: Chipset, Price, then whatever was
      // originally first (Image sensor, Streaming, ...) - same ordering as
      // the "Compare products" table on a series page (products-content.js).
      const parent = template.subsection.parentElement;
      if (anyChipset) {
        const wrap = buildCompare2Section(
          t("compareChipsetRowLabel", "Chipset"), "chipset", chipsetCells, names, template
        );
        parent.insertBefore(wrap, template.subsection);
      }
      if (anyPrice && !pricesHidden()) {
        const wrap = buildCompare2Section(
          t("comparePriceRowLabel", "Price"), "price", priceCells, names, template
        );
        parent.insertBefore(wrap, template.subsection);
      }
    }

    container.setAttribute(COMPARE2_PROCESSED_ATTR, fingerprint);
  }

  function teardownComparisonTable2() {
    document.querySelectorAll(".axis-compare2-row").forEach((el) => el.remove());
    const container = getCompare2Container();
    if (container) container.removeAttribute(COMPARE2_PROCESSED_ATTR);
  }

  // ---------------------------------------------------------------------
  // Individual product page under product-selector's own route
  // (/support/tools/product-selector/product/<id>, e.g. the specs page
  // reached from "View product" on a grid card) - a Chipset/Price badge
  // pair next to the product name, reusing products-content.js's own
  // badge classnames/CSS (.axis-product-chipset-badge/-price-badge) for a
  // consistent look with the equivalent badges on axis.com/products/*
  // pages. Only one product per page, so this is much simpler than the
  // grid/comparison logic above - except the name heading has no stable
  // class either, so it's found the same way as the comparison page's
  // cells: the first "AXIS ..." leaf <div> that the catalog/chipset data
  // actually recognizes, which skips incidental "AXIS ..." text elsewhere
  // on the page (e.g. a comma-joined list of supported analytics apps).
  // ---------------------------------------------------------------------

  const PRODUCT_PAGE_BADGES_CLASS = "axis-product-selector-page-badges";

  function findProductPageNameEl() {
    const candidates = Array.from(document.querySelectorAll("div")).filter(
      (d) => d.children.length === 0 && /^AXIS\s/.test(d.textContent.trim())
    );
    for (const el of candidates) {
      const text = el.textContent.trim();
      if (priceBadgeFor(text) || chipsetFor(text)) return { el, name: text };
    }
    return null;
  }

  function injectProductPageBadges() {
    if (!/\/support\/tools\/product-selector\/product\/\d+/.test(location.pathname)) return;
    const found = findProductPageNameEl();
    const existingRow = document.querySelector("." + PRODUCT_PAGE_BADGES_CLASS);
    if (!found) {
      if (existingRow) existingRow.remove();
      return;
    }
    const { el: nameEl, name } = found;

    const badge = !pricesHidden() ? priceBadgeFor(name) : null;
    const chipsetLabel = !chipsetsHidden ? chipsetFor(name) : null;
    if (!badge && !chipsetLabel) {
      if (existingRow) existingRow.remove();
      return;
    }

    let row = existingRow;
    if (!row) {
      row = document.createElement("div");
      row.className = PRODUCT_PAGE_BADGES_CLASS;
      nameEl.insertAdjacentElement("afterend", row);
    }
    row.innerHTML = "";
    if (chipsetLabel) {
      const acap = CAMSTREAMER_ACAPS_PRESET.includes(chipsetLabel);
      const span = document.createElement("span");
      span.className = "axis-product-chipset-badge";
      span.textContent = acap ? chipsetLabel + " ✅" : chipsetLabel;
      span.title =
        t("chipsetTooltipPrefix", "Chipset (via CamStreamer app-compatibility data): ") + chipsetLabel;
      row.appendChild(span);
    }
    if (badge) {
      const span = document.createElement("span");
      span.className = "axis-product-price-badge";
      span.textContent = badge.text;
      span.title = badge.title;
      row.appendChild(span);
    }
  }

  // Re-derives price text/value for every already-processed card using the
  // currently selected currency, without waiting for new cards to appear
  // (PROCESSED_ATTR normally gates re-processing, so a currency switch
  // needs its own pass to update existing badges rather than just new ones).
  function refreshPriceBadges() {
    observer.disconnect();
    try {
      document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
        if (!card.hasAttribute(PROCESSED_ATTR)) return;
        const nameEl = card.querySelector(NAME_SELECTOR);
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        if (!name) return;

        const badge = priceBadgeFor(name);
        let span = card.querySelector(".axis-msrp-badge");
        if (badge && pricesHidden()) {
          // Prices hidden: drop any badge already on the card (this is the
          // path a live switch to "OFF" comes through), but still record
          // minPrice so cheapest-first sorting keeps working.
          if (span) span.remove();
          card.dataset.axisPrice = String(badge.minPrice);
        } else if (badge) {
          if (!span) {
            const target = getImgContainer(card);
            span = document.createElement("span");
            span.className = "axis-msrp-badge";
            target.appendChild(span);
          }
          span.textContent = badge.text;
          span.title = badge.title;
          card.dataset.axisPrice = String(badge.minPrice);
        } else {
          if (span) span.remove();
          delete card.dataset.axisPrice;
        }
      });

      applyFilters();
      sortSeriesByPrice(); // handles favorites-on-top + both sort states internally

      teardownComparisonTable2();
      injectComparisonTable2(document);
      injectProductPageBadges();
    } finally {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  function injectAll(root) {
    // Everything below can add/move DOM nodes (badges, series reordering). Since
    // we observe document.body for childList changes, our own writes would
    // otherwise re-trigger the observer and could loop. Pause it while we work.
    observer.disconnect();
    try {
      const cards = (root || document).querySelectorAll(CARD_SELECTOR);
      cards.forEach((card) => {
        const nameEl = card.querySelector(NAME_SELECTOR);
        if (!nameEl) return;
        const name = nameEl.textContent.trim();
        if (!name) return;

        if (!card.hasAttribute(PROCESSED_ATTR)) {
          card.setAttribute(PROCESSED_ATTR, "1");
          const badge = priceBadgeFor(name);
          if (badge) {
            // The visible badge is skipped when prices are hidden, but
            // dataset.axisPrice is still set either way - it's what
            // cheapest-first series sorting reads.
            if (!pricesHidden()) {
              const target = getImgContainer(card);
              const span = document.createElement("span");
              span.className = "axis-msrp-badge";
              span.textContent = badge.text;
              span.title = badge.title;
              target.appendChild(span);
            }
            card.dataset.axisPrice = String(badge.minPrice);
          }
        }

        // Canonical-resolved (not just normalizeBare'd raw display text) so
        // this matches MAP_CATALOG_ROWS's own bare names (see above) even
        // when a card's shown name has a trailing variant/suffix, and so it
        // matches favorites' canonical keys the same way across every page
        // on the site (see favoriteKeyFor).
        card.dataset.axisModel = favoriteKeyFor(name);
        applyChipsetLabel(card, name);
        applyFavoriteBadge(card, name);
      });

      captureOriginalSeriesOrderOnce();

      // Filter first, then sort - wrapperMinPrice only looks at cards that
      // are currently visible, so it needs display state to already be current.
      applyFilters();
      sortSeriesByPrice(); // handles favorites-on-top + both sort states internally

      // Re-attach the floating filter panel if a page re-render ever detaches it.
      if (filterPanelEl) mountPanel(filterPanelEl);

      injectComparisonTable2(root);
      injectProductPageBadges();
    } finally {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  let scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      injectAll(document);
    });
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        scheduleInject();
        break;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  scheduleInject();

  // Pick up live chipset data once the background service worker has fetched it,
  // and whenever it refreshes later (weekly alarm or "Update chipset data" in the popup).
  // Also pick up the currency choice made in the popup (default EUR).
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["chipsetData", "axisCurrency", "catalogOverride", "fxRates", FAVORITES_KEY, CATEGORIES_KEY], (res) => {
      if (res && res.chipsetData && Object.keys(res.chipsetData).length > 0) {
        CHIPSETS = res.chipsetData;
        rebuildChipsetIndex();
      }
      if (res && Array.isArray(res[FAVORITES_KEY])) favorites = new Set(res[FAVORITES_KEY]);
      if (res && Array.isArray(res[CATEGORIES_KEY])) {
        favoriteCategories = res[CATEGORIES_KEY];
        renderQuickLinks(); // no-op until the panel exists; harmless either way
      }
      if (res && (res.axisCurrency === "USD" || res.axisCurrency === "GBP" || res.axisCurrency === "JPY" || res.axisCurrency === "EUR" || res.axisCurrency === "OFF")) {
        currentCurrency = res.axisCurrency;
      } else {
        const def = localeDefaultCurrency();
        if (def) {
          currentCurrency = def;
          chrome.storage.local.set({ axisCurrency: def });
        }
      }
      if (res && res.fxRates) fxRates = res.fxRates;
      applyCatalogOverride(res && res.catalogOverride);
      injectAll(document);
      // scheduleInject() above may already have run a pass using the default
      // currency before this async read landed, and injectAll() only touches
      // cards it hasn't marked yet - so any badge from that first pass still
      // shows the wrong currency (or shows at all, when the stored choice was
      // "prices hidden"). refreshPriceBadges() re-evaluates every card's
      // price badge against the now-correct setting, adding, updating or
      // removing as needed.
      refreshPriceBadges();
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        // A category hearted or unhearted on axis.com/products in another tab.
        if (changes[CATEGORIES_KEY]) {
          favoriteCategories = Array.isArray(changes[CATEGORIES_KEY].newValue) ? changes[CATEGORIES_KEY].newValue : [];
          renderQuickLinks();
        }
        if (changes.chipsetData) {
          CHIPSETS = changes.chipsetData.newValue || {};
          rebuildChipsetIndex();
          teardownComparisonTable2();
          injectAll(document);
        }
        if (changes.axisCurrency) {
          const v = changes.axisCurrency.newValue;
          currentCurrency = v === "EUR" || v === "GBP" || v === "JPY" || v === "OFF" ? v : "USD";
          refreshPriceBadges();
        }
        if (changes.fxRates) {
          fxRates = changes.fxRates.newValue || null;
          if (currentCurrency === "JPY" || currentCurrency === "GBP") refreshPriceBadges();
        }
        // Written by the settings page (gear icon) after a monthly .xls
        // drop - mutate the shared catalog objects and re-render in place.
        if (changes.catalogOverride) {
          applyCatalogOverride(changes.catalogOverride.newValue);
          refreshPriceBadges();
        }
        // Picks up favorites toggled from the toolbar popup (or the Filters
        // panel's own Favorites list) while this page is open.
        if (changes[FAVORITES_KEY]) {
          favorites = new Set(Array.isArray(changes[FAVORITES_KEY].newValue) ? changes[FAVORITES_KEY].newValue : []);
          refreshAllFavoriteBadges();
          sortSeriesByPrice();
          if (renderFavoritesList) renderFavoritesList();
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // Chipset filter panel
  // ---------------------------------------------------------------------

  const FILTER_STORAGE_KEY = "axisChipsetFilterV1";
  const CHIPSET_ORDER = [
    "ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7", "ARTPEC-5", "ARTPEC-4", "ARTPEC-3",
    "Ambarella CV75", "Ambarella CV25", "Ambarella S3L", "Ambarella S2L", "Ambarella S2E", "Ambarella A5S",
  ];

  // The filter panel shows one checkbox per GROUP rather than one per exact
  // canonical chipset label: ARTPEC-3/4/5 collapse into a single "older
  // ARTPEC" checkbox, and all Ambarella variants collapse into a single
  // "Ambarella" checkbox. ARTPEC-9/8/6-7 stay as their own checkboxes since
  // those are the ones people actually care to isolate (e.g. for
  // CamStreamer ACAPs support). checkedChipsets still stores the underlying
  // exact canonical labels (unchanged), so applyFilters/card matching
  // doesn't need to know about grouping at all - only the panel UI does.
  const FILTER_GROUPS = [
    { label: "ARTPEC-9", members: ["ARTPEC-9"] },
    { label: "ARTPEC-8", members: ["ARTPEC-8"] },
    { label: "ARTPEC-6/7", members: ["ARTPEC-6/7"] },
    { label: "ARTPEC-3/4/5", members: ["ARTPEC-5", "ARTPEC-4", "ARTPEC-3"] },
    {
      label: "Ambarella",
      members: ["Ambarella CV75", "Ambarella CV25", "Ambarella S3L", "Ambarella S2L", "Ambarella S2E", "Ambarella A5S"],
    },
  ];


  function iconSvg(inner) {
    return (
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + "</svg>"
    );
  }

  // href = null makes a <button> instead of an <a> (the MSRP list has no URL
  // to point at - it asks background.js to open the action popup).
  function makeQuickLink(inner, label, href, onClick) {
    const el = document.createElement(href ? "a" : "button");
    el.className = "axis-quick-link";
    if (href) {
      el.href = href;
      el.target = "_blank";
      el.rel = "noopener";
    } else {
      el.type = "button";
    }
    el.title = label;
    el.innerHTML = iconSvg(inner);
    const span = document.createElement("span");
    span.textContent = label;
    el.appendChild(span);
    if (onClick) el.addEventListener("click", onClick);
    return el;
  }

  function renderQuickLinks() {
    if (!quickLinksRowsEl) return;
    quickLinksRowsEl.innerHTML = "";
    const items = [
      makeQuickLink(LINK_ICONS.products, "Products", "https://www.axis.com/products"),
      makeQuickLink(LINK_ICONS.myaxis, "My Axis", "https://my.axis.com/"),
      makeQuickLink(LINK_ICONS.scanner, t("quickLinkScanner", "IP Scanner"),
        chrome.runtime.getURL("find-cams.html")),
      makeQuickLink(LINK_ICONS.msrp, t("quickLinkMsrp", "MSRP list"), null, () => {
        try {
          chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
        } catch (e) {
          /* extension context torn down (reload/update) - nothing useful to do */
        }
      }),
    ];
    favoriteCategories
      .filter((sl) => CATEGORY_LABELS[sl])
      .slice(0, MAX_FAVORITE_CATEGORIES)
      .forEach((slug) => {
        items.push(
          makeQuickLink(CATEGORY_ICONS[slug], CATEGORY_LABELS[slug],
            "https://www.axis.com/products/" + slug)
        );
      });
    // Two per row. An odd last button stretches across rather than sitting
    // half-width next to a gap.
    for (let i = 0; i < items.length; i += 2) {
      const row = document.createElement("div");
      row.className = "axis-quick-link-row";
      row.appendChild(items[i]);
      if (items[i + 1]) row.appendChild(items[i + 1]);
      quickLinksRowsEl.appendChild(row);
    }
  }

  function sortChipsetLabels(labels) {
    return labels.sort((a, b) => {
      const ia = CHIPSET_ORDER.indexOf(a);
      const ib = CHIPSET_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  function loadCheckedSet() {
    try {
      const raw = localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch (e) {
      return new Set();
    }
  }

  function saveCheckedSet(set) {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify([...set]));
    } catch (e) {
      /* ignore quota/availability errors */
    }
  }

  let checkedChipsets = loadCheckedSet();
  let filterPanelEl = null;
  // Set by buildFovMapPanel() once it exists - lets the Filters panel's "FOV
  // Map" button show/hide it without the two panels needing to know about
  // each other's internals.
  let toggleFovMapVisibility = null;
  let fovMapToggleBtnEl = null; // set by buildFilterPanel; toggled active/inactive by buildFovMapPanel
  let fovMapColumnEl = null; // set by buildFilterPanel; populated with the map canvas by buildFovMapPanel
  // Keeps the Filters panel's "Required angle" slider and the map's cone in
  // sync, whichever one last changed the requirement.
  let updateRequiredAngleUI = null; // set by buildFilterPanel; called by buildFovMapPanel when the cone changes the angle
  let applyRequiredAngleToMap = null; // set by buildFovMapPanel; called by buildFilterPanel's slider to reshape an already-drawn cone

  const REQUIRED_ANGLE_STORAGE_KEY = "axisRequiredAngleV1";
  function loadRequiredAngleSetting() {
    try {
      const raw = localStorage.getItem(REQUIRED_ANGLE_STORAGE_KEY);
      const n = raw === null ? 0 : parseFloat(raw);
      return isNaN(n) ? 0 : n;
    } catch (e) {
      return 0;
    }
  }
  function saveRequiredAngleSetting(val) {
    try {
      localStorage.setItem(REQUIRED_ANGLE_STORAGE_KEY, String(val));
    } catch (e) {
      /* ignore quota/availability errors */
    }
  }

  // ACAP quick-select dropdown shown above the full chipset list. Choosing an
  // entry pre-checks the chipset(s) that ACAP is known to require, using the
  // same checkedChipsets/groupCheckboxes mechanism the individual checkboxes
  // further down use - so it's just a shortcut, never a separate filter
  // dimension.
  //
  // Every entry below is verified against an official Axis source (not
  // guessed) - see each entry's own comment for the source. A first pass at
  // this list (2026-08-07) tried to also include AXIS Object Analytics, AXIS
  // Perimeter Defender, and a single generic AXIS License Plate Verifier
  // entry - all three were dropped after checking developer.axis.com and
  // Axis's own release-notes archive: most first-party ACAPs (Object
  // Analytics, Fence Guard, Loitering Guard, Motion Guard, Cross Line
  // Detection, Demographic Identifier, People Counter, Queue Monitor,
  // Digital Autotracking, P8815-2 3D People Counter, Video Motion Detection
  // 2.1/3/4) are gated in Axis's own docs only by a minimum *firmware*
  // version, not by a specific ARTPEC chipset list - so a chipset checkbox
  // for them would misrepresent what Axis actually documents. They're left
  // out until a real per-chipset source turns up for them specifically.
  const ACAP_PRESETS = [
    {
      id: "camstreamer",
      label: t("presetCamstreamerLabel", "CamStreamer"),
      members: CAMSTREAMER_ACAPS_PRESET,
      title: t("presetCamstreamerTitle", "Select ARTPEC-9, ARTPEC-8, and ARTPEC-6/7 - the chipsets with CamStreamer Support"),
    },
    {
      // Per CamStreamer's own published figures (not independently
      // re-verified here, but supplied directly rather than sourced from a
      // public compatibility page).
      id: "camstreamer-baseball-tracker",
      label: t("acapBaseballTrackerLabel", "CamStreamer: Baseball Tracker"),
      members: ["ARTPEC-9", "ARTPEC-8"],
      title: t("acapBaseballTrackerTitle", "Select ARTPEC-9 and ARTPEC-8 - the chipsets CamStreamer's Baseball Tracker app supports"),
    },
    {
      // Per CamStreamer's own published figures. Their ARTPEC-7 requirement
      // maps to our combined "ARTPEC-6/7" bucket (chipset-data.js doesn't
      // separate 6 from 7) - so this also surfaces ARTPEC-6 models, which
      // may not actually be supported. Flagged here since it's a known gap
      // in our data's granularity, not a claim that ARTPEC-6 is confirmed.
      id: "camstreamer-planetracker",
      label: t("acapPlaneTrackerLabel", "CamStreamer: PlaneTracker"),
      members: ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"],
      title: t("acapPlaneTrackerTitle", "Select ARTPEC-9, ARTPEC-8, and ARTPEC-6/7 - the chipsets CamStreamer's PlaneTracker app supports (ARTPEC-7 requirement; our data can't separate ARTPEC-6 from 7)"),
    },
    {
      // Source: AXIS License Plate Verifier's own official release notes -
      // https://www.axis.com/ftp/pub_soft/applications/ACAP/AXIS_License_Plate_Verifier/latest/release_notes.txt
      // ("AXIS License Plate verifier 3.xx.xx will support compatible
      // ARTPEC-8 and ARTPEC-9 cameras only. Compatible cameras with
      // ARTPEC-6 and ARTPEC-7 will be locked to the latest version of ALPV
      // 2.xx.xx.") - split into two entries (this one + the v2.x one below)
      // rather than one, since the two versions genuinely support different,
      // non-overlapping chipsets.
      id: "lpv-v3",
      label: t("acapLpvV3Label", "AXIS License Plate Verifier (v3.x)"),
      members: ["ARTPEC-9", "ARTPEC-8"],
      title: t("acapLpvV3Title", "Select ARTPEC-9 and ARTPEC-8 - the only chipsets AXIS License Plate Verifier 3.x supports (per Axis's release notes)"),
    },
    {
      // Same source as lpv-v3 above; v2.x is what ARTPEC-6/7 cameras stay
      // locked to (our chipset data doesn't separate 6 from 7, but this
      // release note happens to require exactly that combined bucket).
      id: "lpv-v2",
      label: t("acapLpvV2Label", "AXIS License Plate Verifier (v2.x)"),
      members: ["ARTPEC-6/7"],
      title: t("acapLpvV2Title", "Select ARTPEC-6/7 - what AXIS License Plate Verifier 2.x supports, and what ARTPEC-6/7 cameras stay locked to (per Axis's release notes)"),
    },
  ];

  const ACAP_SELECTION_STORAGE_KEY = "axisAcapSelectionV1";
  function loadAcapSelection() {
    try {
      return localStorage.getItem(ACAP_SELECTION_STORAGE_KEY) || ACAP_PRESETS[0].id;
    } catch (e) {
      return ACAP_PRESETS[0].id;
    }
  }
  function saveAcapSelection(id) {
    try {
      localStorage.setItem(ACAP_SELECTION_STORAGE_KEY, id);
    } catch (e) {
      /* ignore quota/availability errors */
    }
  }

  // Floating panel, bottom-right. (An earlier version docked this into the
  // native sidebar in place of the "System-on-chip" dropdown, but that made
  // it cramped and easy to miss inside the site's own collapsible filter
  // groups, so it's back to floating. It's still idempotent - only touches
  // the DOM when actually detached - so calling it from injectAll() on every
  // mutation doesn't itself trigger more mutations.)
  function mountPanel(panel) {
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
  }

  // ---------------------------------------------------------------------
  // Required-angle filter state - one requirement, two interchangeable
  // controls: the Filters panel's "Required angle" slider (0-360°) and
  // dragging a cone on the FOV Map both just set mapAngleRequired and call
  // recomputeMapMatch(), which fills mapMatchedModels with the bare model
  // names that can currently cover that angle. A PTZ's full 360° pan range
  // counts as coverage (see coverableAngle() above), not just its lens
  // width, which is why the slider now goes to 360 instead of capping at
  // 180. CamStreamer-support narrowing isn't duplicated here - it's already
  // covered by the chipset checkboxes in the Filters panel, which
  // applyFilters() ANDs together with this filter (chipsetOk &&
  // mapFilterOk). This filter fails CLOSED once active - same semantics as
  // fov-map.js's own runMatch(), where a model with no FOV data simply
  // isn't a match. mapAngleRequired === null means "no requirement set",
  // i.e. this filter dimension is inactive.
  // ---------------------------------------------------------------------
  let mapAngleRequired = (() => {
    const v = loadRequiredAngleSetting();
    return v > 0 ? v : null;
  })();
  let mapMatchedModels = null; // Set<bare model name> | null (null = inactive)

  function recomputeMapMatch() {
    if (mapAngleRequired == null) {
      mapMatchedModels = null;
      return;
    }
    const angle = mapAngleRequired;
    mapMatchedModels = new Set();
    for (const row of MAP_CATALOG_ROWS) {
      if (row.coverable == null || angle > row.coverable) continue;
      mapMatchedModels.add(row.bare);
    }
  }

  function mapFilterOk(card) {
    if (!mapMatchedModels) return true; // filter inactive
    const model = card.dataset.axisModel;
    if (!model) return false; // fail CLOSED - no model name resolved for this card
    return mapMatchedModels.has(model);
  }

  // Prime mapMatchedModels from whatever angle was persisted, so a page
  // reload with a saved requirement filters immediately rather than waiting
  // for the slider or map to be touched again.
  recomputeMapMatch();

  function applyFilters() {
    const chipsetActive = checkedChipsets.size > 0;
    const angleActive = !!mapMatchedModels;
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (!chipsetActive && !angleActive) {
        card.style.removeProperty("display");
        return;
      }
      const label = card.getAttribute("data-axis-chipset");
      const chipsetOk = !chipsetActive || (!!label && checkedChipsets.has(label));
      const visible = chipsetOk && mapFilterOk(card);
      card.style.display = visible ? "" : "none";
    });
    updateSeriesVisibility();
  }

  // Call after any change to the chipset filter (checkbox toggle, preset,
  // clear) so series re-rank by the cheapest item that's still visible.
  // Always runs (not gated on sortEnabled) since favorited-series-on-top
  // must stay correct even when price-sorting itself is off, and a filter
  // change can change which cards count as visible for that check.
  function applyFilterAndResort() {
    applyFilters();
    sortSeriesByPrice();
  }

  function buildFilterPanel() {
    if (filterPanelEl) return;

    const available = sortChipsetLabels([...new Set(Object.values(CHIPSETS))]);

    const panel = document.createElement("div");
    panel.id = "axis-chipset-filter-panel";

    const header = document.createElement("div");
    header.className = "axis-chipset-panel-header";
    header.innerHTML =
      '<span>' + t("filterPanelTitle", "Filters") + '</span><button type="button" class="axis-chipset-panel-toggle" title="' +
      t("filterPanelToggleTitle", "Collapse/expand") + '">–</button>';
    panel.appendChild(header);

    const body = document.createElement("div");
    body.className = "axis-chipset-panel-body";

    // Single-panel layout: a flex row holding the (initially hidden) FOV Map
    // column on the left and the existing filter controls on the right, so
    // pressing "FOV Map" widens this one panel leftward instead of opening a
    // second floating panel next to it.
    const bodyRow = document.createElement("div");
    bodyRow.className = "axis-filter-body-row";

    const mapCol = document.createElement("div");
    mapCol.id = "axis-fovmap-column";
    mapCol.className = "axis-fovmap-column axis-fovmap-column-hidden";
    bodyRow.appendChild(mapCol);
    fovMapColumnEl = mapCol;

    const rightCol = document.createElement("div");
    rightCol.className = "axis-filter-right-col";
    bodyRow.appendChild(rightCol);

    const options = document.createElement("div");
    options.className = "axis-chipset-panel-options";

    // Populated by both the CamStreamer ACAPs shortcut below and the main
    // chipset list further down, so toggling either keeps the other in sync
    // (they share the same three underlying ARTPEC labels).
    const groupCheckboxes = [];
    function syncGroupCheckboxes() {
      groupCheckboxes.forEach(({ cb, members }) => {
        cb.checked = members.every((m) => checkedChipsets.has(m));
      });
    }

    // Big call-to-action button that widens this same panel to the left and
    // reveals the map column built lazily by buildFovMapPanel. The map
    // itself carries no controls of its own beyond click-to-draw - required
    // angle comes from the cone you draw, and any chipset/CamStreamer
    // narrowing happens via the checkboxes below, not a duplicate control
    // on the map.
    const fovMapToggleBtn = document.createElement("button");
    fovMapToggleBtn.type = "button";
    fovMapToggleBtn.className = "axis-fovmap-toggle-btn";
    // Same view-cone glyph as the popup's "FoV Map Tool" tab, instead of the
    // 🗺 emoji it used to carry - one button, one icon, across both surfaces
    // (and it renders identically on macOS / Windows / Linux, which an emoji
    // does not). Label follows Axis's own "FoV" casing.
    fovMapToggleBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 19L4.5 7.5"/><path d="M12 19l7.5-11.5"/><path d="M4.5 7.5A13.7 13.7 0 0 1 19.5 7.5"/><circle cx="12" cy="19" r="2"/>' + "</svg>";
    const fovMapToggleLabel = document.createElement("span");
    fovMapToggleLabel.textContent = t("fovMapToolButton", "FoV Map");
    fovMapToggleBtn.appendChild(fovMapToggleLabel);
    fovMapToggleBtn.addEventListener("click", () => {
      if (toggleFovMapVisibility) toggleFovMapVisibility();
    });
    fovMapToggleBtnEl = fovMapToggleBtn;
    options.appendChild(fovMapToggleBtn);

    // Quick links sit between the FoV Map call-to-action and the filter
    // controls: the panel's tools at the top, the things that actually
    // narrow the page below the divider.
    const quickLinks = document.createElement("div");
    quickLinks.className = "axis-quick-links";
    quickLinksRowsEl = quickLinks;
    options.appendChild(quickLinks);
    renderQuickLinks();
    const quickDivider = document.createElement("div");
    quickDivider.className = "axis-quick-links-divider";
    options.appendChild(quickDivider);

    const sortRow = document.createElement("label");
    sortRow.className = "axis-chipset-panel-row";
    const sortCb = document.createElement("input");
    sortCb.type = "checkbox";
    sortCb.checked = sortEnabled;
    sortCb.addEventListener("change", () => {
      sortEnabled = sortCb.checked;
      saveBoolSetting("axisSortSeriesV1", sortEnabled);
      sortSeriesByPrice(); // handles favorites-on-top + both sort states internally
    });
    const sortLabel = document.createElement("span");
    sortLabel.textContent = t("sortSeriesLabel", "Sort series by cheapest price");
    sortRow.appendChild(sortCb);
    sortRow.appendChild(sortLabel);
    options.appendChild(sortRow);

    // Single slider: the same "required angle" the FOV Map cone sets when
    // you draw one - 0-360° now that PTZ pan coverage means a camera can
    // satisfy up to a full circle, not just the 180° a single lens sees.
    // Whichever control you use (this slider or dragging a cone on the
    // map), it's the same mapAngleRequired value and the same PTZ-aware,
    // fails-CLOSED matching in recomputeMapMatch()/mapFilterOk() above - so
    // the two are always interchangeable, never two separate filters.
    const angleRow = document.createElement("div");
    angleRow.className = "axis-chipset-panel-row axis-fov-panel-row";
    const angleLabelRow = document.createElement("div");
    angleLabelRow.className = "axis-fov-panel-label-row";
    const angleLabel = document.createElement("span");
    angleLabel.textContent = t("angleFieldLabel", "Required angle");
    // A real number input rather than a plain span, so typing a value
    // works exactly like dragging the slider - both ends update the same
    // mapAngleRequired and stay in sync with each other.
    const angleValueInput = document.createElement("input");
    angleValueInput.type = "number";
    angleValueInput.className = "axis-fov-panel-value-input";
    angleValueInput.min = "0";
    angleValueInput.max = "360";
    angleValueInput.step = "1";
    function renderRequiredAngleUI(angle) {
      const a = angle == null ? 0 : angle;
      const rounded = Math.round(Math.min(360, Math.max(0, a)));
      angleSlider.value = String(rounded);
      angleValueInput.value = String(rounded);
    }
    updateRequiredAngleUI = renderRequiredAngleUI;
    const angleValueGroup = document.createElement("span");
    angleValueGroup.className = "axis-fov-panel-value-group";
    const angleDegreeSign = document.createElement("span");
    angleDegreeSign.textContent = "°";
    angleValueGroup.appendChild(angleValueInput);
    angleValueGroup.appendChild(angleDegreeSign);
    angleLabelRow.appendChild(angleLabel);
    angleLabelRow.appendChild(angleValueGroup);
    const angleSlider = document.createElement("input");
    angleSlider.type = "range";
    angleSlider.min = "0";
    angleSlider.max = "360";
    angleSlider.step = "1";
    angleSlider.className = "axis-fov-panel-slider";
    angleSlider.title = t(
      "angleSliderTitle",
      "Only show cameras that can cover at least this many degrees - a PTZ's full pan range counts, not just its lens width. Same requirement the FOV Map cone sets."
    );
    function commitRequiredAngle(v) {
      mapAngleRequired = v > 0 ? v : null;
      saveRequiredAngleSetting(v);
      renderRequiredAngleUI(v);
      recomputeMapMatch();
      applyFilterAndResort();
      updateCount();
      if (applyRequiredAngleToMap) applyRequiredAngleToMap(v);
    }
    angleSlider.addEventListener("input", () => {
      commitRequiredAngle(parseFloat(angleSlider.value) || 0);
    });
    angleValueInput.addEventListener("input", () => {
      const v = Math.min(360, Math.max(0, parseFloat(angleValueInput.value) || 0));
      commitRequiredAngle(v);
    });
    // Typed values above 360 or below 0 (or a blank field) get clamped back
    // into range on blur, since the running input handler above only clamps
    // the value it acts on, not what's left sitting in the field.
    angleValueInput.addEventListener("blur", () => {
      renderRequiredAngleUI(mapAngleRequired);
    });
    renderRequiredAngleUI(mapAngleRequired);
    angleRow.appendChild(angleLabelRow);
    angleRow.appendChild(angleSlider);
    options.appendChild(angleRow);

    // ACAP dropdown: replaces the old single "CamStreamer Support" checkbox.
    // Selecting an entry pre-checks whatever chipset(s) that ACAP requires
    // (see ACAP_PRESETS above for the accuracy caveat on the non-CamStreamer
    // entries). Switching entries first clears any chipsets that belong to
    // ANY known ACAP preset, so picking a different ACAP replaces the
    // previous one's selection rather than stacking on top of it - manually
    // checked chipsets that aren't part of any ACAP preset are left alone.
    const acapRow = document.createElement("div");
    acapRow.className = "axis-chipset-panel-row axis-chipset-panel-preset axis-acap-panel-row";
    const acapLabel = document.createElement("span");
    acapLabel.textContent = t("acapFieldLabel", "ACAP");
    const acapSelect = document.createElement("select");
    acapSelect.className = "axis-acap-select";
    const acapAllMembers = new Set();
    ACAP_PRESETS.forEach((preset) => preset.members.forEach((m) => acapAllMembers.add(m)));

    ACAP_PRESETS.forEach((preset) => {
      const presetMembers = preset.members.filter((label) => available.includes(label));
      if (presetMembers.length === 0) return;
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = preset.label;
      opt.title = preset.title;
      acapSelect.appendChild(opt);
    });

    function applyAcapPreset(id, persist) {
      const preset = ACAP_PRESETS.find((p) => p.id === id);
      acapAllMembers.forEach((m) => checkedChipsets.delete(m));
      if (preset) preset.members.filter((m) => available.includes(m)).forEach((m) => checkedChipsets.add(m));
      saveCheckedSet(checkedChipsets);
      syncGroupCheckboxes();
      if (persist) saveAcapSelection(id);
      applyFilterAndResort();
      updateCount();
    }

    const savedAcapId = loadAcapSelection();
    if ([...acapSelect.options].some((o) => o.value === savedAcapId)) {
      acapSelect.value = savedAcapId;
    }
    acapSelect.title = (ACAP_PRESETS.find((p) => p.id === acapSelect.value) || {}).title || "";
    acapSelect.addEventListener("change", () => {
      acapSelect.title = (ACAP_PRESETS.find((p) => p.id === acapSelect.value) || {}).title || "";
      applyAcapPreset(acapSelect.value, true);
    });

    acapRow.title = t("acapSelectRowTitle", "Pre-check the chipset(s) a specific ACAP is known to support - CamStreamer by default, or choose an AXIS ACAP");
    acapRow.appendChild(acapLabel);
    acapRow.appendChild(acapSelect);
    options.appendChild(acapRow);

    rightCol.appendChild(options);

    // The reviewable/removable list of favorited cameras used to live here
    // in the on-page panel, but moved to the extension's Settings page
    // (options.html) instead - the panel here stays focused on filtering,
    // and the full favorites list is one gear-icon click away. Toggling a
    // ♡/🧡 on a product card (right here on the page) still works exactly
    // as before; only the standalone review list moved.
    // `renderFavoritesList` is left assigned to null (see its declaration
    // near the top of the file) - the `if (renderFavoritesList)` guards
    // elsewhere in this file simply no-op now, harmlessly.

    const divider = document.createElement("div");
    divider.className = "axis-chipset-panel-divider";
    rightCol.appendChild(divider);

    const list = document.createElement("div");
    list.className = "axis-chipset-panel-list";
    for (const group of FILTER_GROUPS) {
      const presentMembers = group.members.filter((m) => available.includes(m));
      if (presentMembers.length === 0) continue; // none of this group's chipsets appear in the current data

      const row = document.createElement("label");
      row.className = "axis-chipset-panel-row";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = group.label;
      cb.checked = presentMembers.every((m) => checkedChipsets.has(m));
      cb.addEventListener("change", () => {
        if (cb.checked) presentMembers.forEach((m) => checkedChipsets.add(m));
        else presentMembers.forEach((m) => checkedChipsets.delete(m));
        saveCheckedSet(checkedChipsets);
        syncGroupCheckboxes(); // keep the CamStreamer ACAPs shortcut in sync too
        applyFilterAndResort();
        updateCount();
      });
      groupCheckboxes.push({ cb, members: presentMembers });
      const span = document.createElement("span");
      span.textContent = group.label;
      row.appendChild(cb);
      row.appendChild(span);
      list.appendChild(row);
    }

    // "Hide Chipsets" - not a filter (doesn't touch checkedChipsets/which
    // cards show), just hides the visible chipset badge on every card. The
    // one place per-card price-hiding lives (currentCurrency === "OFF") is
    // page-global via the popup's currency toggle; this is the equivalent
    // for chipsets, but local to this panel since there's no separate
    // "chipset currency" concept to hang it off of.
    const hideChipsetsRow = document.createElement("label");
    hideChipsetsRow.className = "axis-chipset-panel-row";
    const hideChipsetsCb = document.createElement("input");
    hideChipsetsCb.type = "checkbox";
    hideChipsetsCb.checked = chipsetsHidden;
    hideChipsetsCb.addEventListener("change", () => {
      chipsetsHidden = hideChipsetsCb.checked;
      saveBoolSetting("axisChipsetsHiddenV1", chipsetsHidden);
      // Hiding the badge while a chipset filter is still narrowing the page
      // down reads as contradictory (why would you filter by something
      // you've just hidden?), so checking this clears every chipset
      // checkbox above it back to "show everything".
      if (chipsetsHidden && checkedChipsets.size > 0) {
        checkedChipsets.clear();
        saveCheckedSet(checkedChipsets);
        syncGroupCheckboxes();
        applyFilterAndResort();
        updateCount();
      }
      refreshChipsetBadges();
    });
    const hideChipsetsSpan = document.createElement("span");
    hideChipsetsSpan.textContent = t("hideChipsetsLabel", "Hide Chipsets");
    hideChipsetsRow.title = t("hideChipsetsTitle", "Hide the chipset badge on every card - filtering by chipset above still works");
    hideChipsetsRow.appendChild(hideChipsetsCb);
    hideChipsetsRow.appendChild(hideChipsetsSpan);
    list.appendChild(hideChipsetsRow);

    rightCol.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "axis-chipset-panel-footer";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "axis-chipset-panel-clear";
    clearBtn.textContent = t("filterClearButton", "Clear");
    clearBtn.addEventListener("click", () => {
      checkedChipsets.clear();
      saveCheckedSet(checkedChipsets);
      syncGroupCheckboxes();
      acapSelect.value = ACAP_PRESETS[0].id;
      saveAcapSelection(ACAP_PRESETS[0].id);
      acapSelect.title = (ACAP_PRESETS.find((p) => p.id === acapSelect.value) || {}).title || "";
      mapAngleRequired = null;
      saveRequiredAngleSetting(0);
      renderRequiredAngleUI(0);
      recomputeMapMatch();
      applyFilterAndResort();
      updateCount();
      if (applyRequiredAngleToMap) applyRequiredAngleToMap(0);
    });
    const count = document.createElement("span");
    count.className = "axis-chipset-panel-count";
    footer.appendChild(count);
    footer.appendChild(clearBtn);
    rightCol.appendChild(footer);

    body.appendChild(bodyRow);
    panel.appendChild(body);
    filterPanelEl = panel;
    mountPanel(panel);

    function updateCount() {
      const total = document.querySelectorAll(CARD_SELECTOR).length;
      const visible = Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(
        (c) => c.style.display !== "none"
      ).length;
      const anyFilterActive = checkedChipsets.size > 0 || !!mapMatchedModels;
      count.textContent = anyFilterActive
        ? t("filterCountText", visible + " / " + total + " shown", visible, total)
        : "";
    }

    header.querySelector(".axis-chipset-panel-toggle").addEventListener("click", () => {
      const collapsed = panel.classList.toggle("axis-chipset-panel-collapsed");
      header.querySelector(".axis-chipset-panel-toggle").textContent = collapsed ? "+" : "–";
    });

    updateCount();
    applyFilterAndResort();
  }

  // Always built now (not gated on chipset data being present) - this single
  // panel also hosts the sort toggle, FOV slider, and FOV Map tool button,
  // all useful even before/without any chipset data loading.
  buildFilterPanel();

  // ---------------------------------------------------------------------
  // FOV Map tool - a compact (300x300) map built directly into the left
  // column of the single "Filters" panel (fovMapColumnEl, set by
  // buildFilterPanel), rather than a second floating panel. Pressing
  // "FOV Map" in the Filters panel widens that one panel to the left and
  // reveals this column. Unlike the standalone fov-map.html tool, this map
  // carries no controls of its own beyond click/drag-to-draw-cone and
  // Reset - required angle comes purely from the cone geometry, and any
  // chipset/CamStreamer narrowing is left entirely to the checkboxes
  // already in the Filters panel (mapFilterOk() above is just ANDed with
  // that panel's chipsetOk).
  // ---------------------------------------------------------------------

  let fovMapPanelEl = null; // non-null once the map DOM has been built into fovMapColumnEl

  function buildFovMapPanel() {
    if (fovMapPanelEl) return;
    if (typeof AxisMap === "undefined") return; // axis-map.js/maplibre failed to load - don't break the rest of the page
    if (!fovMapColumnEl) return; // Filters panel hasn't been built yet

    const body = fovMapColumnEl;

    const canvas = document.createElement("div");
    canvas.id = "axis-fovmap-canvas";
    body.appendChild(canvas);

    // Hint text and Reset share one row instead of stacking, so Reset sits
    // right next to the instructions rather than floating below with a gap.
    const hintRow = document.createElement("div");
    hintRow.className = "axis-fovmap-hint-row";

    const stepText = document.createElement("p");
    stepText.className = "axis-fovmap-step-text";
    hintRow.appendChild(stepText);

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "axis-fovmap-reset-btn";
    resetBtn.textContent = t("filterClearButton", "Reset");
    hintRow.appendChild(resetBtn);

    body.appendChild(hintRow);

    fovMapPanelEl = body;

    // Leaflet needs a container with real dimensions to size its tiles
    // correctly, so building the actual map is deferred to the first
    // time the column becomes visible. The column now slides open (width
    // animates 0 -> 380px, see content.css) rather than popping via
    // display:none, which looks like a smooth reveal instead of a jump -
    // but that also means resize() has to wait until that slide
    // finishes, or Leaflet locks its tile grid to whatever in-between width
    // it caught mid-animation and the map looks squashed/misaligned.
    let mapInitialized = false;
    let map = null;

    function ensureMapInitialized() {
      if (!mapInitialized) {
        mapInitialized = true;
        initMap();
      }
      const onSlideDone = (e) => {
        if (e && e.propertyName && e.propertyName !== "width") return;
        fovMapColumnEl.removeEventListener("transitionend", onSlideDone);
        if (map) map.resize();
      };
      fovMapColumnEl.addEventListener("transitionend", onSlideDone);
      // Fallback in case the transition never fires (e.g. reduced-motion
      // settings disable it) - matches content.css's slide duration plus a
      // small buffer.
      setTimeout(() => map && map.resize(), 400);
    }

    // ---- Leaflet map + cone-drawing state machine (ported from fov-map.js) ----
    function initMap() {

      map = AxisMap.create(canvas, {
        center: { lat: 50.0755, lng: 14.4378 }, // Prague default; replaced below by IP geolocation if it resolves
        zoom: 11,
        noteText: t("mapTilesUnavailable", "Map tiles unavailable — the coverage tool still works."),
      });
      setTimeout(() => map.resize(), 0);

      // IP-based (not GPS/permission-based) geolocation, purely to roughly
      // center the map on load - no location permission prompt, city-level
      // accuracy only. Never blocks the tool: any failure just leaves the
      // Prague default view in place.
      fetch("https://get.geojs.io/v1/ip/geo.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const lat = parseFloat(data.latitude);
          const lon = parseFloat(data.longitude);
          if (!isNaN(lat) && !isNaN(lon)) map.setView([lat, lon], 11);
        })
        .catch(() => {
          /* offline / blocked - keep the default view */
        });

      const STEP = { CAMERA: 0, EDGE1: 1, EDGE2: 2, DONE: 3 };
      let step = STEP.CAMERA;
      let cameraLatLng = null;
      let edge1LatLng = null;
      let edge2LatLng = null;
      let cameraMarker = null;
      let edge1Marker = null;
      let edge2Marker = null;
      let edge1Line = null;
      let edge2Line = null;
      let draftLine = null;
      let conePolygon = null;
      let dragging = false;
      let coneCentre = 0;
      let manualAngle = null;
      let manualRange = null;

      const EDGE_HANDLE = { className: "axis-fovmap-edge-handle", draggable: true };

      // A plain CSS-styled element rather than a default map marker. The
      // reason predates MapLibre and still holds: on axis.com's own page
      // (not an extension page) an image-backed marker can be silently
      // blocked by the site's own img-src CSP even though it is declared in
      // manifest.json's web_accessible_resources - that only controls
      // whether the extension permits the load, not whether the host page's
      // policy allows it. An element with no image can't be blocked that
      // way - same reasoning as the edge handles above.
      const CAMERA_ICON = { className: "axis-fovmap-camera-icon", html: "📷", draggable: true };

      function setStepText() {
        if (step === STEP.CAMERA) stepText.textContent = t("fovMapStepCamera", "Click the map to drop the camera location.");
        else if (step === STEP.EDGE1) stepText.textContent = t("fovMapStepEdge1", "Click-drag from the camera to set one edge of the required coverage.");
        else if (step === STEP.EDGE2) stepText.textContent = t("fovMapStepEdge2", "Click-drag again to set the other edge of the cone.");
        else stepText.textContent = t("fovMapStepDone", "Drag the pin or either yellow handle to reshape - keep dragging outward to open past 180° up to a full circle.");
      }
      setStepText();

      function bearingDeg(a, b) {
        const phi1 = (a.lat * Math.PI) / 180;
        const phi2 = (b.lat * Math.PI) / 180;
        const dLambda = ((b.lng - a.lng) * Math.PI) / 180;
        const y = Math.sin(dLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
        return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
      }

      function destPoint(start, bearing, distanceM) {
        const R = 6371000;
        const delta = distanceM / R;
        const theta = (bearing * Math.PI) / 180;
        const phi1 = (start.lat * Math.PI) / 180;
        const lambda1 = (start.lng * Math.PI) / 180;
        const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
        const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
        return { lat: (phi2 * 180) / Math.PI, lng: (lambda2 * 180) / Math.PI };
      }

      function angleDiff(a, b) {
        let d = (b - a) % 360;
        if (d > 180) d -= 360;
        if (d <= -180) d += 360;
        return d;
      }

      // See fov-map.js's own extensive comment on this heuristic: of the two
      // possible sectors described by the two edge bearings, pick whichever
      // keeps the cone's centre nearest its current centre, so dragging a
      // handle outward through 180° keeps opening the cone instead of
      // flipping it to the far side.
      function computeConeFromEdges(currentCentre) {
        const b1 = bearingDeg(cameraLatLng, edge1LatLng);
        const b2 = bearingDeg(cameraLatLng, edge2LatLng);
        const d1 = map.distance(cameraLatLng, edge1LatLng);
        const d2 = map.distance(cameraLatLng, edge2LatLng);

        const minor = angleDiff(b1, b2);
        const major = minor === 0 ? 360 : minor - Math.sign(minor) * 360;

        let sweep = minor;
        if (typeof currentCentre === "number") {
          const centreOf = (s) => (b1 + s / 2 + 360) % 360;
          const offBy = (s) => Math.abs(angleDiff(currentCentre, centreOf(s)));
          if (offBy(major) < offBy(minor)) sweep = major;
        }
        return {
          centre: (b1 + sweep / 2 + 360) % 360,
          angle: Math.abs(sweep),
          range: Math.max(d1, d2),
        };
      }

      function drawCone(centre, angle, range) {
        // One persistent GeoJSON source, re-fed on every redraw.
        const steps = Math.max(24, Math.ceil(angle / 4));
        const start = centre - angle / 2;
        const pts = [];
        if (angle < 359.9) pts.push(cameraLatLng);
        for (let i = 0; i <= steps; i++) {
          pts.push(destPoint(cameraLatLng, start + (angle * i) / steps, range));
        }
        if (angle < 359.9) pts.push(cameraLatLng);
        if (conePolygon) conePolygon.setLatLngs(pts);
        else conePolygon = map.cone("axis-panel-cone", pts);
      }

      function updateFromGeometry(hint) {
        const cone = computeConeFromEdges(hint);
        manualAngle = Math.round(cone.angle * 10) / 10;
        manualRange = Math.round(cone.range);
        coneCentre = cone.centre;
        drawCone(coneCentre, manualAngle, manualRange);
        applyMapMatch();
      }

      function updateFromDrag() {
        updateFromGeometry(coneCentre);
      }

      function applyMapMatch() {
        mapAngleRequired = manualAngle;
        saveRequiredAngleSetting(manualAngle);
        if (updateRequiredAngleUI) updateRequiredAngleUI(manualAngle); // keep the Filters panel slider in sync
        recomputeMapMatch();
        applyFilterAndResort();
      }

      function finalizeCone() {
        step = STEP.DONE;
        setStepText();
        updateFromGeometry(); // no hint - first draw takes the minor sector
      }

      // Lets the Filters panel's "Required angle" slider reshape an
      // already-drawn cone so the two controls stay visually consistent,
      // not just consistent in the resulting filter. Only meaningful once a
      // cone actually exists - before that, the slider still works fine on
      // its own (recomputeMapMatch()/mapFilterOk() don't need a drawn cone).
      applyRequiredAngleToMap = function (angle) {
        if (step !== STEP.DONE || !cameraLatLng) return;
        manualAngle = angle > 0 ? angle : 0.1;
        drawCone(coneCentre, manualAngle, manualRange);
      };

      function makeCameraDraggable() {
        cameraMarker.setDraggable(true);
        cameraMarker.on("drag", (e) => {
          cameraLatLng = e.target.getLatLng();
          if (edge1LatLng) edge1Line.setLatLngs([cameraLatLng, edge1LatLng]);
          if (edge2LatLng) edge2Line.setLatLngs([cameraLatLng, edge2LatLng]);
          if (step === STEP.DONE) updateFromDrag();
        });
      }

      map.on("click", (e) => {
        if (step === STEP.CAMERA) {
          cameraLatLng = e.latlng;
          cameraMarker = map.marker(cameraLatLng, CAMERA_ICON);
          makeCameraDraggable();
          step = STEP.EDGE1;
          setStepText();
        }
      });

      map.on("mousedown", (e) => {
        if (step !== STEP.EDGE1 && step !== STEP.EDGE2) return;
        dragging = true;
        map.setDragEnabled(false);
        draftLine = map.line("axis-panel-draft", [cameraLatLng, e.latlng], { dashed: true });
      });
      map.on("mousemove", (e) => {
        if (!dragging || !draftLine) return;
        draftLine.setLatLngs([cameraLatLng, e.latlng]);
      });
      map.on("mouseup", (e) => {
        if (!dragging) return;
        dragging = false;
        map.setDragEnabled(true);
        if (draftLine) {
          draftLine.remove();
          draftLine = null;
        }
        if (step === STEP.EDGE1) {
          edge1LatLng = e.latlng;
          edge1Line = map.line("axis-panel-edge1", [cameraLatLng, edge1LatLng]);
          edge1Marker = map.marker(edge1LatLng, EDGE_HANDLE);
          edge1Marker.on("drag", (ev) => {
            edge1LatLng = ev.target.getLatLng();
            edge1Line.setLatLngs([cameraLatLng, edge1LatLng]);
            if (step === STEP.DONE) updateFromDrag();
          });
          step = STEP.EDGE2;
          setStepText();
        } else if (step === STEP.EDGE2) {
          edge2LatLng = e.latlng;
          edge2Line = map.line("axis-panel-edge2", [cameraLatLng, edge2LatLng]);
          edge2Marker = map.marker(edge2LatLng, EDGE_HANDLE);
          edge2Marker.on("drag", (ev) => {
            edge2LatLng = ev.target.getLatLng();
            edge2Line.setLatLngs([cameraLatLng, edge2LatLng]);
            if (step === STEP.DONE) updateFromDrag();
          });
          finalizeCone();
        }
      });

      resetBtn.addEventListener("click", () => {
        step = STEP.CAMERA;
        cameraLatLng = edge1LatLng = edge2LatLng = null;
        [cameraMarker, edge1Marker, edge2Marker, edge1Line, edge2Line, draftLine, conePolygon].forEach(
          (l) => l && l.remove()
        );
        cameraMarker = edge1Marker = edge2Marker = edge1Line = edge2Line = draftLine = conePolygon = null;
        manualAngle = manualRange = null;
        mapAngleRequired = null;
        saveRequiredAngleSetting(0);
        if (updateRequiredAngleUI) updateRequiredAngleUI(0);
        recomputeMapMatch();
        applyFilterAndResort();
        setStepText();
      });
    }

    // Wire up the Filters panel's "FOV Map" button to widen that single
    // panel to the left and reveal this column. Exposed via the shared
    // toggleFovMapVisibility variable rather than each piece reaching into
    // the other's internals.
    toggleFovMapVisibility = function () {
      const nowHidden = fovMapColumnEl.classList.toggle("axis-fovmap-column-hidden");
      if (filterPanelEl) filterPanelEl.classList.toggle("axis-filter-panel-expanded", !nowHidden);
      if (fovMapToggleBtnEl) fovMapToggleBtnEl.classList.toggle("axis-fovmap-toggle-btn-active", !nowHidden);
      if (!nowHidden) ensureMapInitialized();
    };
  }

  buildFovMapPanel();

  // The panel's static labels are only translated at build time above. The
  // OS/URL-based signals in isJapanese are already resolved synchronously by
  // then (i18n.js runs before this file), but the "JPY currently selected"
  // signal is read from storage asynchronously and can resolve slightly
  // later - so if that flips isJapanese after the panel already got built in
  // English, rebuild it once from scratch (checkbox/slider state all comes
  // from localStorage via loadCheckedSet()/loadRequiredAngleSetting(), so
  // nothing is lost by tearing it down and re-running buildFilterPanel()).
  if (typeof AxisI18N !== "undefined") {
    AxisI18N.onLanguageChange(() => {
      if (filterPanelEl) {
        const wasMapVisible = !!fovMapColumnEl && !fovMapColumnEl.classList.contains("axis-fovmap-column-hidden");
        filterPanelEl.remove();
        filterPanelEl = null;
        fovMapColumnEl = null;
        fovMapToggleBtnEl = null;
        toggleFovMapVisibility = null;
        buildFilterPanel();
        // The map panel's own DOM (canvas, step text) lived inside the torn-
        // down panel too - rebuild it against the fresh column, and restore
        // it to visible if it was showing before the rebuild.
        fovMapPanelEl = null;
        buildFovMapPanel();
        if (wasMapVisible && toggleFovMapVisibility) toggleFovMapVisibility();
      }
    });
  }
})();
