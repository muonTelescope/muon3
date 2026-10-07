#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p build
yosys -Q -T -p 'read_verilog -sv rtl/*.v; synth_ice40 -device u -top muon_top -json build/muon3.json; stat' > build/synthesis.log
nextpnr-ice40 --up5k --package sg48 --json build/muon3.json --pcf muon3_up5k_sg48.pcf --asc build/muon3.asc --freq 100 --pre-pack clocks.py --report build/timing.json > build/place_route.log 2>&1
icepack build/muon3.asc build/muon3.bin
printf 'Built build/muon3.bin; review build/place_route.log and board revision before programming.\n'
