# One task, three ways

A small, runnable comparison of computer use, Playwright, and WebMCP. Every driver
opens the **same todo page**, adds **Book demo flight**, and marks it complete.
The expected visible result is **1 of 1 complete**. State lives only in memory;
every new page starts empty. This is a mechanism demo, not a performance benchmark.

| Approach | What the driver sees / does | Best for | Weakness |
| --- | --- | --- | --- |
| [Computer use](computer-use/run.mjs) | Claude sees screenshots and chooses mouse coordinates and keystrokes | Visual tasks, including UIs without automation hooks | Slower, paid model calls; visual mistakes and layout sensitivity |
| [Playwright](playwright/run.mjs) | A deterministic script locates labeled DOM elements, fills, clicks, checks | Repeatable web flows and tests | Needs page structure; this example follows a fixed recipe rather than planning |
| [WebMCP](webmcp/register.js) | The page publishes named tools with schemas; the client calls them | Structured agent actions designed by the site | Requires site cooperation and experimental browser/agent support |

Computer use can work across desktop apps in a full desktop environment. **This
example controls only a Chromium content viewport**. Playwright supplies its
screenshot/mouse/keyboard transport; no DOM queries or accessibility data enter
the model loop. The separate Playwright driver intentionally uses DOM locators.
The WebMCP driver is a deterministic tool consumer, not an LLM planner.

## Setup

Requires Node.js 22+ and npm. From the repository root:

```sh
npm ci
npx playwright install chromium
# On Linux, if browser system libraries are missing:
# npx playwright install --with-deps chromium
npm start
```

Leave the server running, then open <http://127.0.0.1:3000> or run a driver in a
second terminal. The server binds only to loopback and serves a fixed list of
demo assets. Stop it with Ctrl+C. No build, database, CI, or hosting is needed.

## 1. Computer use (Claude API)

```sh
export ANTHROPIC_API_KEY='your-key'
# Optional; must support computer_20251124:
export ANTHROPIC_MODEL='claude-sonnet-4-6'
npm run demo:computer
```

The loop sends a screenshot, receives Claude `computer` tool calls, executes
pixel/keyboard actions, returns screenshots as `tool_result` blocks, and repeats.
It uses the `computer_20251124` tool and `computer-use-2025-11-24` beta header.
The API is paid. Defaults to 20 requests maximum; `MAX_TURNS` accepts 1–100.
Full conversation history (including screenshots) is resent, so cost grows
with turns. Each request has a two-minute timeout. Supported actions are in
[actions.mjs](computer-use/actions.mjs); unsupported actions return tool errors.
Zoom is not enabled. The final screenshot is saved to
`artifacts/computer-final.png`. A model completion is reported as a claim, not an
automated DOM verification. Inspect that screenshot to confirm success.

See [Anthropic's computer-use documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
for current model/tool compatibility. No API key is included. `.env` files are
ignored; the scripts read shell variables, not `.env` files automatically.

## 2. Playwright (DOM)

This is a **Playwright library runner**, not Playwright Test: it launches
Chromium directly and executes one fixed todo recipe. It does not discover tests
or infer a plan. The flow adds and checks a todo, asserts the resulting state,
and saves a Playwright trace to `artifacts/playwright-trace.zip`.

Start the demo server in one terminal:

```sh
npm start
```

Run the flow in a second terminal (headless unless `HEADED=1`):

```sh
npm run demo:playwright
```

Open the saved trace with Playwright's native trace viewer:

```sh
npx playwright show-trace artifacts/playwright-trace.zip
```

Windows PowerShell equivalents:

```powershell
npm start
# In a second PowerShell terminal:
npm run demo:playwright
npx playwright show-trace artifacts/playwright-trace.zip
```

The runner uses accessible labels and roles to add and check the todo, then
asserts the checkbox and summary. No API key, model, or browser feature flag is
required. A failure exits nonzero.

## 3. WebMCP (structured tools)

```sh
npm run demo:webmcp
```

Works in ordinary Chromium via the clearly labeled **local structured-tool
fallback**. The page exposes `add_todo`, `complete_todo`, and `list_todos` with
JSON schemas and runtime argument validation. UI and tools share the same state
and rendering. The runner discovers metadata and calls tools without selectors
for actions; it uses Playwright only to transport JavaScript and verify the UI.
The fallback is a small in-page registry (`window.todoTools`), **not a full
WebMCP polyfill**, MCP server, or bridge to an external browser agent. It does
not make a browser agent discover these tools automatically.

For native registration, use an experimental Chrome build exposing WebMCP,
enable `chrome://flags/#enable-webmcp-testing`, relaunch, and visit the localhost
page. Native WebMCP needs a secure context (localhost is suitable for development).
The page feature-detects `document.modelContext.registerTool`, supports older
`navigator.modelContext` implementations, and reports the selected registration
mode below the todo list. A compatible browser agent/extension can discover the
registered tools out of band; merely opening the page does not launch an agent.

The optional native consumer run is:

```sh
npm run demo:webmcp -- --native
```

This launches bundled Chromium with `--enable-features=WebMCPTesting` and requires
native `getTools` / `executeTool`; it **fails explicitly** if those APIs are
unavailable. It does not silently claim native success using the fallback.
Bundled Chromium may lag the experimental APIs; use the local fallback for the
portable demo. Registration and consumer API shapes can change as the proposal
evolves. Current [Chrome imperative API guidance](https://developer.chrome.com/docs/modern-web-guidance/guides/webmcp/agentic-javascript-tools)
uses `document.modelContext`; older examples use `navigator.modelContext`.

For a manual fallback call, run this in the page's DevTools console:

```js
await window.demoReady;
window.todoTools.list();
const { todo } = await window.todoTools.call('add_todo', { title: 'Book demo flight' });
await window.todoTools.call('complete_todo', { id: todo.id, completed: true });
await window.todoTools.call('list_todos');
```

## Environment and verification

| Variable | Required? | Default / purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Computer use only | Anthropic key; never commit it |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-6` |
| `MAX_TURNS` | No | `20`; bounded computer-use requests |
| `DEMO_URL` | No | `http://127.0.0.1:3000`; all drivers |
| `HEADED` | No | Set to `1` to display a driver's browser |
| `PORT` | No | `3000`; server only |
| `CHROMIUM_EXECUTABLE_PATH` | No | Use an existing Chrome/Chromium binary instead of the bundled download |

```sh
npm test
```

Starts an ephemeral loopback server, runs the DOM and fallback drivers, and
checks invalid tool arguments, safe todo text rendering, reset, and server asset
boundaries. It requires installed Chromium but no key. Tests close their server
and browsers. See verification results below for what was actually run.

Verified locally on 2026-11-02 with Node 24 and an existing Chromium build 1208:

```sh
CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome npm test
```

- Passed the Playwright DOM flow with a trace saved during its normal run, the
  local structured-tool flow, page/reset and invalid-input checks, and
  screenshot/mouse/keyboard adapter checks.
- Native `--native` was attempted and exited with the documented unavailable-API
  error on this browser. Native tool discovery/execution and external agent
  integration were **not verified**.
- The Claude API loop was **not run**; it needs a paid API key and compatible
  model access. Only its local action adapter was executed without a key.
- A fresh bundled browser download was not completed in this environment; the
  existing-browser override was used. Other machines can use the normal
  `npx playwright install chromium` setup above.
