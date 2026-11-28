# Objects have a height, in whole levels

## Decision

- An object's footprint gains `height`: how many levels it stands, a whole number, zero when left out.
- Its top is its level plus its height. A crate is 1 tall, so its top is level 1. A house is 2, so its roof is level 2. Food and a nest are 0.
- A new item, S-OBJ-6, says this, and S-ACT-5 points to it.

## Why

- S-ACT-5 lets the duck jump onto a `flat_top` "whose top is exactly one level above it", but nothing said where an object's top is. Without it, the roof puzzle could not be built from the files.
- The tilted view needs to know how tall to draw a thing. Today everything is drawn half a unit tall.
- Whole levels match how the world already counts height, so no item about levels changes.

## Rejected

- **Height as a property, such as `"tall": 2`.** Properties carry behaviour and are what the duck sees and learns about. Size is shape, so it belongs with width and depth.
- **Height in world units.** It would need rounding into levels wherever jumping and standing are decided.
