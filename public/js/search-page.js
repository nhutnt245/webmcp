// The search page (index.html).
// The form is a WebMCP DECLARATIVE tool: its toolname/tooldescription/toolautosubmit attributes are in index.html.
// This file only handles the submit event.

import { findFlights, validateSearch } from './flights.js';
import { showError, showMessage } from './messages.js';
import { buildUrl, navigateTo, readSearchFromUrl } from './page-url.js';

const searchForm = document.querySelector('#search-form');

// "Edit search" links here with the previous search in the URL, so the form shows it again.
const previousSearch = readSearchFromUrl();
if (previousSearch) {
  searchForm.elements.from.value = previousSearch.from;
  searchForm.elements.to.value = previousSearch.to;
  searchForm.elements.date.value = previousSearch.date;
}

showMessage('Choose your route and travel date.');

searchForm.addEventListener('submit', (event) => {
  // Stop the browser from sending the form itself. The page decides what happens next.
  event.preventDefault();

  try {
    // A human clicking "Search flights" and an agent calling search_flights run this same code.
    const result = searchFromForm();

    // event.agentInvoked is true only when an AI agent submitted the form.
    // respondWith() gives the agent its tool result. It needs a Promise.
    if (event.agentInvoked) {
      event.respondWith(Promise.resolve(result));
    }
  } catch (error) {
    showError(error.message);

    // A rejected Promise would only tell the agent "Tool execution failed".
    // Resolving with the message lets the agent read the real reason and try again.
    if (event.agentInvoked) {
      event.respondWith(Promise.resolve({ error: error.message }));
    }
  }
});

function searchFromForm() {
  const fields = Object.fromEntries(new FormData(searchForm));
  const search = validateSearch(fields);
  const flights = findFlights(search);

  showMessage(`Found ${flights.length} flights. Opening the results page.`);
  navigateTo(buildUrl('/results.html', { search }));

  return {
    message: `Found ${flights.length} flights from ${search.from} to ${search.to} on ${search.date}. The results page is opening.`,
  };
}
