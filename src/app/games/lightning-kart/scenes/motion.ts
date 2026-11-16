/** True when the person asked the system for less motion: no jolts of the kart, no shout tweens, no slide-ins. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
