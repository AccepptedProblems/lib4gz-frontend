# games/lightning-kart

Owns: the Lightning Kart game on a course's race route, a Phaser 3 game inside one Angular
host.

## Rules

**Boundaries**

- Phaser is imported only under this folder, and this folder is reached only through the
  race route's `loadComponent`, so Phaser stays out of the initial bundle. `angular.json`
  lists it under `allowedCommonJsDependencies`.
- `lightning-kart.component.ts` is the only Angular file. It owns the theater band, the
  services and the bridge. It has no other template and no other DOM: every screen, error
  and button of the game is drawn inside the canvas. The navbar is hidden on the race route
  by `hiddenRoutePatterns` in `app.component.ts`; the course sidebar stays.
- `bridge.ts` is the one seam. The host sets data, listens for intents and answers the
  bridge's `calls` (the deal and one answer attempt, promises the host bounds with `C.net`);
  scenes read data, listen for `dataChanged`, fire intents and make calls. Scenes, `look/` and `engine/` never
  import Angular, a service, or anything under `app/components/`. Scenes get the bridge from
  the game registry with `bridgeOf(scene)`.
- `engine/race.ts`, `kart.ts`, `effects.ts`, `items.ts`, `seed.ts`, `streak.ts` and everything
  in `track/` are pure functions on plain objects, no Phaser, no DOM. `render/` is Phaser.

**Numbers and the look**

- `engine/constants.ts` is the only home of tuning numbers and of the ui colours, fonts,
  sizes and durations. Scenes take those from `C.ui`; a position on the stage may be a
  literal.
- A look change touches `C.ui` only: colours, fonts, sizes and shapes. It never changes a
  duration or a power under `C.ui.fx`, and nothing in the kart, world, boost, trap, answer,
  net, camera or engine blocks.
- Everything is drawn by code; no image file is loaded. The only assets are two typefaces in
  `public/fonts/` (SIL OFL, licences beside them): Oswald (`oswald-variable.woff2`) and Open
  Sans as three subset files (`open-sans-*.woff2`, each registered with its `unicodeRange`).
  The host registers both with the FontFace API, under `C.ui.font.family` and
  `C.ui.read.family`, before `new Phaser.Game`, because a text object measures with the font
  registered when it is created; a failed load still creates the game on the fallback stack.
  Every canvas text uses `C.ui.font.stack` except the question panel's question and option
  text, which use `C.ui.read`. The Angular shell keeps its own font.
- Scenes work in stage units, 960 by 540. The canvas is that times the pixel ratio (capped
  by `C.ui.maxPixelRatio`) and each scene's `create` calls `setupStage` first, which zooms
  the camera to match. Never read `scene.scale.width` for layout.
- The widget kit is `scenes/widgets.ts`. A `button` caption keeps the case it is given:
  scope rows stay as written, menu commands are given in upper case;
  `cornerButton` upper-cases its own. Every menu scene (Home, How to Play, Scope, Garage, Ready, Result)
  calls `backdrop` right after `setupStage`; the Race scene does not, its shader covers the
  stage. The skew is one fixed px value, `C.ui.button.skew`, on every height. Accent colours
  are palette roles in `C.ui.accent`.
- Scenes change with a plain `scene.start`; there is no transition between menus.
- START on Ready runs what the race needs behind a GET READY panel (`scenes/loading.ts`): an
  ordered list of steps, each a line for the player and slices run one per frame after the
  panel is drawn, a slice sync or a promise the panel waits on, which must settle; the bar is
  slices done over all; after a slice's promise settles one frame is skipped, so the bar's move
  is drawn. A running slice may change its step's line through the `say` it is given: the deal
  says the server is waking after `C.net.wakeMs` (the deployed server scales to zero). Its three buttons are off meanwhile, and a slice that throws or rejects
  removes the panel, gives them back and notes it beside START (a rejection's string as it
  is, fitted by `C.ui.ready.note`, anything else a fixed line). The load stops on the scene's
  shutdown and on the game's destroy, which does not shut scenes down, and a stop runs each
  step's `cancel`. A deal cancelled by Back or Scope, or timed out, may already have created
  its race on the server. The steps are the road (in the Race scene's key, WebGL only, none once
  painted), the server's deal, then the start, so the panel shows on every race. Back and
  Scope are live during the deal alone, raised over the panel; leaving shuts Ready down, and
  the deal step's `cancel` aborts the call. The dealt race lives only in its `startRace` call
  and reaches the Race scene in its start data (`RaceStart`). Which renderer the game has is
  `renderMode` in `render/mode7.ts`, beside the one message `NO_WEBGL`: on `canvas` (a browser
  without WebGL) START shows that message and deals nothing; on `headless`, which only the specs
  make, the game draws nothing but deals and races. The bolt's pulse is dropped under reduced motion, the bar and the line stay.
  Result's Race again starts Ready with `again`, which presses START as it opens.

**Input**

- Menus take pointer input only (`widgets.ts` `button`, and Home's tap zone on its racer,
  which fires on a press and release over it like a button); no menu reads the keyboard. The
  Race scene alone reads the keyboard: Left/Right or A/D slide the kart across the road, 1 to
  4 answer (one key per `C.ui.cards.fill` colour), Escape twice within two seconds quits. The
  answer and Escape keys act on a fresh keydown only, never on the OS's auto-repeat
  (`event.repeat`): Phaser drops the repeat only for keys registered with it, and only the
  steer keys are. Holding the left or right half of the stage steers too, except over a
  button or a question card, locked ones included; with two thumbs down, the later one steers
  until it lifts.

**Tracks and boxes**

- A track is a `TrackDef` in `track/`: pieces walked by `track/geometry.ts` `layout`, which
  must end heading +x west of the origin and closes the loop itself with two arcs and a
  straight (the finish). The arcs bring the walk's end level with the origin, so they are
  gentle only when the walk already ends nearly level. The world is y down, like the
  texture; a positive heading change is a right turn. Checkpoints are fractions of the lap.
- Both tracks bend right only and never tighter than radius 120, the closing arcs included.
  The texture adds `C.world.texMargin` plus a road width on every side of the centreline's
  bounds, so at `C.world.texScale` 4 those bounds must stay within 892 units a side for the
  4096 px cap (`track/geometry.spec.ts`).
- `buildTrack` spreads `C.world.rowsPerLap` box rows evenly round the lap, bends included,
  the first half a row gap past the line, and lays one box per lane at each lane centre;
  the engine sees only that flat box list, and a hit darkens that one box for its cooldown.
- A box is hit in rail space (`engine/race.ts` `step`): in a step that passes its row's
  distance, shorter than `C.world.checkpointWindow`, when the kart's offset there (the slide
  taken as even over the step) is strictly under `C.world.boxRadius` from the box's. So a
  pass hits at most one box of a row, at any frame rate. `boxRadius` must not exceed half a
  lane; at exactly half, as now, a kart passing exactly on a lane line hits neither box beside
  it, and a hair to either side hits one.
- Racers start on the line at the first lane centre right of the middle (`createRace`): on
  the centreline a hands-off kart would pass every row on a lane line and hit nothing.
- A `TrackDef`'s `props` are scenery: a distance along the lap and a signed offset across it
  of at least the road half width plus the wall (`C.ui.road.wallW`) plus 1, so a prop
  stands outside the wall; `buildTrack`
  resolves them to world points and the engine never sees them.
- The race track is `track/lap.ts`; `?track=test` on the race page picks the short
  `track/test-track.ts` for tuning. `?debug=top` or `?debug=mode7` opens `scenes/debug.ts`
  instead of Home.

**The view**

- The view is mode 7: `render/track-texture.ts` rasterises each track once per game into a
  canvas texture keyed by the track, which every later race and the Debug scene reuse; it is
  padded right and down to a power of two so Phaser makes mipmaps on its one upload, and
  nothing draws on it afterwards (`update()` on it reads every pixel back and is never
  called). It is drawn in passes on a pooled canvas taken in the first pass, which joins the
  texture manager only in the last pass, the upload, so a build cut short leaves nothing
  under the key and its step's `release` gives the canvas back; the Ready scene runs them a
  frame each, `createTrackTexture` (the Race scene when the key is missing, the Debug scene)
  in one go. `render/mode7.ts` samples it through a full-stage shader and sets the mipmap
  filter and `C.ui.road.anisotropy` anisotropic samples (`EXT_texture_filter_anisotropic`)
  on its GL texture each time a view is made. The host's `render.mipmapFilter` creates every
  power-of-two texture, the props' and the vignettes' too, with that filter. The shader asks
  for `highp` floats where the GPU has them, `mediump` elsewhere. The same shader draws the sky, a sun
  at a fixed world direction and the ground fog. The view needs WebGL; the Race scene shows
  one line of text without it and still handles engine events, which the headless flow
  spec relies on.
- The skyline is `render/skyline.ts`: a silhouette drawn once from `C.ui.road.skyline.seed`
  into a strip `2 * PI * focal` px wide (`focal = SH / 2 / tan(fov / 2)`, so it slides at the
  sun's rate at the screen centre), shown as two images end to end on the horizon row at
  `DEPTH.ground + 1`, slid by whole px by `setYaw(cam.yaw)` from `followKart`. Not a tile
  sprite: one would resample the strip into a power-of-two canvas.
- There is no kerb: a glowing stripe runs just inside both road edges all the way round. A
  faint hex lattice (`C.ui.road.paving`) lies on the asphalt, and over it
  `C.world.lanes - 1` dashed lane lines (`C.ui.road.lane`), both under the stripe.
- The wall with the stripe's core and even glow inside it, the start line and the checkpoint
  marks are painted in the texture and drawn again over it near the eye by
  `render/road-overlay.ts` (`C.ui.road.overlay`): one Graphics of triangles at depth 0.5 in
  both scenes, over the ground's shader and under the skyline, projected with a copy of
  `projectToScreen`'s maths and clipped at `C.camera.near`, fading out with depth and where a
  feature's thinnest part gets thin on screen, so far away only the texture draws them. It
  takes its shapes from the texture's own (`edgeNormal`, `EDGE_BANDS`, `startChecker` in
  `render/track-texture.ts`, the mark width `C.ui.road.markW`) and its colours from
  `C.ui.road`. It never draws a spot twice: the glow is two strips beside the core, each
  checker cell is its own, and the stripe stops where a band crosses it.
  `update(cam)` runs every frame after the camera moves, from the Race scene's `placeWorld`
  and the Debug scene's `update`. `overlay.wallH` above 0 stands the wall up (an option, off).
- The roadside props are `render/props.ts`: one canvas texture per kind, drawn once at a
  power-of-two size behind a `textures.exists` guard; `update` projects only the props
  within `C.camera.fogFar + C.ui.props.reach` ahead of the eye along its heading, not along
  the lap, fades them with the ground fog and hides the rest. A sign right of the road is
  flipped so its chevron points into the road.
- The kart on the road is `look/draw.ts` in a container at its projected ground point.
  While the heading is within `C.ui.kart.topViewDeg` of the camera's it is `drawRacer`,
  the behind view with the driver seen from behind too (the back of the head, no face; the
  face is only where the driver poses: portraits, boards, chips, Home and the Garage), drawn in stage pixels (`C.kart.width` times the projected scale times
  `C.ui.kart.behindScale`, container scale 1) with its own shadow blob and flame; the
  driver's lean is that angle over the threshold and the graphics tilts by it times
  `C.ui.kart.leanTilt`, positive (clockwise) in a right bend. Past the threshold it is
  `drawKartTop` under the scene's shadow ellipse: the drawing's nose is along +x, so the
  graphics turns by the heading relative to the camera minus a quarter turn, and the
  container scales by depth and squashes by the pitch, never flatter than
  `C.ui.kart.minSquash`.
- Splash's throws fly to the racer's head (`look/splash.ts` `racerHead`, from the character's
  headgear, the lean and the tilt), where the bubble bursts in water (`drawBurst`) in the landing frame.
  While a trap holds the kart, two Graphics of its own in the kart's container, one under the
  racer and one over it, draw the stun (`drawStun`): stars and drops on a flat ring round the
  head, turning on race time, read from its effects every frame after her tick, so the landing
  frame shows them; when the trap ends they fade over `C.ui.splash.stun.fadeMs`. From behind
  only: on rails the heading leads the camera by at most about 6 degrees, so the local kart
  never reaches `C.ui.kart.topViewDeg`.
- The render depths the Race scene's parts share are in `scenes/depth.ts`, bottom to top:
  the ground, the world (the kart at `world + 1` plus its row over the stage height, the
  badge, its shards and the crackle just over it), the speed lines and vignettes, Splash and her throw, the
  HUD, the flash, the question panel, the shout. The boost's edge vignette is one canvas
  texture `fx-vignette`, the Lightning tier's blue edge another, `fx-vignette-lightning`, each
  drawn once per game behind a `textures.exists` guard, at `DEPTH.lines` under the speed
  lines; `setBoosting` and `setLightning` are called every racing frame, the first fades over
  `fx.speedLineMs`, the second pulses on race time, and neither adds a timer.

**Race rules**

- The deck is the server's deal (`DealtRace`), in its order, each question's options as dealt
  (at most `C.ui.cards.fill` of them); a choice is the index in those options and `seq` is the
  deck position. A box row opens the next position, each once; when the deal is shorter than
  the race, the boxes left open nothing. The deal's seed is not carried: nothing reads it.
- The server mirrors `C.laps`, `C.kart.topSpeed`, `C.boost.seconds`, `C.boost.doubleMul` and
  the lap's length in the `application.race` block of the backend's application.yaml and refuses
  a finish faster than they allow; a refused finish fails again on every Retry. Raising one of
  those numbers or shortening the lap needs the same change there. `track/geometry.spec.ts`
  holds the lap to at least the server's 2641 units. The test track (`?track=test`, 1274
  units) always finishes under the server's floor, so its times are refused and never reach
  the board.
- Laps count only through every checkpoint in order and then the line, each crossed going
  forward by less than `C.world.checkpointWindow` in one step.
- The kart is on rails (`engine/kart.ts`): `d` advances by its speed, `steer` slides `offset`
  at `C.kart.slideSpeed` and the road edge clamps it with no other effect; position and
  heading are derived from both every step by `placeKart`, whose heading is the chord across
  one `C.world.spacing`, not the polyline's segment tangent (`worldAt`).
- Nothing is stored. A boost is one `boost` effect; its `mul` tells a Double Boost
  (`C.boost.doubleMul`) from a plain one. The Race scene reads `boostKind` at the verdict,
  after the press has landed any throw still in flight, and `applyBoost` gives that kind when
  Splash's bottle lands, replacing a running boost. A wrong answer's `applyTrap` lands with
  her bubble: it ends the boost, zeroes the speed and adds a `trap` effect of multiplier 0
  that also blocks the slide; a trap during a trap starts it again. A boost caught during a
  trap starts at once and its clock runs through the trap.
- Every answer goes through the `AnswerChecker` (`scenes/answer-checker.ts`) in the race's
  `ScopeChoice`, required; Scope gives every choice `serverChecker`, the bridge's answer call.
  The press, or the countdown running out (index `null`), locks the panel and stops the
  countdown; the outcome (counts, streak, chime, flash, Splash) waits for the verdict. With
  none, `update` while racing shows a "Checking…" tag on the board from `C.answer.checkingMs`
  (`QuestionPanel.checking`), asks again once at `resendMs` and voids the question at
  `voidMs`, all on race time from the press; `void` only closes the question. A checker
  that throws or rejects gives nothing; the deadline decides. The scene takes a verdict only
  for the showing of the question it asked about (`QuestionPanel.showing`, new per `show`)
  while the scene runs: closing the panel (a verdict, the void, the finish, a restart) makes
  a later reply for it do nothing, so the first reply wins.
- Item events are dropped while a question is open, locked ones included. The countdown runs
  on race time, the server counts a timeout as wrong, and a question still open or awaiting
  its verdict at the finish counts neither way in the game.
- `finished` carries the scope, the race id and the engine's integer finish time, once per
  finish. The host sends the finish once every answer call still out has settled, within
  `C.net.finishMs` (a time-out is a failed save), reports it as `GameData.save` for that race
  id (a reply for an older race is dropped), and after a save reloads that scope's leaderboard
  only while it is still the scope chosen; a 409 on a finish is a save already made, saved with
  no result. A failed save's `retry` is false after a refusal (any other 4xx), and Result then
  shows no Retry. A finish still held for an answer when the host is destroyed is sent at once,
  its reply unread. The Result scene's Retry fires `finished` again only after a failed save; the race
  is not replayed. Every START deals a new race.
- No answer key is in the browser during a race: a student's question list has no options and
  a null `correctIndex` (Scope only counts it). The finish reply's `answerKey` is null except
  at the first questions the server judged wrong, for Result's missed list alone; a teacher's
  question list carries the bank's.

**Splash**

- Every answer sends Splash (`scenes/splash.ts`, drawn by `look/splash.ts`), one run at a
  time: `start` at the press (or the timeout), she slides in and waits empty-handed;
  `decide` at a right or wrong verdict, `leave` at a void one, which sends her out with
  nothing thrown. Wrong: she fires a bubble at the racer's head; it bursts there, the kart
  stops and the racer is stunned for the trap. Right:
  she says "Nhớ uống nước nha" in a speech bubble (`C.ui.splash.say`; Oswald has every
  glyph of it) and throws a bottle the kart catches, which starts the boost. The chime and
  the green flash come with the verdict; a wrong one has no flash.
- She throws once she has arrived, from `max(verdict, press + slide-in)`: the landing comes
  aim plus flight (bubble) or wind-up plus throw (bottle) after that, on race time.
  `Splash.tick`, called from the Race scene's `update` after `placeWorld`, places her and the
  throw from that clock and fires the landing. Her run has no tween or timer and destroys its
  objects when it ends, so a shutdown mid-run leaves nothing behind.
- A new press while a throw is short of its landing lands that one at once and starts a new
  run. A landing (the bubble's burst, the bottle's splash) plays out over `C.ui.splash.popMs`
  in a Graphics of its own at the point the scene gives, whatever run comes next. A finish stops her run, since `update` stops with the race; `landed` also ignores a
  landing in the finishing frame.
- The shot brings the squirt, the burst the pop, the throw a swish, the catch a clink.

**The streak and the badge**

- `engine/streak.ts` alone decides the count, the tier (`C.streak.tiers`) and the break; the
  Race scene keeps one `Streak` (count and best) and only reacts. It counts at the verdict,
  not when Splash's throw lands. Nothing protects a streak, and no tier has a mechanical
  payoff.
- A right verdict chimes one step further up `C.ui.streak.chime`; a new tier shouts its name
  if its look's `shout` says so.
- A break from `C.streak.loudBreakAt` on plays the STREAK LOST sting, shouts
  STREAK LOST in the danger colour and shatters the badge, below that the badge and the idle
  flame just go. Sound is off by default, so every streak moment must read without it.
- Every frame the tier sets the badge, the idle flame (the tier's colours,
  `C.ui.streak.idleFlame` of the boost flame's length, only while no boost runs; shorter
  than 0.75, the exhaust mouths hide it from behind), the hum's semitones, and at Lightning
  the gold lit boxes (`C.ui.streak.boxScale` times their size, rimmed), the blue edge pulse
  (`RaceFx.setLightning`) and arcs of electricity crackling over the racer (`scenes/crackle.ts`,
  `C.ui.streak.crackle`), each slot snapping on and off on its own rhythm from race time and a
  repeatable noise, so the same race time draws the same arcs. Nothing in the HUD.
- The badge (`scenes/badge.ts`) and the crackle (`scenes/crackle.ts`) are each their own
  Graphics over the kart, never inside `drawRacer` or `drawKartTop` and outside their budgets,
  drawn in both views from the behind view's kart width at the kart's depth, so phase 3 can
  hang them over any racer. The badge is drawn from the count and the tier: from behind over the top of its headgear (`racerTop`), following
  the lean and the tilt; from above over the kart. The Result's best-streak line draws one
  too, its `objects` in the sheet.

**HUD and question panel**

- The HUD (`scenes/hud.ts`): the lap and, beside it, an empty slanted slot top left (phase 3
  puts the position there; draw nothing in it before), the time and the best top right
  under the corner buttons. No speedometer and no effect label: a boost shows on the kart
  (the flame, `C.ui.fx.doubleFlame` times as large for a Double Boost) and the stage (the
  vignette), a trap by the stars round the racer's head.
- The question panel (`scenes/question-panel.ts`) is drawn from `C.ui.cards`, not the
  widget kit, as one block standing on the stage's bottom pad: one card per option, two to a
  row in reading order, a row of one centred, and on them, its shadow `C.ui.cards.gap` above
  the first row, a board with the question, the bar and the seconds. It covers the kart and
  the road while open; the verdict closes it before Splash's throw lands. Card i always takes
  colour, shape and key i + 1; taps and keys 1 to 4 answer by that index. While the verdict is
  awaited the panel is locked (`QuestionPanel.lock`): the countdown stands still, the chosen
  card stays lit and the others drop to `C.ui.cards.lockedAlpha` (all of them after a
  timeout), none lifting under the pointer or showing the hand. The cards stay interactive,
  so a tap on a locked one is not a hold that steers.
- A long option wraps inside its card to at most two lines and the question to at most
  three, a size smaller first and then cut with an ellipsis; both cards of a row take the
  taller height; the rows and the board grow upward; a caption starts at the card's top, level with its
  shape and key.
- One right answer short of a streak tier (`nextTier`, read when the question opens), a ring
  round the board pulses in the tier's colour on race time and an ink tag standing on its
  top edge names it.
- A shout (`RaceFx.shout`) always draws at the same place over the road, above the panel's
  depth; the tallest block's top, its tag and ring included, must stay under a shout's grown
  box (`race-webgl.spec.ts`).

**Result, Garage, looks**

- The Result scene is kept plain: phase 3 rebuilds it for a full room. Its motion is the
  slide-in from below and, after a perfect race, the PERFECT banner's pop and its fireworks
  (`C.ui.result.perfect`), which take the missed list's place and stay under the streak
  line: a fixed number of bursts, each one Graphics redrawn by its own tween and destroyed
  when it ends, so nothing runs on a Result left open. A perfect race is `perfectRace` in
  `scenes/data.ts`: at least one right answer, none wrong, no timeout.
- The best streak reaches Result in the `RaceOutcome` the Race scene passes, never through
  the bridge: the server's result payload has no field for it. Its line shows the race's
  badge (`scenes/badge.ts`) from the first tier on and nothing below. The missed list is the
  questions judged wrong, timeouts included, voids not, each with its right option where the
  save's `answerKey` has an entry; it cuts each question and answer to the panel's line counts and
  stops so that the board, its "and N more" line included, ends above the buttons.
  `C.ui.question.missedShown` and the backend's `MAX_SHOWN_KEYS` are the same number: raising
  one alone lists missed questions without a right answer.
- Result's counts are the server's, from the save of its race id; until it replies they read
  saving, and after a failed save or a 409 they are the game's own tally. PERFECT shows by the
  game's tally and goes, fireworks too, when the save's counts are not perfect; the fanfare
  has played by then. When the server counted more wrong answers than the list holds (a
  voided answer or one closed at the line that it got), a muted line under the list says so.
- A look is chosen only in the Garage scene, through `look/` (its own `CLAUDE.md`); Home's
  racer only opens it. Home (`C.ui.home`) and the Garage (`C.ui.garage`) show the chosen look
  large from behind with the driver turned round to face the camera (`drawRacer` facing
  'front'), drawn at full size in its own Graphics, never a scaled container. Only the
  Garage's is bobbed, by one endless tween on that Graphics' y, which the scene's shutdown
  stops. The Garage shows one picker row at a time, under its Character or Kart tab.

**Sound and motion**

- Sound is off until the Sound button. Every sound is synthesized in `engine/audio.ts` on
  Phaser's audio context, so its gesture unlock covers them. The hum must be stopped when
  sound is turned off or the scene shuts down. The Result scene
  has no sound of its own: the Race scene plays the finish fanfare, longer after a perfect
  race.
- `prefers-reduced-motion` (`scenes/motion.ts`) drops the kart's lurch, the shout tween, the lap pop, the cards' pop-in, Splash's slides (she appears and
  leaves in place, at the same times), the result slide-in, the PERFECT banner's pop and the
  fireworks (the banner stands still), and the Garage preview's bob. Flashes, the flames, the
  speed lines, the vignettes and the Lightning edge's pulse, the arcs (one always shown, each
  held for `C.ui.streak.crackle.calmMs`, the slots changing one at a time), the throw's flight and landing, her gun's raise, the bottle's tip, her speech bubble, the burst, the stun's stars and drops (standing still, not turning),
  the badge's falling shards and the board's next-tier pulse stay: none of them moves the
  camera or the kart.

## Gotchas

- A scene that subscribes to the bridge must unsubscribe on `SHUTDOWN`, or a restarted
  scene renders twice.
- A `SHUTDOWN` handler must not touch a game object: the display list is destroyed before
  it runs, a `setText` there throws inside Phaser's frame step, and the whole game freezes
  on its last frame. The Race scene's handler only stops audio nodes.
- The pixel ratio is read once when the game is created. Moving the window to a screen with
  another ratio keeps the old canvas size until the page reloads.
- A `scene.start` of a key that is not registered stops the current scene and shows a blank
  stage; `scenes/index.ts` is the one list.
- The dev server's incremental build can wedge after files under this folder are deleted:
  the served bundle stops changing. Restart it.

## Verify

Run from the repository root as its `CLAUDE.md` says; `--browsers=ChromeHeadlessGL` runs the WebGL
specs, plain `ChromeHeadless` skips them. One spec file per area:

- `track/geometry.spec.ts`: the layouts, the queries, the lap's length (at least the server's)
  and bends, the texture size, the box rows and the props.
- `engine/race.spec.ts`: the kart on rails, laps and the finish time, boosts and traps, the
  box hit test.
- `engine/streak.spec.ts`: the streak's count, tiers and breaks.
- `lightning-kart.component.spec.ts`: the host's calls without the game: the deal's errors and
  time limit, the answer's refusals, the finish held for an answer, its time limit, its save
  states and the board reload.
- `scenes/flow.spec.ts` (headless): the walk through the menus, the deal at START, Result and
  its save states, Home, How to Play and the Garage, with a fake bridge (`testing/fake-calls.ts`).
- `render/mode7.spec.ts`: the shader against the projection.
- `render/track-texture.spec.ts` (headless): the paving read from the texture's pixels, ink on
  every hexagon edge up to the road's edge and none past the wall, both tracks.
- `render/road-overlay.spec.ts` (at 1920 by 1080): the wall's, the stripe core's, the start
  line's and a checkpoint mark's edges where the projection puts them and sharp, the wall on
  the arc in the tightest bend, the Debug scene drawing it, mid-fade each part one layer over
  the texture (no colour drift), the hand-over to the texture, nothing above the horizon or
  behind the eye, the triangle count on both tracks.
- `scenes/ready-webgl.spec.ts`: START's loading panel, the road built a slice a frame, the
  deal step after it, a load cut short or failed.
- `scenes/race-webgl.spec.ts`, a game per spec: the Race scene drawn for real, the dealt deck,
  the answer path with a hand-driven checker, its resend and void, Splash, the trap, the
  streak, the question block's layout, the input, the road texture.
- `look/draw.spec.ts`: see `look/CLAUDE.md`.

The look of every screen, of Splash, of the arcs and of the streak, the feedback and the
round trip with a real backend (deal, answers, finish, leaderboard) are checked by playing.

Every spec that makes a `Phaser.Game` runs it on `testing/spec-clock.ts`: the game's loop
sleeps and each wait steps it by game time, with `Date.now` faked because Phaser's tweens read
it. A wait or timeout in those specs is never wall-clock time, but Jasmine's own spec timeout
is: a wait rejects once its game is destroyed or another taken, so a spec abandoned on that
timeout stops when its `afterEach` destroys its game. Phaser handles a key event as it is
dispatched and empties its queue only at the end of a frame, so a spec steps a frame between
key events, or the first replays. Nothing outside a spec file may import from `testing/`.
