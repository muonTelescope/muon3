/**
 * HCal-tile workstation — optimal placement & shielding sketch (tscircuit)
 *
 * Encodes DESIGN_RULES.md + openEMS RF notes + AFE/HV isolation for a
 * four-channel station reading decommissioned sPHENIX Inner HCal tiles
 * (Hamamatsu S12572-33-015P, LT3482 ~70 V bias).
 *
 * Coordinate system: board center (0,0), mm. Top view, top copper.
 * Board outline: 160 mm × 120 mm (JLCPCB Standard 4-layer target).
 *
 * Zone map (left → right):
 *   RF | DIGITAL | AFE×4 | HV | POWER/USB | TEC
 */
import {
  Circuit,
  Board,
  Chip,
  Keepout,
  SilkscreenRect,
  SilkscreenText,
  Hole,
  PcbNoteRect,
  PcbNoteText,
} from "@tscircuit/core"

/** Board outline */
export const BOARD_W = 160
export const BOARD_H = 120

type Zone = {
  name: string
  label: string
  cx: number
  cy: number
  w: number
  h: number
  /** optional shield can / fence note */
  shield?: string
}

/**
 * Optimal zone placement derived from project notes:
 * - RF edge for antenna cables / Nordic keepout
 * - AFE isolated from switching (PD, TEC, HV boost)
 * - Continuous ground (no split planes) — zones are placement regions only
 * - One hybrid panel connector per channel along AFE edge
 */
export const ZONES: Zone[] = [
  {
    name: "RF",
    label: "RF / nRF9151",
    cx: -65,
    cy: 35,
    w: 28,
    h: 42,
    shield: "RF shield can optional; antenna keepout 15 mm",
  },
  {
    name: "DIGITAL",
    label: "DIGITAL\niCE40+RP2040",
    cx: -32,
    cy: 20,
    w: 36,
    h: 55,
  },
  {
    name: "AFE",
    label: "AFE CH0–CH3\nOPA858+TLV3601",
    cx: 18,
    cy: 15,
    w: 55,
    h: 70,
    shield: "AFE shield fence / can over TIA banks",
  },
  {
    name: "HV",
    label: "HV LT3482\n~70 V S12572",
    cx: 58,
    cy: 30,
    w: 28,
    h: 40,
    shield: "HV keepout; no pour under boost SW node",
  },
  {
    name: "POWER",
    label: "POWER / USB-PD",
    cx: -45,
    cy: -40,
    w: 55,
    h: 32,
  },
  {
    name: "TEC",
    label: "TEC DRV8873×4",
    cx: 40,
    cy: -40,
    w: 60,
    h: 32,
    shield: "Switching zone; short loops; far from AFE",
  },
]

/** TIA summing-node keepouts (no copper pour) — one per channel */
export const TIA_KEEPOUTS = [
  { name: "CH0", x: -2, y: 35 },
  { name: "CH1", x: 12, y: 35 },
  { name: "CH2", x: 26, y: 35 },
  { name: "CH3", x: 40, y: 35 },
]

function zoneRect(z: Zone) {
  return {
    pcbX: `${z.cx}mm`,
    pcbY: `${z.cy}mm`,
    width: `${z.w}mm`,
    height: `${z.h}mm`,
  }
}

export function buildHcalPlacementCircuit(): Circuit {
  const circuit = new Circuit()
  const board = new Board({
    width: `${BOARD_W}mm`,
    height: `${BOARD_H}mm`,
    title: "HCal-tile workstation placement & shielding",
  })
  circuit.add(board)

  // --- Zone silkscreen fences ---
  for (const z of ZONES) {
    board.add(
      new SilkscreenRect({
        ...zoneRect(z),
        strokeWidth: "0.2mm",
      }),
    )
    board.add(
      new SilkscreenText({
        text: z.label.replace(/\n/g, " "),
        pcbX: `${z.cx}mm`,
        pcbY: `${z.cy + z.h / 2 - 3}mm`,
        fontSize: "1.6mm",
        anchorAlignment: "center",
      }),
    )
    if (z.shield) {
      board.add(
        new PcbNoteText({
          text: z.shield,
          pcbX: `${z.cx}mm`,
          pcbY: `${z.cy - z.h / 2 + 2.5}mm`,
          fontSize: "1.1mm",
          anchorAlignment: "center",
        }),
      )
    }
  }

  // --- Major ICs (placement anchors) ---
  board.add(
    new Chip({
      name: "U_NRF9151",
      footprint: "qfn64", // LGA113 proxy for placement envelope
      pcbX: "-65mm",
      pcbY: "38mm",
      pcbRotation: "0deg",
    }),
  )
  board.add(
    new Chip({
      name: "U_ICE40",
      footprint: "qfn48",
      pcbX: "-38mm",
      pcbY: "30mm",
    }),
  )
  board.add(
    new Chip({
      name: "U_RP2040",
      footprint: "qfn56",
      pcbX: "-28mm",
      pcbY: "5mm",
    }),
  )

  // 4× AFE TIA
  for (let i = 0; i < 4; i++) {
    const x = -2 + i * 14
    board.add(
      new Chip({
        name: `U_TIA${i}`,
        footprint: "dfn8",
        pcbX: `${x}mm`,
        pcbY: "28mm",
      }),
    )
    board.add(
      new Chip({
        name: `U_CMPL${i}`,
        footprint: "sot23_5",
        pcbX: `${x - 3}mm`,
        pcbY: "12mm",
      }),
    )
    board.add(
      new Chip({
        name: `U_CMPH${i}`,
        footprint: "sot23_5",
        pcbX: `${x + 3}mm`,
        pcbY: "12mm",
      }),
    )
  }

  // HV LT3482
  board.add(
    new Chip({
      name: "U_LT3482",
      footprint: "qfn16",
      pcbX: "58mm",
      pcbY: "32mm",
    }),
  )

  // Power
  board.add(
    new Chip({
      name: "U_PD",
      footprint: "qfn24",
      pcbX: "-55mm",
      pcbY: "-40mm",
    }),
  )
  board.add(
    new Chip({
      name: "U_BUCK33",
      footprint: "soic8",
      pcbX: "-35mm",
      pcbY: "-40mm",
    }),
  )

  // TEC drivers
  for (let i = 0; i < 4; i++) {
    board.add(
      new Chip({
        name: `U_TEC${i}`,
        footprint: "tssop24",
        pcbX: `${20 + i * 14}mm`,
        pcbY: "-40mm",
      }),
    )
  }

  // Panel connectors along top of AFE zone (cable side)
  for (let i = 0; i < 4; i++) {
    const x = -2 + i * 14
    board.add(
      new Chip({
        name: `J_PANEL${i}`,
        footprint: "pinrow6",
        pcbX: `${x}mm`,
        pcbY: "52mm",
      }),
    )
  }

  // U.FL LTE / GNSS at RF edge
  board.add(
    new Chip({
      name: "J_UFL_LTE",
      footprint: "pushbutton", // small pad proxy for U.FL envelope
      pcbX: "-72mm",
      pcbY: "50mm",
    }),
  )
  board.add(
    new Chip({
      name: "J_UFL_GNSS",
      footprint: "pushbutton",
      pcbX: "-72mm",
      pcbY: "40mm",
    }),
  )

  // USB-C
  board.add(
    new Chip({
      name: "J_USBC",
      footprint: "usb_c",
      pcbX: "-65mm",
      pcbY: "-52mm",
    }),
  )

  // --- Keepouts ---
  // RF antenna keepout (circle ~15 mm clearance from U.FL)
  board.add(
    new Keepout({
      shape: "circle",
      pcbX: "-72mm",
      pcbY: "50mm",
      radius: "15mm",
      layers: ["top", "bottom"],
    }),
  )
  board.add(
    new SilkscreenText({
      text: "ANT KEEPOUT 15mm",
      pcbX: "-72mm",
      pcbY: "58mm",
      fontSize: "1.2mm",
    }),
  )

  // TIA summing-node no-pour keepouts (rect ~6×6 mm)
  for (const k of TIA_KEEPOUTS) {
    board.add(
      new Keepout({
        shape: "rect",
        pcbX: `${k.x}mm`,
        pcbY: `${k.y}mm`,
        width: "6mm",
        height: "6mm",
        layers: ["top", "inner1"],
      }),
    )
    board.add(
      new SilkscreenText({
        text: `TIA ${k.name} NO POUR`,
        pcbX: `${k.x}mm`,
        pcbY: `${k.y + 5}mm`,
        fontSize: "0.9mm",
      }),
    )
  }

  // HV boost switch-node keepout
  board.add(
    new Keepout({
      shape: "rect",
      pcbX: "58mm",
      pcbY: "38mm",
      width: "12mm",
      height: "10mm",
      layers: ["top", "bottom"],
    }),
  )
  board.add(
    new SilkscreenText({
      text: "HV SW NODE KEEPOUT",
      pcbX: "58mm",
      pcbY: "45mm",
      fontSize: "1.1mm",
    }),
  )

  // AFE shield can outline (fabrication note)
  board.add(
    new PcbNoteRect({
      pcbX: "18mm",
      pcbY: "18mm",
      width: "52mm",
      height: "48mm",
      strokeWidth: "0.25mm",
    }),
  )
  board.add(
    new PcbNoteText({
      text: "AFE SHIELD CAN / FENCE (GND stitch 1 mm)",
      pcbX: "18mm",
      pcbY: "42mm",
      fontSize: "1.3mm",
    }),
  )

  // RF shield can note
  board.add(
    new PcbNoteRect({
      pcbX: "-65mm",
      pcbY: "32mm",
      width: "24mm",
      height: "28mm",
      strokeWidth: "0.25mm",
    }),
  )
  board.add(
    new PcbNoteText({
      text: "RF SHIELD (opt.) nRF9151",
      pcbX: "-65mm",
      pcbY: "48mm",
      fontSize: "1.2mm",
    }),
  )

  // Separation note: AFE vs TEC
  board.add(
    new PcbNoteText({
      text: "KEEP AFE ↔ TEC / PD SWITCHING ≥ 25 mm; continuous GND plane (no split)",
      pcbX: "0mm",
      pcbY: "-58mm",
      fontSize: "1.4mm",
    }),
  )

  // Mounting holes
  for (const [x, y] of [
    [-75, 55],
    [75, 55],
    [-75, -55],
    [75, -55],
  ] as const) {
    board.add(
      new Hole({
        pcbX: `${x}mm`,
        pcbY: `${y}mm`,
        diameter: "3.2mm",
      }),
    )
  }

  // Title block
  board.add(
    new SilkscreenText({
      text: "HCAL-TILE WORKSTATION 160x120  |  S12572 + LT3482  |  tscircuit placement",
      pcbX: "0mm",
      pcbY: "58mm",
      fontSize: "1.8mm",
    }),
  )

  return circuit
}

export default buildHcalPlacementCircuit
