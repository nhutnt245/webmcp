import { tool } from '../shared/webmcp.js';
import { airports, pageForState } from './booking-state.js';
export function bookingTools(page, booking, actions) {
  const state = booking.state;
  if (page !== 'index' && pageForState(state) !== page) return [];
  const simple = (name, description, execute) => tool(name, description, {}, [], execute);
  if (page === 'index')
    return [
      tool(
        'search_flights',
        'Search fictional flights.',
        {
          from: { type: 'string', enum: airports },
          to: { type: 'string', enum: airports },
          date: { type: 'string', format: 'date' },
        },
        ['from', 'to', 'date'],
        actions.search,
      ),
    ];
  if (page === 'results') {
    const tools = [
      tool(
        'filter_flights',
        'Replace filters. Maximum price is in USD dollars; omitted fields are cleared.',
        {
          max_price: { type: 'number', minimum: 0 },
          time_of_day: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
          max_stops: { type: 'integer', minimum: 0, maximum: 2 },
        },
        [],
        actions.filter,
      ),
      tool(
        'sort_flights',
        'Sort visible flights.',
        {
          by: { type: 'string', enum: ['price', 'departure', 'duration'] },
          order: { type: 'string', enum: ['asc', 'desc'] },
        },
        ['by', 'order'],
        actions.sort,
      ),
      simple('get_flight_results', 'Read currently visible flights.', actions.getResults),
    ];
    if (Object.keys(state.filters).length)
      tools.push(simple('clear_filters', 'Clear active flight filters.', actions.clearFilters));
    if (state.visibleFlights.length)
      tools.push(
        tool(
          'select_flight',
          'Select a currently visible flight.',
          { flight_id: { type: 'string', enum: state.visibleFlights.map((f) => f.id) } },
          ['flight_id'],
          actions.select,
        ),
      );
    return tools;
  }
  return [];
}
