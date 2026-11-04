# Demo flights

A small flight-booking website for comparing computer use, accessibility inspection, DOM access, page JavaScript and WebMCP. Plain HTML, CSS and ES modules; no dependencies, build, drivers, API keys or external services.

With **Node 22+**, run `npm start` and open http://127.0.0.1:4173. No install is needed. `PORT` changes the port; the server binds IPv4 loopback only. `npm test` runs six behavior tests. No ticket or payment is real.

## Formatting

Run `npm install` once to get Prettier. In VS Code, install the recommended **Prettier - Code formatter** extension (`esbenp.prettier-vscode`, suggested by `.vscode/extensions.json`); `.vscode/settings.json` makes it the default formatter and formats supported files when you save. From the terminal, `npm run format` rewrites files and `npm run format:check` verifies them without changes. Options live in `.prettierrc.json`; ignores in `.prettierignore`.

## Pages and tools

| Page                 | UI and valid WebMCP tools                                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/` or `/index.html` | Search route/date, UI-only swap icon. `search_flights(from,to,date)`                                                                                                                                                                                                                                                        |
| `/summary.html`      | Selected flight details and a link back to results.                                                                                                                                                                                                                                                                         |
| `/results.html`      | Six fictional flights, filters and sorting. `filter_flights(max_price?,time_of_day?,max_stops?)`, `sort_flights(by,order)`, `get_flight_results()`. `clear_filters()` only with active filters; `select_flight(flight_id)` only with visible results, with those IDs as its enum. Selection navigates to the flight summary |

Filters replace the previous filters; omitted fields are cleared. Maximum price is in USD dollars, departure periods are morning (before 12), afternoon (12–17), evening (18 onward), and maximum stops is 0–2. Sort fields are `price`, `departure`, `duration`; order is `asc` or `desc`. Zero matches removes the selection tool. Read tools do not mutate booking state.

UI and tools share action functions. Booking state persists across pages/reloads in `sessionStorage.flight_booking`, scoped to the seed. The search form at `/` is always reachable and prefilled from the previous search; a new search resets filters and selection. Direct visits to results or summary without the required state redirect to the valid step. A different seed starts a fresh booking. Session storage is required for navigation; an unavailable or unwritable session store reports an error instead of navigating. The localStorage draft is an optional inspection copy, not a recovery source. There is no cross-tab synchronization.

Tools are not listed on the page. Registration is replaced on state changes; old callbacks reject as stale, pagehide removes registrations, and back/forward cache restores reload. Unsupported APIs are a silent no-op and ordinary controls still work.

## Layers inside the flow

Based on the supplied DOM Probe reference. `?seed=example` deterministically generates flight values, default route/date, tokens and selection code; user edits to search fields remain ordinary inputs. `seed` and `key` survive page navigation. `?key=1` renders a table of planted values, their layers and locations, including the runtime/storage snapshots. Otherwise the answer table has no contents. This is an exposure test, not a secrets system.

| Layer                  | Planted values and page/element                                                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visible text           | Search route/date fields; results `#route`, flight cards and flight summary: flight ID, route, date, departure time, duration, stops, price and seat count. Summary `#selection-code` after selection |
| Accessibility          | Index `#swap`: icon-only button named by aria-label. Results select buttons: aria-label includes flight ID and price. Every page `#message`: aria-live status after actions and step arrivals         |
| DOM attributes/classes | Results cards and summary card: `data-flight-id`, `data-fare-class`, `data-seats-left`, seeded `flight-*` class                                                                                       |
| Computed style         | Cheapest flight's `.cheapest` card: seeded `::after` fare cue via a CSS custom property. The cue is absent from DOM text (except an explicitly requested answer key)                                  |
| Hidden DOM / comments  | Each results flight card: `.baggage-fee` text has `display:none`; HTML comment contains a seeded fare-rule token                                                                                      |
| Page JavaScript        | Every page: `window.__BOOKING_STATE__` snapshot refreshed after mutations                                                                                                                             |
| Storage                | Every page: seeded `localStorage` key `flight-draft-*` with the current snapshot; sessionStorage holds navigation state after the first action                                                        |
| Console                | Each step arrival and action logs the seeded `booking-{page}-*` token with its status                                                                                                                 |
| Network                | Search fetches `/api/flights?from=…&to=…&date=…&seed=…`; the local server returns seeded JSON. Results deliberately requests `/missing-*.json` and receives 404                                       |

Flight-card cues and all other styling can also be inspected in the DOM/CSS. Hidden baggage text is excluded from the accessibility tree. The expected results 404 may appear as a console resource error.

## WebMCP API and verification

Verified on 2026-11-04 against the [2 November 2026 draft](https://webmachinelearning.github.io/webmcp/): `document.modelContext.registerTool(tool,{signal})` with `name`, `description`, `inputSchema`, `execute`, and abort-based removal. That draft does not define `provideContext` or `unregisterTool`. The adapter also supports the [older navigator proposal](https://webmachinelearning.github.io/webmcp/docs/proposal.html): `navigator.modelContext.registerTool`/`unregisterTool`, or `provideContext({tools})` replacement. It prefers the document API; no fake native API or polyfill is installed. These remain evolving drafts.

Tests cover page/state tool sets, session persistence, filters, sort, selection guards and persistence, invalid input, storage errors, adapter cleanup and server responses. Browser verification covers search, selection, summary reload, return navigation, seeded styling cues and narrow layouts. External browser-agent invocation and permission mediation are not verified. The legacy API is tested with boundary mocks, not a legacy browser.

Implementation pointers: `public/pages/booking.js` owns shared page actions/rendering, `booking-state.js` owns state, `booking-tools.js` declares tools by page/state, `public/shared/flights.js` generates seeded data, and `scripts/server.mjs` serves `public/` plus the mock endpoint.
