import { TrackDef } from './track-def';

/** The grey-box track: a start straight, the tightening S, a back straight and the hairpin. */
export const TEST_TRACK: TrackDef = {
  pieces: [
    { straight: 140 },
    { deg: 100, r: 55 }, // tightening S
    { deg: -60, r: 42 },
    { deg: 140, r: 32 },
    { straight: 400 }, // back straight
    { deg: 180, r: 55 }, // hairpin
  ],
  checkpointFractions: [0.3, 0.55, 0.8],
  boxes: [
    { d: 70, offset: 0 },
    { d: 450, offset: -2.5 },
    { d: 600, offset: 2.5 },
  ],
};
