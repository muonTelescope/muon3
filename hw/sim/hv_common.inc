* MC34063 boost core (behavioural, per TI SLLS636N): switch enabled during the oscillator charge phase
* while FB < 1.25 V; current limit (0.3 V / Rsc) latches the switch off for the rest of the cycle.
V5 v5 0 5
Rsc v5 ipk 1
Vsen ipk ipk2 0
L1 ipk2 lx 150u
Rdcr lx sw 2.4
Vosc osc 0 PULSE(0 1 0 10n 10n 26u 30u)
Blatch 0 lat I = ( v(osc) < 0.5 ) ? (1 - v(lat)) * 1m : ( ( i(Vsen) > 0.3 ) ? -v(lat) * 1m : 0 )
Clat lat 0 1n IC=1
Rlat lat 0 1G
Bgate graw 0 V = ( v(osc) > 0.5 && v(fb) < 1.25 && v(lat) > 0.5 ) ? 1 : 0
Rg graw g 1k
Cg g 0 20p
Gsw sw 0 cur = v(sw) * v(g) / 2 + v(sw) * 1e-9
D1 sw raw LL4148
.model LL4148 D(IS=2.5n N=1.9 RS=0.6 CJO=4p TT=5n BV=100)
Craw raw 0 1.1u
L2 raw hvl 1m
Rl2 hvl hv 20
Chv hv 0 1u
Rmon hv 0 2.075Meg
* one tile channel: 47k / 100n, SiPM dark current ~4 uA at 25 C (S12572-015, EST)
Rj1 hv j1 47k
Cj1 j1 0 100n
Ij1 j1 0 4u
V33 v33 0 3.3
