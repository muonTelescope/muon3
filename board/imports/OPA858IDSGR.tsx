import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["FB"],
  pin2: ["NC"],
  pin3: ["IN_NEG"],
  pin4: ["IN_POS"],
  pin5: ["VS_NEG"],
  pin6: ["OUT"],
  pin7: ["VS_POS"],
  pin8: ["PD"],
  pin9: ["EP"]
} as const

export const OPA858IDSGR = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C970232"
  ]
}}
      manufacturerPartNumber="OPA858IDSGR"
      footprint={<footprint>
        <smtpad portHints={["pin1"]} pcbX="-0.94996mm" pcbY="0.750062mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin2"]} pcbX="-0.94996mm" pcbY="0.249936mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin3"]} pcbX="-0.94996mm" pcbY="-0.249936mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin4"]} pcbX="-0.94996mm" pcbY="-0.750062mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin5"]} pcbX="0.94996mm" pcbY="-0.750062mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin6"]} pcbX="0.94996mm" pcbY="-0.249936mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin7"]} pcbX="0.94996mm" pcbY="0.249936mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin8"]} pcbX="0.94996mm" pcbY="0.750062mm" width="0.5210048mm" height="0.2500122mm" shape="rect" />
<smtpad portHints={["pin9"]} pcbX="0mm" pcbY="0mm" width="0.8999982mm" height="1.5999968mm" shape="rect" />
<silkscreenpath route={[{"x":-1.040002999999956,"y":-1.0599928000000318},{"x":1.059052999999949,"y":-1.0599928000000318}]} />
<silkscreenpath route={[{"x":1.0500359999998636,"y":1.0627359999999726},{"x":-1.0500359999999773,"y":1.0627359999999726}]} />
<silkscreenpath route={[{"x":-1.320799999999963,"y":1.143000000000029},{"x":-1.3233964520368318,"y":1.1232779887632205},{"x":-1.3310088642317623,"y":1.1049000000000433},{"x":-1.343118463273754,"y":1.0891184632736213},{"x":-1.3588999999999487,"y":1.0770088642316296},{"x":-1.3772779887632396,"y":1.0693964520368127},{"x":-1.3970000000000482,"y":1.0668000000000575},{"x":-1.4167220112369705,"y":1.0693964520368127},{"x":-1.435100000000034,"y":1.0770088642316296},{"x":-1.450881536726456,"y":1.0891184632736213},{"x":-1.4629911357684477,"y":1.1049000000000433},{"x":-1.4706035479632646,"y":1.1232779887632205},{"x":-1.4732000000000198,"y":1.143000000000029},{"x":-1.4706035479632646,"y":1.1627220112368377},{"x":-1.4629911357684477,"y":1.181100000000015},{"x":-1.450881536726456,"y":1.196881536726437},{"x":-1.435100000000034,"y":1.2089911357684286},{"x":-1.4167220112369705,"y":1.2166035479632455},{"x":-1.3970000000000482,"y":1.2192000000000007},{"x":-1.3772779887632396,"y":1.2166035479632455},{"x":-1.3588999999999487,"y":1.2089911357684286},{"x":-1.343118463273754,"y":1.196881536726437},{"x":-1.3310088642317623,"y":1.181100000000015},{"x":-1.3233964520368318,"y":1.1627220112368377},{"x":-1.320799999999963,"y":1.143000000000029}]} />
<silkscreentext text="{NAME}" pcbX="-0.127mm" pcbY="2.2319mm" anchorAlignment="center" fontSize="1mm" />
<courtyardoutline outline={[{"x":-1.7232000000000198,"y":1.481899999999996},{"x":1.469199999999887,"y":1.481899999999996},{"x":1.469199999999887,"y":-1.3041000000000622},{"x":-1.7232000000000198,"y":-1.3041000000000622},{"x":-1.7232000000000198,"y":1.481899999999996}]} />
      </footprint>}
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C970232.obj?uuid=2be2baea8d8242eebd2ce617314d92a1",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C970232.step?uuid=2be2baea8d8242eebd2ce617314d92a1",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0, z: 0 },
      }}
      {...props}
    />
  )
}