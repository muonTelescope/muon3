// Exact enabled binary counter. Registered byte-full flags break the long
// carry path; each flag describes its byte's current value, including stalls.
module muon_counter #(parameter WIDTH = 64) (
    input wire clk, reset, enable,
    output wire [WIDTH-1:0] value
);
    localparam BYTES = WIDTH / 8;
    reg [BYTES-1:0] full;
    genvar j;
    generate for (j = 0; j < BYTES; j = j + 1) begin: chunks
        reg [7:0] byte_value;
        wire increment;
        if (j == 0) assign increment = enable;
        else assign increment = enable && (&full[j-1:0]);
        assign value[j*8 +: 8] = byte_value;
        always @(posedge clk) begin
            if (reset) begin
                byte_value <= 0;
                full[j] <= 0;
            end else begin
                if (increment) byte_value <= byte_value + 1'b1;
                full[j] <= increment ? byte_value == 8'hfe : byte_value == 8'hff;
            end
        end
    end endgenerate
endmodule
