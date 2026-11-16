# Lightning Kart, mechanics: shuffled cards, four lanes, box rows, Splash, the streak

Status: DONE

## Why

Today a question's options always come in the order the teacher typed them, so a student
can learn the position of the right answer instead of the answer. The question panel is a
list of slanted buttons that reads as a menu, not as a quiz card. The road is three karts
wide with one box per slot, so in a room of ten racers the kart behind finds a dark box
and gets no question. Four questions per lap is too few for a three-minute race. A right
answer and a wrong one are a flash and a sound, so a run of right answers feels no
different from one, and nothing on screen makes the player want the next one.

This task shuffles the options with the race seed, redraws the panel as four cartoon cards,
widens the road to four marked lanes with a box in each lane of every row, puts six rows in
a lap, redraws the driver as a bigger chibi, adds Splash, the girl who shoots a bubble on a
wrong answer and throws a bottle on a right one, and adds a three-tier streak with a badge
above the kart. Three grilling rounds on 2026-11-11 produced this plan; their answers are
in Decisions. The proposed drawings are on the chibi sheet
(https://claude.ai/artifact/ThJU9eRPg9zftX5MwVm2az); the owner judges the final look by
playing. The sheet and its copy `lightning-kart-mechanics-chibi-sheet.html` are out of date
against the code since step 11 (one shared helmet and face there, four distinct drivers in
the code).

## Behaviour

**Writing questions.** Pasting into the race question editor keeps the first four options
and says so; a question whose marked answer was cut is not added. The race question editor
never adds a fifth option. Exercises keep up to six, and the server still accepts two to
six, so nothing stored changes.

**The question panel.** The options come in a different order every race. The question
sits on a cream board at the top of the stage, under the lap and the timer, over the sky
only. The answers are four cards at the bottom in two rows of two, below the kart, so the
road and the kart stay in view. Each card is its own colour with a small shape in the
corner (red triangle, blue diamond, yellow circle, green square), rounded corners, a thick
dark outline and a hard shadow, white bold text. Cards pop in with a short bounce. A
two-option question shows one row; a three-option question shows two cards and a third
centred below. Keys 1 to 4 pick the cards in reading order. The countdown bar stays on the
board. Long text shrinks a step and is cut after three lines for the question and two for
an answer.

**The road.** Four lanes of six units, so the road is 24 wide, with three dashed lines
between the lanes all the way round. Every box row has four boxes, one per lane; driving
through any of them opens a question and only that box goes dark, so the kart behind still
finds a lit box. Six rows per lap, about 300 units apart.

**The driver.** A chibi about twice today's size, after the owner's reference sprites: a wide rounded-square
head with big eyes under heavy brows and a small mouth with attitude, goggles high on the
helmet's brim, wide shoulders, white gloves on the wheel, the hat kept.
The same face in the Garage portraits and the top-down view. Colours and ids unchanged.

**Splash.** On a wrong answer or a timeout, Splash slides in from the right edge at mid
height, aims her water gun and fires one bubble at the kart. When it pops the kart is
slowed, as today, and carries a wet sheen with drips for the length of the slow. On a right
answer she slides in and throws a water bottle; when the kart catches it a nitro charge is
stored. If both charges are already stored the bottle still lands and both cells flash.
The nitro cells in the HUD are now bottles. She slides out after each throw. With reduced
motion she appears and disappears in place; the bubble and the bottle still fly.

**The streak.**

| Right answers in a row | Tier | What the player sees |
| --- | --- | --- |
| 2 | Spark | A bolt badge with the count appears above the driver's head. The exhaust flame turns orange. |
| 3 | Charged | Shout "CHARGED", badge grows, flame white, engine hum up a semitone. The next charge fired is a Double Boost without the chain. |
| 5 | Lightning | Shout "LIGHTNING", flame blue-white with a flicker, the screen edge pulses blue, the boxes ahead turn gold. |

The right-answer chime rises one note per answer in the streak. One answer short of the
next tier, the panel's border pulses and names it. A wrong answer at three or more plays a
"STREAK LOST" sting, the badge shatters and the flame goes out; at two it ends silently.
The Result board shows the best streak. A race with every question right shows a PERFECT
banner with fireworks.

## Decisions

| Question | Decision |
| --- | --- |
| Shuffle with the race seed | Yes. Each question's options are shuffled once per race with the race seed, the correct index remapped, so a phase 3 room shows every racer the same order. The rule "the seed shuffles the deck and nothing else" becomes "the deck and each question's option order". |
| More than four options | Four is the cap in the frontend only: the paste parser keeps the first four, the editor never adds a fifth. The server keeps 2 to 6. All ten questions in the live database have four. |
| Fewer than four | The minimum stays two. Two options give one row; three give two cards and a third centred below. |
| What cartoon means | Colour-coded cards in the Kahoot manner with a shape per card, rounded, thick ink outline, hard shadow, white bold text, pop-in bounce that reduced motion drops. The sunset palette stays. Only the question panel changes; the menus keep the slanted look. |
| What a lane is for | Markings only: dashed lane lines on the asphalt. Answering stays on the cards. |
| Lane width | Six units per lane, road 24 (from 20). Corners get a little easier; the owner judges by playing. |
| Lane markings | Three dashed lines in the paving colour at low alpha, all the way round, under the skid marks. The glowing edge stripe stays. |
| Lap length | Unchanged. Widening the road does not lengthen the centreline. The lap is 1,973 units. |
| Questions per lap | Six rows, about 300 units apart on straights and easy road. A boosted kart that runs the full countdown passes one row while a question is open; accepted. |
| Box rows | A row is one distance along the lap with four boxes at the lane centres, all question boxes. One hit darkens that box only, for its cooldown. In a later phase a custom item can sit in a row. |
| The streak set | The seven points as recommended: counter and rising chime, three named tiers at 2, 3 and 5, Double Boost at Charged, Lightning mode, the break at three or more, anticipation on the panel, best streak and PERFECT on the Result. Thresholds and colours are tunables. |
| A streak shield | No. Nothing protects the streak. |
| Wrong answer feedback | Splash, her own cartoon character drawn by code, never a racer. She slides in from the right, fires a bubble; the slow starts when it pops, about two thirds of a second after the answer. Also on a timeout. The red screen flash goes; the buzzer becomes a squirt; the wobble becomes the pop's jolt; the kart looks wet for the slow. |
| Reduced motion | Splash appears in place instead of sliding; the bubble and bottle still fly; the wobble is dropped as today. |
| The driver | A bigger chibi as on the sheet (superseded in its face by the next row, which wins: small mouth with attitude, not a grin): open face, big eyes, goggles up, wide shoulders, gloves on the wheel, hat kept. No catalogue change, no id change. The kart's drawn height grows. |
| Chibi reference | The owner's reference (2026-11-11) is a set of "4 Chibi Character" 2D game sprites: knights, ninjas, a prisoner, a pumpkin head. Its traits, which every drawn character follows: the head about two thirds of the figure and wider than tall, a rounded square, not a circle; a tiny body with stubby limbs; a thick dark outline on every shape; flat fills with one hard cel shadow per part (under a helmet brim, under the chin, the lower half of the torso); big eyes set close together under heavy brows angled toward the nose; a dot nose and a small flat mouth, attitude rather than a grin; headgear with volume that sits over the top half of the head. The sheet's second version follows it; its drawing code, kept beside this plan as `lightning-kart-mechanics-chibi-sheet.html`, is the starting point. |
| Where the badge lives | Above the driver's head, part of the kart's drawing so it scales with distance, in both views, in the tier's colour. Nothing in the HUD. Phase 3 shows it to the other racers. |
| Lightning mode without the shield | Visual only: the pulsing vignette and the gold boxes. The only mechanical payoff is the Double Boost from Charged. |
| Right answer feedback | Splash throws a bottle; the bottle is the picture of a charge, in the HUD too. (Agent default, 2026-11-11, say if wrong:) the charge is stored when the bottle lands, mirroring the bubble; with both cells full she still throws, the bottle lands, both cells flash and nothing is stored. The chime stays and rises with the streak. |
| Four-option cap, scope (review of step 1, 2026-11-11) | The cap lives in the race question editor only. The shared paste parser also serves the exercise editor, which keeps six. A pasted race question whose marked answer is the cut fifth or sixth option is not added and the sheet says it has no correct answer marked. |
| Panel layout (review of step 3, 2026-11-11) | Split. The board with the question and countdown sits at the top under the HUD row, over the sky; the cards sit at the bottom below the kart. A stacked panel needs about 190 px and only about 138 px of stage sit below the kart, so stacked hid the kart on every three- and four-option question. Replaces "under it four cards" in the cartoon decision. |
| Top speed and racers (2026-11-11) | The owner raised `C.kart.topSpeed` from 30 (now 44, still being tuned by playing) and `maxRacers` from 10 to 15, and keeps both. A lap at 44 takes about 45 s, not 60. Specs check the lap against the current top speed rather than a fixed number of seconds. At this speed a full 10 s countdown covers about 440 units, so a slow answer passes the next box row; accepted. |
| Start lane (review of step 5, 2026-11-11) | Agent default, say if wrong: the kart starts at a lane centre, offset half a lane right of the centreline, not on it. On the centreline a hands-off kart passed exactly between two boxes of the first row and hit neither. Phase 3's grid will place racers per lane. |
| Splash twice in a row (step 7, 2026-11-12; widened in step 8) | Agent default, say if wrong: any answer while her last run is still short of its landing lands that one at once (the pop slows, the bottle stores) and starts a new run, so every answer lands exactly once and the newest runs its full length. |
| Double Boost at Charged (step 9) | Agent default (2026-11-12), say if wrong: reaching Charged arms one free Double Boost on the racer, and the next charge fired uses it up. From rest it is one boost of twice `C.boost.seconds`, with no chain window until its last second; fired in a chain window it stays a plain chain, already a Double Boost. A fire refused mid-boost keeps it. It re-arms only by reaching Charged again after a break, and a break disarms an unused one: nothing protects the streak, and the white flame that shows Charged goes out with it. |
| Streak details (step 9) | Agent default (2026-11-12), say if wrong: the streak counts at the answer, not when the bottle lands. The board's ring and tag show one answer short of every tier, Spark included ("1 more: SPARK" after the first right answer). The hum stays a semitone up through Lightning. The chime climbs a major scale and holds at the octave. The badge is an ink disc with its ring and bolt in the tier's colour (Spark orange, Charged cream, Lightning light blue) and "×N" beside it. The sting was first a sound only (reversed by "Streak visuals with sound off" below: a loud break also shouts STREAK LOST). The idle flame is 0.75 of the boost flame's length; shorter, the exhaust mouths hide it from behind. |
| Row placement (review of step 5, 2026-11-11) | Rows at 165, 635, 935, 1235, 1535 and 1835 on the lap, chosen by the owner over 40, 340, 680, 980, 1280, 1700. Each question opens at least about 95 units (2 s at top speed 44) before a hard corner, most right after one ends; none sits mid-sweeper. Six rows cannot all keep a full answer clear of the S and the hairpin. |
| Character quality (owner, 2026-11-12) | "Do the task as your project. Get the best character UI from the reference." The step 6 drivers follow the reference's proportions but all four share one helmet and one face, and the Garage shows them only as 28 px portraits. The reference's strength is that every character has its own silhouette and its own face. So: each driver gets its own headgear silhouette and face; eyes take the reference's flat heavy lid; headgear gets speckle highlights; the Garage shows the chosen driver in the chosen kart large. This replaces "No catalogue change" in "The driver": the catalogue gains look fields; ids, names and colours stay. |
| The four drivers (agent's design, 2026-11-12, say if wrong) | Original characters in the reference's style, not copies of its sprites. Bolt, the hero: open-face racing helmet with a centre stripe, goggles on the brim, antenna, a confident smirk. Nova: no helmet, hair with a side fringe and two buns, a white visor band, calm level arched lids with two lash ticks at each outer corner, a closed smile. Pip, the youngest: a cap worn backwards with three locks of hair fanning out of the adjuster, freckles, one lid low and one cocked, a wide D-shaped grin with a tooth gap. Rex: a helmet with a tall notched fan crest, cheek guards and bone horns, a scar through one lid, steep lids, a frown. |
| The armed Double Boost and the chain (review of step 9, 2026-11-12) | Reverses the earlier default "a chain also uses up the arm". Only a fire from rest spends the armed Double Boost. A fire in the chain window while a boost runs chains as always and keeps the arm, so the Charged reward never disappears without the player seeing it. A break still disarms it. |
| Character details (step 11, art review 2026-11-12) | Rex's horns are bone (0xf3e6c4), not the visor yellow, so they do not read as more of the yellow crest. Lid slopes: Bolt 11 degrees, Rex 29, Nova a level arch, Pip one lid low and flat and one cocked; calm and cheeky pupils sit in the middle of the open eye, the tough ones tucked under the lid, and Pip's glance to one side. At portrait size every eye is the same small ink shape with the lids shortened toward the nose. A portrait shrinks a tall headgear's head to fit the ring instead of cutting it. The Garage preview stands at the right on a slab (lighter top face, panel front with the accent stripe) that runs under the names. |
| Streak visuals with sound off (review of step 9, 2026-11-12) | Sound is off until the player turns it on, so every streak moment must read without it. The tier shout gets a dark outline and stays readable for about half a second; a loud break shouts "STREAK LOST" and throws more, larger shards; the Lightning edge pulse is stronger and bluer; gold boxes are drawn larger with a rim; the idle flame flickers at every tier. |
| The driver faces forward (owner, 2026-11-12, after playing) | "The character is turning face backward." On the road the kart is seen from behind, so the driver is too: the back of the head, not the face. This reverses the earlier convention that the behind view shows the face. The face stays where a person is being shown rather than driving: portraits, the Ready and Result boards, the picker chips and the Garage's large preview, where the driver poses for the camera. Each driver must stay recognisable from behind by silhouette and colour alone. Agent's designs, say if wrong: Bolt, the helmet's back with the centre stripe running down it, the goggle strap round the back with its buckle, the antenna; Nova, the back of her hair with the zigzag hem at the nape, both buns, the white band tied at the back with two short tails; Pip, the cap's brim pointing at the camera (it is worn backwards) with hair showing under it at the nape; Rex, the helmet's back with a neck guard, the crest fan, the cheek guards' edges and the horns. Ears show on both sides of every head. |

## Steps

Every step: `npm run build`, the specs in the WebGL launcher
(`CHROME_BIN="/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" npm test -- --watch=false --browsers=ChromeHeadlessGL`)
and `scripts/check-docs.sh` pass. This task changes mechanics on purpose, so outside `C.ui`
these may change and nothing else: `world.roadWidth`, a new `world.lanes`, a new `C.streak`
block, a new `C.splash` block (her timings), `boost` only through the streak's Double Boost.
Durations of the new things live beside their numbers in `constants.ts`.

1. Cap at four in the race question editor only: `RACE_MAX_OPTIONS` in the race-questions
   component cuts each pasted question to four (the warning says so; a mark on a cut option
   counts as no mark) and its drawer adds no fifth row; the shared Fast Create parser keeps
   six for exercises — verify: the race-questions spec pastes five options and keeps four.
2. Seeded option shuffle: at race start every question's options are shuffled with the race
   seed and `correctIndex` remapped, before the deck is dealt; the Result's missed list still
   names the right answer — verify: a race spec builds the same race twice from one seed and
   gets the same option order, and answering the remapped index counts as right.
3. Cartoon cards: `scenes/question-panel.ts` draws the board and the 2×2 cards from a new
   `C.ui.cards` block (colours, shapes, radius, outline, shadow, bounce ms); one row for
   two, two plus one for three; keys 1 to 4 in reading order; pop-in dropped under reduced
   motion; the board at the top under the HUD row, the cards at the bottom below the kart
   (split, see Decisions) — verify: the race WebGL spec answers with key 4 and the fourth
   option is chosen; a spec asserts the cards' top is below the kart's drawn bottom and the
   board's bottom is above the horizon for a one-line four-option question; a headless
   render in the scratchpad shows the road and the kart clear between board and cards.
4. Four lanes: `C.world.roadWidth` 24 and `C.world.lanes` 4; three dashed lane lines on the
   track texture from `C.ui.road.lane`; every prop in `track/lap.ts` and
   `track/test-track.ts` moved out to at least 14.2 — verify: `track/geometry.spec.ts`
   (props outside the wall) and `render/mode7.spec.ts` pass.
5. Box rows: `TrackDef.boxes` becomes `rows: number[]` (distances), `buildTrack` lays four
   boxes per row at the lane centres; `track/lap.ts` has six rows (165, 635, 935, 1235,
   1535, 1835; see Decisions); the test track gets rows too; the engine's box list and
   per-box cooldown stay; the kart starts at a lane centre — verify: a geometry spec asserts
   six rows, 24 boxes, rows at least 300 apart, none in the S or the hairpin and every row at
   least 90 units before the next hard corner; a hands-off start hits the first row; the race spec hits one box of a row and the
   row's other boxes stay lit.
6. The chibi driver: `look/draw.ts` `drawHead`, `drawRacer`, `drawKartTop` and
   `drawPortrait` redrawn to the "Chibi reference" decision, starting from `drawHead`,
   `drawRacer` and `drawPortrait` in
   `plans/lightning-kart-mechanics-chibi-sheet.html`
   (Canvas 2D there, Phaser Graphics here; head half-width 0.3 of the kart width in the
   behind view, the goggles must not cover the eyes, gloves on the rim); the top view gets
   the same helmet and brim seen from above; the doc comment's extents updated; the picker
   rows still fit; the kart-bottom estimate the panel spec relies on (ground point plus the
   shadow blob's half height, `0.08 * s` in `scenes/race-webgl.spec.ts`) stays in step with the
   redrawn shadow and drawn height — verify: `look/draw.spec.ts` passes for every look; the build passes.
7. Splash and the bubble: `look/splash.ts` draws her after the same reference and the
   sheet's `drawSplash`, `drawBubble` and `drawBottle`, the gun, the bubble, the bottle and
   the wet sheen; `scenes/splash.ts` runs the slide in from the right, the bubble's flight
   to the kart's screen point, the pop, the slide out, from `C.splash` (slide ms, flight
   ms, throw ms); the Race scene applies the slow on the pop with the jolt and the wet look
   for `effect.left`; the red flash goes; `engine/audio.ts` gets a squirt in the buzzer's
   place; reduced motion skips the slides — verify: the race WebGL spec answers wrong and
   sees no slow until the flight time has passed, then the slow; nothing thrown.
8. The bottle: on a right answer Splash throws the bottle and `addCharge` runs when it
   lands; with full cells it lands and both cells flash; `scenes/hud.ts` draws the cells
   as bottles with the same fill, flash, drain and chain states — verify: the race WebGL
   spec sees the charge after the throw time, not before; the nitro chain spec still passes.
9. The streak (note: after step 6 the behind view is near its 90-call budget and the top
   view near its own, so the badge must stay cheap: a few calls, or a separate small object
   over the kart container rather than more calls inside drawRacer): `engine/streak.ts`, pure, counts the run, finds the tier from `C.streak.tiers`
   and reports the break; the Race scene keeps `streak` and `bestStreak`; the chime takes
   a step index; the shouts, the flame colour per tier (`C.ui.streak`), the hum semitone,
   the Double Boost flag at Charged, the vignette pulse and gold boxes at Lightning, the
   STREAK LOST sting and shatter, the panel's "next tier" pulse; the badge is drawn above
   the driver's head in both views with the count — verify: `engine/streak.spec.ts` covers
   the count, the tiers and the break; the race WebGL spec answers right three times and
   the next fire is a Double Boost without the chain.
10. The Result: a "Best streak" line on the board and the PERFECT banner with fireworks
    when every question was right, static under reduced motion — verify: `scenes/flow.spec.ts`
    passes with the new result fields; the build passes.
11. Characters to the reference's standard (see Decisions "Character quality" and "The four
    drivers"): `look/catalogue.ts` gains the look fields each driver needs (headgear kind,
    face marks, mouth, brows); `look/draw.ts` draws four distinct heads from them in all
    three views, eyes with a flat heavy lid that cuts the top of the eye and a smaller pupil,
    speckle highlights on headgear; Splash's face takes the same eye style; the Garage shows
    the chosen driver in the chosen kart large in its empty lower half, on a slanted stand
    with both names, updating on every pick; the streak badge still sits above the tallest
    head — verify: `look/draw.spec.ts` passes for every look with its box and call budgets
    (the behind view may rise to 100 calls); `scenes/flow.spec.ts` walks the Garage; headless
    renders of the four drivers large, at racing size, as small portraits, from above, and
    of the Garage, judged against the "Chibi reference" traits.
12. Docs: `../docs/features/lightning-kart.md` (cards, lanes, rows, Splash, the streak,
    under 120 lines, "Last checked" line; a race question has two to four options),
    `../docs/glossary.md` (the same option count), `../docs/roadmap.md`, the design file's Look,
    Item boxes, Feedback, HUD and Tuning sections plus a Streak section and a phase row,
    this module's `CLAUDE.md` and `look/CLAUDE.md` — verify: `scripts/check-docs.sh` is clean
    and every rule in the CLAUDE.md files is true of the code.
13. The driver faces forward on the road (see Decisions "The driver faces forward"):
    `look/head.ts` gains the back of each head; `drawRacer` draws it; the hands on the wheel,
    the lean and the tilt stay; portraits, chips, boards and the Garage preview keep the
    face; the wet look, the streak badge and the box and call budgets still hold; the docs
    and module notes say the driver is seen from behind — verify: `look/draw.spec.ts` shows
    no eye or mouth drawn in the behind view on the road for any driver and the four backs
    differ in outline; headless renders of the four drivers from behind large and at racing
    size, leaning both ways, and the Garage still facing the camera.

## Out of scope

- The server's option count. It keeps accepting two to six.
- A streak that lasts across races, a streak shield, points or gold for a streak. Gold is
  phase 2.
- Lengthening the lap, new tracks, a mini-map.
- Showing the badge to other racers. That needs phase 3's room.
- Caching a racer's drawing to a texture. One kart redrawn per frame is fine; phase 3's
  full room will need it.
- Custom items in a box row. The row is built for them; none is added.

## Open

(none; the owner judges the final look of the driver, the cards and Splash by playing)

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

Last session 2026-11-12: steps 1 to 12 done (step 13 came after, below). Step 12 updated `docs/features/lightning-kart.md` (118 lines), `docs/glossary.md`, `docs/roadmap.md`, `plans/lightning-kart-design.md` (Splash and Streak sections, tuning table, Mechanics phase row), this module's `CLAUDE.md` (Rules grouped under bold lead-ins, duplicates cut), `look/CLAUDE.md` (the chibi reference traits moved in from Decisions) and `course-teacher/CLAUDE.md`; `scripts/check-docs.sh` clean. For the owner to judge by playing: the board at the top and the cards at the bottom with the kart clear between them, two- and three-option layouts, keys 1 to 4; the four lanes and the six rows (one box darkens, its neighbours stay lit); the four drivers on the road, from above, as portraits and large in the Garage on its stand; Splash's timing, bubble and bottle, and the wet look; the streak tiers with sound off and then on (badge, idle flame, CHARGED and LIGHTNING shouts, the free Double Boost, gold boxes and blue edge, "1 more" tag, STREAK LOST at three, silent at two); the Result's best streak and PERFECT with fireworks. Tunables worth an eye, from `engine/constants.ts`: `C.kart.topSpeed` 44 (a lap about 45 s); Splash's landing 670 ms (`C.splash` slideInMs 220 + aimMs or windUpMs 160 + flightMs or throwMs 290); `C.streak.tiers` 2, 3, 5 and `loudBreakAt` 3; lane lines `C.ui.road.lane` alpha 0.8, lineW 0.8, dash 3, gap 4; wet film `C.ui.splash.film` 0.2; card colours `C.ui.cards.fill` 0xe8264f, 0x2f6fe0, 0xc77a00 (amber, not the plan's yellow), 0x17894b. The owner deletes this plan.
Last session 2026-11-12 (later): the final review's polish landed: key auto-repeat ignored for nitro, answers and Escape; the armed Double Boost's "×2" tag on the HUD cells; shouts under an open board; the finish wins over a timeout in its frame; duplicates merged (`cssHex`, `look/bolt.ts`, the card count, the touch button), dead constants cut, `testing/spec-clock.ts`.
Last session 2026-11-12 (step 13): the driver faces forward on the road. `look/head.ts` `drawHeadBack` (and `backCover`, which the wet look films) draws each back: Bolt's shell with stripe, strap and buckle; Nova's hair to a zigzag hem, buns, band knotted with two long tails; Pip's cap with crown button, panel seams and a short bill, light brown hair to a straight nape line (redrawn after review: the first back read as a face); Rex's shell with neck guard, cheek guard edges, crest and horns; ears both sides, a neck. `drawRacer` takes `facing` ('back' default for the Race scene, 'front' for the Garage preview and kart chips); from behind the elbows show and the gloves sit on the rim's sides, and past a 0.6 lean the head turns and hides an ear. Calls at most 86 back (Rex Rocket), 92 front. `draw.spec.ts` checks no face on the road, faces when posing, the backs' outlines differ. Docs and module notes updated. For the owner: can you name each driver from behind at a glance; does Pip's bill read as a cap; does Nova's knot read as a tied band.
Last session 2026-11-12 (closing): all 13 steps done, reviewed and verified (build, 135 specs, check-docs). After the last review the ear on the turn's side tucks behind the skull with the lean instead of switching off at one angle. Open for the owner, outside this plan: the steering ease-in and the lower turn rate while boosted from the 2026-11-06 feel rules were never built (design file); `plans/scale-100k.md` holds the scale questions; the roadmap is 136 lines.
