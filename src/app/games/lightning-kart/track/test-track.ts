import { TrackDef } from './track-def';

/** The grey-box track: a short loop of four right bends at radius 120, the tightest the race allows, round a start straight and a back straight. */
export const TEST_TRACK: TrackDef = {
  pieces: [
    { straight: 140 }, // 0-140
    { deg: 90, r: 120 }, // 140-329
    { straight: 60 },
    { deg: 90, r: 120 }, // 389-577
    { straight: 200 }, // back straight, 577-777
    { deg: 90, r: 120 }, // 777-966
    { straight: 60 },
    { deg: 90, r: 120 }, // 1026-1214, then the layout's closing straight
  ],
  checkpointFractions: [0.3, 0.55, 0.8],
  // A few of each kind, so the WebGL spec draws every prop texture.
  props: [
    { d: 30, offset: -22, kind: 'palm' },
    { d: 70, offset: 23, kind: 'palm' },
    { d: 110, offset: -22.5, kind: 'palm' },
    { d: 165, offset: -21.5, kind: 'sign' }, // the outside of the first bend
    { d: 600, offset: 22, kind: 'palm' },
    { d: 640, offset: -23, kind: 'palm' },
    { d: 680, offset: 22.5, kind: 'palm' },
    { d: 720, offset: -22, kind: 'palm' },
    { d: 755, offset: -24.5, kind: 'billboard' }, // before the third bend
    { d: 820, offset: -21.5, kind: 'sign' }, // the third bend's outside
  ],
};
