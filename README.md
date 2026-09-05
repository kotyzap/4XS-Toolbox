# 4XS Toolbox

A browser toolbox for anyone who works with Axis cameras day to day: MSRP list prices and chipset/hardware-generation info directly on axis.com (Product Selector, search results, every product and category page), a field-of-view camera selector, and a Find Cams tool that scans your local network for Axis devices and shows model, serial number and firmware without a password.

Built for sales and channel teams, marketing, Axis resellers and partners, and Axis employees. (Not affiliated with or endorsed by Axis Communications — an independent tool built for people who work with their cameras.)

## Japanese localization

The popup, options/monthly-update page, FOV Map Camera Selector, and every badge/tooltip injected into axis.com (Product Selector, search, product/category pages) switch to full Japanese automatically whenever any one of these is true: JPY is selected as the currency, the browser's own UI language is Japanese, or (on axis.com itself) the page is the `/ja-jp/`-style Japanese-locale slice of the site. No manual language toggle is needed - `i18n.js` (loaded first everywhere) detects this once and every other script/page reacts to it, including live switching if you change currency while a page is already open. Technical terms and brand/product names (Axis, ARTPEC, CamStreamer, EUR/USD/GBP/JPY, model numbers) are kept in English/roman form, matching the tone of the extension's existing Japanese footer disclaimer.

## What it shows, and where

- **Product Selector** (axis.com/support/tools/product-selector) — every camera tile gets a price badge and, where known, a chipset label. A floating chipset filter panel lets you narrow the whole page down to specific chipset generations (e.g. only cameras with CamStreamer app support), and series can be sorted cheapest-first.
- **Product Selector comparison page** (axis.com/support/tools/product-selector/comparison/) — when you compare products from the Product Selector, Chipset and Price rows are added right at the top of the comparison, above every other spec.
- **axis.com search results** — searching for a model (e.g. `M1137`) or a whole series (e.g. `Q35`) appends a price badge to each matching result title, plus a chipset badge when the result names one specific model.
- **Product and category pages** (axis.com/products/...):
  - Category pages (e.g. a hub page like "Box cameras," or a series page like "AXIS Q17 Box Camera Series") — every product tile gets a price badge and chipset badge(s), a specific price for one model or a "from $X" range for a whole series card.
  - The series page breadcrumb trail shows the full price range and every chipset used across that series in one place.
  - Individual product pages get the same price + chipset badges next to the product name.
  - The "Compare products" table on a series page gets two new rows at the top — **Chipset** and **Price** — one column per model, so you can compare cost and hardware generation right alongside every other spec.
- **Toolbar popup** — three tabs: **Chipset & MSRP** (look up any model name or Axis part number, price and chipset side by side, ♡ to pin favorites to the top), **FoV Map Tool** (a mini map with the matching cameras listed right underneath — see below) and **IP Utility Scanner** (Find Cams). Header buttons are icon-only and the list columns are fixed-width, so prices, chipset pills and hearts line up in one column regardless of digit count or currency.
- **Click to copy** — in the popup list every text field copies its own value: click the model name, the Product Number or the camera type and it goes to the clipboard with a brief ✓. Multipack part numbers (`02858-021 (10 pcs)`) copy the bare, pasteable SKU. Find Cams results copy the same way (model, serial number, firmware). Only the ♡ toggles a favorite; the rest of the row is no longer a click target.

Chipset badges are grouped for readability: older ARTPEC generations collapse into "ARTPEC 3-5," CamStreamer-supported generations collapse into "ARTPEC 6-9" (marked with a ✅), and Ambarella variants are shown as "AMB" plus the model code (e.g. "AMB A5S").

## FOV Map Camera Selector

The popup's **FoV Map Tool** tab holds a small map: drop the camera pin, draw the cone, and the cameras that cover it are listed directly under the map — no tab switching. Each row shows model, chipset, price and the favorite heart; favorites rank first, then the tightest FoV fit (least overkill), price breaking ties, and PTZs that only reach the angle by panning sort below models that cover the cone outright. Prices follow the popup's currency and the 🚫 hide-prices setting. **⛶ Full Screen** opens the same cone in the full-tab tool described next, **Reset** clears it.

Click the 🗺 button in the popup to open a full-tab map tool. Drop a pin for the camera location, then click-drag twice to draw the two edges of the area you need covered. The tool works out the required horizontal field-of-view angle and ranks every Axis model with curated FOV data (see `fov-data.js`) by the tightest fit — narrowest lens that still covers the requirement, cheapest first as a tiebreak. Coverage depth (range) is shown for reference but isn't used to filter yet, since no per-model range/pixel-density data exists in the extension. Only models with a curated FOV entry are shown; everything else is excluded rather than guessed.

### 360° cameras, PTZ and multi-sensor models

A single "horizontal FOV" number means different things for different camera types, so the tool now distinguishes three classes (derived from the price list's own `section` field — no extra data to curate):

- **Fixed / varifocal** — `fov.max` is genuinely what it sees at once. Matched as before.
- **Panoramic / fisheye** — also sees its published width all at once, but that width can exceed 180°.
- **PTZ** — the published FOV is only its *widest zoom setting*; it can additionally pan a full circle. PTZs therefore match any required angle up to 360°, but when they only get there by panning the card says **"PTZ · by panning"**, because a PTZ watches one direction at a time rather than the whole area simultaneously. Cameras that cover the cone outright always rank above ones that only reach it by panning.

Two consequences worth knowing:

- **Coverage can now be set beyond 180°.** The cone is held internally as a centre bearing plus a total angle rather than a signed sweep between two edges, so the angle slider goes all the way to 360° and draws a full circle at the top end. Dragging a handle outward keeps the cone opening straight through 180° and on to a full circle: of the two sectors two edges can describe, the tool picks the one whose centre stays put, so it never flips to the far side mid-drag. (Dragging a handle back through the *other* handle still collapses the cone and reopens it small on the far side, which is what you'd expect there.) Without this, a 360° camera like P3747-PLVE could never be selected on its actual strength.
- **Multi-sensor models are badged as such.** For P3747-PLVE, M4327-P, P3818-PVE and P4708-PLVE the published figure is a *combined* number across several sensors, not what one sensor sees, so those cards carry a **Multi-sensor** badge (`fov-data.js` documents this in its own header).

Note that `Q6300-E` and `Q6020-E` sit in the pan/tilt/zoom section of the price list but are actually fixed 3.7 mm 360° panoramic cameras with no optical zoom, so they're classed by geometry rather than by section label.

FOV data for the pan/tilt/zoom range is now complete (23/23 catalog entries, up from 10/23). Previously the 13 missing models passed the FOV filter unconditionally, since the filter fails open — they appeared as matches with no FOV basis at all.

Once the cone is drawn, drag the camera pin or either yellow edge handle directly on the map to reshape it — the angle/range sliders and the results update live. A **Filter & sort** panel lets you sort by tightest FOV fit or by price, and restrict results to CamStreamer App-supported models (ARTPEC-6/7, -8, and -9, merged into a single yes/no filter — the exact chipset is still shown per result). Prices follow whatever currency (€/$/¥) is currently selected in the popup, and stay in sync live if you switch it while the map tab is open.

Matching models appear as cards in a stripe along the bottom of the window, scrolled sideways, each showing a product photo, the model name, FOV range, part number and series, plus chipset and price badges styled to match the ones this extension injects onto axis.com itself (CamStreamer-supported models also get a green edge).

Each card's model name links straight to that model's page on axis.com (new tab), and clicking its part-number badge copies the SKU to the clipboard with a brief green "✓ Copied" confirmation.

The name is only a link once the extension has actually confirmed that model's page exists. Most model names map cleanly onto a product-page URL, but some don't — F-Series modular sensors, main units and accessories carry a product-type suffix Axis doesn't derive from the model name (F2135-RE lives at `/products/axis-f2135-re-fisheye-sensor`, not `/products/axis-f2135-re`). Rather than risk dead links, the thumbnail fetch below doubles as an existence check, and names stay inert plain text until it comes back positive (and permanently, for names that never resolve). Verdicts are cached, so on later visits the links are live immediately.

Product photos aren't bundled — Axis image URLs are CMS paths that can't be derived from a model name — so the first time a card scrolls into view, the extension fetches that model's own product page and reads the image URL out of it, then caches the URL permanently in local storage. Only cards you actually scroll to trigger a fetch, and failures are cached too so a model whose page can't be resolved isn't retried on every visit (its card just shows an empty image box). This is why `www.axis.com` appears in `host_permissions`. To give the map more room, every settings box collapses by clicking its heading, the whole settings sidebar hides via the **⚙** button in the header, and the results stripe collapses to just its title bar — all three remembered between visits.

## Find Cams

Click the 🔍 **Find Cams** button in the popup (opens a side column, or expand it to a full tab with ⛶) to scan your local network for Axis cameras. Enter the subnet you're on — the common presets (192.168.0, 192.168.1, 10.0.0) and the AXIS factory-default `192.168.0.90` sit on their own line under the input, one click away — and it sweeps all 254 addresses, asking each one for its public device info — model, serial number, firmware, and product type — over VAPIX `basicdeviceinfo.cgi`, which answers without a password on AXIS OS 10+. Each result also shows its CamStreamer-compatibility chipset via the same lookup the rest of the extension uses.

Only cameras on the same subnet with HTTP enabled will answer (HTTPS-only cameras can't be probed from a browser), and nothing leaves your computer — every request goes straight from your browser to the camera's own IP. The last scan is remembered (`chrome.storage.local`), so reopening the popup shows the previous results immediately with a **Re-Scan** button; if you'd already granted access to that subnet, it also quietly re-scans in the background to keep the list fresh. Chrome requires a real click to grant a new subnet access, so the very first scan on a network always needs one manual **Scan**.

Extensions can't do multicast discovery (Bonjour/ONVIF/SSDP), so this only finds Axis devices, and only ones on the same subnet. For discovery across camera brands, or cameras on a different subnet/VLAN than your computer, see the companion desktop tool at [ipscanner.4xs.dev](https://ipscanner.4xs.dev).

## Currency

A € EUR / $ USD / £ GBP / ¥ JPY toggle in the popup switches which currency is shown everywhere — Product Selector, search, product pages, and the popup itself — instantly, with no reload needed. USD and EUR are both hardcoded from Axis's own public price lists (the US and EE/EU comparison-table editions); GBP and JPY have no list price of their own and are always converted live from USD at the current USD/GBP and USD/JPY reference rates.

A small number of SKUs — mostly US/Canada-only products and 2N-branded devices — have no EUR list price in Axis's EE/EU price list at all. For those, EUR is estimated from USD at the current USD/EUR rate instead of showing nothing, and the price is shown with a "~" prefix (e.g. "~€499") so it's clear it's an approximation rather than a real list price. GBP and JPY prices always carry the same "~" prefix, since they're never a genuine Axis list price either.

### Hiding prices entirely

A fourth **🚫** option in the same toggle hides every price across the whole extension — Product Selector badges, search badges, product/category badges, the series breadcrumb range, both comparison tables, the popup list, and the FOV map cards. Chipset badges, the chipset filter panel, FOV filtering and the map tool all keep working exactly as before, so it's usable as a pure "find me a suitable camera" tool for people who don't deal with pricing. The choice persists and applies live to open tabs. Cheapest-first sorting still functions (it reveals no numbers), and the popup's FX-rate row hides itself since it has nothing left to explain.

## Keeping prices current

The extension ships with a recent Axis public price list bundled in as the default (currently Q1/Q2 2026 pricing from Axis's public comparison-table price list, in USD). On top of that base, a small set of products — video recorders and storage media (SD cards) — carry August 2026 US$ and EUR price updates, applied where Axis flagged a price change; EUR is only shown for those updated items. A further set of products that weren't in any prior public price list at all (new SKUs, previously-missing 10-pack/bare-drive variants) has also been added, grouped under a clearly-labeled "New products (August 2026)" section so it's obvious those weren't part of the original comparison table. Axis publishes a new price list roughly every month, and refreshing is built in — no reinstall, no waiting on a new extension version:

1. Click the extension icon, then the **⚙** gear button next to the theme toggle.
2. Drag the new month's official AXIS Price List `.xls`/`.xlsx` file onto the drop zone (or click to pick the file). Everything happens locally in your browser — the file itself never leaves your machine. Either the USD or the EUR edition works equally well.
3. The standard AXIS Price List format is recognized and mapped automatically. For anything else (a different layout, a one-off export), a simple column-mapping screen lets you point out which column is the model name, which is the price, and so on, with a live preview before anything is applied.
4. Before committing, you'll see a coverage report — how many products matched, broken down by category, anything that didn't match, and how many rows describe a product not yet in this catalog at all.
5. **New products are added automatically.** Any row whose part number isn't already in the catalog (a model this extension's bundled data predates) is added as a new entry — tagged with a note explaining it was added from an uploaded update — rather than silently ignored. This works the same way whether the uploaded file is priced in EUR, USD, or JPY. These show up immediately in the popup, search badges, and on Product Selector/product/category pages once axis.com itself lists the product.
6. **Revert to bundled prices** is always available if you want to go back to the default data that shipped with the extension, which also removes anything auto-added by an update.

## Keeping chipset info current

Chipset labels are sourced from CamStreamer's published camera-compatibility list and refresh automatically about once a week. A manual **Update** button in the popup refreshes it on demand at any time.

## Installing

This extension isn't published to the Chrome Web Store, so it's installed as an unpacked extension:

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this folder.
4. Any axis.com tabs you already have open (Product Selector, search, product/category pages) pick it up automatically within a moment — no need to reload or visit a specific page first. New tabs and page loads work as normal.

### Packaging note

If this is ever zipped up and uploaded through the Chrome Web Store developer dashboard (rather than loaded unpacked), the dashboard enforces a **132-character limit on `manifest.json`'s `description` field** — longer than that, and the upload is rejected with "The description field in manifest is too long." Keep any future edits to `description` under that limit.
