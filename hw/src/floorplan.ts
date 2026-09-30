// Human floorplan (96 × 64 mm, 4 layers, Rev C). Fixed: jacks, island, connectors, ESP32, probe row. The four channel
// cells are identical: ch0 is force-placed inside CELLS.box and copied at CELLS.pitch (place.ts), and its local
// copper is routed once and copied (autoroute.ts, copper.ts).
//   y 0–22   : 4 channel cells, 20 mm pitch; U.FL at the top of each (tile coax enters the case above it)
//   y 23–40  : shared bias/threshold/baseline feeds, DACs, charge injection, HV boost (centre-left)
//   left     : BME280 on a slotted island (≥ 20 mm from any TIA input) · STEMMA QT · USB-C
//   right    : ESP32-S3-WROOM-1U (external U.FL antenna outside the case) low on the right + AMS1117
//   y 61.4   : 22-pad probe row, 2.54 mm pitch
import type { Floorplan } from "./place.ts";
import { TEST_ROW } from "./design.ts";

export const W = 96, H = 64;
export const CELLS = { groups: ["ch0", "ch1", "ch2", "ch3"], pitch: 20, box: { x0: 8.5, y0: 0.6, x1: 28.5, y1: 22.4 } };
export const JACK_X = [0, 1, 2, 3].map(k => 18.5 + CELLS.pitch * k);
export const JACK_Y = 3.0;
export const ROW_Y = H - 2.6, ROW_X0 = W / 2 - ((TEST_ROW.length - 1) * 2.54) / 2;
/** BME280 island: slots isolate x 0–8.4, y 25–35.6; it hangs on a 2.6 × 3.6 mm arm (between two slot legs that
 *  run right to armX) plus two 1 mm FR4 edge bridges. No plane copper or plane vias on island + arm. */
export const ISLAND = { x0: 0, y0: 25.0, x1: 8.4, y1: 35.6, neckY0: 28.5, neckY1: 32.3, armX: 11.4, slotW: 1.2 };

const cellBoxes = CELLS.groups.map((_, k) => ({ x0: CELLS.box.x0 + CELLS.pitch * k, y0: CELLS.box.y0, x1: CELLS.box.x1 + CELLS.pitch * k, y1: CELLS.box.y1 }));

export const floorplan: Floorplan = {
  fixed: {
    ...Object.fromEntries(JACK_X.map((x, k) => [`J${2 + k}`, { x, y: JACK_Y, rot: 0 }])), // U.FL, shell pads toward the edge
    J1: { x: 4.7, y: 51.5, rot: 270 },  // USB-C, opening on the left edge
    J6: { x: 3.25, y: 42.0, rot: 90 },  // STEMMA QT (JST-SH: opening on the left edge)
    U1: { x: W - 11.4, y: 45, rot: 270 }, // ESP32-S3-WROOM-1U: its U.FL connector faces the right edge; the antenna is outside the case
    U2: { x: 4.2, y: 28.8, rot: 0 },    // BME280 on its island
    C1: { x: 4.2, y: 32.0, rot: 0 },
    ...Object.fromEntries(TEST_ROW.map((_, k) => [`TP${k + 1}`, { x: ROW_X0 + 2.54 * k, y: ROW_Y, rot: 0 }])),
  },
  groups: {
    ...Object.fromEntries(CELLS.groups.map((g, k) => [g, { x: JACK_X[k], y: 12 }])),
    dac: { x: 48, y: 28 }, inj: { x: 30, y: 26 },
    sensors: { x: 20, y: 44 },
    hv: { x: 36, y: 42 },
    mcu: { x: 62, y: 44 },
    usb: { x: 14, y: 51 },
    rails: { x: 54, y: 52 },
    testrow: { x: W / 2, y: ROW_Y },
  },
  keepouts: [
    { x0: 0, y0: 0, x1: 7, y1: 7, why: "M3 hole" }, { x0: W - 7, y0: 0, x1: W, y1: 7, why: "M3 hole" },
    { x0: 0, y0: H - 7, x1: 7, y1: H, why: "M3 hole" }, { x0: W - 7, y0: H - 7, x1: W, y1: H, why: "M3 hole" },
    { x0: 0, y0: ISLAND.y0 - 1.4, x1: ISLAND.armX + 1.0, y1: ISLAND.y1 + 1.4, why: "BME280 island (parts fixed)" },
    { x0: ROW_X0 - 1.6, y0: ROW_Y - 5.2, x1: ROW_X0 + 2.54 * (TEST_ROW.length - 1) + 1.6, y1: H, why: "probe row + its label band" },
    // channel cells: only the cells' own parts go here (place.ts exempts each cell's group from its own box)
    ...cellBoxes.map((b, k) => ({ ...b, why: `cell ${k}`, cell: CELLS.groups[k] })),
  ],
  cells: CELLS,
};

export const MOUNT_HOLES = [{ x: 3.5, y: 3.5 }, { x: W - 3.5, y: 3.5 }, { x: 3.5, y: H - 3.5 }, { x: W - 3.5, y: H - 3.5 }];
