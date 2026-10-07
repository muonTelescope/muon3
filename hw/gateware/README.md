# Muon3 hardware acquisition, protocol v1

Four independent discriminator inputs feed a common-clock ToT and coincidence
engine. USB and Wi-Fi transport belong to the ESP32; their interrupt latency does
not determine the FPGA timestamps. This is an acquisition prototype, not a
validated detector or a tomography tracker. The original long-board ESP32
capture design is superseded by the modular controller's FPGA for this revision.

## Timing and detector interpretation

The design requests a **100 MHz external clock** (10 ns bins). Check the recorded
place-and-route result before accepting that clock on hardware. Bin width is not
absolute accuracy: oscillator tolerance, input synchronizers, analog time walk,
comparator jitter, routing skew and metastability all affect measured edges.
No subclock interpolation or time-of-flight direction measurement is implemented.
Hold each discriminator input high and low for at least three acquisition ticks
(30 ns at 100 MHz); shorter pulses can be missed. A two-register synchronizer
feeds both edges of every channel. A common synchronizer delay cancels in nominal
ToT; edge quantization and channel uncertainty still require calibration.

Each pulse records its falling-edge tick and high duration. Its leading tick is
`end_tick - width_ticks[channel]`, unless that width saturated. Width saturates at
16,777,215 ticks and a separate per-channel flag marks overflow. A channel already
high during reset is ignored until it has been observed low. Pulses merge when
the comparator never falls between them; this digital design cannot recover
analog pileup or unobserved subclock pulses.

A fixed coincidence window starts on the first observed rising edge and includes
that tick and the next nine ticks. A rising edge exactly ten ticks later starts a
new window. Windows do not extend, and a channel contributes only one mask bit.
At closure, masks containing at least two different channels produce a coincidence
record. Require mask `0xf` for four-plane candidates; there is no claim that any
coincidence is necessarily a muon. A coincidence record's timestamp is its closing
tick, so its first rising tick is `end_tick - coincidence_ticks`. Every completed
pulse is also kept independently, including singles. Four edges completing on one
tick share a record without channel arbitration loss. The four tile readouts do
not supply the spatial information required for track-based muon tomography.

## Buffering and exposure accounting

The FIFO holds 64 records of 24 bytes. It accepts one combined record per clock.
If full, it drops the newest record while counters continue. Full plus simultaneous
pop accepts the new record. `dropped_frames`, `dropped_pulses` and
`dropped_coincidences` make losses visible; a frame can contain multiple pulses
and a coincidence together. `singles[4]` counts observed rising edges even when
the FIFO is full. Counters other than ticks/full-ticks wrap modulo 2^32.

`ticks` is elapsed acquisition time; `fifo_full_ticks` counts clocks with a full
FIFO at cycle start. The latter is **not calibrated detector dead time** or a
correction to subtract from exposure. Acquisition is not inhibited, and FIFO
fullness cannot describe analog pileup, missing narrow pulses or channel-specific
efficiency. Log losses explicitly, flag affected intervals, and measure detector
efficiency separately. There is no calibrated "live time" output.

At 5 MHz SPI, a 26-byte event transaction takes at least 41.6 microseconds, before
chip-select gaps and firmware overhead. Sustained output is therefore below
24,038 records/s. IRQ is a level signal asserted while records remain. Use a
dedicated high-priority drain task, with USB/Wi-Fi consuming a separate software
queue. Test dark-rate and noise conditions on hardware; no loss-free rate is
promised from the FIFO depth alone.

## Connections and reset

See `muon3_up5k_sg48.pcf`, matching the modular controller source. All FPGA signal
banks are 3.3 V. The ADC/comparator frontend must supply compatible logic; SiPM
bias never connects to FPGA pins. The runtime SPI bus is dedicated to this slave;
MISO is driven low when deselected, not tri-stated. Configuration SPI is separate.
ESP32 holds active-high acquisition reset (FPGA pin 31) high until the oscillator,
power supplies and FPGA configuration are ready, then drives low. A board pullup
keeps acquisition in reset while the ESP32 pin is unconfigured. FPGA configuration
reset on pin 8 is a different signal.

## SPI framing

Mode 0, MSB first within every byte, **SCK at most acquisition clock / 20**.
CS setup and hold must each be at least five acquisition clocks. Keep CS asserted
for an entire command and its response; deassert between commands. No command
chaining is supported. SPI is synchronized into the acquisition domain.

| Command | Full-duplex transaction | Behavior |
|---|---|---|
| `0x01` | 1 command + 1 availability + 24 event bytes | Atomic event read |
| `0x02` | 1 command + 64 status bytes | Atomic status snapshot |
| `0x03` | 1 command + 1 byte `0xac` response | Clears acquisition FIFO and all counters; starts a new epoch |
| Other | 1 command + 1 byte `0xff` | No side effects |

Ignore MISO during the command byte. Subsequent MOSI bytes are don't-care.
One acquisition tick after command `0x01` is decoded, the FIFO head and its availability are copied into
a private snapshot. Availability is `0x01` when present, `0x00` when absent.
Only the rising SCK edge of the final response bit commits a pop. CS release at
any earlier point preserves the head for retry. A snapshot taken while empty
does not consume a later arrival. Extra clocks after the expected response have
no effect. Reset `0x03` takes effect as soon as its command byte is received,
even if its response is aborted; reset deliberately invalidates earlier records.

All multibyte quantities below are unsigned little-endian. SPI still transmits
each individual byte most-significant bit first. Never cast bytes to packed C
structures; use the checked decoder in `../firmware/interface/muon_protocol.h`.

### Event payload (24 bytes, after availability)

| Offset | Bytes | Meaning |
|---|---|---|
| 0 | 8 | Common falling-edge / coincidence-close tick |
| 8, 11, 14, 17 | 3 each | Width for channels 0, 1, 2, 3; valid only when corresponding pulse-mask bit is set |
| 20 | 1 | Bits 3:0 pulse mask; bits 7:4 coincidence mask |
| 21 | 1 | Bits 3:0 saturated width mask; bit 4 coincidence-valid; bits 7:5 zero |
| 22 | 2 | Reserved zero |

### Status snapshot (64 bytes)

| Offset | Bytes | Meaning |
|---|---|---|
| 0 | 2 | Magic `0x334d` (bytes `M3`) |
| 2 | 2 | Protocol version 1 |
| 4 | 4 | Configured clock frequency in Hz; not a frequency measurement |
| 8 | 2 | FIFO record count |
| 10 | 2 | Coincidence window ticks |
| 12 | 8 | Acquisition elapsed ticks |
| 20 | 8 | FIFO-full ticks |
| 28 | 4 | Dropped records |
| 32 | 4 | Dropped completed pulses |
| 36 | 4 | Dropped coincidence records |
| 40, 44, 48, 52 | 4 each | Rising-edge singles per channel |
| 56 | 4 | Coincidences observed, including dropped ones |
| 60 | 4 | Reserved zero |

On ESP-IDF, send one 26-byte full-duplex transaction for an event and one 65-byte
transaction for status; fill TX with zeros and put the command in byte zero.
The C decoder takes the complete RX buffer. Set SPI mode 0 and enforce CS timing.
Check magic/version/clock on connection, reset explicitly for each new run, and
log that reset as a new acquisition epoch. The interface header is portable C;
the source prototype in `../firmware` includes SPI draining, FPGA SRAM loading,
USB serial and optional Wi-Fi UDP. Target compilation, calibrated analog startup,
and validation on the board remain integration work.

## Build and verification

```sh
sh hw/gateware/tests/run.sh
sh hw/gateware/build.sh
```

Tests require Yosys with CXXRTL headers and a C++17 compiler. They execute the
actual synthesized RTL model, covering same-tick four-channel pulses, width,
coincidence boundaries, reset during a pulse, saturation, full FIFO loss/recovery,
atomic SPI abort/retry, arrival during empty reads, reset command, and 25 seeded
random pulse schedules compared with independent pulse/window reference models.
The firmware decoder is exercised on the real simulated SPI bytes.

The hardware build requires Yosys, nextpnr-ice40 and IceStorm. It targets the
iCE40UP5K-SG48 and fails if the 100 MHz timing requirement is not met. Build outputs
are ignored local artifacts. A successful compile or simulation is not hardware
validation. Before releasing boards: review electrical pin mapping and startup,
inspect CDC placement and synchronizers, constrain/test input timing, inject known
pulses across clock phases, calibrate ToT/time walk, test maximum noise burst rate,
and verify USB/Wi-Fi draining and reset recovery on the assembled controller.
