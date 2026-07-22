/**
 * layout.ts — Muon3 controller floorplan (single source of truth)
 * ===============================================================
 * 160 x 120 mm, 4-layer JLCPCB Standard. Origin = board center, +y up,
 * top view / top copper. Derived from pcb/SCHEMATIC_FREEZE_CHECK.md and
 * pcb/DESIGN_RULES.md. Rationale in board/LAYOUT.md.
 *
 * Floorplan principle: split the board into a QUIET upper half (RF, AFE,
 * HV, digital) and a NOISY/high-current lower half (USB-C PD + rails,
 * TEC drivers + fans). The L2 ground plane is continuous under both; the
 * physical top/bottom split keeps AFE summing nodes >= 25 mm from PD/TEC
 * switching (DESIGN_RULES). Panel connectors sit on the top edge so the
 * 50 cm hybrid cables exit cleanly and the SiPM signal path to each TIA
 * is short.
 */

export const BOARD_W = 160
export const BOARD_H = 120
export const LAYERS = 4

/** 4-layer stackup (JLCPCB 1oz outer / 0.5oz inner). */
export const STACKUP = [
  { layer: "L1 (top)", use: "components + AFE/RF signal, short high-speed" },
  { layer: "L2 (inner)", use: "CONTINUOUS ground plane (no splits) — return path + shield" },
  { layer: "L3 (inner)", use: "power pours: 12V, 5V_A, 3V3, 1V2; slow signal" },
  { layer: "L4 (bottom)", use: "components + TEC power, connectors, secondary routing" },
] as const

export type Zone = {
  name: string
  label: string
  cx: number
  cy: number
  w: number
  h: number
  shield?: string
}

/** Placement regions (silkscreen fences only — continuous GND, no plane splits). */
export const ZONES: Zone[] = [
  { name: "RF", label: "RF nRF9151 + GNSS", cx: -66, cy: 33, w: 24, h: 46, shield: "antenna keepout 12 mm; Nordic ref geometry" },
  { name: "AFE", label: "AFE x4  S12572", cx: 8, cy: 34, w: 92, h: 48, shield: "AFE shield fence over TIA banks; GND stitch 1 mm" },
  { name: "HV", label: "HV LT3482 ~70V", cx: 67, cy: 30, w: 20, h: 40, shield: "no pour under SW node; 0.6 mm creepage @70V" },
  { name: "DIGITAL", label: "DIGITAL iCE40+RP2040+DAC/ADC", cx: -22, cy: -6, w: 96, h: 28 },
  { name: "POWER", label: "POWER USB-C PD + rails", cx: -50, cy: -42, w: 56, h: 28 },
  { name: "TEC", label: "TEC DRV8873x4 + fans", cx: 40, cy: -42, w: 74, h: 28, shield: "switching zone; short loops; keep >=25 mm from AFE" },
]

/** AFE channel anchor positions (4 vertical strips across the AFE zone). */
export const AFE_CY = 34
export const AFE_CHANNEL_X = [-30, -7, 16, 39]

/** Antenna (U.FL) at the RF board edge, with a keepout radius. */
export const ANTENNA = { x: -78, y: 40, keepoutR: 12 }

/** Mounting holes (M3) at the four corners. */
export const HOLES = [
  { x: -74, y: 53 },
  { x: 74, y: 53 },
  { x: -74, y: -53 },
  { x: 74, y: -53 },
] as const

/**
 * Net-class trace widths (mm) for a JLCPCB 4-layer, 1oz outer / 0.5oz inner
 * board. Currents from the power budget (sim/python/power_budget.py) and the
 * freeze decisions (TEC ITRIP <= 2.5 A/ch, 12 V PD rail).
 */
export const TRACE_WIDTHS = {
  GND: "plane (L2)",
  V12_MAIN: "1.5 mm / L3 pour  (~8-10 A aggregate: 4x TEC + fans)",
  V12_TEC_CH: "0.8 mm  (per-channel 12 V feed, ~2.5 A)",
  TEC_OUT: "0.8 mm  (H-bridge out to panel, 2.5 A)",
  V5_ANALOG: "0.4 mm  (star from LDO to each OPA858)",
  V3V3: "0.5 mm / L3 pour",
  V1V2: "0.4 mm  (iCE40 core)",
  HV_70V: "0.25 mm trace, >=0.6 mm clearance/creepage",
  AFE_SIG: "0.20 mm, guarded, short; no pour on summing node",
  RF_50R: "~0.30 mm 50 ohm CPW/microstrip, L2 reference, no gaps",
  I2C_SPI: "0.15 mm (6 mil) default signal",
} as const
