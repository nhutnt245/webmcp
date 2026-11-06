---
title: Demo flights knowledge
description: Entry point for the WebMCP flight demo that shows the Declarative and Imperative APIs in one app.
date: 2026-11-06
---

# Demo flights

Updated 2026-11-06. A three-page flight demo (search, results, summary) for learning the WebMCP
Declarative and Imperative APIs. The reading order is in [README.md](../../../README.md):1.

Authority order: live code in `public/`, `host/` and `server.js`; the three primary sources linked in the README;
this wiki; session memory.

| Folder    | Entry      | Purpose                                      |
| --------- | ---------- | -------------------------------------------- |
| Root wiki | This index | Routes to the code that decides the behavior |

- Declarative tools are `toolname` attributes on the forms in
  [public/index.html](../../../public/index.html):1 and [public/results.html](../../../public/results.html):1;
  their submit handlers are in [public/js/search-page.js](../../../public/js/search-page.js):1 and
  [public/js/results-page.js](../../../public/js/results-page.js):1.
- For API ownership and optional schema experiments, see [README.md](../../../README.md).
- State lives in the page URL, not in storage:
  [public/js/page-url.js](../../../public/js/page-url.js):1.
- Errors reach the agent only when returned as a value (`Promise.resolve({ error })` for `respondWith`, a returned
  object from `execute`); a rejected promise or a thrown error gives the agent only "Tool execution failed"
  (observed in Chrome 158 with `--enable-features=WebMCP`).
- `server.js` serves one folder: `npm start` serves `public/` on 4173, `npm run start:host` serves `host/` on 4174
  ([server.js](../../../server.js):1, [package.json](../../../package.json):1). `host/index.html` and
  `host/no-allow.html` embed the app in a cross-origin iframe with and without `allow="tools"`; the second port is the
  only thing that makes the origins differ, so keep `127.0.0.1` on both.
- The `tools` Permissions Policy defaults to `self`. In Chrome 158 a child without `allow="tools"` still has
  `document.modelContext`, but `registerTool()` and `getTools()` reject with `NotAllowedError`;
  `imperative-tools.js` catches that and only warns. `allow="tools"` lets the child register its own tools; it does not
  make the parent's `getTools()` list them (observed `[]`). Test in the child frame's DevTools context, not `top`.
- For running the app and inspecting WebMCP tools, see [README.md](../../../README.md).

Notes use `title`, `description`, and `date` frontmatter; register each in its folder index, cross-link related
notes, cite sources as `path:line`, and mark unverified claims `UNVERIFIED`. Carry an `Updated YYYY-MM-DD` marker.
Only `wiki/` is tracked; never link local raw notes.
