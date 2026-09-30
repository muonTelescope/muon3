# muon3-mv: the Muon3 music video

A Nordic hyperpop video that follows one cosmic-ray muon through every simulation in the repository
(Geant4 tile light, ngspice pulse chain, SiPM bias, board heat, Wi-Fi interference, tile stacking) and ends on the
gLowCost "Now" screen showing live data. 96 s, 1080p30, fframes (Rust + SVG), one generated SVG string per frame.

- Song: ElevenLabs Music, 168 BPM, `media/song.mp3`. Every cut sits on a bar line (`T_*` constants in `src/lib.rs`).
- Numbers: `tools/export_data.py` turns the repo's sim outputs into `src/data.rs` (fiber loop, 12 tile outlines,
  the ngspice pulse, the thermal field, tile-stack rates). The numbers in the text come from the project's README.
- The app screen (`src/app.rs`) is a redraw of the gLowCost-iOs "Now" screen with demo numbers.

```bash
cargo build --release
target/release/muon3_mv frame 40s,80s   # single frames
target/release/muon3_mv render          # out.mp4
```
