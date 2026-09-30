# Muon3 station: test and calibration

Every board is tested and calibrated by the ESP32 itself, driven from a laptop over USB, and the display in the pod shows
the result on the station:

```bash
python hw/tools/station_test.py board          # factory test: nothing plugged in, about 2 min
python hw/tools/station_test.py tile --ch 0    # per tile, at installation: about 10 min per channel
```

`station_test.py` also specifies the firmware's USB-CDC line protocol (`HV`, `TRIM`, `HVMON?`, `VTH`, `INJ`, `COUNT`,
`RSSI?`, `DISP`, `SAVE` and so on). The pass/fail limits come from the simulations in `hw/sim/`; the table below says
which.

You don't need a scope or a fixture. The probe row (22 pads, 2.54 mm pitch, bottom edge) and the TIA/GND scope pair in
each channel cell are for diagnosing a board that fails.

## What you see on the station

The display pod (a 0.91" 128 × 32 I2C OLED on the STEMMA QT port, behind a window in the plate-mounted pod) repeats
every result. The firmware is specified to show four 21-character lines; these mock-ups use the numbers from the
simulations:

![Display mock-ups](display_mock.png)

| Screen | When | Meaning |
|---|---|---|
| Power-up self-test | first 10 s after USB power | I2C devices found, HV_MON in range, injection reaches all four channels, PASS or FAIL |
| Live rates | normal running | singles per tile, 4-fold coincidences, pressure, HV, case temperature, Wi-Fi state |
| Tile calibration | during `tile` | 1 p.e. amplitude, V_op, threshold, efficiency, saved or not |
| Fault | any failed step | the failing channel and the likely cable/part |

## The idea

- **The board can test itself without a tile.**
  - Each channel has a 1 pF injection capacitor. It is driven from the INJ GPIO through a 10 k / 1.1 k divider, so each
    edge puts 0.33 pC on the TIA input. That equals 9 photoelectrons (p.e.) of an S12572-015.
  - The firmware sweeps the channel's threshold DAC (VTH) and counts HIT pulses with PCNT. The threshold at which half
    the injected pulses still fire measures the whole chain at once: TIA gain, comparator offset, the DAC, the HIT
    GPIO and the counter.
  - The same sweep without injection finds each channel's noise edge.
- **The bias checks itself.** HV_MON is HV ÷ 27.7, read on the ESP32's ADC. Three TRIM settings check the range, and two
  of them give a per-board line HV(TRIM), which is stored in NVS.
- **The tile calibrates its own gain.** In the dark, a SiPM fires single photoelectrons at a high rate (dark counts).
  The count rate against threshold falls in a staircase. The spacing of the steps is the height of 1 p.e., which is the
  gain, and it is measured on the real tile at its real temperature. Set the bias so the step is 5.8 mV, then put the
  threshold at 5 p.e. (29 mV).
  - The same staircase, repeated every few minutes, is the running gain servo. Nothing drifts silently, and the BME280
    temperature is only a feed-forward term.
- **What efficiency to expect.** The corrected Geant4 model (see the top-level README) gives a mean muon of **19.5 p.e.**
  (σ = 11) in tile 01. A 5 p.e. threshold then fires on **90 %** of muons; a 3 p.e. threshold would give about 95 %. The
  losses are the muons that cross far from the fiber, so measure the efficiency per tile with the coincidence method
  (three tiles fire, does the fourth?) instead of assuming it.

## Factory test (`board`)

| Step | What the firmware does | Pass | Source |
|---|---|---|---|
| 1 | Scan both I2C buses | BME280 0x76, SC7A20H 0x19, MCP4728 0x60 on I2C0 and I2C1 | design |
| 2 | Read BME280 pressure | 850–1090 hPa | — |
| 3 | HV_EN low, read HV_MON | 2.5–5.5 V (USB 5 V minus the boost diode; not 0 V) | [SIM] ≈ 4 V |
| 4 | HV_EN high, TRIM = 0 / 1.0 / 2.048 V | 80–86.5 V / 65.5–71.5 V / 50–56 V | [SIM] 83.0 / 68.4 / 52.9 V |
| 5 | Store HV(TRIM) line; leave the bias at TRIM 2.048 V and HV_EN low | — | — |
| 6 | Per channel: VTH staircase with no injection | noise edge ≤ 8 mV below VREF | [SIM] < 3 mV |
| 7 | Per channel: VTH staircase with INJ pulses, 50 % point | 85–135 mV below VREF | [SIM] 109 mV |
| 8 | Join the test access point, read RSSI (the external antenna must be on the lid) | ≥ −65 dBm at 2 m | [MEAS] first prototype |

![Simulated scope screens](scope_guide.png)

*Simulated scope screens (`hw/sim/scope_guide.cir`, `hw/sim/plot_scope.py`), which show what you should see on the probe
points:*
- ① Injection with nothing plugged in. A 109 mV dip follows each INJ edge (either polarity), and HIT0 fires on the
  negative one.
- ② With a tile and coax attached, the same charge shares the SiPM's 320 pF and the dip halves (55 mV). The ringing comes
  from the idealised lossless coax in the model. The firmware ignores HIT pulses shorter than 20 ns, so the comparator
  chatter on the edge is not counted.
- ③ A single dark pulse (5.8 mV, shown ×10) and a mean muon (20 p.e., 116 mV, time over threshold ≈ 330 ns).
- ④ The bias power-up seen on HV_MON. It sits at ≈ 4 V until HV_EN goes high at 10 ms, then settles in 60–90 ms.

## Per-tile calibration (`tile`)

1. Attach the tile and close the light-tight wrap. Set the bias to the tile's operating voltage V_op (from the
   Hamamatsu/GSU sheet). The firmware closes the loop on HV_MON using the stored HV(TRIM) line.
2. **Staircase.** Sweep VTH 1–40 mV below VREF, gating 200 ms per step. Peaks in −d(log rate)/dVTH sit between p.e.
   steps; their spacing is the 1 p.e. amplitude.
3. If the step is not 5.8 mV, move V_op by ΔV = (5.8 / step − 1) · (V_op − V_bd) and repeat. For the S12572, V_op − V_bd
   is a few volts.
4. Threshold = 5 p.e. Store `pe_n`, `vth_n` and V_op in NVS.
5. With tiles stacked (100 mm apart), run the coincidence plateau: HV_op ± 1 V in 0.25 V steps, 5 min each. The
   coincidence rate should be flat to within its statistical error. Cosmic muons pass a 4-tile stack at about
   1 per cm² per minute × the geometric acceptance, so expect a few counts per minute for a 12 × 19 cm tile.

## Diagnosing a failed board

| Probe (row, left → right) | Expect |
|---|---|
| GND · 5V · 3V3 · 3V3A | 0 · 4.8–5.2 · 3.25–3.35 · 3.25–3.35 V |
| VREF · VTH0–3 | as set (default 2.50 V; VTH = VREF − 29 mV) |
| HIT0–3 | 0 V idle, 3.3 V pulses |
| INJ | 0/3.3 V square during self-test |
| HV_EN · HV_TRIM · HV_MON | 0/3.3 V · 0–2.048 V · HV ÷ 27.7 |
| DAC_C · DAC_D | spare DAC outputs (free for experiments) |
| SDA0 · SCL0 | I2C0, 3.3 V idle |

- **Scope the TIA with a ground spring on the TIA/GND pair in each channel cell.** Never clip a scope ground to a U.FL
  shell: the shell carries the bias. The four cells are identical, so a good channel next door is your reference for
  what the failing one should look like.
- A TIA pinned at VREF that shows no injection dip points to a dead op-amp or an open input. A TIA pinned at a rail
  points to a shorted Cf/Rf or an input tied to the shell.
- An HV stuck at ≈ 4 V with HV_EN high points to the BSS123 gate (HV_GATE), the 150 µH inductor or the MC34063's
  current sense (2.2 Ω).
- No Wi-Fi with a good board usually means the antenna pigtail is not clicked onto the module's U.FL (the small jack in
  the module's corner), or the FPC antenna is not on the lid.
