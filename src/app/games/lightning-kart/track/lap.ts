import { TrackDef } from './track-def';

/**
 * The race track, clockwise and every bend a right one, none tighter than radius 150: the
 * start straight, a long right sweeper, the east straight, a corner cut in two easy halves,
 * the long bottom straight, a right sweeper, the west straight, a gentle right that opens
 * onto a short straight and a last right onto the finish straight, which the layout closes
 * with. After an edit, re-solve the west straight (the walk's end height; off level the
 * closing arcs make an S, which the spec fails) and the bottom straight (the finish's length).
 * The server's finish floor assumes a lap of at least `application.race.lap-length` (2641) in
 * the backend's application.yaml; `track/geometry.spec.ts` holds it to that.
 */
export const LAP: TrackDef = {
  pieces: [
    { straight: 160 }, // start straight, 0-160
    { deg: 90, r: 200 }, // long sweeper, 160-474
    { straight: 305 }, // east straight, 474-779
    { deg: 45, r: 150 }, // the cut corner, 779-897
    { straight: 100 },
    { deg: 45, r: 150 }, // 997-1115
    { straight: 397.3 }, // bottom straight, 1115-1512
    { deg: 90, r: 160 }, // sweeper, 1512-1763
    { straight: 303.7 }, // west straight, 1763-2067
    { deg: 30, r: 240 }, // gentle right, 2067-2193
    { straight: 60 },
    { deg: 60, r: 180 }, // onto the finish straight, 2253-2441
  ],
  checkpointFractions: [0.25, 0.5, 0.75],
  // Palms every forty units or so along the straights, sides alternating with a little jitter
  // in the offset; billboards facing the straights; chevron signs on the outside (left) of
  // each bend. The wall ends at 19.2 from the centreline (half the road, 18, plus the wall's
  // `C.ui.road.wallW`, 1.2), so nothing sits inside 20.2.
  props: [
    // the start straight
    { d: 24, offset: -22, kind: 'palm' },
    { d: 64, offset: 23, kind: 'palm' },
    { d: 104, offset: -21.5, kind: 'palm' },
    { d: 124, offset: 24.5, kind: 'billboard' },
    { d: 148, offset: -22.5, kind: 'palm' },
    // the long sweeper: signs on its outside, palms on its inside
    { d: 180, offset: -21.5, kind: 'sign' },
    { d: 230, offset: -21.5, kind: 'sign' },
    { d: 280, offset: -21.5, kind: 'sign' },
    { d: 330, offset: -21.5, kind: 'sign' },
    { d: 380, offset: -21.5, kind: 'sign' },
    { d: 430, offset: -21.5, kind: 'sign' },
    { d: 255, offset: 22.5, kind: 'palm' },
    { d: 355, offset: 23, kind: 'palm' },
    // the east straight
    { d: 500, offset: 22, kind: 'palm' },
    { d: 540, offset: -22.5, kind: 'palm' },
    { d: 580, offset: 23.5, kind: 'palm' },
    { d: 620, offset: -24.5, kind: 'billboard' },
    { d: 640, offset: 21.5, kind: 'palm' },
    { d: 680, offset: -22, kind: 'palm' },
    { d: 720, offset: 23, kind: 'palm' },
    { d: 755, offset: -24.5, kind: 'billboard' }, // before the cut corner, on its outside
    // the cut corner, signs on each half's outside, palms between
    { d: 795, offset: -21.5, kind: 'sign' },
    { d: 835, offset: -21.5, kind: 'sign' },
    { d: 875, offset: -21.5, kind: 'sign' },
    { d: 925, offset: 22.5, kind: 'palm' },
    { d: 965, offset: -23, kind: 'palm' },
    { d: 1015, offset: -21.5, kind: 'sign' },
    { d: 1055, offset: -21.5, kind: 'sign' },
    { d: 1095, offset: -21.5, kind: 'sign' },
    // the bottom straight
    { d: 1140, offset: 22, kind: 'palm' },
    { d: 1180, offset: -22.5, kind: 'palm' },
    { d: 1220, offset: 23.5, kind: 'palm' },
    { d: 1250, offset: -24.5, kind: 'billboard' },
    { d: 1260, offset: 21.5, kind: 'palm' },
    { d: 1300, offset: -22, kind: 'palm' },
    { d: 1340, offset: 23, kind: 'palm' },
    { d: 1380, offset: -21.5, kind: 'palm' },
    { d: 1400, offset: 24.5, kind: 'billboard' },
    { d: 1420, offset: -23, kind: 'palm' },
    { d: 1460, offset: 22, kind: 'palm' },
    { d: 1490, offset: -24.5, kind: 'billboard' }, // before the sweeper, on its outside
    // the sweeper: signs on its outside, palms on its inside
    { d: 1530, offset: -21.5, kind: 'sign' },
    { d: 1580, offset: -21.5, kind: 'sign' },
    { d: 1630, offset: -21.5, kind: 'sign' },
    { d: 1680, offset: -21.5, kind: 'sign' },
    { d: 1730, offset: -21.5, kind: 'sign' },
    { d: 1600, offset: 22.5, kind: 'palm' },
    { d: 1690, offset: 23, kind: 'palm' },
    // the west straight
    { d: 1790, offset: 22, kind: 'palm' },
    { d: 1830, offset: -22.5, kind: 'palm' },
    { d: 1870, offset: 23.5, kind: 'palm' },
    { d: 1905, offset: 24.5, kind: 'billboard' },
    { d: 1910, offset: -21.5, kind: 'palm' },
    { d: 1950, offset: 22, kind: 'palm' },
    { d: 1990, offset: -23, kind: 'palm' },
    { d: 2030, offset: 22.5, kind: 'palm' },
    // the gentle right and the last right onto the finish straight
    { d: 2085, offset: -21.5, kind: 'sign' },
    { d: 2135, offset: -21.5, kind: 'sign' },
    { d: 2175, offset: -21.5, kind: 'sign' },
    { d: 2222, offset: 22, kind: 'palm' },
    { d: 2270, offset: -21.5, kind: 'sign' },
    { d: 2320, offset: -21.5, kind: 'sign' },
    { d: 2370, offset: -21.5, kind: 'sign' },
    { d: 2420, offset: -21.5, kind: 'sign' },
    { d: 2345, offset: 23, kind: 'palm' },
    // the finish straight
    { d: 2465, offset: 22.5, kind: 'palm' },
    { d: 2505, offset: -22, kind: 'palm' },
    { d: 2545, offset: 23, kind: 'palm' },
    { d: 2570, offset: -24.5, kind: 'billboard' },
    { d: 2585, offset: 21.5, kind: 'palm' },
    { d: 2620, offset: 22, kind: 'palm' },
  ],
};
