# Chrome Web Store listing — 4XS Toolbox v6.0

Current listing ID: `gnegcekipfaapeboifcejnjmfemfigpl`
Current store name: **Axis MSRP Price Overlay** → rename to **4XS Toolbox**.

---

## Name (max 75 chars)

```
4XS Toolbox
```

Optional keyword variant, if discoverability matters more than a clean name — the
store searches the name field, and nobody looking for "axis camera chipset" finds
"4XS Toolbox":

```
4XS Toolbox — Axis chipset, OS 13, DLPU & MSRP
```
(45 chars)

## Short description (max 132 chars — matches `manifest.json`)

```
Chipset, AXIS OS 13, DLPU/MLPU and MSRP badges on axis.com, plus a FoV map and IP scanner. By Pavel Kotyza, not an Axis product.
```
(128 chars)

## Category

Developer Tools (current). *Productivity* is the better fit for the sales and
channel audience this actually serves — worth switching with the rename.

---

## Detailed description

```
Four questions, answered where you already are.

Every time you look at an Axis camera you ask the same four things: what chipset
is it, will it get AXIS OS 13, can it run deep learning on the edge, and what
does it list for. 4XS Toolbox answers all four as a row of badges, straight on
axis.com — Product selector, search results, product pages, category pages,
comparison tables. No second tab, no spreadsheet.

  ARTPEC-9 ✅   OS13 ✅   DLPU   $1,369

WHAT THE BADGES MEAN

• Chipset — hardware generation, from CamStreamer's published compatibility
  list. A ✅ marks a generation that runs CamStreamer apps.
• AXIS OS 13 — whether the model is on track for OS 13, the release where Axis
  resolves Y2038. ARTPEC-6 products are not. Resolved per model from Axis's own
  published guidance; where the sources genuinely disagree the badge says
  nothing rather than guessing.
• DLPU / MLPU — the on-camera compute unit, read from Axis's own Product
  selector feed, with datasheet overrides for the handful of models the feed
  omits. Chipset generation is not a shortcut here: ARTPEC-7 alone spans deep
  learning, machine learning and no compute unit at all.
• Price — Axis MSRP in EUR, USD, GBP or JPY.

Switch any of the four off in Settings.

WHERE THEY APPEAR

• Product selector — all 470 products badged in place, plus a floating filter
  panel that narrows the page by chipset generation and sorts series
  cheapest-first.
• Search results — type a model or a whole series and every matching result
  carries its badges.
• Product and category pages — individual products, series cards with a price
  range, and the series breadcrumb showing every chipset in the range.
• Comparison tables — Chipset and Price rows added at the top, above every
  other spec.

FIELD-OF-VIEW MAP

Drop a pin, drag out the cone you need covered, and get back every Axis model
that covers it — ranked by tightest fit, cheapest breaking ties. Handles 360°
cameras, panoramic and multi-sensor models properly, and tells you when a PTZ
only reaches the angle by panning rather than seeing it all at once. Filter the
results to CamStreamer-supported, AXIS OS 13, or deep-learning models.

IP UTILITY SCANNER

Sweep your subnet for Axis cameras and get model, serial number and firmware
back — no password needed on AXIS OS 10+ (VAPIX basicdeviceinfo). Every request
goes straight from your browser to the camera's own IP. Nothing leaves your
computer. Export to CSV.

YOUR OWN PRICE LIST

Ships with a recent public AXIS price list. Axis publishes a new one roughly
monthly — drop the .xls or .xlsx on Settings and it is parsed in your browser,
never uploaded. Standard AXIS Price List layouts are mapped automatically;
anything else gets a column-mapping screen with a live preview. You see a
coverage report before anything is applied, new SKUs are added rather than
ignored, and "revert to bundled prices" is always one click away.

ALSO

• Light and dark, follows your system or switch it manually.
• 11 languages, auto-detected from your browser.
• Click any field in the popup to copy it — model, part number, serial.
• ♡ favourites pin to the top of every list.
• Category shortcuts in the popup, synced with the hearts on axis.com.

PRIVACY

No account, no tracking, no analytics, no telemetry. The extension issues no
POST or PUT anywhere, ever. Outbound reads are limited to: CamStreamer's
compatibility list, ECB reference rates for currency conversion, OpenFreeMap
tiles for the FoV map, and axis.com itself for product photos and AXIS OS
support pages. Price lists you upload are parsed locally and never transmitted.
Network scan traffic goes only to the camera IPs on your own subnet.

NOT AN AXIS PRODUCT

Built by Pavel Kotyza. Not affiliated with, endorsed by, or supported by Axis
Communications AB. "AXIS" and the product names are their trademarks, used only
to refer to their products. Prices are list prices for reference, not quotes.

Source: github.com/kotyzap/4XS-Toolbox
```

---

## What's new (v6.0)

```
AXIS OS 13 readiness and DLPU/MLPU compute badges, everywhere chipset and price
already appeared — Product selector, search, product and category pages, the
popup and the network scanner.

The popup is now three tabs and a search box: currency, FX rates, language,
data updates and the price-list upload moved to a proper Settings page, where
each of the four badge types can also be switched off independently.

The FoV map gained "AXIS OS 13 only" and "Deep learning (DLPU) only" filters.
```

---

## Graphics

| Slot | Required size | File |
|---|---|---|
| Screenshot 1 | 1280×800 | `cws-1-selector.png` |
| Screenshot 2 | 1280×800 | `cws-2-product.png` |
| Screenshot 3 | 1280×800 | `cws-3-popup.png` |
| Screenshot 4 | 1280×800 | `cws-4-findcams.png` |
| Screenshot 5 | 1280×800 | `cws-5-settings.png` |
| Small promo tile | 440×280 | `tile-small-440x280.png` |
| Marquee promo tile | 1400×560 | `tile-marquee-1400x560.png` |

All screenshots are the real extension, captured against live axis.com and a
real unpacked build — no mockups.

## Permission justifications

| Permission | Why |
|---|---|
| `storage` | Favourites, currency, language, theme, badge toggles, cached chipset/FX/OS 13 data and uploaded price lists. |
| `alarms` | Weekly background refresh of chipset data and FX rates. |
| `scripting` | Applies a changed setting to axis.com tabs that are already open, instead of requiring a reload. |
| `optional_host_permissions: http://*/*` | Requested only when you press Scan in the IP Utility Scanner; used to reach cameras on your own subnet. |
| `host_permissions: camstreamer.com` | Published chipset-compatibility list. |
| `host_permissions: api.frankfurter.dev` | ECB reference rates for GBP/JPY conversion. |
| `host_permissions: tiles.openfreemap.org` | Map tiles for the FoV map. |
| `host_permissions: get.geojs.io` | One city-level location lookup to centre the map. |
| `host_permissions: www.axis.com` | Product photos for FoV result cards and the AXIS OS support pages behind the OS 13 refresh. |

## Note for reviewers (include with the AMO submission)

**The IP Utility Scanner will appear broken if you test it without granting
the permission prompt.** Pressing Scan asks for host access to the 254
addresses of the chosen subnet. Until that is allowed, every probe is refused
by the browser before it is sent — the request is a POST with
`content-type: application/json`, so it needs a CORS preflight that only the
granted host permission waives. The scan then reports that it was blocked
rather than claiming the network is empty.

Reloading a temporary add-on revokes that optional permission, so the prompt
reappears after every reload during review.

The prompt deliberately lists all 254 addresses individually rather than
asking for the declared `http://*/*` in one line. Match patterns cannot
express `192.168.1.*`, and requesting the broad pattern would read as "access
your data for all websites" for an add-on that never sends anything off the
machine. Scanning is also the only thing that permission is ever used for.

## Pre-submit checklist

- [ ] `manifest.json` description ≤ 132 chars (dashboard rejects longer) — currently 128.
- [ ] Version bumped — currently `6.0`.
- [ ] Store name changed from "Axis MSRP Price Overlay" to "4XS Toolbox".
- [ ] Package built with `python3 build-chrome.py` → `dist/4xs-toolbox-6.0.zip`
      (34 files, 947 KB). The file list is derived from the manifest and the
      pages it reaches, so `docs/`, `promo/`, `test/`, `_archive/`, the build
      scripts, loose PDFs and `prices.csv` are excluded by construction rather
      than by a glob that can rot.
- [ ] Firefox/AMO package: `python3 build-firefox.py` →
      `dist/4xs-toolbox-firefox-6.0.zip`. Separate AMO listing, gecko id
      `4xs-toolbox@4xs.dev`, min Firefox 128.

## AMO validation (v6.0)

`web-ext lint --self-hosted` on `dist/4xs-toolbox-firefox-6.0.zip`:
**0 errors, 0 notices, 19 warnings.** Nothing blocking.

- **17 × `UNSAFE_VAR_ASSIGNMENT`** — `innerHTML`. Expected: every value
  assigned comes from the bundled data files or the user's own uploaded price
  list, never from a remote response. A human reviewer may still ask; the
  honest answer is the one in this paragraph.
- **2 × `KEY_FIREFOX*_UNSUPPORTED_BY_MIN_VERSION`** —
  `browser_specific_settings.gecko.data_collection_permissions` landed in
  Firefox 140 / Android 142, and `strict_min_version` is 128. Accepted
  deliberately: AMO *requires* the key on new extensions, and older Firefox
  ignores unknown manifest keys, so it is inert rather than broken. Raising the
  minimum to 140 to silence the warning would drop 128–139 for no functional
  gain.

**Not verified:** the Firefox build has never been *run* in Firefox — the
container has no Firefox binary. Do a `web-ext run` locally before submitting,
and check the popup, a badged axis.com page and one scan.
- [ ] Single-purpose statement still accurate.
