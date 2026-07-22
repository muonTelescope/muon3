import type { ChipProps } from "@tscircuit/props"

const pinLabels = {
  pin1: ["GND1"],
  pin2: ["pin2"],
  pin3: ["SWDCLK"],
  pin4: ["SWDIO"],
  pin5: ["pin5"],
  pin6: ["pin6"],
  pin7: ["GND2"],
  pin8: ["pin8"],
  pin9: ["nRESET"],
  pin10: ["ENABLE"],
  pin11: ["pin11"],
  pin12: ["pin12"],
  pin13: ["GND3"],
  pin14: ["VDD"],
  pin15: ["GND4"],
  pin16: ["SIM_RST"],
  pin17: ["SIM_IO"],
  pin18: ["SIM_CLK"],
  pin19: ["SIM_1V8"],
  pin20: ["GND5"],
  pin21: ["MAGPIO0"],
  pin22: ["MAGPIO1"],
  pin23: ["MAGPIO2"],
  pin24: ["DEC0"],
  pin25: ["GND6"],
  pin26: ["SIM_DET"],
  pin27: ["SDATA"],
  pin28: ["SCLK"],
  pin29: ["VIO"],
  pin30: ["GND7"],
  pin31: ["RESERVED1"],
  pin32: ["RESERVED2"],
  pin33: ["RESERVED3"],
  pin34: ["GND8"],
  pin35: ["ANT"],
  pin36: ["GND9"],
  pin37: ["AUX"],
  pin38: ["GND10"],
  pin39: ["GND11"],
  pin40: ["GND12"],
  pin41: ["GND13"],
  pin42: ["GPS"],
  pin43: ["GND14"],
  pin44: ["pin44"],
  pin45: ["pin45"],
  pin46: ["GND15"],
  pin47: ["pin47"],
  pin48: ["pin48"],
  pin49: ["pin49"],
  pin50: ["pin50"],
  pin51: ["GND16"],
  pin52: ["COEX0"],
  pin53: ["COEX1"],
  pin54: ["COEX2"],
  pin55: ["GND17"],
  pin56: ["pin56"],
  pin57: ["pin57"],
  pin58: ["pin58"],
  pin59: ["pin59"],
  pin60: ["GND18"],
  pin61: ["pin61"],
  pin62: ["pin62"],
  pin63: ["pin63"],
  pin64: ["pin64"],
  pin65: ["VDD_GPIO"],
  pin66: ["GND19"],
  pin67: ["pin67"],
  pin68: ["pin68"],
  pin69: ["pin69"],
  pin70: ["pin70"],
  pin71: ["GND20"],
  pin72: ["pin72"],
  pin73: ["pin73"],
  pin74: ["pin74"],
  pin75: ["pin75"],
  pin76: ["GND21"],
  pin77: ["pin77"],
  pin78: ["pin78"],
  pin79: ["pin79"],
  pin80: ["pin80"],
  pin81: ["RESERVED4"],
  pin82: ["RESERVED5"],
  pin83: ["RESERVED6"],
  pin84: ["RESERVED7"],
  pin85: ["RESERVED8"],
  pin86: ["RESERVED9"],
  pin87: ["RESERVED10"],
  pin88: ["RESERVED11"],
  pin89: ["RESERVED12"],
  pin90: ["RESERVED13"],
  pin91: ["RESERVED14"],
  pin92: ["RESERVED15"],
  pin93: ["RESERVED16"],
  pin94: ["RESERVED17"],
  pin95: ["RESERVED18"],
  pin96: ["RESERVED19"],
  pin97: ["RESERVED20"],
  pin98: ["RESERVED21"],
  pin99: ["RESERVED22"],
  pin100: ["RESERVED23"],
  pin101: ["RESERVED24"],
  pin102: ["RESERVED25"],
  pin103: ["RESERVED26"],
  pin104: ["RESERVED27"],
  pin105: ["GND22"],
  pin106: ["GND23"],
  pin107: ["GND24"],
  pin108: ["GND25"],
  pin109: ["GND26"],
  pin110: ["GND27"],
  pin111: ["GND28"],
  pin112: ["GND29"],
  pin113: ["GND30"]
} as const

export const nRF9151_LACA_R7 = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      supplierPartNumbers={{
  "jlcpcb": [
    "C22397843"
  ]
}}
      manufacturerPartNumber="nRF9151_LACA_R7"
      footprint={<footprint>
        <smtpad portHints={["pin1"]} pcbX="-5.499862mm" pcbY="4.99999mm" width="0.6999986mm" height="0.6999986mm" shape="rect" />
<smtpad portHints={["pin2"]} pcbX="-5.625084mm" pcbY="4.250182mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin3"]} pcbX="-5.625084mm" pcbY="3.750056mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin4"]} pcbX="-5.625084mm" pcbY="3.24993mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin5"]} pcbX="-5.625084mm" pcbY="2.750058mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin6"]} pcbX="-5.625084mm" pcbY="2.249932mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin7"]} pcbX="-5.625084mm" pcbY="1.75006mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin8"]} pcbX="-5.625084mm" pcbY="1.249934mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin9"]} pcbX="-5.625084mm" pcbY="0.750062mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin10"]} pcbX="-5.625084mm" pcbY="0.249936mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin11"]} pcbX="-5.625084mm" pcbY="-0.249936mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin12"]} pcbX="-5.625084mm" pcbY="-0.750062mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin13"]} pcbX="-5.625084mm" pcbY="-1.249934mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin14"]} pcbX="-5.625084mm" pcbY="-1.749806mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin15"]} pcbX="-5.625084mm" pcbY="-2.249932mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin16"]} pcbX="-5.625084mm" pcbY="-2.750058mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin17"]} pcbX="-5.625084mm" pcbY="-3.24993mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin18"]} pcbX="-5.625084mm" pcbY="-3.750056mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin19"]} pcbX="-5.625084mm" pcbY="-4.249928mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin20"]} pcbX="-5.499862mm" pcbY="-4.99999mm" width="0.6999986mm" height="0.6999986mm" shape="rect" />
<smtpad portHints={["pin21"]} pcbX="-4.750054mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin22"]} pcbX="-4.249928mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin23"]} pcbX="-3.750056mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin24"]} pcbX="-3.24993mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin25"]} pcbX="-2.750058mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin26"]} pcbX="-2.249932mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin27"]} pcbX="-1.75006mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin28"]} pcbX="-1.249934mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin29"]} pcbX="-0.750062mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin30"]} pcbX="-0.249936mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin31"]} pcbX="0.249936mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin32"]} pcbX="0.750062mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin33"]} pcbX="1.249934mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin34"]} pcbX="1.75006mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin35"]} pcbX="2.249932mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin36"]} pcbX="2.750058mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin37"]} pcbX="3.24993mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin38"]} pcbX="3.750056mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin39"]} pcbX="4.249928mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin40"]} pcbX="4.750054mm" pcbY="-5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin41"]} pcbX="5.499862mm" pcbY="-4.99999mm" width="0.6999986mm" height="0.6999986mm" shape="rect" />
<smtpad portHints={["pin42"]} pcbX="5.625084mm" pcbY="-4.249928mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin43"]} pcbX="5.625084mm" pcbY="-3.750056mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin44"]} pcbX="5.625084mm" pcbY="-3.24993mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin45"]} pcbX="5.625084mm" pcbY="-2.750058mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin46"]} pcbX="5.625084mm" pcbY="-2.249932mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin47"]} pcbX="5.625084mm" pcbY="-1.75006mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin48"]} pcbX="5.625084mm" pcbY="-1.249934mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin49"]} pcbX="5.625084mm" pcbY="-0.750062mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin50"]} pcbX="5.625084mm" pcbY="-0.249936mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin51"]} pcbX="5.625084mm" pcbY="0.249936mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin52"]} pcbX="5.625084mm" pcbY="0.750062mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin53"]} pcbX="5.625084mm" pcbY="1.249934mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin54"]} pcbX="5.625084mm" pcbY="1.75006mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin55"]} pcbX="5.625084mm" pcbY="2.249932mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin56"]} pcbX="5.625084mm" pcbY="2.750058mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin57"]} pcbX="5.625084mm" pcbY="3.24993mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin58"]} pcbX="5.625084mm" pcbY="3.750056mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin59"]} pcbX="5.625084mm" pcbY="4.249928mm" width="0.4500118mm" height="0.2999994mm" shape="rect" />
<smtpad portHints={["pin60"]} pcbX="5.499862mm" pcbY="4.99999mm" width="0.6999986mm" height="0.6999986mm" shape="rect" />
<smtpad portHints={["pin61"]} pcbX="4.750054mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin62"]} pcbX="4.249928mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin63"]} pcbX="3.750056mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin64"]} pcbX="3.24993mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin65"]} pcbX="2.750058mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin66"]} pcbX="2.249932mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin67"]} pcbX="1.75006mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin68"]} pcbX="1.249934mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin69"]} pcbX="0.750062mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin70"]} pcbX="0.249936mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin71"]} pcbX="-0.249936mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin72"]} pcbX="-0.750062mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin73"]} pcbX="-1.249934mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin74"]} pcbX="-1.75006mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin75"]} pcbX="-2.249932mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin76"]} pcbX="-2.750058mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin77"]} pcbX="-3.24993mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin78"]} pcbX="-3.750056mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin79"]} pcbX="-4.249928mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin80"]} pcbX="-4.750054mm" pcbY="5.124958mm" width="0.2999994mm" height="0.4500118mm" shape="rect" />
<smtpad portHints={["pin81"]} pcbX="-4.100068mm" pcbY="3.400044mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin82"]} pcbX="-4.100068mm" pcbY="2.84988mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin83"]} pcbX="-4.100068mm" pcbY="2.29997mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin84"]} pcbX="-4.100068mm" pcbY="0.54991mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin85"]} pcbX="-4.100068mm" pcbY="0mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin86"]} pcbX="-4.100068mm" pcbY="-0.54991mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin87"]} pcbX="-4.100068mm" pcbY="-2.29997mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin88"]} pcbX="-4.100068mm" pcbY="-2.850134mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin89"]} pcbX="-4.100068mm" pcbY="-3.400044mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin90"]} pcbX="-0.54991mm" pcbY="-2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin91"]} pcbX="0mm" pcbY="-2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin92"]} pcbX="0.54991mm" pcbY="-2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin93"]} pcbX="4.100068mm" pcbY="-3.400044mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin94"]} pcbX="4.100068mm" pcbY="-2.84988mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin95"]} pcbX="4.100068mm" pcbY="-2.29997mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin96"]} pcbX="4.100068mm" pcbY="-0.54991mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin97"]} pcbX="4.100068mm" pcbY="0mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin98"]} pcbX="4.100068mm" pcbY="0.54991mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin99"]} pcbX="4.100068mm" pcbY="2.29997mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin100"]} pcbX="4.100068mm" pcbY="2.850134mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin101"]} pcbX="4.100068mm" pcbY="3.400044mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin102"]} pcbX="0.54991mm" pcbY="2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin103"]} pcbX="0mm" pcbY="2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin104"]} pcbX="-0.54991mm" pcbY="2.15011mm" width="0.1999996mm" height="0.1999996mm" shape="rect" />
<smtpad portHints={["pin105"]} pcbX="-2.84988mm" pcbY="2.850134mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin106"]} pcbX="-2.84988mm" pcbY="0mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin107"]} pcbX="-2.84988mm" pcbY="-2.84988mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin108"]} pcbX="0mm" pcbY="-3.57505mm" width="1.5999968mm" height="1.9500088mm" shape="rect" />
<smtpad portHints={["pin109"]} pcbX="2.850134mm" pcbY="-2.84988mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin110"]} pcbX="2.850134mm" pcbY="0mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin111"]} pcbX="2.84988mm" pcbY="2.850134mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<smtpad portHints={["pin112"]} pcbX="0mm" pcbY="3.57505mm" width="1.5999968mm" height="1.9500088mm" shape="rect" />
<smtpad portHints={["pin113"]} pcbX="0mm" pcbY="0mm" width="1.5999968mm" height="1.5999968mm" shape="rect" />
<silkscreenpath route={[{"x":-6.099987799999894,"y":5.6000395999999455},{"x":-6.099987799999894,"y":-5.599937999999952},{"x":6.099987800000122,"y":-5.599937999999952},{"x":6.099987800000122,"y":5.6000395999999455},{"x":-6.099987799999894,"y":5.6000395999999455},{"x":-6.099987799999894,"y":5.6000395999999455}]} />
<silkscreenpath route={[{"x":-6.372859999999832,"y":4.999990000000025},{"x":-6.377187420061205,"y":4.967119981272049},{"x":-6.389874773719384,"y":4.936490000000049},{"x":-6.410057438789181,"y":4.910187438789308},{"x":-6.436360000000036,"y":4.890004773719397},{"x":-6.466989981271922,"y":4.8773174200612175},{"x":-6.499860000000012,"y":4.8729900000000725},{"x":-6.532730018727875,"y":4.8773174200612175},{"x":-6.563359999999989,"y":4.890004773719397},{"x":-6.589662561210616,"y":4.910187438789308},{"x":-6.609845226280527,"y":4.936490000000049},{"x":-6.622532579938593,"y":4.967119981272049},{"x":-6.626859999999965,"y":4.999990000000025},{"x":-6.622532579938593,"y":5.032860018728002},{"x":-6.609845226280527,"y":5.063490000000115},{"x":-6.589662561210616,"y":5.089792561210743},{"x":-6.563359999999989,"y":5.109975226280653},{"x":-6.532730018727875,"y":5.122662579938833},{"x":-6.499860000000012,"y":5.126990000000092},{"x":-6.466989981271922,"y":5.122662579938833},{"x":-6.436360000000036,"y":5.109975226280653},{"x":-6.410057438789181,"y":5.089792561210743},{"x":-6.389874773719384,"y":5.063490000000115},{"x":-6.377187420061205,"y":5.032860018728002},{"x":-6.372859999999832,"y":4.999990000000025}]} />
<silkscreentext text="{NAME}" pcbX="-0.260096mm" pcbY="6.601462mm" anchorAlignment="center" fontSize="1mm" />
<courtyardoutline outline={[{"x":-6.87279599999988,"y":5.8514619999999695},{"x":6.352604000000042,"y":5.8514619999999695},{"x":6.352604000000042,"y":-5.849937999999952},{"x":-6.87279599999988,"y":-5.849937999999952},{"x":-6.87279599999988,"y":5.8514619999999695}]} />
      </footprint>}
      cadModel={{
        objUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C22397843.obj?uuid=c99b497c192940919af8e3c7060d37d3",
        stepUrl: "https://modelcdn.tscircuit.com/easyeda_models/assets/C22397843.step?uuid=c99b497c192940919af8e3c7060d37d3",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0.000012699999956566899, y: -0.000012700000070253736, z: -0.01 },
      }}
      {...props}
    />
  )
}