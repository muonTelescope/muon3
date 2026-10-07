// Four-channel, common-clock ToT and fixed-window coincidence acquisition.
// No delay-line TDC: all reported measurements have one clk tick granularity.
module muon_capture #(
    parameter FIFO_LOG2 = 6,
    parameter COINCIDENCE_TICKS = 10
) (
    input wire clk,
    input wire reset,
    input wire [3:0] hit_async,
    input wire pop,
    output wire [191:0] event_data,
    output wire event_valid,
    output wire [15:0] fifo_level,
    output wire [63:0] ticks,
    output wire [63:0] fifo_full_ticks,
    output wire [31:0] dropped_frames,
    output wire [31:0] dropped_pulses,
    output wire [31:0] dropped_coincidences,
    output wire [127:0] singles,
    output wire [31:0] coincidences
);
    localparam DEPTH = 1 << FIFO_LOG2;
    (* ASYNC_REG = "TRUE" *) reg [3:0] hit_meta, hit_sync;
    reg [3:0] hit_previous;
    reg [3:0] armed;
    reg [2:0] warmup;
    wire [3:0] rising = hit_sync & ~hit_previous & armed;
    wire [3:0] falling = ~hit_sync & hit_previous & armed;
    wire [23:0] width [0:3];
    wire [3:0] width_overflow;
    wire [31:0] single_count [0:3];
    reg window_active;
    localparam WINDOW_BITS = COINCIDENCE_TICKS > 1 ? $clog2(COINCIDENCE_TICKS) : 1;
    reg [WINDOW_BITS-1:0] window_age;
    reg [3:0] window_mask;
    wire close_window = window_active && window_age == COINCIDENCE_TICKS - 1;
    wire multiple = (window_mask & (window_mask - 1'b1)) != 0;
    wire coin = close_window && multiple;
    reg produce;
    reg [191:0] pending_frame;
    reg [2:0] pending_pulses;
    reg pending_coin;
    reg lost_frame, lost_coin;
    reg [2:0] lost_pulse_count;
    reg [191:0] fifo [0:DEPTH-1];
    reg [FIFO_LOG2-1:0] read_ptr, write_ptr;
    reg [FIFO_LOG2:0] count;
    wire take = pop && count != 0;
    wire accept = produce && (count < DEPTH || take);
    muon_counter elapsed_count (.clk(clk), .reset(reset), .enable(1'b1), .value(ticks));
    muon_counter full_count (.clk(clk), .reset(reset), .enable(count == DEPTH), .value(fifo_full_ticks));
    muon_counter #(.WIDTH(32)) coin_count (.clk(clk), .reset(reset), .enable(coin), .value(coincidences));
    muon_counter #(.WIDTH(32)) lost_count (.clk(clk), .reset(reset), .enable(lost_frame), .value(dropped_frames));
    muon_counter #(.WIDTH(32)) lost_coins (.clk(clk), .reset(reset), .enable(lost_coin), .value(dropped_coincidences));
    muon_add_counter lost_pulses (.clk(clk), .reset(reset),
        .addend(lost_pulse_count), .value(dropped_pulses));
    genvar channel;
    generate for (channel = 0; channel < 4; channel = channel + 1) begin: count_channels
        muon_counter #(.WIDTH(32)) counter (.clk(clk), .reset(reset), .enable(rising[channel]), .value(single_count[channel]));
        muon_width duration (.clk(clk), .reset(reset), .start(rising[channel]),
            .enable(hit_sync[channel] && armed[channel]), .value(width[channel]),
            .saturated(width_overflow[channel]));
    end endgenerate
    // Numeric wire layout: byte zero (bits 7:0) is transmitted first over SPI.
    wire [191:0] frame = {19'b0, coin, width_overflow & falling,
        (coin ? window_mask : 4'b0), falling,
        width[3], width[2], width[1], width[0], ticks};
    // Contents are deliberately unspecified when empty; validity is separate.
    assign event_data = fifo[read_ptr];
    assign event_valid = count != 0;
    assign fifo_level = count;
    assign singles = {single_count[3], single_count[2], single_count[1], single_count[0]};
    always @(posedge clk) begin
        if (reset) begin
            hit_meta <= 0;
            hit_sync <= 0;
            hit_previous <= 0;
            armed <= 0;
            warmup <= 0;
            window_active <= 0;
            window_age <= 0;
            window_mask <= 0;
            read_ptr <= 0;
            write_ptr <= 0;
            count <= 0;
            produce <= 0;
            pending_frame <= 0;
            pending_pulses <= 0;
            pending_coin <= 0;
            lost_frame <= 0;
            lost_coin <= 0;
            lost_pulse_count <= 0;
        end else begin
            produce <= (|falling) || coin;
            pending_frame <= frame;
            pending_pulses <= {2'b0, falling[0]} + {2'b0, falling[1]} + {2'b0, falling[2]} + {2'b0, falling[3]};
            pending_coin <= coin;
            lost_frame <= produce && !accept;
            lost_coin <= produce && !accept && pending_coin;
            lost_pulse_count <= produce && !accept ? pending_pulses : 3'b0;
            hit_meta <= hit_async;
            hit_sync <= hit_meta;
            hit_previous <= hit_sync;
            // Suppress partial pulses already high at reset. A channel must
            // first reach low through the entire synchronizer before arming.
            warmup <= {warmup[1:0], 1'b1};
            if (warmup[2])
                armed <= armed | ~(hit_sync | hit_previous);
            // Window includes its first rising tick and the next W-1 ticks.
            // A rise on closure begins a new window; windows never extend.
            if (!window_active || close_window) begin
                window_active <= |rising;
                window_mask <= rising;
                window_age <= 0;
            end else begin
                window_age <= window_age + 1'b1;
                window_mask <= window_mask | rising;
            end
            if (accept) begin
                fifo[write_ptr] <= pending_frame;
                write_ptr <= write_ptr + 1'b1;
            end
            if (take)
                read_ptr <= read_ptr + 1'b1;
            case ({accept, take})
                2'b10: count <= count + 1'b1;
                2'b01: count <= count - 1'b1;
                default: count <= count;
            endcase
        end
    end
endmodule
