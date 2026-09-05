// Model -> horizontal field-of-view range in degrees: { min, max }.
// For a fixed lens, min === max. For a varifocal lens, min is the FOV at full
// zoom-in (telephoto/narrowest) and max is the FOV at full zoom-out (wide end).
//
// Unlike chipset-data.js, there is no page we can scrape/auto-refresh this
// from (Axis's own Product Selector loads FOV from an internal, authenticated
// API - see project notes). Rather than shipping guessed numbers into a tool
// used for real purchasing decisions, every entry below was pulled by hand
// from that model's own axis.com/products/<slug> "Technical specifications"
// table (Lens > Horizontal field of view). Coverage is intentionally partial
// and grows series by series, same incremental approach used to build out
// chipset-data.js - models with no entry yet simply pass the FOV filter
// unconditionally (see fovFilterOk() in content.js), they don't get hidden.
//
// Coverage so far: one pass through every P/Q sub-series (P12-P91, Q16-Q93)
// and the M series done in the previous pass (M11, M20, M30, M31, M32, M42,
// M43, M50, M55). Still to do: M10/M39 and the remaining variants within
// series already started - this is one representative model per sub-series,
// not the full model list.
//
// Skipped: AXIS Q2802-E - its per-variant lens table only resolved to 2
// distinct values across 8 listed variants (looks like a scrape/rendering
// glitch on the product page), so no reliable min/max could be pulled without
// guessing which variant got which figure.
//
// Note on P3747-PLVE / M4327-P / P3818-PVE / P4708-PLVE: multi-sensor
// panoramic models publish a single combined "Horizontal field of view"
// (360 / 182 / 180 / 180) rather than a per-channel figure - stored as-is, so
// the slider treats their nominal coverage as one number rather than what any
// individual sensor sees.
//
// Note on thermal lens-option models (Q1961-TE, Q2112-E): each fixed lens
// option is its own catalog entry (e.g. "Q1961-TE 7 MM"), matched via the
// same prefix logic as chipsetFor - the base model name alone has no entry.
//
// F/FA modular series (F2105-RE, F4105-LRE, etc.): Product Selector lists
// these as combos, e.g. "AXIS F2105-RE Standard Sensor with AXIS F9104-B Mk
// II Main Unit" - the sensor's own FOV is unaffected by which main unit it's
// paired with, so one entry keyed on just the sensor model (e.g. "F2105-RE")
// matches every main-unit combo via the same prefix logic. Main units
// themselves (F9104-B, F9111-R, F9114-B/R, FA51, FA54) have no lens and thus
// no FOV entry - only the sensor half does. One representative sensor per
// form factor, plus F2107-RE/F2108/F4108 (same form factors, higher-res
// sensor variants).
//
// M10/M39 series now covered (M1055-L, M1075-L Mk II, M3905-R - the only
// models the bundled catalog actually carries in those ranges). Also closed
// out the specific catalog gaps flagged in P32xx/Q35xx/Q19xx/Q21xx/Q36xx/
// Q60xx (P3275-LV, Q3628-VE, Q1971-E x5 lens options, Q2111-E, Q6074-E,
// Q6088-E) - Q28xx/Q48xx/Q64xx/Q87xx/Q92xx had no further uncovered models
// in the bundled catalog as of this pass. Remaining gaps are scattered
// individual SKUs rather than whole untouched sub-series at this point -
// this file keeps growing incrementally as they're found.
const FOV_DATA = {
  "source": "manually curated from individual axis.com/products/<model> technical specification tables",
  "updatedAt": "2026-08-09",
  "fov": {
    "M1135 MK II": { "min": 33, "max": 90 },
    "M1135 MK II I-CS": { "min": 33, "max": 101 },
    "M1137 MK II": { "min": 24, "max": 112 },
    "M1137 MK II I-CS": { "min": 31, "max": 99 },
    "M2036-LE": { "min": 130, "max": 130 },
    "M2048-LE": { "min": 126, "max": 126 },
    "M3085-V": { "min": 102, "max": 102 },
    "M3126-LVE": { "min": 130, "max": 130 },
    "M3216-LVE": { "min": 102, "max": 102 },
    "M4216-V": { "min": 45, "max": 100 },
    "M4327-P": { "min": 182, "max": 182 },
    "M5075": { "min": 14, "max": 71 },
    "M5526-E": { "min": 6.5, "max": 59.1 },

    "P1387": { "min": 24, "max": 112 },
    "P1518-LE": { "min": 45.5, "max": 113.8 },
    "P3268-SLVE": { "min": 53, "max": 100 },
    "P3747-PLVE": { "min": 360, "max": 360 },

    "Q1656": { "min": 47, "max": 120 },
    "Q1656-LE": { "min": 47, "max": 113 },
    "Q1728": { "min": 49, "max": 108 },
    "Q1728 48 MM": { "min": 13, "max": 42 },
    "Q1805-LE": { "min": 2.3, "max": 60 },
    "Q3548-LVE": { "min": 48.9, "max": 104.0 },
    "Q6225-LE": { "min": 2.2, "max": 63.8 },
    "Q6355-LE": { "min": 2.0, "max": 60.6 },
    "Q9307-LV": { "min": 40, "max": 104 },

    "P1245 MK II": { "min": 111, "max": 111 },
    "P1475-LE": { "min": 36, "max": 117 },
    "P3818-PVE": { "min": 180, "max": 180 },
    "P3925-LRE": { "min": 56, "max": 56 },
    "P4708-PLVE": { "min": 180, "max": 180 },
    "P5654-E MK II": { "min": 3.6, "max": 77.0 },
    "P9117-PV": { "min": 176, "max": 176 },

    "Q1961-TE 7 MM": { "min": 55, "max": 55 },
    "Q1961-TE 13 MM": { "min": 28, "max": 28 },
    "Q2112-E 10 MM": { "min": 63, "max": 63 },
    "Q2112-E 19 MM": { "min": 31, "max": 31 },
    "Q2112-E 25 MM": { "min": 24.1, "max": 24.1 },
    "Q2112-E 35 MM": { "min": 17, "max": 17 },
    "Q2112-E 60 MM": { "min": 10, "max": 10 },
    "Q2112-E 100 MM": { "min": 6.2, "max": 6.2 },
    "Q3626-VE": { "min": 52, "max": 103 },
    "Q6086-E": { "min": 2.0, "max": 61.5 },
    "Q8752-E MK II": { "min": 2.4, "max": 58.5 },
    "Q9227-SLV": { "min": 115, "max": 115 },

    "F2105-RE": { "min": 108, "max": 108 },
    "F2135-RE": { "min": 185, "max": 185 },
    "F2115-R": { "min": 56.3, "max": 107.4 },
    "F4105-LRE": { "min": 110, "max": 110 },
    "F7225-RE": { "min": 92, "max": 92 },
    "FA1105": { "min": 111, "max": 111 },
    "FA3105-L": { "min": 103, "max": 103 },
    "FA4115": { "min": 53, "max": 99 },
    "F2107-RE": { "min": 110, "max": 110 },
    "F2108": { "min": 110, "max": 110 },
    "F4108": { "min": 107, "max": 107 },

    "M1055-L": { "min": 103, "max": 103 },
    "M3057-PLR MK II": { "min": 183, "max": 183 },
    "M3086-V": { "min": 130, "max": 130 },
    "M3098-H": { "min": 124, "max": 124 },
    "M4218-V": { "min": 47, "max": 93 },
    "M4225-LVE": { "min": 38, "max": 100 },
    "M4317-PLVE": { "min": 182, "max": 182 },
    "M4337-PLVE": { "min": 185, "max": 185 },
    "M5000": { "min": 6.7, "max": 61.8 },
    "M1075-L MK II": { "min": 103, "max": 103 },

    "P3275-LVE 10 MM": { "min": 32, "max": 100 },
    "P3275-LVE 29 MM": { "min": 11.0, "max": 29.1 },
    "Q3538-SLVE": { "min": 48.6, "max": 103.4 },

    "M3905-R 3.6 MM": { "min": 87.6, "max": 87.6 },
    "M3905-R 2.8 MM": { "min": 106.6, "max": 106.6 },
    "P3275-LV": { "min": 32, "max": 100 },
    "Q3628-VE": { "min": 48, "max": 103 },
    "Q1971-E 7 MM": { "min": 55, "max": 55 },
    "Q1971-E 13 MM": { "min": 29, "max": 29 },
    "Q1971-E 19 MM": { "min": 19, "max": 19 },
    "Q1971-E 25 MM": { "min": 15, "max": 15 },
    "Q1971-E 35 MM": { "min": 10.5, "max": 10.5 },
    "Q2111-E": { "min": 6.2, "max": 6.2 },
    "Q6074-E": { "min": 2.6, "max": 63.8 },
    "Q6088-E": { "min": 2.0, "max": 60.8 },

    // PTZ / positioning models - previously the whole pan/tilt/zoom section
    // had only partial coverage, so 13 of its 23 catalog entries had no entry
    // here and silently passed the FOV filter unconditionally (it fails open).
    // All of the below were read from each model's own axis.com
    // "Technical specifications" > Lens > "Horizontal field of view" line,
    // same hand-curated method as the rest of this file. min = narrowest
    // (fully zoomed in), max = widest.
    //
    // Discontinued models (Q6135-LE, Q6075, Q6074) redirect to their /support
    // page, but that page still carries the full Lens spec block, so these are
    // still first-party published figures rather than estimates.
    //
    // Note M5074's figures are published without decimals ("71 - 14 °") and
    // are transcribed verbatim rather than padded.
    "Q6358-LE": { "min": 2.3, "max": 58.5 },
    "Q6325-LE": { "min": 2.0, "max": 60.6 },
    "Q6135-LE": { "min": 2.4, "max": 58.3 },
    "Q6075": { "min": 2.0, "max": 65.1 },
    "Q6075-E": { "min": 2.0, "max": 65.1 },
    "Q6074": { "min": 2.6, "max": 63.8 },
    "V5938": { "min": 4.1, "max": 70.2 },
    "V5925": { "min": 2.3, "max": 62.8 },
    "P5676-LE": { "min": 2.1, "max": 57.1 },
    "P5655-E": { "min": 2.4, "max": 58.3 },
    "M5074": { "min": 14, "max": 71 },

    // These two sit in the pan/tilt/zoom section of the price list but are NOT
    // optical-zoom PTZs - they're fixed 3.7 mm 360-degree panoramic cameras
    // (their spec tables have no "Optical zoom" row at all). So min === max
    // === 360 by definition, not as a placeholder, and cameraClassOf() in
    // fov-map.js deliberately classes any 360/360 entry as panoramic rather
    // than trusting the section label.
    "Q6300-E": { "min": 360, "max": 360 },
    "Q6020-E": { "min": 360, "max": 360 },

    // ---------------------------------------------------------------------
    // Added 2026-08-09, sourced from the Q3 2026 "Comparison tables" PDF
    // (per-model Sensor size/Lens/Horizontal field of view rows), same
    // hand-curated method as the rest of this file. Fills most of the
    // camera-with-lens gaps flagged in the coverage audit - see
    // fov-data-audit.md. Barebone/no-lens variants (-B, -BE, main units,
    // etc.) still intentionally have no entry.
    //
    // Note: three values here disagree with pre-existing entries above and
    // were left as-is rather than overwritten - flagged for a human to
    // reconcile: P9117-PV (existing 176°, this pass's table says 182°),
    // M3126-LVE (existing 130°, this pass's table says 110°), and
    // P3747-PLVE (existing 360°/360° combined-panoramic figure, this pass's
    // table shows a per-channel varifocal 40°-98° instead).
    // ---------------------------------------------------------------------

    // Box cameras
    "Q1728-LE": { "min": 49, "max": 108 },
    "Q1728-LE 48 MM": { "min": 13, "max": 42 },
    "Q1726-LE": { "min": 44, "max": 101.8 },
    "Q1726": { "min": 44, "max": 101.8 },
    "Q1715": { "min": 3.6, "max": 76 },
    "Q1656-DLE": { "min": 44, "max": 96 },
    "Q1686-DLE": { "min": 9, "max": 46 },
    "P1518-E": { "min": 11, "max": 113.8 },
    "P1388": { "min": 46, "max": 122 },
    "P1388-LE": { "min": 46, "max": 122 },
    "P1385": { "min": 26, "max": 121 },
    "P1385-E": { "min": 26, "max": 121 },
    "M1137-E MK II": { "min": 24, "max": 112 },
    "M1137-E MK II I-CS": { "min": 31, "max": 99 },
    "M1135-E MK II": { "min": 33, "max": 90 },
    "M1135-E MK II I-CS": { "min": 31, "max": 101 },

    // Bullet cameras
    "Q1809-LE": { "min": 44, "max": 90 },
    "Q1809-LE 150 MM": { "min": 7, "max": 21 },
    "Q1808-LE": { "min": 21, "max": 90 },
    "Q1808-LE 150 MM": { "min": 7, "max": 21 },
    "Q1806-LE": { "min": 2.3, "max": 60 },
    "Q1800-LE": { "min": 2.3, "max": 38 },
    "Q1800-LE-3": { "min": 2.3, "max": 38 },
    "P1488-LE": { "min": 46, "max": 114 },
    "P1487-LE": { "min": 35, "max": 106 },
    "P1486-LE": { "min": 11, "max": 42 },
    "P1485-LE": { "min": 11, "max": 29.4 },
    "P1475-LE": { "min": 36, "max": 117 },
    "M2048-LE": { "min": 126, "max": 126 },
    "M2035-LE": { "min": 39, "max": 101 },

    // Modular cameras
    "P1275 MK II": { "min": 35, "max": 99 },
    "P1265 MK II": { "min": 91, "max": 91 },
    "F2107-RE": { "min": 110, "max": 110 },
    "F2108": { "min": 110, "max": 110 },
    "F2115-R": { "min": 56, "max": 107 },
    "F2135-RE": { "min": 185, "max": 185 },
    "F2137-RE": { "min": 185, "max": 185 },
    "F2180-TE": { "min": 57, "max": 95 },
    "F4108": { "min": 107, "max": 107 },
    "F4105-SLRE": { "min": 110, "max": 110 },
    // FA-series sensor units below: catalog-data.js currently carries these
    // model keys malformed (a footnote "1" fused onto the SKU with no
    // separator - "FA41151", "FA3105-L1", "FA11251", "FA11051" - see
    // fov-data-audit.md). These clean entries won't prefix-match until that
    // catalog key is fixed at the source.
    "FA4115": { "min": 53, "max": 99 },
    "FA3105-L": { "min": 103, "max": 103 },
    "FA1125": { "min": 91, "max": 91 },
    "FA1105": { "min": 111, "max": 111 },

    // Explosion-protected devices
    "XFQ1656": { "min": 47, "max": 120 },
    "P1468-XLE": { "min": 49, "max": 108 },
    "Q1961-XTE": { "min": 55, "max": 55 },

    // Thermal cameras (lens-option models, same prefix-matched pattern as
    // Q1961-TE/Q2112-E above)
    "Q1972-E 10 MM": { "min": 63, "max": 63 },
    "Q1972-E 19 MM": { "min": 31, "max": 31 },
    "Q1972-E 25 MM": { "min": 24.1, "max": 24.1 },
    "Q1972-E 35 MM": { "min": 17, "max": 17 },
    "Q2101-TE 7 MM": { "min": 55, "max": 55 },
    "Q2101-TE 13 MM": { "min": 28, "max": 28 },
    "Q2101-TE 19 MM": { "min": 19.4, "max": 19.4 },

    // Dome cameras
    "Q3626-VE": { "min": 52, "max": 103 },
    "Q3558-LVE": { "min": 48, "max": 104 },
    "Q3556-LVE": { "min": 44, "max": 101 },
    "Q3546-LVE": { "min": 48, "max": 103 },
    "P3935-LR": { "min": 110, "max": 110 },
    "P3925-R": { "min": 110, "max": 110 },
    "P3925-LRE": { "min": 56, "max": 56 },
    "P3905-R MK III": { "min": 88, "max": 107 },
    "P3288-LVE": { "min": 29, "max": 103 },
    "P3288-LV": { "min": 29, "max": 103 },
    "P3287-LVE": { "min": 34, "max": 104 },
    "P3287-LV": { "min": 34, "max": 104 },
    "P3285-LVE": { "min": 32, "max": 100 },
    "P3285-LVE 29 MM": { "min": 11, "max": 29.1 },
    "P3285-LV": { "min": 32, "max": 100 },
    "P3278-LVE": { "min": 29, "max": 103 },
    "P3278-LV": { "min": 29, "max": 103 },
    "P3277-LVE": { "min": 34, "max": 104 },
    "P3277-LV": { "min": 34, "max": 104 },
    "P3275-LV": { "min": 32, "max": 100 },
    "P3275-V": { "min": 32, "max": 100 },
    "P3268-SLVE": { "min": 53, "max": 109 },
    "M3215-LVE": { "min": 101, "max": 101 },
    "M3138-LVE": { "min": 126, "max": 126 },
    "M3128-LVE": { "min": 110, "max": 110 },
    "M3125-LVE": { "min": 130, "max": 130 },
    "M3098-V": { "min": 124, "max": 124 },
    "M3098-LV": { "min": 124, "max": 124 },
    "M3098-H": { "min": 124, "max": 124 },
    "M3088-V": { "min": 109, "max": 109 },
    "M4228-LVE": { "min": 38, "max": 100 },
    "M4227-LVE": { "min": 38, "max": 98 },
    "M4218-LV": { "min": 47, "max": 93 },
    "M4218-V": { "min": 47, "max": 93 },
    "M4216-LV": { "min": 45, "max": 100 },
    "M4216-V": { "min": 45, "max": 100 },
    "M4215-LV": { "min": 47, "max": 93 },
    "M4215-V": { "min": 47, "max": 93 },

    // Panoramic cameras (combined multi-sensor HFoV or, for the P47 twin-
    // sensor bullets, the per-channel varifocal range - same convention as
    // the existing P3747-PLVE-style entries above)
    "Q4809-PVE": { "min": 180, "max": 180 },
    "Q3839-SPVE": { "min": 180, "max": 180 },
    "Q3839-PVE": { "min": 180, "max": 180 },
    "P4707-PLVE": { "min": 36, "max": 98 },
    "P3827-PVE": { "min": 180, "max": 180 },
    "P3748-PLVE": { "min": 41, "max": 103 },
    "P3738-PLE": { "min": 37, "max": 108 },
    "P3737-PLE": { "min": 37, "max": 108 },
    "P3735-PLE": { "min": 37, "max": 108 },
    "M4328-P": { "min": 182, "max": 182 },
    "M4308-PLE": { "min": 183, "max": 183 },
    "M4348-PLVE": { "min": 185, "max": 185 },
    "M4347-PLVE": { "min": 185, "max": 185 },
    "M4338-PLVE": { "min": 185, "max": 185 },
    "M4337-SPLVE": { "min": 185, "max": 185 },
    "M4318-PLVE": { "min": 182, "max": 182 },
    "M4317-PLVE": { "min": 182, "max": 182 },
    "M4318-PLR": { "min": 182, "max": 182 },
    "M4317-PLR": { "min": 182, "max": 182 },
    "M3077-PLVE": { "min": 183, "max": 183 },

    // Body worn cameras (fixed lens - catalog keys include the full
    // "<model> Body Worn Camera" product name)
    "W120 Body Worn Camera": { "min": 137, "max": 137 },
    "W110 Body Worn Camera": { "min": 140, "max": 140 },
    "W102 Body Worn Camera": { "min": 137, "max": 137 },

    // Canon network cameras (bundled in the same catalog/price list section)
    "VB-M46": { "min": 3.2, "max": 62.4 },
    "VB-H47": { "min": 3.2, "max": 62.4 }
  }
};
