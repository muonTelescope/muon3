import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["A1"],
  pin2: ["A2"],
  pin3: ["A3"],
  pin4: ["A4"],
  pin5: ["B1"],
  pin6: ["B2"],
  pin7: ["B3"],
  pin8: ["B4"],
  pin9: ["C1"],
  pin10: ["C2"],
  pin11: ["C3"],
  pin12: ["C4"],
  pin13: ["D1"],
  pin14: ["D2"],
  pin15: ["D3"],
  pin16: ["D4"]
} as const

const footprinterPinLabels = {
  ...pinLabels,
  "pin5": [...pinLabels["pin5"], "pin2"],
  "pin9": [...pinLabels["pin9"], "pin3"],
  "pin13": [...pinLabels["pin13"], "pin4"],
  "pin2": [...pinLabels["pin2"], "pin5"],
  "pin10": [...pinLabels["pin10"], "pin7"],
  "pin14": [...pinLabels["pin14"], "pin8"],
  "pin3": [...pinLabels["pin3"], "pin9"],
  "pin7": [...pinLabels["pin7"], "pin10"],
  "pin15": [...pinLabels["pin15"], "pin12"],
  "pin4": [...pinLabels["pin4"], "pin13"],
  "pin8": [...pinLabels["pin8"], "pin14"],
  "pin12": [...pinLabels["pin12"], "pin15"],
} as const

export const DAC80508ZYZFR = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={footprinterPinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C2679927"
  ]
}}
      manufacturerPartNumber="DAC80508ZYZFR"
      footprint="bga16_p0.5001mm_pad0.24mm"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2679927.obj?uuid=26d2fcbab2f042c99319a28c12dd4888",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2679927.step?uuid=26d2fcbab2f042c99319a28c12dd4888",
        pcbRotationOffset: 90,
        modelOriginPosition: { x: 0, y: 0, z: -0.2 },
      }}
      {...props}
    />
  )
}