// OS 13 / compute badges on scanned cameras (find-cams.js).
//
// Pulls the real lookup factories out of the shipped file rather than
// restating them, same approach as os13.test.mjs, so the test cannot drift
// from the code it guards.
//
// The error class this exists to catch: the scanner reports hardware that is
// physically on the user's network, so a badge resolved from the wrong model
// is a wrong answer about a camera they own. "M1137" must never pick up
// "M1137 Mk II" - different product, different verdict.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const src = read('find-cams.js');
const grab = (name) => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unterminated: ' + name);
};
const normModel = src.match(/const normModel = [^\n]+/)[0];

const ctx = {
  OS13_DATA: new Function(read('os13-data.js') + ';return OS13_DATA;')(),
  COMPUTE_DATA: new Function(read('compute-data.js') + ';return COMPUTE_DATA;')(),
};
const make = new Function('OS13_DATA', 'COMPUTE_DATA',
  normModel + '\n' + grab('defaultOs13For') + '\n' + grab('defaultComputeFor') +
  '\nreturn { os13: defaultOs13For(), compute: defaultComputeFor() };');
const { os13, compute } = make(ctx.OS13_DATA, ctx.COMPUTE_DATA);

let pass = 0, fail = 0;
const t = (c, m) => { c ? pass++ : fail++; console.log((c ? '  pass | ' : '  FAIL | ') + m); };

// The three models in a real scan of Pavel's network.
t(os13('AXIS Q1656')?.v === 'os13', 'Q1656 -> OS13 supported');
t(compute('AXIS Q1656') === 'd', 'Q1656 -> DLPU');
t(os13('AXIS M1137')?.v === 'no-os13', 'M1137 -> no OS 13 (ARTPEC-7, capped at 10.12)');
t(compute('AXIS M1137') === null, 'M1137 -> no compute verdict, so no badge');
t(os13('AXIS M1075-L')?.v === 'os13', 'M1075-L -> OS13 supported');

// The trap: trailing tokens are never trimmed.
t(os13('AXIS M1137').v !== os13Of('M1137 MK II'), 'M1137 and M1137 Mk II do not share a verdict');
function os13Of(k) { const m = ctx.OS13_DATA.models[k]; return m && m.v; }
t(os13Of('M1137 MK II') === 'unknown', 'M1137 Mk II is still unknown in the data');
t(os13('AXIS M1137 Mk II') === null, 'an unknown verdict resolves to null -> no badge rendered');

// Absent model must not fall back to a prefix match.
t(os13('AXIS NOTAMODEL9999') === null, 'unknown model -> no badge');
t(compute('AXIS NOTAMODEL9999') === null, 'unknown model -> no compute badge');

// Case and the AXIS prefix must not matter.
t(os13('q1656')?.v === 'os13', 'lookup is case-insensitive and prefix-tolerant');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
