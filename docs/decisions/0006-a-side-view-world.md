# The world is seen from the side

## Decision

- The world is a line of ground with levels above it, seen from the side like a picture book. A position is a distance along the ground plus a level.
- There is no depth. Nothing is in front of or behind anything else.
- Height stays in whole levels, as the spec already had it: the ground is 0, a crate's top is 1, a roof is 2. A jump raises the duck one level.
- An object's file gives its `size`: a width along the ground and a height. This replaces `footprint`, which had a width and a depth.
- A spot to move to is a distance along the ground.

## Why

- The owner chose it after seeing the same scene drawn from above, at an angle, from the side and in 3D. Young kids can't read a map seen from above.
- From the side, the things the duck will learn are visible as what they are: jumping onto a crate, climbing to a roof, going in through a door, standing under cover in the rain.
- The spec's levels, `jump`, `flat_top`, `inside` and `under_cover` were written without a second ground direction, so no item past phase 2 changes.
- A tap on the screen means one clear thing: a place along the ground, and how high.

## What changes

- Phase 2 code for positions, distances, moving, sight, object and scenario files, and the view model. Belief, drives, the planner, the executor and the trace do not change, because they only see facts.
- Scenario 1 is laid out along a line, so its measured values change. Its thresholds do not.

## Limits

- Hiding can only mean being inside something or behind something that blocks sight along the ground. There is no walking around a thing.
- Two things at the same place on the same level overlap. Nothing stops that yet.
- A side view suits a phone held sideways. Held upright, the scene is a band across the middle.

## Rejected

- **The tilted view.** The cheapest change and good for touch, but the owner preferred the picture-book look, and jumping and climbing read less clearly.
- **True 3D.** A new library, a camera to steer, and taps that have to be turned into a place in space, for no behaviour the game needs yet.
- **Continuous height with gravity.** Falling and bouncing would look lively, but every later item about levels would need rewriting. The drawing can animate a jump without the world knowing.
