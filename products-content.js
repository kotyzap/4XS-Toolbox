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

  // A label naming a RANGE rather than a chip - "ARTPEC 6-9", "ARTPEC-6/7".
  // It carries no chipset information: "ARTPEC 6-9" is exactly the set in
  // CAMSTREAMER_ACAPS_PRESET, so the label and its checkmark say the same
  // single thing twice. Where Axis has not published the real SoC, show what
  // we actually know - CamStreamer app support - rather than a falsely
  // precise chip range.
  function isChipsetGroupLabel(label) {
    return label.indexOf("/") !== -1 || /\s\d-\d$/.test(label);
  }

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
  function appendChipsetBadges(row, rawLabels, exactSoc) {
    // A product newer than CamStreamer's list has no bucket at all, but Axis
    // may still name its SoC - fall back to that rather than show nothing.
    // It gets no CamStreamer checkmark, which is correct: CamStreamer has
    // not listed it, so we cannot claim app support for it.
    const labels = rawLabels && rawLabels.length ? rawLabels : exactSoc ? [exactSoc] : [];
    const groupAcap = new Map();
    labels.forEach((raw) => {
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
    // One collapsed group plus a known exact SoC means this row is a single
    // model, so show Axis's own chip name instead of CamStreamer's bucket.
    // More than one group means a whole series - the bucket is honest there.
    const useExact = exactSoc && sortedLabels.length === 1;
    sortedLabels.forEach((label) => {
      const acap = groupAcap.get(label);
      const asSupport = !useExact && acap && isChipsetGroupLabel(label);
      const shown = useExact ? exactSoc : asSupport ? "CamStreamer" : label;
      const chipsetSpan = document.createElement("span");
      chipsetSpan.className = "axis-product-chipset-badge";
      chipsetSpan.textContent = shown + (acap ? " ✅" : "");
      chipsetSpan.title = useExact
        ? t("chipsetTooltipExact", "System-on-chip (via Axis product data): ") + exactSoc +
            (acap ? t("chipsetTooltipCsSuffix", " — CamStreamer Support") : "")
        : asSupport
          ? t("chipsetTooltipSupport",
              "Runs CamStreamer apps. Axis does not publish the exact chipset for this " +
              "model; CamStreamer only groups it as ") + label
          : t("chipsetTooltipPrefix", "Chipset (via CamStreamer app-compatibility data): ") + label +
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
  // AXIS OS 13 verdict (os13-data.js, keys identical to
  // CHIPSET_DATA.chipsets). The lookup here is EXACT ONLY - deliberately
  // NOT lookupChipset()'s prefix/substring fallback. "M1137" and
  // "M1137 Mk II" share one chipset bucket (ARTPEC-6/7) but not one OS 13
  // verdict: the Mk II is ARTPEC-7 and upgrades, the original is ARTPEC-6
  // and never will. A fuzzy hit would report the stranded model as fine,
  // and telling an owner their camera upgrades when it cannot is the one
  // error that costs money rather than time - see Preflight rule A9.
  // Anything not matched exactly, or whose verdict is "unknown", gets no
  // badge at all. No badge never reads as "no OS 13"; a wrong badge does.
  // ---------------------------------------------------------------------

  // os13-data.js is the bundled snapshot. background.js re-harvests the
  // firmware tracks weekly into chrome.storage.local.os13Data and that
  // overrides it live, the same way chipsetData overrides CHIPSET_DATA.
  let OS13 = (typeof OS13_DATA !== "undefined" && OS13_DATA.models) || {};
  const OS13_KEY = "axisShowOs13";
  let showOs13 = true;

  let os13Index = new Map();
  function rebuildOs13Index() {
    os13Index = new Map();
    for (const key of Object.keys(OS13)) os13Index.set(normalizeBare(key), OS13[key]);
  }
  rebuildOs13Index();

  // axis.com lists packaging, regional and optics variants as cards of their
  // own: "AXIS Q6355-LE No Midspan", "AXIS M5000-G US", "AXIS Q1728 48 mm",
  // "AXIS M3125-LVE Black". They are the same camera on the same firmware, so
  // the verdict carries over - but ONLY when every extra token is packaging
  // noise. "Mk II" is not noise: the M1137 and the M1137 Mk II are different
  // products with opposite verdicts. That is exactly why this cannot reuse
  // lookupChipset()'s prefix fallback, which would happily match them.
  // Which trailing tokens may be trimmed when looking for the base model.
  //
  // Enumerating descriptors ("Camera", "Dome", "Corner", "Bispectral", ...)
  // was a losing game - axis.com names cards from marketing copy. Inverted
  // instead: an Axis model code ALWAYS carries a digit (Q8752-E, P3245-LVE,
  // M12-free names like "Bispectral" never identify a product on their own),
  // so a trailing token with no digit in it is decoration by construction.
  // Digit-bearing tokens still need the explicit list below, because those
  // are the ones that could be a model code.
  //
  // A Mk marker is excluded from both: "Mk II" is identity, not decoration.
  // The original M1137 and the M1137 Mk II are different products with
  // different OS 13 answers, so trimming "Mk II" would be the one error that
  // costs the owner money (Preflight rule A9).
  const OS13_MK_TOKEN = /^(?:MK|II|III|IV)$/;
  const OS13_VARIANT_TOKEN = /^(?:\d+(?:\.\d+)?|\d+P|\d+HZ|M12|RJ45|I-CS|4K)$/;

  function os13TrimmableToken(tok) {
    if (OS13_MK_TOKEN.test(tok)) return false;
    if (OS13_VARIANT_TOKEN.test(tok)) return true;
    return !/\d/.test(tok);
  }

  function os13VariantOnly(rest) {
    const tokens = rest.split(" ").filter(Boolean);
    return tokens.length > 0 && tokens.every(os13TrimmableToken);
  }

  // Walk the name back a whole token at a time. Stop dead at the first token
  // that is not packaging noise, so a non-variant suffix can never be trimmed
  // away to reach a different product's entry.
  function os13TrimVariant(norm) {
    const tokens = norm.split(" ").filter(Boolean);
    for (let i = tokens.length - 1; i > 0; i--) {
      if (!os13VariantOnly(tokens.slice(i).join(" "))) return null;
      const hit = os13Index.get(tokens.slice(0, i).join(" "));
      if (hit) return hit;
    }
    return null;
  }

  // Raw entry, whatever its verdict. Used for the exact SoC, which is worth
  // showing even when the OS 13 answer is unknown.
  function os13Lookup(displayName) {
    const norm = normalizeBare(displayName);
    let entry = os13Index.get(norm);
    if (!entry) {
      // Same stainless/marine spelling fallback chipsetFor() uses.
      const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
      if (demarined !== norm) entry = os13Index.get(demarined);
    }
    if (!entry) entry = os13TrimVariant(norm);
    return entry || null;
  }

  function os13For(displayName) {
    const entry = os13Lookup(displayName);
    return entry && entry.v !== "unknown" ? entry : null;
  }

  // Axis's own SoC for this model ("ARTPEC-7", "ARTPEC-8 (x2)", "CV25"),
  // where CamStreamer's data only has a collapsed bucket ("ARTPEC 6-9").
  // DISPLAY ONLY: data-axis-chipset and the CamStreamer-support checkmark
  // keep the bucket value, so chipset filtering and sorting are untouched.
  function exactSocFor(displayName) {
    const entry = displayName ? os13Lookup(displayName) : null;
    return (entry && entry.p) || null;
  }

  // Aggregate (series) cards cover many models at once. Badge them only when
  // every model agrees - a mixed series, or one holding any unknown, gets
  // nothing rather than a verdict that is wrong for half of it.
  function os13ForNames(names) {
    if (!names || !names.length) return null;
    let agreed = null;
    for (const name of names) {
      const entry = os13For(name);
      if (!entry) return null;
      if (agreed && agreed.v !== entry.v) return null;
      agreed = agreed || entry;
    }
    return agreed;
  }

  function buildOs13Badge(entry, className) {
    const ok = entry.v === "os13";
    const span = document.createElement("span");
    span.className = className + (ok ? " is-os13" : " is-no-os13");
    span.textContent = ok ? "OS13 \u2705" : "OS13 \uD83D\uDEAB";
    const parts = [ok
      ? t("os13TooltipYes", "AXIS OS 13 supported")
      : t("os13TooltipNo", "No AXIS OS 13 for this hardware - this camera stays on its current firmware")];
    if (entry.p) parts.push(entry.p);
    if (entry.e) parts.push(t("os13TooltipEofw", "firmware support until ") + entry.e);
    span.title = parts.join(" - ");
    return span;
  }

  function appendOs13Badge(row, displayName, className) {
    if (!showOs13) return;
    const entry = os13For(displayName);
    if (entry) row.appendChild(buildOs13Badge(entry, className));
  }

  // ---------------------------------------------------------------------
  // Compute capability (compute-data.js): DLPU / MLPU / none, from Axis's
  // Q4 2026 comparison tables. NOT derivable from the chipset - ARTPEC-7 is
  // mixed (2 DLPU, 4 MLPU, 11 none) and the S6LM onboard cameras are current
  // products with no compute unit at all. A model absent from that table
  // gets no badge rather than a guess, same rule as the OS 13 verdict.
  // Shares the OS 13 name matching, including its Mk-marker guard.
  // ---------------------------------------------------------------------

  const COMPUTE = (typeof COMPUTE_DATA !== "undefined" && COMPUTE_DATA.models) || {};
  const COMPUTE_KEY = "axisShowCompute";
  let showCompute = true;

  const computeIndex = new Map();
  for (const key of Object.keys(COMPUTE)) computeIndex.set(normalizeBare(key), COMPUTE[key]);

  function computeFor(displayName) {
    const norm = normalizeBare(displayName);
    let code = computeIndex.get(norm);
    if (!code) {
      const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
      if (demarined !== norm) code = computeIndex.get(demarined);
    }
    if (!code) {
      const toks = norm.split(" ").filter(Boolean);
      for (let i = toks.length - 1; i > 0 && !code; i--) {
        if (!toks.slice(i).every(os13TrimmableToken)) break;
        code = computeIndex.get(toks.slice(0, i).join(" "));
      }
    }
    return code || null;
  }

  const COMPUTE_TEXT = { d: "DLPU", m: "MLPU", n: "NO DLPU" };
  const COMPUTE_TIP = {
    d: "Deep learning processing unit - runs deep-learning models on the camera",
    m: "Machine learning processing unit - lighter than a DLPU, no deep-learning models",
    n: "No machine-learning compute unit on this camera",
  };

  function buildComputeBadge(code, className) {
    const span = document.createElement("span");
    span.className =
      className + (code === "d" ? " is-dlpu" : code === "m" ? " is-mlpu" : " is-nocompute");
    span.textContent = COMPUTE_TEXT[code];
    span.title =
      t("computeTooltip" + code.toUpperCase(), COMPUTE_TIP[code]) +
      t("computeTooltipSource", " (Axis comparison tables, Q4 2026)");
    return span;
  }

  // Series aggregate, same unanimity rule as os13ForNames: a DLPU/MLPU badge
  // on a heading that covers many models is only honest when every model in
  // it has the same compute unit. One unknown model and the series gets
  // nothing, because "DLPU" on a series where one camera has none is the
  // kind of wrong that costs a sale.
  function computeForNames(names) {
    if (!names || !names.length) return null;
    let agreed = null;
    for (const name of names) {
      const code = computeFor(name);
      if (!code) return null;
      if (agreed && agreed !== code) return null;
      agreed = agreed || code;
    }
    return agreed;
  }

  function appendComputeBadge(row, displayName, className) {
    if (!showCompute) return;
    const code = computeFor(displayName);
    if (code) row.appendChild(buildComputeBadge(code, className));
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
      if (fallback) {
        priceInfo = fallback;
        const prefix = seriesPrefixOf(name);
        if (prefix) chipsetLabels = seriesChipsets(prefix);
      } else {
        // No price for this model - typically a product newer than the
        // bundled price list. The chipset and OS 13 answers don't depend on
        // the price list, so render those rather than nothing at all.
        priceInfo = null;
        const chipset = chipsetFor(name);
        if (chipset) chipsetLabels = [chipset];
        const haveSomething =
          chipsetLabels.length || exactSocFor(name) || (showOs13 && os13For(name)) ||
          (showCompute && computeFor(name));
        if (!haveSomething) return null;
      }
    }

    const row = document.createElement("div");
    row.className = "axis-product-badges-row";
    // A series-fallback row describes many models, so the exact SoC of any
    // one of them would be misleading there; a specific model gets it.
    const specific = Boolean(badge) || priceInfo === null;
    appendChipsetBadges(row, chipsetLabels, specific ? exactSocFor(name) : null);
    if (showOs13) {
      // A specific model gets its own verdict; a series-fallback card only
      // gets one when every model in the series agrees (see os13ForNames).
      let os13 = null;
      if (specific) {
        os13 = os13For(name);
      } else {
        const seriesPrefix = seriesPrefixOf(name);
        if (seriesPrefix) os13 = os13ForNames(seriesModelNames(seriesPrefix));
      }
      if (os13) row.appendChild(buildOs13Badge(os13, "axis-product-os13-badge"));
    }
    if (specific) {
      appendComputeBadge(row, name, "axis-product-compute-badge");
    } else if (showCompute) {
      const seriesPrefix = seriesPrefixOf(name);
      const code = seriesPrefix ? computeForNames(seriesModelNames(seriesPrefix)) : null;
      if (code) row.appendChild(buildComputeBadge(code, "axis-product-compute-badge"));
    }
    if (priceInfo && !pricesHidden()) {
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

    // Not gated on price: a product newer than the bundled price list (e.g.
    // AXIS M3945-R) still has a chipset and an OS 13 answer, and those are
    // the reason to look at this row at all.
    const priceInfo = priceBadgeFor(name);
    const chipset = chipsetFor(name);
    const exactSoc = exactSocFor(name);
    if (!priceInfo && !chipset && !exactSoc && !(showOs13 && os13For(name))) return;
    container.setAttribute(PRODUCT_PROCESSED_ATTR, "1");

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
    if (chipset || exactSoc) appendChipsetBadges(row, chipset ? [chipset] : [], exactSoc);
    appendOs13Badge(row, name, "axis-product-os13-badge");
    appendComputeBadge(row, name, "axis-product-compute-badge");
    if (priceInfo && !pricesHidden()) {
      const priceSpan = document.createElement("span");
      priceSpan.className = "axis-product-price-badge";
      priceSpan.textContent = priceInfo.text;
      priceSpan.title = priceInfo.title;
      row.appendChild(priceSpan);
    }
    // Nothing but the "/" breadcrumb separator left (prices hidden and no
    // chipset for this model) - don't append a stray separator.
    if (!row.querySelector(".axis-product-chipset-badge, .axis-product-price-badge, .axis-product-os13-badge, .axis-product-compute-badge")) return;

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
  // Model names behind a series prefix, scoped to MODELS for the same reason
  // seriesChipsets() is - see its comment above.
  function seriesModelNames(prefix) {
    const names = [];
    for (const key of modelKeys) {
      if (normalizeBare(key).startsWith(prefix)) names.push(key);
    }
    return names;
  }

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
    if (showOs13) {
      const seriesOs13 = os13ForNames(cardNames);
      if (seriesOs13) row.appendChild(buildOs13Badge(seriesOs13, "axis-product-os13-badge"));
    }
    if (showCompute) {
      const seriesCompute = computeForNames(cardNames);
      if (seriesCompute) row.appendChild(buildComputeBadge(seriesCompute, "axis-product-compute-badge"));
    }
    if (!pricesHidden()) {
      const priceSpan = document.createElement("span");
      priceSpan.className = "axis-product-price-badge";
      priceSpan.textContent = badge.text;
      priceSpan.title = badge.title;
      row.appendChild(priceSpan);
    }
    // Separator-only row guard, same as injectProductPage().
    if (!row.querySelector(".axis-product-chipset-badge, .axis-product-price-badge, .axis-product-os13-badge, .axis-product-compute-badge")) return;

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
      const os13Cells = [];
      let anyPrice = false;
      let anyChipset = false;
      let anyOs13 = false;

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
          const exact = exactSocFor(name);
          const span = document.createElement("span");
          span.className = "axis-product-chipset-badge axis-product-compare-badge";
          span.textContent = (exact || chipset) + (acap ? " ✅" : "");
          span.title =
            (exact ? "System-on-chip (via Axis product data): " + exact
                   : "Chipset (via CamStreamer app-compatibility data): " + chipset) +
            (acap ? " — CamStreamer Support" : "");
          chipsetCells.push(span);
        } else {
          chipsetCells.push(null);
        }

        const os13 = showOs13 ? os13For(name) : null;
        if (os13) {
          anyOs13 = true;
          os13Cells.push(buildOs13Badge(os13, "axis-product-os13-badge axis-product-compare-badge"));
        } else {
          os13Cells.push(null);
        }
      });

      // Favorite row - always shown (doesn't depend on any catalog match, so
      // it isn't gated behind the anyPrice/anyChipset guard below), one
      // heart per column so a whole model can be favorited straight from
      // the comparison table, not just from a card elsewhere on the site.
      const favCells = names.map((name) => makeFavHeart(name, "axis-product-compare-badge"));

      // Each insertBefore(tbody.firstChild) pushes the previous rows down
      // one, so inserting price, then OS 13, then chipset, then favorite
      // gives the net visual order top to bottom: Favorite, Chipset,
      // AXIS OS 13, Price, then the site's own spec rows.
      if (anyPrice && !pricesHidden()) tbody.insertBefore(buildCompareRow(t("compareRowLabelPrice", "Price"), priceCells), tbody.firstChild);
      if (anyOs13) tbody.insertBefore(buildCompareRow(t("compareRowLabelOs13", "AXIS OS 13"), os13Cells), tbody.firstChild);
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
    chrome.storage.local.get(["axisCurrency", "catalogOverride", "chipsetData", "fxRates", "os13Data", OS13_KEY, COMPUTE_KEY, FAVORITES_KEY, CATEGORIES_KEY], (res) => {
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
      // Default ON - absent key means never toggled, not opted out.
      if (res && res[OS13_KEY] === false) showOs13 = false;
      if (res && res[COMPUTE_KEY] === false) showCompute = false;
      applyCatalogOverride(res && res.catalogOverride);
      if (res && res.chipsetData && Object.keys(res.chipsetData).length > 0) {
        CHIPSETS = res.chipsetData;
        rebuildChipsetIndex();
      }
      if (res && res.os13Data && Object.keys(res.os13Data).length > 0) {
        OS13 = res.os13Data;
        rebuildOs13Index();
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
        if (changes.os13Data) {
          OS13 = changes.os13Data.newValue || {};
          rebuildOs13Index();
          refreshAllBadges();
        }
        if (changes[OS13_KEY]) {
          showOs13 = changes[OS13_KEY].newValue !== false;
          refreshAllBadges();
        }
        if (changes[COMPUTE_KEY]) {
          showCompute = changes[COMPUTE_KEY].newValue !== false;
          refreshAllBadges();
        }
      });
    }
  }
})();
