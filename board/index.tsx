/**
 * Muon3 controller — full board-as-code (tscircuit)
 * =================================================
 * Source of truth for the four-channel cosmic-ray telescope controller.
 * Built to JLCPCB fabrication outputs via `bun run fab`.
 *
 * 160 x 120 mm, 4-layer, JLCPCB Standard PCBA. Detector: decommissioned
 * sPHENIX HCal tiles -> Hamamatsu S12572-33-015P SiPM, LT3482 ~70 V bias.
 *
 * Floorplan (board/layout.ts, rationale in board/LAYOUT.md): quiet upper
 * half (RF | AFE x4 | HV) over a noisy lower half (USB-C PD | TEC), split
 * so AFE summing nodes stay >= 25 mm from PD/TEC switching, over a
 * continuous L2 ground plane. Panel connectors on the top edge.
 *
 * STATUS: floorplan + AFE x4 + power seed + HV anchor placed. Digital,
 * TEC, DAC/ADC, and the LT3482 boost network are added incrementally,
 * each DRC-clean and fab-buildable.
 */
import { BOARD_W, BOARD_H, LAYERS, AFE_CY, AFE_CHANNEL_X } from "./layout"
import { Floorplan } from "./floorplan"
import { PowerInput } from "./power"
import { AfeChannel } from "./afe"
import { HvBias } from "./hv"
import { Rails } from "./rails"
import { Digital } from "./digital"
import { TecDrivers } from "./tec"

export { BOARD_W, BOARD_H }

export default () => (
  <board width={`${BOARD_W}mm`} height={`${BOARD_H}mm`} layers={LAYERS} routingDisabled>
    <Floorplan />

    {/* AFE x4 — vertical strips tiled across the AFE zone */}
    {AFE_CHANNEL_X.map((x, i) => (
      <AfeChannel key={i} index={i} x={x} cy={AFE_CY} />
    ))}

    {/* Digital core (iCE40 + RP2040 + flash + ADC + DAC + BME280) */}
    <Digital />

    {/* Power-rail bulk reservoirs (DIGITAL zone distribution point) */}
    <Rails />

    {/* USB-C PD input seed (POWER zone, bottom-left) */}
    <PowerInput />

    {/* TEC drivers + fan switches (TEC zone, bottom-right) */}
    <TecDrivers />

    {/* HV bias anchor (HV zone, right edge) */}
    <HvBias x={66} y={32} />
  </board>
)
