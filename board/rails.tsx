/**
 * Power-rail bulk decoupling reservoirs
 * -------------------------------------
 * Distributed bulk on the rails the placed subsystems actually draw from:
 *   VANA (5 V analog) → 4× OPA858     VDIG (3.3 V) → 8× TLV3601
 *   V12 (12 V PD)     → LT3482 (and, later, TEC/fans)
 * Each rail gets 2× 10 µF bulk + a 100 nF HF cap at the zone-distribution
 * point (DIGITAL zone), complementing the per-IC 0.1 µF at each supply pin.
 *
 * V1V2 (iCE40 core) and the CH224K/regulator input/output caps are placed
 * with those ICs (their exact pins define the net) in the DIGITAL / POWER
 * passes.
 */
const cap = (name: string, value: string, fp: string, x: number, y: number, net: string) => (
  <capacitor name={name} capacitance={value} footprint={fp} pcbX={`${x}mm`} pcbY={`${y}mm`} connections={{ pin1: `net.${net}`, pin2: "net.GND" }} />
)

export const Rails = () => (
  <group name="RAILS" pcbX="0mm" pcbY="0mm">
    {/* 5 V analog reservoir */}
    {cap("C_VANA1", "10uF", "0805", -42, 4, "VANA")}
    {cap("C_VANA2", "10uF", "0805", -38, 4, "VANA")}
    {cap("C_VANA3", "100nF", "0402", -34.5, 4, "VANA")}

    {/* 3.3 V logic reservoir */}
    {cap("C_VDIG1", "10uF", "0805", -42, -1, "VDIG")}
    {cap("C_VDIG2", "10uF", "0805", -38, -1, "VDIG")}
    {cap("C_VDIG3", "100nF", "0402", -34.5, -1, "VDIG")}

    {/* 12 V reservoir (PD → HV/TEC/fans) */}
    {cap("C_V12_1", "22uF", "1206", 14, 2, "V12")}
    {cap("C_V12_2", "10uF", "0805", 18, 2, "V12")}
    {cap("C_V12_3", "100nF", "0402", 21.5, 2, "V12")}
  </group>
)

export default Rails
