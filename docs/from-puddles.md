# What carries over from puddles

`puddles` is the earlier attempt at this game. It is the place to look before writing something from scratch. Paths below are in that repository.

## Port

| What                                              | Where in puddles                                                             | Serves here            |
| ------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------- |
| Fixed tick, pausable clock                        | `game/src/kernel/clock.ts`                                                   | S-TICK-1               |
| Seeded random streams                             | `game/src/core/random.ts`, `game/src/kernel/kernel.ts`                       | S-TICK-3               |
| Append-only event log and replay                  | `game/src/kernel/eventLog.ts`, `replay.ts`                                   | S-TRACE-1, S-TICK-4    |
| Executor with interruption                        | `game/src/kernel/executor.ts`                                                | S-EXEC-1, S-EXEC-2     |
| Simulated kid with boredom and walking away       | `game/src/sim/kid.ts`, `profiles.ts`                                         | S-SIM-1 to S-SIM-4     |
| Thompson sampling with an attribution window      | `game/src/plugins/brains/bandit/`                                            | S-LEARN-3 to S-LEARN-5 |
| Guardian: line limits, blocklist, vetted requests | `game/src/kernel/guardian/`, `shared/blocklist.json`, `shared/requests.json` | S-SAY-1                |
| Recorded model replies and drift detection        | `scripts/cassettes.py`, `server/tests/cassettes/`                            | S-LLM-4                |
| Layered puppet and pond drawing                   | `game/src/render/`                                                           | S-DRAW-1               |
| Smile, gesture and pose senses                    | `game/src/plugins/sense/`                                                    | S-REAL-1               |

Port means read it, take the idea and any code that fits a spec item, and bring it in test first like anything else. Nothing is copied in bulk.

## Measurements worth keeping

- Smile detection from full-frame face landmarks works where kids actually play, at 1 to 3 feet. Faces were found in 99 to 100% of frames, with a neutral level at or below 0.01 and a smiling level of 0.60 to 0.72.
- Kids lean in. Whole-body gestures only work in a stand-back mode.
- The misses came in the first second of a smile, while it forms.

## Leave behind

- The reaction schema as the central contract.
- Comedy bits and tagged verbs as the model of a skill.
- Affordance lists written per object type.
- Skills that return animation and change nothing in the world.
- The fine-tuning and benchmark framing, unless the owner wants it back.
- The Python server and its tooling, until phase 7 needs real senses.

## Process changes

`puddles` spent about a fifth of its code on workflow tooling. Here the gates are smaller: one `pnpm check`, two pull request checks, and a trace from requirement to test. The agent dispatch, risk scoring and hook scripts are not carried over. They can be added if this proves too loose.
