# The duck is drawn as a character from phase 3

## Decision

- R-30 and S-DRAW-7 move from phase 7 to phase 3.
- A new item, S-DRAW-8, gives each agent a pose from the action it has in progress: walking, busy or standing. The drawing shows the pose: legs stepping, eyes closed while busy, eyes open while standing.
- The character is original: a round white duck facing the viewer, with a single curl on its head, a rounded orange beak, pink cheeks and a warm brown outline. It is drawn in code on the canvas, so it needs no images and no new dependency.
- Everything else stays plain shapes until phase 7.

## Why

- The owner asked for it, after seeing the drawing.
- The kids will watch a duck more readily than a circle, and so will anyone watching a video of it.
- It only touches the page and the view model. The simulation and the trace do not change.

## Limits

- A pose comes from the action in progress, not from what the duck feels. Expressions that show a drive, such as looking sleepy before resting, stay in phase 7.
- Busy covers both eating and resting, because the view may not name what a thing is for.
