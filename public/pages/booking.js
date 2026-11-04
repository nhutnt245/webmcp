import { installLayout, element, button, money, attempt } from '../shared/ui.js';
import { createToolsPanel } from '../shared/webmcp.js';
import { createBooking } from './booking-state.js';
import { bookingTools } from './booking-tools.js';
installLayout();
const booking = createBooking();
const tools = createToolsPanel();
const searchForm = document.querySelector('#search-form');
const passengerForm = document.querySelector('#passenger-form');
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => { booking.search(Object.fromEntries(new FormData(searchForm))); render(); });
});
passengerForm.addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => { booking.passenger(Object.fromEntries(new FormData(passengerForm))); render(); });
});
document.querySelector('#reset').addEventListener('click', () => { booking.reset(); passengerForm.reset(); render(); });
document.querySelector('#confirm').addEventListener('click', () => attempt(() => { booking.confirm(); render(); }));
function render() {
  const state = booking.state;
  document.querySelector('#stage').textContent = `Current step: ${state.stage}`;
  searchForm.hidden = !['search', 'select'].includes(state.stage);
  passengerForm.hidden = state.stage !== 'passengers';
  document.querySelector('#review').hidden = state.stage !== 'review';
  document.querySelector('#confirmation').hidden = state.stage !== 'confirmed';
  const results = document.querySelector('#results');
  results.replaceChildren();
  results.hidden = state.stage !== 'select';
  if (state.stage === 'select') for (const flight of state.flights) {
    const card = element('article', undefined, { class: 'card' });
    card.append(element('h2', `${flight.id} · ${flight.from} → ${flight.to}`), element('p', `${flight.date} at ${flight.time} · ${money(flight.price)}`), button(`Select ${flight.id}`, () => { booking.select({ flight_id: flight.id }); render(); }));
    results.append(card);
  }
  const summary = document.querySelector('#selection');
  summary.textContent = state.selected ? `${state.selected.id} · ${state.selected.from} → ${state.selected.to} · ${state.selected.date} · ${money(state.selected.price)}` : '';
  summary.hidden = !state.selected;
  document.querySelector('#passenger-summary').textContent = state.passenger ? `${state.passenger.name} · ${state.passenger.email}` : '';
  document.querySelector('#confirmation-code').textContent = state.confirmation || '';
  tools.replace(bookingTools(booking, render));
}
render();
