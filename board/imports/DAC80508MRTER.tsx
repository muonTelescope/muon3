import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["REF"],
  pin2: ["OUT0"],
  pin3: ["OUT1"],
  pin4: ["OUT21"],
  pin5: ["OUT22"],
  pin6: ["GND"],
  pin7: ["VDD"],
  pin8: ["OUT4"],
  pin9: ["OUT5"],
  pin10: ["OUT6"],
  pin11: ["OUT7"],
  pin12: ["CS"],
  pin13: ["SCLK"],
  pin14: ["SDI"],
  pin15: ["pin15"],
  pin16: ["VIO"],
  pin17: ["EP"]
} as const

const footprinterPinLabels = {
  ...pinLabels,
  "pin13": [...pinLabels["pin13"], "pin1"],
  "pin14": [...pinLabels["pin14"], "pin2"],
  "pin15": [...pinLabels["pin15"], "pin3"],
  "pin16": [...pinLabels["pin16"], "pin4"],
  "pin1": [...pinLabels["pin1"], "pin5"],
  "pin2": [...pinLabels["pin2"], "pin6"],
  "pin3": [...pinLabels["pin3"], "pin7"],
  "pin4": [...pinLabels["pin4"], "pin8"],
  "pin5": [...pinLabels["pin5"], "pin9"],
  "pin6": [...pinLabels["pin6"], "pin10"],
  "pin7": [...pinLabels["pin7"], "pin11"],
  "pin8": [...pinLabels["pin8"], "pin12"],
  "pin9": [...pinLabels["pin9"], "pin13"],
  "pin10": [...pinLabels["pin10"], "pin14"],
  "pin11": [...pinLabels["pin11"], "pin15"],
  "pin12": [...pinLabels["pin12"], "pin16"],
  "pin17": [...pinLabels["pin17"], "thermalpad"],
} as const

export const DAC80508MRTER = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={footprinterPinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C2679529"
  ]
}}
      manufacturerPartNumber="DAC80508MRTER"
      footprint="qfn16_thermalpad0.8mmx0.8mm_p0.5001mm_h3.6798mm_pw0.28mm_pl0.665mm"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2679529.obj?uuid=4b7a735f4494446ba820363f99a60d50",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2679529.step?uuid=4b7a735f4494446ba820363f99a60d50",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0, z: -0.01 },
      }}
      {...props}
    />
  )
}