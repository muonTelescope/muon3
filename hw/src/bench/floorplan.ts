// Bench board floorplan (150 × 70 mm, 4 layers). y = 0 is the SMA edge (board frame: y points down, as in KiCad).
//   y 0–27   : 4 identical channel cells, 34 mm pitch, each with one edge SMA (SiPM in) and U.FL jacks for INJ in, TIA out, CMP out
//   y 30–58  : left edge: STEMMA QT and bias input with its filter; DACs, iCE40, LED pulser and the on-board bias boost in the
//              middle; ESP32-S3 on the right edge (PCB antenna off the edge) with USB-C and the rails under it
//   y 58–70  : 40-loop test row along the far edge, names and group brackets
import type { Floorplan } from "../place.ts";
import { TEST_ROW, CH, smaRef, uflRef, loopRef } from "./design.ts";

export const W = 150, H = 70;
export const CELLS = { groups: CH.map(i => `ch${i}`), pitch: 34, box: { x0: 8.5, y0: 0.6, x1: 40.5, y1: 29.6 } };
/** SiPM SMA x position inside a cell (offset from the cell's x0): 34 mm apart, room for a wrench */
export const SMA_DX = 6;
export const SMA_X = CH.map(i => CELLS.box.x0 + CELLS.pitch * i + SMA_DX);
export const SMA_Y = 2.6; // edge launch: barrel off the y = 0 edge (rot 90), pads end 0.2 mm inside the edge
/** In every cell: U.FL row beside the SMA (INJ, TIA, CMP) and a test-loop row along the inner edge, each with its label below. */
export const UFL_DX = [14, 21.5, 29], UFL_Y = 3.6, LOOP_DX = [4, 10, 16, 22, 28], LOOP_Y = 24.6;
export const ROW_Y = H - 2.4, ROW_PITCH = 2.9, ROW_X0 = 9.5;   // row ends at x ≈ 123: USB-C sits beyond it, under the ESP32
export const MOUNT_HOLES = [{ x: 3.5, y: 3.5 }, { x: W - 3.5, y: 3.5 }, { x: 3.5, y: H - 3.5 }, { x: W - 3.5, y: H - 3.5 }, { x: 75, y: 33.5 }];
export const ESP = { x: W - 16.45, y: 45, rot: 270 };             // antenna end at x = W
export const ANTENNA = { x0: W - 7.4, y0: 33, x1: W, y1: 57 };     // no copper on any layer, no plane

const cellBoxes = CELLS.groups.map((_, k) => ({ x0: CELLS.box.x0 + CELLS.pitch * k, y0: CELLS.box.y0, x1: CELLS.box.x1 + CELLS.pitch * k, y1: CELLS.box.y1 }));

export const floorplan: Floorplan = {
  fixed: {
    ...Object.fromEntries(CH.map(i => [smaRef(i), { x: SMA_X[i], y: SMA_Y, rot: 90 }])),
    J1: { x: 136, y: H - 4.7, rot: 0 },    // USB-C, opening on the far edge, right under the ESP32 (short USB pair)
    J2: { x: 3.25, y: 32, rot: 90 },       // STEMMA QT, opening on the left edge
    J3: { x: 6.5, y: 50, rot: 90 },        // bias input (JST XH, vertical)
    J4: { x: 85, y: 41.5, rot: 270 },      // bias source jumper, pin 1 (EXT) at the top, names on its left, title above
    ...Object.fromEntries(CH.flatMap(i => UFL_DX.map((dx, k) => [uflRef(i, k), { x: CELLS.box.x0 + CELLS.pitch * i + dx, y: UFL_Y, rot: 0 }]))),
    ...Object.fromEntries(CH.flatMap(i => LOOP_DX.map((dx, k) => [loopRef(i, k), { x: CELLS.box.x0 + CELLS.pitch * i + dx, y: LOOP_Y, rot: 90 }]))),
    U1: { ...ESP },
    U2: { x: 70, y: 47, rot: 180 },        // iCE40: pins 1–12 (FX, CDONE, CRESET) face the ESP32
    ...Object.fromEntries(TEST_ROW.map((_, k) => [`TP${k + 1}`, { x: ROW_X0 + ROW_PITCH * k, y: ROW_Y, rot: 90 }])),
  },
  groups: {
    ...Object.fromEntries(CELLS.groups.map((g, k) => [g, { x: CELLS.box.x0 + CELLS.pitch * k + 18, y: 15 }])),
    usb: { x: 128, y: 58 }, rails: { x: 103, y: 55 }, hv: { x: 20, y: 45 },
    dac: { x: 45, y: 36 }, fpga: { x: 66, y: 48 }, led: { x: 56, y: 56 }, inj: { x: 90, y: 32 },
    hvgen: { x: 100, y: 34 }, mcu: { x: 116, y: 45 },
    testrow: { x: W / 2, y: ROW_Y },
  },
  keepouts: [
    ...MOUNT_HOLES.map(h => ({ x0: h.x - 3.5, y0: h.y - 3.5, x1: h.x + 3.5, y1: h.y + 3.5, why: "M3 hole" })),
    { ...ANTENNA, why: "ESP32 antenna", copper: true },
    { x0: ROW_X0 - 1.6, y0: H - 11.6, x1: ROW_X0 + ROW_PITCH * (TEST_ROW.length - 1) + 1.6, y1: H, why: "test row + its label band" },
    ...cellBoxes.map((b, k) => ({ ...b, why: `cell ${k}`, cell: CELLS.groups[k] })),
    // no other part in the cell band: under the frames, between them and beside them
    { x0: 0, y0: CELLS.box.y1, x1: W, y1: CELLS.box.y1 + 1.2, why: "silk gap under the cell frames" },
    ...[0, ...cellBoxes.map(b => b.x1)].map((x0, k) => ({ x0, y0: 0, x1: k < cellBoxes.length ? cellBoxes[k].x0 : W, y1: CELLS.box.y1, why: "beside a cell" })),
  ],
  cells: CELLS,
  orthogonal: true,
};
