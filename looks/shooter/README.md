# Look experiments (shooter)

Alternative visual directions, each on its own branch (`look/shooter-NAME`,
from `shooter`). Only the renderer changes: the gameplay is the same, so every
sheet shows the same moments of the same bot run. All of them in one numbered
image, to share: [all-looks.jpg](all-looks.jpg). Frames, left to right:

1. t=1.5 s: the start hall
2. t=5.5 s: the cistern's bridge, a shaft of light
3. t=9 s: a fight in the ramp room, an ammo crate, a hit
4. t=15.5 s: a spitter in the crypt
5. t=40 s: a fight in the tower, by the pylon
6. t=62 s: the crypt on lap 3, its neon dead

| # | Look | Branch | Idea |
|---|---|---|---|
| 1 | [Baseline: neon](baseline.jpg) | `shooter` | The current look: dark stone, neon tubes in a color per room, cold fog, wet floors. |
| 2 | [Hellfire](hellfire.jpg) | `look/shooter-hellfire` | Quake-like torchlight: the tubes are flickering fire, warm stone, a smoky red fog, orange shafts of light, embers rising in the air, warm contrasty grading. |
| 3 | [Abyss](abyss.jpg) | `look/shooter-abyss` | Underwater: teal water that absorbs the red with distance, caustics moving on every surface, rows of bioluminescent spores instead of tubes, marine snow, a wobbling lens. |
| 4 | [Vector](vector.jpg) | `look/shooter-vector` | Demoscene vector style: black surfaces drawn only by glowing grid lines in each room's color (2 m and 0.5 m), glowing creases, black mirror floors, white-hot tubes, heavy bloom. The grid dies with the neon on later laps. |
| 5 | [Ink](ink.jpg) | `look/shooter-ink` | Inverted onto paper: black outlines where the depth changes (the scene pass writes its depth in alpha), lights as ink blots, hatching in the midtones, red ink for red (enemies, danger). The HUD is inked too. |
| 6 | [1-bit](1bit.jpg) | `look/shooter-1bit` | Two colors on a 360-line grid of big pixels, 4x4 ordered dithering, depth outlines; only strong red is kept. |
| 7 | [Thermal](thermal.jpg) | `look/shooter-thermal` | A thermal camera: the scene pass writes a heat value in alpha (enemies white-hot, the gun warm, walls cool, warmer corners), a blurry sensor, an "ironbow" palette, noise and scanlines. Enemies can't hide. |
| 8 | [Gilded](gilded.jpg) | `look/shooter-gilded` | A sunlit temple: pale stone, polished black marble floors with veins (mirror reflections), gold trims instead of tubes, wide golden god rays, a warm haze. The black enemies stand out against the light. |
| 9 | [Drowned](drowned.jpg) | `look/shooter-drowned`, now `shooter` | Chosen: the Abyss mood without the underwater cues (no wobble, no snow, weaker absorption), with Gilded's black marble floors, caustics dimming with your light. |

The captures come from the editor (`out\cat-debug.exe --capture ... 1.5 5.5 9 15.5 40 62`)
at 1280x720, with the bot.
