---
title: Driver boundaries
description: Where each approach interacts with the common demo.
date: 2026-11-02
---

# Driver boundaries

- The UI and tools share the store; state is in memory, and todo text is rendered
  as text nodes ([demo/app.js](../../../demo/app.js):17,
  [demo/app.js](../../../demo/app.js):24).
- The static loopback server exposes only an explicit asset map
  ([scripts/server.mjs](../../../scripts/server.mjs):4).
- The DOM driver uses labeled inputs, buttons, and checkboxes
  ([playwright/run.mjs](../../../playwright/run.mjs):8).
- The Playwright driver runs a fixed todo flow, checks the resulting state, and
  saves screenshots and DOM snapshots to `artifacts/playwright-trace.zip` during
  every run. Open it with the native
  `npx playwright show-trace` command ([playwright/run.mjs](../../../playwright/run.mjs):1,
  [README.md](../../../README.md):60,
  [scripts/verify.mjs](../../../scripts/verify.mjs):12).
- The computer-use transport receives screenshots and executes mouse/keyboard
  actions; the model loop does not inspect DOM state
  ([computer-use/actions.mjs](../../../computer-use/actions.mjs):1,
  [computer-use/run.mjs](../../../computer-use/run.mjs):12).
- Native WebMCP registration is feature-detected; a separate local registry is
  always available for the portable demonstration. Local calls do not establish
  external browser-agent integration
  ([webmcp/register.js](../../../webmcp/register.js):14,
  [webmcp/register.js](../../../webmcp/register.js):24).
- `--native` explicitly selects native consumer APIs; default execution uses the
  local structured tool harness ([webmcp/run.mjs](../../../webmcp/run.mjs):6).
- Setup commands, environment variables, API references, and actual verification
  limits belong in [README.md](../../../README.md):1. The behavioral check entry
  is [scripts/verify.mjs](../../../scripts/verify.mjs):1.
