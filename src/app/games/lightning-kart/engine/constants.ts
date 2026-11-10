// Every tuning number of the race. Change these after playing, not before.
// Units: the world is in track units (a kart is about 2 wide); speeds are units per second.
export const C = {
  laps: 3,
  maxRacers: 10,
  minQuestions: 6,
  questionCountdownS: 10,
  maxStepS: 0.1, // longest simulated step per frame

  // The world is in units; a kart is about 2 wide and the road three karts wide.
  world: {
    roadWidth: 20,
    verge: 0, // grass from the road edge to the wall; 0 puts the wall at the road edge and the grass rules never fire (owner, 2026-11-10)
    spacing: 6, // distance between centreline samples when a track is laid out
    kerbCurvature: 1 / 60, // |curvature| from here on is a hard corner and gets kerbs
    boxRadius: 3, // a box is hit when the kart is within this
    boxCooldownS: 4, // a hit box is dark and inert for this long
    checkpointWindow: 40, // a checkpoint or the line counts only when crossed by less than this per step
    texScale: 4, // texture pixels per world unit
    texMargin: 30, // world units of grass around the track on the texture
  },

  kart: {
    topSpeed: 30, // units per second
    accel: 14, // units per second squared, toward a higher target speed
    brake: 40, // toward a lower one
    turnRate: 0.65, // radians per second at top speed, full lock: a radius of 60 units
    turnRateLow: 1.8, // at a standstill; falls linearly to turnRate at top speed
    minTurnSpeed: 4, // below this the turn rate scales down to zero
    gripTau: 0.08, // seconds for the velocity to follow the heading on tarmac
    drift: { turnMul: 2.2, gripTau: 0.38, mul: 0.92, minSpeedFrac: 0.4 },
    grass: { mul: 0.55, gripTau: 0.5 },
    wall: { steepDeg: 32, slideLoss: 0.05, bounce: 0.45, pushIn: 0.5, eventGapS: 0.5 },
    length: 2.6,
    width: 1.8,
  },

  boost: { mul: 1.5, seconds: 5, chainWindowS: 1, maxCharges: 2 },
  slow: { mul: 0.5, seconds: 3 },
  bump: { mul: 0.6, seconds: 1 },

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

  audio: { humHz: 90, gain: 0.04, glideS: 0.05, fxGain: 0.12, screechHz: 1500, screechGain: 0.025 },

  // Menus and HUD. Every scene works in stage units; the canvas is bigger on HiDPI screens
  // and the camera zooms to match (scenes/widgets.ts setupStage).
  ui: {
    stage: { w: 960, h: 540 },
    maxPixelRatio: 2,
    colors: {
      bg: 0x161a24,
      panel: 0x242a3a,
      button: 0x3b6ff0,
      buttonHover: 0x5d8bff,
      buttonDisabled: 0x3a4050,
      text: '#f4f6fb',
      muted: '#9aa3b5',
      danger: '#ff6b6b',
      good: '#58d68d',
    },
    font: { title: 44, button: 22, body: 20, small: 16, hud: 18 },
    button: { w: 240, h: 56, radius: 12 },
    chip: { w: 150, h: 44 },
    row: { w: 520, h: 44, gap: 8 },
    pad: 24,
    road: {
      sky: 0x8ec5ff,
      wall: 0x3a3a3a,
      startLine: [0xffffff, 0x222222],
      checkpoint: 0x3b6ff0,
      ground: [0x5a9e4a, 0x4f8c40],
      verge: [0xb9a77a, 0xad9b6e],
      road: [0x6e6e6e, 0x656565],
      kerb: [0xd23c3c, 0xf2f2f2],
      box: 0xf5c542,
      boxEdge: 0x8a6d1c,
      pole: 0x333333,
      sign: { left: 0xf2c200, right: 0xf2c200, hairpin: 0xd23c3c },
      arrow: 0x111111,
      overlay: 0x000000,
      overlayAlpha: 0.55,
    },
    // Feedback, one row per outcome in the design file's Feedback table.
    fx: {
      boostLurchPx: 14,
      boostMs: 250,
      wobblePx: 10,
      wobbleMs: 70,
      wobbleRepeats: 3,
      shakeOffroad: { ms: 80, power: 0.003 },
      shakeBump: { ms: 220, power: 0.012 },
      flashMs: 180,
      flashGood: [60, 200, 110] as [number, number, number],
      flashBad: [220, 60, 60] as [number, number, number],
      speedLines: 12,
      speedLineMs: 350,
      shoutMs: 700,
      shoutSize: 48,
      lapPopMs: 300,
      resultSlideMs: 400,
      dustEveryMs: 90,
      dustMs: 400,
      dust: 0xc9b98a,
      flame: [0xff8c1a, 0xffe066] as [number, number], // the nitro flame, outer and core
      doubleFlame: 1.6, // the flame's size while a Double Boost runs
      skid: 'rgba(30, 30, 30, 0.45)',
      skidWidth: 0.35, // world units
      skidRefreshMs: 600, // how often the marks drawn while drifting reach the screen
      chainPulseHz: 3,
      timerBarH: 6,
      line: 0xffffff, // speed lines, the held-item slot, option badges, the chosen chip's outline
    },
    kart: { minSquash: 0.55, shadowAlpha: 0.28 }, // the top-down kart sprite is never flatter than this
    question: { panelW: 640, optionH: 40, optionGap: 8, missedShown: 4 },
    itemSlot: 34,
    escapeTwiceMs: 2000,
  },
};
