# Phases and gates

The builder works freely inside a phase and stops at its gate. Only the owner passes a gate, by raising `current` in `docs/phase.json`. `pnpm trace` refuses that change while any spec item or scenario of the phase being left has no test.

| Phase         | Delivers                                                            | Proven by                                                    | Needs the Mac      |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------ |
| 0 Contracts   | PRD, spec, evals, gates                                             | The owner's approval of this repository's first pull request | No                 |
| 1 Foundations | Headless loop, facts and belief, trace, planner interface, registry | Phase 1 spec items                                           | No                 |
| 2 Alive       | Drives, instincts, stub planner, content loading, scenario runner   | Scenario 1                                                   | No                 |
| 3 Curious     | Sight, notes, curiosity, all five actions, rain                     | Scenarios 2 and 3                                            | No                 |
| 4 Playful     | Simulated kid, laugh credit, requests, speech check                 | Scenarios 4 to 6                                             | No                 |
| 5 Inventive   | New skills from tried sequences, the language-model planner         | Scenario 7                                                   | Yes, for live runs |
| 6 Open        | Personalities, one-file objects, noise, a changing rule             | Scenarios 8 to 11                                            | For live runs      |
| 7 Real kids   | Camera, speech, laughter, drawing                                   | Sessions with real kids                                      | Yes                |

## At every gate

1. **Scorecard.** `pnpm check` is green, and the eval report is compared with the previous phase's.
2. **Held-out run.** The owner runs the held-out variants of the phase's scenarios.
3. **Adversarial review.** A reviewer that has not seen the work reads the phase's changes against the spec, looking for forbidden shortcuts and tests that prove less than their item says.
4. **Replay.** The owner reads or watches one run from the phase.
5. **Live run.** A short run with the local model on the Mac, from the first phase where it can do anything, so planning problems show up early.
6. **Tag.** The commit is tagged `phase-N`, so there is always something to go back to.

Then the owner raises `current` in `docs/phase.json`.

## What each gate asks of the owner

- **Phase 0:** read the fixed contracts in `spec.md` and the open decisions at its end. Approve, or say what to change.
- **Phase 1:** read one trace file end to end. Is it enough to tell what happened?
- **Phase 2:** watch two minutes of the duck alone. Does it look alive or mechanical?
- **Phase 3:** run a held-out object. Does what it learned on the house carry over?
- **Phase 4:** run a held-out kid persona.
- **Phase 5:** read the skill the duck registered for the roof. Would it work on a different building?
- **Phase 6:** add an object yourself, in one file, and time it.
- **Phase 7:** play with it.
