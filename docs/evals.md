# Pato: eval scenarios

Eleven scenarios prove the requirements in [`prd.md`](prd.md). Each is a headless test that runs the simulation and asserts on the trace, never on internal state. They are in build order, and each adds one layer to the one before.

A scenario's test cites it in its title, as `[E-02]`. Every number below is copied from `evals/thresholds.json`, which is what the tests read. If the two ever differ, the file is right and this document is out of date.

## How they run

| Tier   | Planner                          | When                              | Budget                          |
| ------ | -------------------------------- | --------------------------------- | ------------------------------- |
| Fast   | Stub                             | Every change, in CI               | All scenarios in about a minute |
| Replay | Recorded model replies           | Every change, in CI, from phase 5 | Seconds                         |
| Live   | Local model on the Mac           | At every phase gate               | Minutes                         |
| Soak   | Local model, random kid personas | Occasionally                      | 2 simulated hours               |

- A scenario passes with the stub when every criterion holds on the median of its seeds, unless it says otherwise.
- It passes with the local model when at least 8 of 10 seeds meet the same criteria.
- Stub runs are exact: the same seed gives the same trace.
- Each run writes a report with pass or fail and every measured value. At a gate, the owner compares it with the previous phase's.

## What every scenario forbids

- Special-casing an object, scenario or personality by name.
- Reading anything the duck could not sense, such as a simulated kid's tastes.
- Changing a threshold. A criterion that looks wrong is reported to the owner.

## Simulated kids

A simulated kid has a hidden taste vector p over skill features. After the duck finishes a skill, the kid laughs 1 to 3 seconds later with probability `sigmoid(p · features - h * repeats)`. The habituation h makes repeats stop being funny. It leaves after 60 seconds without laughing.

| Persona | Behaviour                             |
| ------- | ------------------------------------- |
| Giggler | Laughs easily, slow to tire of a joke |
| Bossy   | Makes a request every 20 seconds      |
| Quiet   | Laughs rarely and late                |
| Absent  | Nobody there                          |

## Starting world

- Food (`edible`), a nest (`soft`), a house (`has_opening`, `roof`, `flat_top` at level 2), a box (`has_opening`) and a crate (`grabbable`, `flat_top` at level 1).
- A jump raises the duck one level.
- All times are simulated seconds.

## Scenarios

### 1. Alone and alive

**E-01** (S-DRIVE-1, S-DRIVE-2, S-PLAN-4, S-WORLD-2, phase 2): With no kid, the duck keeps hunger and sleepiness in check for 30 minutes without dithering.

- **Setup:** food, a nest, no kid, hunger and sleepiness at 0.3, a 30-minute run.
- **Trigger:** none. The clock runs.
- **Pass:** hunger and sleepiness each stay below 0.8 on at least 95% of ticks. The duck eats and sleeps at least once each. Goal switches average 6 or fewer per minute.
- **Forbidden:** timers or schedules that trigger eating or sleeping.

### 2. New house

**E-02** (S-DRIVE-4, S-PLAN-5, S-LEARN-2, S-MEM-2, S-WORLD-5, phase 3): The duck explores a house it has never seen, loses interest, and then enters a box sooner than it entered the house.

- **Setup:** the scenario 1 world, empty memory, low drives.
- **Trigger:** a house appears in view at 60 seconds. A box appears after the duck's third visit to the house.
- **Pass:** the duck is inside the house at least once within 180 seconds. Memory gains a note about `has_opening`. Time spent at the house falls across the first three visits. The time from first seeing the box to first entering it is under half the time the house took.
- **Forbidden:** the words "house" or "box" in code under `src/`, outside tests.

### 3. Rain

**E-03** (S-WORLD-7, S-DRIVE-5, S-PLAN-6, phase 3): When it rains the duck gets under cover, faster the second time, and works out shelter even with no prior knowledge.

- **Setup:** one run with a duck that completed scenario 2, one with empty memory. Both start outside.
- **Trigger:** rain starts.
- **Pass:** with prior knowledge, the duck is under cover within 60 seconds on the first rain and 20 on the second. With empty memory, it is under cover within 180 seconds and memory gains a note linking `roof` to not being wet.
- **Forbidden:** any rule connecting rain to a specific object or place.

### 4. Kid arrives

**E-04** (S-DRIVE-6, S-DRIVE-2, S-SIM-3, phase 4): The duck plays when a kid appears unless it is starving, and returns to its own needs when the kid leaves.

- **Setup:** three runs with hunger at 0.2, 0.5 and 0.9. Giggler persona.
- **Trigger:** a kid becomes visible.
- **Pass:** at 0.2 the duck is playing within 10 seconds. At 0.9 it eats first, then plays within 10 seconds of finishing. When the kid leaves, it returns to its own drives within 15 seconds. It switches between eating and playing at most twice in the 30 seconds after the trigger.
- **Forbidden:** a play mode that bypasses the drive weights.

The run at 0.5 is recorded without an assertion. Scenario 8 uses it.

### 5. What's funny

**E-05** (S-LEARN-3, S-LEARN-5, S-SIM-2, phase 4): Over a session the duck gets more laughs, its idea of what is funny matches the kid's hidden tastes, and it keeps its act varied.

- **Setup:** Giggler and Quiet personas, 10% random laughs, a 10-minute session.
- **Trigger:** the kid is visible from the start.
- **Pass:** laughs per minute in the final third are at least 1.5 times the first third. The duck's funniness estimates correlate with the true p at 0.5 or above (Spearman). The entropy of skills used in the final third stays at or above 60% of its maximum.
- **Forbidden:** reading p.

### 6. Requests

**E-06** (S-DRIVE-7, S-PLAN-8, phase 4): The duck attempts what a kid asks, and says so when it can't.

- **Setup:** Bossy persona, the eager creature file, a fixed list of five requests of which one is impossible.
- **Trigger:** a request arrives every 20 seconds.
- **Pass:** at least 80% of the possible requests are attempted within 15 seconds. The impossible one gets a refusal or a request for help within 15 seconds, after 3 attempts at most.
- **Forbidden:** mapping request text straight to a skill. A request becomes a goal and goes through the planner. A table from phrase to goal is fine with the stub.

### 7. The roof

**E-07** (S-PLAN-7, S-LEARN-6, S-REG-4, S-REG-5, phase 5): Asked to get on the roof with no skill for it, the duck works out a way, saves it, and reuses it.

This is the hardest scenario. The answer is to carry the crate to the house, drop it, jump onto it, then jump to the roof.

- **Setup:** a house, a crate, the duck on the ground, only instincts in the registry.
- **Trigger:** the goal of being on top of the house is given.
- **Pass:** the duck is on the roof within 10 attempts. The registry gains exactly one new skill, with preconditions and effects. A second request succeeds within 2 attempts by reusing it. With the crate removed, the duck says it can't and asks for help.
- **Forbidden:** a climbing skill written in advance, or a saved skill that names objects instead of matching them by property.

### 8. Two personalities

**E-08** (S-OBJ-3, S-DRIVE-1, phase 6): Two creature files give two measurably different ducks.

- **Setup:** scenarios 2, 4 (at hunger 0.5) and 6, each rerun with two creature files: bold and eager, shy and stubborn.
- **Trigger:** as in each scenario.
- **Pass:** the bold duck reaches the house sooner in at least 8 of 10 seeds. The eager duck attempts more requests in at least 8 of 10. The creature file is the only difference between the runs.
- **Forbidden:** branching on a creature's id.

### 9. One-file object

**E-09** (S-OBJ-1, S-OBJ-4, S-WORLD-8, phase 6): An umbrella added as one file is discovered and keeps the rain off.

- **Setup:** the scenario 3 world. One new file for an umbrella: `grabbable`, and `use` opens it, which gives it `roof`.
- **Trigger:** the umbrella appears. Rain starts 5 minutes later.
- **Pass:** the change is that one file. The load-time check passes. The duck tries the umbrella within 180 seconds and records what `use` did. A duck holding the open umbrella in rain is not wet.
- **Forbidden:** changes to anything under `src/`.

### 10. Messy senses

**E-10** (S-SENSE-5, S-EXEC-4, S-PLAN-2, phase 6): With noisy, late and contradictory input, nothing crashes and the duck still looks after itself.

- **Setup:** scenarios 1, 4 and 6 rerun with 20% of facts dropped, 10% contradicted, kid facts delayed 5 seconds, the kid vanishing mid-game, and requests made of unknown words.
- **Trigger:** as in each scenario.
- **Pass:** no crash. No action repeats more than 5 times without a change in belief. Every planner choice that runs is valid. Scenario 1's criteria still hold. Scenarios 4 and 6 pass with their time limits doubled.
- **Forbidden:** switching the noise off on any code path.

### 11. The rule changes

**E-11** (S-WORLD-9, S-MEM-5, phase 6): When roofs stop keeping rain off, the duck stops trusting them and finds another way to stay dry.

- **Setup:** the scenario 9 world, with a duck that has sheltered in the house several times.
- **Trigger:** at 5 minutes, during rain, the `roof` rule is switched off for the house. The open umbrella still works.
- **Pass:** the duck goes into the house at most 4 more times while wet. Its note about sheltering there falls below the score at which notes are used. It is dry again within 180 seconds of the change.
- **Forbidden:** telling the duck that the rule changed.

## Held-out variants

The owner keeps variants of these scenarios outside this repository, with different layouts, object ids and seeds. If the scenarios here pass and the held-out ones fail, the code has been fitted to the tests.
