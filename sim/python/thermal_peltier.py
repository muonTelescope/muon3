#!/usr/bin/env python3
"""
thermal_peltier.py (rev 2)
Lumped thermal model for one SiPM + CP30238 Peltier channel.

Fixes and improvements over rev 1:
- SIGN CONVENTION FIXED. Rev 1 added the Peltier cooling term to the
  cold block (heating it) and subtracted it from the hot side; the
  steady states it printed were unphysical.
- TEC parameters are now DERIVED from the CP30238 datasheet corner
  values with the standard single-stage extraction (Th = 300 K):
      S = Vmax/Th
      R = Vmax(Th - dTmax)/(Imax Th)
      K = Vmax Imax (Th - dTmax)/(2 Th dTmax)
  giving S=28.7 mV/K, R=2.24 ohm (datasheet-measured 2.07-2.53 ohm),
  K=0.152 W/K. Rev 1 used guessed S=55 mV/K and K=0.45 W/K.
- Adds a steady-state current sweep (delta-T and electrical power vs I),
  a PI temperature loop with dew-point-limited setpoint, and a dark-rate
  improvement estimate (SiPM DCR roughly halves per 8-10 degC cooling).

Outputs: ../plots/thermal_step.png, ../plots/thermal_sweep.png
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from dataclasses import dataclass

PLOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "plots")
os.makedirs(PLOTS, exist_ok=True)


@dataclass
class ThermalParams:
    # SiPM + aluminum cold block
    m_cold: float = 0.025          # kg
    c_cold: float = 900.0          # J/kg/K
    # CP30238 (derived from Vmax=8.6 V, Imax=3 A, dTmax=66 K at Th=300 K)
    s: float = 8.6 / 300.0                       # 0.0287 V/K
    r: float = 8.6 * (300 - 66) / (3 * 300.0)    # 2.24 ohm
    k_thermal: float = 8.6 * 3 * (300 - 66) / (2 * 300.0 * 66)  # 0.152 W/K
    # Hot side: 40x40x20 mm heatsink + 40 mm fan
    m_hot: float = 0.12            # kg aluminum
    c_hot: float = 900.0
    r_sink: float = 1.8            # K/W with fan running
    r_sink_fan_off: float = 8.0    # K/W natural convection (interlock case)
    # Cold-cavity insulation leak
    r_leak: float = 12.0           # K/W ambient -> cold block
    q_sipm: float = 0.02           # W (SiPM self-heating, ~nA dark current)
    # Environment
    t_amb: float = 25.0            # degC
    rh: float = 60.0               # % relative humidity


def dew_point(t, rh):
    """Magnus-Tetens approximation."""
    a, b = 17.27, 237.7
    gamma = (a * t / (b + t)) + np.log(rh / 100.0)
    return (b * gamma) / (a - gamma)


def derivatives(tc, th, I, p, fan_ok=True):
    """Correct-sign lumped TEC model. tc/th in degC, returns dTc/dt, dTh/dt."""
    tc_k, th_k = tc + 273.15, th + 273.15
    qc = p.s * I * tc_k - 0.5 * I * I * p.r - p.k_thermal * (th - tc)
    qh = p.s * I * th_k + 0.5 * I * I * p.r - p.k_thermal * (th - tc)
    qleak = (p.t_amb - tc) / p.r_leak
    rs = p.r_sink if fan_ok else p.r_sink_fan_off
    dtc = (qleak + p.q_sipm - qc) / (p.m_cold * p.c_cold)
    dth = (qh - (th - p.t_amb) / rs) / (p.m_hot * p.c_hot)
    return dtc, dth


def tec_voltage(tc, th, I, p):
    return p.s * (th - tc) + I * p.r


def step_response(I, duration_s=900, dt=0.25, p=None):
    p = p or ThermalParams()
    t = np.arange(0, duration_s, dt)
    tc = np.full_like(t, p.t_amb)
    th = np.full_like(t, p.t_amb)
    for i in range(1, len(t)):
        dtc, dth = derivatives(tc[i - 1], th[i - 1], I, p)
        tc[i] = tc[i - 1] + dtc * dt
        th[i] = th[i - 1] + dth * dt
    return t, tc, th


def steady_state(I, p=None):
    p = p or ThermalParams()
    _, tc, th = step_response(I, duration_s=2500, dt=0.5, p=p)
    return tc[-1], th[-1]


def pi_loop(setpoint_offset=-20.0, duration_s=900, dt=0.25, p=None,
            kp=0.8, ki=0.02, i_max=2.5):
    """PI current control to a dew-point-limited cold setpoint."""
    p = p or ThermalParams()
    dp = dew_point(p.t_amb, p.rh)
    setpoint = max(p.t_amb + setpoint_offset, dp + 3.0)  # dew-point interlock
    t = np.arange(0, duration_s, dt)
    tc = np.full_like(t, p.t_amb)
    th = np.full_like(t, p.t_amb)
    cur = np.zeros_like(t)
    integ = 0.0
    for i in range(1, len(t)):
        err = tc[i - 1] - setpoint
        integ = np.clip(integ + err * dt, -60, 60)
        I = float(np.clip(kp * err + ki * integ, 0.0, i_max))
        cur[i] = I
        dtc, dth = derivatives(tc[i - 1], th[i - 1], I, p)
        tc[i] = tc[i - 1] + dtc * dt
        th[i] = th[i - 1] + dth * dt
    return t, tc, th, cur, setpoint, dp


def main():
    p = ThermalParams()
    dp = dew_point(p.t_amb, p.rh)
    print(f"CP30238 derived params: S={p.s*1e3:.1f} mV/K  R={p.r:.2f} ohm  "
          f"K={p.k_thermal:.3f} W/K")
    print(f"Ambient {p.t_amb:.0f} C at {p.rh:.0f}% RH -> dew point {dp:.1f} C\n")

    # --- Step responses ---
    fig, ax = plt.subplots(figsize=(8, 4.2))
    currents = [1.0, 1.5, 1.8, 2.4]
    print(" I(A)   Tcold(C)  Thot(C)  dT(C)   V(V)   Pelec(W)  dew margin(C)")
    for I in currents:
        t, tc, th = step_response(I)
        ax.plot(t, tc, label=f"T_cold @ {I:.1f} A")
        ax.plot(t, th, ls=":", color=ax.lines[-1].get_color(), alpha=0.7)
        tcs, ths = tc[-1], th[-1]
        v = tec_voltage(tcs, ths, I, p)
        print(f"{I:5.1f}  {tcs:8.1f} {ths:8.1f} {p.t_amb-tcs:6.1f} "
              f"{v:6.2f}  {v*I:8.2f}  {tcs-dp:8.1f}")
    ax.axhline(dp, color="r", ls="--", lw=1, label=f"dew point {dp:.1f} C")
    ax.axhline(dp + 3, color="r", ls=":", lw=0.8, label="interlock floor (dp+3)")
    ax.axhline(p.t_amb, color="gray", ls=":", alpha=0.6)
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Temperature (degC)")
    ax.set_title("CP30238 step response (solid: cold block, dotted: heatsink)")
    ax.legend(fontsize=7, ncol=2)
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "thermal_step.png"), dpi=130)
    plt.close(fig)
    print("\nSaved plots/thermal_step.png")

    # --- Steady-state sweep ---
    Is = np.linspace(0.2, 3.0, 15)
    dts, pels, margins = [], [], []
    for I in Is:
        tcs, ths = steady_state(I)
        dts.append(p.t_amb - tcs)
        pels.append(tec_voltage(tcs, ths, I, p) * I)
        margins.append(tcs - dp)
    fig, ax1 = plt.subplots(figsize=(7, 4.2))
    ax1.plot(Is, dts, "o-", color="#1565c0", label="dT below ambient")
    ax1.set_xlabel("TEC current (A)")
    ax1.set_ylabel("Cold-block drop below ambient (K)", color="#1565c0")
    ax1.grid(alpha=0.3)
    ax2 = ax1.twinx()
    ax2.plot(Is, pels, "s--", color="#e65100", label="electrical power")
    ax2.set_ylabel("TEC electrical power (W)", color="#e65100")
    ax1.axvline(2.5, color="k", ls=":", lw=0.8)
    ax1.text(2.52, min(dts), "ITRIP ceiling", rotation=90, fontsize=7, va="bottom")
    ax1.set_title("CP30238 steady state vs current "
                  f"(leak {p.r_leak:.0f} K/W, sink {p.r_sink:.1f} K/W)")
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "thermal_sweep.png"), dpi=130)
    plt.close(fig)
    print("Saved plots/thermal_sweep.png")

    # Optimum region summary
    i_best = Is[int(np.argmax(dts))]
    print(f"\nMax dT = {max(dts):.1f} K at {i_best:.2f} A "
          f"(diminishing returns past ~2 A; Joule heating dominates)")

    # --- PI loop with dew-point limit ---
    t, tc, th, cur, sp, dp2 = pi_loop()
    fig, (axa, axb) = plt.subplots(2, 1, figsize=(8, 5.2), sharex=True)
    axa.plot(t, tc, label="T_cold")
    axa.plot(t, th, label="T_hot", alpha=0.7)
    axa.axhline(sp, color="g", ls="--", lw=0.9, label=f"setpoint {sp:.1f} C")
    axa.axhline(dp2, color="r", ls="--", lw=0.9, label=f"dew point {dp2:.1f} C")
    axa.set_ylabel("degC")
    axa.legend(fontsize=7)
    axa.grid(alpha=0.3)
    axb.plot(t, cur, color="#6a1b9a")
    axb.set_ylabel("TEC current (A)")
    axb.set_xlabel("Time (s)")
    axb.grid(alpha=0.3)
    axa.set_title("PI loop to dew-point-limited setpoint (interlock: sp >= dp+3)")
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "thermal_pi_loop.png"), dpi=130)
    plt.close(fig)
    print("Saved plots/thermal_pi_loop.png")

    # --- Dark-rate benefit estimate ---
    # SiPM DCR roughly halves per 8-10 degC of cooling (vendor app notes /
    # published SiPM characterization; exact slope must be measured).
    tcs, _ = steady_state(1.5)
    drop = p.t_amb - tcs
    for per in (8.0, 10.0):
        print(f"DCR reduction at 1.5 A (dT={drop:.0f} K), x0.5 per {per:.0f} K: "
              f"factor {2 ** (drop / per):.1f}")

    # --- Additional analyses: leak sensitivity + worst-case + system trade-off ---
    print("\n=== Additional thermal analyses ===")

    # 1. Heat leak sensitivity (fixed I=1.6 A, vary r_leak)
    I_test = 1.6
    leaks = [4, 8, 12, 20, 40]  # K/W (very leaky to well insulated)
    print("r_leak (K/W)   Tcold   dT   Pelec(W)  dew_margin")
    leak_dts = []
    for rl in leaks:
        p2 = ThermalParams(r_leak=rl)
        tc2, th2 = steady_state(I_test, p=p2)
        v2 = tec_voltage(tc2, th2, I_test, p2)
        pel2 = v2 * I_test
        marg2 = tc2 - dew_point(p2.t_amb, p2.rh)
        leak_dts.append(p.t_amb - tc2)
        print(f"  {rl:4.0f}        {tc2:5.1f}  {p.t_amb-tc2:5.1f}   {pel2:6.2f}     {marg2:5.1f}")

    # Plot leak sensitivity
    fig, ax = plt.subplots(figsize=(7, 3.8))
    ax.plot(leaks, leak_dts, 'o-', color='#2e7d32')
    ax.set_xlabel('Cold-side leak resistance R_leak (K/W)')
    ax.set_ylabel(f'Cold block dT below ambient @ {I_test:.1f} A (K)')
    ax.set_title('Sensitivity to parasitic heat leak (higher R = better insulation)')
    ax.grid(alpha=0.3)
    ax.axvline(12, color='gray', ls=':', label='nominal model')
    ax.legend(fontsize=7)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, 'thermal_leak_sweep.png'), dpi=130)
    plt.close(fig)
    print("Saved plots/thermal_leak_sweep.png")

    # 2. Worst-case ambient (hot + humid day)
    p_worst = ThermalParams(t_amb=35.0, rh=80.0)
    dp_worst = dew_point(p_worst.t_amb, p_worst.rh)
    tc_w, th_w = steady_state(1.5, p=p_worst)
    print(f"\nWorst-case (35 C, 80% RH): dew point = {dp_worst:.1f} C")
    print(f"  With 1.5 A: Tcold={tc_w:.1f} C (dT={p_worst.t_amb-tc_w:.1f} K), margin over dew = {tc_w - dp_worst:.1f} K")

    # 3. Rough system-level trade-off (4 channels)
    # Assume nominal DCR reduction valuable, scint yield ~ -0.3 %/K (typical plastic)
    # Power cost from power_budget
    print("\n4-channel system example (nominal leak):")
    for I in [0.0, 1.0, 1.5, 1.8]:
        tcs, _ = steady_state(I)
        dT = p.t_amb - tcs
        dcr_factor = 2 ** (dT / 9.0)   # approx
        yield_gain = 1 + 0.003 * dT    # rough +0.3%/K cooling
        p_tec_4ch = 4 * (tec_voltage(tcs, p.t_amb + 15, I, p) * I + 1.44)  # +fans rough
        print(f"  I={I:.1f}A  dT={dT:.0f}K  DCR x{1/dcr_factor:.1f}  yield~{yield_gain:.2f}x  4ch+fan ~{p_tec_4ch:.1f} W")

    print("\nKey requirements takeaway:")
    print(" - Target 15-25 K cooling for good DCR reduction (factor ~4-8) and gain stability.")
    print(" - Requires good insulation (R_leak >~10 K/W) and fan-cooled sink.")
    print(" - Must enforce dew-point interlock; open-loop over-cool is dangerous.")
    print(" - 4ch cooling is the dominant power consumer (20-35 W); science mode viable without it.")


if __name__ == "__main__":
    main()
