# The world is drawn at an angle from above

## Decision

- The world keeps what it had: two directions along the ground, plus a level. Nothing in the simulation changes.
- The viewer draws it at an angle from above. A step away from the viewer moves a thing half as far up the screen as a step sideways moves it across, and each level lifts it straight up by one unit.
- Things are drawn from far to near, so nearer things cover farther ones.
- Everything stands half a unit tall for now, because no file says how tall a thing is.

## Why

- The owner chose it after seeing the same scene drawn from above, at an angle, from the side and in 3D. Young kids can't read a map seen straight down.
- A tap on the ground still means one clear place, which a kid will need for putting things into the world.
- There is room to walk around things and to hide behind them.
- It is a change to the view model and the page only. The existing wording of S-DRAW-2 and S-DRAW-3 already allows it.

## Tried and dropped

- **A side view**, with one direction along the ground. It was built and passed every check, then dropped the same evening when the owner preferred this. Its pull requests were closed unmerged and its branches kept. It cost depth: hiding could only mean being inside something.

## Limits

- Tall things, such as a house, need a height to be drawn properly. That needs a field in the object file, which is a spec change to propose when phase 3 brings the first tall thing.
- A tap is not yet turned back into a place on the ground.
- Nothing zooms or follows the duck.

## Rejected

- **True 3D.** A new library, a camera to steer, and taps that have to be turned into a place in space, for no behaviour the game needs yet.
