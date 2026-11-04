// The app keeps its state in the page URL, so there is no storage and no server session:
//   /?from=SFO&to=JFK&date=2026-12-01                               search form (prefilled)
//   /results.html?from=SFO&to=JFK&date=2026-12-01&max_price=150&by=price&order=asc
//   /summary.html?...same as results...&flight_id=DM101
// Reloading, going back and sharing the link all keep working.

import { DEFAULT_SORT, parseFilters, parseSort } from './flight-list.js';
import { validateSearch } from './flights.js';

// Wait a moment before leaving, so the result of a tool call can reach the agent first.
const NAVIGATION_DELAY_MS = 100;

// Returns { from, to, date }, or null when the URL has no valid search.
export function readSearchFromUrl() {
  const params = new URLSearchParams(location.search);
  try {
    return validateSearch({ from: params.get('from'), to: params.get('to'), date: params.get('date') });
  } catch {
    return null;
  }
}

export function readFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  try {
    return parseFilters(Object.fromEntries(params));
  } catch {
    return {};
  }
}

export function readSortFromUrl() {
  const params = new URLSearchParams(location.search);
  try {
    return parseSort({ by: params.get('by'), order: params.get('order') });
  } catch {
    return DEFAULT_SORT;
  }
}

export function readFlightIdFromUrl() {
  return new URLSearchParams(location.search).get('flight_id');
}

// Builds a link to one of the pages. Pass only the parts that page needs.
export function buildUrl(path, { search, filters = {}, sort, flightId }) {
  const params = new URLSearchParams(search);

  for (const [name, value] of Object.entries(filters)) {
    params.set(name, value);
  }
  if (sort) {
    params.set('by', sort.by);
    params.set('order', sort.order);
  }
  if (flightId) {
    params.set('flight_id', flightId);
  }

  return `${path}?${params}`;
}

// Replaces the address of the current page without reloading it (used after filtering and sorting).
export function updateCurrentUrl(url) {
  history.replaceState(null, '', url);
}

export function navigateTo(url) {
  setTimeout(() => location.assign(url), NAVIGATION_DELAY_MS);
}
