# Muon3 Gateware - Modern iCE40 toolchain (2026)
# yosys + nextpnr-ice40 + icestorm

PROJ := muon3_timing
BUILD := build
DEVICE := up5k
PACKAGE := sg48

SRC := top.v
PCF := pinmap.pcf

all: $(BUILD)/$(PROJ).bin

$(BUILD):
	mkdir -p $(BUILD)

$(BUILD)/$(PROJ).json: $(SRC) | $(BUILD)
	yosys -p "synth_ice40 -top top -json $@" $(SRC)

$(BUILD)/$(PROJ).asc: $(BUILD)/$(PROJ).json $(PCF)
	nextpnr-ice40 --$(DEVICE) --package $(PACKAGE) --pcf $(PCF) --json $< --asc $@ --freq 25

$(BUILD)/$(PROJ).bin: $(BUILD)/$(PROJ).asc
	icepack $< $@

clean:
	rm -rf $(BUILD)

# Programming (update programmer as needed for your board)
prog: $(BUILD)/$(PROJ).bin
	iceprog $<

.PHONY: all clean prog
