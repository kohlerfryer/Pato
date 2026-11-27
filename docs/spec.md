# Pato: engineering spec

This is the engineering requirements document. Each numbered item is one statement a test can prove. It names the requirements in [`prd.md`](prd.md) it serves and the phase it belongs to:

```
- **S-AREA-N** (R-NN, phase N): One testable statement.
```

A test proves an item by citing it in its title, as `[S-FACT-3]`. `pnpm trace` checks the links in both directions, and `pnpm next` lists the untested items of the current phase.

Items say what must be true. How to make it true is the builder's choice unless an item says otherwise. An idea that needs a new item, or a change to one, is proposed in `docs/decisions/` and waits for the owner. See [`AGENTS.md`](../AGENTS.md).

## Layout

```
src/
  kernel/     clock, seeded randomness, trace, the tick loop, replay
  world/      state, the step function, one rule module per property, rain
  sense/      sight, body sense, the noise wrapper
  agent/      belief, drives, executor, registry, memory
  planner/    the interface, the stub, the language-model planner
  learners/   notes, laugh credit, funniness, new skills
  content/    loaders and validators for objects, creatures, personas, scenarios
  sim/        the simulated kid
  view/       the view model: what to draw, as plain data
  web/        the page: canvas drawing and the entry file (not unit-tested)
  evals/      the scenario runner, trace helpers, one test file per scenario
content/
  vocabulary.json
  objects/    one file per object
  creatures/  one file per creature
  personas/   one file per simulated kid
  scenarios/  one file per scenario
evals/thresholds.json   every pass criterion's number (owner only)
tools/                  the trace and gate checks (owner only)
docs/                   prd, spec, evals, phases (owner only), decisions (open)
```

Tests sit beside the code they test, as `*.test.ts`.

## The loop

Each tick, for each agent: senses emit facts, belief updates, the most urgent drive sets a goal, the planner chooses a skill, the executor runs one action of it, and the outcome is written to the trace. Learners read the trace and update notes, scores and skills.

```
world step -> sensors -> belief -> drives -> planner -> executor -> learners -> trace
```

## Fixed contracts

These five are what every module depends on. Changing one touches everything, so they are settled first and changed rarely. Everything after this section is replaceable behind them.

### 1. Facts

```ts
interface Fact {
  subject: EntityId; // who or what it is about: "duck-1", "obj-3", "kid"
  predicate: string; // "near", "hunger", "has_opening", "said"
  object?: EntityId; // the second entity of a relation: near(duck-1, obj-3)
  value: boolean | number | string;
  confidence: number; // 0 to 1
  tEvent: number; // the tick it became true
  ttl: number; // ticks it stays believed
  source: string; // the sensor that emitted it
}
```

- **S-FACT-1** (R-13, phase 1): A fact has a subject, predicate, optional object, value, confidence, tEvent, ttl and source; one with a confidence outside 0 to 1 or a ttl below 1 is rejected.
- **S-FACT-2** (R-10, R-12, phase 1): Belief holds one fact per subject, predicate and object; a later tEvent replaces an earlier one, and at equal tEvent the higher confidence wins.
- **S-FACT-3** (R-10, R-12, phase 1): A fact leaves belief on the first tick after tEvent plus ttl.
- **S-FACT-4** (R-14, phase 1): The planner is given only believed facts with a confidence of 0.5 or more.
- **S-FACT-5** (R-15, phase 1): Each agent has its own belief store, and a sensor writes only to the agent it belongs to.

### 2. Vocabulary

Predicates are plain strings, so a new sensor or object can introduce one without a schema change. A predicate does nothing until a rule, a drive or a skill mentions it.

| Kind                         | Starting set                                                     |
| ---------------------------- | ---------------------------------------------------------------- |
| Properties of objects        | `has_opening`, `roof`, `flat_top`, `grabbable`, `edible`, `soft` |
| Relations an agent perceives | `near`, `inside`, `on_top`, `step_up`, `under_cover`, `holding`  |
| An agent's own states        | `hunger`, `sleepiness`, `wet`, `level`                           |
| About a kid                  | `kid_visible`, `kid_laughing`, `said`                            |

`step_up(agent, x)` means x has a flat top exactly one level above the agent and within its reach.

- **S-VOCAB-1** (R-16, phase 2): `content/vocabulary.json` lists every property, relation and state with a one-line meaning; a predicate missing from it is still believed, and is reported once per run in the trace.
- **S-VOCAB-2** (R-16, phase 2): Each property has exactly one rule module, named after the property, and nothing else gives that property an effect.
- **S-VOCAB-3** (R-16, phase 3): Renaming every object id and object file in a scenario leaves the trace unchanged apart from those ids.

### 3. Actions

```ts
type Action =
  | { kind: "move_to"; target: EntityId | Spot; facing?: Direction }
  | { kind: "jump" }
  | { kind: "grab"; target: EntityId }
  | { kind: "drop" }
  | { kind: "use"; target?: EntityId };

interface Outcome {
  status: "done" | "failed" | "interrupted";
  reason?: string; // "unreachable", "too_far", "nothing_to_land_on", "stuck", ...
}
```

This is the duck's whole body, like the buttons on a controller. What `use` does is decided by the object, never by the duck.

- **S-ACT-1** (R-18, phase 1): The action set is exactly `move_to`, `jump`, `grab`, `drop` and `use`; the executor rejects any other action.
- **S-ACT-2** (R-13, phase 1): Every action ends as `done`, `failed` or `interrupted` with a reason, and both its start and its end are in the trace.
- **S-ACT-3** (R-01, phase 2): `move_to` moves the agent toward its target at the creature's speed and ends `done` when the target is within reach, or `failed` with `unreachable` when it is on another level.
- **S-ACT-4** (R-01, phase 2): `use` with no target applies to the held object, and with a target applies to that object when it is within reach; otherwise it fails with `nothing_to_use` or `too_far`.
- **S-ACT-5** (R-02, R-07, phase 3): `jump` raises the agent one level onto a `flat_top` within reach whose top is exactly one level above it; otherwise it fails with `nothing_to_land_on`.
- **S-ACT-6** (R-02, R-07, phase 3): `grab` succeeds only on a `grabbable` object within reach while the agent holds nothing, and a held object moves with the agent.
- **S-ACT-7** (R-02, R-07, phase 3): `drop` puts the held object at the agent's position and level.
- **S-ACT-8** (R-07, phase 3): An agent that moves off the edge of what it stands on falls to the level beneath.

### 4. Time

- **S-TICK-1** (R-12, phase 1): Simulated time advances only by a fixed tick of one thirtieth of a second; no module reads a wall clock except to measure a budget.
- **S-TICK-2** (R-12, phase 1): Each tick runs in this order: world step, sensors, belief, drives, planner result, executor, learners, trace.
- **S-TICK-3** (R-12, phase 1): Randomness comes only from seeded streams, one per subsystem, each derived from the run's seed.
- **S-TICK-4** (R-12, phase 1): The same seed, scenario and stub planner give a byte-identical trace.
- **S-TICK-5** (R-15, phase 1): The world steps a list of agents in id order each tick, and with two agents each has its own belief, drives, memory and registry.
- **S-TICK-6** (R-17, phase 5): A planner reply is applied on the first tick after it arrives; the request and arrival ticks are in the trace, and a replay from the trace reproduces the run.

### 5. Trace

```ts
type Line =
  | { schema: 1; seed: number; scenario: string } // first line
  | { t: number; agent: EntityId | null; type: EventType; data: Record<string, unknown> };

type EventType = "fact" | "drive" | "goal" | "plan" | "skill" | "action" | "learn" | "world";
```

- **S-TRACE-1** (R-13, phase 1): The trace is JSON Lines: a header with schema, seed and scenario, then events with t, agent, type and data, in tick order.
- **S-TRACE-2** (R-13, phase 1): The event types are `fact`, `drive`, `goal`, `plan`, `skill`, `action`, `learn` and `world`; appending any other type throws.
- **S-TRACE-3** (R-13, phase 1): Eval helpers take a parsed trace as their only input.

## World

The world is seen from the side. A position is a distance along the ground, plus a level: the ground is 0, a crate's top is 1, a roof is 2. There is no depth: nothing is in front of or behind anything else. Behaviour belongs to properties, so most new objects need no code.

- **S-WORLD-1** (R-12, phase 1): World state is a list of entities, each with an id, a position, a level and properties, and only the world step changes it.
- **S-WORLD-2** (R-01, phase 2): Hunger and sleepiness rise each tick at the rates in the creature file and never exceed 1.
- **S-WORLD-3** (R-01, phase 2): Using an `edible` object removes it and lowers the user's hunger by the object's amount, and food reappears after the scenario's delay.
- **S-WORLD-4** (R-01, phase 2): Using a `soft` object rests on it: sleepiness falls each tick until the agent acts again or it reaches zero.
- **S-WORLD-5** (R-02, phase 3): An agent can move into an object with `has_opening` and is `inside` it while within its width; an object without one stops movement at its edge.
- **S-WORLD-6** (R-03, phase 3): An agent is `under_cover` while inside an object with `roof`, or while holding one.
- **S-WORLD-7** (R-03, phase 3): While it rains, an agent that is not `under_cover` becomes `wet`, and it stays wet until it has been under cover for 5 seconds.
- **S-WORLD-8** (R-09, phase 3): An object's `use` effect is built only from these primitives: set a fact, toggle a state, add or remove a property, change a drive.
- **S-WORLD-9** (R-11, phase 6): A scenario can switch a property's rule off, or change it, at a given tick.

## Sensing inside the world

The engine knows every position exactly. Perception is a filter that decides what the duck is told.

- **S-SENSE-1** (R-02, phase 2): For each entity within sight range and line of sight, sight emits its relations to the agent and the properties listed in the object's `looks`.
- **S-SENSE-2** (R-01, phase 2): The body sense emits the agent's own `hunger`, `sleepiness`, `wet`, `holding` and `level` every tick.
- **S-SENSE-3** (R-02, phase 3): A property that is not in an object's `looks` is never emitted by sight.
- **S-SENSE-4** (R-02, phase 3): An object that leaves sight keeps its last believed position, with a confidence that falls over time.
- **S-SENSE-5** (R-10, phase 6): Any sensor can be wrapped to drop, delay or contradict its facts at set rates, drawing from its own seeded stream.

## Drives and goals

A drive measures a discomfort. Personality is the weight on each drive, read from the creature file.

- **S-DRIVE-1** (R-01, R-08, phase 2): Each drive maps belief to a discomfort from 0 to 1, and its urgency is that discomfort times the creature file's weight for it.
- **S-DRIVE-2** (R-01, phase 2): The most urgent drive sets the goal, and a different drive takes over only when its urgency exceeds the current one's by the hysteresis margin.
- **S-DRIVE-3** (R-01, phase 2): A goal is a condition over belief, such as `hunger < 0.2`, and it is met when belief satisfies it.
- **S-DRIVE-4** (R-02, phase 3): Curiosity about an entity is `1 / sqrt(1 + n)`, where n is the number of tries recorded for its visible properties, and the drive's discomfort is the highest such value among visible entities.
- **S-DRIVE-5** (R-03, phase 3): Dislike of wet has a discomfort of 1 while the agent believes it is `wet`, and 0 otherwise.
- **S-DRIVE-6** (R-04, phase 4): Play has a discomfort above 0 only while a kid is believed visible.
- **S-DRIVE-7** (R-06, phase 4): A believed request becomes a drive whose goal is the request's goal statement and whose weight is the creature's `eager` weight; it ends when met, when refused, or after 60 seconds.

## Planner

```ts
interface PlanInput {
  goal: Condition;
  beliefs: readonly Fact[];
  skills: readonly SkillView[];
  notes: readonly Note[];
}

interface PlanOutput {
  skill: string;
  args: Record<string, EntityId>;
  guess?: string; // what it expects to happen, shown as a thought
  say?: string; // what it tells a kid, also shown as a thought bubble
}

type Planner = (input: PlanInput) => PlanOutput | null | Promise<PlanOutput | null>;
```

- **S-PLAN-1** (R-14, phase 1): A planner is a function from goal, beliefs, skills and notes to a skill with arguments, or nothing, and the kernel depends on that signature only.
- **S-PLAN-2** (R-18, phase 1): A planner's choice runs only if its skill is registered, every argument names a believed entity with the properties the parameter asks for, and the skill's preconditions hold in belief; otherwise it is logged as invalid and the agent idles.
- **S-PLAN-3** (R-14, phase 1): Code under `src/planner/` and `src/agent/` imports nothing from `src/world/` or `src/sim/`.
- **S-PLAN-4** (R-01, phase 2): The stub planner picks a skill whose effects satisfy the goal, chaining backward through preconditions to a depth of 5, and breaks ties by skill id.
- **S-PLAN-5** (R-02, phase 3): For a curiosity goal, the stub planner proposes an action on a visible property it has no note for, in a fixed order, with a guess of the outcome.
- **S-PLAN-6** (R-03, phase 3): The stub planner chains through notes as well as skills: a note saying an action on a property produced an effect counts as a way to reach that effect.
- **S-PLAN-7** (R-07, phase 5): For a goal no chain reaches, the planner proposes candidate action sequences; each is tried in the world, a failure is recorded as a note, and no candidate is tried twice.
- **S-PLAN-8** (R-06, phase 4): When neither a chain nor an untried candidate remains for a request, the planner's result is a refusal that says so.

## Executor and registry

```ts
interface Skill {
  id: string;
  params: Record<string, PropertyQuery>; // { target: { has: ["edible"] } }
  pre: readonly Condition[];
  effects: readonly Condition[];
  body: readonly Action[]; // actions whose targets refer to params
  origin: "instinct" | "learned";
}
```

- **S-EXEC-1** (R-12, phase 1): The executor runs one skill per agent at a time and advances it by at most one action step per tick.
- **S-EXEC-2** (R-01, phase 2): A new goal interrupts the running skill at its next action boundary, and the trace records the interruption.
- **S-EXEC-3** (R-01, phase 2): A skill ends `done` only if its declared effects hold in belief after its last action; otherwise it ends `failed`, naming the unmet effect.
- **S-EXEC-4** (R-10, phase 6): The same action repeated 5 times with no change in belief is cut off, and its skill fails with `stuck`.
- **S-REG-1** (R-16, phase 1): A skill has an id, parameters, preconditions, effects, a body and an origin, and its parameters are matched by property and never by entity id.
- **S-REG-2** (R-18, phase 1): The registry rejects a skill whose body contains anything but actions from the action set that refer to its parameters.
- **S-REG-3** (R-01, phase 2): A creature file's instincts are loaded as skills with the origin `instinct`.
- **S-REG-4** (R-07, phase 5): A learned skill is registered only after its declared effects were observed when it ran, with the origin `learned`.
- **S-REG-5** (R-07, phase 5): A skill with the same parameters and body as an existing one is not registered again.

Instincts are what the duck knows from birth: how to eat and how to rest. Everything else is found out.

## Memory and learning

The model's weights never change. The duck gets smarter because its notes, its numbers and its skills change.

```ts
interface Note {
  action: Action["kind"];
  property: string; // the target's property, never an entity id
  effect: Condition; // what was observed to follow
  tries: number;
  score: number; // recent success, 0 to 1
}
```

- **S-MEM-1** (R-02, phase 3): A note records an action, the target's property, the effect observed, a count of tries and a success score.
- **S-MEM-2** (R-02, phase 3): Notes hold properties and never entity ids, so a note learned on one object applies to any object with that property.
- **S-MEM-3** (R-11, phase 3): A note's score is updated as `s = (1 - a) * s + a * outcome`, with the rate a from the creature file.
- **S-MEM-4** (R-17, phase 3): Retrieval returns at most 8 notes, ranked by overlap with the goal and with the visible properties.
- **S-MEM-5** (R-11, phase 6): A note whose score is below 0.3 is not used for chaining, and its property counts as untried for curiosity.
- **S-MEM-6** (R-10, phase 6): Memory holds at most 200 notes and drops the least recently used.
- **S-LEARN-1** (R-23, phase 3): A learner is given only trace events and writes only its own store.
- **S-LEARN-2** (R-02, phase 3): After an exploratory action, the note learner records as its effect the changes in belief during the next second.
- **S-LEARN-3** (R-05, phase 4): A laugh is credited to the skills that ended in the 4 seconds before it, most recent first, each getting half the credit of the one after it.
- **S-LEARN-4** (R-05, phase 4): Each skill has a funniness estimate, updated only by arithmetic on credited laughs.
- **S-LEARN-5** (R-05, phase 4): During play, skills are chosen by Thompson sampling over those estimates, with a penalty for each recent repeat.
- **S-LEARN-6** (R-07, phase 5): When a tried sequence reaches a goal no skill covered, the skill learner replaces its entity arguments with the properties its actions depended on and registers it.
- **S-LEARN-7** (R-23, phase 6): Each learner can be switched off in a scenario, and the run still completes.

## Content

```json
{
  "id": "umbrella",
  "looks": ["grabbable"],
  "props": { "grabbable": true },
  "size": { "width": 1, "height": 1 },
  "use": { "toggle": "open", "while_on": { "add": ["roof"] } }
}
```

- **S-OBJ-1** (R-09, phase 2): An object is one JSON file with `id`, `looks`, `props`, `size` (its width along the ground and its height) and an optional `use`; a file that fails validation stops the load and names the file.
- **S-OBJ-2** (R-09, phase 2): Every file in `content/objects/` is loaded, and nothing else registers an object.
- **S-OBJ-3** (R-08, phase 2): A creature is one JSON file with `id`, `speed`, `reach`, `sight`, drive `weights`, `rates` and `instincts`.
- **S-OBJ-4** (R-09, phase 6): On load, each object is placed in an empty world and every action is applied to it; a crash, or a changed fact its file does not declare, fails the load.
- **S-OBJ-5** (R-16, phase 3): No object, creature or scenario id appears in a string under `src/`, outside tests.

## Simulated kid

A simulated kid is a sensor with a hidden taste vector p. It is the stand-in for the camera and microphone until phase 7.

- **S-SIM-1** (R-05, phase 4): A simulated kid emits `kid_visible`, `kid_laughing` and `said` facts and is given only trace events.
- **S-SIM-2** (R-05, phase 4): After a skill ends, it laughs 1 to 3 seconds later with probability `sigmoid(p · features - h * repeats)`, plus the persona's rate of random laughs.
- **S-SIM-3** (R-04, phase 4): It leaves after 60 seconds without laughing, after which `kid_visible` expires.
- **S-SIM-4** (R-05, phase 4): A persona is a data file, and its taste vector is not importable from `src/agent/`, `src/planner/` or `src/learners/`.

## Thought bubbles

The duck has no spoken voice. Its guesses, refusals and requests for help appear as thought bubbles.

- **S-SAY-1** (R-19, phase 4): Text a planner returns as `say` or `guess` is shown only if it has 12 words or fewer and contains no blocked word; otherwise it is dropped and the drop is logged.

## Language-model planner

The model server runs on the Mac itself and is reached over HTTP. In CI its replies are replayed from recordings.

- **S-LLM-1** (R-17, phase 5): The language-model planner calls an OpenAI-compatible endpoint with a JSON schema for its reply, and a reply that fails the schema is treated as an invalid choice.
- **S-LLM-2** (R-17, phase 5): Its prompt puts personality, the action set and skills first and the changing facts last, and stays under 1,500 tokens estimated at 4 characters each.
- **S-LLM-3** (R-17, phase 5): It is called at most once per 90 ticks per agent.
- **S-LLM-4** (R-17, phase 5): Replies can be recorded under a hash of their prompt and replayed, and in replay mode a prompt with no recording fails the run.
- **S-LLM-5** (R-17, phase 5): A misbehaving stub returns unknown skills, malformed replies and wrong guesses at set rates, and every scenario still completes without an invalid action reaching the world.

## Evals and speed

- **S-EVAL-1** (R-24, phase 2): A scenario is a data file with a setup, timed triggers, a horizon and seeds, and the runner returns one trace per seed.
- **S-EVAL-2** (R-24, phase 2): Scenario tests read every pass criterion from `evals/thresholds.json` and contain no thresholds of their own.
- **S-EVAL-3** (R-24, phase 2): Each eval run writes a JSON report with pass or fail and every measured value per scenario.
- **S-PERF-1** (R-20, phase 2): Thirty simulated minutes of the scenario 1 world run headless with the stub planner in under 20 seconds.

## Viewer

A plain viewer makes every phase watchable from phase 2 on, in any browser, including a phone's. It draws shapes and labels only. Each merge to `main` publishes it as a static site.

- **S-DRAW-1** (R-22, phase 2): A run with the viewer attached produces the same trace as a run without it.
- **S-DRAW-2** (R-22, phase 2): A pure function turns world state and the latest trace events into a view model seen from the side: where the ground is, each entity's shape, its place along the ground, its level as height and its label, and each agent's goal and thought.
- **S-DRAW-3** (R-22, phase 2): The view model scales the world to fit any viewport, portrait or landscape, keeping its proportions.
- **S-DRAW-4** (R-29, phase 2): The page takes its scenario and seed from its address, and with none given runs the first scenario in `content/scenarios/` with seed 1.
- **S-DRAW-5** (R-29, phase 2): Nothing the page loads imports a Node built-in, so the build runs from static files alone.
- **S-DRAW-6** (R-22, phase 2): Only code under `src/web/` touches the page or its canvas, and no other code imports from `src/web/`.

## Real senses and character drawing

- **S-REAL-1** (R-21, phase 7): Camera, speech and laughter sensors emit the same fact types as the simulated kid, and no image or audio is written to belief, memory, trace or disk.
- **S-DRAW-7** (R-30, phase 7): The character renderer draws from the same view model as the plain viewer.

## Open decisions

These are settled by the owner. Until then the default stands. Settled so far: the duck tries ideas for real in the world instead of rehearsing them, it is born with two instincts (eating and resting), and it shows thought bubbles instead of speaking.

1. **How the stub proposes candidates for the roof (S-PLAN-7).** Candidates are tried for real in the world, and each failure becomes a note. How the stub planner comes up with candidates good enough to succeed within 10 attempts is unproven, so phase 5 starts with two or three candidate designs compared on scenario 7.
2. **Conflicting facts (S-FACT-2).** Default: the later fact wins. Revisit in phase 6 if noise makes the duck flicker.
3. **Held-out scenarios.** Anything in this repository is visible to the building agent, so held-out variants live on the owner's machine or in a separate private repository.
4. **Content format.** JSON, validated by hand-written checks, so no dependency is needed yet.
5. **Character drawing.** Deferred to phase 7. The likely route is porting the PixiJS puppet from `puddles`. The plain viewer in phase 2 draws on a bare canvas.
