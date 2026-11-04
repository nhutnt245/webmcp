import { element, money } from '../shared/ui.js';
import { probes, hash, airports } from '../shared/flights.js';
import { createBooking, filtersFromFields, pageAllowed, pageForState } from './booking-state.js';
import { createImperativeTools, toolError } from './imperative-tools.js';
const params = new URLSearchParams(location.search);
const seed = params.get('seed') || 'demo';
const page = document.body.dataset.page;
let storage;
try {
  storage = sessionStorage;
} catch {
  /* Actions below report persistence failure. */
}
const booking = createBooking({ seed, storage });
const message = document.querySelector('#message');
const urlFor = (target) => {
  const url = new URL(target === 'index' ? '/' : `/${target}.html`, location.origin);
  url.searchParams.set('seed', seed);
  return url;
};
// What agents read back: plain data, not the whole booking state.
const brief = (flight) => ({
  id: flight.id,
  from: flight.from,
  to: flight.to,
  date: flight.date,
  departs: flight.time,
  price_usd: flight.price / 100,
  stops: flight.stops,
  duration_minutes: flight.duration,
  seats_left: flight.seats,
});
const overview = (state) => ({
  route: `${state.search.from} to ${state.search.to}`,
  date: state.search.date,
  filters: state.filters,
  sort: state.sort,
  flights: state.visibleFlights.map(brief),
});
if (!pageAllowed(page, booking.state)) {
  location.replace(urlFor(pageForState(booking.state)));
} else {
  const status = (text) => {
    message.textContent = text;
  };
  // Every page change goes through here, for UI clicks and tool calls alike.
  const leave = (target) => {
    // Imperative tools are unregistered at once so none can run against the page that is going away.
    // Declarative tools belong to the forms; removing toolname mid-call would cancel the call that is
    // still answering, so they leave with the document.
    tools.suspend();
    // Let the tool result reach the agent before the document goes away.
    setTimeout(() => location.assign(urlFor(target)), 50);
  };
  const run = async (method, input, text) => {
    try {
      if (!storage) throw new Error('Session storage is required to continue between pages.');
      if (method === 'search') {
        const query = new URLSearchParams({ ...input, seed });
        const response = await fetch(`/api/flights?${query}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Flight search failed.');
        input = data.search;
      }
      const result = booking[method](input);
      status(text);
      const target = method === 'select' ? 'summary' : pageForState(booking.state);
      if (target !== page) leave(target);
      else render();
      return result;
    } catch (error) {
      status(error.message);
      throw error;
    }
  };
  const actions = {
    search: async (input) => overview(await run('search', input, 'Search complete. Choose a flight.')),
    filter: async (input) => overview(await run('filter', input, 'Flight filters updated.')),
    clearFilters: async () => overview(await run('clearFilters', undefined, 'Flight filters cleared.')),
    sort: async (input) => overview(await run('sort', input, 'Flight order updated.')),
    getResults: () => {
      status('Current flight results read.');
      return overview(booking.state);
    },
    select: async (input) => {
      const state = await run('select', input, `Flight ${input.flight_id} selected. See your selected-flight summary.`);
      return { selected: brief(state.selected), opens: 'flight summary' };
    },
    editSearch: () => {
      status('Opening the search form.');
      leave('index');
      return { opens: 'search form' };
    },
  };
  const tools = createImperativeTools({ page, booking, actions });
  const onClick = (id, action) =>
    document.querySelector(id)?.addEventListener('click', () =>
      Promise.resolve()
        .then(action)
        .catch(() => {}),
    );
  // Declarative tools (toolname on the form in the HTML) arrive here as ordinary form submissions.
  // The same action serves people and agents; agents also get its real result or error back.
  let agentFilling = false;
  document.modelContext?.addEventListener('toolactivated', () => {
    agentFilling = true;
  });
  const onSubmit = (id, action) => {
    const form = document.querySelector(id);
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      agentFilling = false;
      const done = Promise.resolve().then(() => action(Object.fromEntries(new FormData(event.target))));
      if (event.agentInvoked) {
        event.respondWith(done.catch(toolError));
        // A rejected agent call must not leave its rejected values in the visible form.
        done.catch(() => setTimeout(syncForms));
      }
      done.catch(() => {});
    });
    form?.addEventListener(
      'invalid',
      () => {
        // The browser refused values the agent filled in (before any submit): restore the form.
        if (agentFilling) {
          agentFilling = false;
          setTimeout(syncForms);
        }
      },
      true,
    );
  };
  onSubmit('#search-form', actions.search);
  onClick('#swap', () => {
    const form = document.querySelector('#search-form');
    [form.elements.from.value, form.elements.to.value] = [form.elements.to.value, form.elements.from.value];
    status(`Airports swapped: ${form.elements.from.value} to ${form.elements.to.value}.`);
  });
  onSubmit('#filter-form', (fields) => actions.filter(filtersFromFields(fields)));
  onSubmit('#sort-form', actions.sort);
  onClick('#clear-filters', actions.clearFilters);
  document.querySelector('#edit-search')?.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    actions.editSearch();
  });
  function flightCard(flight, selectable) {
    const card = element('article', undefined, { class: 'card', 'data-flight-id': flight.id });
    const cheapest = flight.price === Math.min(...booking.state.flights.map((f) => f.price));
    if (cheapest) card.classList.add('cheapest');
    card.append(
      element('h2', `${flight.id} · ${flight.from} → ${flight.to}`),
      element('p', `${flight.date} · ${flight.time} · ${flight.duration} minutes · ${flight.stops} stops`),
      element('p', undefined, { class: 'flight-price' }),
    );
    const price = card.querySelector('.flight-price');
    price.append(element(cheapest ? 'strong' : 'span', money(flight.price)), ` · ${flight.seats} seats left`);
    if (cheapest) card.prepend(element('span', 'Lowest price', { class: 'lowest-price-badge' }));
    if (selectable && cheapest) {
      // Canonical probe card: one data attribute, one hidden text value and one HTML comment.
      card.dataset.fareCode = probes.dataAttribute;
      card.append(
        element('span', probes.hiddenText, { style: 'display:none', class: 'hidden-note' }),
        document.createComment(` Fare rule: ${probes.comment} `),
      );
    }
    if (selectable) {
      const selected = booking.state.selectedId === flight.id;
      card.classList.toggle('selected', selected);
      const choose = element('button', 'Select flight', {
        type: 'button',
        'aria-label': `Select ${flight.id} for ${money(flight.price)}`,
        'aria-pressed': String(selected),
      });
      choose.addEventListener('click', () => actions.select({ flight_id: flight.id }).catch(() => {}));
      card.append(choose);
    }
    return card;
  }
  function render() {
    const state = booking.state;
    for (const link of document.querySelectorAll('#edit-search')) link.href = urlFor('index');
    if (page === 'results') {
      document.querySelector('#route').textContent =
        `${state.search.from} → ${state.search.to} · ${state.search.date} · ${state.visibleFlights.length} flights`;
      document.querySelector('#results').replaceChildren(...state.visibleFlights.map((f) => flightCard(f, true)));
      syncForms();
    }
    if (page === 'summary') {
      document.querySelector('#flight-summary').replaceChildren(flightCard(state.selected, false));
      document.querySelector('#back-results').href = urlFor('results');
    }
    tools.sync();
  }
  // Put the visible forms back in line with the booking state.
  function syncForms() {
    const state = booking.state;
    if (page === 'index') {
      const form = document.querySelector('#search-form');
      const n = hash(seed);
      const previous = state.search;
      form.elements.from.value = previous?.from ?? airports[n % 3];
      form.elements.to.value = previous?.to ?? airports[(n + 1) % 3];
      form.elements.date.value = previous?.date ?? `2026-12-${String(1 + (n % 28)).padStart(2, '0')}`;
    }
    if (page === 'results') {
      const filter = document.querySelector('#filter-form');
      for (const name of ['max_price', 'time_of_day', 'max_stops'])
        filter.elements[name].value = state.filters[name] ?? '';
      document.querySelector('#clear-filters').hidden = !Object.keys(state.filters).length;
      const sort = document.querySelector('#sort-form');
      sort.elements.by.value = state.sort.by;
      sort.elements.order.value = state.sort.order;
    }
  }
  status(
    {
      index: 'Choose your route and travel date.',
      results: 'Search complete. Filter, sort or select a flight.',
      summary: 'Flight selected.',
    }[page],
  );
  if (page === 'results') {
    // Runtime, storage and console probes live on the results page only.
    window.flightProbe = probes.runtime;
    console.log('flight-probe', probes.console);
    try {
      localStorage.setItem(probes.storageKey, probes.storage);
    } catch {
      /* Optional probe storage. */
    }
  }
  render();
  syncForms();
  tools.mount();
  // A page restored from the back/forward cache lost its registrations: reload to register again.
  addEventListener('pageshow', (event) => {
    if (event.persisted) location.reload();
  });
}
