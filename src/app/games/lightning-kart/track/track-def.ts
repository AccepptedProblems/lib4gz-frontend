import { C } from '../engine/constants';
import { createTrack, layout, Piece, Track } from './geometry';

/** A track in one file: the lap's pieces, where the checkpoints sit, and the item box slots. */
export interface TrackDef {
  pieces: Piece[];
  /** Fractions of the lap length, in order, between the start line and the finish. */
  checkpointFractions: number[];
  /** Box slots: a distance along the lap and an offset across it. On straights and easy road only. */
  boxes: { d: number; offset: number }[];
}

export interface BuiltTrack {
  track: Track;
  checkpoints: number[];
  boxes: { d: number; offset: number }[];
}

export function buildTrack(def: TrackDef): BuiltTrack {
  const points = layout(def.pieces, C.world.roadWidth, C.world.spacing);
  const track = createTrack({ points }, C.world.verge);
  return { track, checkpoints: def.checkpointFractions.map((f) => f * track.length), boxes: def.boxes };
}
