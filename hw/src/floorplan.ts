// Human floorplan (84 × 50 mm, 4 layers): edge parts are fixed, everything else gets a group anchor and is placed by force.
//   y 0–5    : 4× edge-launch SMA (tile coax leaves the top edge; shell = HV)
//   y 5–22   : 4 identical analog channels under their jacks; DACs + BME280 between them (coolest spot)
//   y 22–50  : USB-C + 3V3 regulators (left, warm) · HV bias (centre-left) · ESP32 (right, antenna off the right edge)
import type { Floorplan } from "./place.ts";

export const W = 84, H = 50;
export const JACK_X = [13, 31, 51, 69];

export const floorplan: Floorplan = {
  fixed: {
    // edge-launch SMA straddling the top edge (barrel local +x → −y: rot 90); pads end 0.2 mm from the edge
    J2: { x: JACK_X[0], y: 2.6, rot: 90 }, J3: { x: JACK_X[1], y: 2.6, rot: 90 },
    J4: { x: JACK_X[2], y: 2.6, rot: 90 }, J5: { x: JACK_X[3], y: 2.6, rot: 90 },
    J1: { x: 4.7, y: 36, rot: 270 },    // USB-C, opening on the left edge
    J6: { x: 3.25, y: 24, rot: 90 },     // STEMMA QT (JST-SH: signal pins on the plug side → opening on the left edge)
    U1: { x: W - 16.45, y: 33, rot: 270 }, // ESP32-S3, antenna flush with right edge
  },
  groups: {
    afe0: { x: JACK_X[0], y: 14 }, afe1: { x: JACK_X[1], y: 14 }, afe2: { x: JACK_X[2], y: 14 }, afe3: { x: JACK_X[3], y: 14 },
    jack0: { x: JACK_X[0], y: 8 }, jack1: { x: JACK_X[1], y: 8 }, jack2: { x: JACK_X[2], y: 8 }, jack3: { x: JACK_X[3], y: 8 },
    dac: { x: 41, y: 21 },
    sensors: { x: 41, y: 8 }, // BME280 = SiPM/ambient temperature: between the jacks, away from regulator/ESP heat
    hv: { x: 28, y: 32 },
    mcu: { x: 52, y: 34 },
    usb: { x: 11, y: 36 },
    rails: { x: 18, y: 45 },
  },
  keepouts: [
    { x0: W - 6.4, y0: 22, x1: W, y1: 44, why: "ESP32 antenna: no copper, no parts" },
    { x0: 0, y0: 0, x1: 7, y1: 7, why: "M3 hole" }, { x0: W - 7, y0: 0, x1: W, y1: 7, why: "M3 hole" },
    { x0: 0, y0: H - 7, x1: 7, y1: H, why: "M3 hole" }, { x0: W - 7, y0: H - 7, x1: W, y1: H, why: "M3 hole" },
  ],
};

export const MOUNT_HOLES = [{ x: 3.5, y: 3.5 }, { x: W - 3.5, y: 3.5 }, { x: 3.5, y: H - 3.5 }, { x: W - 3.5, y: H - 3.5 }];
