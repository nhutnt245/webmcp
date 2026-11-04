import { element, money } from '../shared/ui.js';
import { createToolRegistry } from '../shared/webmcp.js';
import { probeValues, hash, airports } from '../shared/flights.js';
import { createBooking, pageAllowed, pageForState } from './booking-state.js';
import { bookingTools } from './booking-tools.js';
const params = new URLSearchParams(location.search);
const seed = params.get('seed') || 'demo';
const page = document.body.dataset.page;
const values = probeValues(seed, page);
let storage;
try {
  storage = sessionStorage;
} catch {
  /* Actions below report persistence failure. */
}
const booking = createBooking({ seed, storage });
const registry = createToolRegistry();
const message = document.querySelector('#message');
const urlFor = (target) => {
  const url = new URL(target === 'index' ? '/' : `/${target}.html`, location.origin);
  url.searchParams.set('seed', seed);
  if (params.get('key') === '1') url.searchParams.set('key', '1');
  return url;
};
if (!pageAllowed(page, booking.state)) {
  location.replace(urlFor(pageForState(booking.state)));
} else {
  const status = (text) => {
    message.textContent = text;
    console.log(values.consoleToken, text);
  };
  const publish = () => {
    window.__BOOKING_STATE__ = booking.state;
    try {
      localStorage.setItem(values.draftKey, JSON.stringify(booking.state));
    } catch {
      /* Optional probe storage. */
    }
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
      publish();
      status(text);
      const target = method === 'select' ? 'summary' : pageForState(booking.state);
      if (target !== page) {
        // Yield tool results to the browser before the same navigation used by UI actions.
        setTimeout(() => location.assign(urlFor(target)), 50);
      } else render();
      return result;
    } catch (error) {
      status(error.message);
      throw error;
    }
  };
  const actions = {
    search: (input) => run('search', input, 'Search complete. Choose a flight.'),
    filter: (input) => run('filter', input, 'Flight filters updated.'),
    clearFilters: () => run('clearFilters', undefined, 'Flight filters cleared.'),
    sort: (input) => run('sort', input, 'Flight order updated.'),
    getResults: () => {
      status('Current flight results read.');
      renderKey();
      return booking.getResults();
    },
    select: (input) => run('select', input, `Flight ${input.flight_id} selected. See your selected-flight summary.`),
  };
  const onClick = (id, action) =>
    document.querySelector(id)?.addEventListener('click', () =>
      Promise.resolve()
        .then(action)
        .catch(() => {}),
    );
  const onSubmit = (id, action) =>
    document.querySelector(id)?.addEventListener('submit', (event) => {
      event.preventDefault();
      Promise.resolve()
        .then(() => action(Object.fromEntries(new FormData(event.target))))
        .catch(() => {});
    });
  onSubmit('#search-form', actions.search);
  onClick('#swap', () => {
    const form = document.querySelector('#search-form');
    [form.elements.from.value, form.elements.to.value] = [form.elements.to.value, form.elements.from.value];
    status(`Airports swapped: ${form.elements.from.value} to ${form.elements.to.value}.`);
    renderKey();
  });
  onSubmit('#filter-form', (fields) =>
    actions.filter(
      Object.fromEntries(
        Object.entries(fields)
          .filter(([, v]) => v !== '')
          .map(([k, v]) => [k, k === 'time_of_day' ? v : Number(v)]),
      ),
    ),
  );
  onSubmit('#sort-form', actions.sort);
  onClick('#clear-filters', actions.clearFilters);
  function flightCard(flight, selectable) {
    const card = element('article', undefined, {
      class: `card ${flight.cssClass}`,
      'data-flight-id': flight.id,
      'data-fare-class': flight.fareClass,
      'data-seats-left': flight.seats,
    });
    const cheapest = flight.price === Math.min(...booking.state.flights.map((f) => f.price));
    if (cheapest) {
      card.classList.add('cheapest');
      card.style.setProperty('--fare-cue', JSON.stringify(values.cheapestContent));
    }
    card.append(
      element('h2', `${flight.id} · ${flight.from} → ${flight.to}`),
      element('p', `${flight.date} · ${flight.time} · ${flight.duration} minutes · ${flight.stops} stops`),
      element('p', undefined, { class: 'flight-price' }),
    );
    const price = card.querySelector('.flight-price');
    price.append(element(cheapest ? 'strong' : 'span', money(flight.price)), ` · ${flight.seats} seats left`);
    if (cheapest) card.prepend(element('span', 'Lowest price', { class: 'lowest-price-badge' }));
    card.append(
      element('span', flight.baggage, { style: 'display:none', class: 'baggage-fee' }),
      document.createComment(` Fare rule: ${flight.fareRule} `),
    );
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
  function renderKey() {
    const key = document.querySelector('#answer-key');
    if (params.get('key') !== '1') return;
    key.hidden = false;
    key.replaceChildren(element('h2', `Answer key · seed: ${seed}`));
    const rows = [];
    const add = (layer, location, value) => rows.push([layer, location, String(value)]);
    const state = booking.state;
    if (page === 'index') {
      const form = document.querySelector('#search-form');
      add(
        'Visible',
        'Search route and date fields',
        `${form.elements.from.value} → ${form.elements.to.value} · ${form.elements.date.value}`,
      );
      add('Accessibility', '#swap aria-label', 'Swap departure and arrival airports');
    }
    for (const flight of state.flights) {
      add(
        'Visible',
        `${flight.id} route / departure / duration / stops / price / seats`,
        `${flight.from} → ${flight.to} · ${flight.date} · ${flight.time} · ${flight.duration} min · ${flight.stops} stops · ${money(flight.price)} · ${flight.seats} seats`,
      );
      add('Accessibility', `${flight.id} Select button on results`, `Select ${flight.id} for ${money(flight.price)}`);
      add(
        'DOM',
        `${flight.id} data-flight-id / data-fare-class / data-seats-left / CSS class`,
        `${flight.id} / ${flight.fareClass} / ${flight.seats} / ${flight.cssClass}`,
      );
      add('Hidden DOM', `${flight.id} .baggage-fee / HTML comment`, `${flight.baggage} / ${flight.fareRule}`);
    }
    if (state.flights.length)
      add(
        'Computed style',
        'Cheapest flight on results / selected flight if cheapest',
        `::after ${values.cheapestContent}`,
      );
    add('Accessibility', '#message aria-live', message.textContent);
    add('JavaScript', 'window.__BOOKING_STATE__', JSON.stringify(state));
    add(
      'Storage',
      'sessionStorage.flight_booking',
      storage?.getItem('flight_booking') || '(absent until first action)',
    );
    add('Storage', 'localStorage draft key and value', `${values.draftKey} / ${JSON.stringify(state)}`);
    add('Console', `Every step (${page})`, values.consoleToken);
    if (state.search)
      add('Network', 'Search mock response', `/api/flights?${new URLSearchParams({ ...state.search, seed })}`);
    if (page === 'results') {
      add('Network', 'Deliberate 404 on results', values.failedRequest);
    }
    if (page === 'summary') add('Visible', 'Flight summary #selection-code', values.selectionCode);
    const table = element('table');
    const header = element('tr');
    for (const text of ['Layer', 'Element / page', 'Value']) header.append(element('th', text, { scope: 'col' }));
    table.append(header);
    for (const fields of rows) {
      const row = element('tr');
      for (const field of fields) row.append(element('td', field));
      table.append(row);
    }
    key.append(table);
  }
  function render() {
    const state = booking.state;
    for (const link of document.querySelectorAll('#edit-search')) link.href = urlFor('index');
    if (page === 'results') {
      document.querySelector('#route').textContent =
        `${state.search.from} → ${state.search.to} · ${state.search.date} · ${state.visibleFlights.length} flights`;
      document.querySelector('#results').replaceChildren(...state.visibleFlights.map((f) => flightCard(f, true)));
      const filter = document.querySelector('#filter-form');
      for (const name of ['max_price', 'time_of_day', 'max_stops'])
        filter.elements[name].value = state.filters[name] ?? '';
      document.querySelector('#clear-filters').hidden = !Object.keys(state.filters).length;
      const sort = document.querySelector('#sort-form');
      sort.elements.by.value = state.sort.by;
      sort.elements.order.value = state.sort.order;
    }
    if (page === 'summary') {
      document
        .querySelector('#flight-summary')
        .replaceChildren(
          flightCard(state.selected, false),
          element('p', `Selection code: ${values.selectionCode}`, { id: 'selection-code' }),
        );
      document.querySelector('#back-results').href = urlFor('results');
    }
    renderKey();
    registry.replace(bookingTools(page, booking, actions));
  }
  if (page === 'index') {
    const form = document.querySelector('#search-form');
    const n = hash(seed);
    const previous = booking.state.search;
    form.elements.from.value = previous?.from ?? airports[n % 3];
    form.elements.to.value = previous?.to ?? airports[(n + 1) % 3];
    form.elements.date.value = previous?.date ?? `2026-12-${String(1 + (n % 28)).padStart(2, '0')}`;
  }
  publish();
  status(
    {
      index: 'Choose your route and travel date.',
      results: 'Search complete. Filter, sort or select a flight.',
      summary: 'Flight selected.',
    }[page],
  );
  if (page === 'results') fetch(values.failedRequest).catch(() => {});
  render();
}
