// The summary page (summary.html). It shows the selected flight.
// It has no forms, so it has no declarative tools. Its two imperative tools are in imperative-tools.js.

import { createFlightCard } from './flight-card.js';
import { findFlights } from './flights.js';
import { registerSummaryTools } from './imperative-tools.js';
import { showMessage } from './messages.js';
import {
  buildUrl,
  navigateTo,
  readFiltersFromUrl,
  readFlightIdFromUrl,
  readSearchFromUrl,
  readSortFromUrl,
} from './page-url.js';

const search = readSearchFromUrl();
const allFlights = search ? findFlights(search) : [];
const selectedFlight = allFlights.find((flight) => flight.id === readFlightIdFromUrl());

if (!selectedFlight) {
  // Opened without a selected flight: go back to the search form.
  location.replace('/');
} else {
  startSummaryPage();
}

function startSummaryPage() {
  const filters = readFiltersFromUrl();
  const sort = readSortFromUrl();
  const resultsUrl = buildUrl('/results.html', { search, filters, sort });
  const searchUrl = buildUrl('/', { search });

  const lowestPrice = Math.min(...allFlights.map((flight) => flight.priceUsd));
  const card = createFlightCard(selectedFlight, { isLowestPrice: selectedFlight.priceUsd === lowestPrice });
  document.querySelector('#flight-summary').replaceChildren(card);

  const backToResultsLink = document.querySelector('#back-to-results');
  const editSearchLink = document.querySelector('#edit-search');
  backToResultsLink.href = resultsUrl;
  editSearchLink.href = searchUrl;

  function backToResults() {
    showMessage('Opening the results.');
    navigateTo(resultsUrl);
    return { message: 'The results page is opening. Your filters and sorting are kept.' };
  }

  function editSearch() {
    showMessage('Opening the search form.');
    navigateTo(searchUrl);
    return { message: 'The search form is opening. Your current search is filled in.' };
  }

  showMessage('Flight selected.');

  registerSummaryTools({ backToResults, editSearch });
}
