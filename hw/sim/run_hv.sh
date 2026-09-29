#!/bin/sh
# Re-simulate old vs new bias trim, one run at a time, saving only probed nodes (memory-light).
# Usage: sh run_hv.sh OUTDIR
OUT=${1:-.}; cd "$(dirname "$0")"
run() { # name file params tstop avgfrom saves
  sed "s|^.end$||" "$2" > "$OUT/hv_$1.cir"
  printf '%s\n.save %s\n.control\ntran 1u %s 0 1u uic\nmeas tran vend AVG v(hv) FROM=%s TO=%s\nmeas tran vmax MAX v(hv)\nmeas tran j1pp PP v(j1) FROM=%s TO=%s\n%s\nwrdata %s/hv_%s.txt %s\n.endc\n.end\n' \
    "$3" "$6" "$4" "$5" "$4" "$5" "$4" "$7" "$OUT" "$1" "$6" >> "$OUT/hv_$1.cir"
  sed -i '' "s|.include hv_common.inc|.include $(pwd)/hv_common.inc|" "$OUT/hv_$1.cir"
  echo "== $1"; ngspice -b "$OUT/hv_$1.cir" 2>&1 | grep -E "^(vend|vmax|j1pp|tiapp|thv50) "
}
S="v(hv) v(j1)"
# old circuit: power-up with the ESP32 pin high-impedance, caps from 0 V (the reported hazard)
run old_boot  hv_old.cir ".param PWMV=0 HIZ=1 VT0=0"    600m 550m "$S" ""
# old circuit range: pin driven, trim caps pre-charged to the Thevenin value (0.55 V / 3.3 V)
run old_pwm0  hv_old.cir ".param PWMV=0 HIZ=0 VT0=0.55" 60m 40m "$S" ""
run old_pwm33 hv_old.cir ".param PWMV=3.3 HIZ=0 VT0=3.3" 60m 40m "$S" ""
# new circuit: HV_EN low for 20 ms (HV must stay at 0), then enabled; three DAC settings
N="v(hv) v(j1) v(tia)"
M="meas tran tiapp PP v(tia) FROM=60m TO=90m\nmeas tran thv50 WHEN v(hv)=50 RISE=1"
run new_dac0   hv_new.cir ".param VDAC=0 TEN=20m"     90m 60m "$N" "$M"
run new_dac1   hv_new.cir ".param VDAC=1.0 TEN=20m"   90m 60m "$N" "$M"
run new_dac2   hv_new.cir ".param VDAC=2.048 TEN=20m" 90m 60m "$N" "$M"
