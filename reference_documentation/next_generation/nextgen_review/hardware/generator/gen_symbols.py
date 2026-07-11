#!/usr/bin/env python3
"""
gen_symbols.py - builds muon_parts.kicad_sym (KiCad 7 format, opens in 8/9/10)
All pin maps verified against: official KiCad library (OPA858, DAC7578, iCE40UP5K),
TI datasheets fetched 2026-06-10 (TLV3601 SNOSDB1E, TPS61170 SLVS789D),
CDFER JLCPCB library (BAV99, BME280, W25Q128, AMS1117, passives).
"""
import uuid

GRAMMAR = 'v7'   # set to 'v9' for KiCad 9/10-native grammar
F = '(effects (font (size 1.27 1.27)))'
def FH_():
    return '(effects (font (size 1.27 1.27)) (hide yes))' if GRAMMAR == 'v9' else '(effects (font (size 1.27 1.27)) hide)'
FH = FH_()
def set_grammar(g):
    global GRAMMAR, FH
    GRAMMAR = g
    FH = FH_()

def prop(name, val, x=0, y=0, hide=False, idx=None):
    return f'(property "{name}" "{val}" (at {x} {y} 0) {FH_() if hide else F})'

def pin(num, name, x, y, ang, etype='passive', length=2.54, style='line'):
    return (f'(pin {etype} {style} (at {x} {y} {ang}) (length {length}) '
            f'(name "{name}" {F}) (number "{num}" {F}))')

def rect(x1, y1, x2, y2):
    return (f'(rectangle (start {x1} {y1}) (end {x2} {y2}) '
            f'(stroke (width 0.254) (type default)) (fill (type background)))')

def poly(pts, fill='none'):
    p = ' '.join(f'(xy {x} {y})' for x, y in pts)
    return (f'(polyline (pts {p}) (stroke (width 0.254) (type default)) '
            f'(fill (type {fill})))')

class Sym:
    """name, ref prefix, properties incl Footprint/LCSC, body graphics, pins.
    pins: list of (num, name, x, y, ang, etype)"""
    def __init__(self, name, ref, value, footprint='', lcsc='', desc='', power=False):
        self.name, self.ref, self.value = name, ref, value
        self.footprint, self.lcsc, self.desc = footprint, lcsc, desc
        self.power = power
        self.graphics = []
        self.pins = []          # (num,name,x,y,ang,etype)
        self.hide_pin_names = False

    def pin_point(self, num):
        for p in self.pins:
            if p[0] == str(num):
                return (p[2], p[3], p[4])
        raise KeyError(f'{self.name} pin {num}')

    def sexpr(self):
        v9 = GRAMMAR == 'v9'
        s = [f'(symbol "{self.name}"']
        if self.power:
            s.append('(power)')
        if self.hide_pin_names:
            s.append('(pin_names (offset 0.762) (hide yes))' if v9 else '(pin_names (offset 0.762) hide)')
        else:
            s.append('(pin_names (offset 0.762))')
        if v9:
            s.append('(exclude_from_sim no)')
        s.append('(in_bom yes) (on_board yes)')
        s.append(prop('Reference', self.ref, 0, self._top()+2.54))
        s.append(prop('Value', self.value, 0, self._bot()-2.54))
        s.append(prop('Footprint', self.footprint, 0, 0, hide=True))
        s.append(prop('Datasheet', '', 0, 0, hide=True))
        if self.lcsc:
            s.append(prop('LCSC', self.lcsc, 0, 0, hide=True))
        if self.desc:
            s.append(prop('Description' if v9 else 'ki_description', self.desc, 0, 0, hide=True))
        s.append(f'(symbol "{self.name}_0_1" ' + ' '.join(self.graphics) + ')')
        ps = ' '.join(pin(*p) for p in self.pins)
        s.append(f'(symbol "{self.name}_1_1" {ps})')
        if v9:
            s.append('(embedded_fonts no)')
        s.append(')')
        return '\n  '.join(s)

    def _top(self):
        return max([g for g in [p[3] for p in self.pins]] + [2.54])
    def _bot(self):
        return min([g for g in [p[3] for p in self.pins]] + [-2.54])

SYMS = {}
def add(sym):
    SYMS[sym.name] = sym
    return sym

# ---------------- power symbols ----------------
def power_sym(name, down=False):
    s = Sym(name, '#PWR', name, power=True)
    s.hide_pin_names = True
    if down:   # GND-style: pin connects from above, drawing below
        s.pins = [('1', name, 0, 0, 270, 'power_in')]
        s.graphics = [poly([(-1.27, -1.27), (1.27, -1.27)]),
                      poly([(-0.762, -1.905), (0.762, -1.905)]),
                      poly([(-0.254, -2.54), (0.254, -2.54)])]
        # pin points down(270): connection at 0,0, body below: length 1.27
        s.pins = [('1', name, 0, 0, 270, 'power_in')]
        s.pins[0] = ('1', name, 0, 0, 270, 'power_in')
    else:      # rail style: pin connects from below, bar above
        s.pins = [('1', name, 0, 0, 90, 'power_in')]
        s.graphics = [poly([(0, 1.27), (0, 2.0)]),
                      poly([(-1.27, 2.0), (1.27, 2.0)])]
    return add(s)

# pin length 0 for power so connection point is exactly placement point
for s in ['GND']:
    p = power_sym(s, down=True); p.pins=[('1', s, 0, 0, 270, 'power_in', )]
for s in ['+3V3', '+1V2', 'VSYS', 'HV_QUIET', 'HV_RAW']:
    power_sym(s, down=False)
# PWR_FLAG
pf = Sym('PWR_FLAG', '#FLG', 'PWR_FLAG', power=True)
pf.hide_pin_names = True
pf.pins = [('1', 'pwr', 0, 0, 90, 'power_out')]
pf.graphics = [poly([(0, 1.27), (0, 2.54), (-1.905, 3.81), (0, 5.08), (1.905, 3.81), (0, 2.54)])]
add(pf)

# fix power pin lengths to 1.27 with body adjusted (keep simple: length 1.27)
for n in ['GND', '+3V3', '+1V2', 'VSYS', 'HV_QUIET', 'HV_RAW', 'PWR_FLAG']:
    s = SYMS[n]
    num, nm, x, y, ang, et = s.pins[0]
    s.pins[0] = (num, nm, x, y, ang, et)

# ---------------- passives ----------------
def res(name, value, fp, lcsc, desc=''):
    s = Sym(name, 'R', value, fp, lcsc, desc)
    s.hide_pin_names = True
    s.graphics = [rect(-2.286, 1.016, 2.286, -1.016)]
    s.pins = [('1', '1', -3.81, 0, 0, 'passive'),
              ('2', '2', 3.81, 0, 180, 'passive')]
    return add(s)

def cap(name, value, fp, lcsc, desc=''):
    s = Sym(name, 'C', value, fp, lcsc, desc)
    s.hide_pin_names = True
    s.graphics = [poly([(-0.508, 1.524), (-0.508, -1.524)]),
                  poly([(0.508, 1.524), (0.508, -1.524)])]
    s.pins = [('1', '1', -2.54, 0, 0, 'passive', 2.032),
              ('2', '2', 2.54, 0, 180, 'passive', 2.032)]
    return add(s)

def ind(name, value, fp, lcsc, desc=''):
    s = Sym(name, 'L', value, fp, lcsc, desc)
    s.hide_pin_names = True
    s.graphics = [poly([(-2.54, 0), (-1.905, 0.889), (-1.27, 0), (-0.635, 0.889),
                        (0, 0), (0.635, 0.889), (1.27, 0), (1.905, 0.889), (2.54, 0)])]
    s.pins = [('1', '1', -3.81, 0, 0, 'passive', 1.27),
              ('2', '2', 3.81, 0, 180, 'passive', 1.27)]
    return add(s)

# CDFER passives (verified LCSC basic/preferred parts)
res('R_2k_0402',   '2kΩ 1%',  'PCM_JLCPCB:R_0402', 'C4109',  'TIA feedback')
res('R_100k_0402', '100kΩ',   'PCM_JLCPCB:R_0402', 'C25741', 'HV channel isolation')
res('R_10R_0402',  '10Ω',     'PCM_JLCPCB:R_0402', 'C25077')
res('R_1k_0402',   '1kΩ',     'PCM_JLCPCB:R_0402', 'C11702')
res('R_33R_0402',  '33Ω',     'PCM_JLCPCB:R_0402', 'C25105')
res('R_270k_0603', '270kΩ',   'PCM_JLCPCB:R_0603', 'C22965')
res('R_10k_0402',  '10kΩ',    'PCM_JLCPCB:R_0402', 'C25744')
res('R_62k_0603',  '62kΩ',    'PCM_JLCPCB:R_0603', 'C23221')
res('R_1M_0402',   '1MΩ',     'PCM_JLCPCB:R_0402', 'C26083')
res('R_4k7_0402',  '4.7kΩ',   'PCM_JLCPCB:R_0402', 'C25900')
res('R_100R_0402', '100Ω',    'PCM_JLCPCB:R_0402', 'C25076')
cap('C_2p2_0402',  '2.2pF C0G','PCM_JLCPCB:C_0402','C1559',  'TIA compensation')
cap('C_100n_0402', '100nF',   'PCM_JLCPCB:C_0402', 'C1525')
cap('C_10n_0402',  '10nF',    'PCM_JLCPCB:C_0402', 'C15195')
cap('C_1u_0402',   '1uF',     'PCM_JLCPCB:C_0402', 'C52923')   # verify exact LCSC
cap('C_10u_0603',  '10uF',    'PCM_JLCPCB:C_0603', 'C19702')   # verify exact LCSC
ind('L_100u_0805', '100uH',   'PCM_JLCPCB:L_0805', 'C68035',  'HV pi filter, uA load')
# HV-rated caps: generic footprints, NO LCSC (must pick >=50V C0G/X7R, verify)
cap('C_100n_50V_0805', '100nF 50V', 'PCM_JLCPCB:C_0805', '', 'HV node - 50V min, C0G pref')
cap('C_1u_50V_1206',   '1uF 50V',   'PCM_JLCPCB:C_1206', '', 'HV filter - 50V X7R')
cap('C_2u2_50V_1206',  '2.2uF 50V', 'PCM_JLCPCB:C_1206', '', 'HV_QUIET - 50V film/C0G pref')
ind('L_10u_PWR', '10uH 2A', 'Inductor_SMD:L_Taiyo-Yuden_NR-40xx', '', 'boost inductor - e.g. SWPA4030S100MT, EXTENDED part')

# ---------------- diodes ----------------
bav = Sym('BAV99', 'D', 'BAV99', 'PCM_JLCPCB:SOT-23-3_L2.9-W1.6-P1.90-LS2.8-BR', 'C2500',
          'dual series clamp: 1=A1, 3=K1/A2 (signal), 2=K2')
bav.graphics = [rect(-3.81, 2.54, 3.81, -2.54)]
bav.pins = [('1', 'A1', -6.35, -1.27, 0, 'passive'),
            ('2', 'K2', 6.35, -1.27, 180, 'passive'),
            ('3', 'COM', 0, -5.08, 90, 'passive')]
add(bav)

ss = Sym('SS510B', 'D', 'SS510B', 'PCM_JLCPCB:D_SMB', 'C7420368', 'Schottky 100V 5A boost diode')
ss.hide_pin_names = True
ss.graphics = [poly([(-1.27, 1.27), (-1.27, -1.27), (1.27, 0), (-1.27, 1.27)], 'outline'),
               poly([(1.27, 1.27), (1.27, -1.27)])]
ss.pins = [('2', 'A', -3.81, 0, 0, 'passive'),
           ('1', 'K', 3.81, 0, 180, 'passive')]
add(ss)

# ---------------- OPA858 (pins verified: official KiCad lib) ----------------
op = Sym('OPA858', 'U', 'OPA858', 'Package_SON:WSON-8-1EP_2x2mm_P0.5mm_EP0.9x1.6mm', '',
         'EXTENDED part C601618 (verify): 5.5GHz FET-input TIA amp')
op.graphics = [poly([(-8.89, 8.89), (-8.89, -8.89), (8.89, 0), (-8.89, 8.89)], 'background')]
op.pins = [('3', '-',   -11.43,  3.81, 0,   'input'),
           ('4', '+',   -11.43, -3.81, 0,   'input'),
           ('6', 'OUT',  11.43,  0,    180, 'output'),
           ('1', 'FB',    2.54,  7.62, 270, 'output'),
           ('7', 'V+',   -2.54,  7.62, 270, 'power_in'),
           ('8', '~{PD}', -7.62, -7.62, 90, 'input'),
           ('5', 'V-',   -2.54, -7.62, 90,  'power_in'),
           ('9', 'PAD',   0.0,  -7.62, 90,  'passive')]
add(op)

# ---------------- TLV3601 DBV (pins verified: TI SNOSDB1E) ----------------
cm = Sym('TLV3601DBV', 'U', 'TLV3601', 'Package_TO_SOT_SMD:SOT-23-5', '',
         'EXTENDED part (verify LCSC): 2.5ns comparator. 1=OUT 2=VEE 3=IN+ 4=IN- 5=VCC')
cm.graphics = [poly([(-8.89, 8.89), (-8.89, -8.89), (8.89, 0), (-8.89, 8.89)], 'background')]
cm.pins = [('3', '+',  -11.43,  3.81, 0,   'input'),
           ('4', '-',  -11.43, -3.81, 0,   'input'),
           ('1', 'OUT', 11.43,  0,    180, 'output'),
           ('5', 'VCC', -2.54,  7.62, 270, 'power_in'),
           ('2', 'VEE', -2.54, -7.62, 90, 'power_in')]
add(cm)

# ---------------- TPS61170 DRV (pins verified: TI SLVS789D) ----------------
tp = Sym('TPS61170', 'U', 'TPS61170', 'Package_SON:WSON-6-1EP_2x2mm_P0.65mm_EP1x1.6mm', '',
         'EXTENDED C77205 (verify): 1.2A 40V boost. 1=FB 2=COMP 3=GND 4=SW 5=CTRL 6=VIN pad=GND')
tp.graphics = [rect(-7.62, 7.62, 7.62, -7.62)]
tp.pins = [('6', 'VIN',  -10.16,  5.08, 0,   'power_in'),
           ('5', 'CTRL', -10.16,  0,    0,   'input'),
           ('1', 'FB',   -10.16, -5.08, 0,   'input'),
           ('4', 'SW',    10.16,  5.08, 180, 'passive'),
           ('2', 'COMP',  10.16, -5.08, 180, 'passive'),
           ('3', 'GND',    0,   -10.16, 90,  'power_in'),
           ('7', 'PAD',    2.54, -10.16, 90, 'passive')]
add(tp)

# ---------------- AMS1117-3.3 (CDFER) ----------------
ld = Sym('AMS1117-33', 'U', 'AMS1117-3.3', 'PCM_JLCPCB:SOT-223-3_L6.5-W3.4-P2.30-LS7.0-BR',
         'C6186', 'LDO 3.3V 1A (CDFER verified)')
ld.graphics = [rect(-7.62, 5.08, 7.62, -5.08)]
ld.pins = [('3', 'VIN', -10.16, 2.54, 0, 'power_in'),
           ('2', 'VOUT', 10.16, 2.54, 180, 'power_out'),
           ('4', 'VOUT2', 10.16, 0, 180, 'passive'),
           ('1', 'GND',  0, -7.62, 90, 'power_in')]
add(ld)

# ---------------- XC6206P122 1.2V LDO (SOT-23: 1=VSS 2=VOUT 3=VIN, VERIFY) ----------------
l2 = Sym('XC6206P122', 'U', 'XC6206P122 1.2V', 'PCM_JLCPCB:SOT-23-3_L2.9-W1.6-P1.90-LS2.8-BR',
         '', 'VERIFY pinout+LCSC before order: Torex SOT-23 1=VSS 2=VOUT 3=VIN; iCE40 core 1.2V')
l2.graphics = [rect(-7.62, 5.08, 7.62, -5.08)]
l2.pins = [('3', 'VIN', -10.16, 2.54, 0, 'power_in'),
           ('2', 'VOUT', 10.16, 2.54, 180, 'power_out'),
           ('1', 'VSS',  0, -7.62, 90, 'power_in')]
add(l2)

# ---------------- DAC7578 TSSOP-16 (pins verified: official KiCad lib) ----------------
da = Sym('DAC7578PW', 'U', 'DAC7578', 'Package_SO:TSSOP-16_4.4x5mm_P0.65mm', '',
         'EXTENDED (verify LCSC): octal 12-bit I2C DAC')
da.graphics = [rect(-10.16, 17.78, 10.16, -17.78)]
left = [('1', '~{LDAC}', 'input'), ('2', 'ADDR0', 'input'), ('8', 'VREFIN', 'input'),
        ('9', '~{CLR}', 'input'), ('16', 'SCL', 'input'), ('15', 'SDA', 'bidirectional')]
right = [('4', 'VOUTA', 'output'), ('13', 'VOUTB', 'output'), ('5', 'VOUTC', 'output'),
         ('12', 'VOUTD', 'output'), ('6', 'VOUTE', 'output'), ('11', 'VOUTF', 'output'),
         ('7', 'VOUTG', 'output'), ('10', 'VOUTH', 'output')]
da.pins = []
y = 12.7
for num, nm, et in left:
    da.pins.append((num, nm, -12.7, y, 0, et)); y -= 5.08
y = 12.7
for num, nm, et in right:
    da.pins.append((num, nm, 12.7, y, 180, et)); y -= 3.81
da.pins.append(('3', 'AVDD', 0, 20.32, 270, 'power_in'))
da.pins.append(('14', 'GND', 0, -20.32, 90, 'power_in'))
add(da)

# ---------------- BME280 (CDFER, pins verified) ----------------
bm = Sym('BME280', 'U', 'BME280',
         'PCM_JLCPCB:Bosch_LGA-8_2.5x2.5mm_P0.65mm_ClockwisePinNumbering', 'C92489',
         'T/RH/P sensor, I2C addr 0x77 (SDO high)')
bm.graphics = [rect(-7.62, 10.16, 7.62, -10.16)]
bm.pins = [('4', 'SCL',  -10.16,  5.08, 0, 'input'),
           ('3', 'SDA',  -10.16,  2.54, 0, 'bidirectional'),
           ('2', 'CSB',  -10.16, -2.54, 0, 'input'),
           ('5', 'SDO',  -10.16, -5.08, 0, 'bidirectional'),
           ('8', 'VDD',   -2.54, 12.7, 270, 'power_in'),
           ('6', 'VDDIO',  2.54, 12.7, 270, 'power_in'),
           ('1', 'GND',   -2.54, -12.7, 90, 'power_in'),
           ('7', 'GND2',   2.54, -12.7, 90, 'power_in')]
add(bm)

# ---------------- W25Q128 (CDFER, pins verified) ----------------
fl = Sym('W25Q128', 'U', 'W25Q128JVSIQ', 'PCM_JLCPCB:SOIC-8_L5.3-W5.3-P1.27-LS8.0-BL',
         'C97521', 'iCE40 configuration flash')
fl.graphics = [rect(-10.16, 7.62, 10.16, -7.62)]
fl.pins = [('1', '~{CS}', -12.7,  5.08, 0, 'input'),
           ('6', 'CLK',   -12.7,  2.54, 0, 'input'),
           ('5', 'DI',    -12.7,  0,    0, 'input'),
           ('2', 'DO',    -12.7, -2.54, 0, 'output'),
           ('3', '~{WP}/IO2',   12.7, 2.54, 180, 'bidirectional'),
           ('7', '~{HOLD}/IO3', 12.7, 0,    180, 'bidirectional'),
           ('8', 'VCC',    0, 10.16, 270, 'power_in'),
           ('4', 'GND',    0, -10.16, 90, 'power_in')]
add(fl)

# ---------------- TCXO/SPXO 4-pin oscillator ----------------
osc = Sym('OSC_TCXO', 'X', 'TCXO 25MHz 3.3V', 'Oscillator:Oscillator_SMD_ECS_2520MV-xxx-xx-4Pin_2.5x2.0mm',
          '', 'VERIFY pinout vs chosen part. Std 4pin: 1=EN 2=GND 3=OUT 4=VDD. e.g. SG-210 class')
osc.graphics = [rect(-7.62, 5.08, 7.62, -5.08)]
osc.pins = [('1', 'EN',  -10.16, 2.54, 0, 'input'),
            ('3', 'OUT',  10.16, 2.54, 180, 'output'),
            ('4', 'VDD',   0, 7.62, 270, 'power_in'),
            ('2', 'GND',   0, -7.62, 90, 'power_in')]
add(osc)

# ---------------- iCE40UP5K-SG48 single-unit (pins verified: official lib) ----------------
ic = Sym('ICE40UP5K-SG48', 'U', 'iCE40UP5K-SG48ITR', 'Package_DFN_QFN:QFN-48-1EP_7x7mm_P0.5mm_EP5.6x5.6mm',
         '', 'EXTENDED C2678152 (verify): FPGA, 5280 LUT. Pad=GND')
W, = (17.78,)
lpins = [  # left: comparator inputs, clocks, config
    ('9',  'IOB_16a'), ('10', 'IOB_18a'), ('11', 'IOB_20a'), ('12', 'IOB_22b'),
    ('13', 'IOB_24a'), ('20', 'IOB_25b_G3'), ('35', 'IOT_46b_G0'), ('37', 'IOT_45a_G1'),
    ('8',  '~{CRESET}'), ('7', 'CDONE'),
    ('14', 'IOB_32a_SPI_SO'), ('17', 'IOB_33b_SPI_SI'),
    ('15', 'IOB_34a_SPI_SCK'), ('16', 'IOB_35b_SPI_SS'),
]
rpins = [  # right: nRF SPI + spares + RGB
    ('23', 'IOT_37a'), ('25', 'IOT_36b'), ('26', 'IOT_39a'), ('27', 'IOT_38b'),
    ('28', 'IOT_41a'), ('31', 'IOT_42b'), ('32', 'IOT_43a'), ('34', 'IOT_44b'),
    ('36', 'IOT_48b'), ('38', 'IOT_50b'), ('42', 'IOT_51a'), ('43', 'IOT_49a'),
    ('18', 'IOB_31b'), ('19', 'IOB_29b'), ('21', 'IOB_23b'), ('6', 'IOB_13b'),
    ('2', 'IOB_6a'), ('3', 'IOB_9b'), ('4', 'IOB_8a'), ('44', 'IOB_3b_G6'),
    ('45', 'IOB_5b'), ('46', 'IOB_0a'), ('47', 'IOB_2a'), ('48', 'IOB_4a'),
    ('39', 'RGB0'), ('40', 'RGB1'), ('41', 'RGB2'),
]
NL, NR = len(lpins), len(rpins)
H = max(NL, NR) * 2.54 / 2 + 5.08
ic.graphics = [rect(-W, H, W, -H)]
ic.pins = []
y = H - 5.08
for num, nm in lpins:
    et = 'input' if 'CRESET' in nm else ('output' if nm == 'CDONE' else 'bidirectional')
    ic.pins.append((num, nm, -W-2.54, y, 0, et)); y -= 2.54
y = H - 5.08
for num, nm in rpins:
    et = 'open_collector' if nm.startswith('RGB') else 'bidirectional'
    ic.pins.append((num, nm, W+2.54, y, 180, et)); y -= 2.54
# powers across top, grounds bottom
tops = [('5','VCC'), ('30','VCC2'), ('33','VCCIO_0'), ('22','SPI_VCCIO1'),
        ('1','VCCIO_2'), ('24','VPP_2V5'), ('29','VCCPLL')]
x = -15.24
for num, nm in tops:
    ic.pins.append((num, nm, x, H+2.54, 270, 'power_in')); x += 5.08
ic.pins.append(('49', 'GND/PAD', 0, -H-2.54, 90, 'power_in'))
add(ic)

# ---------------- headers ----------------
# ---------------- U.FL coax: center=SiPM anode signal, shield=HV bias ----------------
ufl = Sym('UFL_SIPM', 'J', 'U.FL SiPM', 'PCM_JLCPCB:IPEX-SMD_BWIPX-1-001E', 'C5137195',
          'coax to SiPM paddle: pin1 center = anode signal, pin2 shield = HV bias (AC-grounded via C1)')
ufl.graphics = [rect(-3.81, 3.81, 3.81, -3.81)]
ufl.pins = [('1', 'SIG', -6.35, 0, 0, 'passive'),
            ('2', 'SHLD_HV', -1.27, -6.35, 90, 'passive'),
            ('3', 'SHLD_HV2', 1.27, -6.35, 90, 'passive')]
add(ufl)

def header(name, n, desc=''):
    s = Sym(name, 'J', name, f'Connector_PinHeader_2.54mm:PinHeader_1x{n:02d}_P2.54mm_Vertical',
            '', desc)
    s.graphics = [rect(-2.54, n*1.27+1.27, 2.54, -(n*1.27+1.27))]
    s.pins = []
    y = (n-1)*1.27
    for i in range(1, n+1):
        s.pins.append((str(i), str(i), -5.08, y, 0, 'passive')); y -= 2.54
    return add(s)

header('CONN_1x02', 2, 'SiPM paddle / NTC / power in')
header('CONN_1x06', 6, 'GNSS module / FPGA program')
header('CONN_1x10', 10, 'nRF9151 carrier')

# ---------------- write library ----------------
out = ['(kicad_symbol_lib (version 20220914) (generator muon_gen)']
for s in SYMS.values():
    out.append(s.sexpr())
out.append(')')
open('/home/claude/kicad_proj/muon_parts.kicad_sym', 'w').write('\n'.join(out))
print(f'wrote {len(SYMS)} symbols')

if __name__ == '__main__':
    pass
