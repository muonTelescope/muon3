/**
 * RF / cellular — nRF9151-LACA + U.FL (single shared LTE + GNSS antenna)
 * ---------------------------------------------------------------------
 * nRF9151 placed in the RF zone (left edge) with its supplies, DEC0
 * decoupling, and reset/enable pull-ups; the ANT pin runs to a U.FL
 * edge-launch (direct 50 Ω, no matching, per Nordic) with the antenna
 * keepout. GNDs shown here are the supply/RF grounds; full ground stitch
 * (all GND balls + the flood) is completed at routing (RF trace on L2,
 * GND keepout under it, Nordic reference geometry — decision 10).
 *
 * Deferred: SIM connector + nano-SIM (no JLC part vendored yet), and the
 * signal lines (SWD, I2C, PPS/MAGPIO, COEX).
 */
import { nRF9151_LACA_R7 as NRF9151 } from "./imports/nRF9151_LACA_R7"
import { BWU_FL_IPEX1 } from "./imports/BWU_FL_IPEX1"

const at = (x: number, y: number) => ({ pcbX: `${x}mm`, pcbY: `${y}mm` })
const dc = (name: string, x: number, y: number, net: string, val = "100nF", fp = "0402") => (
  <capacitor name={name} capacitance={val} footprint={fp} {...at(x, y)} connections={{ pin1: `net.${net}`, pin2: "net.GND" }} />
)

export const RfCellular = () => (
  <group name="RF" pcbX="0mm" pcbY="0mm">
    <NRF9151
      name="U_NRF"
      {...at(-64, 30)}
      connections={{
        VDD: "net.VDIG", VIO: "net.VDIG", VDD_GPIO: "net.VDIG", DEC0: "net.NRF_DEC0",
        ANT: "net.RF_ANT", nRESET: "net.NRF_RESET", ENABLE: "net.NRF_EN",
        GND1: "net.GND", GND2: "net.GND", GND3: "net.GND", GND4: "net.GND", GND5: "net.GND",
        GND6: "net.GND", GND7: "net.GND", GND8: "net.GND", GND9: "net.GND", GND10: "net.GND",
        GND11: "net.GND", GND12: "net.GND", GND13: "net.GND", GND14: "net.GND", GND15: "net.GND",
        GND16: "net.GND", GND17: "net.GND", GND18: "net.GND", GND19: "net.GND", GND20: "net.GND",
        GND21: "net.GND", GND22: "net.GND", GND23: "net.GND", GND24: "net.GND", GND25: "net.GND",
        GND26: "net.GND", GND27: "net.GND", GND28: "net.GND", GND29: "net.GND", GND30: "net.GND",
      }}
    />
    {/* Supply decoupling (Nordic: bulk + HF on VDD/VIO, DEC0 cap) */}
    {dc("C_NRF1", -55, 40, "VDIG")} {dc("C_NRF2", -55, 44, "VDIG")}
    {dc("C_NRFB", -55, 36, "VDIG", "4.7uF", "0805")}
    {dc("C_DEC0", -55, 32, "NRF_DEC0", "100nF")}
    <resistor name="R_NRST" resistance="10k" footprint="0402" {...at(-55, 28)} connections={{ pin1: "net.VDIG", pin2: "net.NRF_RESET" }} />
    <resistor name="R_NREN" resistance="100k" footprint="0402" {...at(-55, 24)} connections={{ pin1: "net.VDIG", pin2: "net.NRF_EN" }} />

    {/* U.FL edge-launch: signal = RF_ANT, shell = GND (50 ohm, no matching) */}
    <BWU_FL_IPEX1 name="J_ANT" {...at(-76, 45)} connections={{ pin1: "net.RF_ANT", pin2: "net.GND", pin3: "net.GND" }} />
  </group>
)

export default RfCellular
