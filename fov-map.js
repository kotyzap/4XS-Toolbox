(function () {
  "use strict";

  // Pulled live from manifest.json (same approach as popup.js's
  // versionLabel) so this never drifts out of sync on a version bump.
  const versionEl = document.getElementById("versionLabel");
  if (versionEl && chrome.runtime?.getManifest) {
    versionEl.textContent = "v" + chrome.runtime.getManifest().version;
  }

  // ---------------------------------------------------------------------
  // Japanese localization - see i18n.js for the isJapanese detection logic
  // shared across the whole extension (JPY selected, Japanese browser/OS
  // language; the third signal, an Axis JP-locale URL, doesn't apply on this
  // standalone page).
  // ---------------------------------------------------------------------
  const JA = {
    pageHeading: "AXIS FOV マップ カメラセレクター",
    themeToggleTitle: "ライト/ダークテーマを切り替え",
    stepHeading: "1. カメラを配置してコーンを描く",
    stepTextCamera: "地図をクリックしてカメラの位置を配置してください。",
    stepTextEdge1: "カメラの位置からドラッグして、必要な範囲の片側の端を設定してください。",
    stepTextEdge2: "もう一度ドラッグして、コーンのもう片方の端を設定してください。",
    stepTextDone: "コーンを設定しました。カメラのピンまたは黄色い端のハンドルをドラッグして形を調整できます。外側へドラッグし続けると180°を超えて全周まで広げられます。やり直す場合はリセットを押してください。",
    resetBtn: "リセット",
    adjustHeading: "2. 微調整",
    angleFieldLabel: "必要な水平画角",
    rangeFieldLabel: "カバー距離(参考値 - モデルごとの距離データはまだありません)",
    filterHeading: "3. 絞り込み・並べ替え",
    sortByLabel: "並べ替え",
    sortOptionFit: "画角が最も無駄なく合う順",
    sortOptionPrice: "価格が安い順",
    camstreamerOnlyLabel: "CamStreamer App対応モデルのみ (ARTPEC-6/7、ARTPEC-8、ARTPEC-9)",
    summaryHeading: "マッチの詳細",
    resultsHeading: "該当するAxisモデル",
    resultsCount: (n) => `${n} 件`,
    stripeHint: "横スクロールで一覧を確認 →",
    panelToggleTitle: "設定を表示/非表示",
    specFov: "画角",
    specChipset: "チップセット",
    openProductPageTitle: "axis.comでこのモデルのページを開く",
    copySkuTitle: "クリックで型番をコピー",
    copied: "コピーしました",
    copyFailed: "Ctrl+Cを押してください",
    csSupported: "✅ CamStreamer対応",
    badgePtz: "PTZ",
    badgePanOnly: "PTZ · パン動作で対応",
    badgePanoramic: "パノラマ",
    badgeMultiSensor: "マルチセンサー",
    ptzTitle: "パン/チルト/ズーム - 表示中の画角は最も広角側の値です。加えて水平360°までパン可能です",
    ptzPanOnlyTitle: "パン動作でこの角度に対応 - PTZは一度に1方向しか撮影できず、範囲全体を同時に監視するわけではありません",
    panoTitle: "パノラマ/魚眼 - この画角全体を同時に撮影できます",
    multiSensorTitle: "マルチセンサー: 表示中の画角は複数センサーの合計値であり、1センサーが見る範囲ではありません",
    noResultsReasonCs: "CamStreamer対応で、",
    noResultsHint: (angle, reason) =>
      `${reason}画角データが登録済みで${angle}°の要件を満たすモデルがありません。角度を狭める、CamStreamerフィルターをオフにする、またはfov-data.js/chipset-data.jsのカバー状況を確認してください。`,
    summaryRequiredAngle: (angle) => `必要な画角: ${angle}°。`,
    summaryCoverage: (matched, totalWithFov) => `画角データが登録されている ${totalWithFov} モデル中 ${matched} モデルがカバー可能です`,
    summaryExcluded: (noData) => `(${noData} 件は画角データが未登録のため対象外)。`,
    summaryCsOnlyNote: " CamStreamerのみ表示するフィルターが有効です。",
    summaryDepth: (range) => `必要なカバー距離: 約${range} m(モデルごとの距離データはまだないため参考値)。`,
    summaryCurrency: (currency) => `価格は${currency}で表示(ポップアップで選択中の通貨と同じ)。`,
    summaryPricesHidden: "価格は非表示です(ポップアップの通貨切り替えで変更できます)。",
  };
  const isJa = () => typeof AxisI18N !== "undefined" && AxisI18N.isJapanese;
  function t(key, enFallback, ...args) {
    if (!isJa()) return enFallback;
    const v = JA[key];
    if (v === undefined) return enFallback;
    return typeof v === "function" ? v(...args) : v;
  }

  // ---------------------------------------------------------------------
  // Theme (mirrors popup.js's light/dark toggle, persisted separately)
  // ---------------------------------------------------------------------
  const THEME_KEY = "axisFovMapTheme";
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  }
  chrome.storage?.local.get([THEME_KEY], (r) => applyTheme(r[THEME_KEY] || "light"));
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    chrome.storage?.local.set({ [THEME_KEY]: next });
  });

  // ---------------------------------------------------------------------
  // Currency (mirrors popup.js/content.js: axisCurrency + fxRates in
  // chrome.storage.local, same fmtJpyMan/fmt formatting). Kept in sync live
  // via storage.onChanged so switching currency in the popup while this tab
  // is open updates prices here too, without a reload.
  // ---------------------------------------------------------------------
  let currentCurrency = "EUR";
  let fxRates = null; // { usd, jpy, date } - both are "1 EUR = X" rates

  function fmtJpyMan(n) {
    const rounded = Math.ceil(n / 1000) * 1000;
    let man = (rounded / 10000).toFixed(1);
    if (man.endsWith(".0")) man = man.slice(0, -2);
    return "¥" + man + "万";
  }

  // "OFF" = prices hidden extension-wide (4th option in the popup's currency
  // toggle). Sorting by price still works here - it reveals no numbers.
  const pricesHidden = () => currentCurrency === "OFF";

  function escAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // ---------------------------------------------------------------------
  // Product thumbnails.
  //
  // Axis image URLs can't be derived from a model name - they're CMS paths
  // with upload dates and cache tokens (e.g. /sites/axis/files/2022-04/
  // 76912%3BM11%2035%20mkii...png). So for each model we fetch its product
  // page once and read the image URL out of the markup, then cache that URL
  // in chrome.storage.local forever. Only cards actually scrolled into view
  // are fetched (IntersectionObserver), so opening the tool costs nothing.
  //
  // Failures are cached too (as null) - a model whose slug we can't resolve
  // shouldn't be re-fetched on every visit. Cards simply show no image.
  // ---------------------------------------------------------------------
  const IMG_CACHE_KEY = "axisModelImages";
  const SLUG_OK_KEY = "axisSlugVerified"; // modelKey -> true|false (page exists?)
  let slugOk = {};
  let imgCache = {}; // modelKey -> url | null
  const imgInFlight = new Set();

  chrome.storage?.local.get([IMG_CACHE_KEY, SLUG_OK_KEY], (r) => {
    if (r[IMG_CACHE_KEY]) imgCache = r[IMG_CACHE_KEY];
    if (r[SLUG_OK_KEY]) slugOk = r[SLUG_OK_KEY];
    // Fill in any thumbs already on screen that we have cached URLs for, and
    // turn on the links for models we already confirmed resolve.
    document.querySelectorAll(".card-thumb[data-model]").forEach(hydrateThumb);
    Object.keys(slugOk).forEach(applyModelLinks);
  });

  function persistImgCache() {
    chrome.storage?.local.set({ [IMG_CACHE_KEY]: imgCache });
  }

  // "AXIS M1135 Mk II" -> "axis-m1135-mk-ii"
  function slugForModel(modelKey) {
    return modelKey
      .toLowerCase()
      .replace(/[®™]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Prefer Axis's own 500x500 square derivative (a small .webp, ideal for a
  // thumbnail) and fall back to the full-size og:image if that's not present.
  function extractImageUrl(html) {
    const square = html.match(
      /https:\/\/www\.axis\.com\/sites\/axis\/files\/styles\/square_500x500_\/[^"'\s>]+/
    );
    if (square) return square[0].replace(/&amp;/g, "&");
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return og ? og[1].replace(/&amp;/g, "&") : null;
  }

  async function fetchModelImage(modelKey) {
    if (imgInFlight.has(modelKey)) return;
    imgInFlight.add(modelKey);
    let verdict = null; // true = page exists, false = doesn't, null = couldn't tell
    try {
      const resp = await fetch(`https://www.axis.com/products/${slugForModel(modelKey)}`, {
        credentials: "omit",
      });
      const body = resp.ok ? await resp.text() : "";
      // A missing product page on axis.com answers with an essentially empty
      // body rather than a proper 404 status, so treat "no usable markup" as
      // "doesn't exist" too.
      verdict = resp.ok && body.length > 500;
      imgCache[modelKey] = verdict ? extractImageUrl(body) : null;
    } catch (e) {
      imgCache[modelKey] = null; // offline / blocked - don't retry this session
      verdict = null; // a network failure says nothing about whether the page exists
    }
    if (verdict !== null) {
      slugOk[modelKey] = verdict;
      persistSlugOk();
      applyModelLinks(modelKey);
    }
    imgInFlight.delete(modelKey);
    persistImgCache();
    document
      .querySelectorAll(`.card-thumb[data-model="${CSS.escape(modelKey)}"]`)
      .forEach(hydrateThumb);
  }

  // Model names mostly slug straight onto a product page URL, but not always:
  // F-Series modular sensors, main units and accessories carry a product-type
  // suffix Axis doesn't derive from the model name (e.g. F2135-RE lives at
  // /products/axis-f2135-re-fisheye-sensor, not /products/axis-f2135-re).
  // Rather than guess, the model name is only a real link once we've actually
  // confirmed the page exists - the thumbnail fetch doubles as that check, and
  // the verdict is cached so it's known up front on later visits. Until then
  // (and permanently, for names that don't resolve) the name renders as plain
  // text: no link is better than a link that 404s.
  function persistSlugOk() {
    chrome.storage?.local.set({ [SLUG_OK_KEY]: slugOk });
  }

  function productUrlFor(modelKey) {
    return `https://www.axis.com/products/${slugForModel(modelKey)}`;
  }

  function applyModelLinks(modelKey) {
    document.querySelectorAll(`a.model[data-model="${CSS.escape(modelKey)}"]`).forEach((a) => {
      if (slugOk[modelKey] === true) {
        a.href = productUrlFor(modelKey);
        a.title = t("openProductPageTitle", "Open this model's page on axis.com");
      } else {
        // An <a> with no href isn't a link - no navigation, no pointer, and
        // CSS styles it as ordinary card text.
        a.removeAttribute("href");
        a.removeAttribute("title");
      }
    });
  }

  function hydrateThumb(thumb) {
    const modelKey = thumb.dataset.model;
    if (!modelKey) return;
    const url = imgCache[modelKey];
    if (url) {
      if (thumb.querySelector("img")) return; // already filled
      const img = document.createElement("img");
      img.src = url;
      img.alt = modelKey;
      img.loading = "lazy";
      thumb.appendChild(img);
      thumb.classList.add("has-img");
    } else if (!(modelKey in imgCache)) {
      fetchModelImage(modelKey);
    }
  }

  // Only fetch/attach images for cards the user actually scrolls to.
  const thumbObserver =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (!e.isIntersecting) continue;
              hydrateThumb(e.target);
              thumbObserver.unobserve(e.target);
            }
          },
          { root: null, rootMargin: "200px" }
        )
      : null;

  // Given a catalog entry, format its price in currentCurrency. Returns null
  // if prices are hidden, or if the needed data (e.g. a live JPY rate) isn't
  // available yet.
  function fmtPrice(entry) {
    if (pricesHidden()) return null;
    if (currentCurrency === "EUR") {
      return entry.msrp_eur != null ? `€${entry.msrp_eur.toLocaleString()}` : null;
    }
    if (currentCurrency === "USD") {
      return entry.msrp_display || (entry.msrp != null ? `$${entry.msrp.toLocaleString()}` : null);
    }
    if (currentCurrency === "JPY") {
      if (entry.msrp_eur == null || !fxRates?.jpy) return null;
      return fmtJpyMan(entry.msrp_eur * fxRates.jpy);
    }
    return null;
  }

  chrome.storage?.local.get(["axisCurrency", "fxRates"], (r) => {
    if (
      r.axisCurrency === "USD" || r.axisCurrency === "EUR" ||
      r.axisCurrency === "JPY" || r.axisCurrency === "OFF"
    ) {
      currentCurrency = r.axisCurrency;
    }
    if (r.fxRates) fxRates = r.fxRates;
    // Guarded on manualAngle (rather than a DOM element declared further
    // down) so this stays safe regardless of when the callback fires -
    // Chrome always calls storage callbacks asynchronously, i.e. after the
    // rest of this file has run, but not depending on that is free.
    if (typeof manualAngle === "number") runMatch();
  });
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let changed = false;
    if (changes.axisCurrency) {
      currentCurrency = changes.axisCurrency.newValue;
      changed = true;
    }
    if (changes.fxRates) {
      fxRates = changes.fxRates.newValue;
      changed = true;
    }
    if (changed && manualAngle != null) runMatch();
  });

  // ---------------------------------------------------------------------
  // Model name matching against FOV_DATA / AXIS_CATALOG - ported as-is from
  // content.js so the map tool stays in sync with the same normalization and
  // prefix-matching rules used on the Product Selector page.
  // ---------------------------------------------------------------------
  const MODELS = (typeof AXIS_CATALOG !== "undefined" && AXIS_CATALOG.models) || {};
  const FOVS = (typeof FOV_DATA !== "undefined" && FOV_DATA.fov) || {};
  const CHIPSETS = (typeof CHIPSET_DATA !== "undefined" && CHIPSET_DATA.chipsets) || {};

  // Same chipset labels the Product Selector's "CamStreamer App supported"
  // filter preset uses (content.js CAMSTREAMER_ACAPS_PRESET) - kept as a
  // literal copy rather than a shared import since this is a plain script
  // tag setup, not a module system. Update both places together if the
  // CamStreamer-supported chipset list ever changes.
  const CAMSTREAMER_ACAPS_PRESET = ["ARTPEC-9", "ARTPEC-8", "ARTPEC-6/7"];

  // ---------------------------------------------------------------------
  // Camera class. A single "horizontal FOV" number means quite different
  // things depending on the kind of camera, and matching them all the same
  // way is misleading:
  //
  //  - "fixed"     : a fixed or varifocal lens. fov.max is genuinely the
  //                  widest it can see at once. Straightforward.
  //  - "ptz"       : an optical-zoom pan/tilt/zoom. fov.max is only its
  //                  widest ZOOM setting - it can additionally pan a full
  //                  circle, so anywhere in a 360 ring is reachable. It can
  //                  only watch one direction at a time, which is why the
  //                  card says so explicitly rather than pretending a PTZ
  //                  covers a wide cone simultaneously.
  //  - "panoramic" : fisheye / multi-sensor panoramic. Genuinely sees its
  //                  published width all at once.
  //
  // Class is derived from the price list's own `section` field, which already
  // labels every model - no new data to curate. Two exceptions handled below.
  const MULTISENSOR_MODELS = new Set([
    // fov-data.js's header documents these four as publishing a single
    // COMBINED horizontal FOV across several sensors rather than a per-sensor
    // figure, so their number isn't comparable to a single-lens one.
    "P3747-PLVE",
    "M4327-P",
    "P3818-PVE",
    "P4708-PLVE",
  ]);

  function cameraClassOf(section, fov, bareName) {
    // Q6300-E and Q6020-E sit in the pan/tilt/zoom section but are fixed
    // 3.7 mm 360-degree panoramic cameras with no optical zoom at all, so
    // trust the geometry over the section label here.
    if (fov && fov.min === 360 && fov.max === 360) return "panoramic";
    if (/pan\/tilt\/zoom/i.test(section || "")) return "ptz";
    if (/panoramic/i.test(section || "")) return "panoramic";
    // A fisheye modular sensor (e.g. F2135-RE at 185 deg) is filed under
    // "modular cameras" but behaves like a panoramic.
    if (fov && fov.max >= 180) return "panoramic";
    return "fixed";
  }

  // The widest angle this camera can be said to cover. For a PTZ that's the
  // full circle it can pan across (per the product decision to match PTZs on
  // pan range); for everything else it's the published optical width.
  function coverableAngle(row) {
    if (!row.fov) return null;
    return row.cameraClass === "ptz" ? 360 : row.fov.max;
  }

  function normalize(s) {
    return (s || "").toUpperCase().replace(/®|™/g, "").replace(/\s+/g, " ").trim();
  }
  function normalizeBare(s) {
    return normalize(s).replace(/^AXIS\s+/, "");
  }

  let fovIndex = new Map();
  let sortedFovKeys = [];
  for (const key of Object.keys(FOVS)) fovIndex.set(normalize(key), FOVS[key]);
  sortedFovKeys = Array.from(fovIndex.keys()).sort((a, b) => b.length - a.length);

  function lookupFov(norm) {
    if (fovIndex.has(norm)) return fovIndex.get(norm);
    for (const key of sortedFovKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return fovIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedFovKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) bestKey = key;
    }
    return bestKey ? fovIndex.get(bestKey) : null;
  }

  function fovFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupFov(norm);
    if (direct) return direct;
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupFov(demarined) : null;
  }

  let chipsetIndex = new Map();
  for (const key of Object.keys(CHIPSETS)) chipsetIndex.set(normalize(key), CHIPSETS[key]);
  let sortedChipsetKeys = Array.from(chipsetIndex.keys()).sort((a, b) => b.length - a.length);

  function lookupChipset(norm) {
    if (chipsetIndex.has(norm)) return chipsetIndex.get(norm);
    for (const key of sortedChipsetKeys) {
      if (norm === key || norm.startsWith(key + " ") || norm.startsWith(key + "-")) {
        return chipsetIndex.get(key);
      }
    }
    let bestKey = null;
    for (const key of sortedChipsetKeys) {
      if (key.startsWith(norm + " ") && (!bestKey || key.length < bestKey.length)) bestKey = key;
    }
    return bestKey ? chipsetIndex.get(bestKey) : null;
  }

  function chipsetFor(displayName) {
    const norm = normalizeBare(displayName);
    const direct = lookupChipset(norm);
    if (direct) return direct;
    const demarined = norm.replace(/-S([A-Z]+)\b/, "-$1");
    return demarined !== norm ? lookupChipset(demarined) : null;
  }

  // Flatten the catalog into one row per model+variant, each carrying the
  // display name used to resolve FOV/chipset data the same way content.js
  // does.
  const CATALOG_ROWS = [];
  for (const modelKey of Object.keys(MODELS)) {
    for (const entry of MODELS[modelKey]) {
      const displayName = entry.variant ? `${modelKey} ${entry.variant}` : modelKey;
      const chipset = chipsetFor(displayName);
      const fov = fovFor(displayName);
      const bare = normalizeBare(modelKey);
      const row = {
        modelKey,
        displayName,
        entry,
        fov,
        chipset,
        camstreamerSupported: chipset ? CAMSTREAMER_ACAPS_PRESET.includes(chipset) : false,
        cameraClass: cameraClassOf(entry.section, fov, bare),
        multiSensor: MULTISENSOR_MODELS.has(bare),
      };
      row.coverable = coverableAngle(row);
      CATALOG_ROWS.push(row);
    }
  }

  // ---------------------------------------------------------------------
  // Map + cone drawing
  // ---------------------------------------------------------------------
  const map = AxisMap.create("map", {
    center: { lat: 50.0755, lng: 14.4378 }, // Prague, sensible default
    zoom: 13,
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

  const EDGE_HANDLE_CLASS = "edge-handle";

  // Manual overrides once the cone exists (angle/range inputs), decoupled
  // from the raw edge geometry so the user can fine-tune after drawing.
  let manualAngle = null;
  let manualRange = null;

  const stepText = document.getElementById("stepText");
  const resetBtn = document.getElementById("resetBtn");
  const adjustBox = document.getElementById("adjustBox");
  const filterBox = document.getElementById("filterBox");
  const summaryBox = document.getElementById("summaryBox");
  const resultsStripe = document.getElementById("resultsStripe");
  const resultsTrack = document.getElementById("results");
  const resultsCountEl = document.getElementById("resultsCount");
  const angleSlider = document.getElementById("angleSlider");
  const angleInput = document.getElementById("angleInput");
  const rangeSlider = document.getElementById("rangeSlider");
  const rangeInput = document.getElementById("rangeInput");
  const sortSelect = document.getElementById("sortSelect");
  const camstreamerOnly = document.getElementById("camstreamerOnly");
  sortSelect.addEventListener("change", runMatch);
  camstreamerOnly.addEventListener("change", runMatch);

  // ---------------------------------------------------------------------
  // Click-to-copy on the SKU badges. Delegated from the track rather than
  // bound per card, so it survives every re-render without re-wiring.
  // ---------------------------------------------------------------------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Older/locked-down contexts where the async clipboard API is
      // unavailable - fall back to the classic hidden-textarea trick.
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  resultsTrack.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".sku-badge");
    if (!btn) return;
    ev.preventDefault();
    const sku = btn.dataset.sku;
    if (!sku) return;
    const ok = await copyText(sku);
    const label = btn.querySelector(".sku-text");
    if (!label) return;
    // Swap the badge to a confirmation for a beat, then restore the SKU.
    // Guarded by a timer id on the element so rapid repeat clicks don't leave
    // it stuck showing the confirmation.
    if (btn._resetTimer) clearTimeout(btn._resetTimer);
    else btn.dataset.origText = label.textContent;
    label.textContent = ok
      ? "✓ " + t("copied", "Copied")
      : t("copyFailed", "Press Ctrl+C");
    btn.classList.toggle("copied", ok);
    btn._resetTimer = setTimeout(() => {
      label.textContent = btn.dataset.origText || sku;
      btn.classList.remove("copied");
      btn._resetTimer = null;
    }, 1400);
  });

  // ---------------------------------------------------------------------
  // Collapsible UI: each settings box collapses via its own heading, the
  // whole sidebar hides via the header ⚙, and the results stripe collapses
  // to just its header bar. All three states persist in chrome.storage.local
  // so the layout you left the page in is the one you come back to.
  //
  // Anything that changes the map's available size has to be followed by
  // map.resize(), or the map keeps rendering at the old
  // viewport until the next window resize.
  // ---------------------------------------------------------------------
  const UI_KEY = "axisFovMapUiState";
  let uiState = { panelHidden: false, stripeCollapsed: false, collapsedBoxes: [] };

  function saveUiState() {
    chrome.storage?.local.set({ [UI_KEY]: uiState });
  }

  function refreshMapSize() {
    // Two passes: one immediately, one after the layout/transition settles,
    // so the tiles are correct whichever way the reflow lands.
    map.resize();
    setTimeout(() => map.resize(), 220);
  }

  function setBoxCollapsed(header, collapsed, persist) {
    const body = document.getElementById(header.dataset.target);
    if (!body) return;
    header.setAttribute("aria-expanded", collapsed ? "false" : "true");
    body.hidden = collapsed;
    const id = header.dataset.target;
    const set = new Set(uiState.collapsedBoxes || []);
    collapsed ? set.add(id) : set.delete(id);
    uiState.collapsedBoxes = Array.from(set);
    if (persist) saveUiState();
  }

  document.querySelectorAll(".box-header").forEach((header) => {
    header.addEventListener("click", () => {
      const collapsed = header.getAttribute("aria-expanded") === "true"; // about to become collapsed
      setBoxCollapsed(header, collapsed, true);
    });
  });

  const panelToggle = document.getElementById("panelToggle");
  function applyPanelHidden(hidden, persist) {
    uiState.panelHidden = hidden;
    document.body.classList.toggle("panel-hidden", hidden);
    panelToggle.classList.toggle("active", hidden);
    panelToggle.setAttribute("aria-pressed", hidden ? "true" : "false");
    if (persist) saveUiState();
    refreshMapSize();
  }
  panelToggle.addEventListener("click", () => applyPanelHidden(!uiState.panelHidden, true));

  const stripeToggle = document.getElementById("stripeToggle");
  function applyStripeCollapsed(collapsed, persist) {
    uiState.stripeCollapsed = collapsed;
    stripeToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    resultsTrack.hidden = collapsed;
    if (persist) saveUiState();
    refreshMapSize();
  }
  stripeToggle.addEventListener("click", () => applyStripeCollapsed(!uiState.stripeCollapsed, true));

  chrome.storage?.local.get([UI_KEY], (r) => {
    if (!r[UI_KEY]) return;
    uiState = Object.assign(uiState, r[UI_KEY]);
    applyPanelHidden(!!uiState.panelHidden, false);
    applyStripeCollapsed(!!uiState.stripeCollapsed, false);
    (uiState.collapsedBoxes || []).forEach((targetId) => {
      const header = document.querySelector(`.box-header[data-target="${targetId}"]`);
      if (header) setBoxCollapsed(header, true, false);
    });
  });

  // Static labels/headings/tooltips that don't depend on current cone state -
  // applied once at startup and again whenever isJapanese flips.
  function applyStaticI18nLabels() {
    document.getElementById("pageHeadingText").textContent = t("pageHeading", "AXIS FOV Map Camera Selector");
    document.getElementById("themeToggle").title = t("themeToggleTitle", "Toggle light/dark theme");
    panelToggle.title = t("panelToggleTitle", "Show/hide settings");
    document.getElementById("stepHeading").textContent = t("stepHeading", "1. Place the camera & draw the cone");
    resetBtn.textContent = t("resetBtn", "Reset");
    document.getElementById("adjustHeading").textContent = t("adjustHeading", "2. Fine-tune");
    document.getElementById("angleFieldLabel").textContent = t("angleFieldLabel", "Required horizontal angle");
    document.getElementById("rangeFieldLabel").textContent = t(
      "rangeFieldLabel",
      "Coverage depth (informational — no per-model range data yet)"
    );
    document.getElementById("filterHeading").textContent = t("filterHeading", "3. Filter & sort");
    document.getElementById("sortByLabel").textContent = t("sortByLabel", "Sort by");
    document.getElementById("sortOptionFit").textContent = t("sortOptionFit", "Tightest FOV fit (least overkill)");
    document.getElementById("sortOptionPrice").textContent = t("sortOptionPrice", "Price, low to high");
    document.getElementById("camstreamerOnlyLabel").textContent = t(
      "camstreamerOnlyLabel",
      "CamStreamer App supported only (ARTPEC-6/7, ARTPEC-8, ARTPEC-9)"
    );
    document.getElementById("summaryHeading").textContent = t("summaryHeading", "Match details");
    document.getElementById("resultsHeading").textContent = t("resultsHeading", "Matching Axis models");
    document.getElementById("stripeHint").textContent = t("stripeHint", "Scroll sideways to browse →");
    setStepText();
    if (manualAngle != null) runMatch();
  }

  function setStepText() {
    if (step === STEP.CAMERA) stepText.textContent = t("stepTextCamera", "Click the map to drop the camera location.");
    else if (step === STEP.EDGE1) stepText.textContent = t("stepTextEdge1", "Click-drag from the camera to set one edge of the required coverage.");
    else if (step === STEP.EDGE2) stepText.textContent = t("stepTextEdge2", "Click-drag again to set the other edge of the coverage cone.");
    else stepText.textContent = t("stepTextDone", "Cone set. Drag the camera pin or either yellow edge handle to reshape it — keep dragging outward to open it past 180° and up to a full circle. Reset starts over.");
  }
  setStepText();

  function bearingDeg(a, b) {
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  // Destination point given a start point, bearing (deg) and distance (m).
  function destPoint(start, bearing, distanceM) {
    const R = 6371000;
    const δ = distanceM / R;
    const θ = (bearing * Math.PI) / 180;
    const φ1 = (start.lat * Math.PI) / 180;
    const λ1 = (start.lng * Math.PI) / 180;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
    return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI };
  }

  // Shortest signed sweep from bearing a to bearing b, in range (-180, 180].
  function angleDiff(a, b) {
    let d = (b - a) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }

  // The cone is held as a CENTRE bearing plus a total angle.
  //
  // Two edge bearings always describe TWO possible sectors: the minor one
  // (<= 180 deg) and the major one (the rest of the circle). Which the user
  // means is genuinely ambiguous from the two points alone, and always taking
  // the minor one made the cone flip to the far side the moment you dragged a
  // handle past 180 - so wide cones were undrawable by hand.
  //
  // Instead, pick whichever candidate keeps the cone's CENTRE where it already
  // is. The centre is the thing that jumps discontinuously when the wrong
  // sector is chosen - the angle barely moves (at the 180 boundary both
  // candidates are ~180, which is why comparing angles doesn't work, but their
  // centres are 180 apart). So: of the two sectors, take the one whose centre
  // is nearest the current centre.
  //
  // That gives the right behaviour at both boundaries. Dragging a handle
  // outward through 180 keeps the centre put and the cone just keeps opening,
  // up to a full circle. Dragging a handle back through the *other* handle
  // collapses the cone to nothing and reopens it on the far side, which is
  // also what you'd expect, because there the near-centre candidate is the
  // small sector.
  function computeConeFromEdges(currentCentre) {
    const b1 = bearingDeg(cameraLatLng, edge1LatLng);
    const b2 = bearingDeg(cameraLatLng, edge2LatLng);
    const d1 = map.distance(cameraLatLng, edge1LatLng);
    const d2 = map.distance(cameraLatLng, edge2LatLng);

    const minor = angleDiff(b1, b2); // signed, |minor| <= 180
    // Same pair of edges, swept the other way round the circle.
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
    // More segments for wider arcs so a near-circle doesn't look polygonal.
    const steps = Math.max(24, Math.ceil(angle / 4));
    const start = centre - angle / 2;
    const pts = [];
    // A full circle needs no apex vertex; anything less is a wedge and does.
    if (angle < 359.9) pts.push(cameraLatLng);
    for (let i = 0; i <= steps; i++) {
      pts.push(destPoint(cameraLatLng, start + (angle * i) / steps, range));
    }
    if (angle < 359.9) pts.push(cameraLatLng);
    if (conePolygon) conePolygon.setLatLngs(pts);
    else conePolygon = map.cone("axis-cone", pts);
  }

  // Recomputes angle/range straight from the current camera + edge lat/lngs
  // and redraws everything. Used both right after the two clicks/drags that
  // define the cone, and whenever the camera or an edge handle is dragged to
  // reshape an already-finalized cone.
  //
  // `hint` is the cone's current centre bearing, which is what lets a drag
  // continue smoothly through 180 deg instead of flipping to the other side
  // (see computeConeFromEdges). It's deliberately omitted for the very first
  // draw, where there's no previous centre to be continuous with and the minor
  // sector is the sane reading of two fresh clicks.
  function updateFromGeometry(hint) {
    const cone = computeConeFromEdges(hint);
    manualAngle = Math.round(cone.angle * 10) / 10;
    manualRange = Math.round(cone.range);
    coneCentre = cone.centre;
    drawCone(coneCentre, manualAngle, manualRange);
    syncAdjustInputs();
    runMatch();
  }

  // Called from the drag handlers: reshape while staying continuous with the
  // angle the cone already had.
  function updateFromDrag() {
    updateFromGeometry(coneCentre);
  }

  function finalizeCone() {
    step = STEP.DONE;
    setStepText();
    updateFromGeometry(); // no hint - first draw takes the minor sector
    adjustBox.hidden = false;
    filterBox.hidden = false;
    summaryBox.hidden = false;
    resultsStripe.hidden = false;
    refreshMapSize(); // the stripe appearing shrinks the map's height
  }

  let coneCentre = 0; // bearing the cone is centred on, in degrees

  function syncAdjustInputs() {
    angleSlider.value = manualAngle;
    angleInput.value = manualAngle;
    rangeSlider.max = Math.max(2000, Math.ceil(manualRange * 1.5));
    rangeSlider.value = Math.min(rangeSlider.max, manualRange);
    rangeInput.value = manualRange;
  }

  function redrawFromInputs() {
    drawCone(coneCentre, manualAngle, manualRange);
    runMatch();
  }

  angleSlider.addEventListener("input", () => {
    manualAngle = Number(angleSlider.value);
    angleInput.value = manualAngle;
    redrawFromInputs();
  });
  angleInput.addEventListener("input", () => {
    const v = Number(angleInput.value);
    if (!Number.isFinite(v)) return;
    manualAngle = Math.min(360, Math.max(1, v));
    angleSlider.value = manualAngle;
    redrawFromInputs();
  });
  rangeSlider.addEventListener("input", () => {
    manualRange = Number(rangeSlider.value);
    rangeInput.value = manualRange;
    redrawFromInputs();
  });
  rangeInput.addEventListener("input", () => {
    const v = Number(rangeInput.value);
    if (!Number.isFinite(v)) return;
    manualRange = Math.max(1, v);
    rangeSlider.value = Math.min(Number(rangeSlider.max), manualRange);
    redrawFromInputs();
  });

  function resetAll() {
    step = STEP.CAMERA;
    cameraLatLng = edge1LatLng = edge2LatLng = null;
    // Markers and shapes both expose remove(); shapes also drop their
    // GeoJSON source so a later redraw re-creates it cleanly.
    [cameraMarker, edge1Marker, edge2Marker, edge1Line, edge2Line, draftLine, conePolygon].forEach(
      (l) => l && l.remove()
    );
    cameraMarker = edge1Marker = edge2Marker = edge1Line = edge2Line = draftLine = conePolygon = null;
    manualAngle = manualRange = null;
    adjustBox.hidden = true;
    filterBox.hidden = true;
    summaryBox.hidden = true;
    resultsStripe.hidden = true;
    resultsTrack.innerHTML = "";
    resultsCountEl.textContent = "";
    document.getElementById("resultsSummary").textContent = "";
    setStepText();
    refreshMapSize(); // the stripe going away gives the map its height back
  }
  resetBtn.addEventListener("click", resetAll);

  // Dragging the camera pin keeps both edge points fixed in place and just
  // recalculates bearing/range from the new camera position - so the cone
  // reshapes around the new apex without you having to redraw the edges.
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
      cameraMarker = map.marker(cameraLatLng, { draggable: true });
      makeCameraDraggable();
      step = STEP.EDGE1;
      setStepText();
    }
  });

  map.on("mousedown", (e) => {
    if (step !== STEP.EDGE1 && step !== STEP.EDGE2) return;
    dragging = true;
    map.setDragEnabled(false);
    draftLine = map.line("axis-draft", [cameraLatLng, e.latlng], { dashed: true });
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
      edge1Line = map.line("axis-edge1", [cameraLatLng, edge1LatLng]);
      edge1Marker = map.marker(edge1LatLng, { className: EDGE_HANDLE_CLASS, draggable: true });
      edge1Marker.on("drag", (ev) => {
        edge1LatLng = ev.target.getLatLng();
        edge1Line.setLatLngs([cameraLatLng, edge1LatLng]);
        if (step === STEP.DONE) updateFromDrag();
      });
      step = STEP.EDGE2;
      setStepText();
    } else if (step === STEP.EDGE2) {
      edge2LatLng = e.latlng;
      edge2Line = map.line("axis-edge2", [cameraLatLng, edge2LatLng]);
      edge2Marker = map.marker(edge2LatLng, { className: EDGE_HANDLE_CLASS, draggable: true });
      edge2Marker.on("drag", (ev) => {
        edge2LatLng = ev.target.getLatLng();
        edge2Line.setLatLngs([cameraLatLng, edge2LatLng]);
        if (step === STEP.DONE) updateFromDrag();
      });
      finalizeCone();
    }
  });

  // ---------------------------------------------------------------------
  // Matching + results rendering
  // ---------------------------------------------------------------------
  function runMatch() {
    const angle = manualAngle;
    // A camera covers the requirement when the angle it can cover reaches at
    // least what's asked for. For fixed/varifocal and panoramic models that's
    // their published width (a lens wider than needed still covers the area
    // fine; fov.min only matters for an over-provisioning/pixel-density
    // concern that's out of scope - see README). For a PTZ it's the full 360
    // it can pan across, per coverableAngle().
    let matches = CATALOG_ROWS.filter((r) => r.coverable != null && angle <= r.coverable);

    const csOnly = camstreamerOnly.checked;
    if (csOnly) matches = matches.filter((r) => r.camstreamerSupported);

    const priceOf = (r) => r.entry.msrp_eur ?? r.entry.msrp ?? Infinity;
    // "Excess" drives the tightest-fit ranking. A PTZ's excess is measured
    // against its widest optical FOV, not the 360 pan range that got it into
    // the list - otherwise every PTZ would look maximally over-provisioned and
    // sink to the bottom regardless of how well its actual lens fits.
    const excessOf = (r) => Math.max(0, r.fov.max - angle);
    const sortMode = sortSelect.value; // "fit" | "price"
    matches.sort((a, b) => {
      if (sortMode === "price") {
        const priceDiff = priceOf(a) - priceOf(b);
        if (priceDiff !== 0) return priceDiff;
        return excessOf(a) - excessOf(b);
      }
      // Cameras that cover the cone outright rank above ones that only get
      // there by panning, since only the former watch it all at once.
      const panA = a.cameraClass === "ptz" && a.fov.max < angle ? 1 : 0;
      const panB = b.cameraClass === "ptz" && b.fov.max < angle ? 1 : 0;
      if (panA !== panB) return panA - panB;
      const excessA = excessOf(a);
      const excessB = excessOf(b);
      if (excessA !== excessB) return excessA - excessB; // tightest FOV fit first
      return priceOf(a) - priceOf(b);
    });

    const totalWithFov = CATALOG_ROWS.filter((r) => r.fov).length;
    const noDataCount = CATALOG_ROWS.length - totalWithFov;
    const angleStr = angle.toFixed(1);
    const csNote = csOnly ? t("summaryCsOnlyNote", " CamStreamer-only filter is on.") : "";
    document.getElementById("resultsSummary").textContent =
      t("summaryRequiredAngle", `Required angle: ${angleStr}°. `, angleStr) +
      t("summaryCoverage", `${matches.length} of ${totalWithFov} models with published FOV data can cover it `, matches.length, totalWithFov) +
      t("summaryExcluded", `(${noDataCount} catalog entries have no FOV data yet and are excluded). `, noDataCount) +
      csNote + " " +
      t("summaryDepth", `Coverage depth needed: ~${manualRange} m (no per-model range data yet, shown for reference only). `, manualRange) +
      (pricesHidden()
        ? t("summaryPricesHidden", "Prices are hidden (change this in the popup's currency toggle).")
        : t("summaryCurrency", `Prices shown in ${currentCurrency} (matches the currency selected in the popup).`, currentCurrency));

    resultsCountEl.textContent = t("resultsCount", String(matches.length), matches.length);

    resultsTrack.innerHTML = "";
    // One card per match, laid out left-to-right in the bottom stripe. The
    // chipset and price badges deliberately reuse the same visual language as
    // the badges this extension injects onto axis.com itself (dark uppercase
    // chipset pill, Axis-yellow price pill - see content.css), so the two
    // surfaces read as one tool.
    for (const r of matches.slice(0, 60)) {
      const card = document.createElement("div");
      card.className = "result-card" + (r.camstreamerSupported ? " cs-supported" : "");
      const price = fmtPrice(r.entry);
      // ARTPEC-6/7/8/9 are merged into one "CamStreamer supported" badge here
      // rather than calling out which specific generation, since for this
      // tool all that matters is the yes/no CamStreamer-support answer - the
      // exact chipset is still shown on its own chipset badge.
      const csBadge = r.camstreamerSupported
        ? `<span class="badge cs">${t("csSupported", "✅ CamStreamer supported")}</span>`
        : "";
      const groupBadge = r.entry.group ? `<span class="badge plain">${r.entry.group}</span>` : "";
      // Camera-class badges. A PTZ that only reaches the required angle by
      // panning says so outright - it can point anywhere in the cone but only
      // watches one slice at a time, which is a materially different answer to
      // "what covers this area" than a lens that takes it all in at once.
      const panOnly = r.cameraClass === "ptz" && r.fov.max < angle;
      const classBadge =
        r.cameraClass === "ptz"
          ? `<span class="badge type ptz" title="${escAttr(
              panOnly
                ? t("ptzPanOnlyTitle", "Reaches this angle by panning - a PTZ watches one direction at a time, not the whole area at once")
                : t("ptzTitle", "Pan/tilt/zoom - the FOV shown is its widest zoom setting; it can also pan a full circle")
            )}">${panOnly ? t("badgePanOnly", "PTZ · by panning") : t("badgePtz", "PTZ")}</span>`
          : r.cameraClass === "panoramic"
          ? `<span class="badge type pano" title="${escAttr(
              t("panoTitle", "Panoramic/fisheye - sees this full width simultaneously")
            )}">${t("badgePanoramic", "Panoramic")}</span>`
          : "";
      const multiBadge = r.multiSensor
        ? `<span class="badge type multi" title="${escAttr(
            t("multiSensorTitle", "Multi-sensor: the FOV shown is the combined figure across several sensors, not what one sensor sees")
          )}">${t("badgeMultiSensor", "Multi-sensor")}</span>`
        : "";
      // The part number is a button rather than a span - clicking it copies
      // the SKU, which is the number you actually paste into a quote.
      const partBadge = r.entry.part_number
        ? `<button type="button" class="badge plain sku-badge" data-sku="${escAttr(r.entry.part_number)}" title="${escAttr(
            t("copySkuTitle", "Click to copy part number")
          )}"><span class="sku-text">${r.entry.part_number}</span></button>`
        : "";
      // Only render a real link once we've confirmed this model's page exists
      // (see applyModelLinks). Unverified/unresolvable names stay plain text.
      const verified = slugOk[r.modelKey] === true;
      const hrefAttr = verified ? ` href="${escAttr(productUrlFor(r.modelKey))}"` : "";
      const titleAttr = verified
        ? ` title="${escAttr(t("openProductPageTitle", "Open this model's page on axis.com"))}"`
        : "";
      card.innerHTML = `
        <div class="card-thumb" data-model="${escAttr(r.modelKey)}"></div>
        <div class="axis-badges">
          ${r.chipset ? `<span class="axis-chipset-pill">${r.chipset}${r.camstreamerSupported ? " ✅" : ""}</span>` : ""}
          ${price ? `<span class="axis-price-pill">${price}</span>` : ""}
        </div>
        <a class="model" data-model="${escAttr(r.modelKey)}"${hrefAttr}${titleAttr}
           target="_blank" rel="noopener noreferrer">${r.modelKey}${
          r.entry.variant ? `<span class="variant">${r.entry.variant}</span>` : ""
        }</a>
        <div class="spec-row">
          <span>${t("specFov", "FOV")}</span>
          <span class="spec-val">${r.fov.min}–${r.fov.max}°</span>
        </div>
        <div class="badges">${classBadge}${multiBadge}${csBadge}${groupBadge}${partBadge}</div>
      `;
      resultsTrack.appendChild(card);
      const thumb = card.querySelector(".card-thumb");
      // Cached URLs render immediately; anything else waits until the card is
      // scrolled near the viewport before triggering a fetch.
      if (imgCache[r.modelKey]) hydrateThumb(thumb);
      else if (thumbObserver) thumbObserver.observe(thumb);
    }
    resultsTrack.scrollLeft = 0; // a new filter/sort should start from the best match
    if (!matches.length) {
      const reasonEn = csOnly ? " with CamStreamer support" : "";
      const reasonJa = csOnly ? t("noResultsReasonCs", "") : "";
      const hint = isJa()
        ? t("noResultsHint", "", angleStr, reasonJa)
        : `No models with curated FOV data${reasonEn} cover a ${angleStr}° requirement. Try a narrower angle, turn off the CamStreamer filter, or check fov-data.js/chipset-data.js coverage.`;
      resultsTrack.innerHTML = `<p class="empty-hint">${hint}</p>`;
    }
  }

  // Apply Japanese (or English) everywhere on this page, now and whenever
  // isJapanese changes later (e.g. currency switched to/from JPY in the
  // popup while this tab stays open).
  applyStaticI18nLabels();
  if (typeof AxisI18N !== "undefined") {
    AxisI18N.onLanguageChange(applyStaticI18nLabels);
  }
})();
