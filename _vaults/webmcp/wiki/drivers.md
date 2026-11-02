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
- The OpenAI computer-use driver is a second pixel-only path: a Responses API
  loop sends `tools: [{type: "computer"}]`, validates each `computer_call`'s
  `actions[]` batch against the viewport before executing any of it, and returns
  a `computer_call_output` screenshot with the same `call_id`, continuing via
  `previous_response_id` ([computer-use/openai-loop.mjs](../../../computer-use/openai-loop.mjs):7,
  [computer-use/openai-actions.mjs](../../../computer-use/openai-actions.mjs):19). Pending
  safety checks, incomplete or refused responses, unexpected tools, and turn
  limits stop the run instead of reporting success
  ([computer-use/openai-loop.mjs](../../../computer-use/openai-loop.mjs):35,
  [computer-use/openai-loop.mjs](../../../computer-use/openai-loop.mjs):58). The HTTP call
  and default model live in [computer-use/openai-api.mjs](../../../computer-use/openai-api.mjs):3.
  The task prompt and viewport are shared with the Claude driver
  ([computer-use/task.mjs](../../../computer-use/task.mjs):3). Final artifact:
  `artifacts/openai-computer-final.png` ([computer-use/openai-run.mjs](../../../computer-use/openai-run.mjs):7).
- OpenAI tests are offline: documented Responses fixtures replace the model, the
  DOM judges the todo outcome, and the real CLI runs through a test-only `fetch`
  preload rather than a production base-URL option
  ([scripts/verify-openai.mjs](../../../scripts/verify-openai.mjs):50,
  [scripts/verify-openai.mjs](../../../scripts/verify-openai.mjs):262). Live API
  access was UNVERIFIED when this note was written (Updated 2026-11-02).
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
