import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["RT"],
  pin2: ["EN"],
  pin3: ["VIN"],
  pin4: ["GND"],
  pin5: ["SW"],
  pin6: ["BST"],
  pin7: ["SS"],
  pin8: ["FB"]
} as const

const footprinterPinLabels = {
  ...pinLabels,
  "pin5": [...pinLabels["pin5"], "pin1"],
  "pin6": [...pinLabels["pin6"], "pin2"],
  "pin7": [...pinLabels["pin7"], "pin3"],
  "pin8": [...pinLabels["pin8"], "pin4"],
  "pin1": [...pinLabels["pin1"], "pin5"],
  "pin2": [...pinLabels["pin2"], "pin6"],
  "pin3": [...pinLabels["pin3"], "pin7"],
  "pin4": [...pinLabels["pin4"], "pin8"],
} as const

export const TPS62933DRLR = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={footprinterPinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C3200405"
  ]
}}
      manufacturerPartNumber="TPS62933DRLR"
      footprint="dfn_p0.5001mm_w1.9604mm_pw0.28mm_pl0.68mm"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C3200405.obj?uuid=36a9e7915d7846da9e342bb5ad15102b",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C3200405.step?uuid=36a9e7915d7846da9e342bb5ad15102b",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: -0.0022879000000165517, z: -0.135 },
      }}
      {...props}
    />
  )
}