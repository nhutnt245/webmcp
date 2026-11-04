---
title: Demo flights knowledge
description: Entry point for the two-page flight demo and embedded exposure layers.
date: 2026-11-04
---

# Demo flights

Updated 2026-11-04. The app is a three-page flight flow with embedded exposure
layers. Entry points: [public/index.html](../../../public/index.html):1,
[public/results.html](../../../public/results.html):1.

Compile notes just in time. Authority order: live code in `public/`, `scripts/`
and `test/`; upstream WebMCP references in [README.md](../../../README.md);
this wiki; session memory.

| Folder | Entry | Purpose |
| --- | --- | --- |
| Root wiki | This index | Routes to authoritative behavior |

- Shared UI actions, the Lowest price card probes and navigation: [public/pages/booking.js](../../../public/pages/booking.js):1.
- Session state, filtering and guards: [public/pages/booking-state.js](../../../public/pages/booking-state.js):1.
- Selection navigates to a summary; the runtime/storage/console probes are single values on the results page only (Updated 2026-11-04): [public/pages/booking.js](../../../public/pages/booking.js):1.
- Per-page/state tools: [public/pages/booking-tools.js](../../../public/pages/booking-tools.js):1.
- Navigation: `/` is always the editable search form (previous search prefills it) and a new search resets filters and selection; results and summary keep entry guards, and both link back through `#edit-search`: [pageAllowed](../../../public/pages/booking-state.js):1. Updated 2026-11-04.
- Seeded flights and the one-per-layer `probes` constants (README "Access examples" lists the ten): [public/shared/flights.js](../../../public/shared/flights.js):1.
- Current/legacy API registration: [public/shared/webmcp.js](../../../public/shared/webmcp.js):1.
- Static server and mock flight endpoint: [scripts/server.mjs](../../../scripts/server.mjs):1.
- Executable behavior tests: [test/demo.test.js](../../../test/demo.test.js):1.
- Run commands: [package.json](../../../package.json):9.

Notes use `title`, `description`, and `date` frontmatter; register each in its
folder index, cross-link related notes, cite sources as `path:line`, and mark
unverified claims `UNVERIFIED`. Carry an `Updated YYYY-MM-DD` marker.
Only `wiki/` is tracked; never link local raw notes.
