import test from 'node:test';
import assert from 'node:assert/strict';
import { createBooking, pageAllowed, pageForState } from '../public/pages/booking-state.js';
import { bookingTools } from '../public/pages/booking-tools.js';
import { createToolRegistry } from '../public/shared/webmcp.js';
import { probes } from '../public/shared/flights.js';
import { createDemoServer } from '../scripts/server.mjs';
const names = (tools) => tools.map((t) => t.name).sort();
const search = { from: 'SFO', to: 'JFK', date: '2026-12-01' };
const seed = 'test';
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
test('results tools and selected flight persist in session', () => {
  const storage = memory();
  let booking = createBooking({ seed, storage });
  const tools = () => bookingTools(pageForState(booking.state), booking, {});
  assert.deepEqual(names(tools()), ['search_flights']);
  assert.deepEqual(bookingTools('results', booking, {}), []);
  assert.throws(() => booking.select({ flight_id: 'DM101' }));
  booking.search(search);
  booking = createBooking({ seed, storage });
  const resultsTools = ['filter_flights', 'get_flight_results', 'select_flight', 'sort_flights'];
  assert.equal(pageForState(booking.state), 'results');
  assert.equal(booking.state.flights.length, 6);
  assert.deepEqual(names(tools()), resultsTools);
  assert.throws(() => booking.select({ flight_id: 'missing' }));
  booking.select({ flight_id: 'DM101' });
  booking = createBooking({ seed, storage });
  assert.equal(pageForState(booking.state), 'results');
  assert.equal(booking.state.selected.id, 'DM101');
  assert.deepEqual(names(tools()), resultsTools);
  const before = storage.getItem('flight_booking');
  assert.equal(booking.getResults().length, 6);
  assert.equal(storage.getItem('flight_booking'), before);
  booking.filter({ max_price: 0 });
  assert.equal(booking.state.selected.id, 'DM101');
  booking.clearFilters();
  booking.select({ flight_id: 'DM202' });
  assert.equal(createBooking({ seed, storage }).state.selected.id, 'DM202');
});
test('search form stays reachable after results and selection; a new search resets them', () => {
  const storage = memory();
  let booking = createBooking({ seed, storage });
  booking.search(search);
  booking.filter({ max_price: 1000 });
  booking.sort({ by: 'duration', order: 'desc' });
  booking.select({ flight_id: booking.getResults()[0].id });
  // A fresh page load (reload or explicit visit to /) restores the persisted state.
  booking = createBooking({ seed, storage });
  assert.equal(booking.state.stage, 'results');
  assert.equal(pageAllowed('index', booking.state), true);
  assert.deepEqual(booking.state.search, search, 'previous search is available to prefill the form');
  assert.deepEqual(names(bookingTools('index', booking, {})), ['search_flights']);
  // Without a new search, results and summary remain reachable.
  assert.equal(pageAllowed('results', booking.state), true);
  assert.equal(pageAllowed('summary', booking.state), true);
  // Editing origin and destination goes through the normal search and shows the new route only.
  const edited = { from: 'LAX', to: 'SFO', date: '2026-12-05' };
  booking.search(edited);
  assert.equal(booking.state.stage, 'results');
  assert.deepEqual(booking.state.search, edited);
  assert.deepEqual(booking.state.filters, {});
  assert.deepEqual(booking.state.sort, { by: 'price', order: 'asc' });
  assert.equal(booking.state.selected, null);
  assert.equal(pageAllowed('summary', booking.state), false);
  assert.ok(booking.state.visibleFlights.every((f) => f.from === 'LAX' && f.to === 'SFO'));
  const reloaded = createBooking({ seed, storage });
  assert.deepEqual(reloaded.state.search, edited);
  assert.equal(reloaded.state.selected, null);
});
test('results and summary entry guards still require their state', () => {
  const booking = createBooking({ seed });
  assert.equal(pageAllowed('index', booking.state), true);
  assert.equal(pageAllowed('results', booking.state), false);
  assert.equal(pageAllowed('summary', booking.state), false);
  booking.search(search);
  assert.equal(pageAllowed('results', booking.state), true);
  assert.equal(pageAllowed('summary', booking.state), false);
  assert.deepEqual(bookingTools('summary', booking, {}), []);
});
test('filters and sorting control visible results and selection schemas', () => {
  const booking = createBooking({ seed });
  booking.search(search);
  const initial = booking.getResults();
  const prices = initial.map((f) => f.price);
  assert.equal(new Set(prices).size, 6);
  booking.filter({ max_price: prices[1] / 100 });
  assert.deepEqual(
    booking.getResults().map((f) => f.id),
    ['DM101', 'DM202'],
  );
  let tools = bookingTools('results', booking, {});
  assert.ok(names(tools).includes('clear_filters'));
  assert.deepEqual(tools.find((t) => t.name === 'select_flight').inputSchema.properties.flight_id.enum, [
    'DM101',
    'DM202',
  ]);
  assert.throws(() => booking.select({ flight_id: 'DM606' }));
  booking.sort({ by: 'price', order: 'desc' });
  assert.deepEqual(
    booking.getResults().map((f) => f.id),
    ['DM202', 'DM101'],
  );
  booking.filter({ time_of_day: 'morning', max_stops: 0 });
  assert.deepEqual(
    booking.getResults().map((f) => f.id),
    ['DM101'],
  );
  booking.filter({ max_price: 0 });
  assert.deepEqual(booking.getResults(), []);
  assert.ok(!names(bookingTools('results', booking, {})).includes('select_flight'));
  booking.clearFilters();
  assert.equal(booking.getResults().length, 6);
  assert.ok(!names(bookingTools('results', booking, {})).includes('clear_filters'));
  for (const by of ['departure', 'duration']) {
    booking.sort({ by, order: 'asc' });
    const field = by === 'departure' ? 'time' : by;
    const sorted = booking.getResults().map((f) => f[field]);
    assert.deepEqual(
      sorted,
      [...sorted].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  assert.throws(() => booking.filter({ max_price: -1 }));
  assert.throws(() => booking.filter({ time_of_day: 'night' }));
  assert.throws(() => booking.sort({ by: 'other', order: 'asc' }));
});
test('seed changes and malformed sessions reset; invalid inputs and storage failures do not advance', () => {
  const storage = memory();
  const booking = createBooking({ seed, storage });
  assert.throws(() => booking.search({ ...search, to: 'SFO' }));
  assert.throws(() => booking.search({ ...search, date: '2026-02-30' }));
  booking.search(search);
  assert.equal(createBooking({ seed: 'other', storage }).state.stage, 'search');
  storage.setItem('flight_booking', '{');
  assert.equal(createBooking({ seed, storage }).state.stage, 'search');
  const blocked = createBooking({
    seed,
    storage: {
      getItem() {
        return null;
      },
      setItem() {
        throw new Error('blocked');
      },
    },
  });
  assert.throws(() => blocked.search(search), /blocked/);
  assert.equal(blocked.state.stage, 'search');
});
test('adapter replaces modern registrations, rejects stale calls, and cleans up on pagehide', async () => {
  const registered = new Map();
  const view = new EventTarget();
  const currentDocument = {
    defaultView: view,
    modelContext: {
      async registerTool(tool, { signal }) {
        assert.equal(registered.has(tool.name), false);
        registered.set(tool.name, tool);
        signal.addEventListener('abort', () => registered.delete(tool.name));
      },
    },
  };
  const registry = createToolRegistry({ currentDocument, currentNavigator: {} });
  await registry.replace([{ name: 'first', execute: () => 'one' }]);
  const stale = registered.get('first');
  await registry.replace([{ name: 'second', execute: () => 'two' }]);
  assert.deepEqual([...registered.keys()], ['second']);
  await assert.rejects(() => stale.execute({}), /stale/);
  assert.equal(await registered.get('second').execute({}), 'two');
  view.dispatchEvent(new Event('pagehide'));
  assert.equal(registered.size, 0);
});
test('legacy provideContext replaces the complete tool list', async () => {
  let tools = [];
  const view = new EventTarget();
  const registry = createToolRegistry({
    currentDocument: { defaultView: view },
    currentNavigator: {
      modelContext: {
        provideContext(context) {
          tools = context.tools;
        },
      },
    },
  });
  await registry.replace([{ name: 'first', execute: () => true }]);
  await registry.replace([{ name: 'second', execute: () => true }]);
  assert.deepEqual(names(tools), ['second']);
  view.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(tools, []);
});
test('server serves three pages and seeded mock JSON, rejects invalid searches, and marks searches with the network probe header', async (t) => {
  const server = createDemoServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/results.html', '/summary.html', '/pages/booking.js'])
    assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/checkout.html', '/unknown.html', '/missing-seeded.json'])
    assert.equal((await fetch(base + path)).status, 404);
  const url = base + '/api/flights?' + new URLSearchParams({ ...search, seed });
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get(probes.networkHeader), probes.network);
  const data = await response.json();
  assert.deepEqual(data.search, search);
  assert.equal(data.flights.length, 6);
  assert.deepEqual(await (await fetch(url)).json(), data);
  assert.notDeepEqual((await (await fetch(url + '2')).json()).flights, data.flights);
  assert.equal((await fetch(base + '/api/flights?from=bad')).status, 400);
  assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
  assert.equal((await fetch(base + '/%FF')).status, 400);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});
