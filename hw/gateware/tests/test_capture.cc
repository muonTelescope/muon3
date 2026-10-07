#include "muon_top.cc"
#include "../../firmware/interface/muon_protocol.h"
#include <array>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <random>
#include <stdexcept>
#include <vector>

static void require(bool condition, const char *message) {
    if (!condition) throw std::runtime_error(message);
}
static uint64_t le(const std::vector<uint8_t> &v, int offset, int n) {
    uint64_t out = 0;
    for (int i = 0; i < n; ++i) out |= uint64_t(v.at(offset + i)) << (8 * i);
    return out;
}
struct Bench {
    cxxrtl_design::p_muon__top dut;
    void tick(int n = 1) {
        for (int i = 0; i < n; ++i) {
            dut.p_clk.set(false); dut.step();
            dut.p_clk.set(true); dut.step();
        }
    }
    void hits(int bits, int cycles) { dut.p_hit.set(bits); tick(cycles); }
    void reset(int initial_hit = 0) {
        dut.p_spi__cs__n.set(true);
        dut.p_spi__sck.set(false);
        dut.p_spi__mosi.set(false);
        dut.p_hit.set(initial_hit);
        dut.p_reset.set(true); tick(5);
        dut.p_reset.set(false); tick(24);
    }
    void begin() { dut.p_spi__cs__n.set(false); tick(50); }
    void end() { dut.p_spi__cs__n.set(true); tick(50); }
    uint8_t byte(uint8_t data) {
        uint8_t out = 0;
        for (int i = 7; i >= 0; --i) {
            dut.p_spi__mosi.set(bool((data >> i) & 1)); tick(50 + (i % 3));
            dut.p_spi__sck.set(true);
            out = (out << 1) | dut.p_spi__miso.get<bool>();
            tick(50 + (i % 2));
            dut.p_spi__sck.set(false); tick(50);
        }
        return out;
    }
    std::vector<uint8_t> transfer(uint8_t command, int length) {
        begin(); byte(command);
        std::vector<uint8_t> bytes;
        while (length--) bytes.push_back(byte(0));
        end(); return bytes;
    }
    std::vector<uint8_t> status() {
        auto v = transfer(2, 64);
        auto wire = v; wire.insert(wire.begin(), 0);
        muon_status decoded{};
        require(muon_decode_status(wire.data(), wire.size(), &decoded), "C status decoder");
        require(decoded.fifo_level == le(v, 8, 2), "C FIFO level");
        require(decoded.ticks == le(v, 12, 8), "C status ticks");
        require(!muon_decode_status(wire.data(), wire.size() - 1, &decoded), "C truncated status");
        return v;
    }
    std::vector<uint8_t> event() {
        auto v = transfer(1, 25);
        require(v[0] == 1, "event absent");
        auto wire = v; wire.insert(wire.begin(), 0);
        muon_event decoded{};
        require(muon_decode_event(wire.data(), wire.size(), &decoded), "C event decoder");
        require(decoded.end_tick == le(v, 1, 8), "C event ticks");
        require(decoded.width_ticks[0] == le(v, 9, 3), "C event width");
        require(!muon_decode_event(wire.data(), wire.size() - 1, &decoded), "C truncated event");
        return {v.begin() + 1, v.end()};
    }
    bool irq() { return dut.p_irq.get<bool>(); }
};

int main() {
  try {
    Bench b;
    b.reset();
    auto s = b.status();
    require(le(s, 0, 2) == 0x334d && le(s, 2, 2) == 1, "status identity/version");
    require(le(s, 4, 4) == 100000000 && le(s, 10, 2) == 10, "clock/window metadata");
    require(le(s, 8, 2) == 0 && !b.irq(), "reset must empty FIFO");
    require(b.transfer(1, 25)[0] == 0 && !b.irq(), "empty event read");
    require(b.transfer(0x99, 1)[0] == 255, "unknown opcode response");

    // All four falling edges on one tick must survive in a single frame.
    b.hits(15, 20); b.hits(0, 15);
    auto coin = b.event();
    require(coin[20] == 0xf0 && coin[21] == 0x10, "four-way coincidence");
    auto pulse = b.event();
    require(pulse[20] == 15 && pulse[21] == 0, "four simultaneous pulses");
    for (int ch = 0; ch < 4; ++ch)
        require(le(pulse, 8 + 3 * ch, 3) == 20, "ToT width");
    require(le(pulse, 0, 8) - le(coin, 0, 8) == 10, "coincidence closes at W ticks");
    require(!b.irq(), "drain IRQ");
    s = b.status();
    require(le(s, 56, 4) == 1, "coincidence counter");
    for (int ch = 0; ch < 4; ++ch) require(le(s, 40 + 4 * ch, 4) == 1, "singles");

    // Abort at any byte before final payload completion must retain the head.
    b.hits(1, 7); b.hits(0, 20);
    for (int n : {0, 1, 10, 24}) {
        b.transfer(1, n);
        require(b.irq(), "aborted event read consumed data");
        require(le(b.status(), 8, 2) == 1, "abort changed FIFO count");
    }
    pulse = b.event();
    require(le(pulse, 8, 3) == 7 && !b.irq(), "atomic completed read");

    // Events arriving during an empty snapshot must not get popped by it.
    b.begin(); b.byte(1);
    b.hits(2, 5); b.hits(0, 20);
    require(b.byte(0) == 0, "snapshot valid must remain false");
    for (int i = 0; i < 24; ++i) b.byte(0);
    b.end(); require(b.irq(), "empty snapshot consumed newly arrived event");
    pulse = b.event(); require(pulse[20] == 2, "concurrent event preserved");
    b.hits(4, 5); b.hits(0, 20);
    require(b.transfer(3, 1)[0] == 0xac, "reset opcode response");
    require(!b.irq() && le(b.status(), 48, 4) == 0, "SPI reset clears acquisition");

    // Arrival at t0+9 joins a 10-tick window; t0+10 starts the next.
    for (int spacing : {9, 10}) {
        b.reset(); b.hits(1, 3); b.hits(0, spacing - 3);
        b.hits(2, 3); b.hits(0, 20);
        int coins = 0;
        while (b.irq()) {
            auto e = b.event();
            if (e[21] & 0x10) { ++coins; require((e[20] >> 4) == 3, "boundary mask"); }
        }
        require(coins == (spacing == 9 ? 1 : 0), "half-open coincidence boundary");
    }

    // Overflow: no acquisition backpressure, explicit exact loss accounting.
    b.reset();
    for (int i = 0; i < 80; ++i) { b.hits(1, 3); b.hits(0, 12); }
    s = b.status();
    require(le(s, 8, 2) == 64, "FIFO depth");
    require(le(s, 28, 4) == 16 && le(s, 32, 4) == 16, "overflow counts");
    require(le(s, 20, 8) > 0 && le(s, 40, 4) == 80, "full-time and acquisition counters");
    for (int i = 0; i < 64; ++i) b.event();
    require(!b.irq(), "FIFO drain after overflow");
    b.hits(1, 4); b.hits(0, 15);
    require(le(b.event(), 8, 3) == 4, "FIFO recovers after overflow");

    // Reset while input high must discard the partial pulse, then rearm.
    b.reset(1); b.hits(1, 8); b.hits(0, 15);
    require(!b.irq() && le(b.status(), 40, 4) == 0, "reset partial pulse counted");
    b.hits(1, 6); b.hits(0, 15);
    require(le(b.event(), 8, 3) == 6, "rearm after partial pulse");

    b.reset(); b.hits(1, 0x1000003); b.hits(0, 15);
    pulse = b.event();
    require(le(pulse, 8, 3) == 0xffffff && (pulse[21] & 1), "ToT saturation flag");

    // Seeded asynchronous channel schedules compared to independent pulse and
    // fixed-window reference models; collect fewer than 64 frames per batch.
    std::mt19937 rng(0x4d554f4e);
    for (int batch = 0; batch < 25; ++batch) {
        b.reset();
        std::array<std::vector<int>, 4> expected, actual;
        std::array<int, 4> remaining{}, gaps{};
        std::vector<int> expected_coins, actual_coins;
        int mask = 0, window_start = -100, window_mask = 0;
        for (int t = 0; t < 180; ++t) {
            int next = mask;
            for (int ch = 0; ch < 4; ++ch) {
                if (remaining[ch] > 0) {
                    if (--remaining[ch] == 0) { next &= ~(1 << ch); gaps[ch] = 5 + rng() % 30; }
                } else if (gaps[ch] > 0) --gaps[ch];
                else if (t < 130) {
                    remaining[ch] = 3 + rng() % 23;
                    expected[ch].push_back(remaining[ch]); next |= 1 << ch;
                }
            }
            int rise = next & ~mask;
            if (window_mask && t == window_start + 10) {
                if ((window_mask & (window_mask - 1)) != 0) expected_coins.push_back(window_mask);
                window_mask = 0;
            }
            if (rise) {
                if (!window_mask) window_start = t;
                window_mask |= rise;
            }
            b.hits(next, 1); mask = next;
        }
        b.tick(15);
        require(le(b.status(), 28, 4) == 0, "random batch overflow");
        while (b.irq()) {
            auto e = b.event();
            for (int ch = 0; ch < 4; ++ch)
                if (e[20] & (1 << ch)) actual[ch].push_back(le(e, 8 + 3 * ch, 3));
            if (e[21] & 0x10) actual_coins.push_back(e[20] >> 4);
        }
        require(actual == expected, "random pulse model mismatch");
        require(actual_coins == expected_coins, "random coincidence model mismatch");
    }
    std::cout << "PASS: identity, SPI atomic/abort/empty-concurrent reads, simultaneous hits, ToT,\n"
                 "coincidence boundaries, FIFO overflow/recovery, reset-high, 25 seeded random batches.\n";
    return EXIT_SUCCESS;
  } catch (const std::exception &e) {
    std::cerr << "FAIL: " << e.what() << '\n';
    return EXIT_FAILURE;
  }
}
