module muon_width (
    input wire clk, reset, start, enable,
    output wire [23:0] value,
    output reg saturated
);
    reg [2:0] full;
    wire advance = enable && !(&full);
    genvar j;
    generate for (j = 0; j < 3; j = j + 1) begin: chunks
        reg [7:0] byte_value;
        wire increment;
        if (j == 0) assign increment = advance;
        else assign increment = advance && (&full[j-1:0]);
        assign value[j*8 +: 8] = byte_value;
        always @(posedge clk) begin
            if (reset || start) begin
                byte_value <= !reset && j == 0 ? 8'd1 : 8'd0;
                full[j] <= 0;
            end else begin
                if (increment) byte_value <= byte_value + 1'b1;
                full[j] <= increment ? byte_value == 8'hfe : byte_value == 8'hff;
            end
        end
    end endgenerate
    always @(posedge clk) begin
        if (reset || start) saturated <= 0;
        else if (enable && (&full)) saturated <= 1;
    end
endmodule
