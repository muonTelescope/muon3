# Muon3 parts research library

This directory follows the older `mppcInterface/pcb/components/` convention: one
subdirectory per important component family, with vendor data sheets and a short
selection note stored next to the part.

Research date: 2026-07-11.

JLCPCB/LCSC stock changes quickly. Treat the selected parts as the current
engineering baseline, not as a permanent purchasing guarantee. Before ordering,
re-run the BOM through JLCPCB assembly and reserve all low-stock extended parts.

## Recommended baseline

| Function | Preferred part | JLC/LCSC status captured so far | Why this is the baseline |
| --- | --- | --- | --- |
| SiPM | **Hamamatsu S12572-33-015P** | Off-board on decommissioned HCal tiles | Primary for HCal-tile workstation; sPHENIX dual-end WLS MPPC. |
| TIA | OPA858IDSGR | `C970232`, JLC assembly-supported in prior audit | Best fit for low-capacitance SiPM current pulse timing; requires correct biasing and tight RF layout. |
| Comparator | TLV3601IDBVR | Stock not yet confirmed | Excellent timing reference: 325 MHz class, ns-scale propagation. Needs a stocked pin-compatible build option before release. |
| Threshold/HV DAC | DAC60508ZRTET plus spare trim DAC | DAC60508 stock not yet confirmed | 8 threshold channels in one device; use extra DAC channels for HV trim, offset, and thermal setpoints. |
| SiPM HV | **LT3482EUD#TRPBF** | **`C515895`**, expand library | APD bias to 90 V for S12572 ~70 V; preferred over MAX1932. See `hv_lt3482/`. |
| USB-C PD | CH224K | `C970725`, stocked in prior audit | Simple fixed PD sink; request 12 V for Peltier headroom with 5 V fallback mode. |
| 3.3 V buck | TPS62933 family | JLC catalog ID still to confirm | 3.8-30 V input, 3 A output, good 12 V USB-PD fit, sane thermal margin for LTE bursts. |
| FPGA | iCE40UP5K-SG48I | `C2678152`, stocked in prior audit | Retains deterministic coincidence and timestamp logic from the existing design direction. |
| Cellular/GNSS | nRF9151-LACA-R7 | `C22397843`, Standard PCBA/X-ray in prior audit | User-selected LTE-M/NB-IoT/GNSS part; removes carrier-header uncertainty. |
| Flash | W25Q128JVSIQ | Catalog entry must be refreshed before order | Common SPI configuration/data flash; ample capacity for FPGA images and logs. |
| Peltier driver | DRV8873HPWPR | `C2150604`, low-stock extended in prior audit | Bidirectional current-regulated H-bridge with diagnostics; one per channel. |
| Atmosphere | BME280 | `C92489`, stocked in prior audit | Pressure/humidity/temperature support for rate corrections. |
| RF coax | BWU.FL-IPEX1 | `C5137195`, stocked in prior audit | Use only for LTE/GNSS RF with grounded shell, never for exposed SiPM HV. |

## Remaining release blockers

- Confirm exact JLC orderable numbers for TPS62933, DAC60508, TLV3601,
  USB-C receptacle, nano-SIM holder, MFF2 eSIM, panel connector, NTC, TVS,
  fuse/eFuse, and exact power inductors.
- Decide whether the comparator threshold DACs should be one DAC60508 plus a
  smaller trim DAC, or two DAC60508 devices for maximum symmetry and spares.
- Select a touch-safe panel connector family that carries SiPM bias, signal,
  NTC, and Peltier current without putting HV on an exposed coax shield.
- Complete a real Peltier power budget. USB-C operation is practical, but only
  if firmware limits cooling by negotiated PD contract and temperature.
- Verify nRF9151 reference circuitry, RF matching, SIM/eSIM options, and antenna
  layout against Nordic's product-specification web bundle.
- Re-run live JLCPCB assembly checks immediately before schematic freeze.

## Downloaded source documents

- `afe_opa858/OPA858.pdf`
- `comparator_tlv3601/TLV3601.pdf`
- `dac_dac60508/DAC60508.pdf`
- `environment_bme280/BME280.pdf`
- `flash_w25q128/W25Q128JV.pdf`
- `hv_tps61170/TPS61170.pdf` (legacy MicroFC ~30 V path only)
- `hv_lt3482/README.md` (HCal-tile primary HV — download LT3482 datasheet at freeze)
- `peltier_drv8873/DRV8873.pdf`
- `power_3v3_tps62933/TPS62933.pdf`
- `sipm_hamamatsu_s12572/README.md` (HCal-tile primary SiPM)
- `sipm_microfc_30035/MicroC-Series.pdf` (legacy loop-panel reference)
- `radio_nrf9151/nRF9151-product-specification.html`

Vendor portals that blocked automated download are still listed in the relevant
part notes with source URLs.
