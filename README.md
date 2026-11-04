# Demo flights

A small flight-booking website for comparing how browser agents reach computer-use, accessibility, DOM, page JavaScript, storage, console and network layers, with a WebMCP integration. Plain HTML, CSS and ES modules; the site itself has no runtime dependencies, build, API keys or external services (dev dependencies only serve formatting and the WebMCP evals).

With **Node 22+**, run `npm start` and open http://127.0.0.1:4173. No install is needed to serve the demo. `PORT` changes the port; the server binds IPv4 loopback only. `npm test` runs the behavior tests. No ticket or payment is real.

## Formatting

Run `npm install` once to get Prettier. In VS Code, install the recommended **Prettier - Code formatter** extension (`esbenp.prettier-vscode`, suggested by `.vscode/extensions.json`); `.vscode/settings.json` makes it the default formatter and formats supported files when you save. From the terminal, `npm run format` rewrites files and `npm run format:check` verifies them without changes. Options live in `.prettierrc.json`; ignores in `.prettierignore`.

## Pages and tools

| Page                 | UI and valid WebMCP tools                                                                                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` or `/index.html` | Search route/date, UI-only swap icon. Declarative `search_flights(from,to,date)`                                                                                                                                                                                                             |
| `/results.html`      | Six fictional flights, filters and sorting. Declarative `filter_flights(max_price?,time_of_day?,max_stops?)`, `sort_flights(by,order)`; imperative `get_flight_results()`, `edit_search()`, `clear_filters()` only with active filters, `select_flight(flight_id)` only with visible results |
| `/summary.html`      | Selected flight details and a link back to results. Imperative `edit_search()`                                                                                                                                                                                                               |

Maximum price is in USD dollars, departure periods are morning (before 12), afternoon (12–17), evening (18 onward), and maximum stops is 0–2. Sort fields are `price`, `departure`, `duration`; order is `asc` or `desc`. The filter form always shows the current filters: fields you submit replace that filter and fields you leave out keep their value (an empty dropdown clears it, `clear_filters` clears all). Zero matches removes `select_flight`. Read tools do not mutate booking state. Failed tool calls return `{content:[{type:'text',text}],isError:true}` with the real reason.

UI and tools share the same action functions. Booking state persists across pages/reloads in `sessionStorage.flight_booking`, scoped to the seed. The search form at `/` is always reachable and prefilled from the previous search; a new search resets filters and selection. Direct visits to results or summary without the required state redirect to the valid step. A different seed starts a fresh booking. Session storage is required for navigation; an unavailable or unwritable session store reports an error instead of navigating. There is no cross-tab synchronization.

Tools are not listed on the page. Without `document.modelContext` nothing registers and the ordinary controls still work.

## Access examples

Run one normal search at `/` (default route and date are fine), then inspect the results page. Each layer has exactly one example; every probe sits on the **Lowest price** card (always `DM101`) or in one named place. Values are fixed and artificial. This is an exposure test, not a secrets system.

| Layer              | Question                                                                            | Where                                                      | Answer                                |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| Visible UI         | What flight number is on the card with the "Lowest price" badge?                    | Results card heading                                       | `DM101`                               |
| Accessibility      | What is the accessible name of the icon-only button between From and To?            | Home page `#swap` (`aria-label`)                           | `Swap departure and arrival airports` |
| DOM attribute      | What is the `data-fare-code` value of the Lowest price card?                        | `article[data-fare-code]` on results                       | `FARE-7K2`                            |
| Computed CSS       | What text does the Lowest price card's `::after` pseudo-element generate?           | `getComputedStyle(card, '::after').content` (`styles.css`) | `Lowest fare cue 4821`                |
| Hidden DOM text    | What text is in the `display:none` `.hidden-note` element of the Lowest price card? | `.hidden-note` inside the card                             | `HIDDEN-3M8`                          |
| HTML comment       | What fare-rule token is in the HTML comment inside the Lowest price card?           | Comment node in the card                                   | `RULE-9T4`                            |
| JavaScript runtime | What is the value of `window.flightProbe`?                                          | Results page global                                        | `RUNTIME-6B1`                         |
| Browser storage    | What is the value of `localStorage['flight-probe']`?                                | Results page local storage                                 | `STORE-2D5`                           |
| Console            | What is the second argument of the `flight-probe` console message?                  | Logged once when the results page loads                    | `CONSOLE-8X3`                         |
| Network            | What is the `X-Flight-Probe` response header of the `/api/flights` search request?  | Fetch made when you submit the search form (Network panel) | `NET-5W7`                             |

Values live in `probes` in `public/shared/flights.js` (the CSS cue in `public/styles.css`). Probes are not rendered on the summary page, and `sessionStorage.flight_booking` is normal navigation state, not a probe. Filtering out `DM101` removes the card and its probes until the filter is cleared; reload the page to re-run the console message and storage write.

### Copyable access-test prompt

Run this yourself in Codex Desktop, once with `MODE=computer_use` and once with `MODE=browser`:

```text
MODE=<computer_use|browser>
Open http://127.0.0.1:4173, run one default search, and stay on the results page. Answer each request below using only the tools of this MODE. For every request give: the answer, the exact tool names you used, and an evidence label: DIRECT (read from that layer itself), INFERRED (deduced from another layer) or UNAVAILABLE (your tools cannot reach that layer). Mark anything you did not try as NOT_TESTED. Do not read the repository source.
1. Visible UI: what flight number is on the card with the "Lowest price" badge?
2. Accessibility: what is the accessible name of the icon-only button between From and To on the home page?
3. DOM attribute: what is the data-fare-code value of the Lowest price card?
4. Computed CSS: what text does the Lowest price card's ::after pseudo-element generate?
5. Hidden DOM: what text is in the display:none .hidden-note element of that card?
6. HTML comment: what fare-rule token is in the HTML comment inside that card?
7. JavaScript runtime: what is window.flightProbe?
8. Browser storage: what is localStorage['flight-probe']?
9. Console: what is the argument of the flight-probe console message logged when the results page loads?
10. Network: what is the X-Flight-Probe response header of the /api/flights search request?
```

Compare with the Answer column above. The exercise does not test WebMCP discovery.

## WebMCP integration

Each tool has exactly one owner. Where things live:

| What                                                                                                                                        | Where                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Declarative tools: `toolname`, `tooldescription`, `toolautosubmit`, `toolparamdescription` on the forms                                     | `public/index.html` (`search_flights`), `public/results.html` (`filter_flights`, `sort_flights`) |
| Submit handling: `preventDefault`, `agentInvoked`, `respondWith`; same action for people and agents                                         | `onSubmit` in `public/pages/booking.js`                                                          |
| Imperative tools: explicit `{ name, description, inputSchema, execute }` objects and `document.modelContext.registerTool(tool, { signal })` | `public/pages/imperative-tools.js`                                                               |
| `expectedCall` fixtures (Evals `evals.json`)                                                                                                | `evals/evals.json`                                                                               |

References: [Declarative API](https://developer.chrome.com/docs/ai/webmcp/declarative-api), [Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [Evals](https://developer.chrome.com/docs/ai/webmcp/evals), [webmcp-evals README](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/webmcp-evals/README.md), [W3C draft (2 November 2026)](https://webmachinelearning.github.io/webmcp/). Chrome's declarative form attributes and the W3C `document.modelContext` draft are different documents of an experimental, evolving API, not a stable standard. This repo targets Chrome's implementation and does not use the older `navigator.modelContext`, `provideContext` or `unregisterTool`.

How it behaves:

- Declarative forms register a tool from the HTML. Select options become enums, `required` fields become required parameters and `toolautosubmit` submits without a click. The submit handler runs the same action as a click and, when `event.agentInvoked`, answers with `event.respondWith(...)`. If an agent fills values the form rejects, the form is restored to the booking state.
- Imperative tools use two lifetimes of `AbortController`: `get_flight_results` and `edit_search` live as long as the page; `clear_filters` and `select_flight` are aborted and re-registered after every state change (`select_flight`'s `flight_id` enum is the currently visible IDs). Every `execute` also rejects a call that arrives after its signal was aborted.
- Before navigating (selection, `edit_search`, search) imperative tools are aborted; declarative tools leave with the document. Pagehide aborts everything and back/forward-cache restores reload so tools register again.

### Evals

`evals/evals.json` follows the `webmcp-evals` 0.0.4 schema: cases with `messages` and `expectedCall`, where an entry is `{functionName, arguments}`, `optional: true` makes a call skippable, and `{ordered: [...]}` / `{unordered: [...]}` groups nest. Arguments reflect the schemas the browser derives from the forms (`max_stops` is the string `"1"`, `max_price` a number). Flight IDs come from the deterministic `demo` seed (the same flights for every route).

| Case                                  | What it checks                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Simple search                         | Tool and argument selection for `search_flights`                                                                                                                                                                                                                                                                                                             |
| Quickest flight with at most one stop | Nested **ordered → unordered → ordered**: `search_flights`; unordered `filter_flights(max_stops:"1")` + `sort_flights(duration, asc)`; ordered `get_flight_results` then `select_flight("DM404")`. Filter and sort commute, so either order is valid; reading results must come before selecting. DM404 is the first result only after both filter and sort. |
| No match, then recover                | A filter matching nothing, then `clear_filters` and `get_flight_results`; no selection (`select_flight` is not even registered with zero results)                                                                                                                                                                                                            |
| Inspection only                       | Search, sort, read; an extra `select_flight` fails the case                                                                                                                                                                                                                                                                                                  |
| Select, then change the search        | `search_flights`, `select_flight("DM101")` (cheapest), `edit_search` on the summary page, then `search_flights` for a new route                                                                                                                                                                                                                              |

Two different things are checked, and only the first runs without a model:

1. **Deterministic execution (no LLM, no API key).** `npm run evals:smoke` serves the demo and runs the official `webmcp-evals` smoke engine: a fresh page per case, then every required call in authored order through the browser's real tool registry (unordered groups run in authored order, `optional` calls are skipped). It proves the tools exist, accept these arguments and navigate correctly. It does not show that a model would choose these calls. Set `CHROME_PATH` to a Chrome with WebMCP, for example the Chrome 158 in the Puppeteer cache, or install Chrome Canary: `CHROME_PATH=~/.cache/puppeteer/chrome/linux-158.0.8127.2/chrome-linux64/chrome npm run evals:smoke`. The official CLI equivalent is `npx webmcp-evals smoke -u http://127.0.0.1:4173 -e evals/evals.json -v` with `npm start` running, but it can only launch an installed Chrome channel (`--chrome-channel`, default Canary).
2. **Does an agent choose the right calls? (needs a model and an API key, not run here).** `npm start`, put a provider key in `.env` as described in the [webmcp-evals README](https://github.com/GoogleChromeLabs/webmcp-tools/blob/main/webmcp-evals/README.md), then `npx webmcp-evals --model google:gemini-3.5-flash --runs 3 browser -u http://127.0.0.1:4173 -e evals/evals.json`. It uses the official matcher for ordered/unordered groups, arguments and unexpected calls.

`npm test` also feeds the fixture to the official parser and matcher (`webmcp-evals/dist/utils.js`): it accepts either filter/sort order and rejects wrong tools or arguments, missing required steps, select-before-read and extra calls such as a selection in the inspection case. It replays every case against the real booking state and the real imperative tool objects with a documented-contract double for `document.modelContext` (a test double, not a browser).

### Verified

On 2026-11-04 with Chrome for Testing 158.0.8127.2 started with `--enable-features=WebMCP`, `webmcp-evals` 0.0.4 and `puppeteer-core` 25.16.0:

- `document.modelContext` and the declarative forms register natively; `document.modelContext.getTools()` lists `search_flights` on `/`, `edit_search, filter_flights, get_flight_results, select_flight, sort_flights` on results (plus `clear_filters` with filters), and only `edit_search` on the summary.
- Native calls through the Evals registry and `executeTool` ran search, filter, sort, read, select, clear, edit_search, errors and navigations; `npm run evals:smoke` passed 17/17 steps in 5 cases (repeated on the final code).
- Not verified: other browsers or Chrome versions, Chrome's permission/consent UI, any LLM-driven run, the official CLI against an installed Canary channel, and `:tool-form-active` styling.

Tests (`npm test`) cover state, filters, sort, selection guards, persistence, invalid input, storage errors, the imperative registration lifecycle, the eval fixture matching and server responses. Other implementation pointers: `public/pages/booking.js` owns shared page actions/rendering, `booking-state.js` owns state, `public/shared/flights.js` generates seeded flights and holds the access-example values, and `scripts/server.mjs` serves `public/` plus the mock endpoint.
