* MC34063 boost core, rev 2 output stage: Ipk 0.3 V / 2.2 ohm = 136 mA, RC post-filter (no LC resonance).
* X7R 1 uF/100 V caps derated to 0.4 uF at 70-80 V DC bias [EST from typical X7R curves].
V5 v5 0 5
Rsc v5 ipk 2.2
Vsen ipk ipk2 0
L1 ipk2 lx 150u
Rdcr lx sw 2.4
Vosc osc 0 PULSE(0 1 0 10n 10n 26u 30u)
Blatch 0 lat I = ( v(osc) < 0.5 ) ? (1 - v(lat)) * 1m : ( ( i(Vsen) > 0.136 ) ? -v(lat) * 1m : 0 )
Clat lat 0 1n IC=1
Rlat lat 0 1G
Bgate graw 0 V = ( v(osc) > 0.5 && v(fb) < 1.25 && v(lat) > 0.5 ) ? 1 : 0
Rg graw g 1k
Cg g 0 20p
Gsw sw 0 cur = v(sw) * v(g) / 2 + v(sw) * 1e-9
D1 sw raw LL4148
.model LL4148 D(IS=2.5n N=1.9 RS=0.6 CJO=4p TT=5n BV=100)
Craw raw 0 0.44u
Rpost raw hv 10k
Chv hv 0 0.4u
Rmon hv 0 2.075Meg
Rj1 hv j1 47k
Cj1 j1 0 100n
Ij1 j1 0 4u
V33 v33 0 3.3
