# games/lightning-kart

Owns: the Lightning Kart game on a course's race route, a Phaser 3 game inside one Angular
host.

## Rules

- Phaser is imported only under this folder, and this folder is reached only through the
  race route's `loadComponent`. Importing it from an eagerly loaded file would put about
  1.2 MB in the initial bundle. `angular.json` lists it under `allowedCommonJsDependencies`.
- `lightning-kart.component.ts` is the only Angular file. It owns the theater band, the
  services and the bridge. It has no other template and no other DOM: every screen, error
  and button of the game is drawn inside the canvas. The navbar is hidden on the race route
  by `hiddenRoutePatterns` in `app.component.ts`; the course sidebar stays.
- `bridge.ts` is the one seam. The host sets data and listens for intents; scenes read data,
  listen for `dataChanged` and fire intents. Scenes, `draw-racer.ts` and `engine/` never
  import Angular, a service, or anything under `app/components/`. Scenes get the bridge from
  the game registry with `bridgeOf(scene)`.
- `engine/constants.ts` is the only home of tuning numbers and of the ui colours, fonts,
  sizes and durations. Scenes take those from `C.ui`; a position on the stage may be a
  literal.
- Scenes work in stage units, 960 by 540. The canvas is that times the pixel ratio (capped
  by `C.ui.maxPixelRatio`) and each scene's `create` calls `setupStage` first, which zooms
  the camera to match. Never read `scene.scale.width` for layout.
- Menus take pointer input only (`widgets.ts` `button`); no menu reads the keyboard. The
  Race scene alone reads the keyboard: Left/Right or A/D steer, Down or S holds a drift, Up,
  W or Space fires a stored nitro charge, 1 to 6 answer, Escape twice within two seconds
  quits. Holding the left or right half of the stage steers too, except over a button; on a
  touch device a Drift and a Nitro button sit in the bottom corners of the stage.
- A track is a `TrackDef` in `track/`: pieces walked by `track/geometry.ts` `layout`, which
  must end heading +x west of the origin and closes the loop itself with two gentle arcs and
  a straight (the finish). Checkpoints are fractions of the lap; box slots are distances
  along it and sit on straights and easy road only, so a question never opens in a corner.
  The world is y down, like the texture; a positive heading change is a right turn.
  `C.world.verge` is 0: the wall stands at the road edge and the grass rules (`C.kart.grass`,
  dust, rumble) never fire. Raising it brings the verge and those rules back; the specs
  test them on a track with its own verge.
- The race track is `track/lap.ts`; `?track=test` on the race page picks the short
  `track/test-track.ts` for tuning. `?debug=top` or `?debug=mode7` opens `scenes/debug.ts`
  instead of Home.
- The view is mode 7: `render/track-texture.ts` rasterises the track once into a canvas
  texture and `render/mode7.ts` samples it through a full-stage shader. It needs WebGL; the
  Race scene shows one line of text without it and still handles engine events, which is
  what the headless flow spec relies on.
- The kart on the road is `draw-racer.ts` `drawKartTop` in a container: the drawing's nose
  is along +x, so the inner graphics turns by the heading relative to the camera minus a
  quarter turn (nose up the screen when they agree); the container scales by depth and
  squashes by the pitch, never flatter than `C.ui.kart.minSquash`. Skid marks are drawn straight onto
  the track canvas texture while drifting and uploaded by `refresh()` at most every
  `C.ui.fx.skidRefreshMs` and when the drift ends; `update()` on that texture reads every
  pixel back and is never called.
- The seed shuffles the question deck and nothing else. The Race scene draws a new seed
  per race; phase 3 will hand every racer in a room the same one.
- Laps count only through every checkpoint in order and then the line, each crossed going
  forward by less than `C.world.checkpointWindow` in one step. A right answer stores one
  nitro charge, cap two; a fire mid-boost outside the chain window does nothing and keeps
  the charge.
- Item events are dropped while a question is open. The countdown runs on race time, a
  timeout counts as wrong, and a question still open at the finish counts neither way. The
  deck is shuffled once per race, reshuffled when exhausted, never the same card twice in a
  row.
- `finished` is fired once per finish by the Race scene and posted once by the host, which
  then reloads that scope's leaderboard. The Result scene's Retry fires it again only after
  a failed save; the race is not replayed.
- The answer key is in the browser (`correctIndex` on every question). Accepted for phase 1.
- A character or a kart is data in `catalogue.ts`; `draw-racer.ts` draws every look from
  parts. Ids such as `chr_bolt` travel to the server in `raceAppearance` and are never
  renamed. The Garage scene is the only place a look is chosen.
- Sound is off until the Sound button. Every sound is synthesized in `engine/audio.ts` on
  Phaser's audio context, so its gesture unlock covers them. The screech runs while a drift
  does and must be stopped when sound is turned off or the scene shuts down.
- `prefers-reduced-motion` drops the camera shakes, the kart's lurch and wobble, the shout
  tween and the result slide-in (`scenes/motion.ts`). Flashes, dust and the flame stay.
- `engine/race.ts`, `kart.ts`, `effects.ts`, `items.ts`, `seed.ts` and everything in
  `track/` are pure functions on plain objects, no Phaser, no DOM. `render/` is Phaser.

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

`track/geometry.spec.ts` (the tracks close and the queries agree), `engine/race.spec.ts`
(the kart model, walls, laps, nitro, with a bot), `scenes/flow.spec.ts` (a headless walk
through the scenes with a fake bridge), `render/mode7.spec.ts` (the shader draws the road
where the projection says) and `scenes/race-webgl.spec.ts` (the Race scene drawn for real:
countdown, drift, the nitro chain, a wrong answer, bump, lap, finish, nothing thrown), both
WebGL launcher only, and `draw-racer.spec.ts` (every look draws from behind, from above and
as a portrait). The look of the feedback and the leaderboard round trip are checked by
playing.
