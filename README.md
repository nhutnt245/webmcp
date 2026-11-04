# Demo flights

A small flight-booking website for comparing how browser agents reach computer-use, accessibility, DOM, page JavaScript, storage, console and network layers, with a WebMCP integration. Plain HTML, CSS and ES modules; no dependencies, build, drivers, API keys or external services.

With **Node 22+**, run `npm start` and open http://127.0.0.1:4173. No install is needed. `PORT` changes the port; the server binds IPv4 loopback only. `npm test` runs the behavior tests. No ticket or payment is real.

## Formatting

Run `npm install` once to get Prettier. In VS Code, install the recommended **Prettier - Code formatter** extension (`esbenp.prettier-vscode`, suggested by `.vscode/extensions.json`); `.vscode/settings.json` makes it the default formatter and formats supported files when you save. From the terminal, `npm run format` rewrites files and `npm run format:check` verifies them without changes. Options live in `.prettierrc.json`; ignores in `.prettierignore`.

## Pages and tools

| Page                 | UI and valid WebMCP tools                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` or `/index.html` | Search route/date, UI-only swap icon. `search_flights(from,to,date)`                                                                                                                                                                                                                                                        |
| `/summary.html`      | Selected flight details and a link back to results.                                                                                                                                                                                                                                                                         |
| `/results.html`      | Six fictional flights, filters and sorting. `filter_flights(max_price?,time_of_day?,max_stops?)`, `sort_flights(by,order)`, `get_flight_results()`. `clear_filters()` only with active filters; `select_flight(flight_id)` only with visible results, with those IDs as its enum. Selection navigates to the flight summary |

Filters replace the previous filters; omitted fields are cleared. Maximum price is in USD dollars, departure periods are morning (before 12), afternoon (12–17), evening (18 onward), and maximum stops is 0–2. Sort fields are `price`, `departure`, `duration`; order is `asc` or `desc`. Zero matches removes the selection tool. Read tools do not mutate booking state.

UI and tools share action functions. Booking state persists across pages/reloads in `sessionStorage.flight_booking`, scoped to the seed. The search form at `/` is always reachable and prefilled from the previous search; a new search resets filters and selection. Direct visits to results or summary without the required state redirect to the valid step. A different seed starts a fresh booking. Session storage is required for navigation; an unavailable or unwritable session store reports an error instead of navigating. There is no cross-tab synchronization.

Tools are not listed on the page. Registration is replaced on state changes; old callbacks reject as stale, pagehide removes registrations, and back/forward cache restores reload. Unsupported APIs are a silent no-op and ordinary controls still work.

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

## WebMCP API and verification

Verified on 2026-11-04 against the [2 November 2026 draft](https://webmachinelearning.github.io/webmcp/): `document.modelContext.registerTool(tool,{signal})` with `name`, `description`, `inputSchema`, `execute`, and abort-based removal. That draft does not define `provideContext` or `unregisterTool`. The adapter also supports the [older navigator proposal](https://webmachinelearning.github.io/webmcp/docs/proposal.html): `navigator.modelContext.registerTool`/`unregisterTool`, or `provideContext({tools})` replacement. It prefers the document API; no fake native API or polyfill is installed. These remain evolving drafts.

Tests cover page/state tool sets, session persistence, filters, sort, selection guards and persistence, invalid input, storage errors, adapter cleanup and server responses. Browser verification covers search, selection, summary reload, return navigation, the access examples and narrow layouts. External browser-agent invocation and permission mediation are not verified. The legacy API is tested with boundary mocks, not a legacy browser.

Implementation pointers: `public/pages/booking.js` owns shared page actions/rendering, `booking-state.js` owns state, `booking-tools.js` declares tools by page/state, `public/shared/flights.js` generates seeded flights and holds the access-example values, and `scripts/server.mjs` serves `public/` plus the mock endpoint.
