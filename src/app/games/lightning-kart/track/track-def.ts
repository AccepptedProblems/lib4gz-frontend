import { C } from '../engine/constants';
import { createTrack, layout, Piece, Track, worldAt } from './geometry';

/** A roadside prop's look. Each kind is one texture drawn once by code (render/props.ts). */
export type PropKind = 'palm' | 'billboard' | 'sign';

/**
 * A roadside prop: scenery only, the engine never sees it. `offset` is signed across the road
 * (positive right) and must put the prop outside the wall: at least the road half width plus
 * the wall (`C.ui.road.wallW`) plus a margin of 1. A sign's chevron points into the road from either side.
 */
export interface PropDef {
  d: number;
  offset: number;
  kind: PropKind;
}

/** A track in one file: the lap's pieces, where the checkpoints sit and the roadside props. The box rows are spread by `buildTrack`. */
export interface TrackDef {
  pieces: Piece[];
  /** Fractions of the lap length, in order, between the start line and the finish. */
  checkpointFractions: number[];
  props: PropDef[];
}

export interface BuiltProp extends PropDef {
  x: number;
  y: number;
}

export interface BuiltTrack {
  track: Track;
  checkpoints: number[];
  /** Every row's boxes, one at each lane centre, row by row from the start line, each row from the left. */
  boxes: { d: number; offset: number }[];
  /** The props resolved to world points, the way the engine resolves the boxes. */
  props: BuiltProp[];
}

/**
 * Lays the track out and spreads `C.world.rowsPerLap` box rows evenly round the lap, bends
 * included, the first half a row gap past the start line.
 */
export function buildTrack(def: TrackDef): BuiltTrack {
  const points = layout(def.pieces, C.world.roadWidth, C.world.spacing);
  const track = createTrack({ points });
  const { roadWidth, lanes, rowsPerLap } = C.world;
  const lane = roadWidth / lanes;
  const rows = Array.from({ length: rowsPerLap }, (_, r) => ((r + 0.5) * track.length) / rowsPerLap);
  return {
    track,
    checkpoints: def.checkpointFractions.map((f) => f * track.length),
    boxes: rows.flatMap((d) => Array.from({ length: lanes }, (_, i) => ({ d, offset: (i + 0.5) * lane - roadWidth / 2 }))),
    props: def.props.map((p) => ({ ...p, ...worldAt(track, p.d, p.offset) })),
  };
}
