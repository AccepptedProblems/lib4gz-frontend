// Every tuning number of the race. Change these after playing, not before. The server mirrors
// `laps`, `kart.topSpeed`, `boost.seconds`, `boost.doubleMul` and the lap's length (track/lap.ts)
// in the `application.race` block of the backend's application.yaml, and refuses a finish
// faster than they allow: raise one here, or shorten the lap, and change it there too, or
// honest finishes are refused.
// Units: the world is in track units (a kart is about 2 wide); speeds are units per second.
export const C = {
  laps: 3, // mirrored by the server (application.race.laps)
  maxRacers: 15,
  minQuestions: 6,
  questionCountdownS: 10,
  // An answer the server has not replied to, on race time from the press or the timeout: asked
  // again once at `resendMs`, void at `voidMs` (no buff, no debuff, the streak untouched).
  // With no verdict by `checkingMs` the board shows that the answer is being checked.
  answer: { checkingMs: 600, resendMs: 1500, voidMs: 3000 },
  // The host's time limits on its calls, wall time: the deal at START, each answer attempt and
  // the finish, which waits first for every answer call still out (at most `answerMs`).
  // A deal still out after `wakeMs` says the server is waking (it scales to zero when quiet).
  net: { dealMs: 25000, wakeMs: 4000, answerMs: 3000, finishMs: 10000 },
  maxStepS: 0.1, // longest simulated step per frame

  // The world is in units; a kart is about 2 wide and the road is `lanes` lanes of six.
  world: {
    roadWidth: 36,
    lanes: 6, // dashed lines on the road; boxes stand one per lane and racers start at a lane centre
    rowsPerLap: 8, // box rows spread evenly round the lap, one box per lane in each
    spacing: 6, // distance between centreline samples when a track is laid out
    boxRadius: 3, // a box is hit when the kart is within this
    boxCooldownS: 4, // a hit box is dark and inert for this long
    checkpointWindow: 40, // a checkpoint or the line counts only when crossed by less than this per step
    texScale: 4, // texture pixels per world unit
    texMargin: 30, // world units of grass around the track on the texture
  },

  kart: {
    topSpeed: 44, // units per second; mirrored by the server (application.race.top-speed)
    accel: 14, // units per second squared, toward a higher target speed
    brake: 40, // toward a lower one
    slideSpeed: 14, // units per second across the road while left or right is held, the same at every speed
    length: 2.6,
    width: 1.8,
  },

  // A right answer's boost, started when the kart catches Splash's bottle: `mul` times the top
  // speed for `seconds`. A right answer whose verdict comes while a boost or a Double Boost runs
  // starts a Double Boost instead, `doubleMul` for `seconds`, replacing whatever runs then.
  boost: { mul: 1.5, doubleMul: 1.7, seconds: 5 }, // seconds and doubleMul mirrored by the server (application.race)
  // A wrong answer's or a timeout's trap, started when Splash's bubble bursts on the racer's head: it ends a
  // running boost, stops the kart dead and holds it, unable to slide, for `seconds`; then it
  // accelerates from zero.
  trap: { seconds: 0.69 },

  // Splash after every answer (scenes/splash.ts), on race time: at the press she slides in from
  // the right edge over `slideInMs` and waits for the verdict. Wrong, or a timeout: she raises
  // her gun for `aimMs` and fires; the bubble flies for `flightMs` and bursts on the racer's
  // head, which is when the trap starts. Right: she winds up for `windUpMs` and throws the bottle,
  // which flies for `throwMs`; the kart catches it, which is when the boost starts. She throws
  // once she has arrived, so with a verdict at the press both land about two thirds of a
  // second after it; then she slides out over `slideOutMs`, as she does at once on a void.
  // Under reduced motion she stands in place for the slides' time instead, so the landing
  // comes at the same moment.
  splash: { slideInMs: 220, aimMs: 160, flightMs: 290, windUpMs: 160, throwMs: 290, slideOutMs: 260 },

  // Right answers in a row (engine/streak.ts): the count that reaches each tier, lowest first. A
  // wrong answer or a timeout breaks the run; a break from `loudBreakAt` on stings and shatters
  // the badge, a shorter one ends silently.
  streak: {
    tiers: [{ name: 'spark', at: 2 }, { name: 'charged', at: 3 }, { name: 'lightning', at: 5 }] as const,
    loudBreakAt: 3,
  },

  camera: {
    back: 9, // behind the kart, along the camera heading
    height: 5.5,
    pitchDeg: 16, // looking down from level; the horizon sits about a third down the stage
    fovDeg: 70, // vertical
    headingTau: 0.18, // seconds for the camera heading to follow the kart's
    near: 0.5,
    fogNear: 110, // world units from the eye where the haze starts
    fogFar: 240, // and where the ground is all sky colour
  },

  audio: { humHz: 90, gain: 0.04, glideS: 0.05, fxGain: 0.12 },

  // Menus and HUD. Every scene works in stage units; the canvas is bigger on HiDPI screens
  // and the camera zooms to match (scenes/widgets.ts setupStage).
  ui: {
    stage: { w: 960, h: 540 },
    maxPixelRatio: 2,
    // Sunset palette, Horizon Chase 2 style: saturated and flat. Roles and hex values are
    // listed in the design file's Screens section.
    colors: {
      bg: 0x1b1038, // deep dusk, the stage behind everything
      panel: 0x2a1a52,
      button: 0xff6a1f,
      buttonHover: 0xff8f4d,
      buttonDisabled: 0x4a3d6b,
      text: '#fff6e8',
      muted: '#c9b8e8',
      danger: '#ff3d6e',
      good: '#3ff0c3',
      orange: 0xff6a1f,
      magenta: 0xff2e97,
      cyan: 0x19d8ff,
      yellow: 0xffd23f,
      sunset: [0x3b1a7a, 0xff2e97, 0xff6a1f] as [number, number, number], // sky gradient, top to bottom
    },
    // `family` is the name the FontFace is registered under (public/fonts/oswald-variable.woff2,
    // loaded by the host before the game boots); `stack` is what every canvas text uses.
    font: { family: 'Oswald', stack: 'Oswald, "Arial Narrow", sans-serif', title: 44, button: 22, body: 20, small: 16, hud: 18, hudBig: 28 },
    // The reading face of the question panel's question and options: Open Sans, registered the
    // same way from three subset files (public/fonts/open-sans-*.woff2: latin, latin-ext,
    // vietnamese). `question` and `option` are CSS font weights within its 300 to 800 range.
    read: { family: 'Open Sans', stack: '"Open Sans", Arial, sans-serif', question: '600', option: '700' },
    // Skewed shapes (widgets.ts): `skew` is the horizontal shear in px between the top and
    // bottom edge of every button and panel, `stripe` the width of a button's accent block at
    // its left end.
    button: { w: 240, h: 56, skew: 12, stripe: 10 },
    panel: { alpha: 0.92, stripe: 6 },
    title: { bar: { w: 64, h: 6, gap: 6 } }, // the slanted accent bar under a screen title
    // Which palette colour each accent takes, by role; widgets resolve them through `colors`.
    accent: { button: 'yellow', panel: 'magenta', title: 'orange', selected: 'cyan', mine: 'cyan' } as const,
    // The menu backdrop: sky gradient down to the horizon (a fraction of the stage height),
    // the sun on it, decoration stripes in a corner at low alpha.
    backdrop: { horizon: 0.66, bands: 64, sunR: 72, sunX: 0.72, stripeAlpha: 0.16 },
    // The leaderboard (widgets.ts): a row's height where the scene does not pass one, and the
    // alpha of the skewed `accent.mine` block under the caller's own row.
    leaderboard: { rowH: 30, mineAlpha: 0.25 },
    chip: { w: 150, h: 44 },
    // The Garage (scenes/garage.ts): the chosen look in the middle, the racer from behind `kartW` px
    // wide on a slanted stand `stand.w` wide, a lighter top face `stand.top` tall in `stand.face`
    // that the kart stands on over a front face `stand.h` tall in the panel colour with the kit's
    // accent stripe, bobbing `bobPx` up and back every `bobMs`; the Character and Kart tabs, each
    // `tab.w` by `tab.h`.
    garage: { kartW: 160, stand: { w: 320, h: 22, top: 14, face: 0x5b4a8a }, bobPx: 5, bobMs: 1600, tab: { w: 170, h: 40 } },
    // Home (scenes/home.ts): the player's racer, driver facing front, `kartW` px wide.
    home: { kartW: 170 },
    // Ready's loading panel after START (scenes/loading.ts): a board `w` by `h` in the stage's
    // middle over a veil of `veilAlpha`, a bolt `boltR` from centre to tip pulsing to `pulse`
    // times its size every `pulseMs`, the bar `bar.w` by `bar.h` filling in `colors.yellow` over `colors.bg`.
    // A failed START's note beside START takes the first of `note.sizes` that fits in `note.lines`.
    ready: { loading: { w: 520, h: 180, veilAlpha: 0.6, boltR: 20, pulse: 1.2, pulseMs: 500, bar: { w: 440, h: 18 } }, note: { sizes: [16, 13], lines: 3 } },
    // How to Play (scenes/how-to-play.ts): one board per step, `rowH` tall and `gap` apart, each with
    // a small picture `inset` px clear of the board's top and bottom: racers as large as that
    // allows (the stunned one with its ring turned `stunPhase` radians, its stars and drops
    // `stunSize` times the race's, the bubble's burst `burst[0]` kart widths across, `burst[1]`
    // of the way through), the bottle `bottleH` tall,
    // boxes `box` px square, the slide's arrows `arrow` px from tip to base, the answer cards
    // `card` and the board above them `card.board` tall, the flag's checks `check` px square,
    // outlines `line` px.
    howToPlay: { rowH: 70, gap: 2, inset: 4, stunPhase: 0.5, stunSize: 1.8, burst: [0.5, 0.6] as [number, number], bottleH: 56, box: 30, arrow: 16, card: { w: 52, h: 18, board: 14 }, check: 11, line: 2 },
    row: { w: 520, h: 44, gap: 8 },
    pad: 24,
    // The one coastal sunset theme of the race world (render/track-texture.ts, mode7.ts,
    // skyline.ts). The sky is `colors.sunset`; the ground fogs to its last stop.
    road: {
      wall: 0x2a0b24, // the physical wall at the road edge, dark magenta-black
      wallW: 1.2, // world units, just outside each road edge
      startLine: [0xffffff, 0x1a1020],
      startCell: 1.25, // the start line checker's cell in world units, rounded to span the road exactly
      // The wall with the stripe inside it, the start line and the checkpoint marks redrawn
      // every frame as shapes over the texture near the eye (render/road-overlay.ts), where the
      // texture is magnified into a blur. Full up to `fade[0]` world units deep and gone by
      // `fade[1]`, before the fog; also gone where the thinnest part of one (the stripe's core,
      // a checker row, a mark) is under `thinPx[0]` canvas px, full from `thinPx[1]`. Past
      // that the texture's mipmaps draw them. Every edge onto the road or the ground has a
      // `feather` world units wide of that neighbour's colour, fading out, over the texture's
      // soft edge. Bends are sampled every `step` world units, every second sample from `lod[0]`
      // world units deep and every fourth from `lod[1]`. `wallH` above 0 stands the wall up
      // that many world units, its top face `wallTop`; 0 is the flat wall.
      overlay: { fade: [60, 100] as [number, number], thinPx: [1.5, 3] as [number, number], feather: 0.4, step: 1.5, lod: [20, 40] as [number, number], wallH: 0, wallTop: 0x6b2a5c },
      checkpoint: 0x19d8ff, // colors.cyan
      markW: 0.5, // a checkpoint mark's width in world units
      ground: [0x1f4a52, 0x1b434a], // dusk ground beside the road, two close teals in a check
      road: [0x3b3550, 0x37314b], // asphalt, two close purple-greys
      edge: 0xffa028, // the bright core of the glowing stripe along both road edges
      edgeW: 0.5, // world units
      edgeGlow: 0xff6a1f, // the soft stroke under the core
      edgeGlowW: 1.6,
      edgeGlowAlpha: 0.35,
      // The faint hex paving on the road, under the stripe: flat-top cells of this circumradius
      // in world units, lines this wide (one texel at world.texScale 4) in a lighter asphalt at
      // this alpha. Drawn once by render/track-texture.ts.
      paving: { cell: 3.5, lineW: 0.25, line: 0x5a5272, alpha: 0.18 },
      // The dashed lines between the world.lanes lanes, over the paving and under the stripe: in
      // this colour at this alpha, this wide, dashes and gaps this long, all in world units; each
      // line's pattern is stretched a little to close evenly round the lap.
      lane: { line: 0x5a5272, alpha: 0.8, lineW: 0.8, dash: 3, gap: 4 },
      // Anisotropic samples per pixel on the track texture in the mode 7 view (capped by the
      // browser); the far stripe stays crisp while the mipmaps keep the far road calm.
      anisotropy: 8,
      box: 0xffd23f, // colors.yellow
      boxEdge: 0xb0871a,
      // The sun: a fixed world direction, so it slides across the sky as the kart turns.
      sunAzimuthDeg: 30, // world heading of the sun; the start straight heads 0
      sunElevationDeg: 5, // above the horizon; low, so the disc sits on the skyline
      sunRadiusDeg: 4,
      sunGlowDeg: 22, // the warm glow's reach around the disc
      sunGlowAlpha: 0.45,
      // The coastal city silhouette on the horizon: its fill, the lighter band at its base and
      // its height in stage px. Drawn once from `seed` by render/skyline.ts.
      skyline: { fill: 0x2a1240, base: 0x7a2d6e, h: 90, seed: 1138 },
      // The roadside props' colours (render/props.ts): a palm's trunk and fronds with their lit
      // side, a billboard's posts, board, frame, stripes and bolt, a sign's diamond and chevron.
      props: {
        trunk: 0x3a2048, trunkLight: 0x6a4a78, frond: 0x1f6f66, frondLight: 0x3fb597, coconut: 0x2a1a30,
        post: 0x2a1a52, board: 0x1b1038, boardEdge: 0x4a3d6b, stripes: [0xff6a1f, 0xff2e97, 0x19d8ff] as [number, number, number], bolt: 0xffd23f,
        diamond: 0xff2e97, diamondEdge: 0x1b1038, chevron: 0xffd23f,
      },
    },
    // Feedback, one row per outcome in the design file's Feedback table.
    fx: {
      boostLurchPx: 14,
      boostMs: 250,
      flashMs: 180,
      flashGood: [60, 200, 110] as [number, number, number],
      speedLines: 12,
      speedLineMs: 350,
      shoutMs: 700,
      shoutSize: 48,
      shoutStroke: 6, // the shout's outline in px, in colors.bg
      lapPopMs: 300,
      resultSlideMs: 400,
      flame: [0x19d8ff, 0xf4ffff] as [number, number], // the boost flame: Splash's water blue (colors.cyan, her bubble's) outside, near-white core
      doubleFlame: 2, // the flame's size, long and wide, while a Double Boost runs
      // The boost's speed lines (scenes/fx.ts): streaks from the stage edges toward the centre,
      // alternating these colours, this wide, the bright head at this alpha, the tail fading.
      speedLine: [0x19d8ff, 0xffffff] as [number, number],
      speedLineW: 2,
      speedLineAlpha: 0.85,
      // The edge vignette while a boost runs: this colour from the stage edges in, at this alpha.
      vignette: 0x1e0d5c, // deep blue-violet
      vignetteAlpha: 0.6,
      timerBarH: 6,
    },
    // The kart on the road: seen from behind while its heading is within `topViewDeg` of the
    // camera's, at `behindScale` times its world width; past that the top-down sprite, never
    // flatter than `minSquash`. `leanTilt` is the behind view's tilt per radian the kart's heading leads the camera's.
    // A driver's eye drawn narrower than `smallEyePx` screen px (stage units times the pixel
    // ratio) on the road or in the Garage preview is a solid ink shape under its lid, no white,
    // no pupil, no glint: a white eye with a ring and a pupil blurs into a pair of glasses. A
    // portrait always draws that small eye, whatever its size on screen. A suit whose luma (0..255) is under
    // `darkSuitLuma` takes a lighter cel band, since a darker one vanishes on near-black.
    kart: { minSquash: 0.55, shadowAlpha: 0.28, topViewDeg: 60, behindScale: 1.25, leanTilt: 0.25, smallEyePx: 10, darkSuitLuma: 48 },
    // Splash, her bubble and her bottle (look/splash.ts, scenes/splash.ts): her height in stage px
    // from her feet to the top of her hair; the bubble's radius and how high its flight arcs, how
    // high the bottle's lob arcs; how long the landing's ring and droplets last (the bubble's burst
    // on the head, the bottle's catch). `burst` is the bubble breaking on the head: `r` px across,
    // `drops` droplets, `lines` white impact lines `fan` radians apart, `lineW` of `r` wide. `stun` is the dizzy ring round a trapped racer's head
    // (look/splash.ts drawStun): `stars` stars in `star` and `drops` drops in `drop`, alternating,
    // `starR` and `dropR` times the behind view's width in radius on a flat ellipse `ring` kart
    // widths in half-width and half-height, centred `lift` kart widths over the shot's point, the near side `depth` larger and the far side as much smaller,
    // outlined `outline` of the width in ink, a white twinkle on each star `twinkle[0]` of its
    // radius up and left of its centre and `twinkle[1]` of it in radius, turning `turnHz` times a second, fading over
    // `fadeMs` when the trap ends. `say` is
    // her speech bubble on a bottle throw: the line at `size` px in `ink` on a `fill` plate with
    // `padX` and `padY` inside, corner `r`, an `outline` px ink edge, and a tail `tail` px whose
    // tip is `tipX`, `tipY` times her height from her feet, beside her face.
    splash: {
      h: 170, bubbleR: 18, arc: 36, lob: 70, popMs: 240,
      stun: {
        stars: 3, drops: 3, star: 0xffd23f, drop: 0x19d8ff, starR: 0.21, dropR: 0.14, ring: [0.95, 0.24] as [number, number], lift: 0.08,
        depth: 0.25, outline: 0.034, twinkle: [0.3, 0.2] as [number, number], turnHz: 1.1, fadeMs: 180,
      },
      burst: { r: 30, drops: 10, lines: 3, fan: 0.55, lineW: 0.09 },
      say: { size: 18, padX: 10, padY: 3, r: 10, tail: 9, tipX: -0.42, tipY: -0.72, fill: 0xfff6e8, ink: 0x1b1038, outline: 2 },
    },
    // The roadside props (render/props.ts): each kind's height in world units, the texture's
    // aspect gives the width; `reach` is how far past camera.fogFar ahead of the eye, along its
    // heading, a prop is still projected (it is all but faded there).
    props: { palm: { h: 9 }, billboard: { h: 6.5 }, sign: { h: 4 }, reach: 20 },
    question: { panelW: 640, missedShown: 4 },
    // The question panel (scenes/question-panel.ts): one card per option on the stage's bottom pad,
    // two to a row, and on them a `board` with the question in `ink`. Card i takes
    // `fill[i]` (red, blue, amber, green: dark enough for white text) and shape i (triangle,
    // diamond, circle, square, radius `shapeR`, in `shape`) in its top left corner, its key
    // number in the top right. Every part has a `radius` corner, an `outline` px ink edge and a
    // hard ink shadow `shadow` px down and right. A card is at least `h` tall; its text has an
    // ink stroke `stroke` px wide. The question takes the first of `questionSizes` (px) that
    // fits in `questionLines` lines, an option the first of `optionSizes` that fits in
    // `optionLines`; past the last size the text is cut with an ellipsis, so the panel's
    // height has a ceiling. Cards pop from `popFrom` scale over `popMs`, `popStaggerMs` apart;
    // reduced motion shows them at once. A pressed card stays lit while the verdict is awaited and
    // the others drop to `lockedAlpha`; on a timeout every card does. One card and one number key per `fill` colour: the
    // race-questions editor's RACE_MAX_OPTIONS (app/components/course-teacher/race-questions/)
    // must match its length. An answer waiting long for its verdict (`C.answer.checkingMs`)
    // shows an ink tag on the board's top edge, right, its alpha pulsing `checkingHz` times a
    // second (still under reduced motion).
    cards: {
      fill: [0xe8264f, 0x2f6fe0, 0xc77a00, 0x17894b] as [number, number, number, number],
      board: 0xfff6e8, ink: 0x1b1038, shape: 0xfff6e8,
      h: 48, gap: 10, radius: 12, outline: 3, shadow: 4, shapeR: 9, stroke: 4,
      questionSizes: [20, 17], questionLines: 3, optionSizes: [18, 15], optionLines: 2,
      popFrom: 0.6, popMs: 260, popStaggerMs: 50, lockedAlpha: 0.35, checkingHz: 1.2,
    },
    // The Result scene's two boards: the leaderboard's row height, tighter than the Ready board's so
    // the heading and eleven rows fit beside the missed list. The best streak's line, `streakRowH`
    // tall, draws the race's badge (scenes/badge.ts) as over a kart `streakKartW` px wide.
    // `perfect` is the banner of a race with every question right, its centre `bannerAt` of the
    // way down the board under the streak line: `w` by `h`, slanted like the kit, banded from `from` to `to` (colors.sunset's magenta and orange), its accent stripe
    // `stripe` wide in colors.yellow, a hard shadow `shadow` px down and right in colors.bg, the
    // word `size` px with a `stroke` px colors.bg outline; it pops in from `popFrom` of its size
    // over `popMs` once the sheet has slid in. Then `bursts` fireworks, `burstGapMs` apart, each
    // `sparks` streaks `sparkW` px wide in one of `colours` and colors.text, flung `burstR` px out
    // and falling `fall` px while they fade over `sparkMs`, a trail of `trail` of their flight
    // behind them; the last burst ends about two seconds after the first starts. A burst goes off
    // between the two `rise` px over the banner's centre, never so high its sparks reach the
    // streak line.
    result: {
      rowH: 26,
      note: { sizes: [16, 13], lines: 3 }, // a failed save's text, fitted like Ready's note
      streakRowH: 40,
      streakKartW: 70,
      perfect: {
        bannerAt: 0.6, w: 300, h: 76, bands: 10, from: 0xff2e97, to: 0xff6a1f, stripe: 14, shadow: 6, size: 56, stroke: 6,
        popFrom: 0.6, popMs: 320,
        bursts: 5, burstGapMs: 280, sparks: 14, sparkW: 4, burstR: 80, rise: [40, 100] as [number, number], fall: 40, sparkMs: 900, trail: 0.12,
        colours: [0xffd23f, 0x19d8ff, 0xff2e97, 0xff6a1f] as const, // colors.yellow, cyan, magenta, orange
      },
    },
    // The race HUD (scenes/hud.ts). `slot` is the empty position slot beside the lap, a corner
    // button's height.
    hud: {
      slot: { w: 72, h: 36, gap: 12, alpha: 0.35 },
    },
    // The streak (C.streak) as the player sees and hears it. Per tier: `colour` for the badge, its
    // shards, the shout and the question board's next-tier pulse; `flame` the idle exhaust flame's
    // outer and core colours while no boost runs, flickering like the boost's; `badge`
    // the badge's scale; `hum` semitones the engine hum is raised; `shout` whether reaching it
    // shouts its name. `idleFlame` is the idle flame's length as a share of the boost flame's.
    // The badge (scenes/badge.ts) is `badgeR` times the behind view's kart width in radius at
    // scale 1, its bottom `badgeGap` kart widths over the headgear's top; it breaks into `shards`
    // pieces `shard` badge radii long that fall `fall` badge radii and fade over `shardMs`. The right-answer chime rises
    // through `chime`, semitones over the first answer's, one step per answer in the streak; the
    // last is its ceiling. At Lightning the stage edge pulses `vignette` between the two alphas
    // `pulseHz` times a second, over the boost's violet vignette too, and the lit boxes turn `box`,
    // `boxScale` times their size, with a `boxRim` px `boxEdge` rim. One answer short
    // of a tier the board's ring pulses `nextHz` times a second between the two widths in px,
    // `nextGap` px outside its outline.
    streak: {
      tiers: {
        spark: { colour: 0xff8c1a, flame: [0xff6a1f, 0xffd23f] as [number, number], badge: 1, hum: 0, shout: false },
        charged: { colour: 0xfff6e8, flame: [0xdfe8ff, 0xffffff] as [number, number], badge: 1.25, hum: 1, shout: true },
        lightning: { colour: 0x8fd8ff, flame: [0x3d8bff, 0xeef8ff] as [number, number], badge: 1.45, hum: 1, shout: true },
      },
      idleFlame: 0.75,
      // At Lightning (scenes/crackle.ts): `arcs` slots of electricity over the racer. Each slot
      // repeats every `period` ms (its own, from the range) and in each period shows one arc for
      // `life` ms. An arc runs between two points on an ellipse round the racer's middle, `hug`
      // kart widths in half-width and half-height, scaled by `off` (just inside to just outside
      // it), starting in the slot's own sector of the ellipse, never in the `skip` radians round
      // its bottom: round it by `span` radians, up the body `rise` of the time, or, one time in
      // `1 / cross`, across the body. It has `segments` pieces, each inner point kicked off the
      // line by up to `kink` of a piece; one in `1 / fork` carries a fork of `forkSegments`
      // pieces, `forkLength` of the arc's chord long, turned `forkTurn` radians off it at a kink.
      // Each arc is stroked with every one of `strokes`, widest first: [width in kart widths,
      // colour, alpha]. Under reduced motion the first slot always shows an arc and the others
      // one time in `1 / calmOn`, each for a whole `calmMs`, the slots changing one at a time.
      crackle: {
        arcs: 5, segments: 5, forkSegments: 2, fork: 0.45, forkLength: 0.4,
        forkTurn: [0.5, 1] as [number, number], hug: [0.64, 0.84] as [number, number], off: [0.9, 1.1] as [number, number],
        span: [0.8, 1.7] as [number, number], cross: 0.2, rise: 0.75, kink: 1.1, skip: 1.4,
        period: [150, 290] as [number, number], life: [60, 140] as [number, number],
        strokes: [[0.09, 0x1f5fff, 0.24], [0.04, 0x3d8bff, 0.6], [0.014, 0xffffff, 1]] as [number, number, number][],
        calmMs: 500, calmOn: 0.6,
      },
      badgeR: 0.17,
      badgeGap: 0.06,
      shards: 10,
      shard: 1.3,
      fall: 3,
      shardMs: 900,
      chime: [0, 2, 4, 5, 7, 9, 11, 12],
      vignette: 0x4aa8ff,
      vignetteAlpha: [0.45, 0.9] as [number, number],
      pulseHz: 1.5,
      box: 0xffa91f,
      boxEdge: 0xfff6e8,
      boxScale: 1.5,
      boxRim: 3,
      nextHz: 2,
      nextRing: [2, 6] as [number, number],
      nextGap: 4,
    },
    escapeTwiceMs: 2000,
  },
};

/** A palette number as the CSS hex string that canvas text and the 2D context take. */
export function cssHex(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}
