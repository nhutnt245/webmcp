---
title: Browser reach lab knowledge
description: Entry point for the static probe, booking and shopping demo.
date: 2026-11-04
---

# Browser reach lab

Updated 2026-11-04. The previous driver comparison has been replaced by one
static website. The server entry point is [scripts/server.mjs](../../../scripts/server.mjs):8;
public pages are [public/index.html](../../../public/index.html):1,
[public/booking.html](../../../public/booking.html):1 and
[public/shop.html](../../../public/shop.html):1. Run commands are authoritative
in [package.json](../../../package.json):7.

Compile notes just in time from task investigations. Authority order: live code
in `public/`, `scripts/` and `test/`; upstream WebMCP references linked by
[README.md](../../../README.md); this wiki; session memory.

| Folder | Entry | Purpose |
| --- | --- | --- |
| Root wiki | This index | Routes to authoritative demo behavior |

## Behavior pointers

- Probe generation and exposure placement: [public/shared/probe.js](../../../public/shared/probe.js):2.
  The answer table is created only with `key=1`: the same file, line 49.
- Current and legacy WebMCP feature detection, registration replacement and cleanup:
  [public/shared/webmcp.js](../../../public/shared/webmcp.js):2.
- Booking state and guards: [public/pages/booking-state.js](../../../public/pages/booking-state.js):2;
  state-dependent tools: [public/pages/booking-tools.js](../../../public/pages/booking-tools.js):3.
- Shopping state and local cart persistence:
  [public/pages/shop-state.js](../../../public/pages/shop-state.js):6;
  tool availability: [public/pages/shop-tools.js](../../../public/pages/shop-tools.js):3.
- Executable behavior checks: [test/demo.test.js](../../../test/demo.test.js):1.

Notes use `title`, `description`, and `date` frontmatter; register every note in
its folder index, cross-link related notes, cite source as `path:line`, and mark
unverified claims `UNVERIFIED`. Changes carry an `Updated YYYY-MM-DD` marker.
Only `wiki/` is tracked; never link local raw notes.
