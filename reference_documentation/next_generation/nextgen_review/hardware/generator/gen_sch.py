#!/usr/bin/env python3
"""gen_sch.py - generates the muon telescope KiCad project (v7 format, opens in 8/9/10)."""
import uuid as U, sys
import gen_symbols
from gen_symbols import SYMS, F
GRAMMAR = 'v9' if (len(sys.argv) > 1 and sys.argv[1] == 'v9') else 'v7'
gen_symbols.set_grammar(GRAMMAR)
FH = gen_symbols.FH_()
OUTDIR = 'out_v10' if GRAMMAR == 'v9' else 'out_v7'
def Q(u):
    return '"' + u + '"' if GRAMMAR == 'v9' else u


PROJECT = 'muon_telescope'
ROOT_UUID = str(U.uuid4())
SHEET_UUIDS = {'power_hv': str(U.uuid4()), 'afe': str(U.uuid4()), 'digital': str(U.uuid4())}

def uid():
    return str(U.uuid4())

LBL_ROT = {0: 180, 180: 0, 90: 270, 270: 90}

class Sheet:
    def __init__(self, fname, title):
        self.fname, self.title = fname, title
        self.used = set()
        self.items = []
        self.path = f'/{ROOT_UUID}/{SHEET_UUIDS[fname]}' if fname in SHEET_UUIDS else f'/{ROOT_UUID}'

    def place(self, symname, ref, x, y, value=None):
        """Place symbol at (x,y) rot 0. Returns dict pin-> (ax, ay, ang)."""
        s = SYMS[symname]
        self.used.add(symname)
        val = value or s.value
        pins_abs = {}
        pin_lines = []
        for num, nm, px, py, ang, *rest in s.pins:
            ax, ay = round(x + px, 2), round(y - py, 2)
            pins_abs[num] = (ax, ay, ang)
            pin_lines.append(f'(pin "{num}" (uuid {Q(uid())}))')
        hide_val = ref.startswith('#')
        sx = f'''(symbol (lib_id "muon:{symname}") (at {x} {y} 0) (unit 1)
    {'(exclude_from_sim no) ' if GRAMMAR == 'v9' else ''}(in_bom {'no' if hide_val else 'yes'}) (on_board yes) (dnp no) (uuid {Q(uid())})
    (property "Reference" "{ref}" (at {x} {round(y - s._top() - 1.8,2)} 0) {FH if hide_val else F})
    (property "Value" "{val}" (at {x} {round(y - s._bot() + 1.8,2)} 0) {FH if hide_val else F})
    (property "Footprint" "{s.footprint}" (at {x} {y} 0) {FH})
    (property "Datasheet" "" (at {x} {y} 0) {FH})
    {f'(property "LCSC" "{s.lcsc}" (at {x} {y} 0) {FH})' if s.lcsc else ''}
    {' '.join(pin_lines)}
    (instances (project "{PROJECT}" (path "{self.path}" (reference "{ref}") (unit 1))))
  )'''
        self.items.append(sx)
        return pins_abs

    def glabel(self, pt, name, shape='bidirectional'):
        ax, ay, pang = pt
        rot = LBL_ROT[pang]
        just = 'left' if rot in (0, 90) else 'right'
        self.items.append(
            f'(global_label "{name}" (shape {shape}) (at {ax} {ay} {rot}) '
            f'(effects (font (size 1.27 1.27)) (justify {just})) (uuid {Q(uid())}) '
            f'(property "Intersheetrefs" "${{INTERSHEET_REFS}}" (at {ax} {ay} 0) {FH}))')

    def power(self, pt, net, ref_n=[0]):
        ax, ay, _ = pt
        ref_n[0] += 1
        self.place(net, f'#PWR0{ref_n[0]:03d}', ax, ay)

    def flag(self, pt, ref_n=[0]):
        ax, ay, _ = pt
        ref_n[0] += 1
        self.place('PWR_FLAG', f'#FLG0{ref_n[0]:03d}', ax, ay)

    def nc(self, pt):
        ax, ay, _ = pt
        self.items.append(f'(no_connect (at {ax} {ay}) (uuid {Q(uid())}))')

    def text(self, x, y, msg, size=1.27):
        msg = msg.replace('"', "'")
        self.items.append(
            f'(text "{msg}" (at {x} {y} 0) (effects (font (size {size} {size})) (justify left)) (uuid {Q(uid())}))')

    def lib_symbols(self):
        defs = []
        for n in sorted(self.used):
            d = SYMS[n].sexpr()
            d = d.replace(f'(symbol "{n}"', f'(symbol "muon:{n}"', 1)
            defs.append(d)
        return '(lib_symbols\n' + '\n'.join(defs) + '\n)'

    def write(self, extra='', root=False):
        body = '\n  '.join(self.items)
        si = f'(sheet_instances (path "/" (page "1")))' if root else ''
        doc = f'''{HDR}
  (uuid {Q(ROOT_UUID if root else SHEET_UUIDS[self.fname])})
  (paper "A3")
  (title_block (title "{self.title}") (date "2026-06-10") (rev "A")
    (company "SiPM Muon Telescope") (comment 1 "Generated: CDFER JLCPCB lib + verified datasheet pinouts"))
  {self.lib_symbols()}
  {body}
  {extra}
  {si}
  {TAIL}
)'''
        open(f'/home/claude/kicad_proj/{OUTDIR}/{self.fname}.kicad_sch', 'w').write(doc)

# ====================================================================
# SHEET 1: power + HV
# ====================================================================
def build_power():
    sh = Sheet('power_hv', 'Power input, 3V3/1V2 rails, HV bias generator')
    # --- input ---
    j = sh.place('CONN_1x02', 'J1', 40, 60, 'VSYS IN 3.5-5V')
    sh.glabel(j['1'], 'VSYS_IN'); sh.power(j['2'], 'GND')
    sh.text(30, 48, 'Power input: USB / LiPo system rail (future: solar+LiPo charger feeds this)')

    # VSYS rail tie + flags
    r0 = sh.place('R_100R_0402', 'R20', 70, 60, '0Ω link')   # placeholder net-tie style link
    sh.glabel(r0['1'], 'VSYS_IN'); sh.power(r0['2'], 'VSYS')
    sh.flag((70 - 3.81, 60, 0))
    cb = sh.place('C_10u_0603', 'C20', 95, 60)
    sh.power(cb['1'], 'VSYS'); sh.power(cb['2'], 'GND')

    # --- TPS61170 boost ---
    u = sh.place('TPS61170', 'U10', 150, 70)
    sh.power(u['6'], 'VSYS')
    sh.glabel(u['5'], 'EN_HV', 'input')
    sh.glabel(u['1'], 'HV_FB')
    sh.glabel(u['4'], 'BOOST_SW')
    sh.glabel(u['2'], 'HV_COMP')
    sh.power(u['3'], 'GND'); sh.power(u['7'], 'GND')
    # inductor VSYS -> SW
    l1 = sh.place('L_10u_PWR', 'L1', 190, 50)
    sh.power(l1['1'], 'VSYS'); sh.glabel(l1['2'], 'BOOST_SW')
    # schottky SW -> HV_RAW
    d1 = sh.place('SS510B', 'D10', 215, 50)
    sh.glabel(d1['2'], 'BOOST_SW'); sh.power(d1['1'], 'HV_RAW')
    sh.flag((215 + 3.81, 50, 0))
    # COMP network
    rc = sh.place('R_4k7_0402', 'R16', 150, 100)
    cc = sh.place('C_10n_0402', 'C13', 175, 100)
    sh.glabel(rc['1'], 'HV_COMP'); sh.glabel(rc['2'], 'HV_COMP_C')
    sh.glabel(cc['1'], 'HV_COMP_C'); sh.power(cc['2'], 'GND')
    # FB divider: HV_RAW -> R11 -> FB -> R12 -> GND ; R13 FB -> HV_TRIM
    r11 = sh.place('R_270k_0603', 'R11', 250, 70)
    sh.power(r11['1'], 'HV_RAW'); sh.glabel(r11['2'], 'HV_FB')
    r12 = sh.place('R_10k_0402', 'R12', 250, 85)
    sh.glabel(r12['1'], 'HV_FB'); sh.power(r12['2'], 'GND')
    r13 = sh.place('R_100k_0402', 'R13', 250, 100)
    sh.glabel(r13['1'], 'HV_FB'); sh.glabel(r13['2'], 'HV_TRIM', 'input')
    sh.text(235, 110, 'HV setpoint: 1.229V*(1+R11/R12) ~ 34.4V; DAC on HV_TRIM pulls setpoint down.')
    sh.text(235, 114, 'MicroFC-30035 SiPM: ~29.8V target. For Hamamatsu (58V) swap boost stage; filter unchanged.')

    # --- pi filter ---
    c10 = sh.place('C_1u_50V_1206', 'C10', 285, 50)
    sh.power(c10['1'], 'HV_RAW'); sh.power(c10['2'], 'GND')
    l2 = sh.place('L_100u_0805', 'L2', 310, 50)
    sh.power(l2['1'], 'HV_RAW'); sh.glabel(l2['2'], 'HV_MID')
    c11 = sh.place('C_1u_50V_1206', 'C11', 335, 50)
    sh.glabel(c11['1'], 'HV_MID'); sh.power(c11['2'], 'GND')
    r10 = sh.place('R_1k_0402', 'R10', 360, 50)
    sh.glabel(r10['1'], 'HV_MID'); sh.power(r10['2'], 'HV_QUIET')
    sh.flag((360 + 3.81, 50, 0))
    c12 = sh.place('C_2u2_50V_1206', 'C12', 385, 50)
    sh.power(c12['1'], 'HV_QUIET'); sh.power(c12['2'], 'GND')
    sh.text(280, 38, 'pi filter: >84dB at 1.2MHz. C12 film/C0G - X7R loses C at DC bias.')

    # --- HV readback ---
    r14 = sh.place('R_1M_0402', 'R14', 310, 85)
    sh.power(r14['1'], 'HV_QUIET'); sh.glabel(r14['2'], 'HV_MON')
    r15 = sh.place('R_62k_0603', 'R15', 335, 85)
    sh.glabel(r15['1'], 'HV_MON'); sh.power(r15['2'], 'GND')
    sh.text(300, 95, 'HV_MON = HV_QUIET / 17.1 -> nRF9151 ADC (1.9V @ 32.4V)')

    # --- 3V3 LDO ---
    u11 = sh.place('AMS1117-33', 'U11', 90, 140)
    sh.power(u11['3'], 'VSYS'); sh.power(u11['2'], '+3V3'); sh.power(u11['1'], 'GND')
    sh.glabel(u11['4'], 'P3V3_S')  # second vout pin tied via label note
    sh.flag((90 + 10.16, 140 - 2.54, 0))
    ca = sh.place('C_10u_0603', 'C21', 120, 140)
    sh.power(ca['1'], '+3V3'); sh.power(ca['2'], 'GND')
    sh.text(70, 155, 'NOTE: AMS1117 is linear - at 84mA analog load it burns ~140mW from 5V.')
    sh.text(70, 159, 'Swap for 3.3V buck module in solar build; pinout-compatible footprints exist.')

    # --- 1V2 LDO for FPGA core ---
    u12 = sh.place('XC6206P122', 'U12', 90, 185)
    sh.power(u12['3'], '+3V3'); sh.power(u12['2'], '+1V2'); sh.power(u12['1'], 'GND')
    sh.flag((90 + 10.16, 185 - 2.54, 0))
    cd = sh.place('C_1u_0402', 'C22', 120, 185)
    sh.power(cd['1'], '+1V2'); sh.power(cd['2'], 'GND')
    sh.text(70, 198, 'VERIFY XC6206P122 pinout + LCSC number before ordering (SOT-23 1=VSS 2=VOUT 3=VIN)')
    return sh

# ====================================================================
# SHEET 2: AFE x4
# ====================================================================
def build_afe():
    sh = Sheet('afe', 'Analog front end: 4x SiPM TIA + comparator (per sim report 2026-06-10)')
    sh.text(20, 25, 'Per channel: DC-coupled anode readout. OPA858 TIA Rf=2k Cf=2.2p -> 24.4mV/p.e., 52MHz.', 1.6)
    sh.text(20, 30, 'TLV3601: IN+=TIA_OUT, IN-=THRESH -> active-low CMPx. ToT = 14.6*ln(Npe)-7.5ns.', 1.6)
    sh.text(20, 35, 'U.FL coax per channel: CENTER = SiPM anode -> TIA summing node. SHIELD = HV bias (+32V DC).', 1.6)
    sh.text(20, 40, 'Shield is AC-grounded through C1 at the connector -> shields normally; bias+signal share one coax, minimal loop area.', 1.6)
    for ch in range(4):
        y0 = 55 + ch * 62
        # SiPM connector: 1 = cathode (HV), 2 = anode (signal)
        j = sh.place('UFL_SIPM', f'J{2+ch}', 30, y0, f'U.FL CH{ch}')
        sh.glabel(j['1'], f'SIPM_AN{ch}')      # center conductor: anode signal
        sh.glabel(j['2'], f'HV_SIPM{ch}')      # shield: HV bias, AC-grounded via C1
        sh.glabel(j['3'], f'HV_SIPM{ch}')      # second shield leg of BWIPX footprint
        # HV RC
        r1 = sh.place('R_100k_0402', f'R{100+ch*10+1}', 30, y0 + 18)
        sh.power(r1['1'], 'HV_QUIET'); sh.glabel(r1['2'], f'HV_SIPM{ch}')
        c1 = sh.place('C_100n_50V_0805', f'C{100+ch*10+1}', 55, y0 + 18)
        sh.glabel(c1['1'], f'HV_SIPM{ch}'); sh.power(c1['2'], 'GND')
        # series R into summing node
        r2 = sh.place('R_10R_0402', f'R{100+ch*10+2}', 62, y0)
        sh.glabel(r2['1'], f'SIPM_AN{ch}'); sh.glabel(r2['2'], f'INA{ch}')
        # clamps
        dv = sh.place('BAV99', f'D{2+ch}', 90, y0 + 16)
        sh.glabel(dv['3'], f'INA{ch}')
        sh.power(dv['1'], 'GND'); sh.power(dv['2'], '+3V3')
        # TIA
        u1 = sh.place('OPA858', f'U{100+ch*10+1}', 115, y0)
        sh.glabel(u1['3'], f'INA{ch}')
        sh.glabel(u1['4'], f'VBOTF{ch}')
        sh.glabel(u1['6'], f'TIA{ch}')
        sh.glabel(u1['1'], f'TIA{ch}')          # FB pin = internal tie to OUT
        sh.power(u1['7'], '+3V3'); sh.power(u1['5'], 'GND'); sh.power(u1['9'], 'GND')
        sh.power(u1['8'], '+3V3')               # ~PD high = enabled
        # feedback
        rf = sh.place('R_2k_0402', f'R{100+ch*10+6}', 115, y0 - 18)
        sh.glabel(rf['1'], f'INA{ch}'); sh.glabel(rf['2'], f'TIA{ch}')
        cf = sh.place('C_2p2_0402', f'C{100+ch*10+6}', 140, y0 - 18)
        sh.glabel(cf['1'], f'INA{ch}'); sh.glabel(cf['2'], f'TIA{ch}')
        # VBOT RC
        r3 = sh.place('R_1k_0402', f'R{100+ch*10+3}', 88, y0 + 28)
        sh.glabel(r3['1'], 'VBOT'); sh.glabel(r3['2'], f'VBOTF{ch}')
        c2 = sh.place('C_100n_0402', f'C{100+ch*10+2}', 113, y0 + 28)
        sh.glabel(c2['1'], f'VBOTF{ch}'); sh.power(c2['2'], 'GND')
        # comparator
        u2 = sh.place('TLV3601DBV', f'U{100+ch*10+2}', 175, y0)
        sh.glabel(u2['3'], f'TIA{ch}')
        sh.glabel(u2['4'], f'VTHF{ch}')
        sh.glabel(u2['1'], f'CMPRAW{ch}')
        sh.power(u2['5'], '+3V3'); sh.power(u2['2'], 'GND')
        # threshold RC
        r4 = sh.place('R_1k_0402', f'R{100+ch*10+4}', 150, y0 + 28)
        sh.glabel(r4['1'], f'THRESH{ch}'); sh.glabel(r4['2'], f'VTHF{ch}')
        c3 = sh.place('C_100n_0402', f'C{100+ch*10+3}', 175, y0 + 28)
        sh.glabel(c3['1'], f'VTHF{ch}'); sh.power(c3['2'], 'GND')
        # series out
        r5 = sh.place('R_33R_0402', f'R{100+ch*10+5}', 205, y0)
        sh.glabel(r5['1'], f'CMPRAW{ch}'); sh.glabel(r5['2'], f'CMP{ch}')
        # decoupling
        c4 = sh.place('C_100n_0402', f'C{100+ch*10+4}', 230, y0)
        sh.power(c4['1'], '+3V3'); sh.power(c4['2'], 'GND')
        c5 = sh.place('C_1u_0402', f'C{100+ch*10+5}', 250, y0)
        sh.power(c5['1'], '+3V3'); sh.power(c5['2'], 'GND')
        sh.text(225, y0 + 8, f'CH{ch} decoupling at U{100+ch*10+1}/U{100+ch*10+2} pins')
    return sh

# ====================================================================
# SHEET 3: digital
# ====================================================================
def build_digital():
    sh = Sheet('digital', 'iCE40UP5K coincidence engine, DAC, sensors, GNSS + nRF9151 carrier')
    # FPGA
    u3 = sh.place('ICE40UP5K-SG48', 'U3', 110, 130)
    # left side assignments
    sig = {
        '9': ('CMP0', 'input'), '10': ('CMP1', 'input'),
        '11': ('CMP2', 'input'), '12': ('CMP3', 'input'),
        '13': ('FPGA_SPARE_B24', 'bidirectional'),
        '20': ('GPS_PPS', 'input'), '35': ('TCXO_CLK', 'input'),
        '37': ('FPGA_SPARE_G1', 'bidirectional'),
        '8': ('FPGA_CRESET', 'input'), '7': ('FPGA_CDONE', 'output'),
        '14': ('CFG_SO', 'bidirectional'), '17': ('CFG_SI', 'bidirectional'),
        '15': ('CFG_SCK', 'bidirectional'), '16': ('CFG_SS', 'bidirectional'),
        '23': ('NRF_SCK', 'input'), '25': ('NRF_COPI', 'input'),
        '26': ('NRF_CIPO', 'output'), '27': ('NRF_CS', 'input'),
        '28': ('NRF_IRQ', 'output'),
    }
    spare_i = 0
    for num, nm, px, py, ang, *r in SYMS['ICE40UP5K-SG48'].pins:
        pt = (round(110 + px, 2), round(130 - py, 2), ang)
        if num in sig:
            sh.glabel(pt, sig[num][0], sig[num][1])
        elif nm.startswith('RGB'):
            sh.glabel(pt, f'LED_{nm}', 'output')
        elif nm.startswith('IO'):
            spare_i += 1
            sh.nc(pt)
        elif nm in ('VCC', 'VCC2'):
            sh.power(pt, '+1V2')
        elif nm in ('VCCIO_0', 'SPI_VCCIO1', 'VCCIO_2', 'VPP_2V5', 'VCCPLL'):
            sh.power(pt, '+3V3')
        elif nm == 'GND/PAD':
            sh.power(pt, 'GND')
    sh.text(70, 178, 'VPP_2V5 fed from 3V3: permitted 2.3-3.6V range on UltraPlus - VERIFY against current Lattice DS.')
    sh.text(70, 182, 'Spare IO marked no-connect; route to test pads at layout. RGB pins drive LEDs (open-drain).')

    # config flash
    fl = sh.place('W25Q128', 'U6', 230, 70)
    sh.glabel(fl['1'], 'CFG_SS'); sh.glabel(fl['6'], 'CFG_SCK')
    sh.glabel(fl['5'], 'CFG_SO')   # FPGA SO -> flash DI
    sh.glabel(fl['2'], 'CFG_SI')   # flash DO -> FPGA SI
    sh.power(fl['3'], '+3V3'); sh.power(fl['7'], '+3V3')
    sh.power(fl['8'], '+3V3'); sh.power(fl['4'], 'GND')
    cfl = sh.place('C_100n_0402', 'C30', 260, 70)
    sh.power(cfl['1'], '+3V3'); sh.power(cfl['2'], 'GND')

    # oscillator
    ox = sh.place('OSC_TCXO', 'X1', 40, 60)
    sh.power(ox['1'], '+3V3'); sh.glabel(ox['3'], 'TCXO_CLK', 'output')
    sh.power(ox['4'], '+3V3'); sh.power(ox['2'], 'GND')
    cx = sh.place('C_100n_0402', 'C31', 40, 78)
    sh.power(cx['1'], '+3V3'); sh.power(cx['2'], 'GND')

    # DAC7578
    da = sh.place('DAC7578PW', 'U4', 230, 150)
    sh.power(da['1'], 'GND')          # ~LDAC low = transparent
    sh.power(da['2'], 'GND')          # ADDR0 -> verify resulting addr
    sh.power(da['3'], '+3V3')
    sh.power(da['8'], '+3V3')         # VREFIN = 3V3 ratiometric
    sh.power(da['9'], '+3V3')         # ~CLR high
    sh.glabel(da['16'], 'SCL', 'input'); sh.glabel(da['15'], 'SDA')
    outs = {'4': 'THRESH0', '13': 'THRESH1', '5': 'THRESH2', '12': 'THRESH3',
            '6': 'VBOT', '11': 'HV_TRIM', '7': 'DAC_SPARE_G', '10': 'DAC_SPARE_H'}
    for p, n in outs.items():
        sh.glabel(da[p], n, 'output')
    cda = sh.place('C_100n_0402', 'C32', 260, 120)
    sh.power(cda['1'], '+3V3'); sh.power(cda['2'], 'GND')
    sh.text(215, 178, 'DAC addr: ADDR0=GND -> VERIFY address vs DAC7578 datasheet table before firmware.')
    sh.text(215, 182, 'VBOT shared by all 4 channels (identical baselines). HV_TRIM trims boost setpoint.')

    # BME280
    bm = sh.place('BME280', 'U5', 320, 70)
    sh.glabel(bm['4'], 'SCL', 'input'); sh.glabel(bm['3'], 'SDA')
    sh.power(bm['2'], '+3V3')          # CSB high = I2C
    sh.power(bm['5'], '+3V3')          # SDO high -> addr 0x77
    sh.power(bm['8'], '+3V3'); sh.power(bm['6'], '+3V3')
    sh.power(bm['1'], 'GND'); sh.power(bm['7'], 'GND')
    cbm = sh.place('C_100n_0402', 'C33', 350, 70)
    sh.power(cbm['1'], '+3V3'); sh.power(cbm['2'], 'GND')

    # I2C pullups
    rp1 = sh.place('R_4k7_0402', 'R30', 320, 105)
    sh.power(rp1['1'], '+3V3'); sh.glabel(rp1['2'], 'SDA')
    rp2 = sh.place('R_4k7_0402', 'R31', 320, 115)
    sh.power(rp2['1'], '+3V3'); sh.glabel(rp2['2'], 'SCL')

    # GNSS header
    j6 = sh.place('CONN_1x06', 'J6', 330, 150, 'GNSS LC76G module')
    sh.power(j6['1'], '+3V3'); sh.power(j6['2'], 'GND')
    sh.glabel(j6['3'], 'GNSS_TX'); sh.glabel(j6['4'], 'GNSS_RX')
    sh.glabel(j6['5'], 'GPS_PPS', 'output'); sh.glabel(j6['6'], 'GNSS_EN')
    sh.text(320, 168, 'PPS: short direct trace to FPGA G3 input.')

    # nRF9151 carrier headers
    j7 = sh.place('CONN_1x10', 'J7', 330, 210, 'nRF9151 carrier A')
    sh.power(j7['1'], 'VSYS'); sh.power(j7['2'], 'GND')
    sh.glabel(j7['3'], 'NRF_SCK', 'output'); sh.glabel(j7['4'], 'NRF_COPI', 'output')
    sh.glabel(j7['5'], 'NRF_CIPO', 'input'); sh.glabel(j7['6'], 'NRF_CS', 'output')
    sh.glabel(j7['7'], 'NRF_IRQ', 'input'); sh.glabel(j7['8'], 'SDA')
    sh.glabel(j7['9'], 'SCL'); sh.power(j7['10'], 'GND')
    j8 = sh.place('CONN_1x10', 'J8', 365, 210, 'nRF9151 carrier B')
    sh.glabel(j8['1'], 'GNSS_TX'); sh.glabel(j8['2'], 'GNSS_RX')
    sh.glabel(j8['3'], 'GNSS_EN'); sh.glabel(j8['4'], 'HV_MON')
    sh.glabel(j8['5'], 'NTC0'); sh.glabel(j8['6'], 'NTC1')
    sh.glabel(j8['7'], 'EN_HV'); sh.glabel(j8['8'], 'FPGA_CRESET')
    sh.glabel(j8['9'], 'FPGA_CDONE'); sh.power(j8['10'], 'GND')

    # NTC dividers
    for i, x in enumerate([40, 40]):
        rn = sh.place('R_10k_0402', f'R{32+i}', 40, 110 + i * 22)
        sh.power(rn['1'], '+3V3'); sh.glabel(rn['2'], f'NTC{i}')
        jn = sh.place('CONN_1x02', f'J{9+i}', 70, 110 + i * 22, f'NTC{i} 10k SiPM')
        sh.glabel(jn['1'], f'NTC{i}'); sh.power(jn['2'], 'GND')

    # LED resistors on FPGA RGB (open-drain sink): +3V3 -> LED -> R -> RGBx
    for i, nm in enumerate(['RGB0', 'RGB1', 'RGB2']):
        rl = sh.place('R_100R_0402', f'R{35+i}', 40, 160 + i * 12, '100Ω LED')
        sh.power(rl['1'], '+3V3'); sh.glabel(rl['2'], f'LED_{nm}')
    sh.text(28, 200, 'LED anodes via R to 3V3, cathode sunk by FPGA RGB pins (constant-current capable).')
    sh.text(28, 204, 'Fit LED in series at layout or treat as test points; omit in field build for power.')
    return sh

# ====================================================================
# ROOT
# ====================================================================
def build_root():
    items = []
    sheets = [('power_hv', 'Power + HV bias', 40, 50),
              ('afe', '4x SiPM analog front end', 40, 110),
              ('digital', 'FPGA + DAC + sensors + comms', 40, 170)]
    for i, (fn, title, x, y) in enumerate(sheets):
        items.append(f'''(sheet (at {x} {y}) (size 80 30) {'(exclude_from_sim no) (in_bom yes) (on_board yes) (dnp no)' if GRAMMAR == 'v9' else '(fields_autoplaced)'}
    (stroke (width 0.1524) (type solid)) (fill (color 0 0 0 0.0000))
    (uuid {Q(SHEET_UUIDS[fn])})
    (property "Sheetname" "{title}" (at {x} {y - 1.5} 0) (effects (font (size 1.27 1.27)) (justify left bottom)))
    (property "Sheetfile" "{fn}.kicad_sch" (at {x} {y + 31.5} 0) (effects (font (size 1.27 1.27)) (justify left top)))
    (instances (project "{PROJECT}" (path "/{ROOT_UUID}" (page "{i + 2}"))))
  )''')
    notes = [
        (140, 55, '4-channel SiPM cosmic-ray muon telescope front end'),
        (140, 62, 'Topology per simulation report 2026-06-10:'),
        (140, 67, '  OPA858 TIA (Rf=2k, Cf=2.2p, 24.4mV/p.e., 52MHz) -> TLV3601 -> iCE40UP5K'),
        (140, 72, '  TPS61170 boost ~30V (MicroFC-30035) + pi filter + DAC trim + ADC readback'),
        (140, 77, '  nRF9151 on carrier headers: housekeeping, I2C (DAC7578/BME280), LTE-M uplink'),
        (140, 82, '  LC76G GNSS module header: PPS to FPGA for GPS-disciplined timestamps'),
        (140, 92, 'Symbols: CDFER JLCPCB-Kicad-Library (passives/BAV99/BME280/W25Q128/AMS1117,'),
        (140, 97, '  LCSC numbers embedded) + datasheet-verified customs (see README + LCSC fields).'),
        (140, 104, 'BEFORE ORDERING: run ERC, verify items marked VERIFY, assign extended-part LCSC IDs.'),
    ]
    body = '\n  '.join(items)
    txt = '\n  '.join(
        f'(text "{m}" (at {x} {y} 0) (effects (font (size 1.6 1.6)) (justify left)) (uuid {Q(uid())}))'
        for x, y, m in notes)
    doc = f'''{HDR}
  (uuid {Q(ROOT_UUID)})
  (paper "A3")
  (title_block (title "SiPM Muon Telescope - root") (date "2026-06-10") (rev "A")
    (company "SiPM Muon Telescope"))
  (lib_symbols)
  {body}
  {txt}
  (sheet_instances (path "/" (page "1")))
  {TAIL}
)'''
    open(f'/home/claude/kicad_proj/{OUTDIR}/{PROJECT}.kicad_sch', 'w').write(doc)

import os
HDR = ('(kicad_sch (version 20250114) (generator "eeschema") (generator_version "9.0")'
       if GRAMMAR == 'v9' else '(kicad_sch (version 20230121) (generator muon_gen)')
TAIL = '(embedded_fonts no)' if GRAMMAR == 'v9' else ''
os.makedirs(f'/home/claude/kicad_proj/{OUTDIR}', exist_ok=True)
build_power().write()
build_afe().write()
build_digital().write()
build_root()

# project + tables
open(f'/home/claude/kicad_proj/{OUTDIR}/{PROJECT}.kicad_pro', 'w').write('''{
  "board": {"design_settings": {}}, "boards": [], "libraries": {"pinned_footprint_libs": [], "pinned_symbol_libs": []},
  "meta": {"filename": "muon_telescope.kicad_pro", "version": 1},
  "net_settings": {
    "classes": [
      {"name": "Default", "clearance": 0.2, "track_width": 0.2, "via_diameter": 0.6, "via_drill": 0.3,
       "bus_width": 12, "diff_pair_gap": 0.25, "diff_pair_via_gap": 0.25, "diff_pair_width": 0.2,
       "line_style": 0, "microvia_diameter": 0.3, "microvia_drill": 0.1, "pcb_color": "rgba(0, 0, 0, 0.000)",
       "schematic_color": "rgba(0, 0, 0, 0.000)", "wire_width": 6},
      {"name": "HV", "clearance": 0.5, "track_width": 0.3, "via_diameter": 0.8, "via_drill": 0.4,
       "bus_width": 12, "diff_pair_gap": 0.25, "diff_pair_via_gap": 0.25, "diff_pair_width": 0.2,
       "line_style": 0, "microvia_diameter": 0.3, "microvia_drill": 0.1, "pcb_color": "rgba(0, 0, 0, 0.000)",
       "schematic_color": "rgba(0, 0, 0, 0.000)", "wire_width": 6}
    ],
    "netclass_patterns": [
      {"netclass": "HV", "pattern": "HV_*"},
      {"netclass": "HV", "pattern": "BOOST_SW"}
    ]
  },
  "schematic": {"drawing": {"default_text_size": 1.27}, "legacy_lib_dir": "", "legacy_lib_list": []},
  "sheets": [], "text_variables": {}
}''')
open(f'/home/claude/kicad_proj/{OUTDIR}/sym-lib-table', 'w').write(
    '(sym_lib_table (version 7)\n'
    '  (lib (name "muon")(type "KiCad")(uri "${KIPRJMOD}/muon_parts.kicad_sym")(options "")(descr "project symbols"))\n'
    '  (lib (name "PCM_JLCPCB")(type "KiCad")(uri "${KIPRJMOD}/JLCPCB-Kicad-Library/symbols/JLCPCB-Resistors.kicad_sym")(options "")(descr "CDFER lib - add remaining files via Preferences"))\n'
    ')')
open(f'/home/claude/kicad_proj/{OUTDIR}/fp-lib-table', 'w').write(
    '(fp_lib_table (version 7)\n'
    '  (lib (name "PCM_JLCPCB")(type "KiCad")(uri "${KIPRJMOD}/JLCPCB-Kicad-Library/footprints/JLCPCB.pretty")(options "")(descr "CDFER JLCPCB footprints"))\n'
    ')')
print('project generated')
