/**
 * Muon3 controller — full board-as-code (tscircuit)
 * =================================================
 * Source of truth for the four-channel cosmic-ray telescope controller.
 * Built to JLCPCB fabrication outputs via `bun run fab`.
 *
 * Board target: 160 x 120 mm, 4-layer, JLCPCB Standard PCBA.
 * Detector path: decommissioned sPHENIX HCal tiles -> Hamamatsu S12572-33-015P
 * SiPM, LT3482 ~70 V bias (see pcb/SCHEMATIC_FREEZE_CHECK.md).
 *
 * STATUS: incremental build. This entrypoint currently instantiates the
 * subsystems that are already authored as real board-as-code (real
 * footprints + nets + LCSC part numbers). Remaining subsystems are added
 * module-by-module; the board must stay DRC-clean and fab-buildable at
 * every commit.
 */
import { PowerInput } from "./power"

export const BOARD_W = 160
export const BOARD_H = 120

export default () => (
  <board width={`${BOARD_W}mm`} height={`${BOARD_H}mm`} routingDisabled>
    <PowerInput />
  </board>
)
