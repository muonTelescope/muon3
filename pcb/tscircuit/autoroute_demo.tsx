/**
 * Small Muon3-flavoured demo board with real nets so the capacity autorouter
 * has something to solve. Not the full station — use this to exercise
 * tscircuit autorouting and the KiCad export path.
 *
 *   bun run autoroute
 */
import { Circuit } from "@tscircuit/core"

/** 4-layer-ish envelope; autorouter uses top/bottom by default. */
export const DEMO_W = 40
export const DEMO_H = 30

/**
 * Build a minimal AFE-style chain: panel connector → TIA → comparator,
 * with shared 3V3/GND so the capacity autorouter places traces.
 */
export function buildAutorouteDemoCircuit(): Circuit {
  const circuit = new Circuit()

  // JSX board with autorouter enabled (capacity pipeline inside @tscircuit/core)
  circuit.add(
    <board
      width={`${DEMO_W}mm`}
      height={`${DEMO_H}mm`}
      title="Muon3 autoroute demo"
      autorouter="auto"
    >
      {/* Panel hybrid connector stub */}
      <chip
        name="J1"
        footprint="pinrow4"
        pcbX="-14mm"
        pcbY="8mm"
        pinLabels={{ pin1: "SIG", pin2: "BIAS", pin3: "GND", pin4: "NTC" }}
      />

      {/* OPA858-class TIA (dfn8 proxy) */}
      <chip
        name="U1"
        footprint="dfn8"
        pcbX="0mm"
        pcbY="6mm"
        pinLabels={{
          pin1: "IN",
          pin2: "FB",
          pin3: "GND",
          pin4: "OUT",
          pin5: "VCC",
          pin6: "NC1",
          pin7: "NC2",
          pin8: "NC3",
        }}
      />

      {/* Dual threshold comparator (sot23_5 proxy) */}
      <chip
        name="U2"
        footprint="sot23_5"
        pcbX="12mm"
        pcbY="6mm"
        pinLabels={{
          pin1: "IN",
          pin2: "GND",
          pin3: "OUT",
          pin4: "VCC",
          pin5: "REF",
        }}
      />

      {/* Feedback + load + rail caps */}
      <resistor
        name="Rf"
        resistance="4.99k"
        footprint="0402"
        pcbX="-4mm"
        pcbY="0mm"
      />
      <capacitor
        name="Cf"
        capacitance="1pF"
        footprint="0402"
        pcbX="-4mm"
        pcbY="-4mm"
      />
      <capacitor
        name="Cdec"
        capacitance="100nF"
        footprint="0402"
        pcbX="4mm"
        pcbY="-4mm"
      />
      <resistor
        name="Rterm"
        resistance="49.9"
        footprint="0402"
        pcbX="12mm"
        pcbY="-2mm"
      />

      {/* Signal path: panel → TIA in → FB network → TIA out → comparator */}
      <trace from=".J1 > .pin1" to=".U1 > .pin1" />
      <trace from=".U1 > .pin1" to=".Rf > .pin1" />
      <trace from=".Rf > .pin2" to=".U1 > .pin4" />
      <trace from=".U1 > .pin1" to=".Cf > .pin1" />
      <trace from=".Cf > .pin2" to=".U1 > .pin4" />
      <trace from=".U1 > .pin4" to=".U2 > .pin1" />
      <trace from=".U2 > .pin3" to=".Rterm > .pin1" />

      {/* Power / ground (net names must not start with a digit) */}
      <trace from=".U1 > .pin5" to="net.VCC_3V3" />
      <trace from=".U2 > .pin4" to="net.VCC_3V3" />
      <trace from=".Cdec > .pin1" to="net.VCC_3V3" />
      <trace from=".U1 > .pin3" to="net.GND" />
      <trace from=".U2 > .pin2" to="net.GND" />
      <trace from=".J1 > .pin3" to="net.GND" />
      <trace from=".Cdec > .pin2" to="net.GND" />
      <trace from=".Rterm > .pin2" to="net.GND" />
    </board>,
  )

  return circuit
}

export default buildAutorouteDemoCircuit
