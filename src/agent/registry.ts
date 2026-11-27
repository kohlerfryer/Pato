/** The skills one agent has, by id. */

import type { Skill } from "./skill.ts";

export interface Registry {
  /** Adds `skill`. Returns why it was turned away, or null if it was taken. */
  register(skill: Skill): string | null;
  get(id: string): Skill | undefined;
  /** Every skill, in the order registered. */
  list(): readonly Skill[];
}

export function createRegistry(): Registry {
  const skills = new Map<string, Skill>();
  return {
    register(skill) {
      skills.set(skill.id, skill);
      return null;
    },
    get: (id) => skills.get(id),
    list: () => [...skills.values()],
  };
}
