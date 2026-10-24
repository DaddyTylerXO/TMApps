# Startup animation proposals awaiting owner selection

No startup animation is implemented in this update. Three concrete directions preserve the pink tile and white Padlock icon:

1. A single 250 ms fade into the static padlock, with no looping movement.
2. A 400 ms sequence lighting the six numbered boxes from 1 to 6, then showing the static tile.
3. A 300 ms shackle-close motion followed immediately by the static tile.

Each option would be skippable, avoid blocking vault setup, use a static image under reduced motion and remain disabled until the owner selects a direction. Measure cold-start impact before enabling it. This proposal does not authorize an animation implementation.
