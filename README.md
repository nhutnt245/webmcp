# Browser reach lab

A basic local website for comparing computer use, browser inspection and WebMCP. No drivers, framework, build, API keys or external services.

Run with **Node 22+**: `npm start`, then open http://127.0.0.1:4173. No install is necessary (there are no dependencies). Set `PORT` to change the port; the server always binds IPv4 loopback. `npm test` runs six light behavior tests.

## Pages

- `/` or `/index.html`: seeded exposure probes.
- `/booking.html`: search fictional flights, select one, enter one passenger, review and confirm. State lasts for the page visit; start over resets it. Any valid calendar date is accepted.
- `/shop.html`: browse three products, add/remove cart lines and check out with a demo recipient/address. Only the cart persists in `localStorage.demo_cart`; receipts last for the page visit. Storage failures fall back to memory. No cross-tab synchronization.

Use made-up passenger and delivery details. Nothing is purchased or booked.

## Probes

Based on the supplied DOM Probe reference. `?seed=example` deterministically changes values (default: `demo`). Add `&key=1` to render the answer table, absent from the DOM otherwise. Navigation preserves these query parameters. The key is a tester convenience, not a security boundary; generation code and runtime are inspectable.

| Exposure | Location / action |
| --- | --- |
| Visible text | Order reference (`#reference`) |
| Accessibility name only on screen | Icon button `#dismiss`, named by `aria-label` |
| DOM attributes | `#swatch[data-batch]`, `flag-*` class, inline background colour |
| DOM comment | Comment appended to body |
| Hidden DOM text | `#hidden-probe`, `display:none` |
| Runtime | `window.__APP_STATE__.build` |
| Browser storage | `localStorage.probe_key` (storage status shown) |
| Console | Run probe logs `probe-console T…` |
| Network | Run probe requests `/ping-T….json`; server intentionally returns 404 |

Colour is visually observable; its exact hex value is available from inline style. Hidden text is excluded from the accessibility tree. The answer key reveals every value only when explicitly requested. The expected 404 may appear as a console resource error; it is the deliberate network probe.

## WebMCP tool lifecycle

| Page / state | Tools |
| --- | --- |
| Probe | `run_probe` |
| Booking: initial | `search_flights`, `reset_booking` |
| Booking: results | Above plus `select_flight` (current flight IDs) |
| Booking: selected | `set_passenger`, `reset_booking` |
| Booking: reviewed | `confirm_booking`, `reset_booking` |
| Booking: confirmed | `reset_booking` |
| Shop: empty | `add_to_cart` |
| Shop: nonempty | `add_to_cart`, `remove_from_cart` (current product IDs), `checkout` |

Ordinary controls and tools call the same state methods. Actions validate state and inputs at execution time. Registration is replaced after each state change, old callbacks reject as stale, and pagehide clears registrations. A page restored from the back/forward cache reloads to register fresh tools.

Verified on 2026-11-04 against the [2 November 2026 draft](https://webmachinelearning.github.io/webmcp/): `document.modelContext.registerTool(tool, {signal})`, tool `name`, `description`, `inputSchema`, `execute`, and abort-based removal. The current draft does **not** define `provideContext` or `unregisterTool`. The adapter also supports the [older navigator proposal](https://webmachinelearning.github.io/webmcp/docs/proposal.html): `navigator.modelContext.registerTool`/`unregisterTool`, or `provideContext({tools})` replacement. It prefers the current document API when present. These are evolving draft APIs, not a stable standard.

Tools are available only through the browser API and are not displayed on the page. Without a supported API, registration is a graceful no-op; ordinary controls still work. No polyfill or fake browser API is installed. Browser-agent permission mediation and external agent invocation need a compatible WebMCP browser/client and are not covered by the local tests.

Implementation: `public/shared/` owns layout, probes and the adapter; `public/pages/` separates page logic, state and tool declarations; `scripts/server.mjs` serves only `public/` and intentionally missing probes return 404.

## Verification

`npm test` passes six behavior tests for booking/shopping transitions, guards, persistence, adapter lifecycle and HTTP responses. A throwaway Playwright script (not part of this repo) also checked the real pages in cached Chromium 156 with `--enable-features=WebMCP`: native `document.modelContext.getTools()` matched every state, and native `executeTool()` completed booking and shopping as did the ordinary controls. It verified seeded probes, key visibility, console output, intentional 404s, cart reload persistence, navigation cleanup, ordinary controls without API support, and no horizontal overflow at 375px. No unexpected console errors or page exceptions occurred. This verifies in-page native discovery and invocation; it does not verify an external browser agent or permission UI. The older navigator API is covered by a boundary-mock test, not a real legacy browser.
