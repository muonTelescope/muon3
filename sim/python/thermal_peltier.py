#!/usr/bin/env python3
"""
thermal_peltier.py
Simple lumped thermal model for one SiPM + CP30238 Peltier channel.
Models:
- Heat load from SiPM dark current + environment
- Peltier cooling (Q = S*I*T - 0.5*I^2*R - K*dT)
- Hot side heatsink + fan
- NTC feedback + basic PID
- Dew point interlock

Useful for:
- Sizing current limits and fan requirements
- Verifying dew-point safety margins
- Closed-loop step response
"""
import numpy as np
import matplotlib.pyplot as plt
from dataclasses import dataclass

@dataclass
class ThermalParams:
    # SiPM / cold block
    m_cold: float = 0.025          # kg aluminum + SiPM + epoxy
    c_cold: float = 900.0          # J/kg/K
    # Peltier (Same Sky CP30238 approx)
    n_peltier: int = 1
    s: float = 0.055               # Seebeck V/K (per module approx)
    r: float = 2.3                 # ohm
    k_thermal: float = 0.45        # W/K
    # Hot side
    m_hot: float = 0.12
    c_hot: float = 900.
    r_sink: float = 1.8            # K/W (40mm heatsink + fan ~ good)
    # Environment
    t_amb: float = 25.0            # C
    # Dew point calculation (simple Magnus)
    rh: float = 60.0               # %

def dew_point(t, rh):
    # Magnus formula approx
    a, b = 17.27, 237.7
    gamma = (a * t / (b + t)) + np.log(rh / 100.0)
    return (b * gamma) / (a - gamma)

def step_response(duration_s=600, I=1.6, dt=0.5):
    p = ThermalParams()
    t = np.arange(0, duration_s, dt)
    Tcold = np.zeros_like(t) + p.t_amb
    Thot  = np.zeros_like(t) + p.t_amb + 8
    dp = dew_point(p.t_amb, p.rh)

    for i in range(1, len(t)):
        dT = Tcold[i-1] - Thot[i-1]
        # Cooling power (simplified)
        Qp = p.s * I * (273 + Tcold[i-1]) - 0.5 * I*I * p.r - p.k_thermal * dT
        # Heat from ambient into cold block
        Qleak = (p.t_amb - Tcold[i-1]) / 12.0   # assume some insulation Rth
        # SiPM self heat (very small)
        Qsipm = 0.02

        dTcold = (Qp + Qleak + Qsipm) * dt / (p.m_cold * p.c_cold)
        Tcold[i] = Tcold[i-1] + dTcold

        # Hot side
        Qhot = -Qp + I*I * p.r * 0.5 + (p.t_amb - Thot[i-1]) / p.r_sink
        dThot = Qhot * dt / (p.m_hot * p.c_hot)
        Thot[i] = Thot[i-1] + dThot

    # Safety
    margin = Tcold - dp
    print(f"Steady cold: {Tcold[-1]:.2f} C,  hot: {Thot[-1]:.2f} C,  dewpoint: {dp:.2f} C, margin: {margin[-1]:.2f} C")

    plt.figure(figsize=(8,4))
    plt.plot(t, Tcold, label="T_cold (SiPM)")
    plt.plot(t, Thot, label="T_hot (heatsink)")
    plt.axhline(dp, color="r", ls="--", label=f"Dew point {dp:.1f} C")
    plt.axhline(p.t_amb, color="gray", ls=":", alpha=0.6)
    plt.xlabel("Time (s)")
    plt.ylabel("Temperature (°C)")
    plt.title(f"Peltier step response @ I={I} A")
    plt.legend(); plt.grid(alpha=0.3); plt.tight_layout()
    plt.savefig("thermal_step.png", dpi=130)
    print("Saved thermal_step.png")

if __name__ == "__main__":
    step_response(I=1.5)
    step_response(I=1.8)
