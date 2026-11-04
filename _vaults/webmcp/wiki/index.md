---
title: Demo flights knowledge
description: Entry point for the WebMCP flight demo that shows the Declarative and Imperative APIs in one app.
date: 2026-11-04
---

# Demo flights

Updated 2026-11-04. A three-page flight demo (search, results, summary) for learning the WebMCP
Declarative and Imperative APIs. The reading order is in [README.md](../../../README.md):1.

Authority order: live code in `public/` and `server.js`; the three primary sources linked in the README;
this wiki; session memory.

| Folder    | Entry      | Purpose                                      |
| --------- | ---------- | -------------------------------------------- |
| Root wiki | This index | Routes to the code that decides the behavior |

- Declarative tools are `toolname` attributes on the forms in
  [public/index.html](../../../public/index.html):1 and [public/results.html](../../../public/results.html):1;
  their submit handlers are in [public/js/search-page.js](../../../public/js/search-page.js):1 and
  [public/js/results-page.js](../../../public/js/results-page.js):1.
- Imperative tools are objects passed to `document.modelContext.registerTool` in
  [public/js/imperative-tools.js](../../../public/js/imperative-tools.js):1. Each tool name has exactly one owner.
- State lives in the page URL, not in storage:
  [public/js/page-url.js](../../../public/js/page-url.js):1.
- Errors reach the agent only when returned as a value (`Promise.resolve({ error })` for `respondWith`, a returned
  object from `execute`); a rejected promise or a thrown error gives the agent only "Tool execution failed"
  (observed in Chrome 158 with `--enable-features=WebMCP`).
- The app has no tests, evals or probes by design. Verify changes in a WebMCP-enabled Chrome with
  `await document.modelContext.getTools()` and `executeTool`.

Notes use `title`, `description`, and `date` frontmatter; register each in its folder index, cross-link related
notes, cite sources as `path:line`, and mark unverified claims `UNVERIFIED`. Carry an `Updated YYYY-MM-DD` marker.
Only `wiki/` is tracked; never link local raw notes.
