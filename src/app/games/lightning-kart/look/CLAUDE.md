# games/lightning-kart/look

Owns: what a racer looks like, and Splash. `catalogue.ts` is the characters and the karts as
data, parts and colours; `head.ts` draws the driver's head, from the front, from behind and from above,
and owns the ink, `shade` and where the behind view's head sits; `draw.ts` draws the karts and
every look's views from those parts with that head; `picker.ts` is the rows
a look is chosen from; `splash.ts` draws Splash, her bubble and its burst, the bottle and the
stun's stars and drops round a racer's head; `bolt.ts` is the one lightning bolt, on the bottle and
the streak badge.

## Rules

- Ids such as `chr_bolt` and `krt_rocket` travel to the server in `raceAppearance` and are
  never renamed.
- `draw.ts` draws every look from parts, never from an image, in three views: `drawRacer`
  from behind with a lean and an optional exhaust flame (the boost's, or the streak's idle
  one), the driver facing away (`facing` 'back', the Race scene) or turned round to show the
  face ('front', the large previews on Home and in the Garage, and the picker's kart chips), `drawKartTop` from above with the nose along +x and the same flame, `drawPortrait` the
  driver in a disc. The streak badge is not theirs: `../scenes/badge.ts` draws it over the kart.
- A kart's data is two colours plus the tyres: `body` is the paint, `stripe` is the accent
  block (the engine box at the rear and the bumper insert at the nose), never a painted line.
  The darker shade, the outline and the portrait ring are computed from `body` by `shade`,
  and a character's cel shadows (chin, the headgear's lower edge, lower torso) and its
  headgear's speckle (`tint`) from its own colours; chrome, ink, the lamps, the gloves, the
  horns' bone and the behind view's shadow alpha are constants in `head.ts` and `draw.ts`. Add
  no colour field for a shade.
- `drawRacer` spans 1.32 `s` wide, from `racerTop(character)` `s` above `y` (the headgear's
  top, from `REACH` in `head.ts`) to 0.08 `s` below it, the half height of its own shadow
  blob; `../scenes/race-webgl.spec.ts` takes the kart's drawn bottom as that 0.08 `s`, so a
  change to the blob changes it there too. A headgear part drawn higher changes its `REACH`.
  The picker sizes the racer from `racerTop` so it fits the Garage chip's icon square,
  `C.ui.chip.h` tall, and the streak badge hangs over it. Its exhaust mouth centres are
  `(x ± 0.33 s, y - 0.2 s)`; the flame, the same `{ lengths, colours, flicker }` as
  `drawKartTop` takes and `null` by default, is a tongue from each mouth down the screen and
  outward, `lengths` times 0.35 `s` long and `lengths` times as wide as at 1, drawn last. On the road it runs every frame, so it
  makes at most 100 fill and stroke calls with the flame.
- Every drawn character, Splash included, follows the owner's chibi reference: the head
  about two thirds of the figure, wider than tall, a rounded square; a tiny body with stubby
  limbs; a thick ink outline on every shape; flat fills with one hard cel shadow per part;
  big eyes set close together; a dot nose and a small mouth with attitude; headgear with
  volume over the top half of the head, with a speckle highlight.
- On the road the driver is seen from behind, as the kart is: `drawHeadBack` draws the back
  of the head with the ears out on both sides, a neck and the headgear's back, no eye, brow,
  nose, mouth or mark, and each driver must stay recognisable from behind by silhouette and
  colour alone. It keeps `drawHead`'s width and `REACH`, so the badge and the box hold for
  both. From behind the arms reach forward, elbows out, to the gloves on the rim's sides; the
  head turns into the corner with the lean and that side's ear slips behind the skull, with
  no step at any lean.
- The face is one drawing from the front, `drawHead`, shared by `drawRacer` facing front, the
  portrait and Splash: wherever the driver poses for the camera (portraits, the Ready and
  Result boards, the picker's chips, the large racer on Home and in the Garage). A character's look fields pick its parts:
  `headgear` its silhouette (each must stay recognisable as a black shape alone, also from
  above), `lid` the mood: the shape of the one ink stroke per eye that is lid and brow and
  cuts the eye's top (confident shallow, calm a level arch, cheeky one low and one cocked,
  angry steep), `mouth`, `mark` and Pip's `hair`. The cast reads tough and funny, never
  sinister. Goggles sit on the brim, never over the eyes. A portrait always draws the small
  eye (`drawHead`'s `smallEyes`), at any size and pixel ratio; on the kart chips and in the
  large racer on Home and in the Garage an eye narrower on screen than `C.ui.kart.smallEyePx` is the small eye too. The
  small eye is solid ink under its lid, every mood's the same size, with the lids shortened
  toward the nose so the two eyes never merge into one bar. The head measures the size with
  its scene camera's zoom alone, so it must not be drawn in a scaled container. A suit with
  a luma under `C.ui.kart.darkSuitLuma` gets a lighter cel band, not a darker one.
- Each headgear's dome is a polygon (`domeOutline`), never a rounded rectangle whose top
  radii pass half its height: Phaser fills and strokes those along different curves. A
  closed `strokePoints` leaves an unjoined seam at its first point, so an outline starts
  where something drawn over it hides the seam (the eye's starts under its lid).
- `drawKartTop` draws no shadow: the Race scene draws the shadow ellipse before calling it.
  Its two flames start at the exhaust mouth centres, `(-0.5 s, ±0.24 s)`. It runs every
  frame, so it makes at most 56 fill and stroke calls per kart, flames included.
- `splash.ts` draws Splash with `head.ts`'s `drawHead`, `INK` and `shade`: her headgear is
  `swim`, plain hair with the swim goggles, with the cheeky lid and a smirk; the ponytail,
  the fringe and the tie are hers. She is never a racer: her `Character` lives in
  `splash.ts`, not the catalogue, and her colours are `C.ui.colors` roles plus her skin.
  What she holds (the gun, the bottle or nothing) turns about her hand; the bottle is drawn
  after her head, which would hide it. `splashAim` and `splashRelease` give the scene the gun's angle and where a throw
  leaves her, in her space; `splashBottleH` sizes the thrown bottle like the held one.
- `racerHead` is where Splash's shot hits a racer drawn by `drawRacer`, and the stun's ring
  turns `C.ui.splash.stun.lift` over it: halfway between the head's centre (`HEAD_Y`) and the
  headgear's top (`racerTop`), slid with the lean, so a taller headgear is hit higher. `drawStun` draws the
  ring (`C.ui.splash.stun`) in two parts, 'back' before `drawRacer` and 'front' after it,
  never inside the racer's draw budget (the Race scene gives each part a Graphics of its own,
  How to Play draws all three in one); `stunTop` is its top. How to Play draws its stars and
  drops `C.ui.howToPlay.stunSize` times larger, and `drawBurst` (Splash's bubble breaking,
  `C.ui.splash.burst`) on the head. `draw.spec.ts` fails when the stars at the ring's sides
  no longer clear a driver's head as `drawHeadBack` draws it.
- `picker.ts` `characterRow` and `kartRow` are the only place a look is chosen, besides the
  Garage scene wiring their pick to `lookChosen`. Each draws one row centred on the stage and
  returns the chips it drew so the caller destroys them on the next data change or tab switch.
  A row holds at most five chips at `C.ui.chip.w` on the 960 stage.
- Nothing here imports Angular, a service, or anything under `app/components/`. `picker.ts`
  takes its chip from `../scenes/widgets.ts`.

## Verify

`draw.spec.ts`, on a headless scene and with a recording stand-in for Graphics: every view of
every look and Splash's parts draw; the behind view's box, the call budgets, the eyes and the
faces where each view may show them; the flame's size; where the shot hits and the stun's ring.
Headless Phaser renders nothing, so how a kart or Splash looks is checked by playing. The
picker is drawn by `../scenes/race-webgl.spec.ts` when it opens the Garage, and
`../scenes/flow.spec.ts` taps its rows through the Garage's tabs.
