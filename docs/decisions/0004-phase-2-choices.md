# Choices made while building phase 2

These are places where a spec item left room, and what was chosen. Each is for the owner to confirm or change at the phase 2 gate.

## Content

- **Two instincts, each a whole errand.** Eating is "go to something edible, then use it", and resting is the same for something soft. So the duck needs no separate walking skill, and is born with exactly two.
- **The vocabulary lists only what exists so far.** Properties are added to it when their rule module is, so the check that each property has exactly one module (S-VOCAB-2) holds at every step.
- **A property's value is its strength.** `edible: 0.6` takes 0.6 off hunger. `soft: 0.1` takes 0.1 off sleepiness per second.

## World

- **Needs are properties of the creature's entity.** Any property with a matching `_rate` rises by that rate each second, capped at 1. Nothing in the world names hunger or sleepiness except the two rules that lower them.
- **Things that are used up go away and come back.** The world keeps a list of what is away and for how many more ticks. The delay is one number for the whole world, set by the scenario. Zero means gone for good.
- **Reach is measured from an object's edge**, taken as half the longer side of its footprint.
- **Using something with no usable property fails with `no_effect`.** When several properties could be used, the first by name decides.
- **`move_to` a target that is missing fails with `unreachable`**, the same as one on another level.
