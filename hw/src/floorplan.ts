// Human floorplan: edge parts are fixed, everything else gets a group anchor and is placed by force.
//   y 0–5    : 4× edge-launch SMA (tile coax leaves the top edge; shell = HV)
//   y 14–32  : 4 identical analog channels, one behind each jack; DACs between
//   y 30–56  : USB-C + charger (left) · HV bias + FPGA (centre) · ESP32 (right, antenna off the right edge)
//   y 55–61  : per-cell PTC + reverse-insertion LED, above each holder's + contact
//   y 61–149 : 4× 18650 holders
import type { Floorplan } from "./place.ts";

export const W = 100, H = 150;
export const HOLDER_Y = H - 44.9; // holder centre: 1 mm from the bottom edge
export const JACK_X = [16, 38, 62, 84];
export const HOLDER_X = [17.5, 39.15, 60.8, 82.45];

export const floorplan: Floorplan = {
  fixed: {
    // edge-launch SMA straddling the top edge (barrel local +x → −y: rot 90); pads end 0.2 mm from the edge
    J2: { x: JACK_X[0], y: 2.6, rot: 90 }, J3: { x: JACK_X[1], y: 2.6, rot: 90 },
    J4: { x: JACK_X[2], y: 2.6, rot: 90 }, J5: { x: JACK_X[3], y: 2.6, rot: 90 },
    J1: { x: 4.7, y: 42, rot: 270 },   // USB-C, opening on the left edge
    J6: { x: 3.4, y: 56, rot: 270 },   // STEMMA QT
    U1: { x: 83.55, y: 46, rot: 270 }, // ESP32-S3, antenna flush with right edge
    // rot 0: "+" pad (pad 2, LCSC's + mark) at the top, next to its PTC + reverse LED; "−" pad at the bottom into GND
    BT1: { x: HOLDER_X[0], y: HOLDER_Y, rot: 0 }, BT2: { x: HOLDER_X[1], y: HOLDER_Y, rot: 0 },
    BT3: { x: HOLDER_X[2], y: HOLDER_Y, rot: 0 }, BT4: { x: HOLDER_X[3], y: HOLDER_Y, rot: 0 },
  },
  groups: {
    afe0: { x: JACK_X[0], y: 16 }, afe1: { x: JACK_X[1], y: 16 }, afe2: { x: JACK_X[2], y: 16 }, afe3: { x: JACK_X[3], y: 16 },
        jack0: { x: JACK_X[0], y: 10 }, jack1: { x: JACK_X[1], y: 10 }, jack2: { x: JACK_X[2], y: 10 }, jack3: { x: JACK_X[3], y: 10 },
    dac: { x: 50, y: 24 },
    hv: { x: 30, y: 38 },
    fpga: { x: 50, y: 44 },
    mcu: { x: 72, y: 38 },
    usb: { x: 10, y: 42 },
    charger: { x: 16, y: 50 },
    rails: { x: 38, y: 54 },
    sensors: { x: 50, y: 12 }, // BME280 = SiPM/ambient temperature: between the jacks, away from charger/ESP heat
    cells0: { x: HOLDER_X[0], y: HOLDER_Y - 47 }, cells1: { x: HOLDER_X[1], y: HOLDER_Y - 47 }, cells2: { x: HOLDER_X[2], y: HOLDER_Y - 47 }, cells3: { x: HOLDER_X[3], y: HOLDER_Y - 47 },
  },
  keepouts: [
    { x0: 93.6, y0: 34, x1: 100, y1: 58, why: "ESP32 antenna: no copper, no parts" },
    { x0: 0, y0: 0, x1: 7.5, y1: 7.5, why: "M3 hole" }, { x0: 92.5, y0: 0, x1: 100, y1: 7.5, why: "M3 hole" },
  ],
};

export const MOUNT_HOLES = [{ x: 3.75, y: 3.75 }, { x: 96.25, y: 3.75 }, { x: 3.75, y: H - 3.75 }, { x: 96.25, y: H - 3.75 }];
