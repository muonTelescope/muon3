/*
 * Muon3 Gateware - iCE40UP5K
 * Modern open-source flow: Yosys + nextpnr-ice40 + icestorm
 *
 * Responsibilities (per design):
 * - Capture leading/trailing edges from 8 comparator inputs (4 channels x 2 thresholds)
 * - Exact-subset coincidence logic
 * - Dual-threshold ToT measurement
 * - PPS-disciplined timestamps
 * - Histogramming, livetime, shadow windows for accidentals
 * - SPI slave interface to nRF9151
 * - Configuration registers, calibration control
 *
 * Target: iCE40UP5K-SG48I, 25 MHz TCXO
 */

module top (
    // Comparator inputs (active low from AFE)
    input wire cmp_low_0,
    input wire cmp_high_0,
    input wire cmp_low_1,
    input wire cmp_high_1,
    input wire cmp_low_2,
    input wire cmp_high_2,
    input wire cmp_low_3,
    input wire cmp_high_3,

    // Clocks and sync
    input wire clk_25m,      // TCXO
    input wire pps,          // GNSS PPS

    // SPI to nRF9151 (slave)
    input  wire spi_sck,
    input  wire spi_mosi,
    output wire spi_miso,
    input  wire spi_cs_n,

    // Debug / misc (expand as needed)
    output wire [3:0] debug
);

    // Clock domain
    wire clk = clk_25m;

    // Synchronized comparator inputs (active low)
    reg [7:0] cmp_sync, cmp_sync_d;
    always @(posedge clk) begin
        cmp_sync <= {cmp_high_3, cmp_low_3, cmp_high_2, cmp_low_2,
                     cmp_high_1, cmp_low_1, cmp_high_0, cmp_low_0};
        cmp_sync_d <= cmp_sync;
    end

    // Edge detection (leading edge = falling on active-low)
    wire [7:0] leading = cmp_sync_d & ~cmp_sync;

    // Basic 4ch coincidence (low thresh all, placeholder for exact-subset)
    wire coincidence = &leading[1:0];  // expand to full masks per design

    // PPS edge for timestamp reset
    reg pps_d;
    always @(posedge clk) pps_d <= pps;
    wire pps_rise = pps & ~pps_d;

    // Free running + PPS synced timestamp (48-bit)
    reg [47:0] timestamp;
    always @(posedge clk) begin
        if (pps_rise) timestamp <= 0;
        else timestamp <= timestamp + 1;
    end

    // Simple ToT example for ch0 low (count while asserted)
    reg [15:0] tot0;
    always @(posedge clk) begin
        if (leading[0]) tot0 <= 0;
        else if (!cmp_sync[0]) tot0 <= tot0 + 1;
    end

    // SPI slave stub (for nRF comms - expand to full regmap)
    reg [7:0] spi_shift;
    always @(posedge spi_sck or posedge spi_cs_n) begin
        if (spi_cs_n) spi_shift <= 0;
        else spi_shift <= {spi_shift[6:0], spi_mosi};
    end
    assign spi_miso = spi_shift[7];

    // Debug
    assign debug = {coincidence, pps_rise, |leading[3:0], cmp_sync[0]};

endmodule
