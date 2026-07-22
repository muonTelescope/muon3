import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["NC"],
  pin2: ["APD"],
  pin3: ["MONIN"],
  pin4: ["VOUT2"],
  pin5: ["VOUT1"],
  pin6: ["PUMP"],
  pin7: ["SW1"],
  pin8: ["SW2"],
  pin9: ["GND1"],
  pin10: ["GND2"],
  pin11: ["VIN"],
  pin12: ["#SHDN"],
  pin13: ["CTRL"],
  pin14: ["FB"],
  pin15: ["FSET"],
  pin16: ["MON"],
  pin17: ["EP"]
} as const

export const LT3482EUD_TRPBF = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C515895"
  ]
}}
      manufacturerPartNumber="LT3482EUD_TRPBF"
      footprint={<footprint>
        <smtpad portHints={["pin1"]} pcbX="-0.750189mm" pcbY="-1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin2"]} pcbX="-0.250063mm" pcbY="-1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin3"]} pcbX="0.249809mm" pcbY="-1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin4"]} pcbX="0.749935mm" pcbY="-1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin5"]} pcbX="1.499997mm" pcbY="-0.749935mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin6"]} pcbX="1.499997mm" pcbY="-0.250063mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin7"]} pcbX="1.499997mm" pcbY="0.250063mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin8"]} pcbX="1.499997mm" pcbY="0.749935mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin9"]} pcbX="0.749935mm" pcbY="1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin10"]} pcbX="0.249809mm" pcbY="1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin11"]} pcbX="-0.250063mm" pcbY="1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin12"]} pcbX="-0.750189mm" pcbY="1.499997mm" width="0.2800096mm" height="0.7999984mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin13"]} pcbX="-1.499997mm" pcbY="0.750697mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin14"]} pcbX="-1.499997mm" pcbY="0.250571mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin15"]} pcbX="-1.499997mm" pcbY="-0.249301mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin16"]} pcbX="-1.499997mm" pcbY="-0.749427mm" width="0.7999984mm" height="0.2800096mm" radius="0.1400048mm" shape="pill" />
<smtpad portHints={["pin17"]} pcbX="-0.000127mm" pcbY="0.000127mm" width="1.499997mm" height="1.499997mm" shape="rect" />
<silkscreenpath route={[{"x":-1.121333799999988,"y":-1.4994128000000018},{"x":-1.5001239999999854,"y":-1.4994128000000018},{"x":-1.5001239999999854,"y":-1.1206225999999972}]} />
<silkscreenpath route={[{"x":-1.5001239999999854,"y":1.5005812000000134},{"x":-1.121333799999988,"y":1.5005812000000134}]} />
<silkscreenpath route={[{"x":1.121079800000004,"y":1.5005812000000134},{"x":1.4998700000000156,"y":1.5005812000000134},{"x":1.4998700000000156,"y":1.1217910000000018}]} />
<silkscreenpath route={[{"x":1.4998700000000156,"y":-1.1206225999999972},{"x":1.4998700000000156,"y":-1.4994128000000018},{"x":1.121079800000004,"y":-1.4994128000000018}]} />
<silkscreenpath route={[{"x":-1.5001239999999854,"y":1.1217910000000018},{"x":-1.5001239999999854,"y":1.5005812000000134}]} />
<silkscreenpath route={[{"x":-1.2199873999999937,"y":-1.8499581999999961},{"x":-1.3227156927420936,"y":-1.6696850434388253},{"x":-1.115227107257894,"y":-1.6696850434388182},{"x":-1.217955399999994,"y":-1.8499581999999961}]} />
<silkscreentext text="{NAME}" pcbX="-0.000127mm" pcbY="2.905635mm" anchorAlignment="center" fontSize="1mm" />
<courtyardoutline outline={[{"x":-2.155126999999986,"y":2.1556350000000037},{"x":2.154873000000009,"y":2.1556350000000037},{"x":2.154873000000009,"y":-2.3321649999999963},{"x":-2.155126999999986,"y":-2.3321649999999963},{"x":-2.155126999999986,"y":2.1556350000000037}]} />
      </footprint>}
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C515895.obj?uuid=243fc526849b42f9a1a9c3b1825c83b9",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C515895.step?uuid=243fc526849b42f9a1a9c3b1825c83b9",
        pcbRotationOffset: 90,
        modelOriginPosition: { x: 0, y: 0, z: 0 },
      }}
      {...props}
    />
  )
}