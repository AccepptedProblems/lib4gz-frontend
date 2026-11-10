import { TrackDef } from './track-def';

/**
 * The race track, clockwise: start straight, an easy left kink, a long easy right sweeper,
 * a short straight, the tightening S (right, left, tighter right), the back straight, the
 * hairpin, then the finish straight that the layout closes with, a gentle sweep onto the
 * line. Item boxes sit on the straights only, so a question opens where the driving is easy.
 */
export const LAP: TrackDef = {
  pieces: [
    { straight: 160 }, // start straight
    { deg: -30, r: 120 }, // easy left
    { deg: 120, r: 92 }, // easy right sweeper
    { straight: 50 },
    { deg: 60, r: 55 }, // tightening S
    { deg: -70, r: 42 },
    { deg: 100, r: 32 },
    { straight: 700 }, // back straight
    { deg: 180, r: 60 }, // hairpin
  ],
  checkpointFractions: [0.25, 0.5, 0.75],
  boxes: [
    { d: 80, offset: -2.5 },
    { d: 850, offset: 2.5 },
    { d: 1150, offset: -2.5 },
    { d: 1780, offset: 0 },
  ],
};
