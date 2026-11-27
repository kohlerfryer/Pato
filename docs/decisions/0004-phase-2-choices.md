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

- **Resting on a soft thing moves the agent onto it.** The spec says it rests on it, and standing beside a nest to sleep looked wrong.

## Senses

- **Sight says whether each thing in view is near, true or false**, and tells the properties in its kind's `looks`. What was seen stays believed for one second after it was last seen.
- **Line of sight is decided by property rules.** A rule can say its property blocks the view. None does yet, so nothing hides anything until walls arrive in phase 3.
- **An entity carries its kind as a property**, and sight looks up that kind's `looks`.

## Drives and planning

- **A need is met below 0.2**, and wanted again as soon as it passes 0.2. There is no separate level at which wanting starts, so the duck tops up often.
- **The hysteresis margin is 0.1.**
- **An interruption waits for the action in flight to end.** A rest in progress is finished, not cut short.
- **The stub planner prefers a skill that can run now** over one it would have to chain toward, then breaks ties by skill id and entity id.
- **A planner is made per agent**, because the planner's input does not say which agent it is for.

## Evals

- **Scenario 1 keeps everything within sight.** The duck forgets what it can't see after a second, and remembering where things were is a phase 3 item. A wider world would leave it stuck.
- **Scenario 1 has three seeds, and they give identical runs**, because nothing in phase 2 is random yet.
- **The eval report is one JSON file per scenario** under `.quality/evals/`.
- **A scenario test may contain no number at all** outside quoted text. That is how "no thresholds of their own" is checked.
- **Measured for scenario 1:** both needs below 0.8 on every tick, 3.97 goal switches per minute against a limit of 6, and thirty simulated minutes in under a second.

## Viewer

- **What to draw is decided in `src/view/`, which is tested. `src/web/` only paints it.** The page has no tests of its own, so it is kept to drawing and the frame loop.
- **Whatever has acted is drawn as a circle, and everything else as a box.** The view learns who acts from the trace, so no kind is named.
- **The scene is framed once, from where things start**, with two units of room and the origin always in view. It does not follow the duck.
- **The thought shown is what the planner said, else what it guessed, else the skill it chose** and what it chose it for.
- **The page runs at most five ticks per frame.** A page left in the background picks up where it was instead of racing to catch up.
- **The page keeps time from the frame callback's own timestamp**, so no clock is read anywhere in `src/`.
- **Checked by hand:** the built page was opened in a headless browser at phone size. The duck ate, walked to the nest and rested, with no console errors.
