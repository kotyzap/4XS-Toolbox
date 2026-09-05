// Full-page host for the shared Find Cams module (see find-cams.js).
(function () {
  "use strict";
  const versionEl = document.getElementById("versionLabel");
  if (versionEl && chrome.runtime?.getManifest) versionEl.textContent = "v" + chrome.runtime.getManifest().version;

  const THEME_KEY = "axisFindCamsTheme";
  const applyTheme = (th) => document.documentElement.setAttribute("data-theme", th === "dark" ? "dark" : "light");
  chrome.storage?.local.get([THEME_KEY], (r) => applyTheme(r[THEME_KEY] || "light"));
  document.getElementById("themeToggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next); chrome.storage?.local.set({ [THEME_KEY]: next });
  });

  // Heading text now shares find-cams.js's own multi-language STRINGS table
  // (via the exported AxisFindCams.t()) instead of a second, separately
  // maintained Japanese-only string here.
  const heading = () => AxisFindCams.t("pageHeading", "Find Axis cameras on this network");
  document.getElementById("pageHeadingText").textContent = heading();
  if (typeof AxisI18N !== "undefined") AxisI18N.onLanguageChange(() => { document.getElementById("pageHeadingText").textContent = heading(); });

  AxisFindCams.mount(document.getElementById("findCams"));
})();
