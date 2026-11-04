// The results page (results.html).
// - The filter form and the sort form are WebMCP DECLARATIVE tools (attributes in results.html).
//   Their submit handlers are below.
// - select_flight, get_flight_results, clear_filters and edit_search are WebMCP IMPERATIVE tools.
//   They are defined in imperative-tools.js and call the same functions as the buttons on this page.

import { createFlightCard } from './flight-card.js';
import { DEFAULT_SORT, getVisibleFlights, parseFilters, parseSort } from './flight-list.js';
import { describeFlight, findFlights } from './flights.js';
import { showError, showMessage } from './messages.js';
import { registerResultsTools } from './imperative-tools.js';
import {
  buildUrl,
  navigateTo,
  readFiltersFromUrl,
  readSearchFromUrl,
  readSortFromUrl,
  updateCurrentUrl,
} from './page-url.js';

const search = readSearchFromUrl();

if (search === null) {
  // Opened without a search (for example by typing the address): start from the search form.
  location.replace('/');
} else {
  startResultsPage();
}

function startResultsPage() {
  const allFlights = findFlights(search);
  const lowestPrice = Math.min(...allFlights.map((flight) => flight.priceUsd));

  let filters = readFiltersFromUrl();
  let sort = readSortFromUrl();

  const filterForm = document.querySelector('#filter-form');
  const sortForm = document.querySelector('#sort-form');
  const clearFiltersButton = document.querySelector('#clear-filters');
  const editSearchLink = document.querySelector('#edit-search');

  // ---- Actions: what the page can do. Humans and agents both end up here. ----

  function applyFilters(fields) {
    filters = parseFilters(fields);
    showResults();
    showMessage(`Filters updated. ${getVisibleFlights(allFlights, filters, sort).length} flights shown.`);
    return describeResults();
  }

  function applySort(fields) {
    sort = parseSort(fields);
    showResults();
    showMessage(`Flights sorted by ${sort.by}, ${sort.order === 'asc' ? 'ascending' : 'descending'}.`);
    return describeResults();
  }

  function clearFilters() {
    filters = {};
    showResults();
    showMessage('Filters cleared.');
    return describeResults();
  }

  function selectFlight(flightId) {
    const flight = getVisibleFlights(allFlights, filters, sort).find((visibleFlight) => visibleFlight.id === flightId);
    if (!flight) {
      // Return the reason instead of throwing: a thrown error only tells the agent "Tool execution failed".
      const message = `Flight ${flightId} is not in the visible results. Read them with get_flight_results.`;
      showError(message);
      return { error: message };
    }

    showMessage(`Flight ${flight.id} selected. Opening the flight summary.`);
    navigateTo(buildUrl('/summary.html', { search, filters, sort, flightId: flight.id }));
    return { selected: describeFlight(flight), message: 'The flight summary page is opening.' };
  }

  function editSearch() {
    showMessage('Opening the search form.');
    navigateTo(buildUrl('/', { search }));
    return { message: 'The search form is opening. Your current search is filled in.' };
  }

  // What an agent gets back: the flights that are visible right now.
  function describeResults() {
    return {
      route: `${search.from} to ${search.to}`,
      date: search.date,
      filters,
      sort,
      flights: getVisibleFlights(allFlights, filters, sort).map(describeFlight),
    };
  }

  // ---- Page: show the current state. ----

  function showResults() {
    const visibleFlights = getVisibleFlights(allFlights, filters, sort);

    document.querySelector('#route').textContent =
      `${search.from} → ${search.to} · ${search.date} · ${visibleFlights.length} flights`;

    const cards = visibleFlights.map((flight) =>
      createFlightCard(flight, {
        isLowestPrice: flight.priceUsd === lowestPrice,
        onSelect: selectFlight,
      }),
    );
    document.querySelector('#results').replaceChildren(...cards);

    // Keep the forms in line with the state, so what you see is what is applied.
    filterForm.elements.max_price.value = filters.max_price ?? '';
    filterForm.elements.time_of_day.value = filters.time_of_day ?? '';
    filterForm.elements.max_stops.value = filters.max_stops ?? '';
    sortForm.elements.by.value = sort.by;
    sortForm.elements.order.value = sort.order;
    clearFiltersButton.hidden = Object.keys(filters).length === 0;

    // Put the filters and sort in the address, so reloading the page keeps them.
    updateCurrentUrl(buildUrl('/results.html', { search, filters, sort }));
    editSearchLink.href = buildUrl('/', { search });
  }

  // ---- Declarative forms: ordinary submit handlers. ----

  filterForm.addEventListener('submit', (event) => {
    // Stop the browser from reloading the page. We update the list ourselves.
    event.preventDefault();

    try {
      // Same code for a human click on "Filter flights" and for an agent calling filter_flights.
      const result = applyFilters(Object.fromEntries(new FormData(filterForm)));

      // Only an agent has event.agentInvoked. respondWith() sends it the tool result.
      if (event.agentInvoked) {
        event.respondWith(Promise.resolve(result));
      }
    } catch (error) {
      showError(error.message);

      if (event.agentInvoked) {
        event.respondWith(Promise.resolve({ error: error.message }));
      }
    }
  });

  sortForm.addEventListener('submit', (event) => {
    event.preventDefault();

    try {
      const result = applySort(Object.fromEntries(new FormData(sortForm)));

      if (event.agentInvoked) {
        event.respondWith(Promise.resolve(result));
      }
    } catch (error) {
      showError(error.message);

      if (event.agentInvoked) {
        event.respondWith(Promise.resolve({ error: error.message }));
      }
    }
  });

  // ---- Plain button (its agent version is the imperative tool clear_filters). ----

  clearFiltersButton.addEventListener('click', clearFilters);

  showResults();
  showMessage('Search complete. Filter, sort or select a flight.');

  registerResultsTools({ describeResults, selectFlight, clearFilters, editSearch });
}
