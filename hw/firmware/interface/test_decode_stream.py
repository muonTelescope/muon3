import unittest
from decode_stream import decode_packet


class DecoderTest(unittest.TestCase):
    def packet(self, kind, raw):
        return dict(v=1, epoch=1, seq=2, type=kind, spi_hex=raw.hex(),
                    software_drops=0, udp_errors=0, bias_enabled=False)

    def test_pulse_reconstruction_and_saturation(self):
        raw = bytearray(26)
        raw[1] = 1
        raw[2:10] = (100).to_bytes(8, "little")
        raw[10:13] = (20).to_bytes(3, "little")
        raw[13:16] = (0xffffff).to_bytes(3, "little")
        raw[22] = 0x33
        raw[23] = 0x12
        event = decode_packet(self.packet(1, raw))
        self.assertEqual(event["pulses"][0]["leading_tick"], 80)
        self.assertIsNone(event["pulses"][1]["leading_tick"])
        self.assertEqual(event["coincidence_mask"], 3)
        with self.assertRaises(ValueError):
            decode_packet(self.packet(1, raw[:-1]))

    def test_status_and_version(self):
        raw = bytearray(65)
        raw[1:5] = bytes.fromhex("4d330100")
        raw[5:9] = (100000000).to_bytes(4, "little")
        raw[29:33] = (17).to_bytes(4, "little")
        status = decode_packet(self.packet(2, raw))
        self.assertEqual(status["clock_hz"], 100000000)
        self.assertEqual(status["dropped_frames"], 17)
        raw[3] = 2
        with self.assertRaises(ValueError):
            decode_packet(self.packet(2, raw))


if __name__ == "__main__":
    unittest.main()
