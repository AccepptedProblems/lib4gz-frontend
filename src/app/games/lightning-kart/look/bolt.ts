/** The game's one lightning bolt, in half-heights about its centre: x across, y down. */
const BOLT = [[2, -7], [-4, 1], [0, 1], [-2, 7], [4, -1], [0, -1]].map(([x, y]) => ({ x: x / 7, y: y / 7 }));

/** The bolt's points centred at `cx`, `cy`, `r` from its centre to its top and bottom tips, for `fillPoints` and `strokePoints`. */
export function boltPoints(cx: number, cy: number, r: number): { x: number; y: number }[] {
  return BOLT.map((p) => ({ x: cx + p.x * r, y: cy + p.y * r }));
}
