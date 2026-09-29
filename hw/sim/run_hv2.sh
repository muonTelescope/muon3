#!/bin/sh
# Rev-2 bias output stage, three DAC settings. 0.1 us max step: at 60-85 V the diode conducts for only ~0.35 us per
# pulse, so coarser steps under-count the energy transfer and fake a power limit. Usage: sh run_hv2.sh OUTDIR
OUT=${1:-.}; cd "$(dirname "$0")"
for v in 0 1.0 2.048; do
  n=rev2_dac$v
  sed -e "s|^.end$||" -e "s|^.param VDAC=.*|.param VDAC=$v TEN=10m|" -e "s|.include hv_rev2.inc|.include $(pwd)/hv_rev2.inc|" hv_rev2.cir > "$OUT/hv_$n.cir"
  printf '.save v(hv) v(raw) v(j1) v(tia)\n.control\ntran 0.1u 120m 0 0.1u uic\nmeas tran vend AVG v(hv) FROM=100m TO=120m\nmeas tran hvpp PP v(hv) FROM=100m TO=120m\nmeas tran rawpp PP v(raw) FROM=100m TO=120m\nmeas tran j1pp PP v(j1) FROM=100m TO=120m\nmeas tran tiapp PP v(tia) FROM=100m TO=120m\nmeas tran vmax MAX v(hv)\nlinearize v(hv) v(j1) v(tia)\nwrdata %s/hv_%s.txt v(hv) v(j1) v(tia)\n.endc\n.end\n' "$OUT" "$n" >> "$OUT/hv_$n.cir"
  echo "== $n"; ngspice -b "$OUT/hv_$n.cir" 2>&1 | grep -E "^(vend|hvpp|rawpp|j1pp|tiapp|vmax) "
done
