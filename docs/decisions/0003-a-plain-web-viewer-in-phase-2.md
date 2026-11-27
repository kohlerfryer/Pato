# A plain web viewer in phase 2, published from main

## Decision

- From phase 2 the world can be watched in a browser, drawn as plain shapes and labels from a tested view model. Character art stays in phase 7.
- Every merge to `main` publishes the build as a static site on GitHub Pages. The owner opens it on a phone and adds it to the home screen.
- The page runs the simulation itself, with the stub planner. It needs no server.

## Why

- The phase 2 gate asks the owner to watch the duck, and nothing was scheduled to draw it before phase 7.
- A web page updates itself on every merge. A native iOS app would need a paid developer account, code signing and a Mac build for each update.
- The owner tests on a phone. Phases 1 to 4 and 6 need no model, so they run there in full.

## Limits

- The language-model planner does not run in the page. A recent Pro iPhone can hold an 8 billion parameter model in a native app, but a web page gets far less memory. For now that planner needs the Mac's model server.
- GitHub Pages caches pages for about ten minutes, so a new build can take that long to show.

## Still needed from the owner

- GitHub Pages switched on for the repository, with GitHub Actions as its source.

## Rejected

- **A native app through TestFlight.** More setup for every update, and no gain until there is something only a native app can do.
- **Waiting for phase 7.** Six phases with nothing to look at.
