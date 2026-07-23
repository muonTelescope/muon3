/**
 * Debug / test-access bay
 * -----------------------
 * NB: this file is `debugbay.tsx`, NOT `debug.tsx`, on purpose. The browser
 * evaluator behind `tsci dev` (@tscircuit/eval) collides a relative import of
 * `./debug` with the ubiquitous `debug` npm package, so `import { Debug } from
 * "./debug"` resolves to `undefined` and the whole board fails to render with
 * "Element type is invalid … got undefined" — even though `tsci build` (real
 * bun path resolution) is fine. Keep the name off `debug`.
 *
 * Occupies the free pocket between DIGITAL (x <= 26) and HV (x >= 57), below
 * the AFE strips (y <= ~9). Everything a bring-up needs in one accessible
 * cluster:
 *
 *   - Labeled surface test points on every power rail + the key signal buses
 *     and the *safe* HV monitor divider (never raw 70 V — that stays on HV).
 *   - SWD headers for the RP2040 and the nRF9151, and an iCE40 SPI-config
 *     header (also the RP2040's config path, so the FPGA is loadable two ways).
 *   - Boot / reset / FPGA-reset buttons.
 *   - Power-good + heartbeat status LEDs.
 *
 * No tap sits on a hot analog node (TIA summing node, comparator input): the
 * per-channel TIA-output probes live next to their channel (afe.tsx TP_AO).
 * Test points are 1.2 mm circular pads; add a silk label at layout time.
 */
const at = (x: number, y: number) => ({ pcbX: `${x}mm`, pcbY: `${y}mm` })

const TP = (name: string, x: number, y: number, net: string) => (
  <testpoint name={name} {...at(x, y)} footprintVariant="pad" padShape="circle" padDiameter="1.2mm" connections={{ pin1: net }} />
)

export const Debug = () => (
  <group name="DBG" pcbX="0mm" pcbY="0mm">
    {/* ---- Power-rail test points (left column) ---- */}
    {TP("TP_VANA", 29, 6, "net.VANA")}
    {TP("TP_VDIG", 29, 3, "net.VDIG")}
    {TP("TP_V12", 29, 0, "net.V12")}
    {TP("TP_VCORE", 29, -3, "net.VCORE")}
    {TP("TP_V1V2", 29, -6, "net.V1V2")}
    {TP("TP_GND1", 29, -9, "net.GND")}
    {TP("TP_GND2", 29, -12, "net.GND")}

    {/* ---- Signal-bus test points (second column) ---- */}
    {TP("TP_HVMON", 33, 6, "net.HV_MON")}
    {TP("TP_SCLK", 33, 3, "net.SPI_SCLK")}
    {TP("TP_MOSI", 33, 0, "net.SPI_MOSI")}
    {TP("TP_MISO", 33, -3, "net.SPI_MISO")}
    {TP("TP_SDA", 33, -6, "net.I2C_SDA")}
    {TP("TP_SCL", 33, -9, "net.I2C_SCL")}
    {TP("TP_PPS", 33, -12, "net.PPS")}

    {/* ---- Status LEDs (3V3 present + RP2040 heartbeat) ---- */}
    <resistor name="R_LPWR" resistance="1k" footprint="0402" {...at(29, -16)} connections={{ pin1: "net.VDIG", pin2: "net.LED_PWR_A" }} />
    <led name="D_PWR" footprint="0603" {...at(31.5, -16)} connections={{ anode: "net.LED_PWR_A", cathode: "net.GND" }} />
    <resistor name="R_LHB" resistance="330" footprint="0402" {...at(36, -16)} connections={{ pin1: "net.RP_LED", pin2: "net.LED_HB_A" }} />
    <led name="D_HB" footprint="0603" {...at(38.5, -16)} connections={{ anode: "net.LED_HB_A", cathode: "net.GND" }} />

    {/* ---- Buttons: RP2040 reset + BOOTSEL (iCE40 CRESET reachable via J_CFG
           pin6 and RP2040 GPIO14, so no dedicated FPGA-reset button) ---- */}
    <pushbutton name="SW_RUN" footprint="pushbutton" {...at(29, -24)} connections={{ pin1: "net.RP_RUN", pin2: "net.GND" }} />
    <pushbutton name="SW_BOOT" footprint="pushbutton" {...at(38, -24)} connections={{ pin1: "net.FLASH_CS", pin2: "net.GND" }} />

    {/* ---- Programming / debug headers (right column, vertical) ---- */}
    {/* RP2040 SWD: SWCLK, SWDIO, GND, RESET(RUN) */}
    <pinheader name="J_SWD_RP" pinCount={4} gender="male" pcbOrientation="vertical" {...at(48, 6)}
      connections={{ pin1: "net.RP_SWCLK", pin2: "net.RP_SWD", pin3: "net.GND", pin4: "net.RP_RUN" }} />
    {/* nRF9151 SWD: SWDCLK, SWDIO, GND, nRESET */}
    <pinheader name="J_SWD_NRF" pinCount={4} gender="male" pcbOrientation="vertical" {...at(48, -6.5)}
      connections={{ pin1: "net.NRF_SWDCLK", pin2: "net.NRF_SWDIO", pin3: "net.GND", pin4: "net.NRF_RESET" }} />
    {/* RP2040 stdio UART: 3V3, TX, RX, GND */}
    <pinheader name="J_UART" pinCount={4} gender="male" pcbOrientation="vertical" {...at(48, -19)}
      connections={{ pin1: "net.VDIG", pin2: "net.UART_TX", pin3: "net.UART_RX", pin4: "net.GND" }} />
    {/* iCE40 SPI config: 3V3, SCK, SI, SO, SS, CRESET, CDONE, GND */}
    <pinheader name="J_CFG" pinCount={8} doubleRow gender="male" pcbOrientation="vertical" {...at(53, -1)}
      connections={{ pin1: "net.VDIG", pin2: "net.ICE_SCK", pin3: "net.ICE_SI", pin4: "net.ICE_SO", pin5: "net.ICE_SS", pin6: "net.ICE_CRESET", pin7: "net.ICE_CDONE", pin8: "net.GND" }} />
  </group>
)

export default Debug
