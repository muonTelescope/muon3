#!/usr/bin/env python3
"""
power_budget.py
Muon3 power consumption estimates (P0 2026-07-11 baseline).
4 channels, USB-C PD (5 V fallback vs 12-20 V).

Outputs table + plots for different operating modes.
"""
import pandas as pd
import matplotlib.pyplot as plt

# All values in mA or mW at the rail shown
data = {
    "Rail": ["5V (fallback)", "12V PD", "3.3V logic", "1.2V FPGA", "HV (~30V)", "TEC (per ch @1.6A)", "Fan (per ch)"],
    "Typical (mA or note)": ["~350 mA total", "~420 mA @12V", "~180 mA", "~120 mA", "~8 mA", "1.6 A @ ~4.5 V", "120 mA @12V"],
    "Power (mW)": [1750, 5040, 594, 144, 240, 7200, 1440],
    "Notes": [
        "No cooling, science only",
        "Full system + margin for bursts",
        "nRF + iCE40 I/O + DACs + BME",
        "FPGA core + PLL",
        "4x bias @ 30 V (very low current)",
        "DRV8873 + CP30238, 4 channels = 28.8 W peak",
        "4x 40 mm tach fans"
    ]
}

df = pd.DataFrame(data)
print(df.to_string(index=False))

# Modes
modes = pd.DataFrame([
    ["Electronics only (5V)", 1.75, 0, 0],
    ["+ HV bias", 2.0, 0, 0],
    ["Full w/ 1x TEC @1.6A (12V)", 2.0, 7.2, 1.44],
    ["Full w/ 3x TEC (12V)", 2.0, 21.6, 4.32],
    ["Full w/ 4x TEC + fans (20V)", 2.5, 28.8, 5.76],
], columns=["Mode", "Electronics (W)", "TEC (W)", "Fans (W)"])

modes["Total (W)"] = modes.iloc[:,1:].sum(axis=1)
print("\n", modes.to_string(index=False))

modes.plot(x="Mode", kind="bar", stacked=True, figsize=(9,5))
plt.ylabel("Power (W)")
plt.title("Muon3 Power Budget by Mode")
plt.xticks(rotation=20, ha="right")
plt.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig("power_budget_modes.png", dpi=130)
print("\nSaved power_budget_modes.png")
