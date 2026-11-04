import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateExecutionTrajectory,
  isFunctionCall,
  isOrderedGroup,
  isUnorderedGroup,
} from 'webmcp-evals/dist/utils.js';
import { compileSmokeTests } from 'webmcp-evals/dist/evaluator/smokeEvaluator.js';
import { createBooking, filtersFromFields } from '../public/pages/booking-state.js';
import { createImperativeTools } from '../public/pages/imperative-tools.js';

const cases = JSON.parse(readFileSync(new URL('../evals/evals.json', import.meta.url), 'utf8'));
const byName = (fragment) => {
  const found = cases.filter((c) => c.name.includes(fragment));
  assert.equal(found.length, 1, `exactly one case matches "${fragment}"`);
  return found[0];
};
// The official matcher from webmcp-evals decides pass or fail; calls are { functionName, args }.
const passes = (evalCase, calls) =>
  evaluateExecutionTrajectory(
    evalCase.expectedCall,
    calls.map(([functionName, args = {}]) => ({ functionName, args })),
  ).every((row) => row.outcome === 'pass');
const flatten = (nodes) =>
  nodes.flatMap((node) =>
    isOrderedGroup(node) ? flatten(node.ordered) : isUnorderedGroup(node) ? flatten(node.unordered) : [node],
  );

test('the fixture compiles with the official smoke parser', () => {
  const compiled = compileSmokeTests(cases);
  assert.equal(compiled.length, cases.length);
  assert.ok(cases.length >= 4 && cases.length <= 6);
  for (const evalCase of cases) {
    assert.equal(evalCase.messages[0].role, 'user');
    assert.ok(evalCase.messages[0].content.length > 40, 'readable user message');
    for (const call of flatten(evalCase.expectedCall)) assert.ok(isFunctionCall(call));
  }
});

// Replays every case against the real booking state and the real imperative tool objects.
// The page model is: search form -> results -> summary, with edit_search leading back to the search form.
// Declarative tools exist while their form is on the page; imperative ones come from the tool objects
// (with a documented-contract double for document.modelContext, not a browser).
async function replay(evalCase) {
  const booking = createBooking({ seed: 'demo', storage: { getItem: () => null, setItem() {} } });
  let page = 'index';
  let tools;
  const registered = new Map();
  const modelContext = {
    async registerTool(tool, { signal }) {
      registered.set(tool.name, tool);
      signal.addEventListener('abort', () => registered.delete(tool.name));
    },
  };
  const arrive = async (next) => {
    tools?.suspend();
    page = next;
    const actions = {
      getResults: () => booking.state.visibleFlights,
      clearFilters: () => booking.clearFilters(),
      select: (input) => (booking.select(input), (page = 'summary'), 'selected'),
      editSearch: () => (arrive('index'), 'opened'),
    };
    tools = createImperativeTools({ page, booking, actions, modelContext, view: new EventTarget() });
    tools.mount();
    tools.sync();
    await tools.settled();
  };
  await arrive('index');
  const visited = [];
  for (const call of flatten(evalCase.expectedCall)) {
    const { functionName, arguments: args = {} } = call;
    if (call.optional) continue;
    visited.push(functionName);
    if (functionName === 'search_flights') {
      assert.equal(page, 'index', 'search_flights lives on the search page');
      booking.search(args);
      await arrive('results');
    } else if (functionName === 'filter_flights') {
      assert.equal(page, 'results');
      booking.filter({ ...booking.state.filters, ...filtersFromFields(args) });
      tools.sync();
      await tools.settled();
    } else if (functionName === 'sort_flights') {
      assert.equal(page, 'results');
      booking.sort(args);
    } else {
      const tool = registered.get(functionName);
      assert.ok(tool, `${functionName} is registered on the ${page} page`);
      for (const key of tool.inputSchema.required ?? []) assert.ok(key in args, `${functionName} needs ${key}`);
      for (const [key, value] of Object.entries(args)) {
        const allowed = tool.inputSchema.properties[key]?.enum;
        if (allowed) assert.ok(allowed.includes(value), `${functionName}.${key}=${value} is allowed here`);
      }
      await tool.execute(args);
      if (functionName === 'select_flight') await arrive('summary');
      else if (functionName === 'clear_filters') {
        tools.sync();
        await tools.settled();
      }
    }
  }
  return { booking, page, visited, registered };
}

test('every fixture case is executable against the app in authored order', async () => {
  for (const evalCase of cases) {
    const { visited } = await replay(evalCase);
    assert.ok(visited.length >= 1, evalCase.name);
  }
});

test('selected flight IDs are derived from the deterministic dataset, not from the prompt', async () => {
  const quickest = byName('Quickest');
  const prompt = quickest.messages[0].content;
  const selectId = flatten(quickest.expectedCall).find((c) => c.functionName === 'select_flight').arguments.flight_id;
  assert.ok(!prompt.includes(selectId), 'the ID is not given in the user message');
  const { booking } = await replay({ expectedCall: quickest.expectedCall.slice(0, 2) });
  // After filter + sort the top of the list is the answer; the filter alone would lead to another flight.
  assert.equal(booking.state.visibleFlights[0].id, selectId);
  const filterOnly = createBooking({ seed: 'demo', storage: { getItem: () => null, setItem() {} } });
  filterOnly.search(booking.state.search);
  filterOnly.filter({ max_stops: 1 });
  assert.notEqual(filterOnly.state.visibleFlights[0].id, selectId, 'sorting matters for the right answer');
  assert.equal(
    booking.state.visibleFlights.at(0).duration,
    Math.min(...booking.state.visibleFlights.map((f) => f.duration)),
  );

  const journey = byName('change the search');
  const cheapestId = flatten(journey.expectedCall).find((c) => c.functionName === 'select_flight').arguments.flight_id;
  const flights = createBooking({ seed: 'demo' });
  flights.search({ from: 'SFO', to: 'JFK', date: '2026-12-12' });
  assert.equal([...flights.state.flights].sort((a, b) => a.price - b.price)[0].id, cheapestId);

  const empty = byName('No match');
  const { booking: recovered, visited } = await replay({ expectedCall: empty.expectedCall.slice(0, 2) });
  assert.deepEqual(recovered.state.visibleFlights, [], 'the filter in the zero-results case really matches nothing');
  assert.deepEqual(visited, ['search_flights', 'filter_flights']);
});

test('nested case accepts filter and sort in either order, then get before select', () => {
  const nested = byName('Quickest');
  const search = ['search_flights', { from: 'SFO', to: 'JFK', date: '2026-12-12' }];
  const filter = ['filter_flights', { max_stops: '1' }];
  const sort = ['sort_flights', { by: 'duration', order: 'asc' }];
  const get = ['get_flight_results'];
  const select = ['select_flight', { flight_id: 'DM404' }];
  assert.ok(passes(nested, [search, filter, sort, get, select]));
  assert.ok(passes(nested, [search, sort, filter, get, select]), 'sort before filter is valid');
  // Wrong arguments or tools.
  assert.ok(!passes(nested, [search, ['filter_flights', { max_stops: '2' }], sort, get, select]));
  assert.ok(!passes(nested, [search, filter, ['sort_flights', { by: 'price', order: 'asc' }], get, select]));
  assert.ok(!passes(nested, [search, filter, sort, get, ['select_flight', { flight_id: 'DM101' }]]));
  assert.ok(!passes(nested, [search, filter, ['clear_filters'], get, select]));
  // Missing required steps.
  assert.ok(!passes(nested, [search, filter, get, select]));
  assert.ok(!passes(nested, [search, filter, sort, select]));
  assert.ok(!passes(nested, [search, filter, sort, get]));
  // Dependency order: select before get, results read before the unordered group, or search last.
  assert.ok(!passes(nested, [search, filter, sort, select, get]));
  assert.ok(!passes(nested, [search, get, filter, sort, select]));
  assert.ok(!passes(nested, [filter, sort, search, get, select]));
  // Unexpected extra calls fail too.
  assert.ok(!passes(nested, [search, filter, sort, get, select, ['edit_search']]));
});

test('other cases enforce required steps, optional steps and no-selection intent', () => {
  const route = { from: 'SFO', to: 'JFK', date: '2026-12-12' };
  const search = ['search_flights', route];
  const recover = byName('No match');
  const nothing = ['filter_flights', { time_of_day: 'evening', max_stops: '0' }];
  assert.ok(passes(recover, [search, nothing, ['clear_filters'], ['get_flight_results']]));
  assert.ok(passes(recover, [search, nothing, ['get_flight_results'], ['clear_filters'], ['get_flight_results']]));
  assert.ok(!passes(recover, [search, nothing, ['get_flight_results']]), 'clear_filters is required');
  assert.ok(
    !passes(recover, [
      search,
      nothing,
      ['clear_filters'],
      ['get_flight_results'],
      ['select_flight', { flight_id: 'DM101' }],
    ]),
    'no selection is expected',
  );

  const browse = byName('Inspection');
  const sort = ['sort_flights', { by: 'departure', order: 'asc' }];
  assert.ok(passes(browse, [search, sort, ['get_flight_results']]));
  assert.ok(!passes(browse, [search, sort, ['get_flight_results'], ['select_flight', { flight_id: 'DM101' }]]));
  assert.ok(!passes(browse, [search, ['sort_flights', { by: 'departure', order: 'desc' }], ['get_flight_results']]));

  const journey = byName('change the search');
  const newSearch = ['search_flights', { from: 'LAX', to: 'SFO', date: '2026-12-19' }];
  const pick = ['select_flight', { flight_id: 'DM101' }];
  assert.ok(passes(journey, [search, pick, ['edit_search'], newSearch]));
  assert.ok(passes(journey, [search, ['get_flight_results'], pick, ['edit_search'], newSearch]));
  assert.ok(!passes(journey, [search, pick, newSearch]), 'edit_search is required to reach the form');
  assert.ok(!passes(journey, [search, pick, ['edit_search']]), 'the new search is required');
  assert.ok(!passes(journey, [search, pick, ['edit_search'], ['search_flights', { ...route, date: '2026-12-19' }]]));

  const simple = byName('Simple search');
  assert.ok(passes(simple, [['search_flights', { from: 'LAX', to: 'SFO', date: '2026-12-05' }]]));
  assert.ok(!passes(simple, [['search_flights', { from: 'SFO', to: 'LAX', date: '2026-12-05' }]]));
  assert.ok(!passes(simple, [['filter_flights', { max_stops: '0' }]]));
});
