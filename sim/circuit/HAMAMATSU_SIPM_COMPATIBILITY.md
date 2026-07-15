# HCal-tile workstation: Hamamatsu S12572 + LT3482 bias

**Design intent:** instrument **decommissioned sPHENIX Inner HCal tile
assemblies** (EJ-200 + dual-end WLS + plastic coupler + **Hamamatsu
S12572-33-015P**).

**Primary electrical path (frozen direction):**

| Block | Choice | JLCPCB / notes |
|-------|--------|----------------|
| SiPM | **S12572-33-015P** | On tile (off-board) |
| HV boost | **LT3482EUD#TRPBF** | **C515895** (preferred over MAX1932) |
| TIA / thresholds | OPA858 + dual TLV3601 | Same architecture as Muon3 AFE |
| Legacy MicroFC path | TPS61170 + MicroFC-30035 | Reference only (`afe_dual_threshold.cir`) |

---

## Why LT3482, not MAX1932

| | MAX1932 | **LT3482 (use this)** |
|--|---------|------------------------|
| JLC/LCSC | C2650346 ETC+T | **C515895** TR / C117167 tube |
| Function | SPI APD bias | **APD boost + high-side current monitor** |
| Vout | 40–90 V class | **to 90 V** |
| New board | Heritage only | **Preferred** |

Behavioral HV model: `hv_lt3482.cir`  
AFE pulse model: `afe_hamamatsu_s12572.cir`  
Part notes: `pcb/parts/hv_lt3482/`, `pcb/parts/sipm_hamamatsu_s12572/`

---

## Device parameters (circuit-relevant)

| Parameter | S12572-33-015P (this design) | MicroFC-30035 (legacy) |
|-----------|------------------------------|-------------------------|
| Bias | **~68–75 V** (LT3482) | ~28–30 V (TPS61170) |
| QPE | **~37 fC** | ~480 fC |
| CT | **~320 pF** | ~850 pF |
| PDE (sim) | **0.25** | ~0.38 |
| Coupling | Dual fiber + 0.75 mm air gap | Single-end loop panel |

---

## AFE implications (same topology, new numbers)

1. **Rf / Cf** — raise Rf (study default **15 kΩ**), retune Cf for CT≈320 pF.  
2. **Thresholds** — recalibrate SPE staircase; do not copy MicroFC DAC codes.  
3. **Clamps** — **not BAV99 (BV=30)** for production 70 V path; higher-BV low-C.  
4. **Passives** — 100 V ceramics on HV; OVP ~85–90 V; HV_MON rescale.  
5. **PCBA** — LT3482 is **Extended** → JLCPCB **Standard** assembly.

What **stays:** OPA858 DC-coupled anode TIA, dual comparators, hybrid connector
idea, charge inject, TEC/NTC thermal control.

---

## Simulation map

| File | Role |
|------|------|
| `afe_hamamatsu_s12572.cir` | **Primary** AFE for HCal tiles |
| `hv_lt3482.cir` | **Primary** HV (~70 V) behavioral model |
| `afe_dual_threshold.cir` | Legacy MicroFC |
| `hv_tps61170.cir` | Legacy ~30 V HV |
| `muon3_frontend.lib` | `S12572_015P` + `MICROFC_30035` subckts |
| Geant4 `hcal_tile` | Optical/PDE model for S12572 |

```bash
cd sim/circuit
ngspice -b hv_lt3482.cir
ngspice -b afe_hamamatsu_s12572.cir
```

---

## Alternates if C515895 stock fails

1. LT3482EUD#PBF **C117167**  
2. LT8361 **C3188138** (100 V general boost)  
3. MAX1932ETC+T **C2650346** (SPI heritage only)
