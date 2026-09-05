// Background service worker: fetches CamStreamer's "all supported cameras" page,
// parses it into a { MODEL: "canonical chipset" } map, and stores it in
// chrome.storage.local for content.js / popup.js to read.

const CAMSTREAMER_URL = "https://camstreamer.com/download-app-all-supported-cameras";
const REFRESH_ALARM = "refreshChipsets";
const MIN_EXPECTED_MODELS = 200; // sanity floor - if CamStreamer changes markup, don't overwrite good data with garbage

// EUR-based reference rates (USD-per-EUR, JPY-per-EUR, GBP-per-EUR) for the
// live currency toggle (EUR/USD/GBP/JPY). USD figures baked into
// catalog-data.js at build time stay as-is (see content.js priceField()
// comments); JPY and GBP have no baked field at all, so
// content.js/products-content.js/search-content.js/popup.js convert the USD
// figure (msrp) on the fly using a derived USD/JPY or USD/GBP rate (jpy /
// usd, gbp / usd) computed from the three EUR-based rates cached here.
const FX_ENDPOINT = "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,JPY,GBP";

async function refreshFxRates() {
  const resp = await fetch(FX_ENDPOINT, { cache: "no-store" });
  if (!resp.ok) throw new Error("HTTP " + resp.status + " fetching FX rates");
  const data = await resp.json();
  if (
    !data ||
    !data.rates ||
    typeof data.rates.USD !== "number" ||
    typeof data.rates.JPY !== "number" ||
    typeof data.rates.GBP !== "number"
  ) {
    throw new Error("Unexpected response shape from " + FX_ENDPOINT);
  }
  await chrome.storage.local.set({
    fxRates: { usd: data.rates.USD, jpy: data.rates.JPY, gbp: data.rates.GBP, date: data.date },
    fxUpdatedAt: Date.now(),
    fxLastError: null,
  });
  return { usd: data.rates.USD, jpy: data.rates.JPY, gbp: data.rates.GBP, date: data.date };
}

async function refreshFxAndRecordError() {
  try {
    return await refreshFxRates();
  } catch (e) {
    await chrome.storage.local.set({ fxLastError: String((e && e.message) || e) });
    throw e;
  }
}

function canonicalize(label) {
  const l = label.toUpperCase();
  if (l.includes("ARTPEC-9")) return "ARTPEC-9";
  if (l.includes("ARTPEC-8")) return "ARTPEC-8";
  if (l.includes("ARTPEC-7") || l.includes("ARTPEC-6")) return "ARTPEC-6/7";
  if (l.includes("ARTPEC-5")) return "ARTPEC-5";
  if (l.includes("ARTPEC-4")) return "ARTPEC-4";
  if (l.includes("ARTPEC-3")) return "ARTPEC-3";
  if (l.includes("CV75")) return "Ambarella CV75";
  if (l.includes("CV25") || l.includes("S5")) return "Ambarella CV25";
  if (l.includes("S3L")) return "Ambarella S3L";
  if (l.includes("S2L")) return "Ambarella S2L";
  if (l.includes("S2E")) return "Ambarella S2E";
  if (l.includes("A5S")) return "Ambarella A5S";
  return label.trim();
}

function parseChipsets(html) {
  const smallRe = /<small class="text--medium">([\s\S]*?)<\/small>/g;
  const chipRe = /<div class="text--medium text--heavy">([\s\S]*?)<\/div>/g;
  const smalls = [...html.matchAll(smallRe)].map((m) => m[1]);
  const chips = [...html.matchAll(chipRe)].map((m) =>
    m[1].replace(/<br\s*\/?>/gi, "\n").replace(/&nbsp;/g, " ").trim()
  );

  const buckets = {}; // MODEL -> Set of canonical labels seen
  const n = Math.min(smalls.length, chips.length);
  for (let i = 0; i < n; i++) {
    const lines = chips[i].split("\n").map((s) => s.trim()).filter(Boolean);
    const rawLabel = lines[0] || "";
    if (!rawLabel) continue;
    const canon = canonicalize(rawLabel);
    const models = smalls[i].split(",").map((s) => s.trim()).filter(Boolean);
    for (const m of models) {
      const key = m.toUpperCase().replace(/^AXIS\s+/, "").trim();
      if (!key) continue;
      if (!buckets[key]) buckets[key] = new Set();
      buckets[key].add(canon);
    }
  }

  const result = {};
  const conflicts = [];
  for (const [key, set] of Object.entries(buckets)) {
    const labels = [...set];
    if (labels.length > 1) conflicts.push({ key, labels });
    result[key] = labels[0];
  }
  return { chipsets: result, conflicts, blockCount: n };
}

async function refreshChipsetData() {
  const res = await fetch(CAMSTREAMER_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status + " fetching CamStreamer page");
  const html = await res.text();
  const { chipsets, conflicts, blockCount } = parseChipsets(html);
  const count = Object.keys(chipsets).length;
  if (count < MIN_EXPECTED_MODELS) {
    throw new Error(
      "Only parsed " + count + " models (expected 200+) - CamStreamer page structure may have changed"
    );
  }
  await chrome.storage.local.set({
    chipsetData: chipsets,
    chipsetUpdatedAt: Date.now(),
    chipsetModelCount: count,
    chipsetLastError: null,
  });
  return { count, blockCount, conflictCount: conflicts.length };
}

async function refreshAndRecordError() {
  try {
    return await refreshChipsetData();
  } catch (e) {
    await chrome.storage.local.set({ chipsetLastError: String((e && e.message) || e) });
    throw e;
  }
}

// Mirrors manifest.json's content_scripts array. Chrome only auto-injects
// declarative content scripts into page loads that happen AFTER a new/updated
// version becomes active - a tab that was already open on axis.com at install
// or update time never gets the script until it's reloaded or navigated. In
// practice that meant badges only showed up on whichever axis.com tab you
// happened to load/reload next (often the Product Selector, since that's the
// page in the README's install instructions), leaving already-open search/
// product tabs looking broken until manually refreshed. Injecting into every
// matching open tab right after install/update fixes that for all three page
// types at once, not just whichever one is opened first.
// Optional locale segment (e.g. "/en-us/") between the host and the path -
// axis.com serves the same Product Selector/search/product pages under both
// the bare path and a locale-prefixed one, and which you land on depends on
// how you navigated there (e.g. using the in-page "Compare" / "Back"
// controls can land you on the locale-prefixed URL even if you started on
// the bare one). Content scripts only auto-inject on a fresh page load, so
// an SPA route change to a URL these patterns don't cover leaves the page
// with no extension running at all - which is what made prices vanish after
// Back was clicked from the comparison table.
// Axis's country/language picker offers many locales (en-us, es-mx, fr-ca,
// en-gb, pt-br, zh-cn, ...) plus presumably some language-only ones - rather
// than enumerate them, accept any 2-letter language optionally followed by a
// "-XX" region, case-insensitively.
const LOCALE_PREFIX = "(?:\\/[a-zA-Z]{2}(?:-[a-zA-Z]{2})?)?";
const CONTENT_SCRIPT_RULES = [
  {
    pattern: new RegExp("^https://www\\.axis\\.com" + LOCALE_PREFIX + "/support/tools/product-selector"),
    js: ["catalog-data.js", "chipset-data.js", "fov-data.js", "content.js"],
    css: ["content.css"],
  },
  {
    pattern: new RegExp("^https://www\\.axis\\.com" + LOCALE_PREFIX + "/search"),
    js: ["catalog-data.js", "chipset-data.js", "search-content.js"],
    css: ["search-content.css"],
  },
  {
    pattern: new RegExp("^https://www\\.axis\\.com" + LOCALE_PREFIX + "/products/"),
    js: ["catalog-data.js", "chipset-data.js", "products-content.js"],
    css: ["products-content.css"],
  },
];

async function injectIntoExistingTabs() {
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: "https://www.axis.com/*" });
  } catch (e) {
    return; // no matching tabs, or host permission somehow unavailable
  }
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    const rule = CONTENT_SCRIPT_RULES.find((r) => r.pattern.test(tab.url));
    if (!rule) continue;
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: rule.css });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: rule.js });
    } catch (e) {
      // Tab may have navigated away, be mid-load, or otherwise be
      // unscriptable - nothing else in this loop depends on it, so skip it.
    }
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 60 * 24 * 7 }); // weekly
  refreshAndRecordError().catch(() => {});
  refreshFxAndRecordError().catch(() => {});
  if (details.reason === "install" || details.reason === "update") {
    injectIntoExistingTabs().catch(() => {});
  }
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    refreshAndRecordError().catch(() => {});
    refreshFxAndRecordError().catch(() => {});
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    refreshAndRecordError().catch(() => {});
    refreshFxAndRecordError().catch(() => {});
  }
});

// Find Cams (find-cams.js) asks for local-network host permission at scan
// time via chrome.permissions.request() from inside the action popup. The
// instant Chrome's own permission prompt steals focus, Chrome closes that
// popup - a long-standing Chrome behavior the extension has no control over
// (https://issues.chromium.org/issues/40721470). The scan itself survives
// fine: results are cached to chrome.storage.local, and find-cams.js's
// trySilentAutoscan() re-runs the sweep on its own once the popup reopens
// and sees the grant. The only real gap was the user being left looking at
// nothing after clicking Allow, wondering whether anything happened.
// chrome.action.openPopup() (Chrome 127+, no manifest permission needed)
// closes that gap by reopening the popup for them. Guarded on both sides:
// only for a grant that looks like Find Cams' own per-IP subnet request
// (never fires for some future unrelated optional permission), and only
// when the API exists - a no-op, not an error, on anything that lacks it.
chrome.permissions.onAdded.addListener((added) => {
  const origins = (added && added.origins) || [];
  if (!origins.some((o) => /^http:\/\/\d{1,3}(\.\d{1,3}){3}\/\*$/.test(o))) return;
  if (!chrome.action || typeof chrome.action.openPopup !== "function") return;
  try {
    chrome.action.openPopup().catch(() => {}); // e.g. no focused window - fail silently, same as not reopening at all
  } catch {
    // API missing/unsupported here (older Chrome, non-Chrome builds) - no-op
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // The Product Selector panel's "MSRP list" button. There is no standalone
  // catalogue page - the catalogue IS the popup - and a content script can't
  // open the action popup itself, so it asks here. openPopup() needs Chrome
  // 127+ and a focused window; when it isn't there, fall back to popup.html
  // in a tab (it renders at its fixed 420px, which is odd but usable, and
  // beats the button doing nothing).
  if (msg && msg.type === "OPEN_POPUP") {
    const openInTab = () => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    try {
      if (chrome.action && typeof chrome.action.openPopup === "function") {
        chrome.action.openPopup().catch(openInTab);
      } else {
        openInTab();
      }
    } catch (e) {
      openInTab();
    }
    return; // nothing to send back
  }
  if (msg && msg.type === "REFRESH_CHIPSETS") {
    refreshAndRecordError()
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true; // keep the message channel open for the async response
  }
  if (msg && msg.type === "REFRESH_FX") {
    refreshFxAndRecordError()
      .then((r) => sendResponse({ ok: true, ...r }))
      .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
    return true;
  }
});
