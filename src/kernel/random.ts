/**
 * The simulation's only randomness: named streams derived from the run's seed, one per subsystem,
 * so drawing more numbers in one place never changes what another place gets.
 */

/** Returns the next number, from 0 up to but not including 1. */
export type Random = () => number;

export interface Streams {
  /** The stream for one subsystem. Asking again gives the same stream, carrying on where it was. */
  stream(name: string): Random;
}

const TWO_TO_32 = 4294967296;

/** FNV-1a: turns a name into a well-spread 32-bit number. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (const char of text) {
    h ^= char.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: a small, fast generator with a 32-bit state. */
function generator(seed: number): Random {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / TWO_TO_32;
  };
}

export function createStreams(seed: number): Streams {
  const streams = new Map<string, Random>();
  return {
    stream(name) {
      const existing = streams.get(name);
      if (existing) return existing;
      const made = generator(hash(`${String(seed)}:${name}`));
      streams.set(name, made);
      return made;
    },
  };
}
