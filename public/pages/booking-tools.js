import { tool } from '../shared/webmcp.js';
import { airports } from './booking-state.js';
export function bookingTools(booking, update) {
  const state = booking.state;
  const invoke = method => input => { const result = booking[method](input); update(); return result; };
  const tools = [tool('reset_booking', 'Start a new demo booking and discard the current booking.', {}, [], invoke('reset'))];
  if (['search', 'select'].includes(state.stage)) tools.push(tool('search_flights', 'Search demo flights between listed airports.', {
    from: { type: 'string', enum: airports }, to: { type: 'string', enum: airports }, date: { type: 'string', format: 'date' }
  }, ['from', 'to', 'date'], invoke('search')));
  if (state.stage === 'select') tools.push(tool('select_flight', 'Select a flight from the current search results.', { flight_id: { type: 'string', enum: state.flights.map(item => item.id) } }, ['flight_id'], invoke('select')));
  if (state.stage === 'passengers') tools.push(tool('set_passenger', 'Enter the demo passenger details for the selected flight.', { name: { type: 'string', minLength: 1, maxLength: 100 }, email: { type: 'string', format: 'email', maxLength: 254 } }, ['name', 'email'], invoke('passenger')));
  if (state.stage === 'review') tools.push(tool('confirm_booking', 'Confirm the reviewed demo booking. No real ticket or charge is created.', {}, [], invoke('confirm')));
  return tools;
}
