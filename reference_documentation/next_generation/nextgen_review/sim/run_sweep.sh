#!/bin/bash
# $1 = NPE value, $2 = output tag, $3 = VTH, $4 = lib amp (OPA858/OPA356), $5 = Cf
NPE=$1; TAG=$2; VTH=${3:-2.326}; AMP=${4:-OPA858}; CF=${5:-2.2p}
cat > /tmp/run_$TAG.cir << EOT
* auto-generated channel run
.include /home/claude/muon/sim/lib_frontend.lib
.param VBOT=2.40
Vdd  VDD33 0 3.3
Vhv  HVQ   0 32.4
Vvbot VBOTN 0 {VBOT}
Rvb VBOTN VBOTF 1k
Cvb VBOTF 0 100n
Vvth VTHN 0 $VTH
Rvt VTHN VTHF 1k
Cvt VTHF 0 100n
Rhv HVQ CATH 100k
Chv CATH 0 100n
Xsipm IN CATH SIPM_2050VE NPE=$NPE T0=200n
Rser IN INA 10
Dclp1 INA VDD33 DCLAMP
Dclp2 0 INA DCLAMP
.model DCLAMP D(IS=1n CJO=1.5p RS=1)
Xamp VBOTF INA OUT VDD33 0 $AMP
Rf INA OUT 2k
Cf INA OUT $CF
Xcmp OUT VTHF CMPO VDD33 TLV3601
Rgpio CMPO FPGA 33
Cpin FPGA 0 6p
.control
set wr_vecnames
set wr_singlescale
tran 0.05n 900n
wrdata /home/claude/muon/sim/w_$TAG.csv v(out) v(cmpo) v(ina)
.endc
.end
EOT
ngspice -b /tmp/run_$TAG.cir > /tmp/log_$TAG.txt 2>&1
