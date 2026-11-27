# Look experiments

Alternative visual directions, each on its own branch (`look/NAME`, from
`pinball`). Only the renderer changes: the gameplay is the same, so every
sheet shows the same moments. All of them in one numbered image, to share:
[all-looks.jpg](all-looks.jpg). Frames, left to right and top to bottom:

1. t=1 s: the intro, close to the orrery
2. t=9 s: play
3. t=20.6 s: multiball starts (planets aligned, shockwave)
4. t=26.4 s: a jackpot on the sun
5. t=33 s: multiball
6. t=61.5 s: game over, flying back to the orrery

| Look | Branch | Idea |
|---|---|---|
| [Baseline](baseline.jpg) | `pinball` | The current look: warm wood, brass, a night sky inlay. |
| [Neon arcade](neon.jpg) | `look/neon` | Black glossy table; every collider outlined in neon (from the 2D distance field), a faint grid, cyan to magenta, strong bloom. |
| [Golden hour](godrays.jpg) | `look/godrays` | A low warm key light from the side (long shadows, dusty light), haze, and god rays from the sun (a radial blur toward its position on screen). |
| [Obsidian and gold](obsidian.jpg) | `look/obsidian` | A black mirror table with gold seams, polished gold, studio light strips in the reflections, blue anamorphic lens streaks. |
| [Toy miniature](miniature.jpg) | `look/miniature` | Daylight, pastel painted wood, a tilt-shift blur: the table looks like a toy on a desk. |
| [Arcade CRT](crt.jpg) | `look/crt` | Curved tube, scanlines, an RGB shadow mask, a rounded bezel. Post only. |
| [Film noir](noir.jpg) | `look/noir` | Black and white, a hard light through venetian blinds, only the lamps and the sun keep their color, letterbox, heavy grain. |
