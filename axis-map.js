// ---------------------------------------------------------------------
// axis-map.js — the one place that talks to MapLibre GL.
//
// Loaded as a plain script by all three map surfaces (the popup's FoV Map
// tab, the full-page fov-map.html tool, and the Filters panel injected into
// the Product Selector), the same way find-cams.js is shared.
//
// WHY A LAYER AT ALL, rather than calling MapLibre directly in three files:
//
//  1. Coordinate order. Leaflet is [lat, lng]; MapLibre is [lng, lat]. The
//     cone maths in those three files is all written in lat/lng and is the
//     valuable part of the feature, so this file keeps a Leaflet-shaped
//     {lat, lng} surface and does the flip in exactly ONE place. Getting
//     that wrong scatters silently-transposed coordinates everywhere.
//  2. MapLibre has no polyline/polygon objects. Vector shapes are GeoJSON
//     sources plus layers, which have to be added after the style loads and
//     re-added after every setStyle(). That plumbing is identical on all
//     three surfaces and is not worth writing three times.
//  3. Tiles are third-party and can fail (see degrade() below).
//
// Tiles: OpenFreeMap — no API key, no request limits, commercial use
// permitted, and it ships Positron/Dark so the basemap can follow the
// extension's own light/dark theme. Attribution is required and is set on
// the map's attribution control.
// ---------------------------------------------------------------------
(function () {
  "use strict";

  // Two basemap looks, each with a light/dark variant:
  //   "color" - Liberty, the full-colour OSM look (default; landmarks, parks,
  //             water and road classes are all colour-coded, which is what you
  //             want when you're judging what a camera actually looks at)
  //   "gray"  - Positron, the muted grey look (less visual competition with
  //             the yellow cone; this used to be the only option)
  // OpenFreeMap ships no dark *colour* style, so dark theme uses Positron-dark
  // for both - the switch is a no-op there, by design rather than by accident.
  const url = (name) => "https://tiles.openfreemap.org/styles/" + name;
  const BASEMAPS = {
    color: { light: url("liberty"), dark: url("dark") },
    gray: { light: url("positron"), dark: url("dark") },
  };
  // Back-compat: STYLES was the old light/dark pair. Now it points at the
  // default (colour) basemap.
  const STYLES = BASEMAPS.color;
  const ATTRIBUTION =
    '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  const CONE_FILL = "#e0b400";
  const CONE_FILL_OPACITY = 0.28;
  const CONE_LINE = "#e0b400";

  // The CSP build keeps its worker in a separate file instead of a blob URL,
  // which is what lets it run under an extension's content security policy.
  // Must be set before any Map is constructed, and the worker file has to be
  // web-accessible so the content script on axis.com can reach it too.
  let workerReady = false;
  function ensureWorker() {
    if (workerReady || typeof maplibregl === "undefined") return;
    try {
      maplibregl.setWorkerUrl(chrome.runtime.getURL("vendor/maplibre-gl-csp-worker.js"));
    } catch (e) {
      /* not in an extension context (or already set) - the default is fine */
    }
    workerReady = true;
  }

  const asLatLng = (v) => (Array.isArray(v) ? { lat: v[0], lng: v[1] } : v);
  // Accepts both [lat, lng] and {lat, lng}; MapLibre wants [lng, lat].
  const EMPTY_STYLE = { version: 8, sources: {}, layers: [] };

  const toLngLat = (v) => { const ll = asLatLng(v); return [ll.lng, ll.lat]; };
  const toLatLng = (lngLat) => ({ lat: lngLat.lat, lng: lngLat.lng });

  function create(container, opts) {
    opts = opts || {};
    ensureWorker();
    const el = typeof container === "string" ? document.getElementById(container) : container;
    if (!el || typeof maplibregl === "undefined") return null;

    const center = opts.center || { lat: 50.0755, lng: 14.4378 }; // Prague, sensible default
    let theme = opts.theme === "dark" ? "dark" : "light";
    let basemap = opts.basemap === "gray" ? "gray" : "color";
    const styleUrl = () => BASEMAPS[basemap][theme];

    const map = new maplibregl.Map({
      container: el,
      style: styleUrl(),
      center: [center.lng, center.lat],
      zoom: opts.zoom == null ? 13 : opts.zoom,
      attributionControl: false,
    });
    // compact: the map box is only ~420px wide in the popup, and the full
    // attribution string overflows it. The compact control is an "i" toggle.
    //
    // No customAttribution: the OpenFreeMap styles already declare exactly
    // this string on their own sources, so passing ours too printed the whole
    // credit line twice. ATTRIBUTION is kept as the documented fallback for a
    // style that doesn't carry its own.
    const attributionControl = new maplibregl.AttributionControl({ compact: true });
    map.addControl(attributionControl);
    // MapLibre renders a compact control *expanded* until the user first
    // collapses it, which eats a strip of the map on every load. Collapse it
    // to the "i" button once it exists - it still opens on click.
    function collapseAttribution() {
      const box = el.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact-show");
      if (box) box.classList.remove("maplibregl-compact-show");
    }

    // Shapes are declared up-front and re-applied whenever the style is
    // (re)loaded, because setStyle() throws away every source and layer.
    const shapes = new Map(); // id -> {type:'line'|'fill', coords, dashed}
    let styleReady = false;
    let degraded = false;

    function geojson(type, coords) {
      const ring = coords.map(toLngLat);
      return {
        type: "Feature",
        properties: {},
        geometry:
          type === "fill"
            ? { type: "Polygon", coordinates: [ring] }
            : { type: "LineString", coordinates: ring },
      };
    }

    function applyShape(id, s) {
      if (!styleReady) return;
      const data = geojson(s.type, s.coords);
      const src = map.getSource(id);
      if (src) {
        src.setData(data);
        return;
      }
      map.addSource(id, { type: "geojson", data });
      if (s.type === "fill") {
        map.addLayer({
          id: id + "-fill", type: "fill", source: id,
          paint: { "fill-color": CONE_FILL, "fill-opacity": CONE_FILL_OPACITY },
        });
        map.addLayer({
          id: id + "-line", type: "line", source: id,
          paint: { "line-color": CONE_LINE, "line-width": 2 },
        });
      } else {
        map.addLayer({
          id: id + "-line", type: "line", source: id,
          paint: Object.assign(
            { "line-color": CONE_LINE, "line-width": 2 },
            s.dashed ? { "line-dasharray": [2, 2] } : {}
          ),
        });
      }
    }

    function applyAllShapes() {
      shapes.forEach((s, id) => applyShape(id, s));
    }

    function removeShape(id) {
      shapes.delete(id);
      if (!styleReady) return;
      [id + "-fill", id + "-line"].forEach((l) => {
        if (map.getLayer(l)) map.removeLayer(l);
      });
      if (map.getSource(id)) map.removeSource(id);
    }

    // The basemap is only context: the pin, the wedge and the matching-camera
    // list are all our own geometry. So if the tile provider refuses us, drop
    // to a plain graticule and keep the tool working rather than showing a
    // wall of provider error tiles.
    function degrade() {
      if (degraded) return;
      degraded = true;
      el.classList.add("axis-map-nobasemap");
      // No basemap rendered means nothing to attribute.
      try { map.removeControl(attributionControl); } catch (e) {}
      if (!el.querySelector(".axis-map-nobasemap-note")) {
        const note = document.createElement("div");
        note.className = "axis-map-nobasemap-note";
        note.textContent = opts.noteText || "Map tiles unavailable — the coverage tool still works.";
        el.appendChild(note);
      }
      // The pin, the wedge and the match list are our own geometry, but
      // MapLibre can only host sources/layers once *some* style has loaded.
      // Swap in an empty style that fetches nothing so the cone still draws
      // over the CSS graticule.
      styleReady = false;
      map.setStyle(EMPTY_STYLE, { diff: false }); // diff:true never fires style.load here
    }
    map.on("error", (e) => {
      const msg = String((e && e.error && e.error.message) || "");
      // A style that never loads means no basemap at all; individual tile
      // misses are not worth reacting to.
      if (degraded) return; // already on the empty style; its own errors are noise
      if (!styleReady || /style|sprite|glyphs/i.test(msg)) degrade();
    });

    map.on("style.load", () => {
      styleReady = true;
      applyAllShapes();
      // The control re-expands itself whenever the attribution text changes,
      // i.e. after every setStyle() (theme or basemap switch) as well as on
      // first load - so collapse it here rather than once at startup.
      collapseAttribution();
      setTimeout(collapseAttribution, 0); // after MapLibre's own class update
    });

    const api = {
      raw: map,

      on(evt, cb) {
        map.on(evt, (e) => cb({ latlng: e.lngLat ? toLatLng(e.lngLat) : null, original: e }));
        return api;
      },
      setDragEnabled(on) {
        if (on) map.dragPan.enable();
        else map.dragPan.disable();
        return api;
      },
      resize() {
        map.resize();
        return api;
      },

      // Leaflet-shaped helpers the callers still use.
      // asLatLng() accepts both [lat, lng] and {lat, lng}.
      setView(latlng, zoom) {
        const ll = asLatLng(latlng);
        map.jumpTo({ center: [ll.lng, ll.lat], zoom: zoom == null ? map.getZoom() : zoom });
        return api;
      },
      // Great-circle metres, same contract as Leaflet's map.distance().
      distance(a, b) {
        const p = asLatLng(a), q = asLatLng(b);
        const R = 6371008.8, rad = Math.PI / 180;
        const dLat = (q.lat - p.lat) * rad, dLng = (q.lng - p.lng) * rad;
        const s =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(p.lat * rad) * Math.cos(q.lat * rad) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
      },
      setTheme(next) {
        const want = next === "dark" ? "dark" : "light";
        if (want === theme || degraded) return api;
        theme = want;
        styleReady = false;
        map.setStyle(styleUrl()); // style.load re-applies every shape
        return api;
      },
      getBasemap: () => basemap,
      setBasemap(next) {
        const want = next === "gray" ? "gray" : "color";
        if (want === basemap || degraded) return api;
        basemap = want;
        styleReady = false;
        map.setStyle(styleUrl()); // same contract as setTheme
        return api;
      },

      // --- markers -----------------------------------------------------
      marker(latlng, o) {
        o = o || {};
        // A CSS-styled element rather than an image-backed marker. The
        // original Leaflet code used divIcon for a specific reason worth
        // keeping: on axis.com's own page the host site's img-src CSP can
        // silently block marker images even though the extension permits
        // them (web_accessible_resources controls the extension side, not
        // the host page's policy). An element with no image can't be
        // blocked that way.
        let element;
        if (o.className || o.html) {
          element = document.createElement("div");
          if (o.className) element.className = o.className;
          if (o.html) element.textContent = o.html;
        }
        const m = new maplibregl.Marker({
          draggable: !!o.draggable,
          element: element,
        })
          .setLngLat(toLngLat(latlng))
          .addTo(map);
        const handle = {
          getLatLng: () => toLatLng(m.getLngLat()),
          setLatLng: (ll) => { m.setLngLat(toLngLat(ll)); return handle; },
          setDraggable: (v) => { m.setDraggable(!!v); return handle; },
          on: (evt, cb) => { m.on(evt, () => cb({ target: handle })); return handle; },
          remove: () => { m.remove(); },
        };
        return handle;
      },

      // --- vector shapes ------------------------------------------------
      line(id, coords, o) {
        o = o || {};
        shapes.set(id, { type: "line", coords: coords.slice(), dashed: !!o.dashed });
        applyShape(id, shapes.get(id));
        return {
          setLatLngs: (next) => {
            const s = shapes.get(id);
            if (!s) return;
            s.coords = next.slice();
            applyShape(id, s);
          },
          remove: () => removeShape(id),
        };
      },
      cone(id, coords) {
        shapes.set(id, { type: "fill", coords: coords.slice() });
        applyShape(id, shapes.get(id));
        return {
          setLatLngs: (next) => {
            const s = shapes.get(id);
            if (!s) return;
            s.coords = next.slice();
            applyShape(id, s);
          },
          remove: () => removeShape(id),
        };
      },

      isDegraded: () => degraded,
      destroy() { try { map.remove(); } catch (e) {} },
    };
    return api;
  }

  window.AxisMap = { create, STYLES, BASEMAPS };
})();
