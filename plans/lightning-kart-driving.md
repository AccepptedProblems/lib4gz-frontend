# Lightning Kart, phase 1b: real track, heading, drift, stored nitro

Status: DONE

## Why

The owner played phase 1 and the kart did not follow the direction they steered. Phase 1
moves a marker across a fake road: no nose, no turning, no slide. The owner wants the
driving of ZingSpeed: a kart with a heading on a real track, a drift to take corners, and
nitro the player fires when they choose. Four grilling rounds on 2026-11-07 settled it and
chose real track geometry with a new renderer over patching the fake road, because the fake
road cannot ever hold a true corner, an inside line or a wall hit at an angle.

The questions stay the engine of speed: a right answer stores a nitro charge, a wrong one
slows you. Drifting earns nothing by itself; it is how you corner.

## Behaviour

A student presses Start on a scope as before. The race counts down 3, 2, 1, GO inside the
box and the timer starts at GO. The kart accelerates by itself to its top speed and the
player steers its nose with Left and Right; the view sits behind the kart and swings with
it. Holding Down with a direction drifts: the nose turns fast, the kart slides through the
corner at an angle, and letting go snaps it straight. Grass slows and slides the kart. The
wall round the track slides you along it with speed loss on a shallow hit and bounces you
off on a steep one.

Driving through a box opens a question as before; the number keys 1 to 6 answer it, or a
tap. A right answer puts a nitro charge in the slot on the HUD, up to two. Up (or Space)
fires one: a boost for five seconds. Firing another charge in the last second of a boost
chains it into one long burst, the Double Boost. A wrong answer or a timeout slows the kart
as before. Three laps, counted only through every checkpoint in order. The result screen,
the leaderboard, the garage and the teacher's bank are unchanged.

On a touch screen: hold the left or right half to steer, a Drift button and a Nitro button
sit in the bottom corners inside the box.

| Who | Where | Can |
| --- | --- | --- |
| Anyone enrolled | Race | Steer by heading, drift, fire stored nitro, chain two charges |
| Anyone enrolled, no WebGL | Race | Sees "Lightning Kart needs WebGL in this browser" and nothing else |

## Decisions

| Question | Decision |
| --- | --- |
| Patch the fake road or rebuild | Rebuild on real 2D track geometry. The fake road has no apex, no inside line, no angled wall hit, and every later phase (mini-map, more tracks, live rooms with real positions) wants real geometry. 2026-11-07. |
| View | Mode 7: the track rasterised once into a texture, a fragment shader on a full-stage quad samples it with a perspective transform, karts and boxes are sprites scaled by depth. WebGL required; without it the box shows one line of text. A rotated top-down camera was the cheaper option and is kept only as the mini-map's base in phase 4. |
| Camera | Behind and above the kart, following its heading with a short lag, so a drifting kart sits at an angle on screen. Following the velocity would hide the drift. |
| Track data | A closed centreline as a list of points with a road width per point in one TypeScript file. Road, kerbs on hard corners, grass, and the wall are built from it. Start line, checkpoints and box slots are distances along it. No editor. |
| Track content | The design file's rhythm as geometry: start straight, easy left and right, tightening S, hairpin, long finish straight. About sixty seconds a lap at top speed, three karts wide, corners from the S on need a drift. The owner's rule: the track must be playable; the grey-box gate checks it. |
| Kart model | Position, heading, velocity. Auto-accelerates to top speed, no throttle or brake. Turn rate falls with speed. Grip pulls the velocity toward the heading each frame; the rest is slide. Drift raises the turn rate, lowers grip, costs a little speed, and snaps the velocity to the heading on release. |
| Walls | A closed corridor: road, grass verge, wall all the way round. Shallow hit slides along the wall with speed loss; steep hit bounces off with the Bump slowdown. Replaces phase 1's bounce-only rule. 2026-11-10: the owner removed the verge; `C.world.verge` is 0 and the wall stands at the road edge. The grass rules stay in the code behind that constant. |
| Nitro | A right answer stores one charge in the held-item slot, cap 2. Up or Space fires one: x1.5 for 5 s. Firing in the last second of a running boost chains it (Double Boost): the new charge adds its 5 s. Wrong or timeout: x0.5 for 3 s, no charge lost. Nothing from drifting. Races start with no charge. |
| Special moves | Double Boost only in this phase. The clean drift exit extension (ZingSpeed's WCW) and the snap drift extension are listed for a later phase. |
| Controls | Left and Right steer, Down holds drift, Up or Space fires nitro, 1 to 6 answer a question, Escape twice quits. Touch: steer halves plus Drift and Nitro buttons drawn inside the canvas. |
| Laps | Counted when the start line is crossed after every checkpoint in order (about four round the lap). Grass cuts do not count. |
| Item boxes | Fixed slots on the track, because the track has geometry now. The seed shuffles the question deck and nothing else, so a phase 3 room can share one seed. The seed stays in the saved result. Slots sit on straights and easy road only, never in the S or the hairpin, so a question opens where the driving is easy. Owner's rule, 2026-11-07. |
| Race start | A 3, 2, 1, GO countdown inside the canvas; the timer starts at GO. |
| Karts | Cosmetic in this phase, identical handling. The catalogue stays ready for rarity and locked entries, which phase 2 draws and sells. |
| Grey box first | The renderer and physics ship first on a test track with only the S and the hairpin, a rectangle kart, no feedback. The owner plays it, tunes the constants and says it is fun before the real track, art or feedback are built. |
| Phase 1 plan | Marked DONE with a note that its driving model is replaced here. The two-person playtest moves to the end of this plan. |
| Where this plan lives | `lib4gz-fe/plans/`, because only the web app changes. The design file beside the phase 1 plan is updated by this work. |

## Steps

All in `lib4gz-fe/src/app/games/lightning-kart/`. The scenes outside Race, the bridge, the
host, the catalogue and the editor are untouched. The old `engine/` and `engine/projection.ts`
are replaced; `race.spec.ts` is rewritten with the physics.

1. Track geometry in `track/geometry.ts`: `Centreline { points: {x, y, width}[] }` closed,
   helpers for the total length, the point and tangent at a distance, the nearest distance
   to a world point, the signed offset across the road, inside-road and inside-wall tests
   with the wall at the road edge plus the verge, and the wall normal. `track/test-track.ts`
   (S and hairpin only) and `track/lap.ts` (the full rhythm). Checkpoints, start line and
   box slots as distances in the track file. — verify: `track/geometry.spec.ts` passes:
   the centreline is closed, distances round-trip, a point on the road is inside, a point
   past the verge is outside, the full lap is about 60 s at top speed.
2. Track texture in `render/track-texture.ts`: rasterise a centreline into a canvas texture
   (grass, road, kerbs on segments whose curvature passes the hard-corner threshold, start
   line, checkpoint marks in a debug colour) at a fixed world-to-pixel scale, registered in
   Phaser's texture manager. A `TopDown` debug scene behind a query flag shows it with the
   kart as a dot. — verify: the debug scene shows the test track and the full lap, kerbs on
   the S and hairpin.
3. Mode 7 in `render/mode7.ts`: a `Phaser.GameObjects.Shader` over the stage with the track
   texture and uniforms for camera position, heading, height and pitch; `projectToScreen`
   for sprites (screen x, y and scale from a world point, or null behind the camera); a sky
   fill above the horizon. "Needs WebGL" text when `game.renderer.type` is not WebGL. —
   verify: the debug scene moves a free camera over the texture at 60 fps on a laptop; a
   marker sprite placed by `projectToScreen` sits on the texture feature it points at.
4. Kart physics in `engine/kart.ts` and `engine/race.ts`: the kart model from Decisions,
   grass and walls, laps through checkpoints, the effects list kept, speed = top speed times
   the effects product, nitro charges and the Double Boost chain, fixed boxes with a hit
   radius, the seeded deck order. `engine/race.spec.ts` rewritten: a bot that steers toward
   the centreline point a second ahead completes three laps on the full lap in about three
   minutes; a bot that never steers hits the wall and bounces; a cut across the grass does
   not count a lap; two charges fired a second apart give one boost of about 9 s; a drift
   turns tighter than a plain steer at top speed. — verify: the spec passes.
5. Grey-box Race scene: the Race scene rebuilt on steps 3 and 4 with a rectangle kart,
   square boxes, the countdown, the HUD (lap, time, best, effect, charges in the slot),
   Quit and Sound, keyboard and touch controls, no feedback, test track. The flow spec
   updated for the countdown. — verify: the flow spec passes; the owner plays the test track,
   tunes `constants.ts`, and writes "fun" in the plan's Last session line. Nothing in 6 to
   9 before that.
6. Questions and nitro in the Race scene: boxes open questions as before, number keys 1 to
   6 answer, a right answer adds a charge with a sound, Up or Space fires, the chain window
   shown as a pulse on the slot, the overlay and the countdown bar as now. — verify: play
   one race on the full lap: two right answers then two fires give one long boost; a fire
   with no charge does nothing.
7. Feedback and art: the kart drawn from parts as a top-down sprite per look, rotated by
   heading relative to the camera and scaled by depth; characters' portraits unchanged; the
   phase 1 feedback rows ported (speed lines, flashes, shouts, shakes, dust on grass, thud on
   walls, lap tone, fanfare) plus a tyre screech while drifting, skid marks drawn onto the
   track texture for the lap, a nitro flame while boosted; the full lap as the race track;
   reduced motion respected. — verify: play a full race; every row of the design file's
   Feedback table is seen and heard; the draw spec covers the top-down kart per look.
8. Tidy: delete `engine/projection.ts`, `engine/track.ts` (old), the strip renderer in
   the Race scene and the old constants; `games/lightning-kart/CLAUDE.md` rewritten (track
   data, mode 7, the kart model, the nitro rules, WebGL); `docs/features/lightning-kart.md`
   and `docs/roadmap.md` updated (drift, nitro, Double Boost, WebGL); `scripts/check-docs.sh`
   clean. — verify: `npm run build`, all specs, check-docs.
9. Playtest: two people outside these conversations each play one race while the owner
   watches and takes notes without asking them anything; notes under a Playtest heading
   here; each frustration becomes a constant change or an Out of scope line. Then `Status:
   DONE`. — verify: the notes are in this file; the status grep shows DONE.

## Out of scope

- The clean drift exit extension (WCW) and the snap drift extension. Listed for a later
  phase, after Double Boost has been felt.
- Mini boost on drift exit, or any nitro from drifting. The owner wants speed to come from
  the questions.
- A track editor, a second track, a mini-map. Phase 4.
- Per-kart handling or stats. Karts are looks; phase 2 adds rarity and locked designs.
- A Canvas fallback for the mode 7 view. One line of text instead.
- Wall tricks from ZingSpeed (bump boost, drift bounce). They reward hitting walls.
- Throttle, brake, reverse, spin-outs.
- Any backend change. Results keep their shape; the seed now means the deck order.

## Progress

- [x] Step 1
- [x] Step 2 (seen 2026-11-10: the lap closes, kerbs on the S and the hairpin, boxes on the straights)
- [x] Step 3 (seen 2026-11-10: 60 fps, markers on the start line's centre and right end and on the first box)
- [x] Step 4
- [x] Step 5 (the owner skipped the "fun" gate on 2026-11-10 and asked for the plan to be completed; `constants.ts` is untuned by play)
- [x] Step 6 (`scenes/race-webgl.spec.ts` drives the chain and the empty fire; the look of the pulse not yet seen)
- [x] Step 7 (every Feedback row built; the draw spec covers the top-down kart; the rows are checked by the WebGL spec for not throwing, not yet seen or heard)
- [x] Step 8
- [x] Step 9 (closed by the owner on 2026-11-10 after playing it themselves; no two-person playtest notes were taken, so there is no Playtest heading)

Last session 2026-11-10 (end): the owner played the full lap with sound on, had the finish
freeze fixed, the kart sprite turned to face up the screen and the verge removed, and then
declared the plan done. Status set to DONE; the lasting rules are in
`src/app/games/lightning-kart/CLAUDE.md`, the feature page and the roadmap are current.
The owner deletes this file. Left for later phases: the constants are tuned only by the
owner's own play, and the wall slide loss may feel harsh now that there is no verge.

Earlier 2026-11-10 (later): the owner played and reported a freeze at the finish with
sound on. Reproduced in `scenes/race-webgl.spec.ts` with real audio: the Race scene's
`SHUTDOWN` handler relabelled the Sound button after Phaser had destroyed the display list,
the `setText` threw inside the frame step and the game loop died on its last frame. The
handler now only stops the audio nodes; the spec keeps sound on so it would catch it again.
Also from the owner: the kart sprite now points up the screen (it lay sideways), and the
grass verge is gone (`C.world.verge` 0, wall at the road edge, grass rules kept behind the
constant). Step 9 is still the owner's.

Earlier the same day: steps 6 to 8 built on the owner's call to skip the grey-box gate;
build, 100 specs (`ChromeHeadlessGL`) and check-docs green. Steps 2 and 3 were checked by eye
on `?debug=top` and `?debug=mode7`. The race itself could not be played: the automated
browser tab was hidden on the owner's screen, so Chrome starved the game loop (the countdown
sat on 3 while `document.hidden` was true); that is Chrome, not the game. In its place
`scenes/race-webgl.spec.ts` runs the Race scene for real in the WebGL launcher. What landed:
the full lap is the race track (`?track=test` picks the short one); the kart is the top-down
look from `draw-racer.ts` `drawKartTop`, turned by heading, squashed by pitch, with a shadow
and a nitro flame (bigger on a Double Boost); the slot pulses in the chain window; speed
lines, lurch and a shout on a fire, a higher whoosh and "DOUBLE BOOST" on a chain; green and
red flashes, a wobble on a wrong answer; skid marks drawn onto the track canvas while
drifting with a throttled `refresh()`; a looping tyre screech; dust, shake and rumble on the
grass; the shake on a bump; a lap pop and shout; reduced motion drops the shakes, lurch,
wobble and shout tween. Docs: `docs/features/lightning-kart.md`, `docs/roadmap.md` and the
design file's item-box rule updated. Not done: the constants are untuned by play, and
nothing has been heard. NEXT, owner only: play one race on the full lap with sound on,
tune `constants.ts` (`kart`, `camera`, `fx`, `audio`), then run step 9's playtest, write the
notes under a Playtest heading here, and set `Status: DONE`.
