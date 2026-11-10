# Lightning Kart, UI polish: Horizon Chase 2 feel, The Karters 2 karts

Status: NOT STARTED

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
| Every screen | A bold condensed typeface, skewed panels and buttons with slanted stripe accents, saturated orange, magenta, cyan and yellow over a sunset gradient. Menus slide between each other. |
| The race world | A sunset sky with a sun, a skyline on the horizon that slides as the kart turns, a glowing stripe along the road edge, a faint hex paving on the road, and palm trees, signs and billboards beside the road. |
| The kart | Seen from behind, as in a chase camera. Wide and short with four fat tyres, a two-colour body, twin exhausts, a chibi driver whose helmet and hat show above the kart, a soft shadow under it. The three karts keep their names and identities. |
| Boost and drift | The nitro flame comes out of both exhausts, blue-white, with speed lines and a darkened screen edge. Drifting puffs tyre smoke and sparks from the inside rear wheel over the skid marks. |
| The HUD | Lap top-left with an empty slot where the position will go in phase 3. Race time and best time top-right. Two slanted nitro cells bottom-right that fill when a right answer stores a charge and flash when one is fired. No speedometer. The question panel is a skewed panel in the centre. |
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
| HUD layout | Lap and an empty position slot top-left, race time and best top-right, two nitro cells bottom-right, question panel centred. |
| Speedometer | Removed. Round 5 reversed the round 4 arc gauge: the owner wants none. |
| Nitro cells | Stay bottom-right on their own as two slanted blocks that fill when a charge is stored and flash when fired. The only sign of a stored charge. |
| No image assets | Everything drawn by code. The font is the one file. |
| Transitions | One fast slide between menu scenes, skipped under reduced motion, one duration in the UI constants. |
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
   title label, the slide transition in `scenes/motion.ts` honouring reduced motion. Restyle
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
    `docs/roadmap.md`, the design file's phases table, the game folder's `CLAUDE.md`. —
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

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3
- [ ] Step 4
- [ ] Step 5
- [ ] Step 6
- [ ] Step 7
- [ ] Step 8
- [ ] Step 9
- [ ] Step 10
- [ ] Step 11
- [ ] Step 12
- [ ] Step 13

Last session 2026-11-10: plan written after five grilling rounds; no code yet.
