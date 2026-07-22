import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["DVDD"],
  pin2: ["nFAULT"],
  pin3: ["MODE"],
  pin4: ["SR"],
  pin5: ["nITRIP"],
  pin6: ["nOL"],
  pin7: ["pin7"],
  pin8: ["pin8"],
  pin9: ["DISABLE"],
  pin10: ["IPROPI1"],
  pin11: ["nSLEEP"],
  pin12: ["IPROPI2"],
  pin13: ["VM2"],
  pin14: ["OUT22"],
  pin15: ["OUT21"],
  pin16: ["SRC2"],
  pin17: ["SRC1"],
  pin18: ["OUT12"],
  pin19: ["OUT11"],
  pin20: ["VM1"],
  pin21: ["VCP"],
  pin22: ["CPH"],
  pin23: ["CPL"],
  pin24: ["GND"],
  pin25: ["EP"]
} as const

export const DRV8873HPWPR = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C2150604"
  ]
}}
      manufacturerPartNumber="DRV8873HPWPR"
      footprint={<footprint>
        <smtpad portHints={["pin1"]} pcbX="-3.57505mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin2"]} pcbX="-2.925064mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin3"]} pcbX="-2.275078mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin4"]} pcbX="-1.625092mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin5"]} pcbX="-0.975106mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin6"]} pcbX="-0.324866mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin7"]} pcbX="0.32512mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin8"]} pcbX="0.975106mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin9"]} pcbX="1.625092mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin10"]} pcbX="2.275078mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin11"]} pcbX="2.925064mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin12"]} pcbX="3.57505mm" pcbY="-2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin24"]} pcbX="-3.57505mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin23"]} pcbX="-2.925064mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin22"]} pcbX="-2.275078mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin21"]} pcbX="-1.625092mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin20"]} pcbX="-0.975106mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin19"]} pcbX="-0.324866mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin18"]} pcbX="0.32512mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin17"]} pcbX="0.975106mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin16"]} pcbX="1.625092mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin15"]} pcbX="2.275078mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin14"]} pcbX="2.925064mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin13"]} pcbX="3.57505mm" pcbY="2.873248mm" width="0.3430016mm" height="1.746504mm" radius="0.1715008mm" shape="pill" />
<smtpad portHints={["pin25"]} pcbX="0mm" pcbY="0mm" width="5.2600098mm" height="3.1999936mm" shape="rect" />
<silkscreenpath route={[{"x":-3.976217599999927,"y":-1.7714467999999215},{"x":-3.976217599999927,"y":1.7713959999998679},{"x":3.976166800000101,"y":1.7713959999998679},{"x":3.976166800000101,"y":-1.7714467999999215},{"x":-3.976217599999927,"y":-1.7714467999999215}]} />
<silkscreenpath route={[{"x":-3.4249360000000024,"y":-1.019047999999998},{"x":-3.430051010512443,"y":-1.0579003621365928},{"x":-3.445047462536195,"y":-1.094105000000127},{"x":-3.4689033726488105,"y":-1.125194627350993},{"x":-3.499992999999904,"y":-1.1490505374636086},{"x":-3.536197637863438,"y":-1.1640469894875878},{"x":-3.5750499999999192,"y":-1.1691620000000285},{"x":-3.613902362136514,"y":-1.1640469894875878},{"x":-3.650107000000048,"y":-1.1490505374636086},{"x":-3.681196627351028,"y":-1.125194627350993},{"x":-3.7050525374636436,"y":-1.094105000000127},{"x":-3.720048989487509,"y":-1.0579003621365928},{"x":-3.7251639999999497,"y":-1.019047999999998},{"x":-3.720048989487509,"y":-0.9801956378635168},{"x":-3.7050525374636436,"y":-0.9439909999999827},{"x":-3.681196627351028,"y":-0.9129013726488893},{"x":-3.650107000000048,"y":-0.8890454625362736},{"x":-3.613902362136514,"y":-0.8740490105125218},{"x":-3.5750499999999192,"y":-0.8689340000000811},{"x":-3.536197637863438,"y":-0.8740490105125218},{"x":-3.499992999999904,"y":-0.8890454625362736},{"x":-3.4689033726488105,"y":-0.9129013726488893},{"x":-3.445047462536195,"y":-0.9439909999999827},{"x":-3.430051010512443,"y":-0.9801956378635168},{"x":-3.4249360000000024,"y":-1.019047999999998}]} />
<silkscreenpath route={[{"x":-4.048760000000016,"y":-2.8732480000001033},{"x":-4.05387501051257,"y":-2.912100362136698},{"x":-4.068871462536208,"y":-2.9483050000001185},{"x":-4.092727372648824,"y":-2.9793946273510983},{"x":-4.123817000000031,"y":-3.003250537463714},{"x":-4.160021637863451,"y":-3.0182469894875794},{"x":-4.1988739999999325,"y":-3.0233619999999064},{"x":-4.237726362136527,"y":-3.0182469894875794},{"x":-4.273931000000061,"y":-3.003250537463714},{"x":-4.305020627351041,"y":-2.9793946273510983},{"x":-4.328876537463657,"y":-2.9483050000001185},{"x":-4.343872989487522,"y":-2.912100362136698},{"x":-4.348987999999963,"y":-2.8732480000001033},{"x":-4.343872989487522,"y":-2.8343956378633948},{"x":-4.328876537463657,"y":-2.7981909999999743},{"x":-4.305020627351041,"y":-2.7671013726489946},{"x":-4.273931000000061,"y":-2.743245462536379},{"x":-4.237726362136527,"y":-2.7282490105125135},{"x":-4.1988739999999325,"y":-2.7231340000000728},{"x":-4.160021637863451,"y":-2.7282490105125135},{"x":-4.123817000000031,"y":-2.743245462536379},{"x":-4.092727372648824,"y":-2.7671013726489946},{"x":-4.068871462536208,"y":-2.7981909999999743},{"x":-4.05387501051257,"y":-2.8343956378633948},{"x":-4.048760000000016,"y":-2.8732480000001033}]} />
<silkscreentext text="{NAME}" pcbX="-0.1778mm" pcbY="4.58013mm" anchorAlignment="center" fontSize="1mm" />
<courtyardoutline outline={[{"x":-4.593399999999974,"y":3.8301300000000538},{"x":4.237799999999993,"y":3.8301300000000538},{"x":4.237799999999993,"y":-3.9342699999999695},{"x":-4.593399999999974,"y":-3.9342699999999695},{"x":-4.593399999999974,"y":3.8301300000000538}]} />
      </footprint>}
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2150604.obj?uuid=b8eaa76b4fc6419682b56f610920cb76",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C2150604.step?uuid=b8eaa76b4fc6419682b56f610920cb76",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0, z: -1.15 },
      }}
      {...props}
    />
  )
}