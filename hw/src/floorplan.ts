// Human floorplan (Rev D: 337 × 40 mm, 4 layers). The board is a long strip that stands behind the four tiles: each channel cell
// sits at its tile's height, so its U.FL jack is directly behind the tile's SiPM board and the four tile coax cables are short
// and identical. Board x runs along the stack (x = tile z + 18.5 mm), board y across it (y = 0 is the edge the coax leaves by).
// The four channel cells are identical: ch0 is force-placed inside CELLS.box and copied at CELLS.pitch (place.ts), and its
// local copper is routed once and copied (autoroute.ts, copper.ts).
//   x  8–328  : 4 channel cells, 100 mm pitch, y 0.6–22.4; U.FL at the coax edge (y = 3) of each
//   hub x 130–207 (between cells 1 and 2): USB-C on the far long edge, bias/threshold/baseline feeds, DACs, charge injection,
//                 HV boost, ESP32-S3-WROOM-1U (external U.FL antenna), BME280 on a slotted island at the far edge
//   x 270–324 : 22-pad probe row on the far long edge
import type { Floorplan } from "./place.ts";
import { TEST_ROW } from "./design.ts";

export const W = 337, H = 40;
export const CELLS = { groups: ["ch0", "ch1", "ch2", "ch3"], pitch: 100, box: { x0: 8.5, y0: 0.6, x1: 28.5, y1: 22.4 } };
export const TILE_PITCH = 100, X_OF_Z0 = 18.5;              // board x of tile 0's sensor
export const JACK_X = [0, 1, 2, 3].map(k => X_OF_Z0 + CELLS.pitch * k);
export const JACK_Y = 3.0;
export const ROW_Y = H - 2.6, ROW_X0 = 272;
/** BME280 island, described in its own frame (x = depth from the board edge, y = along the edge) and mapped onto the far long
 *  edge: slots isolate depth 0–8.4 over 10.6 mm; it hangs on a 2.6 × 3.8 mm arm plus two 1 mm FR4 bridges at the edge. */
export const ISLAND = { x0: 0, y0: 25.0, x1: 8.4, y1: 35.6, neckY0: 28.5, neckY1: 32.3, armX: 11.4, slotW: 1.2 };
export const IX0 = 156;                                     // board x of the island's y0 end
/** island frame -> board frame (rotated 90°: the island's edge is the far long edge, y = H) */
export const isl = (x: number, y: number) => ({ x: IX0 + (y - ISLAND.y0), y: H - x });
export const ISLAND_ROT = 90;
export const ISLAND_BOX = { x0: IX0 - 1.4, y0: H - (ISLAND.armX + 1.0), x1: IX0 + (ISLAND.y1 - ISLAND.y0) + 1.4, y1: H };

const cellBoxes = CELLS.groups.map((_, k) => ({ x0: CELLS.box.x0 + CELLS.pitch * k, y0: CELLS.box.y0, x1: CELLS.box.x1 + CELLS.pitch * k, y1: CELLS.box.y1 }));

/** M3 lid holes (x, y): ends of every case segment and the spans between them (segments split at x = 68.5 and 268.5) */
export const MOUNT_HOLES = [
  ...[3.5, 61.5, 75.5, 140.5, 261.5, 275.5, W - 3.5].map(x => ({ x, y: 3.5 })),
  ...[3.5, 61.5, 75.5, 178, 261.5, W - 3.5].map(x => ({ x, y: H - 3.5 })),
];
const u2 = isl(4.2, 28.8), c1 = isl(4.2, 32.0);

export const floorplan: Floorplan = {
  fixed: {
    ...Object.fromEntries(JACK_X.map((x, k) => [`J${2 + k}`, { x, y: JACK_Y, rot: 0 }])), // U.FL, shell pads toward the edge
    J1: { x: 136, y: H - 4.7, rot: 0 },   // USB-C, opening on the far long edge
    U1: { x: 196, y: 27, rot: 270 },      // ESP32-S3-WROOM-1U: its U.FL connector faces +x; the antenna is outside the case
    U2: { ...u2, rot: ISLAND_ROT },       // BME280 on its island
    C1: { ...c1, rot: ISLAND_ROT },
    ...Object.fromEntries(TEST_ROW.map((_, k) => [`TP${k + 1}`, { x: ROW_X0 + 2.54 * k, y: ROW_Y, rot: 0 }])),
  },
  groups: {
    ...Object.fromEntries(CELLS.groups.map((g, k) => [g, { x: JACK_X[k], y: 12 }])),
    dac: { x: 182, y: 11 }, inj: { x: 160, y: 11 },
    sensors: { x: 172, y: 29 },
    hv: { x: 146, y: 13 },
    mcu: { x: 196, y: 27 },
    usb: { x: 140, y: 30 },
    rails: { x: 150, y: 29 },
    testrow: { x: ROW_X0 + 26, y: ROW_Y },
  },
  keepouts: [
    ...MOUNT_HOLES.map(h => ({ x0: h.x - 3.5, y0: h.y - 3.5, x1: h.x + 3.5, y1: h.y + 3.5, why: "M3 hole" })),
    { ...ISLAND_BOX, why: "BME280 island (parts fixed)" },
    { x0: ROW_X0 - 1.6, y0: ROW_Y - 5.2, x1: ROW_X0 + 2.54 * (TEST_ROW.length - 1) + 1.6, y1: H, why: "probe row + its label band" },
    // channel cells: only the cells' own parts go here (place.ts exempts each cell's group from its own box)
    ...cellBoxes.map((b, k) => ({ ...b, why: `cell ${k}`, cell: CELLS.groups[k] })),
  ],
  cells: CELLS,
};
