import { airports, flightsFor, validateSearch } from '../shared/flights.js';
export { airports };
const timeOfDay = (flight) =>
  Number(flight.time.slice(0, 2)) < 12 ? 'morning' : Number(flight.time.slice(0, 2)) < 18 ? 'afternoon' : 'evening';
function validateFilters(input) {
  const filters = {};
  if (input.max_price !== undefined) {
    if (typeof input.max_price !== 'number' || !Number.isFinite(input.max_price) || input.max_price < 0)
      throw new Error('Enter a nonnegative maximum price in dollars.');
    filters.max_price = input.max_price;
  }
  if (input.time_of_day !== undefined) {
    if (!['morning', 'afternoon', 'evening'].includes(input.time_of_day))
      throw new Error('Choose a listed departure period.');
    filters.time_of_day = input.time_of_day;
  }
  if (input.max_stops !== undefined) {
    if (!Number.isInteger(input.max_stops) || input.max_stops < 0 || input.max_stops > 2)
      throw new Error('Choose zero, one or two stops.');
    filters.max_stops = input.max_stops;
  }
  return filters;
}
function validateSort({ by, order }) {
  if (!['price', 'departure', 'duration'].includes(by) || !['asc', 'desc'].includes(order))
    throw new Error('Choose a listed sort and order.');
  return { by, order };
}
export function createBooking({ seed = 'demo', storage } = {}) {
  const initial = () => ({
    seed,
    stage: 'search',
    search: null,
    selectedId: null,
    filters: {},
    sort: { by: 'price', order: 'asc' },
  });
  let state = initial();
  try {
    const saved = JSON.parse(storage?.getItem('flight_booking') || 'null');
    if (saved?.seed === seed && saved.stage === 'results') {
      const search = validateSearch(saved.search);
      const filters = validateFilters(saved.filters);
      const sort = validateSort(saved.sort);
      if (saved.selectedId !== null && !flightsFor(seed, search).some((f) => f.id === saved.selectedId))
        throw new Error('Invalid flight');
      state = { ...initial(), search, filters, sort, stage: 'results', selectedId: saved.selectedId };
    }
  } catch {
    state = initial();
  }
  function save(next) {
    // Navigation requires session persistence; report failure before mutating state.
    storage?.setItem('flight_booking', JSON.stringify(next));
    state = next;
    return api.state;
  }
  function requireStage(stage) {
    if (state.stage !== stage) throw new Error(`Complete the ${stage} step first.`);
  }
  const api = {
    get state() {
      const flights = state.search ? flightsFor(seed, state.search) : [];
      const visibleFlights = flights.filter(
        (f) =>
          (state.filters.max_price === undefined || f.price / 100 <= state.filters.max_price) &&
          (state.filters.time_of_day === undefined || timeOfDay(f) === state.filters.time_of_day) &&
          (state.filters.max_stops === undefined || f.stops <= state.filters.max_stops),
      );
      const field = { departure: 'time', price: 'price', duration: 'duration' }[state.sort.by];
      visibleFlights.sort(
        (a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (state.sort.order === 'asc' ? 1 : -1),
      );
      return structuredClone({
        ...state,
        flights,
        visibleFlights,
        selected: flights.find((f) => f.id === state.selectedId) || null,
      });
    },
    search(input) {
      // A new search is always allowed; it resets filters and selection from the initial state.
      return save({ ...initial(), stage: 'results', search: validateSearch(input) });
    },
    filter(input) {
      requireStage('results');
      return save({ ...state, filters: validateFilters(input) });
    },
    clearFilters() {
      requireStage('results');
      return save({ ...state, filters: {} });
    },
    sort(input) {
      requireStage('results');
      return save({ ...state, sort: validateSort(input) });
    },
    getResults() {
      requireStage('results');
      return api.state.visibleFlights;
    },
    select({ flight_id }) {
      requireStage('results');
      if (!api.state.visibleFlights.some((f) => f.id === flight_id))
        throw new Error('Choose a flight from the visible results.');
      return save({ ...state, selectedId: flight_id });
    },
  };
  return api;
}
export function pageForState(state) {
  return { search: 'index', results: 'results' }[state.stage];
}
export function pageAllowed(page, state) {
  // The search form stays reachable at any stage; later pages need the state they render.
  if (page === 'index') return true;
  if (page === 'summary') return Boolean(state.selected);
  return pageForState(state) === page;
}
