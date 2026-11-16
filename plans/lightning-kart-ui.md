# Lightning Kart, UI polish: Horizon Chase 2 feel, The Karters 2 karts

Status: DONE

## Why

The game plays well now but looks like a prototype: a dark navy stage, the browser's default
font, one blue button, a grey road under a flat blue sky, and a kart drawn from above that
never reads as a kart. The owner wants the look settled before phase 2 adds the gacha and the
collection, so those screens are born in the final style instead of being restyled later.

The grilling ran on 2026-11-10 in five rounds. Outcome: the race world, the HUD and the
menus take their feel from Horizon Chase 2; the karts are redrawn after The Karters 2, from
the reference image beside this plan; the driving and the timing of every effect stay as
they are.

## Behaviour

Once done, a person opening Lightning Kart sees:

| Where | What changes |
| --- | --- |
| Every screen | A bold condensed typeface, skewed panels and buttons with slanted stripe accents, saturated orange, magenta, cyan and yellow over a sunset gradient. |
| The race world | A sunset sky with a sun, a skyline on the horizon that slides as the kart turns, a glowing stripe along the road edge, a faint hex paving on the road, and palm trees, signs and billboards beside the road. |
| The kart | Seen from behind, as in a chase camera. Wide and short with four fat tyres, a two-colour body, twin exhausts, a chibi driver whose helmet and hat show above the kart, a soft shadow under it. The three karts keep their names and identities. |
| Boost and drift | The nitro flame comes out of both exhausts, blue-white, with speed lines and a darkened screen edge. Drifting puffs tyre smoke and sparks from the inside rear wheel over the skid marks. |
| The HUD | Lap top-left with an empty slot where the position will go in phase 3. Race time and best time top-right. Two slanted nitro cells bottom-right that fill when a right answer stores a charge and flash when one is fired. No speedometer. The question panel is a skewed panel at the bottom of the stage, so the road stays in view. |
| The Garage | Same picks as today, one chip per character and one per kart, in the new style. |
| The Result | Same content as today in the new style, kept plain because phase 3 rebuilds it for ten racers. |

Nothing changes in how the kart drives, how fast anything is, how long any effect lasts, or
how a question works.

## Decisions

| Question | Decision |
| --- | --- |
| What "Horizon Chase 2 feel" means | Skewed parallelogram panels and buttons with slanted stripe accents; saturated flat colours (orange, magenta, cyan, yellow) over sunset gradient backgrounds; the race world outside the road; the HUD; the boost and drift effects. Written as a style sheet in the design file. |
| Font | One self-hosted woff2 under the SIL Open Font License, loaded with the FontFace API before Phaser boots, used for all canvas text. Oswald, because question text is sentences and needs a true lowercase, which Bebas Neue lacks. The Angular shell keeps its own font. |
| Screens in scope | Home, Scope, Garage, Ready, Race HUD, question panel, Result. Result minimal. |
| Refactor first | The HUD, the feedback effects and the question panel leave the Race scene into their own files; the catalogue and racer drawing move into a `look/` folder with a reusable picker. Steps 1 and 2, before any pixel changes. |
| Feel boundary | Colours, fonts, sizes and shapes anywhere in the UI constants may change. No duration or power in the effects block, and nothing in the kart, world, boost, camera or engine constants. |
| World through the windscreen | Sky gradient with a sun, a horizon skyline strip that slides with the camera heading, roadside props as depth-scaled sprites, all drawn by code. Prop positions are data on the track definition, two or three kinds. |
| One theme | One coastal sunset theme in the road constants. Theme per track waits for phase 4 and more tracks. |
| Kart redesign | Same three karts, same ids, same part data and portrait drawing, redrawn. Never rename an id. |
| Boost look | Flame and speed lines restyled, a short edge vignette added. Timings untouched. |
| Drift look | Tyre smoke puffs and sparks at the inside rear wheel, over the skid marks, same timing rules as the dust. Horizon Chase 2 has no drift, so this is ours. |
| HUD layout | Lap and an empty position slot top-left, race time and best top-right, two nitro cells bottom-right, question panel at the bottom (the owner moved it from the centre on 2026-11-10: a centred panel hid the road). |
| Speedometer | Removed. Round 5 reversed the round 4 arc gauge: the owner wants none. |
| Nitro cells | Stay bottom-right on their own as two slanted blocks that fill when a charge is stored and flash when fired. The only sign of a stored charge. |
| No image assets | Everything drawn by code. The font is the one file. |
| Transitions | None. Scenes change with a plain start. The slide was built in step 4 and removed the same day on the owner's call. |
| Fixed stage | 960 by 540 scaled to fit, no responsive layouts. |
| Sound | Out of scope. Music and new sounds are a later row in the design file's phases table. |
| Verification | Specs stay green; the owner approves each screen by playing before its step is ticked. No screenshot tests. |
| Kart or car | Open kart, driver visible, car styling cues only. |
| Proportions | Wide and low, wheels about a third of the body length. |
| Shading | Flat fill, one darker shade for the far side and underside, one light highlight on top, thin dark outline. Shades computed from the body colour, no data change. |
| Kart style source | The Karters 2, from `lightning-kart-ui-kart-reference.jpg` beside this plan. |
| Kart DNA, the brief | 1 Silhouette wide, short, tall; the driver's head above everything. 2 Four fat tyres at the corners, outside the body, rear ones bigger. 3 Two colours plus black and chrome: one body colour, one accent block for the engine box and bumper insert. 4 Twin exhausts angled outward at the rear corners. 5 Round toy details: tail lights, rounded cowl, springs, bolts. 6 Chibi driver, head about a third of the kart's width, hands on the wheel. 7 Soft paint with one strong highlight. 8 A soft shadow blob under the kart. |
| One family, three bodies | All three karts follow all eight points; only the body shape differs. Classic round and short, Rocket pointed nose and fins, Tank boxy and tall. |
| Rear view on the road | The player's kart is drawn from behind, leaning with the drift angle; the top view is used only when a kart faces more than about 60 degrees away from the camera. |
| Driver | Chibi scale with the same parts: helmet, visor, suit, hat. No hair. A character is one whole look, chosen as a unit; no part picking, now or in phase 2. |
| Stripe colour | Becomes the accent block of DNA point 3 instead of a painted line. No data change. |
| Exhausts | Drift smoke and the boost flame come out of the two exhausts. |
| Shadow blob | Under every kart on the road, scaled with depth. |
| Road edge | The kerb becomes a bright glowing stripe along the road edge. |
| Paving | A faint hex paving on the road, as its own checked step: the far road must not shimmer, else lower the contrast, and if no contrast works drop it and keep the glow. |
| Where this plan lives | `lib4gz-fe/plans/`, only the web app changes. The design file and the roadmap gain a "UI" row before phase 2. |

## Steps

Run specs with `--browsers=ChromeHeadlessGL`; the headless launcher skips the WebGL specs.
"Owner approves" means the owner played that screen on `npm run start:local` and said yes.

1. Split `scenes/race.ts`: the HUD into `scenes/hud.ts`, the feedback effects (speed lines,
   flash, shake, shout, wobble, dust, skid) into `scenes/fx.ts`, the question panel into
   `scenes/question-panel.ts`. Behaviour identical. — verify: `race-webgl.spec.ts` and
   `flow.spec.ts` pass; `race.ts` is under 350 lines.
2. Make `look/`: move `catalogue.ts` to `look/catalogue.ts` and `draw-racer.ts` to
   `look/draw.ts`, add `look/picker.ts` with the character row and the kart row the Garage
   uses, and `look/CLAUDE.md`. Update imports and the game folder's `CLAUDE.md`. — verify:
   `draw-racer.spec.ts` (moved beside `draw.ts`) and `flow.spec.ts` pass;
   `scripts/check-docs.sh` passes.
3. Style sheet and font. Write the Horizon Chase 2 traits and the kart DNA into the design
   file's Screens section. Put Oswald variable woff2 in `public/fonts/`, load it with the
   FontFace API in `lightning-kart.component.ts` before `new Phaser.Game`, name it in
   `C.ui.fontFamily`, use it in `widgets.ts`. Replace `C.ui.colors` with the sunset palette.
   — verify: `npm run build` passes; the Home title renders in Oswald on
   `npm run start:local`; `flow.spec.ts` passes.
4. Widget kit and the first two menus: skewed panel, skewed button with a stripe accent,
   title label. Restyle
   Home and Scope with them. — verify: `flow.spec.ts` passes; owner approves Home and Scope.
5. Garage and Ready restyled with the kit; the Garage draws its rows through `look/picker.ts`.
   — verify: `flow.spec.ts` passes; a pick still saves and comes back; owner approves.
6. Kart redraw in `look/draw.ts`: all three views, all three karts, per the eight DNA points,
   shades computed from the body colour, stripe as the accent block, exhausts, chibi driver
   with helmet, visor, suit and hat. — verify: `draw.spec.ts` passes, updated where the
   geometry changed; owner approves the Garage chips and portraits.
7. Rear view on the road: the Race scene draws the player's kart with the behind view, lean
   from heading minus camera yaw, top view only past about 60 degrees; shadow ellipse under
   it scaled by depth; flame anchored at both exhausts. — verify: `race-webgl.spec.ts`
   passes; owner drives a lap and approves.
8. World theme: sky gradient with a sun disc, horizon skyline strip that slides with the
   camera yaw, sunset road palette and the glowing edge stripe in `C.ui.road`. — verify:
   `mode7.spec.ts` passes; owner approves.
9. Hex paving in `render/track-texture.ts`, large cells, low contrast. — verify: drive the
   long straight; the far road must not shimmer, else lower the contrast until it does not;
   if no contrast works, drop it and keep the glow. Owner approves.
10. Roadside props: `TrackDef` gains `props: { d, offset, kind }[]`, two or three kinds drawn
    by code into textures once, placed as depth-scaled sprites the way boxes are; `track/lap.ts`
    gets its placements. — verify: `geometry.spec.ts` and `race-webgl.spec.ts` pass; no
    dropped frames on the straight in the browser's performance panel; owner approves.
11. HUD and question panel restyled: lap and the empty position slot top-left, time and best
    top-right, two slanted nitro cells bottom-right that fill and flash, no speedometer; the
    question panel as a skewed panel with its countdown bar. — verify: `race-webgl.spec.ts`
    passes, nitro and question steps included; owner approves.
12. Boost and drift look in `scenes/fx.ts`: blue-white flame, restyled speed lines, edge
    vignette; drift smoke puffs and sparks at the inside rear wheel. Only colours and sizes
    are added to `C.ui.fx`. — verify: `git diff engine/constants.ts` shows no changed
    duration or power; `race-webgl.spec.ts` passes; owner approves.
13. Result restyled minimally. Then the docs: `docs/features/lightning-kart.md`,
    `docs/roadmap.md`, the design file's phases table and its HUD and Feedback sections
    (they still describe the old top bar), the game folder's `CLAUDE.md`. —
    verify: full spec run passes; `npm run build` passes; `scripts/check-docs.sh` passes.

## Out of scope

- Any tuning number: speed, drift, nitro, walls, camera, and the duration or power of every
  effect. The feel is good; polish must not move it.
- Music and new sounds. A later row in the design file's phases table.
- New karts, new characters, hair parts, rarity, locked entries. Phase 2.
- Part customisation of a character. A character is one whole look.
- A theme per track, more tracks, a mini-map. Phase 4.
- The position in the HUD. Phase 3 fills the slot this plan leaves empty.
- A Result screen for ten racers. Phase 3.
- Responsive layouts. The stage stays 960 by 540.
- Image assets. Everything but the font is drawn by code.
- Screenshot tests. The owner's eye is the test for looks.

## Open

Nothing open. Every round's answers are in Decisions.

## Progress

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6
- [x] Step 7
- [x] Step 8
- [x] Step 9
- [x] Step 10
- [x] Step 11
- [x] Step 12
- [x] Step 13

Last session 2026-11-10: steps 1 and 2 done. `race.ts` is 345 lines; the HUD, effects, question panel (with the deck) and the input wiring are in `scenes/hud.ts`, `fx.ts`, `question-panel.ts` and `race-input.ts` (the fourth file was needed to get under 350). `look/` holds `catalogue.ts`, `draw.ts`, `draw.spec.ts`, `picker.ts` and its `CLAUDE.md`. Specs 102/102 in the WebGL launcher, build and check-docs clean. Not committed. Step 3 done: the Look subsection (style sheet, palette, kart DNA) is in the design file's Screens section; Oswald is `public/fonts/oswald-variable.woff2`, loaded by the host with FontFace before `new Phaser.Game` and named in `C.ui.font.family` with the fallback stack in `C.ui.font.stack` (two constants instead of one `C.ui.fontFamily`, so the stack has a home); the bridge no longer carries a font; `C.ui.colors` is the sunset palette with `orange`, `magenta`, `cyan`, `yellow` and a three-stop `sunset`. Owner still to check the Home title renders in Oswald on `npm run start:local`. Step 4 done: `widgets.ts` gained `panel`, `title`, `backdrop` and the skewed `button` (fixed 12 px shear, yellow stripe, cyan outline when selected; captions keep their case, `cornerButton` upper-cases its own); Home and Scope restyled (Scope's rows sit on a `panel`, Home's buttons sit on the dark ground below the horizon so orange never lands on the orange sky); New constants under `ui`: `button.skew`, `button.stripe`, `panel`, `title.bar`, `accent`, `backdrop`. The menu slide was then removed on the owner's call: scenes change with a plain start, `motion.ts` keeps only `reducedMotion`. Specs 102/102 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to approve Home and Scope by playing. Step 5 done: Garage and Ready call `backdrop`, `title` and `panel` (Garage's two chip rows share one board, Ready's board holds the ten rows and the own row above a skewed START); `leaderboard` keeps its signature and tints the own row with a skewed `accent.mine` block at `ui.leaderboard.mineAlpha` (new `ui.leaderboard: { rowH: 30, mineAlpha: 0.25 }`, `accent.mine: 'cyan'`); `title` gained an optional `maxWidth` that scales a long scope name down before it reaches the corner buttons; `look/picker.ts` exports `rowWidth()` for the board. Specs 102/102, build and check-docs clean. Not committed. Owner still to check a pick saves and comes back, and to approve Garage and Ready by playing. Step 6 done: `look/draw.ts` redrawn to the eight DNA points in all three views; `shade(colour, factor)` derives the dark side and the outline ring from `kart.body`, `kart.stripe` is the engine box and bumper insert, chrome, ink and lamp colours are constants in `draw.ts`; the behind view has the shadow blob, fat rounded tyres outside the body (rear bigger), twin fat chrome exhaust mouths at the rear corners, tail lamps, a chrome rail on the engine box, the cowl with the one highlight, a steering wheel wider than the torso with gloved hands on its rim beside the helmet, and the chibi head (dome, cheek guards, visor band, skin only under the visor, hat) shared with the portrait; the top view keeps the nose along +x, draws no shadow (the Race scene does), and its flames are two tapered tongues from the exhaust mouths; Classic is bubbly, Rocket a rounded bullet cowl with flat slab fins flush with the block's sides, Tank boxy with a flat box. A review round fixed the hidden front tyres, the wheel, the Rocket's thorns, the exhausts, the bolts and the cheek guards, and restored the flame length factor. `catalogue.ts` and the constants untouched. `draw.spec.ts` draws every pair at lean -1, 0, 1, with and without the flame, portraits at 24 and 32, and checks `shade`; it cannot see pixels. Specs 103/103 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to approve the Garage chips and portraits by playing. Step 7 done: `scenes/race.ts` `placeWorld` draws the player's kart with `drawRacer` (behind view, stage pixels, container scale 1, its own shadow blob) while `|heading - cam.yaw|` is under `C.ui.kart.topViewDeg` (60); the driver's lean is that angle over the threshold and the graphics tilts by it times `C.ui.kart.leanTilt` (0.25, clockwise in a right drift); the kart width on screen is `C.kart.width` times the projected scale times `C.ui.kart.behindScale` (1.0, about 68 px at the eye's distance, tune by eye); past the threshold the top view, shadow ellipse, rotation and squash run exactly as before. `drawRacer` gained a trailing optional flame (`null` by default): two tongues from the exhaust mouths down the screen and outward, `lengths` times 0.35 `s` long, the colours still `C.ui.fx.flame` until step 12. The dust puff takes the projected scale explicitly since the container no longer carries it. Checked with a DevTools-driven headless render of the Race scene at rel 0, ±30 degrees with the flame and the double flame, and 75 degrees. Build and check-docs clean. Not committed. Owner still to drive a lap and approve. Step 8 done: `render/mode7.ts` draws the sky as a three-stop gradient from `C.ui.colors.sunset` (horizon stop at the horizon row, magenta at 45% of the sky's height) with a sun disc and glow at a fixed world direction (`C.ui.road.sunAzimuthDeg` 30, `sunElevationDeg` 5, `sunRadiusDeg` 4, `sunGlowDeg` 22, `sunGlowAlpha` 0.45; measured by chord distance so mediump holds), and fogs the ground to `sunset[2]`; `render/skyline.ts` draws a seeded coastal silhouette (towers with lit windows, low blocks, palms, two lighthouses, two bridges, a lighter shore band and a haze) once into a texture 360 degrees of yaw wide and shows it as a tile sprite on the horizon row at `DEPTH.ground + 1`, slid by `setYaw` in `followKart` (`C.ui.road.skyline: { fill, base, h: 90, seed: 1138 }`); `C.ui.road` is the sunset palette (teal ground check, purple-grey asphalt, dark magenta wall, cyan checkpoint, yellow box; `sky` removed, every other key kept); `render/track-texture.ts` strokes a soft orange glow (`edgeGlow`, `edgeGlowW` 1.6, `edgeGlowAlpha` 0.35) under a thin bright core (`edge`, `edgeW` 0.5) just inside both road edges, with the old 0.9-unit kerb cells in `kerb` (orange, white) over it on hard corners, before the wall; `mode7.spec.ts` compares the sampled pixels with `road.road[0]` and `road.ground[0]`. The Debug scene's mode 7 mode shows the skyline too (fixed at the default pitch's horizon). Checked with four headless frames (straight, yaw 1.2, before the hairpin, in the S). Specs 103/103 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to approve by playing. Step 9 done: `render/track-texture.ts` strokes a flat-top hex lattice between the road fill and the stripe, one path clipped to the road (`C.ui.road.paving: { cell: 5, lineW: 0.25, line: 0x5a5272, alpha: 0.18 }`; a cell is 10 units across, two per road width); the canvas is padded right and down to a power of two (the lap's 3758 by 1484 px becomes 4096 by 2048, `worldW`/`worldH` describe the padded area, the Debug top view shows it whole) and `render/mode7.ts` samples it with `linear_mipmap_linear` plus `C.ui.road.anisotropy` (8) set on the GL texture through `EXT_texture_filter_anisotropic`; `lightning-kart.component.ts` sets `render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' }` because a skid `refresh()` re-uploads the canvas with the renderer's filter and would otherwise drop the mipmaps after the first drift (one line outside the step's file list, on purpose). The shimmer test was a headless pair on the lap's back straight at d 900 and 902 (`scratchpad/vis9/far-a.png`, `far-b.png`; `near.png` is the test track at d 20), judged on the asphalt rows 180 to 200 under the fog: with the linear filter the paving at 0.18, 0.12 and 0.08 showed broken dashes that moved between the frames (mean adjacent-pixel difference 0.33, 0.20, 0.11 against 0.00 without paving) and the far stripe and the checkpoint line popped (4.5 in the stripe rows); with mipmaps alone the band was calm (0.10) but the stripe smeared sideways; with mipmaps and anisotropy 8 the band is calm (0.20, stripe rows 1.8) and the stripe crisp, so the alpha stayed at 0.18. `render/skyline.ts` now draws the strip `2 * PI * focal` px wide (2423, the sun's rate at the screen centre, where the old 360-over-stage-FOV strip slid 39% faster) and shows it as two images end to end slid by whole px, since a tile sprite resamples a non-power-of-two frame into a power-of-two canvas; the texture stays 2423 by 90. Specs 103/103 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to drive the long straight and approve the paving. Step 10 done: `TrackDef` gained `props: { d, offset, kind }[]` with `kind` palm, billboard or sign, resolved by `buildTrack` to world points (`BuiltTrack.props`, offset kept for the sign's side); the lap has 49 (33 palms every 40 or so along the straights and the gentle sweeps, sides alternating with jittered offsets 13.5 to 16.5; 5 billboards at 124, 800, 1020, 1305 before the hairpin and 1905; 11 chevron signs on the outsides of the S and the hairpin), the test track 10 (7 palms, 1 billboard, 2 signs). `render/props.ts` draws the three textures once by code (128 by 256, 256 by 128, 128 by 256, powers of two for mipmaps) in `C.ui.road.props` (new: trunk, trunkLight, frond, frondLight, coconut, post, board, boardEdge, stripes, bolt, diamond, diamondEdge, chevron) and places them as images with origin (0.5, 1) at `C.ui.props` heights (new: palm 9, billboard 6.5, sign 4 world units, `reach` 20), projecting only the props within `camera.fogFar + reach` of the eye by straight-line distance (not lap distance: the finish straight's props are 120 units across the hairpin from the back straight and in view there), alpha `1 - smoothstep(fogNear, fogFar, depth)`, depth `DEPTH.world + y / H`, a right-side sign flipped so the chevron points into the road. Worst case 23 props projected (at d 158, where the start straight's end sees the finish straight's), 10 on the back straight. The Race scene constructs `Props` after the skyline and calls `update` after the boxes; the Debug top view dots every prop and its mode 7 view places them. Headless Brave under swiftshader driving the back straight from d 900 for six seconds: 24.2 fps with the props, 24.3 with the list emptied (`scratchpad/vis10/`, `straight.png`, `back.png`, `hairpin.png`). `geometry.spec.ts` gained the test that every prop of both tracks is on the lap, at least the road half width plus the wall plus 1 out, and off the road. Specs 104/104 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to approve the props by playing. Step 11 done: `scenes/hud.ts` puts "LAP 1 / 3" (Oswald bold, new `ui.font.hudBig` 28) top left with an empty slanted slot beside it (`ui.hud.slot: { w: 72, h: 36, gap: 12, alpha: 0.35 }`, muted outline, for phase 3's position), the time (`hudBig`) and "BEST m:ss.d" or "BEST –" (`ui.font.hud`, muted) right-aligned under the Quit and Sound corner buttons, and two `slant` nitro cells bottom right (`ui.hud.cell: { w: 56, h: 22, gap: 6, lineW: 2, emptyAlpha: 0.35 }`, `ui.hud.slowBar: { h: 3, gap: 4 }`): a stored charge fills its cell cyan over `ui.fx.flashMs`, a fired one flashes white over the same and then drains yellow by `effect.left` over the seconds it had at the fire, the stored one pulses `good` in the chain window as before, a slow reddens both outlines and drains the thin bar under them over `C.slow.seconds`; on a touch device the cells sit 8 px above the Nitro hold button. The speedometer, the effect label and `ui.itemSlot` are gone; `ui.button.radius` too, nothing read it. `Hud` diffs `charges` between frames (up stored, down fired) and takes nothing new from `HudState`; `race.ts` changed one comment. `scenes/question-panel.ts` draws the kit `panel` (`ui.question.panelW` wide) centred in the upper two thirds of the stage (top at `H / 3 - panelH / 2`, never above `pad + 44`, so the kart stays in view under it), the countdown number at `hudBig` top right, the bar as a `slant` along the top edge inset past the stripe; `slant` is now exported from `widgets.ts`. Checked with headless Brave shots of the real Race scene (`scratchpad/vis11/`: `hud-idle.png`, `hud-charged.png`, `hud-boost.png`, `hud-chain.png`, `hud-slow.png`, `question.png`, `hud-touch.png`). Specs 104/104 in the WebGL launcher, build and check-docs clean. Not committed. Owner still to approve the HUD and the panel by playing. Step 12 done: `ui.fx.flame` is cyan and near-white; `scenes/fx.ts` draws the speed lines as thin streaks from the stage edges in alternating `ui.fx.speedLine` colours (`speedLineW` 2, `speedLineAlpha` 0.85), a bright head and a tail fading over three segments, two in three near a diagonal, none inside the centre third; a boost's edge vignette is one 512 by 256 canvas texture `fx-vignette` (`ui.fx.vignette` deep blue-violet, `vignetteAlpha` 0.6) at `DEPTH.lines` under the lines, faded by `setBoosting` over `speedLineMs` (no new duration), called once per racing frame from `tickFeedback`; `driftPuff(x, y, side, s)` adds one or two `ui.fx.smoke` discs (`smokeAlpha` 0.5, `smokeR` 0.12 `s`, grown `smokeGrow` 2.5 times) and two or three `ui.fx.spark` streaks (`sparkLen` 0.14 `s`, `sparkW` 2) at the inside rear wheel's outer bottom corner, moving outward and down the screen at `DEPTH.world + 0.5`, called from `tickFeedback` on the dust's cadence (`driftAtMs` stamp beside `dustAtMs`) while the behind view drifts (`race.ts` stores `behind: { s, side }` in `placeWorld`, null in the top view); the countdown is Oswald bold yellow over a 3 px `colors.bg` shadow label. `ui.fx` gained colours, sizes and alphas only; the grep for durations, powers, counts and the skid width over the constants diff is empty. Checked with a hand-stepped headless Brave render of the real Race scene (`scratchpad/vis12/`: `boost.png` 150 ms after a real fire, `boost-late.png` a second in, `drift.png` and `drift-left.png` mid-drift, `countdown.png`; the harness steps `game.step` and `Date.now` together because the tween manager runs on the wall clock). Not committed. Owner still to approve by playing. Step 13 done: `scenes/result.ts` restyled with the kit and kept plain for phase 3: `backdrop` after `setupStage`, the `title` "FINISHED m:ss.d" with the right and wrong counts on the same row at the right, the missed list (heading, question, correct option in `good`, "and N more") on a left `panel` that grows with its list, the leaderboard under its "Best times" heading on a right `panel` of eleven rows at the new `ui.result.rowH` (26, so the board ends above the buttons' row), RACE AGAIN and HOME as kit buttons at the bottom, the save error and RETRY where they were on the right board; `raceAgain`, `goHome`, `retrySave`, the data-change redraw with the SHUTDOWN unsubscribe and the slide-in under `reducedMotion` unchanged, `ui.fx.resultSlideMs` and `ui.question.missedShown` untouched. Two stale comments fixed on the way: `ui.props` in `constants.ts` said the reach window was by straight-line distance (it is along the heading, as `render/props.ts` does) and `question-panel.ts` said the panel sat in the upper two thirds. Checked with headless Brave shots of the real Result scene (`scratchpad/vis13/`: `clean.png`, `two.png`, `six.png` with the "and 2 more" line, `error.png` with Retry). Docs: `docs/features/lightning-kart.md` rewritten to the new look (103 lines), `docs/roadmap.md` has the look under Finished and the later phases start at phase 2, the design file's Screens art and rows, Effects, Feedback and Phases rows match the code, the game folder's `CLAUDE.md` and `look/CLAUDE.md` trimmed to rules (the feel boundary, the Result rule and the question panel's place moved in from this plan). Specs 104/104 in the WebGL launcher, build and check-docs clean. Not committed. The owner still has to approve by playing: the Result board, and everything from steps 3 to 12 not yet played (Home, Scope, Garage, Ready, the kart from behind, the world, the paving on the long straight, the props, the HUD and panel, the boost and drift). Tunables worth an eye while playing: `ui.kart.behindScale` (1.25, the kart's size on the road), `ui.road.paving.cell` (3.5, the hex size; raise it or lower `paving.alpha` if the far road shimmers), `ui.fx.speedLineW` (2), `ui.fx.vignetteAlpha` (0.6), `ui.hud.cell` (56 by 22, the nitro cells). The owner deletes this file when done.
