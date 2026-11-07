import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Run with:  node test/os13.test.mjs   (from the extension root, or anywhere)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Pulls the real functions out of the shipped products-content.js rather
// than restating them, so the test cannot drift from the code it guards.
// Guards the one error class that costs money: reporting a camera as OS 13
// capable when it is not (Preflight rule A9).
// Pull the real functions out of the shipped file - no re-typing, no copy drift.
const src = fs.readFileSync(path.join(ROOT,'products-content.js'),'utf8');
const grab = (name) => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
};
// Same idea as grab(), for a top-level const: never restate source in a test.
const grabConst = (name) => {
  const m = src.match(new RegExp('\\n\\s*const ' + name + '\\s*=[\\s\\S]*?;\\n'));
  if (!m) throw new Error('not found: ' + name);
  return m[0];
};
const dataSrc = fs.readFileSync(path.join(ROOT,'os13-data.js'),'utf8');
const computeSrc = fs.readFileSync(path.join(ROOT,'compute-data.js'),'utf8');
const sandbox = `
${dataSrc}
const OS13 = OS13_DATA.models;
${grab('normalize')}
${grab('normalizeBare')}
const os13Index = new Map();
for (const key of Object.keys(OS13)) os13Index.set(normalizeBare(key), OS13[key]);
${grabConst('OS13_MK_TOKEN')}
${grabConst('OS13_VARIANT_TOKEN')}
${grab('os13TrimmableToken')}
${grab('os13VariantOnly')}
${grab('os13TrimVariant')}
${grab('os13Lookup')}
${grab('os13For')}
${grab('exactSocFor')}
${grab('os13ForNames')}
${computeSrc}
const COMPUTE = (typeof COMPUTE_DATA !== "undefined" && COMPUTE_DATA.models) || {};
const computeIndex = new Map();
for (const key of Object.keys(COMPUTE)) computeIndex.set(normalizeBare(key), COMPUTE[key]);
${grab('computeFor')}
${grab('computeForNames')}
return { os13For, os13ForNames, exactSocFor, computeFor, computeForNames,
         MODELS: OS13_DATA.models, COMPUTE_MODELS: COMPUTE };
`;
const { os13For, os13ForNames, exactSocFor, computeFor, computeForNames,
        MODELS, COMPUTE_MODELS } = new Function(sandbox)();

let fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  got=${JSON.stringify(got)}${ok ? '' : ' want=' + JSON.stringify(want)}`);
};
const v = (n) => { const e = os13For(n); return e ? e.v : null; };
const vn = (ns) => { const e = os13ForNames(ns); return e ? e.v : null; };

console.log('--- exactness: the error class that costs money (rule A9) ---');
// 32-bit, on 12.11, but NOT on Axis's published "32-bit that will get OS 13"
// list. Sources disagree, so no badge until a 13.x build actually appears.
eq('M1137 Mk II: 32-bit conflict -> none', v('AXIS M1137 Mk II'), null);
eq('M5074 IS on the published list',       v('AXIS M5074'), 'os13');
eq('Q1715 32-bit conflict -> none',        v('AXIS Q1715'), null);
eq('M1137 (original) is 10.12-capped -> no-os13', v('AXIS M1137'), 'no-os13');
eq('M1137-E Mk II -> none too',              v('AXIS M1137-E Mk II'), null);
eq('P1375 is 11.11-capped -> no-os13',       v('AXIS P1375'), 'no-os13');
eq('P3245-LVE is 11.11-capped -> no-os13',   v('AXIS P3245-LVE'), 'no-os13');
// Both are ARTPEC-7. Only the one Axis moved onto the 12 track reaches OS 13.
eq('M3077-PLVE ARTPEC-7 but 11.11-capped',   v('AXIS M3077-PLVE'), 'no-os13');
eq('M4308-PLE 32-bit conflict -> none',      v('AXIS M4308-PLE'), null);
// FA51 IS offered 12.11.147, so the firmware track alone would clear it.
// Axis states ARTPEC-6 gets no OS 13; the explicit statement must win.
eq('FA51 ARTPEC-6 on 12.11 -> still no-os13', v('AXIS FA51'), 'no-os13');
eq('Q1656 is ARTPEC-8 -> os13',              v('AXIS Q1656'), 'os13');
eq('garbage -> null',                        v('AXIS NOPE-9999'), null);
eq('empty -> null',                          v(''), null);

console.log('--- packaging/regional variants inherit the base verdict ---');
eq('Q6355-LE No Midspan -> base',   v('AXIS Q6355-LE No Midspan'), v('AXIS Q6355-LE'));
eq('Q6355-LE No Midspan is os13',   v('AXIS Q6355-LE No Midspan'), 'os13');
eq('M5000-G US -> base',            v('AXIS M5000-G US'), v('AXIS M5000-G'));
eq('Q1728 48 mm -> base',           v('AXIS Q1728 48 mm'), v('AXIS Q1728'));
eq('M3125-LVE Black -> base',       v('AXIS M3125-LVE Black'), v('AXIS M3125-LVE'));
eq('Q6225-LE 50 Hz No Midspan',     v('AXIS Q6225-LE 50 Hz No Midspan'), v('AXIS Q6225-LE'));
eq('P1485-LE Kit 28 mm -> base',    v('AXIS P1485-LE Kit 28 mm'), v('AXIS P1485-LE'));
// Names taken verbatim off axis.com, both of which used to render no badge.
eq('M5526-E 50 Hz 4 pcs',           v('AXIS M5526-E 50 Hz 4 pcs'), 'os13');
eq('M5526-E 60 Hz',                 v('AXIS M5526-E 60 Hz'), 'os13');
eq('P4708-PLVE Panoramic Camera',   v('AXIS P4708-PLVE Panoramic Camera'), 'os13');
eq('64-bit ARTPEC-8 all pass',      ['Q1656','M5526-E','P1388-LE','Q3839-PVE','Q2802-E']
    .every(m => v('AXIS '+m) === 'os13'), true);
eq('Q1656 Box Camera',              v('AXIS Q1656 Box Camera'), 'os13');
eq('P3267-LVE Mic -> base',         v('AXIS P3267-LVE Mic'), v('AXIS P3267-LVE'));

console.log('--- Mk variants need their own entry, not a trimmed base ---');
// From the Product Selector, verbatim. Axis's published 32-bit list names
// "Q8752-E & Mk II", so both get the badge - but via two separate entries,
// never by trimming "Mk II" away.
eq('Q8752-E Mk II 35 mm 8.3 fps',   v('AXIS Q8752-E Mk II 35 mm 8.3 fps'), 'os13');
eq('Q8752-E Mk II Zoom 30 fps',     v('AXIS Q8752-E Mk II Zoom 30 fps'), 'os13');
eq('Q8752-E base also os13',        v('AXIS Q8752-E'), 'os13');
eq('P5654-E Mk II 50HZ',            v('AXIS P5654-E Mk II 50HZ'), 'os13');
eq('P3905-R Mk III M12 2.8 mm',     v('AXIS P3905-R Mk III M12 2.8 mm'), 'os13');
// Marketing descriptors in card titles, taken verbatim off axis.com. These
// are trimmed by the no-digit rule, not by an enumerated word list.
eq('Q8752-E Mk II Bispectral PTZ',  v('AXIS Q8752-E Mk II Bispectral PTZ Camera'), 'os13');
eq('P9117-PV Corner Camera',        v('AXIS P9117-PV Corner Camera'), 'os13');
eq('Q9227-SLV Corner Camera',       v('AXIS Q9227-SLV Corner Camera'), 'os13');
eq('M3905-R Dome Camera',           v('AXIS M3905-R Dome Camera'), 'os13');
eq('P3945-R M12 2.8 mm 10P',        v('AXIS P3945-R M12 2.8 mm 10P'), 'os13');
eq('F9104-B Mk II Main Unit',       v('AXIS F9104-B Mk II Main Unit'), 'os13');
eq('A8207-VE Mk II is ARTPEC-6',    v('AXIS A8207-VE Mk II'), 'no-os13');

console.log('--- ...but a Mk marker is NOT packaging noise ---');
eq('M1137 must not reach Mk II',    v('AXIS M1137'), 'no-os13');
eq('they must still differ',        v('AXIS M1137') !== v('AXIS M1137 Mk II'), true);
eq('Q1615 Mk III not trimmed',      v('AXIS Q1615 Mk III'), 'os13');
eq('unknown base + noise -> null',  v('AXIS NOPE-9999 No Midspan'), null);

console.log('--- stainless/marine spelling fallback, same as chipsetFor ---');
eq('Q3538-SLVE falls back to Q3538-LVE',     v('AXIS Q3538-SLVE'), os13For('AXIS Q3538-LVE') ? os13For('AXIS Q3538-LVE').v : null);

console.log('--- series cards: badge only when unanimous ---');
eq('all os13 -> os13',          vn(['AXIS Q1656','AXIS Q1656-LE']), 'os13');
eq('os13 + no-os13 -> none',    vn(['AXIS Q1656','AXIS M1137']), null);
eq('os13 + unlisted -> none',   vn(['AXIS Q1656','AXIS NOPE-9999']), null);
eq('os13 + no-os13 -> none',    vn(['AXIS Q1656','AXIS FA51']), null);
eq('all no-os13 -> no-os13',    vn(['AXIS FA51','AXIS FA54']), 'no-os13');
eq('empty list -> none',        vn([]), null);

console.log('--- no "unknown" verdict can ever reach a badge ---');
const all = Object.keys(MODELS);
const leaked = all.filter(k => { const e = os13For('AXIS ' + k); return e && e.v === 'unknown'; });
eq('unknown entries leaking to badges', leaked.length, 0);
const resolved = all.filter(k => os13For('AXIS ' + k));
console.log(`      ${resolved.length}/${all.length} models badge; ${all.length - resolved.length} stay silent`);

// ---------------------------------------------------------------------
// background.js's support-page parser, against markup shaped like the real
// axis.com "Device software" section. Guards the regexes against drift.
// ---------------------------------------------------------------------
console.log('--- exact SoC (display only; bucket keeps driving filters) ---');
const soc = (n) => exactSocFor(n);
eq('Q6225-LE is ARTPEC-7',          soc('AXIS Q6225-LE PTZ Camera'), 'ARTPEC-7');
eq('Q8752-E Mk II is ARTPEC-7',     soc('AXIS Q8752-E Mk II Bispectral PTZ Camera'), 'ARTPEC-7');
eq('P9117-PV is ARTPEC-8',          soc('AXIS P9117-PV Corner Camera'), 'ARTPEC-8');
eq('FA51 is ARTPEC-6',              soc('AXIS FA51'), 'ARTPEC-6');
eq('multi-sensor keeps its count',  soc('AXIS Q1809-LE'), 'ARTPEC-8 (x2)');
// Discontinued models are absent from Axis's active feed, so they fall back
// to CamStreamer's collapsed bucket rather than inventing a chip.
eq('M1137 has no exact SoC',        soc('AXIS M1137'), null);
// Exposed even when the OS 13 verdict is unknown - the chip is still a fact.
eq('M1137 Mk II SoC despite unknown', soc('AXIS M1137 Mk II'), 'ARTPEC-7');
eq('unknown verdict still no badge',  v('AXIS M1137 Mk II'), null);

console.log('--- chipset filter stash/restore (content.js) ---');
// Ticking "Hide chipsets" clears the filter; un-ticking must hand the same
// selection back rather than leaving an empty filter with no way home.
const cjs = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
const grabFrom = (src, name) => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
};
const stash = new Function(`
  const store = {};
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  const FILTER_STASH_KEY = "stash";
  ${grabFrom(cjs, 'stashCheckedSet')}
  ${grabFrom(cjs, 'takeStashedCheckedSet')}
  return { stashCheckedSet, takeStashedCheckedSet, store };
`)();

eq('nothing stashed -> null',      stash.takeStashedCheckedSet(), null);
stash.stashCheckedSet(new Set(['ARTPEC-9', 'ARTPEC-8', 'ARTPEC-6/7']));
const back = stash.takeStashedCheckedSet();
eq('restores the same members',    back && [...back].sort(), ['ARTPEC-6/7', 'ARTPEC-8', 'ARTPEC-9']);
eq('stash is single-use',          stash.takeStashedCheckedSet(), null);
stash.stashCheckedSet(new Set());
eq('empty stash reads as null',    stash.takeStashedCheckedSet(), null);
stash.store.stash = 'not json';
eq('corrupt stash -> null',        stash.takeStashedCheckedSet(), null);

console.log('--- support-page parser (background.js) ---');
const bg = fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8');
const grabBg = (name) => {
  const i = bg.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0;
  for (let k = bg.indexOf('{', i); k < bg.length; k++) {
    if (bg[k] === '{') d++;
    else if (bg[k] === '}') { d--; if (!d) return bg.slice(i, k + 1); }
  }
};
const parseOs13SupportPage = new Function(grabBg('parseOs13SupportPage') + '; return parseOs13SupportPage;')();

const page = (versions, until) =>
  `<html><head><script>var junk="Version 99.99.999";</scr`+`ipt></head><body>` +
  (until ? `<p>AXIS OS support until ${until}.</p>` : '') +
  `<div class="ds">` +
  versions.map(([v, track]) => `<span>Version ${v}</span>\n<span> - AXIS OS ${track}</span>`).join('') +
  `</div></body></html>`;

const capped = parseOs13SupportPage(page([['10.12.363','LTS 2022'],['9.80.132','LTS 2020']], '2027-12-31'));
eq('capped model: newest build',   capped.fw, '10.12.363');
eq('capped model: major',          capped.major, 10);
eq('capped model: support until',  capped.until, '2027-12-31');

const current = parseOs13SupportPage(page([['11.11.238','LTS 2024'],['12.11.147','LTS 2026'],['10.12.363','LTS 2022']], null));
eq('current model: picks highest', current.fw, '12.11.147');
eq('current model: major',         current.major, 12);
eq('current model: no until',      current.until, null);

eq('minor compared numerically',   parseOs13SupportPage(page([['12.9.100','Active'],['12.11.147','LTS 2026']], null)).fw, '12.11.147');
eq('<script> contents ignored',    capped.fw !== '99.99.999', true);
eq('no versions -> null',          parseOs13SupportPage('<html><body>nothing here</body></html>'), null);
// Tag stripping leaves newlines inside the sentence; a single-space pattern
// silently loses the date on most real pages.
eq('support-until across newlines', parseOs13SupportPage(
   '<p>AXIS OS supported</p>\n<p> until 2031-12-31.</p><span>Version 12.11.147</span>').until, '2031-12-31');


// --- DLPU/MLPU aggregate (series heading) -----------------------------
// The series breadcrumb badges a whole page at once. Unanimous or nothing:
// "DLPU" over a series where one model has none is a wrong answer that
// looks authoritative.
console.log('--- compute aggregate (products-content.js) ---');
const cn = (ns) => computeForNames(ns);
eq('P14 series all DLPU', cn([
  'AXIS P1475-LE Bullet Camera','AXIS P1485-LE Bullet Camera',
  'AXIS P1485-LE Kit License Plate Verifier','AXIS P1486-LE Global Shutter Camera',
  'AXIS P1486-LE Kit License Plate Verifier','AXIS P1487-LE Bullet Camera',
  'AXIS P1488-LE Bullet Camera']), 'd');
eq('M11 Mk II series all MLPU', cn([
  'AXIS M1135 Mk II','AXIS M1137 Mk II','AXIS M1135-E Mk II','AXIS M1137-E Mk II']), 'm');
eq('mixed DLPU/none -> nothing', cn([
  'AXIS P3905-R Mk III','AXIS P3945-R']), null);
eq('one unknown -> nothing', cn(['AXIS P1475-LE Bullet Camera','AXIS Nope 9999']), null);
eq('empty list -> nothing', cn([]), null);
eq('single model still aggregates', cn(['AXIS P1488-LE Bullet Camera']), 'd');
eq('Q6225-LE is MLPU, not none', computeFor('AXIS Q6225-LE 50 Hz'), 'm');
// ARTPEC-7 spans all three verdicts, so the chipset can never stand in for
// the datasheet here.
eq('ARTPEC-7 can be DLPU',  computeFor('AXIS Q1715'), 'd');
// ARTPEC-7 with a DLPU, confirmed by its own datasheet and by both the
// Q3 and Q4 2026 comparison tables. The feed carries no field for it,
// and the older Q8752-E (no Mk II) genuinely has none - different product.
eq('Q8752-E Mk II is DLPU', computeFor('AXIS Q8752-E Mk II'), 'd');
eq('ARTPEC-7 can be MLPU',  computeFor('AXIS P5676-LE'), 'm');
eq('ARTPEC-7 can be none',  computeFor('AXIS M5075'), 'n');

// Regressions from the Product selector harvest. P3277-LVE and the Ex
// models were simply absent before: the comparison table only ever covered
// 151 models.
eq('P3277-LVE (was missing)',  computeFor('AXIS P3277-LVE'), 'd');
eq('P3278-LV  (was missing)',  computeFor('AXIS P3278-LV'), 'd');
eq('XFQ1656 matches Q1656',    computeFor('AXIS XFQ1656'), computeFor('AXIS Q1656'));
eq('P1468-XLE (was missing)',  computeFor('AXIS P1468-XLE'), 'd');
eq('Q1961-XTE matches Q1961-TE', computeFor('AXIS Q1961-XTE'), computeFor('AXIS Q1961-TE'));
// The feed carries no compute field for the P3945-R, but its datasheet
// states a DLPU - a missing field is not a "no".
eq('P3945-R from datasheet',   computeFor('AXIS P3945-R'), 'd');

// V59 transit PTZ: ARTPEC-7, no compute line and no object classification in
// either datasheet. Its family has no Compute capabilities row in the Q3 or
// Q4 comparison tables, so the datasheets are the whole evidence.
eq('V5925 has none', computeFor('AXIS V5925 50 Hz'), 'n');
eq('V5938 has none', computeFor('AXIS V5938 60 Hz'), 'n');

// Intercoms, door stations and modular main units: datasheet-confirmed, not
// inferred from the feed's blank field.
eq('I8016-LVE has none',     computeFor('AXIS I8016-LVE'), 'n');
eq('FA51 has none',          computeFor('AXIS FA51'), 'n');
eq('A8207-VE Mk II none',    computeFor('AXIS A8207-VE Mk II'), 'n');
// D2110-VE stays unbadged on purpose: no compute line, but its own overview
// claims deep-learning analytics. Ambiguous evidence must not become a badge.
eq('D2110-VE unbadged',      computeFor('AXIS D2110-VE'), null);

// A Mk token must never be trimmed away: M3057-PLR Mk II has no compute
// unit, and collapsing it onto some other M3057 entry would invent one.
eq('Mk token not trimmed', computeFor('AXIS M3057-PLR Mk II'), 'n');

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
