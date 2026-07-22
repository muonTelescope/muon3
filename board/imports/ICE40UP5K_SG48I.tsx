import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["VCCIO_2"],
  pin2: ["IOB_6a"],
  pin3: ["IOB_9b"],
  pin4: ["IOB_8a"],
  pin5: ["VCC2"],
  pin6: ["IOB_13b"],
  pin7: ["CDONE"],
  pin8: ["creset_b"],
  pin9: ["IOB_16a"],
  pin10: ["IOB_18a"],
  pin11: ["IOB_20a"],
  pin12: ["IOB_22a"],
  pin13: ["IOB_24a"],
  pin14: ["IOB_32a_SPI_SO"],
  pin15: ["IOB_34a_SPI_SCK"],
  pin16: ["IOB_35b_SPI_SS"],
  pin17: ["IOB_33b_SPI_SI"],
  pin18: ["IOB_31b"],
  pin19: ["IOB_29b"],
  pin20: ["IOB_25b_G3"],
  pin21: ["IOB_23b"],
  pin22: ["SPI_Vccio1"],
  pin23: ["IOT_37a"],
  pin24: ["VPP_2V5"],
  pin25: ["IOT_36b"],
  pin26: ["IOT_39a"],
  pin27: ["IOT_38b"],
  pin28: ["IOT_41a"],
  pin29: ["VCCPLL"],
  pin30: ["VCC1"],
  pin31: ["IOT_42b"],
  pin32: ["IOT_43a"],
  pin33: ["VCCIO_0"],
  pin34: ["IOT_44b"],
  pin35: ["IOT_46b_G0"],
  pin36: ["IOT_48b"],
  pin37: ["IOT_45a_G1"],
  pin38: ["IOT_50b"],
  pin39: ["RGB0"],
  pin40: ["RGB1"],
  pin41: ["RGB2"],
  pin42: ["IOT_51a"],
  pin43: ["IOT_49a"],
  pin44: ["IOB_3b_G6"],
  pin45: ["IOB_5b"],
  pin46: ["IOB_0a"],
  pin47: ["IOB_2a"],
  pin48: ["IOB_4a"],
  pin49: ["EP"]
} as const

const footprinterPinLabels = {
  ...pinLabels,
  "pin49": [...pinLabels["pin49"], "thermalpad"],
} as const

export const ICE40UP5K_SG48I = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={footprinterPinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C2678152"
  ]
}}
      manufacturerPartNumber="ICE40UP5K_SG48I"
      footprint="qfn48_thermalpad5.35mmx5.35mm_p0.5001mm_h7.6798mm_pw0.28mm_pl0.665mm"
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2678152.obj?uuid=400b3786d8594b7eaef5a020de573685",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2678152.step?uuid=400b3786d8594b7eaef5a020de573685",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0.000025400000140507473, y: -0.00010159999987990886, z: -0.85 },
      }}
      {...props}
    />
  )
}