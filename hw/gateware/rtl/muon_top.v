module muon_top #(
    parameter FIFO_LOG2 = 6,
    parameter CLOCK_HZ = 100000000,
    parameter COINCIDENCE_TICKS = 10
) (
    input wire clk,
    input wire reset,
    input wire [3:0] hit,
    input wire spi_cs_n,
    input wire spi_sck,
    input wire spi_mosi,
    output wire spi_miso,
    output wire irq
);
    wire [191:0] event_data;
    wire valid, pop_slow, acquisition_reset_slow;
    wire [15:0] level;
    wire [63:0] ticks, full_ticks;
    wire [31:0] dropped_frames, dropped_pulses, dropped_coincidences, coincidences;
    wire [127:0] singles;
    (* ASYNC_REG = "TRUE" *) reg [1:0] reset_sync;
    always @(posedge clk or posedge reset) begin
        if (reset) reset_sync <= 2'b11;
        else reset_sync <= {reset_sync[0], 1'b0};
    end
    // Keep the wide serializer in a 25 MHz clock domain. Capture remains at
    // 100 MHz. A bundled-data request/ack bridge holds snapshots until the next
    // request, well beyond the acknowledgement synchronizer's settling time.
    reg [1:0] divider = 0;
    always @(posedge clk) divider <= divider + 1'b1;
    (* keep *) wire read_clk = divider[1];
    (* ASYNC_REG = "TRUE" *) reg [1:0] read_reset;
    always @(posedge read_clk or posedge reset) begin
        if (reset) read_reset <= 2'b11;
        else read_reset <= {read_reset[0], 1'b0};
    end
    wire snapshot_request;
    reg snapshot_ack;
    reg [191:0] event_snapshot;
    reg [511:0] status_snapshot;
    reg valid_snapshot;
    reg pop_toggle, acq_reset_toggle;
    (* ASYNC_REG = "TRUE" *) reg [1:0] request_sync, pop_sync, acq_reset_sync, ack_sync;
    reg pop_previous, acq_reset_previous;
    wire pop = pop_sync[1] ^ pop_previous;
    wire acquisition_reset = acq_reset_sync[1] ^ acq_reset_previous;
    always @(posedge read_clk) begin
        if (read_reset[1]) begin
            ack_sync <= 0;
            pop_toggle <= 0;
            acq_reset_toggle <= 0;
        end else begin
            ack_sync <= {ack_sync[0], snapshot_ack};
            if (pop_slow) pop_toggle <= ~pop_toggle;
            if (acquisition_reset_slow) acq_reset_toggle <= ~acq_reset_toggle;
        end
    end
    always @(posedge clk) begin
        if (reset_sync[1]) begin
            request_sync <= 0;
            pop_sync <= 0;
            acq_reset_sync <= 0;
            pop_previous <= 0;
            acq_reset_previous <= 0;
            snapshot_ack <= 0;
            valid_snapshot <= 0;
        end else begin
            request_sync <= {request_sync[0], snapshot_request};
            pop_sync <= {pop_sync[0], pop_toggle};
            acq_reset_sync <= {acq_reset_sync[0], acq_reset_toggle};
            pop_previous <= pop_sync[1];
            acq_reset_previous <= acq_reset_sync[1];
            if (request_sync[1] != snapshot_ack) begin
                event_snapshot <= event_data;
                status_snapshot <= status;
                valid_snapshot <= valid;
                snapshot_ack <= request_sync[1];
            end
        end
    end
    // Status fields are numeric little-endian, byte zero first.
    wire [511:0] status = {32'b0, coincidences, singles,
        dropped_coincidences, dropped_pulses, dropped_frames,
        full_ticks, ticks, 16'(COINCIDENCE_TICKS), level,
        32'(CLOCK_HZ), 16'h0001, 16'h334d};
    muon_capture #(.FIFO_LOG2(FIFO_LOG2), .COINCIDENCE_TICKS(COINCIDENCE_TICKS)) capture (
        .clk(clk), .reset(reset_sync[1] | acquisition_reset), .hit_async(hit), .pop(pop),
        .event_data(event_data), .event_valid(valid), .fifo_level(level),
        .ticks(ticks), .fifo_full_ticks(full_ticks),
        .dropped_frames(dropped_frames), .dropped_pulses(dropped_pulses),
        .dropped_coincidences(dropped_coincidences), .singles(singles),
        .coincidences(coincidences)
    );
    muon_spi spi (
        .clk(read_clk), .reset(read_reset[1]), .cs_n(spi_cs_n), .sck(spi_sck),
        .mosi(spi_mosi), .miso(spi_miso), .event_data(event_snapshot),
        .event_valid(valid_snapshot), .status_data(status_snapshot), .pop(pop_slow),
        .acquisition_reset(acquisition_reset_slow),
        .snapshot_request(snapshot_request), .snapshot_ack(ack_sync[1])
    );
    assign irq = valid;
endmodule
