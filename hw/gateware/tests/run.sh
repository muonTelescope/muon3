#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/muon-gateware.XXXXXX")
trap 'rm -rf "$build_dir"' EXIT HUP INT TERM
yosys -Q -T -p "read_verilog -sv rtl/*.v; hierarchy -check -top muon_top; proc; check -assert; write_cxxrtl -g0 $build_dir/muon_top.cc" > "$build_dir/yosys.log"
yosys_data=$(yosys-config --datdir)
"${CXX:-c++}" -std=c++17 -O2 -I"$build_dir" -I"$yosys_data/include/backends/cxxrtl/runtime" tests/test_capture.cc -o "$build_dir/test_capture"
"$build_dir/test_capture"
