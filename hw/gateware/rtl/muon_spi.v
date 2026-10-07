// SPI mode 0, MSB first within bytes. SCK <= clk/25. CS setup/hold >= 5 clocks.
// The entire SPI engine runs on clk; external pins are synchronized first.
module muon_spi (
    input wire clk,
    input wire reset,
    input wire cs_n,
    input wire sck,
    input wire mosi,
    output wire miso,
    input wire [191:0] event_data,
    input wire event_valid,
    input wire [511:0] status_data,
    input wire snapshot_ack,
    output reg snapshot_request,
    output reg pop,
    output reg acquisition_reset
);
    (* ASYNC_REG = "TRUE" *) reg [2:0] cs_sync, sck_sync, mosi_sync;
    wire selected = !cs_sync[2];
    wire sck_rise = sck_sync[1] && !sck_sync[2];
    wire sck_fall = !sck_sync[1] && sck_sync[2];
    reg [7:0] command_shift;
    reg [2:0] command_bits;
    reg responding;
    reg is_event;
    reg is_status, is_reset, load_response;
    reg waiting_snapshot;
    reg shift_byte, shift_bit;
    reg reserved_valid;
    reg [9:0] response_bits;
    reg [9:0] sent_bits;
    reg [2:0] bit_index;
    reg [519:0] snapshot;
    reg miso_bit;
    reg done;
    wire [7:0] command = {command_shift[6:0], mosi_sync[2]};
    // Tri-state only at device top-level; this signal is safe to route through
    // an SB_IO output-enable when sharing the bus with another slave.
    assign miso = selected ? miso_bit : 1'b0;
    // Registered requests isolate the wide snapshot bank from SPI edge decode.
    // Its contents are not used before an explicit load, so no bank-wide reset.
    always @(posedge clk) begin
        if (load_response) begin
            if (is_event) snapshot <= {320'b0, event_data, 7'b0, event_valid};
            else if (is_status) snapshot <= {8'b0, status_data};
            else snapshot <= is_reset ? 520'hac : 520'hff;
        end else if (shift_byte)
            snapshot <= {8'b0, snapshot[519:8]};
        else if (shift_bit)
            snapshot[7:0] <= {snapshot[6:0], 1'b0};
    end
    always @(posedge clk) begin
        if (reset) begin
            cs_sync <= 3'b111;
            sck_sync <= 0;
            mosi_sync <= 0;
            command_shift <= 0;
            command_bits <= 0;
            responding <= 0;
            is_event <= 0;
            is_status <= 0;
            is_reset <= 0;
            load_response <= 0;
            waiting_snapshot <= 0;
            snapshot_request <= 0;
            shift_byte <= 0;
            shift_bit <= 0;
            if (waiting_snapshot && snapshot_ack == snapshot_request) begin
                load_response <= 1;
                waiting_snapshot <= 0;
            end
            reserved_valid <= 0;
            response_bits <= 0;
            sent_bits <= 0;
            bit_index <= 7;
            miso_bit <= 0;
            done <= 0;
            pop <= 0;
            acquisition_reset <= 0;
        end else begin
            cs_sync <= {cs_sync[1:0], cs_n};
            sck_sync <= {sck_sync[1:0], sck};
            mosi_sync <= {mosi_sync[1:0], mosi};
            pop <= 0;
            acquisition_reset <= 0;
            load_response <= 0;
            shift_byte <= 0;
            shift_bit <= 0;
            if (load_response) begin
                reserved_valid <= event_valid;
                if (is_event) begin
                    response_bits <= 200;
                end else if (is_status) begin
                    response_bits <= 512;
                end else begin
                    response_bits <= 8;
                    acquisition_reset <= is_reset;
                end
            end
            if (!selected) begin
                command_shift <= 0;
                command_bits <= 0;
                responding <= 0;
                reserved_valid <= 0;
                sent_bits <= 0;
                bit_index <= 7;
                miso_bit <= 0;
                done <= 0;
                waiting_snapshot <= 0;
            end else begin
                if (sck_rise && !done) begin
                    if (!responding) begin
                        command_shift <= command;
                        command_bits <= command_bits + 1'b1;
                        if (command_bits == 7) begin
                            responding <= 1;
                            is_event <= command == 8'h01;
                            is_status <= command == 8'h02;
                            is_reset <= command == 8'h03;
                            waiting_snapshot <= 1;
                            snapshot_request <= ~snapshot_request;
                        end
                    end else begin
                        sent_bits <= sent_bits + 1'b1;
                        if (sent_bits == response_bits - 1'b1) begin
                            done <= 1;
                            if (is_event && reserved_valid)
                                pop <= 1;
                        end
                    end
                end
                // First response bit appears on the command's last falling
                // edge; following bits advance on each subsequent falling edge.
                if (sck_fall && responding && !done) begin
                    miso_bit <= snapshot[7];
                    if (bit_index == 0) begin
                        bit_index <= 7;
                        shift_byte <= 1;
                    end else begin
                        bit_index <= bit_index - 1'b1;
                        shift_bit <= 1;
                    end
                end
            end
        end
    end
endmodule
