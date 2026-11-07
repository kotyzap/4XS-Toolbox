(function () {
  "use strict";

  // Runs on https://www.axis.com/search - the site's Google Programmable
  // Search Engine results page. Appends an MSRP price badge to the end of
  // each result's bold title line when the title names a model (or model
  // family) we recognize from the Q1 2026 price list.
  //
  // Matching logic (normalize/findMatch/pickVariant) is intentionally
  // duplicated from content.js rather than shared, since content.js wraps
  // its own copy in an IIFE, so it isn't reachable from a second content
  // script file. Keeping this file self-contained avoids touching the
  // already-shipped Product Selector overlay.

  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};
  let CHIPSETS = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};
  const CAMSTREAMER_ACAPS_PRESET = ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"];

  // A label naming a RANGE rather than a chip ("ARTPEC-6/7"). It carries no
  // chipset information - that set is exactly CAMSTREAMER_ACAPS_PRESET - so
  // where Axis has not published the real SoC we show what we actually know:
  // CamStreamer app support.
  function isChipsetGroupLabel(label) {
    return label.indexOf("/") !== -1 || /\s\d-\d$/.test(label);
  }


  // Japanese localization - see i18n.js (loaded first, per manifest.json)
  // for the isJapanese detection logic.
  const JA = {
    priceSourceEur: "AXIS Price List (2026年7月, EUR)",
    priceSourceEurApprox: "EURのリスト価格なし — 現在のUSD/EURレートでUSDから概算",
    priceSourceJpy: "USD建てリスト価格からFX換算、USD/JPYリアルタイムレート",
    priceSourceUsd: "AXIS Price List (2026年7月, EUR) からFX換算",
    partNumberSuffix: (part) => ` — 型番 #${part}`,
    variantSuffix: (variant) => ` — ${variant}`,
    samePriceTitle: (sourceLabel, count) => `${sourceLabel} — ${count} バリエーション、同一価格`,
    rangeTitle: (sourceLabel, count) => `${sourceLabel} — ${count} バリエーションの価格帯`,
    fromPrefix: "最安 ",
    cheapestSeriesTitle: (sourceLabel, count, prefix) =>
      `${sourceLabel} — ${prefix}シリーズの一致した ${count} 件中の最安値`,
    chipsetTooltipPrefix: "チップセット (CamStreamerアプリ対応データより): ",
    chipsetTooltipCsSuffix: " — CamStreamer対応",
    favToggleTitle: "お気に入り登録",
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
      .replace(/®|™/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeBare(s) {
    return normalize(s).replace(/^AXIS\s+/, "");
  }

  // ---------------------------------------------------------------------
  // Favorites - same "♡ -> 🧡" marker and shared chrome.storage.local
  // ("axisFavorites") key as every other surface (Product Selector overlay,
  // toolbar popup, product/category pages). Declared this early (right
  // after normalizeBare) because chrome.storage.local.get() further down
  // reads FAVORITES_KEY - referencing a const/let before its own
  // declaration line has run is a ReferenceError (content.js hit exactly
  // this bug once already).
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

  function makeFavHeart(name) {
    const el = document.createElement("span");
    el.className = "axis-search-fav-badge";
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

  function refreshAllFavoriteMarkers() {
    document.querySelectorAll(".axis-search-fav-badge[data-axis-fav-name]").forEach((el) => {
      const name = el.getAttribute("data-axis-fav-name");
      el.textContent = isFavorite(name) ? "🧡" : "♡";
    });
  }

  function stripFps(s) {
    return (s || "").replace(/\b\d+(\.\d+)?\s*FPS\b/gi, "").trim();
  }

  // JPY prices are rounded up to the nearest 1,000 yen and expressed in 万
  // (man, 10,000) units - e.g. ¥372,274 -> ¥37.3万, shorter than the raw
  // digit string. EUR is the "final" defined list price; USD/JPY are always
  // FX-derived approximations (USD baked in at bundle-build time, JPY
  // computed live from msrp_eur - see content.js).
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
  // /en-us/) rather than always defaulting to EUR - see localeDefaultCurrency().
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

  // "USD" uses each variant's msrp field (the catalog base price, sourced
  // from Axis's public Q1/Q2 2026 comparison-table price list, with a
  // subset of products carrying August 2026 US$ updates on top); "EUR"
  // uses msrp_eur, present only on products with an August 2026 EUR
  // update. "JPY" has no baked-in field - it's derived live from msrp
  // (USD) using whatever USD/JPY rate background.js last cached (see
  // fxRates below).
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

  // Bare (no "AXIS " prefix) keys, used for the whole-series/family fallback below.
  const bareEntries = modelKeys.map((key) => ({ bare: normalizeBare(key), variants: MODELS[key] }));

  // Resolves a matched search-result segment to its one canonical catalog
  // key (same exact/prefix resolution as findMatch() below), so favorites
  // are keyed consistently with every other surface on the site - see the
  // matching comment in content.js/products-content.js for the full
  // rationale (different pages show different-length names for the same
  // camera, which otherwise produces mismatched favorite keys).
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

  // ---------------------------------------------------------------------
  // Chipset matching (CamStreamer supported-camera data) - identical
  // approach to content.js's chipsetFor, applied to the same AXIS-prefixed
  // segment used for price matching rather than a scraped card name.
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
    // See content.js for the rationale - Axis marine/stainless "S" variants
    // (Q3538-SLVE vs base Q3538-LVE) aren't always listed separately by
    // CamStreamer, but share the same chipset when they are.
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

  // Adds model keys the current catalog has never seen (see content.js for
  // the full rationale) - has to update modelKeys/normIndex/canonicalByNorm/
  // sortedNormKeys too, since those were built once from the bundled MODELS
  // before this ever runs.
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
  // place, keyed by each variant's own part_number - see content.js for the
  // identical logic on the Product Selector page.
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

  // Mode A: the title names one specific model (optionally with several
  // lens/color/etc. variants of that SAME model) - identical matching to the
  // Product Selector overlay, so a genuine variant spread still shows as a
  // "$min-$max" range rather than "from".
  function specificPriceBadge(segment) {
    const match = findMatch(segment);
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
    return {
      text: fmtPrice(minVal, currentCurrency, rangeExact, rangeApprox) + "–" + fmtPrice(maxVal, currentCurrency, rangeExact, rangeApprox),
      title: t("rangeTitle", sourceLabel + " — range across " + count + " variants", sourceLabel, count),
    };
  }

  // Mode B: the title only names a series/family (e.g. "M11", "Q35") that
  // spans several distinct models with their own separate catalog entries -
  // show the cheapest matched SKU anywhere in that family as "from $X".
  //
  // Axis series codes are short (2-3 digits: M11, M30, Q35, P39...); full
  // model numbers are 4+ digits (M1137, Q6100...). The digit-count+lookahead
  // here specifically excludes 4+ digit numbers, so a specific model that
  // just didn't get an exact/prefix hit in Mode A (e.g. a discontinued
  // "AXIS M1137" predecessor to "M1137 Mk II") falls through to no badge
  // instead of a misleading "from" price borrowed from an unrelated SKU
  // that merely happens to start with the same digits.
  function seriesFromBadge(segment) {
    const tokenMatch = segment.match(/^AXIS\s+([A-Z]+)(\d{2,3})(?!\d)/i);
    if (!tokenMatch) return null;
    const prefix = (tokenMatch[1] + tokenMatch[2]).toUpperCase();
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
      text: isJa()
        ? t("fromPrefix", "from ") + fmtPrice(cheapVal, currentCurrency, cheapExact, cheapApprox)
        : "from " + fmtPrice(cheapVal, currentCurrency, cheapExact, cheapApprox),
      title: t(
        "cheapestSeriesTitle",
        sourceLabel + " — cheapest of " + count + " matched " + prefix + "-series SKUs",
        sourceLabel,
        count,
        prefix
      ),
    };
  }

  // Search result titles are full sentences ("Product support for AXIS
  // M1137 Network Camera", "AXIS M1137 Mk II Box Camera - Axis
  // Communications"), not clean model names like on the Product Selector.
  // Isolate everything from the first "AXIS" onward and let findMatch's
  // existing prefix logic treat trailing words as a harmless remainder.
  function extractAxisSegment(rawTitle) {
    const idx = rawTitle.search(/\bAXIS\b/i);
    if (idx === -1) return null;
    return rawTitle.slice(idx).trim();
  }

  // ---------------------------------------------------------------------
  // DOM injection (Google Programmable Search Engine result markup)
  // ---------------------------------------------------------------------

  const RESULT_SELECTOR = ".gsc-webResult.gsc-result";
  const TITLE_SELECTOR = "a.gs-title";
  const PROCESSED_ATTR = "data-axis-price-done";

  function injectAll() {
    document.querySelectorAll(RESULT_SELECTOR).forEach((result) => {
      // Google's CSE widget renders each result's title twice (one hidden
      // layout variant); only the visible one should get a badge.
      const anchors = Array.from(result.querySelectorAll(TITLE_SELECTOR));
      const anchor = anchors.find((a) => a.offsetParent !== null) || anchors[0];
      if (!anchor || anchor.hasAttribute(PROCESSED_ATTR)) return;
      anchor.setAttribute(PROCESSED_ATTR, "1");

      const segment = extractAxisSegment(anchor.textContent.trim());
      if (!segment) return;

      // Chipset is only attached when the title names one specific model
      // (Mode A) - a whole-series "from $X" result can span multiple
      // chipsets, so showing just one there would be misleading.
      const specific = specificPriceBadge(segment);
      const badge = specific || seriesFromBadge(segment);
      if (!badge) return;

      if (specific) {
        const chipset = chipsetFor(segment);
        if (chipset) {
          const acap = CAMSTREAMER_ACAPS_PRESET.includes(chipset);
          const exact = exactSocFor(segment);
          const asSupport = !exact && acap && isChipsetGroupLabel(chipset);
          const chipsetSpan = document.createElement("span");
          chipsetSpan.className = "axis-search-chipset-badge";
          chipsetSpan.textContent = (exact || (asSupport ? "CamStreamer" : chipset)) +
            (acap ? " ✅" : "");
          chipsetSpan.title =
            (exact
              ? t("chipsetTooltipExact", "System-on-chip (via Axis product data): ") + exact
              : t("chipsetTooltipPrefix", "Chipset (via CamStreamer app-compatibility data): ") + chipset) +
            (acap ? t("chipsetTooltipCsSuffix", " — CamStreamer Support") : "");
          anchor.appendChild(chipsetSpan);
        }
        appendOs13Badge(anchor, segment, "axis-search-os13-badge");
        appendComputeBadge(anchor, segment, "axis-search-compute-badge");
      }

      // Only the price badge is suppressed when prices are hidden - the
      // price lookup above still runs, because whether it found a specific
      // model (vs a whole series) is what decides if a chipset badge is
      // shown at all.
      if (!pricesHidden()) {
        const span = document.createElement("span");
        span.className = "axis-search-price-badge";
        span.textContent = badge.text;
        span.title = badge.title;
        anchor.appendChild(span);
      }

      // Favorite heart - only for a specific single-model match (same gate
      // as the chipset badge above), since a whole-series "from $X" result
      // doesn't name one canonical model to favorite. Appended inside the
      // result's own <a> like the other badges, so it needs its own
      // stopPropagation/preventDefault (see makeFavHeart) to keep clicking
      // it from following the search result link. Guarded against
      // duplicates because refreshAllBadges() clears PROCESSED_ATTR and
      // re-runs this on a currency/chipset change, but only removes the
      // price/chipset spans, not this heart.
      if (specific && !anchor.querySelector(".axis-search-fav-badge")) {
        anchor.appendChild(makeFavHeart(segment));
      }
    });
  }

  let scheduled = false;
  function scheduleInject() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      observer.disconnect();
      try {
        injectAll();
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

  // Re-derive every already-badged title under the new currency (simplest
  // approach here since there's no sort/series state to preserve like on the
  // Product Selector - just wipe and re-run).
  function refreshAllBadges() {
    document.querySelectorAll(TITLE_SELECTOR + "[" + PROCESSED_ATTR + "]").forEach((anchor) => {
      anchor.removeAttribute(PROCESSED_ATTR);
      const existingPrice = anchor.querySelector(".axis-search-price-badge");
      if (existingPrice) existingPrice.remove();
      const existingCompute = anchor.querySelector(".axis-search-compute-badge");
      if (existingCompute) existingCompute.remove();
      const existingOs13 = anchor.querySelector(".axis-search-os13-badge");
      if (existingOs13) existingOs13.remove();
      const existingChipset = anchor.querySelector(".axis-search-chipset-badge");
      if (existingChipset) existingChipset.remove();
    });
    injectAll();
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["axisCurrency", "catalogOverride", "chipsetData", "fxRates", "os13Data", OS13_KEY, COMPUTE_KEY, FAVORITES_KEY], (res) => {
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
      refreshAllBadges();
    });
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        if (changes[FAVORITES_KEY]) {
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
        if (changes[OS13_KEY]) {
          showOs13 = changes[OS13_KEY].newValue !== false;
          refreshAllBadges();
        }
        if (changes[COMPUTE_KEY]) {
          showCompute = changes[COMPUTE_KEY].newValue !== false;
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
      });
    }
  }
})();
