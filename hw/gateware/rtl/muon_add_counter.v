// Add 0..4 completed pulses per cycle without a full 32-bit ripple adder.
module muon_add_counter (
    input wire clk, reset,
    input wire [2:0] addend,
    output wire [31:0] value
);
    reg [3:0] low;
    wire [4:0] low_sum = {1'b0, low} + addend;
    reg [7:1] full;
    assign value[3:0] = low;
    always @(posedge clk) begin
        if (reset) low <= 0;
        else low <= low_sum[3:0];
    end
    genvar j;
    generate for (j = 1; j < 8; j = j + 1) begin: chunks
        reg [3:0] digit;
        wire increment;
        if (j == 1) assign increment = low_sum[4];
        else assign increment = low_sum[4] && (&full[j-1:1]);
        assign value[j*4 +: 4] = digit;
        always @(posedge clk) begin
            if (reset) begin digit <= 0; full[j] <= 0; end
            else begin
                if (increment) digit <= digit + 1'b1;
                full[j] <= increment ? digit == 4'he : digit == 4'hf;
            end
        end
    end endgenerate
endmodule
