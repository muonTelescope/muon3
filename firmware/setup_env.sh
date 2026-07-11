#!/bin/zsh
# Muon3 Toolchain Environment (modern versions)
export PATH="/opt/homebrew/bin:$PATH"
export PATH="$HOME/Library/Python/3.14/bin:$PATH"

echo "Muon3 environment loaded."
echo "Gateware tools: yosys, nextpnr-ice40, icepack, iceprog"
echo "Firmware tools: arm-none-eabi-gcc, west, nrfutil, cmake, ninja"
echo ""
echo "Usage:"
echo "  source physics/firmware/setup_env.sh"
echo "  cd physics/gateware && make"
echo "  cd physics/firmware && west build ..."
