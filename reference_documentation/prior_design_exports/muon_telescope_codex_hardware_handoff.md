# Codex Engineering Handoff: 4-Channel SiPM Muon Telescope

**Purpose of this file:**  
Provide a detailed engineering handoff for Codex covering the detector concept, hardware design ideas, decisions already made, proposed requirements, firmware/dashboard implications, and open validation tasks.

This is **not** an SBIR grant summary. It is an internal technical design/rationale document intended to help continue schematic, PCB, firmware, and dashboard development.

**Project name:** 4-Channel SiPM Cosmic-Ray Muon Telescope  
**Current controller module:** ColorEasyPico2-RP2350  
**Current primary data mode:** periodic rate/count reporting over USB CDC / Web Serial  
**Current pulse mode:** active-low comparator pulses, leading-edge counting only  
**Current coincidence mode:** exact-subset coincidence counting  

---

## 1. High-Level System Goal

Build a compact, low-cost, browser-accessible cosmic-ray muon telescope using:

- Plastic scintillator paddles
- Wavelength-shifting fiber light collection
- SiPM optical readout
- Four analog detection channels
- Low-noise high-voltage SiPM bias
- Per-channel RF preamplifier and comparator
- RP2350 PIO-based edge capture
- Exact-subset coincidence counting
- BME280 environmental monitoring
- DAC7578 programmable threshold/baseline control
- USB CDC / Web Serial dashboard

The system should be suitable for:

- Cosmic-ray muon rate measurements
- Educational detector demonstrations
- Long-duration environmental correlation studies
- Future solar/LiPo field deployment
- Later expansion to ToT, peak detection, or directional telescope modes

---

## 2. Current System Architecture

```text
Scintillator paddle
→ WLS fiber
→ SiPM
→ RF transistor preamp
→ fast comparator
→ RP2350 GPIO / PIO edge capture
→ exact-subset coincidence counting
→ USB CDC binary protocol
→ Web Serial dashboard
```

Supporting subsystems:

```text
VSYS / USB power
→ MAX1932 SiPM HV supply
→ filtered HV rail
→ per-channel HV isolation
→ SiPM bias
```

```text
3V3
→ BME280 environmental sensor
→ DAC7578 threshold/baseline DAC
→ comparator/reference logic
```

---

## 3. Detector Physics Design Assumptions

### Scintillator

Selected / assumed scintillator:

```text
EJ-200 plastic scintillator
```

Assumptions:

- Thickness: approximately 1 cm
- Light yield: approximately 10,000 to 11,000 photons/MeV
- Minimum-ionizing muon energy deposition: approximately 2 MeV/cm
- Generated photons per vertical muon through 1 cm: approximately 20,000 to 22,000 photons

### Optical Chain

Current optical concept:

```text
EJ-200 scintillator
→ 1 mm WLS fiber loop
→ direct optical coupling to SiPM
```

Design-level detected-signal assumption:

- Realistic detected signal: approximately 20 to 100 photoelectrons
- Working design point: approximately 30 photoelectrons

Rationale:

- 30 photoelectrons is large enough for threshold triggering.
- It is still small enough that noise, threshold, temperature, and bias stability matter.
- The analog front-end should not rely on raw MCU GPIO thresholds.

---

## 4. SiPM Selection and Implications

Selected SiPM:

```text
Hamamatsu S13360-2050VE
```

Assumed parameters:

- Breakdown voltage: approximately 53 V ± 5 V
- Operating voltage target: Vbr + approximately 3 V, roughly 56 V
- Temperature coefficient: approximately 54 mV/°C
- Terminal capacitance: approximately 140 pF
- Pixel count: 1584
- Approximate pixel capacitance: approximately 88 fF
- Pulse width: tens of ns

Design implications:

1. **Bias stability matters.**  
   SiPM gain is proportional to overvoltage. Small HV ripple or drift can modulate gain and dark rate.

2. **Temperature matters.**  
   Breakdown voltage changes with temperature. The BME280 is included partly to correlate rate/gain behavior with environment.

3. **Input capacitance is significant.**  
   The 140 pF terminal capacitance can slow edges and burden a weak front-end.

4. **Use a preamp + comparator.**  
   Direct MCU input triggering is not reliable enough for this detector.

---

## 5. Major Hardware Design Decisions

### Decision 1: Use MAX1932 for SiPM High Voltage

Selected high-voltage controller:

```text
MAX1932
```

Reasoning:

- Designed for APD/SiPM-style high-voltage bias use.
- More appropriate than an MCU-bit-banged boost converter.
- Supports cleaner, more stable HV generation.
- Better path to millivolt-level ripple/stability after filtering.

Intended HV path:

```text
VSYS
→ MAX1932
→ HV_RAW
→ pi filter / HV cleanup
→ HV_QUIET
→ per-channel RC isolation
→ SiPM bias nodes
```

Required follow-up:

- Confirm pi filter exists in schematic/PCB.
- Confirm four per-channel HV isolation resistors.
- Confirm four local SiPM bias capacitors.
- Measure HV ripple on assembled PCB.
- Verify channel-to-channel coupling.

---

### Decision 2: Use Discrete RF Transistor Preamplifier

Selected preamp concept:

```text
Infineon BFR93A RF transistor preamp per channel
```

Reasoning:

- Raw SiPM signal amplitude is small.
- SiPM capacitance is large enough to affect bandwidth.
- RF transistor preamp gives faster, cleaner pulses.
- Avoids complexity/stability risk of very high-speed op-amp designs.
- Low BOM cost and practical for assembly.

Per-channel signal path:

```text
SiPM
→ sense/coupling network
→ BFR93A preamp
→ fast comparator
→ RP2350 GPIO
```

Required follow-up:

- Validate pulse amplitude and shape with SiPM or pulse injection.
- Confirm comparator threshold range covers expected signals.
- Confirm preamp is stable with real PCB parasitics.
- Confirm no oscillation or excessive ringing.

---

### Decision 3: Use Fast Comparator Digitization

Comparator class:

```text
LMV7219-class fast comparator
```

Reasoning:

- Provides deterministic digital edges.
- Avoids relying on MCU Schmitt input behavior.
- Enables programmable threshold control.
- Can support future ToT by capturing both edges.

Current behavior:

```text
Comparator output is active-low.
Idle state: HIGH.
Event leading edge: falling edge.
Current firmware uses falling edges only.
```

Required follow-up:

- Add/verify hysteresis.
- Add small series resistor into MCU input, typically 22 to 47 ohm.
- Confirm active-low polarity in firmware and hardware.
- Validate threshold versus dark-rate curves.

---

### Decision 4: Use RP2350 PIO Instead of FPGA

Current controller module:

```text
ColorEasyPico2-RP2350
```

Reasoning:

- PIO can capture edges deterministically enough for configurable coincidence counting.
- Event rates are low enough for firmware-side clustering.
- Avoids FPGA complexity.
- Supports USB CDC/Web Serial easily.
- Open toolchain.

Original discussion used RP2040, but latest hardware uses RP2350. Codex should assume RP2350 unless asked otherwise.

Required follow-up:

- Ensure pico-sdk target/build files are correct for RP2350.
- Verify PIO program compatibility.
- Confirm USB CDC works with the selected board definition.
- Confirm GPIO pin mapping matches latest schematic.

---

### Decision 5: Use Exact-Subset Coincidence Counting

Requirement:

Count exact channel subsets, not inclusive “at least” combinations.

Example:

- A `CH0&CH1&CH2` event increments only `CH0&CH1&CH2`.
- It does not also increment `CH0&CH1`, `CH0&CH2`, or `CH1&CH2`.

Reasoning:

- Gives cleaner scientific interpretation.
- Avoids double-counting higher-fold events.
- Host software can derive inclusive counts later if desired.

---

### Decision 6: Use BME280 Environmental Monitoring

Sensor:

```text
BME280
```

I2C address:

```text
0x77
```

because SDO is tied high.

Reported values:

- Temperature
- Humidity
- Pressure

Reasoning:

- Temperature affects SiPM breakdown voltage and gain.
- Pressure affects cosmic-ray muon flux.
- Environmental metadata improves long-duration rate analysis.
- Useful for future compensation algorithms.

---

### Decision 7: Use DAC7578 for 8 Analog Setpoints

DAC:

```text
DAC7578
```

Purpose:

- Four comparator thresholds.
- Four baseline/bottom/reference setpoints.

Physical channel mapping from schematic should be treated as:

```text
DAC A / channel 0 → THRESH0
DAC B / channel 1 → CH0_VBOT
DAC C / channel 2 → THRESH1
DAC D / channel 3 → CH1_VBOT
DAC E / channel 4 → THRESH2
DAC F / channel 5 → CH2_VBOT
DAC G / channel 6 → THRESH3
DAC H / channel 7 → CH3_VBOT
```

Important note:

Earlier dashboard labels assumed all thresholds first, then all VBOTs. That should be corrected to match the physical DAC channel mapping above unless the schematic is changed.

Assumed DAC I2C address in generated firmware:

```text
0x4C
```

This must be verified from the actual ADDR pin strapping and DAC7578 datasheet.

---

### Decision 8: Use USB CDC + Web Serial

Communication mode:

```text
USB CDC ACM serial
```

Reasoning:

- Works with Chrome/Edge Web Serial.
- Avoids custom desktop software.
- Data rate is low.
- Binary framing with CRC is robust against arbitrary read chunking.

The browser dashboard should:

- Connect over Web Serial.
- Verify CRC.
- Display rates and environmental values.
- Graph data in near real time.
- Show error flags.
- Control report period, coincidence window, holdoff, and DAC outputs.

---

## 6. Final Pin Mapping

This is the latest intended mapping.

### I2C Bus

Used by BME280 and DAC7578.

| Signal | RP2350 GPIO | Module Pin |
|---|---:|---:|
| SDA | GPIO4 | pin 6 |
| SCL | GPIO5 | pin 7 |

### Comparator Inputs

Active-low comparator outputs. Falling edge is the event timestamp.

| Signal | RP2350 GPIO | Module Pin |
|---|---:|---:|
| CH0 | GPIO16 | pin 21 |
| CH1 | GPIO17 | pin 22 |
| CH2 | GPIO18 | pin 24 |
| CH3 | GPIO19 | pin 25 |

### MAX1932 Control / Serial Interface

The SPI-like pins were moved because physical pin 30 is RUN and not a GPIO.

| Signal | RP2350 GPIO | Module Pin |
|---|---:|---:|
| MOSI | GPIO20 | pin 26 |
| SCLK | GPIO21 | pin 27 |
| MAX1932_INT | GPIO22 | pin 29 |
| MAX1932_SS | GPIO26 | pin 31 |

Important:

- Do not use RUN as GPIO.
- RUN is reset/run only.
- If MAX1932 control is not yet implemented in firmware, reserve these pins for it.

### Recommended LED / Button GPIOs

| Function | Suggested GPIO |
|---|---:|
| LED4-R | GPIO6 |
| LED4-G | GPIO7 |
| LED4-B | GPIO8 |
| LED5-R | GPIO9 |
| LED5-G | GPIO10 |
| LED5-B | GPIO11 |
| SW3 | GPIO12 |
| SW4 | GPIO13 |

LED recommendation:

```text
GPIO → resistor → LED → GND
```

Button recommendation:

```text
GPIO → button → GND
```

Use internal pull-ups for buttons.

---

## 7. Power Pin Decisions and Requirements

### VBUS

- USB 5 V rail.
- Present when USB cable is connected.
- Not regulated to 3.3 V.
- Should not be treated as a general clean analog supply.

### VSYS

Current intent:

```text
USB powers the module
→ module internal path provides VSYS
→ VSYS feeds MAX1932 input
```

This is acceptable if current limits are respected.

Schematic clarity requirement:

- If VSYS is being used as an output from the module, label it `VSYS` or `VSYS_TO_HV`.
- Avoid labeling it simply `+5V` if that implies an externally forced supply.

Future battery/solar mode:

```text
Solar charger / power-path output
→ VSYS
→ module regulator
→ 3V3
```

### 3V3

- Output of module onboard 3.3 V regulator.
- Use for BME280, DAC7578, low-voltage logic, and possibly comparator logic.
- Do not externally drive 3V3.

### 3V3_EN

- Regulator enable.
- Leave pulled high unless a deliberate shutdown circuit is added.
- Pulling low disables 3.3 V rail.

### RUN

- Reset/run pin.
- Pull low to reset RP2350.
- Not GPIO.

### VREF

- ADC reference input.
- Currently unused.
- Reserve for future precision ADC use if battery monitoring or peak measurement is implemented.

---

## 8. Firmware Requirements

### 8.1 Edge Capture

Inputs:

```text
GPIO16 → CH0
GPIO17 → CH1
GPIO18 → CH2
GPIO19 → CH3
```

Pulse polarity:

```text
active-low
leading edge = falling edge
```

Requirement:

- Capture falling-edge timestamps only for current release.
- No ToT required yet.
- Use PIO where possible.

### 8.2 Counting

Each report interval must include:

Raw singles:

```text
CH0
CH1
CH2
CH3
```

Exact 2-fold coincidences:

```text
CH0&CH1
CH0&CH2
CH0&CH3
CH1&CH2
CH1&CH3
CH2&CH3
```

Exact 3-fold coincidences:

```text
CH0&CH1&CH2
CH0&CH1&CH3
CH0&CH2&CH3
CH1&CH2&CH3
```

Exact 4-fold coincidence:

```text
CH0&CH1&CH2&CH3
```

### 8.3 Mask Definitions

Use 4-bit masks:

```text
bit0 = CH0
bit1 = CH1
bit2 = CH2
bit3 = CH3
```

Mask values:

```text
CH0 = 1
CH1 = 2
CH2 = 4
CH3 = 8

CH0&CH1 = 3
CH0&CH2 = 5
CH0&CH3 = 9
CH1&CH2 = 6
CH1&CH3 = 10
CH2&CH3 = 12

CH0&CH1&CH2 = 7
CH0&CH1&CH3 = 11
CH0&CH2&CH3 = 13
CH1&CH2&CH3 = 14

CH0&CH1&CH2&CH3 = 15
```

Report subset masks in this order:

```text
3, 5, 9, 6, 10, 12, 7, 11, 13, 14, 15
```

### 8.4 Cluster Algorithm

Use a cluster-based coincidence algorithm.

For each edge event `(ch, timestamp)`:

1. Increment raw singles count for `ch`.
2. If no cluster is active, start one.
3. If cluster is active and `timestamp - cluster_tmin <= window_ticks`, merge the channel into the cluster.
4. If outside the window, close the previous cluster, increment `subset_counts[cluster_mask]`, then start a new cluster.
5. At each report boundary, flush any active cluster.

Coincidence condition:

```text
max(t_i) - min(t_i) <= window_ticks
```

Use configurable holdoff:

```text
holdoff_ticks
```

to avoid duplicate clusters from ringing or afterpulsing.

Implementation caution:

- Events drained from four separate PIO FIFOs may not be globally timestamp-sorted.
- If synthetic tests reveal misclassification, add a small timestamp-sorted merge buffer before clustering.
- Timestamp wrap handling must be robust.

### 8.5 Report Period

Default:

```text
60,000 ms
```

Dashboard should allow changing report period to:

```text
1,000 ms to 5,000 ms
```

for real-time graphing.

### 8.6 BME280

Firmware must:

- Initialize BME280 at I2C address `0x77`.
- Read temperature, humidity, and pressure once per report interval.
- Include values in each report packet.
- Set an error flag if read fails.

### 8.7 DAC7578

Firmware must:

- Initialize DAC7578 on I2C.
- Support setting one DAC channel.
- Support setting all eight DAC channels.
- Cache current DAC codes.
- Include all eight DAC codes in every report packet.
- Use physical channel mapping matching the schematic.

### 8.8 MAX1932 Interface

Firmware should reserve and eventually implement:

```text
MOSI → GPIO20
SCLK → GPIO21
SS   → GPIO26
INT  → GPIO22
```

Current minimum requirement:

- Configure `MAX1932_INT` as input.
- Latch/report fault/interrupt state in error flags.

Future requirement:

- Implement MAX1932 programming/control if needed by the selected operating mode.

---

## 9. USB Protocol Requirements

Use binary framed USB CDC packets.

Frame format:

```text
SOF0 SOF1 TYPE LENlo LENhi PAYLOAD CRC16lo CRC16hi
0xA5 0x5A
```

CRC:

```text
CRC16-CCITT over TYPE + LEN + PAYLOAD
```

### Device-to-Host Report Packet

Type:

```text
0x11
```

Payload:

```text
u32 period_index
u32 period_ms
u16 window_ticks
u16 holdoff_ticks

u32 singles[4]

u32 exact_subset[11]
  order: masks 3,5,9,6,10,12,7,11,13,14,15

i16 bme_temp_c_x100
u16 bme_hum_rh_x100
u32 bme_press_pa

u16 dac_code[8]

u32 dropped_events
u32 err_flags
u32 uptime_ms
```

### Host-to-Device Command Packet

Type:

```text
0x80
```

Payload:

```text
u8  cmd_id
u8  seq
u16 arg_len
u8  args[arg_len]
```

### Device-to-Host ACK Packet

Type:

```text
0x81
```

Payload:

```text
u8  cmd_id
u8  seq
u8  status
u8  reserved
u16 ret_len
u8  ret[ret_len]
```

### Commands

Required commands:

| Command | ID | Args | Purpose |
|---|---:|---|---|
| SET_REPORT_PERIOD_MS | 0x01 | u32 period_ms | Change report interval |
| SET_WINDOW_TICKS | 0x02 | u16 window_ticks | Change coincidence window |
| SET_HOLDOFF_TICKS | 0x03 | u16 holdoff_ticks | Change cluster holdoff |
| RESET_COUNTERS | 0x04 | none | Clear counts and restart period |
| DAC_SET_CH | 0x10 | u8 ch, u16 code | Set one DAC output |
| DAC_SET_ALL | 0x11 | u16 code[8] | Set all DAC outputs |
| DAC_GET_ALL | 0x12 | none | Return cached DAC codes |
| GET_STATUS | 0x20 | none | Return status/config summary |

Recommended future commands:

| Command | Purpose |
|---|---|
| CLEAR_ERRORS | Clear latched error flags |
| SET_DAC_LABEL_MAP | Optional host-defined DAC labels |
| GET_VERSION | Firmware/hardware/protocol version |
| SAVE_CONFIG | Persist config to flash |
| LOAD_DEFAULTS | Restore defaults |
| SET_LED_MODE | Configure status LEDs |
| GET_RAW_DEBUG | Enable temporary diagnostic event stream |

---

## 10. Error Flags

Use a 32-bit error flag field in report packets.

Recommended current bits:

```text
bit0 = PIO/event queue dropped event
bit1 = USB TX backlog
bit2 = BME280 read/init failure
bit3 = DAC7578 write/init failure
bit4 = I2C recovery invoked
bit5 = MAX1932_INT asserted
bit6 = RX CRC error
bit7 = RX framing/command parse error
```

Dashboard should decode and display these in human-readable form.

---

## 11. Web Dashboard Requirements

The browser dashboard should use Web Serial.

### Required UI Features

Connection/status:

- Connect/disconnect button.
- Show last packet age.
- Show packet count.
- Show CRC error count.
- Show dropped events.
- Show error flags.

Configuration controls:

- Report period in ms.
- Coincidence window in ticks.
- Holdoff in ticks.
- Reset counters command.

DAC controls:

- Eight DAC sliders/numeric inputs.
- Correct labels matching schematic:
  - DAC A / 0 = THRESH0
  - DAC B / 1 = CH0_VBOT
  - DAC C / 2 = THRESH1
  - DAC D / 3 = CH1_VBOT
  - DAC E / 4 = THRESH2
  - DAC F / 5 = CH2_VBOT
  - DAC G / 6 = THRESH3
  - DAC H / 7 = CH3_VBOT
- Apply single channel.
- Apply all.
- Read back cached DAC values.

Live display:

- Latest singles counts and rates.
- Latest exact coincidence counts and rates.
- Derived total 2-fold rate.
- Derived total 3-fold rate.
- 4-fold rate.
- Temperature.
- Humidity.
- Pressure.

Graphing:

- Plot singles rates over time.
- Plot 2-fold total over time.
- Plot 3-fold total over time.
- Plot 4-fold over time.
- Plot environmental values over time or in separate plots.

Issue detection:

- Warn if no packet for more than 3 report periods.
- Warn if dropped event counter increases.
- Warn if any error flag is nonzero.
- Warn if BME280 read fails.
- Warn if DAC write fails.
- Warn if MAX1932_INT is asserted.

---

## 12. Existing Generated Firmware/Dashboard Zip Notes

A prior zip was generated:

```text
muon_telescope_project.zip
```

It included:

```text
README.txt
firmware/
  CMakeLists.txt
  pico_sdk_import.cmake
  pio/edge_fall.pio
  src/main.c
  src/proto.c/h
  src/bme280.c/h
  src/dac7578.c/h
dashboard/
  index.html
```

Important corrections Codex should apply before using it as final:

1. **RP2350 target**  
   The project may still be RP2040/pico-sdk generic. Update CMake/board target for ColorEasyPico2-RP2350.

2. **MAX1932 pins**  
   Ensure these final defines are used:
   ```c
   #define PIN_SPI_MOSI     20
   #define PIN_SPI_SCLK     21
   #define PIN_MAX1932_INT  22
   #define PIN_MAX1932_SS   26
   ```

3. **DAC labels**  
   Update dashboard labels to match physical DAC channel order:
   ```text
   A/0 = THRESH0
   B/1 = CH0_VBOT
   C/2 = THRESH1
   D/3 = CH1_VBOT
   E/4 = THRESH2
   F/5 = CH2_VBOT
   G/6 = THRESH3
   H/7 = CH3_VBOT
   ```

4. **DAC address**  
   Verify `0x4C`.

5. **BME280 address**  
   Use `0x77`.

6. **Cluster sorting**  
   Verify clustering correctness when events arrive from different PIO FIFOs.

7. **CRC and command ACK handling**  
   Dashboard should handle ACK packets visibly and report command errors.

8. **Clear errors command**  
   Add command to clear latched error flags.

---

## 13. Proposed Hardware Requirements

### 13.1 Detector Inputs

- Four SiPM inputs.
- Each channel supports Hamamatsu S13360-2050VE.
- Each channel should include proper bias feed and signal extraction.
- Each channel should include RF preamp and comparator.

### 13.2 HV Requirements

- Generate approximately 56 V SiPM bias.
- Bias adjustable/configurable if possible.
- Low ripple after filtering.
- Per-channel isolation.
- Safe discharge path for HV capacitors.
- Test points for HV_RAW, HV_QUIET, and at least one channel bias node.
- Appropriate creepage/clearance for 56 V and production margin.

### 13.3 Analog Front-End Requirements

- Four identical channels.
- Comparator outputs active-low.
- Hysteresis included or supported.
- DAC thresholds routed cleanly.
- Comparator output series resistors to MCU.
- Analog layout kept away from LEDs, USB, and switching nodes.

### 13.4 Digital Requirements

- RP2350 module with USB connection.
- GPIO16-19 reserved for comparator inputs.
- GPIO4/5 reserved for I2C.
- GPIO20/21/22/26 reserved for MAX1932.
- GPIO6-13 available for LEDs/buttons.

### 13.5 I2C Requirements

- BME280 and DAC7578 share I2C bus.
- Pull-ups sized appropriately for bus capacitance, commonly 2.2k-10k depending on layout.
- Route I2C away from sensitive analog input if possible.
- Provide test pads if space allows.

### 13.6 DAC Requirements

- Eight DAC outputs routed to thresholds and VBOT/reference nodes.
- DAC reference/supply decoupled cleanly.
- Output filtering may be added if comparator threshold noise is problematic.
- Verify output voltage range matches comparator threshold needs.

### 13.7 UI / Controls Requirements

- At least two buttons and two RGB/status LEDs are useful but optional.
- LEDs must include resistors.
- Buttons use pull-ups and switch to ground.
- LED currents should not return through analog front-end ground paths.

### 13.8 Power Requirements

USB-powered mode:

```text
USB → module → VSYS → MAX1932
USB → module regulator → 3V3 → sensors/DAC/logic
```

Future solar/LiPo mode:

```text
Maxeon 125 mm solar cell
→ solar LiPo charger / power-path manager
→ LiPo
→ VSYS
→ module 3V3 regulator
```

Do not back-power 3V3.

---

## 14. Proposed PCB Layout Requirements

Critical layout priorities:

1. **SiPM to preamp path must be short.**
2. **Preamp input node must be guarded from digital noise.**
3. **Comparator threshold/reference traces should be quiet.**
4. **MAX1932 switching loop should be compact and isolated.**
5. **HV filtering should be physically near MAX1932 output and SiPM distribution.**
6. **Per-channel HV RC isolation should be near each SiPM or bias branch.**
7. **Comparator outputs to RP2350 should be short and not routed near analog inputs.**
8. **LED/button currents should stay on the digital side.**
9. **Use solid ground plane where possible, with careful analog return planning.**
10. **Do not route switching regulator or LED currents under SiPM/preamp nodes.**

Recommended placement order per channel:

```text
SiPM connector/pad
→ preamp components
→ comparator
→ RP2350 input pin
```

Recommended power placement:

```text
VSYS entry / module
→ MAX1932 input decoupling
→ MAX1932 switching components
→ HV filter
→ HV distribution
```

---

## 15. Validation and Test Requirements

### 15.1 Bring-Up Tests

Before connecting SiPMs:

1. Verify 3V3 rail.
2. Verify VSYS rail.
3. Verify I2C bus scan sees BME280 and DAC7578.
4. Verify DAC outputs with multimeter.
5. Verify BME280 readings.
6. Verify USB CDC/Web Serial connection.
7. Verify command/ACK protocol.
8. Inject synthetic active-low pulses into CH0-CH3.
9. Verify singles and exact coincidence counts.
10. Verify MAX1932 disabled/safe state before HV test.

### 15.2 HV Tests

1. Power MAX1932 with no SiPM load.
2. Confirm HV output range.
3. Measure HV ripple before/after filter.
4. Verify safe discharge.
5. Verify per-channel HV nodes.
6. Confirm no unexpected coupling into comparator outputs.

### 15.3 Detector Tests

1. Connect SiPMs with conservative thresholds.
2. Sweep threshold and record dark rate.
3. Record singles in dark/covered condition.
4. Record scintillator muon singles.
5. Test 2-fold coincidences with stacked paddles.
6. Compare rates versus expected cosmic-ray geometry.
7. Record rate versus temperature/pressure.

### 15.4 Firmware Tests

Synthetic pulse tests should cover:

- Each individual channel.
- Each exact 2-fold combination.
- Each exact 3-fold combination.
- 4-fold combination.
- Pulses just inside the window.
- Pulses just outside the window.
- Rapid repeated pulses.
- Timestamp wrap if practical.
- High-rate event drop behavior.

---

## 16. Open Design Questions

Codex should not assume these are finalized unless the schematic confirms them.

1. Does the MAX1932 output include the intended pi filter?
2. Are all four per-channel HV isolation RC networks present?
3. What is the final DAC7578 I2C address?
4. What is the final DAC channel-to-net mapping?
5. Is comparator hysteresis implemented, and at what level?
6. Are comparator outputs truly active-low on final hardware?
7. Are there series resistors between comparator outputs and RP2350 inputs?
8. Is the RP2350 board target defined correctly in firmware?
9. Are LEDs/buttons assigned exactly as suggested or changed?
10. Will future solar/LiPo power be included on this PCB or later revision?
11. Are there test points for HV, DAC outputs, comparator outputs, I2C, and power rails?
12. Is there a safe HV discharge path?

---

## 17. Near-Term Codex Task List

Recommended immediate tasks:

1. Update firmware pin defines to final RP2350 mapping.
2. Update dashboard DAC labels to physical DAC channel order.
3. Add `CLEAR_ERRORS` command.
4. Add visible command ACK/error display in dashboard.
5. Add derived totals:
   - total exact 2-fold
   - total exact 3-fold
   - exact 4-fold
6. Add environmental graphs.
7. Confirm or improve PIO timestamp/cluster ordering.
8. Add unit tests or host-side simulator for exact-subset counting.
9. Add build instructions specifically for ColorEasyPico2-RP2350.
10. Add a hardware bring-up checklist to README.
11. Add constants for BME280 address `0x77` and DAC7578 address placeholder.
12. Add compile-time firmware version and protocol version packet.

---

## 18. Current Definition of Done for First Working Prototype

A first successful prototype should demonstrate:

1. USB powers the board.
2. VSYS powers MAX1932 input safely.
3. 3V3 powers logic, BME280, and DAC7578.
4. BME280 reports plausible temperature, humidity, and pressure.
5. DAC outputs all eight programmed setpoints.
6. Comparator outputs can be injected or triggered.
7. RP2350 counts active-low falling edges on CH0-CH3.
8. Exact-subset coincidence counts are correct.
9. Web Serial dashboard connects reliably.
10. Dashboard can change report period/window/holdoff.
11. Dashboard can set DAC channels.
12. Report packet includes counts, BME280, DAC codes, dropped events, error flags, and uptime.
13. No event drops at expected detector rates.
14. SiPM HV is stable and low-ripple enough for threshold triggering.
15. Muon coincidences can be observed with stacked scintillator paddles.

---

## 19. Summary of Latest Design State

The project is currently defined as:

```text
A 4-channel SiPM cosmic-ray muon telescope using EJ-200 scintillator,
WLS fiber, Hamamatsu S13360-2050VE SiPMs, MAX1932 HV bias,
BFR93A RF preamps, fast active-low comparators, ColorEasyPico2-RP2350
PIO edge capture, BME280 environmental sensing, DAC7578 programmable
threshold/baseline control, and USB CDC/Web Serial reporting.
```

Current data product:

```text
Periodic report with:
- raw singles CH0-CH3
- exact 2-fold subset counts
- exact 3-fold subset counts
- exact 4-fold subset count
- temperature
- humidity
- pressure
- DAC setpoints
- dropped event count
- error flags
- uptime
```

Current most important engineering risks:

```text
HV ripple/noise
analog front-end stability
comparator threshold noise
PIO event ordering
DAC channel mapping mismatch
RP2350 SDK/board target details
real-world SiPM dark rate and temperature behavior
```

Most important next action:

```text
Finalize schematic pin/net consistency, then bring up firmware with synthetic pulses
before connecting SiPMs and enabling HV.
```
