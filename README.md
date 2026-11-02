# One task, three ways

A small, runnable comparison of computer use, Playwright, and WebMCP. Every driver
opens the **same todo page**, adds **Book demo flight**, and marks it complete.
The expected visible result is **1 of 1 complete**. State lives only in memory;
every new page starts empty. This is a mechanism demo, not a performance benchmark.

| Approach | What the driver sees / does | Best for | Weakness |
| --- | --- | --- | --- |
| [Computer use](computer-use/run.mjs) | Claude sees screenshots and chooses mouse coordinates and keystrokes | Visual tasks, including UIs without automation hooks | Slower, paid model calls; visual mistakes and layout sensitivity |
| [Codex Computer Use](#1b-computer-use-codex-desktop-plugin-observed-with-hooks) | The signed-in Codex Desktop plugin sees and operates the page; a read-only hook logs its tool calls | Watching what a native computer-use tool did, with no API key in this repo | Desktop plugin only; hook coverage and screenshot logging are not guaranteed (see below) |
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

## 1b. Computer use (Codex Desktop plugin, observed with hooks)

This repo adds **no tool, executor, MCP server, or API-key code** for Codex. The
existing Codex **Computer Use** plugin does the clicking, using your Codex sign-in
and plan. The only addition is a read-only
[hook](https://learn.chatgpt.com/docs/hooks) that records which tools Codex called,
with what arguments, and what came back, so you can see how the task went.

1. **Enable the plugin** in the Codex desktop app: **Plugins > Computer Use >
   Install plugin**, then turn on the server and skill toggles
   ([official steps](https://learn.chatgpt.com/docs/computer-use)). On Windows it
   works on the active desktop: keep the browser visible and expect it to take
   over the foreground. The built-in Browser is not available in the Codex CLI, so
   this setup does not promise that `codex exec` can drive the plugin.
2. **Trust the hook.** The repo ships [`.codex/hooks.json`](.codex/hooks.json) and
   [`.codex/hooks/record-tool-event.mjs`](.codex/hooks/record-tool-event.mjs).
   Project hooks load only for a trusted project, and Codex skips non-managed
   hooks until you review them: run `/hooks` in the CLI, or use **Review hooks**
   in Desktop, and trust the two `PreToolUse`/`PostToolUse` entries. Nothing here
   edits `~/.codex`, permissions, auth, or trust. Editing the hook changes its
   hash, so re-review it.
3. **Start the demo:** `npm start` (leave it running).
4. **Open this repo as the Codex project** and send a prompt that requires the
   tool, for example:

```text
Use @Computer (and no shell commands or code edits) on the todo demo that is
already running at http://127.0.0.1:3000 in my browser. Add one todo titled
Book demo flight, mark it complete, and verify the page visibly says
"1 of 1 complete". Before each action, take a screenshot and state in one line
what you observe. After each action, state the action and its outcome. Finish
with a short checkpoint list of observed state, action, and result. Report only
what you observed through the tool.
```

The model's narrative is not evidence. Inspect the logs below to confirm that the
tool was actually used and what it returned.

### What gets recorded

Each tool event is one JSON line in
`artifacts/codex-hooks/<session_id>/events.jsonl` (gitignored): `recordedAt` plus
the event Codex supplied (`hook_event_name`, `session_id`, `turn_id`,
`tool_use_id`, `tool_name`, `tool_input`, and for `PostToolUse` the actual
`tool_response` or error, `cwd`, `model`, `permission_mode`). A `PreToolUse` and
`PostToolUse` pair share a `tool_use_id`. Image data actually present in an input or
result is saved to `images/` next to the log and replaced by a `savedImage` path;
paths and URLs Codex supplied are kept as references and never fetched. Nothing is
invented: no screenshot is synthesized, and a screenshot call returns one
observed image, not a guaranteed before/after pair around every action.

The hook prints nothing and never allows, denies, rewrites, or adds context. If
recording fails it reports the reason on stderr and exits 1 (a failed hook; the
tool still runs, whereas exit code 2 would block it). Only tools whose
`tool_name` matches the hook `matcher` are recorded; the shipped matcher is
`^mcp__computer_use__`, which keeps shell commands, file edits and unrelated MCP
tools out of the log. That prefix is an **unverified default**: confirm it
against your install (below) and edit the `matcher` in both groups of
`.codex/hooks.json` if it differs, then re-review the hook. Sessions in other projects never trigger it.

Inspect from PowerShell (from the repo root):

```powershell
Get-ChildItem artifacts\codex-hooks -Recurse -Filter events.jsonl
# Follow a session and print one summary line per event:
Get-Content artifacts\codex-hooks\<session_id>\events.jsonl -Wait | ForEach-Object {
  $e = $_ | ConvertFrom-Json; '{0} {1} {2} {3}' -f $e.recordedAt, $e.hook_event_name, $e.tool_name, $e.tool_use_id }
# Full detail of one call:
Get-Content artifacts\codex-hooks\<session_id>\events.jsonl | ForEach-Object { $_ | ConvertFrom-Json } |
  Where-Object tool_use_id -eq '<tool_use_id>' | ConvertTo-Json -Depth 20
```

On Linux/macOS/WSL: `tail -f artifacts/codex-hooks/<session_id>/events.jsonl | jq -c '{recordedAt,hook_event_name,tool_name,tool_use_id}'`.

### Confirm the tool name and that logging fires

1. Run the prompt above, then check `artifacts/codex-hooks/`. If an
   `events.jsonl` appears, the matcher fits and each line's `tool_name` is the real
   name.
2. If nothing was logged, find the real name: look at the tool call shown in the
   Codex UI, or temporarily set `"matcher": ".*"` and run a short prompt that
   touches no secrets. Then restore a narrow matcher built from the name you saw
   (for example `^mcp__<server>__`), delete the broad log, and re-review the hook.
3. Re-run the prompt and confirm only Computer Use calls are logged.

`npm test` checks the shipped matcher against name fixtures only; it does not
prove the matcher fits a live Codex Computer Use install.

### Limits and the trace-format boundary

- These are **Codex hook logs, not a Playwright trace**. There is no `trace.zip`,
  and `npx playwright show-trace` cannot open them; that viewer applies only to
  the separate [Playwright demo](#2-playwright-dom).
- Per the hooks documentation, hooks cover shell, MCP, and most local function
  tools, but hosted and specialized tool paths can opt out. This README does not
  claim that every Computer Use operation is captured. Whether the plugin's calls
  reach hooks, which `tool_name` they use, and whether screenshots arrive as
  embedded images, references, or not at all are **unverified**: look at your
  own `events.jsonl`.
- The Codex transcript format is not a stable interface and is not read here.

### Windows, WSL, and the hook command

The command is resolved from the git root, so it works when Codex starts in a
subdirectory:

- Linux, macOS, and WSL: `node "$(git rev-parse --show-toplevel)/.codex/hooks/record-tool-event.mjs"`
- Windows (`commandWindows`): `powershell -NoProfile -Command "node (Join-Path (git rev-parse --show-toplevel) '.codex/hooks/record-tool-event.mjs')"`

This needs `node` and `git` on the PATH that Codex uses to run hooks. The Windows
override is **unverified on a real Windows Codex Desktop session** (it is only
defined by the hooks documentation). If it fails, or if your repo lives in WSL
while Desktop runs on Windows, edit the hook to use absolute paths (this changes
its hash, so review it again). A non-interactive shell often lacks nvm's `node`, so
give the full path to the Node binary:

```json
"command": "/home/you/.nvm/versions/node/v24.0.0/bin/node /home/you/webmcp/.codex/hooks/record-tool-event.mjs",
"commandWindows": "node C:\\Users\\you\\webmcp\\.codex\\hooks\\record-tool-event.mjs"
```

For a repo inside WSL opened from Windows Desktop, use a `\\wsl$\<distro>\...`
path in `commandWindows` only if the agent runs on Windows; if Codex runs its
agent inside WSL, the POSIX `command` applies. Which of these applies on your
machine is not established by this repo. Logs are written under the repo's
`artifacts/` folder on whichever side runs the hook.

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
boundaries. It then runs `scripts/verify-codex-hook.mjs`: the Codex hook recorder
is executed through its configured command, from a subdirectory of a throwaway git
repository, with events shaped like the documented hook schema. It checks paired
pre/post records, preserved input, result and error data, image extraction versus
reference-only data, session separation and path safety, empty stdout, and
malformed-input and recording-failure handling. It requires installed Chromium but
no key and no model call. Tests close their server and browsers. See verification
results below for what was actually run.

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
- The Codex hook recorder passed `scripts/verify-codex-hook.mjs` on 2026-11-02 (Node 24,
  Linux/WSL) with documented-schema fixtures. A live Codex Desktop session, the real
  Computer Use plugin, Windows hook execution (`commandWindows`), and whether
  Computer Use calls reach hooks or include screenshots were **not exercised**. The
  fixtures do not prove a live native session.
- A fresh bundled browser download was not completed in this environment; the
  existing-browser override was used. Other machines can use the normal
  `npx playwright install chromium` setup above.
