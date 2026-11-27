# An inspector in the viewer: what the duck believes and why it acts

## Decision

- The viewer gains an inspector for each agent. It shows what the agent believes right now and where each belief came from, how urgent each drive was when it last chose a goal, and the skill and action it is in the middle of, with the reason for its last failure.
- The picture marks how far the agent can see and which things it believes something about.
- The inspector reads the trace and nothing else about the agent. Two events are added to the trace so that it can: the urgency of every drive whenever the goal changes, and a note whenever a belief is forgotten.

## Why

- The owner asked to see what the duck sees and why it does what it does.
- R-13 says the trace is enough to explain a session. Today it is not. It records which goal was chosen but not what it beat, and it records a belief arriving but not leaving.
- It is a new requirement, R-31, because nothing in the PRD asked for it. A spec item cannot be scheduled later than the requirement it serves, and R-13 belongs to phase 1, which has passed.
- Reading only the trace means a recorded run can be inspected later exactly as a live one is.

## Limits

- Urgencies are recorded when the goal changes, not every tick. Between changes the inspector shows need levels moving, from the agent's beliefs about itself, and the urgencies as they stood at the last choice.
- The page itself stays untested. Everything the inspector shows is decided in the view model.
- These four items join phase 2, so its gate waits for them.

## Rejected

- **Handing the view model the agent's belief store and drives directly.** Simpler today, but a recorded trace could not be inspected, and the gap in R-13 would stay.
- **Recording every urgency on every tick.** It would roughly double the trace for a number the reader can already follow from the need levels.
