// node tools/classcad/wright/build.mjs [A B C D E]  -> hw/out/wright/<L>/{<group>.stl,<group>.step,manifest.json}
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { session } from '../rt.mjs'; import { Scene, groupScript, pt } from './lib.mjs'; import { LAYOUTS } from './layouts.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const TILES = JSON.parse(fs.readFileSync(path.join(here, 'tiles.json')));
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(LAYOUTS);
const { client, call } = await session();
try {
  for (const L of which) {
    const out = path.join(root, 'hw/out/wright', L); fs.mkdirSync(out, { recursive: true });
    const S = new Scene(); const res = LAYOUTS[L].build(S);
    const D = TILES[res.tile], cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
    const groups = [...new Set(S.prims.map(p => p.g))];
    const rep = {};
    for (const g of groups) {
      const prims = S.prims.filter(p => p.g === g);
      const r = await call('run_script', { label: `${L}:${g}`, script: groupScript(`${LAYOUTS[L].name}_${g}`, prims), timeoutMs: 300000 });
      rep[g] = { prims: prims.length, result: r.returned ?? r };
      for (const fmt of ['STL', 'STP']) {
        const s = await call('save', { format: fmt }); const content = s.content ?? s.result?.content;
        if (!content) throw Error('empty export ' + g);
        fs.writeFileSync(path.join(out, `${g}.${fmt === 'STL' ? 'stl' : 'step'}`), Buffer.from(content, 'base64'));
      }
      console.log(L, g, prims.length);
    }
    const panels = res.Ms.map(M => ({ M, fiber: D.fiber.map(([x, y]) => pt(M, [x - cx, y - cy, 0])) }));
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ layout: L, name: LAYOUTS[L].name, tile: res.tile, cam: res.cam, panels, wires: S.wires, tally: S.tally, report: rep }, null, 1));
  }
} finally { await client.close(); }
