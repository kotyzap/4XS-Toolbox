(function () {
  "use strict";

  // Runs on https://www.axis.com/products/* - both a product-category page
  // (e.g. /products/axis-q17-series, a grid of "nav-card" tiles, one per
  // model) and an individual product page (e.g. /products/axis-q1728, a
  // single <h1> product name). Appends the same MSRP price badge + chipset
  // badge used elsewhere in this extension right next to each product name.
  //
  // Matching logic (normalize/findMatch/pickVariant/chipsetFor) is
  // intentionally duplicated from content.js/search-content.js rather than
  // shared, since each content script file is wrapped in its own IIFE and
  // isn't reachable from another file. Keeping this file self-contained
  // avoids touching the already-shipped Product Selector/search overlays.

  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};
  let CHIPSETS = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};
  const CAMSTREAMER_ACAPS_PRESET = ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"];

  // Japanese localization - see i18n.js (loaded first, per manifest.json)
  // for the isJapanese detection logic.
  const JA = {
    priceSourceEur: "AXIS Price List (2026年7月, EUR)",
    priceSourceEurApprox: "EURのリスト価格なし — 現在のUSD/EURレートでUSDから概算",
    priceSourceJpy: "USD建てリスト価格からFX換算、USD/JPYリアルタイムレート",
    priceSourceUsd: "AXIS Price List (2026年7月, EUR) からFX換算",
    partNumberSuffix: (part) => ` — 型番 #${part}`,
    variantSuffix: (variant) => ` — ${variant}`,
    noteSuffix: (note) => ` (${note})`,
    samePriceTitle: (sourceLabel, count) => `${sourceLabel} — ${count} バリエーション、同一価格`,
    rangeTitleDetailed: (sourceLabel, count, minLabel, maxLabel) =>
      `${sourceLabel} — ${count} バリエーションの価格帯 (${minLabel} 〜 ${maxLabel})`,
    lowest: "最安",
    highest: "最高",
    fromPrefix: "最安 ",
    fromToPrefix: (min, max) => `${min} 〜 ${max}`,
    cheapestSeriesTitle: (sourceLabel, count, prefix) =>
      `${sourceLabel} — ${prefix}シリーズの一致した ${count} 件中の最安値`,
    seriesPageSamePriceTitle: (sourceLabel, count, prefix) =>
      `${sourceLabel} — このページに表示された ${prefix}シリーズ ${count} 件、同一価格`,
    seriesPageRangeTitle: (sourceLabel, count, prefix) =>
      `${sourceLabel} — このページに表示された ${prefix}シリーズ ${count} 件の価格帯`,
    chipsetTooltipPrefix: "チップセット (CamStreamerアプリ対応データより): ",
    chipsetTooltipCsSuffix: " — CamStreamer対応",
    compareRowLabelPrice: "価格",
    compareRowLabelChipset: "チップセット",
    compareRowLabelFavorite: "🧡 お気に入り",
    favToggleTitle: "お気に入り登録",
    categoryFavTitle: "このカテゴリを4XS Toolboxのクイックボタンに固定",
    categoryLimitNote: "4XS Toolbox: カテゴリボタンは4つまでです — 先にどれかを解除してください。",
  };
  const isJa = () => typeof AxisI18N !== "undefined" && AxisI18N.isJapanese;
  function t(key, enFallback, ...args) {
    if (!isJa()) return enFallback;
    const v = JA[key];
    if (v === undefined) return enFallback;
    return typeof v === "function" ? v(...args) : v;
  }

  // A whole series can span many distinct chipsets (e.g. an M11 card lists
  // ARTPEC-8, ARTPEC-6/7, ARTPEC-5, ARTPEC-4, ARTPEC-3 individually), which
  // reads as clutter on a small card. Collapse the older ARTPEC generations
  // into two ranges - "ARTPEC 6-9" (the CamStreamer-supported ones) and
  // "ARTPEC 3-5" (the older, unsupported ones) - and shorten "Ambarella X"
  // to "AMB X", so at most a handful of badges ever show per card.
  const CHIPSET_GROUP_ORDER = ["ARTPEC 6-9", "ARTPEC 3-5"];

  function displayChipsetGroup(rawLabel) {
    if (rawLabel === "ARTPEC-9" || rawLabel === "ARTPEC-8" || rawLabel === "ARTPEC-6/7") return "ARTPEC 6-9";
    if (rawLabel === "ARTPEC-5" || rawLabel === "ARTPEC-4" || rawLabel === "ARTPEC-3") return "ARTPEC 3-5";
    if (rawLabel.indexOf("Ambarella ") === 0) return "AMB " + rawLabel.slice("Ambarella ".length);
    return rawLabel;
  }

  // Builds and appends one badge per *display* chipset group (not one per
  // raw chipset label) - e.g. ARTPEC-9/8/6-7 on the same card collapse into
  // a single "ARTPEC 6-9" badge. A group gets the CamStreamer-support
  // checkmark if ANY of its underlying raw labels does (true for the whole
  // "ARTPEC 6-9" group, never for "ARTPEC 3-5" or any AMB group, matching
  // CAMSTREAMER_ACAPS_PRESET below).
  function appendChipsetBadges(row, rawLabels) {
    const groupAcap = new Map();
    rawLabels.forEach((raw) => {
      const display = displayChipsetGroup(raw);
      const acap = CAMSTREAMER_ACAPS_PRESET.includes(raw);
      groupAcap.set(display, groupAcap.get(display) || acap);
    });
    const sortedLabels = Array.from(groupAcap.keys()).sort((a, b) => {
      const ia = CHIPSET_GROUP_ORDER.indexOf(a), ib = CHIPSET_GROUP_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    sortedLabels.forEach((label) => {
      const acap = groupAcap.get(label);
      const chipsetSpan = document.createElement("span");
      chipsetSpan.className = "axis-product-chipset-badge";
      chipsetSpan.textContent = label + (acap ? " ✅" : "");
      chipsetSpan.title =
        t("chipsetTooltipPrefix", "Chipset (via CamStreamer app-compatibility data): ") + label +
        (acap ? t("chipsetTooltipCsSuffix", " — CamStreamer Support") : "");
      row.appendChild(chipsetSpan);
    });
  }

  function normalize(s) {
    return (s || "")
      .toUpperCase()
      .replace(/®|™/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeBare(s) {
    return normalize(s).replace(/^AXIS\s+/, "");
  }

  // ---------------------------------------------------------------------
  // Favorites - same "♡ -> 🧡" marker, and same shared chrome.storage.local
  // ("axisFavorites") key, as content.js's Product Selector overlay and the
  // toolbar popup - favoriting a camera on any of these surfaces shows it
  // favorited on all of them. Declared this early (right after
  // normalizeBare, before anything else in the file) because
  // chrome.storage.local.get() further down reads FAVORITES_KEY - a
  // const/let referenced before its own declaration line has run is a
  // ReferenceError, not just "undefined" (content.js hit exactly this bug
  // once already).
  // ---------------------------------------------------------------------
  const FAVORITES_KEY = "axisFavorites";
  let favorites = new Set();

  function isFavorite(name) {
    return favorites.has(favoriteKeyFor(name));
  }

  function saveFavorites() {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [FAVORITES_KEY]: Array.from(favorites) });
    }
  }

  function toggleFavorite(name) {
    const key = favoriteKeyFor(name);
    if (favorites.has(key)) favorites.delete(key);
    else favorites.add(key);
    saveFavorites();
    refreshAllFavoriteMarkers();
  }

  function makeFavHeart(name, extraClass) {
    const el = document.createElement("span");
    el.className = "axis-fav-badge" + (extraClass ? " " + extraClass : "");
    el.setAttribute("data-axis-fav-name", name);
    el.textContent = isFavorite(name) ? "🧡" : "♡";
    el.title = t("favToggleTitle", "Favorite this camera");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavorite(name);
    });
    return el;
  }

  // Re-derives every already-placed heart's glyph (♡ vs 🧡) after a toggle,
  // without rebuilding the price/chipset badges around it - cheaper than
  // refreshAllBadges() and avoids re-running the matching logic for a change
  // that never affects price/chipset data.
  function refreshAllFavoriteMarkers() {
    document.querySelectorAll(".axis-fav-badge[data-axis-fav-name]").forEach((el) => {
      const name = el.getAttribute("data-axis-fav-name");
      el.textContent = isFavorite(name) ? "🧡" : "♡";
    });
  }

  // ---------------------------------------------------------------------
  // Product-category quick links (the /products index page).
  //
  // Hearting a category tile on https://www.axis.com/products pins it as a
  // one-tap button in the popup - the idea being that an Axis employee
  // works one or two segments, so those pages are what they actually open
  // all day.
  //
  // Kept in its OWN storage key, deliberately NOT in axisFavorites: a
  // category is not a camera, and mixing them means a hearted "Network
  // cameras" is indistinguishable from a hearted model. (Before this,
  // makeFavHeart ran on category tiles too and quietly wrote the category
  // name into axisFavorites, where nothing ever matched it - see the
  // migration note below.)
  //
  // Identified by SLUG, not by the tile's visible text, so it also works on
  // the localized pages (/de/products, /ja/products, ...) where the h3 is
  // translated.
  // ---------------------------------------------------------------------
  const CATEGORIES_KEY = "axisFavoriteCategories";
  const MAX_FAVORITE_CATEGORIES = 4;
  // Short labels chosen to fit four-up in the 420px popup: 4 buttons leave
  // ~80px of text each at 12px Arial bold, and the longest of these
  // ("Ex-protected") measures 73px. Five-up leaves ~60px and breaks three
  // of them, which is why the cap is 4 and not "as many as you like".
  // English-only on purpose, same as the Selector/Products/My Axis row.
  const PRODUCT_CATEGORIES = [
    { slug: "network-cameras", short: "Cameras" },
    { slug: "network-intercoms", short: "Intercoms" },
    { slug: "video-analytics", short: "Analytics" },
    { slug: "management-software", short: "Software" },
    { slug: "radar-devices", short: "Radar" },
    { slug: "accessories", short: "Extras" },
    { slug: "access-control", short: "Access" },
    { slug: "network-audio", short: "Audio" },
    { slug: "body-worn", short: "Body worn" },
    { slug: "storage-and-recorders", short: "Storage" },
    { slug: "system-devices", short: "System" },
    { slug: "explosion-protected-devices", short: "Ex-proof" },
  ];
  const CATEGORY_SLUGS = new Set(PRODUCT_CATEGORIES.map((c) => c.slug));

  // An ARRAY, not a Set: the cap is "first four hearted win", so insertion
  // order is the data, and it's also the order the popup renders them in.
  let favoriteCategories = [];

  // Returns the category slug this card links to, or null if it isn't one
  // of the 12 known category tiles. Locale prefixes (/de/products/...) are
  // tolerated; anything deeper than /products/<slug> is a product or series
  // page, not a category.
  function categorySlugFromCard(card) {
    const href = card.getAttribute("href") || "";
    let path;
    try {
      path = new URL(href, location.origin).pathname;
    } catch (e) {
      return null;
    }
    const m = path.match(/\/products\/([^\/]+)\/?$/);
    if (!m) return null;
    const slug = m[1].toLowerCase();
    return CATEGORY_SLUGS.has(slug) ? slug : null;
  }

  function isFavoriteCategory(slug) {
    return favoriteCategories.includes(slug);
  }

  function toggleFavoriteCategory(slug, heartEl) {
    const at = favoriteCategories.indexOf(slug);
    if (at !== -1) {
      favoriteCategories.splice(at, 1);
    } else if (favoriteCategories.length >= MAX_FAVORITE_CATEGORIES) {
      // Full. Say so rather than silently doing nothing (or silently
      // evicting a category the user picked earlier).
      showCategoryLimitNote(heartEl);
      return;
    } else {
      favoriteCategories.push(slug);
    }
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [CATEGORIES_KEY]: favoriteCategories.slice() });
    }
    refreshAllCategoryMarkers();
  }

  // Transient inline note next to the heart. Deliberately not alert() -
  // a modal dialog on axis.com would be obnoxious, and in a content script
  // it also blocks the page.
  let categoryNoteEl = null;
  function showCategoryLimitNote(heartEl) {
    if (categoryNoteEl) categoryNoteEl.remove();
    const note = document.createElement("div");
    note.className = "axis-category-limit-note";
    note.textContent = t(
      "categoryLimitNote",
      "4XS Toolbox: only " + MAX_FAVORITE_CATEGORIES + " category buttons fit — unheart one first."
    );
    (heartEl && heartEl.parentElement ? heartEl.parentElement : document.body).appendChild(note);
    categoryNoteEl = note;
    setTimeout(() => {
      if (note.parentElement) note.remove();
      if (categoryNoteEl === note) categoryNoteEl = null;
    }, 2600);
  }

  function makeCategoryHeart(slug) {
    const el = document.createElement("span");
    el.className = "axis-fav-badge axis-fav-badge--nav-card";
    el.setAttribute("data-axis-fav-category", slug);
    el.textContent = isFavoriteCategory(slug) ? "🧡" : "♡";
    el.title = t("categoryFavTitle", "Pin this category as a quick button in the 4XS Toolbox popup");
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFavoriteCategory(slug, el);
    });
    return el;
  }

  function refreshAllCategoryMarkers() {
    document.querySelectorAll(".axis-fav-badge[data-axis-fav-category]").forEach((el) => {
      el.textContent = isFavoriteCategory(el.getAttribute("data-axis-fav-category")) ? "🧡" : "♡";
    });
  }

  function stripFps(s) {
    return (s || "").replace(/\b\d+(\.\d+)?\s*FPS\b/gi, "").trim();
  }

  // JPY prices are rounded up to the nearest 1,000 yen and expressed in 万
  // (man, 10,000) units - e.g. ¥372,274 -> ¥37.3万. EUR is the "final"
  // defined list price; USD/JPY are always FX-derived approximations.
  function fmtJpyMan(n) {
    const rounded = Math.ceil(n / 1000) * 1000;
    let man = (rounded / 10000).toFixed(1);
    if (man.endsWith(".0")) man = man.slice(0, -2);
    return "¥" + man + "万";
  }
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

  // Locale-based first-run default: if the user has never explicitly picked
  // a currency, infer one from the page's own locale prefix (e.g. /ja-jp/,
  // /en-us/) rather than always defaulting to EUR.
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
    return "EUR"; // Europe and everywhere else not called out above
  }

  // "USD" uses each variant's msrp field (the catalog base price); "EUR"
  // uses msrp_eur, present only on products with an August 2026 EUR update
  // - see content.js for the full explanation of both fields. "JPY" has no
  // baked-in field - it's derived live from msrp (USD) using whatever
  // USD/JPY rate background.js last cached (see fxRates below).
  let currentCurrency = "EUR";
  // "OFF" = the user chose to hide prices entirely (a 4th option in the
  // popup's currency toggle). Everything else about the extension keeps
  // working - chipset badges, FOV filtering, cheapest-first sorting - only
  // the price *display* is suppressed. Prices are still computed, because
  // the sort order and the series-vs-single-model badge logic depend on
  // them; see the individual guards below.
  const pricesHidden = () => currentCurrency === "OFF";
  let fxRates = null; // { usd, jpy, date }

  // Resolves the price to show for one variant in the currently selected
  // currency. EUR uses the real msrp_eur list price when present; when it's
  // missing (mostly US/Canada-only and 2N-branded SKUs with no EUR list
  // price at all), it falls back to FX-converting the USD figure instead of
  // showing nothing, marked approx:true so the caller can flag it with a
  // "~" prefix. JPY has no baked-in field at all - it's always FX-derived
  // from USD, so it's always approx:true.
  function resolvePrice(v) {
    if (currentCurrency === "EUR") {
      if (v.msrp_eur != null) return { value: v.msrp_eur, approx: false };
      if (v.msrp != null && fxRates && typeof fxRates.usd === "number") {
        return { value: v.msrp / fxRates.usd, approx: true };
      }
      return null;
    }
    if (currentCurrency === "JPY") {
      if (v.msrp != null && fxRates && typeof fxRates.jpy === "number" && typeof fxRates.usd === "number") {
        return { value: v.msrp * (fxRates.jpy / fxRates.usd), approx: true };
      }
      return null;
    }
    if (currentCurrency === "GBP") {
      if (v.msrp != null && fxRates && typeof fxRates.gbp === "number" && typeof fxRates.usd === "number") {
        return { value: v.msrp * (fxRates.gbp / fxRates.usd), approx: true };
      }
      return null;
    }
    if (v.msrp != null) return { value: v.msrp, approx: false };
    return null;
  }

  const modelKeys = Object.keys(MODELS);
  const normIndex = new Map();
  const canonicalByNorm = new Map();
  for (const key of modelKeys) {
    normIndex.set(normalize(key), MODELS[key]);
    canonicalByNorm.set(normalize(key), key);
  }
  const sortedNormKeys = Array.from(normIndex.keys()).sort((a, b) => b.length - a.length);

  // Resolves any display name shown on this page (which can be longer than
  // the plain catalog key - e.g. a nav-card tile reads "AXIS M1135 Mk II Box
  // Camera" where the catalog key itself is just "AXIS M1135 Mk II") to that
  // one canonical catalog key, via the same exact/prefix-match resolution as
  // findMatch() below. Favorites are keyed off this canonical name
  // (normalizeBare'd) instead of each page's own raw display text, so
  // favoriting a camera here is recognized as the same camera on the
  // Product Selector page, the popup, and everywhere else on the site -
  // different pages otherwise show different-length names for what's
  // really the same model, which silently produced mismatched favorite keys.
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

  // Adds model keys the current catalog has never seen (see the identical
  // function in content.js for the full rationale) - has to update
  // modelKeys/normIndex/canonicalByNorm/sortedNormKeys too, since those were
  // built once from the bundled MODELS before this ever runs.
  function registerNewProducts(newProducts) {
    if (!newProducts) return;
    let added = false;
    for (const key in newProducts) {
      if (MODELS[key]) continue;
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
  // place, keyed by each variant's own part_number - identical logic to the
  // other two content scripts.
  function applyCatalogOverride(override) {
    if (!override) return;
    registerNewProducts(override.newProducts);
    if (!override.overrides) return;
    for (const model in MODELS) {
      for (const v of MODELS[model]) {
        const o = v.part_number && override.overrides[v.part_number];
        if (o) {
          if (o.msrp_eur !== undefined) v.msrp_eur = o.msrp_eur;
          if (o.msrp !== undefined) v.msrp = o.msrp;
          if (o.msrp_display !== undefined) v.msrp_display = o.msrp_display;
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

  function sourceLabelFor(exact, approx) {
    return currentCurrency === "EUR"
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
  }

  function priceBadgeFor(name) {
    const match = findMatch(name);
    if (!match) return null;
    const picked = pickVariant(match);
    if (!picked) return null;

    if (picked.single) {
      const v = picked.single;
      const resolved = resolvePrice(v);
      if (!resolved) return null;
      const { value: val, approx } = resolved;
      const exact = currentCurrency === "USD" && !!v.msrp_exact;
      const sourceLabel = sourceLabelFor(exact, approx);
      let title = sourceLabel;
      if (v.part_number) title += t("partNumberSuffix", " — Part #" + v.part_number, v.part_number);
      if (v.variant) title += t("variantSuffix", " — " + v.variant, v.variant);
      if (v.note) title += t("noteSuffix", " (" + v.note + ")", v.note);
      return { text: fmtPrice(val, currentCurrency, exact, approx), title };
    }

    const { min, max, count } = picked.range;
    const minResolved = resolvePrice(min);
    const maxResolved = resolvePrice(max);
    if (!minResolved || !maxResolved) return null;
    const minVal = minResolved.value, maxVal = maxResolved.value;
    const rangeApprox = minResolved.approx || maxResolved.approx;
    const rangeExact = currentCurrency === "USD" && !!min.msrp_exact && !!max.msrp_exact;
    const sourceLabel = sourceLabelFor(rangeExact, rangeApprox);
    if (minVal === maxVal) {
      return {
        text: fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox),
        title: t("samePriceTitle", sourceLabel + " — " + count + " variants, same price", sourceLabel, count),
      };
    }
    const text = fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox) + "–" + fmtPrice(maxVal, currentCurrency, rangeExact, rangeApprox);
    const lowestWord = t("lowest", "lowest");
    const highestWord = t("highest", "highest");
    const minLabel = min.variant || min.part_number || lowestWord;
    const maxLabel = max.variant || max.part_number || highestWord;
    const title = t(
      "rangeTitleDetailed",
      sourceLabel + " — range across " + count + " variants (" + minLabel + " to " + maxLabel + ")",
      sourceLabel,
      count,
      minLabel,
      maxLabel
    );
    return { text, title };
  }

  // ---------------------------------------------------------------------
  // Chipset matching (CamStreamer supported-camera data) - identical
  // approach to content.js/search-content.js.
  // ---------------------------------------------------------------------

  let chipsetIndex = new Map();
  let sortedChipsetKeys = [];
  function rebuildChipsetIndex() {
    chipsetIndex = new Map();
    for (const key of Object.keys(CHIPSETS)) {
      chipsetIndex.set(normalizeBare(key), CHIPSETS[key]);
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
    // (e.g. Q3538-SLVE vs the base Q3538-LVE) - see content.js for the
    // full rationale.
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupChipset(demarined) : null;
  }

  // ---------------------------------------------------------------------
  // Series ("from $X") fallback - when a card/heading names a model that
  // isn't an exact/prefix match in the catalog (e.g. a brand-new SKU added
  // to a series page before the catalog is regenerated, or a whole-series
  // "deck" card like "AXIS M10 Box Camera Series" on a hub page), fall back
  // to the cheapest known price anywhere in that same series via a regex on
  // the leading letter+digit model prefix (e.g. "Q17" out of "AXIS
  // Q1728-LE", or "M10" out of "AXIS M10 Box Camera Series"). Mirrors
  // seriesFromBadge in search-content.js.
  // ---------------------------------------------------------------------

  const bareEntries = modelKeys.map((key) => ({ bare: normalizeBare(key), variants: MODELS[key] }));

  function seriesPrefixOf(name) {
    const tokenMatch = normalizeBare(name).match(/^([A-Z]+)(\d{2,3})(?!\d)/);
    return tokenMatch ? (tokenMatch[1] + tokenMatch[2]).toUpperCase() : null;
  }

  function seriesFromBadge(name) {
    const prefix = seriesPrefixOf(name);
    if (!prefix) return null;
    let cheapest = null;
    let cheapestPrice = null;
    let count = 0;
    for (const { bare, variants } of bareEntries) {
      if (!bare.startsWith(prefix)) continue;
      for (const v of variants) {
        const resolved = resolvePrice(v);
        if (!resolved || isBulkPack(v)) continue;
        count++;
        if (!cheapest || resolved.value < cheapestPrice) {
          cheapest = v;
          cheapestPrice = resolved.value;
        }
      }
    }
    if (!cheapest) return null;
    const cheapResolved = resolvePrice(cheapest);
    if (!cheapResolved) return null;
    const cheapVal = cheapResolved.value;
    const cheapApprox = cheapResolved.approx;
    const cheapExact = currentCurrency === "USD" && !!cheapest.msrp_exact;
    const sourceLabel = sourceLabelFor(cheapExact, cheapApprox);
    return {
      text: (isJa() ? t("fromPrefix", "from ") : "from ") + fmtPrice(cheapVal, currentCurrency, cheapExact, cheapApprox),
      title: t(
        "cheapestSeriesTitle",
        sourceLabel + " — cheapest of " + count + " matched " + prefix + "-series SKUs",
        sourceLabel,
        count,
        prefix
      ),
    };
  }

  // ---------------------------------------------------------------------
  // Shared badge-building/injection helper
  // ---------------------------------------------------------------------

  // For a single specific model (badge came back non-null), show that one
  // model's own chipset. For a whole-series fallback (a "from $X" price
  // spanning several models, e.g. a hub-page "deck" card), show every
  // distinct chipset used anywhere in that series - could be more than one,
  // hence an array either way.
  function buildBadges(name) {
    const badge = priceBadgeFor(name);
    let chipsetLabels = [];
    let priceInfo = badge;
    if (badge) {
      const chipset = chipsetFor(name);
      if (chipset) chipsetLabels = [chipset];
    } else {
      const fallback = seriesFromBadge(name);
      if (!fallback) return null;
      priceInfo = fallback;
      const prefix = seriesPrefixOf(name);
      if (prefix) chipsetLabels = seriesChipsets(prefix);
    }

    const row = document.createElement("div");
    row.className = "axis-product-badges-row";
    appendChipsetBadges(row, chipsetLabels);
    if (!pricesHidden()) {
      const priceSpan = document.createElement("span");
      priceSpan.className = "axis-product-price-badge";
      priceSpan.textContent = priceInfo.text;
      priceSpan.title = priceInfo.title;
      row.appendChild(priceSpan);
    }
    // With the price suppressed and no chipset known for this model, the row
    // would be an empty floating box over the product image - skip it.
    if (!row.childNodes.length) return null;
    return row;
  }

  // ---------------------------------------------------------------------
  // Category page (/products/axis-*-series, etc.) and category "hub" pages
  // (/products/box-cameras, etc.) - both are a grid of nav-card tiles (one
  // per specific model, or one per whole series on a hub page).
  // ---------------------------------------------------------------------

  const CARD_SELECTOR = "a.nav-card";
  const CARD_NAME_SELECTOR = ".nav-card__text h3";
  const CARD_PROCESSED_ATTR = "data-axis-product-card-done";

  function injectCategoryCards(root) {
    (root || document).querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (card.hasAttribute(CARD_PROCESSED_ATTR)) return;
      const nameEl = card.querySelector(CARD_NAME_SELECTOR);
      if (!nameEl) return;
      const name = nameEl.textContent.trim();
      if (!name) return;
      card.setAttribute(CARD_PROCESSED_ATTR, "1");

      // Favorite heart - a corner overlay independent of whether this card
      // even has a recognized price/chipset badge (favoriting a camera
      // shouldn't depend on catalog data being available for it). The card
      // itself (`a.nav-card`) is already position:relative. Guarded against
      // duplicates because refreshAllBadges() clears CARD_PROCESSED_ATTR and
      // re-runs this on a currency/chipset change, but only removes the
      // price/chipset row, not this heart.
      // A category tile (/products/<known-slug>) gets the category heart,
      // which pins a popup quick-button; everything else gets the normal
      // camera-favorite heart. Category tiles never carry a price/chipset
      // badge, so this returns early for them.
      const categorySlug = categorySlugFromCard(card);
      if (categorySlug) {
        if (!card.querySelector(".axis-fav-badge")) card.appendChild(makeCategoryHeart(categorySlug));
        return;
      }

      if (!card.querySelector(".axis-fav-badge")) {
        card.appendChild(makeFavHeart(name, "axis-fav-badge--nav-card"));
      }

      const row = buildBadges(name);
      if (!row) return;

      // Pinned to the top-center of the card, over the product image,
      // rather than appended after the tagline/count text below - that
      // bottom text varies in length card to card (and on hub pages,
      // ".nav-card__product-count" is itself already absolutely positioned
      // at the card's own bottom edge by the site's CSS), so anything
      // appended there risks colliding with it. The card itself
      // (`a.nav-card`) is already position:relative, so this needs no
      // extra wrapper - it just anchors to the card as a whole.
      row.classList.add("axis-product-badges-row--top-of-card");
      card.appendChild(row);
    });
  }

  // ---------------------------------------------------------------------
  // Individual product page (/products/axis-q1728, etc.) - a single <h1>
  // product name.
  // ---------------------------------------------------------------------

  const PRODUCT_NAME_CONTAINER_SELECTOR = ".product-top__product-name";
  const PRODUCT_PROCESSED_ATTR = "data-axis-product-page-done";

  // Individual product pages get their price/chipset badges appended as a
  // trailing breadcrumb crumb, same placement as the series page (see
  // BREADCRUMB_LIST_SELECTOR/injectSeriesHeader below) - previously this
  // appended a "card overlay" style row under the h1 instead, which read as
  // a stray floating box rather than living in the breadcrumb trail where
  // it originally shipped. Only falls back to appending after the h1 if the
  // page genuinely has no breadcrumb list to attach to.
  function injectProductPage(root) {
    const scope = root || document;
    const container = scope.querySelector(PRODUCT_NAME_CONTAINER_SELECTOR);
    if (!container || container.hasAttribute(PRODUCT_PROCESSED_ATTR)) return;
    const h1 = container.querySelector("h1");
    if (!h1) return;
    const name = h1.textContent.trim();
    if (!name) return;

    const priceInfo = priceBadgeFor(name);
    if (!priceInfo) return;
    container.setAttribute(PRODUCT_PROCESSED_ATTR, "1");

    const chipset = chipsetFor(name);
    const breadcrumbList = scope.querySelector(BREADCRUMB_LIST_SELECTOR);
    const row = document.createElement(breadcrumbList ? "li" : "div");
    row.className = breadcrumbList
      ? "breadcrumb__list-item axis-product-series-breadcrumb-item"
      : "axis-product-badges-row axis-product-badges-row--product-page";

    if (breadcrumbList) {
      const sep = document.createElement("span");
      sep.className = "axis-product-series-breadcrumb-sep";
      sep.textContent = "/";
      row.appendChild(sep);
    }
    if (chipset) appendChipsetBadges(row, [chipset]);
    if (!pricesHidden()) {
      const priceSpan = document.createElement("span");
      priceSpan.className = "axis-product-price-badge";
      priceSpan.textContent = priceInfo.text;
      priceSpan.title = priceInfo.title;
      row.appendChild(priceSpan);
    }
    // Nothing but the "/" breadcrumb separator left (prices hidden and no
    // chipset for this model) - don't append a stray separator.
    if (!row.querySelector(".axis-product-chipset-badge, .axis-product-price-badge")) return;

    if (breadcrumbList) breadcrumbList.appendChild(row);
    else h1.insertAdjacentElement("afterend", row);
  }

  // ---------------------------------------------------------------------
  // Series page hero heading (e.g. "AXIS Q17 Box Camera Series") - shows a
  // "from $X to $Y" range spanning every model in that series, via the
  // same letter+digit prefix regex used by seriesFromBadge. This is the
  // page-level title above the individual nav-card tiles, so it always
  // gets a range (never a single price/chipset), since it names a whole
  // family rather than one specific model.
  // ---------------------------------------------------------------------

  const SERIES_HEADER_SELECTOR = ".product-nav__header-title";
  const HEADER_PROCESSED_ATTR = "data-axis-product-header-done";

  // Names of the model tiles actually rendered on the current series page
  // (one per nav-card). Used to scope the breadcrumb's price range and
  // chipset list to only the models Axis is currently showing on this page
  // - a plain prefix scan over the whole catalog/chipset dataset would also
  // pick up older/discontinued same-prefix SKUs (e.g. a retired Q1765-LE on
  // ARTPEC-4) that CamStreamer's compatibility list still mentions but that
  // no longer appear as a card here, which reads as a wrong/phantom chipset
  // or price outlier on an otherwise consistent series.
  function currentPageCardNames(scope) {
    return Array.from(scope.querySelectorAll(CARD_NAME_SELECTOR))
      .map((el) => el.textContent.trim())
      .filter(Boolean);
  }

  function seriesHeaderRangeBadgeFromCards(cardNames, prefix) {
    let min = null, max = null, minP = null, maxP = null, count = 0;
    cardNames.forEach((name) => {
      const match = findMatch(name);
      if (!match) return;
      const picked = pickVariant(match);
      if (!picked) return;
      if (picked.single) {
        const v = picked.single;
        const p = resolvePrice(v).value;
        count++;
        if (!min || p < minP) { min = v; minP = p; }
        if (!max || p > maxP) { max = v; maxP = p; }
      } else if (picked.range) {
        const { min: mn, max: mx, count: c } = picked.range;
        const mnP = resolvePrice(mn).value, mxP = resolvePrice(mx).value;
        count += c;
        if (!min || mnP < minP) { min = mn; minP = mnP; }
        if (!max || mxP > maxP) { max = mx; maxP = mxP; }
      }
    });
    if (!min) return null;
    const minResolved = resolvePrice(min);
    const maxResolved = resolvePrice(max);
    if (!minResolved || !maxResolved) return null;
    const minVal = minResolved.value, maxVal = maxResolved.value;
    const rangeApprox = minResolved.approx || maxResolved.approx;
    const rangeExact = currentCurrency === "USD" && !!min.msrp_exact && !!max.msrp_exact;
    const sourceLabel = sourceLabelFor(rangeExact, rangeApprox);
    if (minVal === maxVal) {
      return {
        text: fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox),
        title: t(
          "seriesPageSamePriceTitle",
          sourceLabel + " — " + count + " " + prefix + "-series SKUs shown on this page, same price",
          sourceLabel,
          count,
          prefix
        ),
      };
    }
    return {
      text: (isJa() ? t("fromPrefix", "from ") : "from ") + fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox) + (isJa() ? " 〜 " : " to ") + fmtPrice(maxVal, currentCurrency, rangeExact, rangeApprox),
      title: t(
        "seriesPageRangeTitle",
        sourceLabel + " — range across " + count + " " + prefix + "-series SKUs shown on this page",
        sourceLabel,
        count,
        prefix
      ),
    };
  }

  // Every distinct chipset found among cataloged models sharing the same
  // series prefix (e.g. every M11xx model's chipset for prefix "M11"). Uses
  // CHIPSET_DATA directly (a separate dataset from MODELS, sourced from
  // CamStreamer rather than the price list), so a model can contribute a
  // chipset here even if it has no price, or vice versa.
  const CHIPSET_ORDER = [
    "ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7", "ARTPEC-5", "ARTPEC-4", "ARTPEC-3",
    "Ambarella CV75", "Ambarella CV25", "Ambarella S3L", "Ambarella S2L", "Ambarella S2E", "Ambarella A5S",
  ];

  function sortChipsetLabels(labels) {
    return Array.from(labels).sort((a, b) => {
      const ia = CHIPSET_ORDER.indexOf(a), ib = CHIPSET_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }

  // Fallback for hub-page "deck" cards representing a whole series (e.g.
  // "AXIS M30 Dome Camera Series" on /products/dome-cameras), which have no
  // individual tiles of their own to read a chipset from directly. Scoped to
  // MODELS (the current price catalog) rather than a raw scan over every key
  // in CHIPSETS/CamStreamer's dataset - CamStreamer's compatibility list
  // covers every camera it has ever supported, including models long
  // discontinued and no longer sold, which would otherwise surface as
  // phantom chipset badges (e.g. old Ambarella models) on a series that
  // today only ships ARTPEC hardware.
  function seriesChipsets(prefix) {
    const found = new Set();
    for (const key of modelKeys) {
      if (!normalizeBare(key).startsWith(prefix)) continue;
      const chipset = chipsetFor(key);
      if (chipset) found.add(chipset);
    }
    return sortChipsetLabels(found);
  }

  // Scoped to the models actually rendered as cards on the current series
  // page - see currentPageCardNames() above for why this matters.
  function seriesChipsetsFromCards(cardNames) {
    const found = new Set();
    cardNames.forEach((name) => {
      const chipset = chipsetFor(name);
      if (chipset) found.add(chipset);
    });
    return sortChipsetLabels(found);
  }

  // Breadcrumb trail above the heading (e.g. "Network cameras / Box cameras")
  // - the badges are appended here as one more trailing crumb rather than
  // under the heading itself, per request, and sized up to stay legible at
  // the breadcrumb's larger placement.
  const BREADCRUMB_LIST_SELECTOR = ".breadcrumb__list";

  function injectSeriesHeader(root) {
    const scope = root || document;
    const h1 = scope.querySelector(SERIES_HEADER_SELECTOR);
    if (!h1 || h1.hasAttribute(HEADER_PROCESSED_ATTR)) return;
    const title = h1.textContent.trim();
    if (!title) return;

    const tokenMatch = normalizeBare(title).match(/^([A-Z]+)(\d{2,3})(?!\d)/);
    const prefix = tokenMatch ? (tokenMatch[1] + tokenMatch[2]).toUpperCase() : null;
    const cardNames = currentPageCardNames(scope);

    // Cards for this series page may not have rendered into the DOM yet on
    // an early call. Rather than fall back to a whole-catalog prefix scan
    // (which can surface discontinued same-prefix SKUs the page itself
    // isn't showing - the bug this whole cards-scoped approach fixes),
    // simply wait: leave HEADER_PROCESSED_ATTR unset so the next
    // MutationObserver pass, once cards exist, tries again.
    if (!cardNames.length) return;

    const badge = seriesHeaderRangeBadgeFromCards(cardNames, prefix || "series");
    if (!badge) return;
    h1.setAttribute(HEADER_PROCESSED_ATTR, "1");

    const chipsets = seriesChipsetsFromCards(cardNames);

    const breadcrumbList = scope.querySelector(BREADCRUMB_LIST_SELECTOR);
    const row = document.createElement(breadcrumbList ? "li" : "div");
    row.className = breadcrumbList
      ? "breadcrumb__list-item axis-product-series-breadcrumb-item"
      : "axis-product-badges-row axis-product-series-header-badges";

    if (breadcrumbList) {
      const sep = document.createElement("span");
      sep.className = "axis-product-series-breadcrumb-sep";
      sep.textContent = "/";
      row.appendChild(sep);
    }
    appendChipsetBadges(row, chipsets);
    if (!pricesHidden()) {
      const priceSpan = document.createElement("span");
      priceSpan.className = "axis-product-price-badge";
      priceSpan.textContent = badge.text;
      priceSpan.title = badge.title;
      row.appendChild(priceSpan);
    }
    // Separator-only row guard, same as injectProductPage().
    if (!row.querySelector(".axis-product-chipset-badge, .axis-product-price-badge")) return;

    if (breadcrumbList) breadcrumbList.appendChild(row);
    else h1.insertAdjacentElement("afterend", row);
  }

  // ---------------------------------------------------------------------
  // "Compare products" table (series page, e.g. /products/axis-p13-series)
  // - one column per specific model, with each row a spec (max resolution,
  // frame rate, etc.). Adds a Chipset row and a Price row right at the top,
  // above every existing spec row, matching the table's own row markup
  // (<tr class="table-comp__row-diff table__row"><th class="table__row-header">
  // label</th><td class="table__cell">value per column</td>...) so the two
  // new rows are indistinguishable in structure from the site's own.
  // ---------------------------------------------------------------------

  const COMPARE_TABLE_SELECTOR = "table.table-comp";
  const COMPARE_HEAD_CELL_SELECTOR = "thead th";
  const COMPARE_PROCESSED_ATTR = "data-axis-compare-done";

  function buildCompareRow(labelText, cells) {
    const tr = document.createElement("tr");
    tr.className = "table-comp__row-diff table__row axis-product-compare-row";
    const th = document.createElement("th");
    th.className = "table__row-header";
    th.textContent = labelText;
    tr.appendChild(th);
    cells.forEach((cell) => {
      const td = document.createElement("td");
      td.className = "table__cell";
      if (cell) td.appendChild(cell);
      else td.textContent = "–";
      tr.appendChild(td);
    });
    return tr;
  }

  function injectCompareTable(root) {
    (root || document).querySelectorAll(COMPARE_TABLE_SELECTOR).forEach((table) => {
      if (table.hasAttribute(COMPARE_PROCESSED_ATTR)) return;
      const headCells = Array.from(table.querySelectorAll(COMPARE_HEAD_CELL_SELECTOR)).slice(1); // skip "Mark differences"
      const tbody = table.querySelector("tbody");
      if (!headCells.length || !tbody) return;
      table.setAttribute(COMPARE_PROCESSED_ATTR, "1");

      const names = headCells.map((th) => th.textContent.trim());
      const priceCells = [];
      const chipsetCells = [];
      let anyPrice = false;
      let anyChipset = false;

      names.forEach((name) => {
        const badge = priceBadgeFor(name);
        if (badge) {
          anyPrice = true;
          const span = document.createElement("span");
          span.className = "axis-product-price-badge axis-product-compare-badge";
          span.textContent = badge.text;
          span.title = badge.title;
          priceCells.push(span);
        } else {
          priceCells.push(null);
        }

        const chipset = chipsetFor(name);
        if (chipset) {
          anyChipset = true;
          const acap = CAMSTREAMER_ACAPS_PRESET.includes(chipset);
          const span = document.createElement("span");
          span.className = "axis-product-chipset-badge axis-product-compare-badge";
          span.textContent = chipset + (acap ? " ✅" : "");
          span.title =
            "Chipset (via CamStreamer app-compatibility data): " + chipset + (acap ? " — CamStreamer Support" : "");
          chipsetCells.push(span);
        } else {
          chipsetCells.push(null);
        }
      });

      // Favorite row - always shown (doesn't depend on any catalog match, so
      // it isn't gated behind the anyPrice/anyChipset guard below), one
      // heart per column so a whole model can be favorited straight from
      // the comparison table, not just from a card elsewhere on the site.
      const favCells = names.map((name) => makeFavHeart(name, "axis-product-compare-badge"));

      // Chipset above price, both above every existing spec row, so
      // inserting order is: price row first (as first child), then
      // chipset row, then favorite row (each insertBefore(tbody.firstChild)
      // pushes the previous ones down one) - net visual order top to
      // bottom: Favorite, Chipset, Price, then the site's own spec rows.
      if (anyPrice && !pricesHidden()) tbody.insertBefore(buildCompareRow(t("compareRowLabelPrice", "Price"), priceCells), tbody.firstChild);
      if (anyChipset) tbody.insertBefore(buildCompareRow(t("compareRowLabelChipset", "Chipset"), chipsetCells), tbody.firstChild);
      tbody.insertBefore(buildCompareRow(t("compareRowLabelFavorite", "🧡 Favorite"), favCells), tbody.firstChild);
    });
  }

  function injectAll(root) {
    injectCategoryCards(root);
    injectProductPage(root);
    injectSeriesHeader(root);
    injectCompareTable(root);
  }

  // Re-derives badges for every already-processed element using the
  // currently selected currency/chipset data, without waiting for new
  // elements to appear (the *_PROCESSED_ATTR gates in injectAll normally
  // prevent reprocessing, so a currency/chipset switch needs its own pass).
  function refreshAllBadges() {
    document.querySelectorAll(CARD_SELECTOR + "[" + CARD_PROCESSED_ATTR + "]").forEach((card) => {
      card.removeAttribute(CARD_PROCESSED_ATTR);
      card.querySelectorAll(".axis-product-badges-row").forEach((row) => row.remove());
    });
    document.querySelectorAll(PRODUCT_NAME_CONTAINER_SELECTOR + "[" + PRODUCT_PROCESSED_ATTR + "]").forEach((container) => {
      container.removeAttribute(PRODUCT_PROCESSED_ATTR);
      container.querySelectorAll(".axis-product-badges-row").forEach((row) => row.remove());
    });
    document.querySelectorAll(SERIES_HEADER_SELECTOR + "[" + HEADER_PROCESSED_ATTR + "]").forEach((h1) => {
      h1.removeAttribute(HEADER_PROCESSED_ATTR);
      const next = h1.nextElementSibling;
      if (next && next.classList.contains("axis-product-series-header-badges")) next.remove();
    });
    document.querySelectorAll(".axis-product-series-breadcrumb-item").forEach((li) => li.remove());
    document.querySelectorAll(COMPARE_TABLE_SELECTOR + "[" + COMPARE_PROCESSED_ATTR + "]").forEach((table) => {
      table.removeAttribute(COMPARE_PROCESSED_ATTR);
      table.querySelectorAll(".axis-product-compare-row").forEach((row) => row.remove());
    });
    injectAll(document);
    // Nav-card hearts are appended once and then left alone (guarded by
    // "if (!card.querySelector('.axis-fav-badge'))" in injectCategoryCards
    // so re-running injectAll above doesn't duplicate them) - unlike the
    // Compare table's Favorite row, which gets fully removed and rebuilt
    // from scratch a few lines up. That means a nav-card heart drawn before
    // `favorites` finished loading from storage (the very first render,
    // synchronous, always against an empty Set) never gets corrected. This
    // catches it up explicitly every time refreshAllBadges runs.
    refreshAllFavoriteMarkers();
  }

  let scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observer.disconnect();
      try {
        injectAll(document);
      } finally {
        observer.observe(document.body, { childList: true, subtree: true });
      }
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

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["axisCurrency", "catalogOverride", "chipsetData", "fxRates", FAVORITES_KEY, CATEGORIES_KEY], (res) => {
      if (res && (res.axisCurrency === "USD" || res.axisCurrency === "GBP" || res.axisCurrency === "JPY" || res.axisCurrency === "EUR" || res.axisCurrency === "OFF")) {
        currentCurrency = res.axisCurrency;
      } else {
        // Never explicitly set - infer a sensible default from this page's
        // own locale prefix and persist it so the popup/other pages agree.
        const def = localeDefaultCurrency();
        if (def) {
          currentCurrency = def;
          chrome.storage.local.set({ axisCurrency: def });
        }
      }
      if (res && res.fxRates) fxRates = res.fxRates;
      applyCatalogOverride(res && res.catalogOverride);
      if (res && res.chipsetData && Object.keys(res.chipsetData).length > 0) {
        CHIPSETS = res.chipsetData;
        rebuildChipsetIndex();
      }
      if (res && Array.isArray(res[FAVORITES_KEY])) favorites = new Set(res[FAVORITES_KEY]);
      if (res && Array.isArray(res[CATEGORIES_KEY])) {
        // Slice to the cap in case an older/other build ever stored more.
        favoriteCategories = res[CATEGORIES_KEY].filter((sl) => CATEGORY_SLUGS.has(sl)).slice(0, MAX_FAVORITE_CATEGORIES);
      }
      refreshAllBadges();
      refreshAllCategoryMarkers();
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes[CATEGORIES_KEY]) {
          const next = changes[CATEGORIES_KEY].newValue;
          favoriteCategories = Array.isArray(next) ? next.filter((sl) => CATEGORY_SLUGS.has(sl)).slice(0, MAX_FAVORITE_CATEGORIES) : [];
          refreshAllCategoryMarkers();
        }
        if (changes[FAVORITES_KEY]) {
          // Picks up favorites toggled on the Product Selector page, the
          // popup, or elsewhere on this same site while this page is open.
          favorites = new Set(Array.isArray(changes[FAVORITES_KEY].newValue) ? changes[FAVORITES_KEY].newValue : []);
          refreshAllFavoriteMarkers();
        }
        if (changes.axisCurrency) {
          const v = changes.axisCurrency.newValue;
          currentCurrency = v === "EUR" || v === "GBP" || v === "JPY" || v === "OFF" ? v : "USD";
          refreshAllBadges();
        }
        if (changes.fxRates) {
          fxRates = changes.fxRates.newValue || null;
          if (currentCurrency === "JPY" || currentCurrency === "GBP") refreshAllBadges();
        }
        if (changes.catalogOverride) {
          applyCatalogOverride(changes.catalogOverride.newValue);
          refreshAllBadges();
        }
        if (changes.chipsetData) {
          CHIPSETS = changes.chipsetData.newValue || {};
          rebuildChipsetIndex();
          refreshAllBadges();
        }
      });
    }
  }
})();
