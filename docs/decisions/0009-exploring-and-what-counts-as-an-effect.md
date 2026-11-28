# Exploring again, exploring for any goal, and how long an effect takes

Scenarios 2 and 3 cannot pass under the spec as it stands. Three changes are proposed.

## What happens now

In scenario 2, the duck enters the house about two seconds after it appears and tries each action on it once. It notes that moving into a thing with an opening puts it inside and under cover. Then it never goes back: every action on the house has a note, so the planner has nothing to propose, and the duck idles until a need pulls it away. E-02 asks for three visits whose length falls.

In scenario 3, the dislike of wet sets the goal "wet is false". No note has that effect, because drying takes 5 seconds under cover (S-WORLD-7) and the learner only looks one second past an action (S-LEARN-2). With empty memory, nothing explores for a goal other than curiosity, so the duck stands in the rain. E-03 asks it to find shelter within 180 seconds and to gain a note linking `roof` to not being wet.

## Proposed

1. **S-PLAN-5, extended.** Once every action on what is in view has a note, the planner repeats the least-tried one on the most curious thing. Curiosity still falls with each try, so the visits get shorter and stop once it is below 0.2.
2. **S-PLAN-9, new.** For a goal that no skill or note reaches, the stub planner explores as it does for curiosity. A wet duck with no notes tries things, and walking into the house is one of them.
3. **S-LEARN-2, changed.** The learner looks from the start of an action until the next action starts, for at least one second and at most ten. A duck that walks into the house and waits there sees itself dry five seconds later, and notes it.

## Costs

- A longer window credits more to the wrong action, such as a move just before eating getting credit for the meal. Scores fall for effects that don't repeat, so the noise fades but stays in memory.
- Exploring for any goal means a duck with an unmet need may poke at things rather than wait. With no skill or note for the goal, waiting would not help either.
- Phase 3 gains one item.

## Not proposed

- Making shelter instant, so being under cover ends wetness at once. It would hide the drying the owner may want to see.
- A note with no action, such as "being under cover makes me dry". It would need a second kind of note.
