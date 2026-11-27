# Pato: product requirements

Pato is a small 2D world with a duck that has its own drives, explores whatever appears, and learns over time what it can do and what makes the kids laugh. Nothing it does with a specific object is scripted. It runs on one MacBook Pro.

This document says what must be true. [`spec.md`](spec.md) says how it is built and [`evals.md`](evals.md) how it is proven. Every numbered requirement below is answered by at least one spec item, and `pnpm trace` fails if one is not.

## Why a new attempt

The previous attempt, `puddles`, was a reaction machine: a kid held something up, a model named it, and the duck played a canned bit chosen by a bandit. It felt flat for four reasons, and Pato reverses each.

| In puddles                              | In Pato                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| The duck had no goals of its own        | Drives give it reasons to act when nobody is watching         |
| The world never changed after it loaded | Actions change the world, so there is something to find out   |
| Each object listed what it was for      | Objects carry properties, and the duck learns what they allow |
| Learning chose among six fixed bits     | Learning adds notes and new skills                            |

[`from-puddles.md`](from-puddles.md) lists what is carried over.

## Who it is for

- **Kids** play with the duck through a camera and their voices.
- **The owner** builds and extends it, mostly through autonomous development held in line by the evals.
- **Later, viewers and makers** watch it and add their own creatures and objects.

## Requirements

### What the duck does

- **R-01** (phase 2): Left alone, the duck keeps itself going: it eats and sleeps as its drives require.
- **R-02** (phase 3): The duck investigates an object it has not seen before, and what it learns applies to any other object with the same properties.
- **R-03** (phase 3): The duck uses what it has learned to meet its needs, such as taking shelter from rain.
- **R-04** (phase 4): When a kid appears the duck plays, unless a need is urgent, and goes back to its own needs when the kid leaves.
- **R-05** (phase 4): The duck learns which of its skills make a particular kid laugh and favours them, without repeating one joke.
- **R-06** (phase 4): A kid can ask the duck to do something. The request competes with the duck's drives according to its personality, and a request it cannot meet gets a clear refusal or a request for help.
- **R-07** (phase 5): Given a goal it has no skill for, the duck finds a way by combining its actions, and keeps what worked as a new skill.
- **R-08** (phase 6): A personality is a data file of drive weights. Two files give two ducks that behave measurably differently, with no change to code.
- **R-09** (phase 6): A new object is added with one data file and no change to code.
- **R-10** (phase 6): The duck keeps working when its senses are noisy, late or contradictory.
- **R-11** (phase 6): When a rule of the world changes, the duck stops relying on what no longer works and finds another way.

### How it is built

- **R-12** (phase 1): The simulation runs with no screen, camera or model, and the same seed gives the same run.
- **R-13** (phase 1): Every decision is recorded in a trace that is enough to explain and to check a session. Evals read only the trace.
- **R-14** (phase 1): The planner sits behind one interface, with a deterministic stub as its first implementation.
- **R-15** (phase 1): The world steps a list of agents. No code assumes there is exactly one duck.
- **R-16** (phase 3): No object, scenario or personality is special-cased by name in engine, planner or skill code.
- **R-17** (phase 5): A local language model can serve as the planner within budget: at most one call every 3 seconds per agent and prompts under 1,500 tokens.
- **R-18** (phase 1): Every planner output is validated. An invalid one never reaches the world.
- **R-19** (phase 4): The duck has no spoken voice. What it thinks or wants to tell a kid appears as a thought bubble, and every bubble passes a child-appropriate check.
- **R-20** (phase 2): The headless simulation is fast enough that the whole stub eval suite runs in about a minute.
- **R-21** (phase 7): Real senses (camera, speech, laughter) run on the machine and feed the same facts as the simulated ones. No image or audio is kept.
- **R-22** (phase 2): The world can be watched in a browser, on a phone as well as a laptop, drawn in plain shapes from world state. Drawing never changes the simulation.
- **R-23** (phase 6): Each kind of learning is a separate module that can be replaced or switched off without changing the others.
- **R-24** (phase 2): Each requirement about the duck's behaviour is proven by a scenario that runs headless in CI, against thresholds only the owner changes.
- **R-29** (phase 2): Every merge to `main` publishes the latest build to a web address, so testing it needs no install and no app store.
- **R-30** (phase 7): The duck is drawn as a character with expressions, in place of the viewer's plain shapes.

### Later

- **R-25** (deferred): A second duck with its own personality shares the world and competes for what is scarce.
- **R-26** (deferred): The duck writes new skills as code with loops, conditions and calls to other skills.
- **R-27** (deferred): Something a kid holds up to the camera appears in the world as an object.
- **R-28** (deferred): Other people add creatures and objects as data packs.

## Constraints

- **Hardware:** one MacBook Pro with about 22 GB of memory. Target 15 to 18 GB in use with the models loaded.
- **Local only:** play needs no network. Camera and microphone are processed on the machine.
- **Reach:** it runs in a browser. With the stub planner the whole game runs on a phone. The language-model planner needs a model server, which for now is the Mac.
- **Stack:** TypeScript for the game and its tools. No Python until real senses arrive in phase 7.
- **Kids first:** the duck rewards smiles and laughs, never time on screen.

## Not in the first version

3D, learning to walk, a game engine switch, cloud services, and everything under "Later".

## Success

- Every scenario in `evals.md` passes with the stub planner, and on 8 of 10 seeds with the local model.
- With real kids, they come back to it unprompted and it does things nobody scripted.

## Risks

- **The local model may plan poorly.** An 8 billion parameter model may be too unreliable at the roof puzzle. The stub proves the architecture either way, and a short live run at every phase gate finds this early.
- **Simulated kids test the machinery, not the fun.** Their tastes are invented. Real sessions are recorded and replayed as soon as there are any.
- **Thresholds are untested guesses.** Every number in `evals/thresholds.json` was chosen before any measurement and will need tuning by the owner.
- **Speech recognition is weak on young children.** Mishearing has to be funny, not broken.

## Open questions

- Which local models, once measured on the target machine?
- How are held-out scenarios kept out of the building agent's sight? See `spec.md`, open decisions.
