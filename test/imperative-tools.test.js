import test from 'node:test';
import assert from 'node:assert/strict';
import { createBooking } from '../public/pages/booking-state.js';
import { createImperativeTools } from '../public/pages/imperative-tools.js';

// TEST DOUBLE, not native WebMCP: a stand-in for document.modelContext that follows the documented
// registerTool(tool, { signal }) contract (duplicate names reject, abort unregisters). Native
// behavior is checked by `npm run evals:smoke` and the live-browser notes in the README.
function fakeModelContext() {
  const registered = new Map();
  let registrations = 0;
  return {
    registered,
    get registrations() {
      return registrations;
    },
    async registerTool(tool, { signal }) {
      if (registered.has(tool.name)) throw new Error(`duplicate tool ${tool.name}`);
      registered.set(tool.name, tool);
      registrations++;
      signal.addEventListener('abort', () => registered.delete(tool.name));
    },
  };
}
const names = (context) => [...context.registered.keys()].sort();
const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) };
};
function setup(page, prepare = (booking) => booking.search({ from: 'SFO', to: 'JFK', date: '2026-12-12' })) {
  const booking = createBooking({ seed: 'demo', storage: memory() });
  prepare(booking);
  const calls = [];
  const actions = {
    getResults: () => (calls.push('getResults'), booking.state.visibleFlights.map((f) => f.id)),
    clearFilters: () => (calls.push('clearFilters'), booking.clearFilters()),
    select: (input) => (calls.push(['select', input]), booking.select(input)),
    editSearch: () => (calls.push('editSearch'), 'opened'),
  };
  const context = fakeModelContext();
  const view = new EventTarget();
  const tools = createImperativeTools({ page, booking, actions, modelContext: context, view });
  return { booking, calls, context, view, tools, start: async () => (tools.mount(), tools.sync(), tools.settled()) };
}

test('results page registers explicit tool objects; filters and selection follow state', async () => {
  const { booking, context, tools, start } = setup('results');
  await start();
  assert.deepEqual(names(context), ['edit_search', 'get_flight_results', 'select_flight']);
  for (const tool of context.registered.values()) {
    assert.equal(typeof tool.name, 'string');
    assert.ok(tool.description.length > 20);
    assert.equal(tool.inputSchema.type, 'object');
    assert.equal(typeof tool.execute, 'function');
  }
  assert.equal(context.registered.get('get_flight_results').annotations.readOnlyHint, true);
  const select = context.registered.get('select_flight');
  assert.deepEqual(select.inputSchema.properties.flight_id.enum, [
    'DM101',
    'DM202',
    'DM303',
    'DM404',
    'DM505',
    'DM606',
  ]);
  assert.deepEqual(select.inputSchema.required, ['flight_id']);
  const staticRegistrations = context.registrations;

  booking.filter({ max_stops: 0 });
  tools.sync();
  await tools.settled();
  assert.deepEqual(names(context), ['clear_filters', 'edit_search', 'get_flight_results', 'select_flight']);
  assert.deepEqual(context.registered.get('select_flight').inputSchema.properties.flight_id.enum, ['DM101', 'DM404']);
  assert.equal(context.registrations - staticRegistrations, 2, 'page tools are not registered again');

  booking.filter({ time_of_day: 'evening', max_stops: 0 });
  tools.sync();
  await tools.settled();
  assert.deepEqual(names(context), ['clear_filters', 'edit_search', 'get_flight_results']);

  booking.clearFilters();
  tools.sync();
  await tools.settled();
  assert.deepEqual(names(context), ['edit_search', 'get_flight_results', 'select_flight']);
});

test('a tool object obtained before a state change rejects once it is stale', async () => {
  const { booking, calls, context, tools, start } = setup('results');
  await start();
  const staleSelect = context.registered.get('select_flight');
  assert.equal((await staleSelect.execute({ flight_id: 'DM606' })).selected.id, 'DM606');
  booking.filter({ max_stops: 0 });
  tools.sync();
  await tools.settled();
  calls.length = 0;
  assert.match((await staleSelect.execute({ flight_id: 'DM202' })).content[0].text, /no longer available/);
  assert.deepEqual(calls, [], 'stale call does not reach the shared action');
  const freshSelect = context.registered.get('select_flight');
  const hidden = await freshSelect.execute({ flight_id: 'DM202' });
  assert.equal(hidden.isError, true);
  assert.match(hidden.content[0].text, /visible results/, 'the real validation error is reported');
  assert.equal((await freshSelect.execute({ flight_id: 'DM404' })).selected.id, 'DM404');
  assert.deepEqual(
    calls.map((c) => c[0]),
    ['select', 'select'],
  );
});

test('summary page offers only edit_search and the search page registers no imperative tools', async () => {
  const summary = setup('summary', (booking) => {
    booking.search({ from: 'SFO', to: 'JFK', date: '2026-12-12' });
    booking.select({ flight_id: 'DM101' });
  });
  await summary.start();
  assert.deepEqual(names(summary.context), ['edit_search']);
  assert.equal(await summary.context.registered.get('edit_search').execute({}), 'opened');
  assert.deepEqual(summary.calls, ['editSearch']);
  const index = setup('index', () => {});
  await index.start();
  assert.deepEqual(names(index.context), []);
});

test('suspend and pagehide unregister every tool and make old objects stale', async () => {
  for (const leave of [(s) => s.tools.suspend(), (s) => s.view.dispatchEvent(new Event('pagehide'))]) {
    const state = setup('results');
    await state.start();
    const edit = state.context.registered.get('edit_search');
    leave(state);
    assert.deepEqual(names(state.context), []);
    const stale = await edit.execute({});
    assert.equal(stale.isError, true);
    assert.match(stale.content[0].text, /no longer available/);
    state.tools.sync();
    await state.tools.settled();
    assert.deepEqual(names(state.context), [], 'nothing registers after the page is left');
  }
});

test('without document.modelContext nothing registers and nothing is faked', async () => {
  const booking = createBooking({ seed: 'demo', storage: memory() });
  booking.search({ from: 'SFO', to: 'JFK', date: '2026-12-12' });
  const tools = createImperativeTools({
    page: 'results',
    booking,
    actions: {},
    modelContext: null,
    view: new EventTarget(),
  });
  tools.mount();
  tools.sync();
  await tools.settled();
});
