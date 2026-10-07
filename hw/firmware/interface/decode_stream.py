#!/usr/bin/env python3
"""Decode prototype JSON lines from stdin or a UDP collector (standard library)."""
import argparse
import json
import socket
import sys


def decode_packet(packet):
    if packet.get("v") != 1:
        raise ValueError("unsupported stream protocol")
    raw = bytes.fromhex(packet["spi_hex"])
    result = {key: packet[key] for key in
              ("v", "epoch", "seq", "software_drops", "udp_errors", "bias_enabled")}
    read = lambda start, size: int.from_bytes(raw[start:start + size], "little")
    if packet["type"] == 1:
        if len(raw) != 26 or raw[1] != 1 or raw[23] & 0xE0 or raw[24:] != b"\0\0":
            raise ValueError("invalid event")
        end = read(2, 8)
        pulses = []
        for channel in range(4):
            if raw[22] & (1 << channel):
                width = read(10 + channel * 3, 3)
                saturated = bool(raw[23] & (1 << channel))
                pulses.append({"channel": channel, "width_ticks": width,
                               "saturated": saturated,
                               "leading_tick": None if saturated else (end - width) % (1 << 64)})
        result.update(type="event", end_tick=end, pulses=pulses,
                      coincidence_mask=raw[22] >> 4 if raw[23] & 16 else None)
    elif packet["type"] == 2:
        if len(raw) != 65 or read(1, 2) != 0x334D or read(3, 2) != 1:
            raise ValueError("invalid status")
        result.update(type="status", clock_hz=read(5, 4), fifo_level=read(9, 2),
                      coincidence_ticks=read(11, 2), ticks=read(13, 8),
                      fifo_full_ticks=read(21, 8), dropped_frames=read(29, 4),
                      dropped_pulses=read(33, 4), dropped_coincidences=read(37, 4),
                      singles=[read(41 + 4 * ch, 4) for ch in range(4)],
                      coincidences=read(57, 4))
    else:
        raise ValueError("unknown packet type")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--udp", type=int, help="listen on UDP port instead of stdin")
    args = parser.parse_args()
    if args.udp:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind(("0.0.0.0", args.udp))
        lines = iter(lambda: sock.recvfrom(2048)[0].decode("utf-8"), None)
    else:
        lines = sys.stdin
    previous = {}
    for line in lines:
        if not line.startswith("{"):
            continue  # skip SDK boot/diagnostic output
        try:
            value = decode_packet(json.loads(line))
            epoch = value["epoch"]
            if epoch in previous:
                delta = (value["seq"] - previous[epoch]) % (1 << 32)
                value["sequence_gap"] = delta - 1 if 0 < delta < (1 << 31) else None
            previous[epoch] = value["seq"]
            print(json.dumps(value), flush=True)
        except (ValueError, KeyError, TypeError) as exc:
            print(f"Discarded malformed packet: {exc}", file=sys.stderr)


if __name__ == "__main__":
    main()
