// Filtering and sorting of the flight list.
// The field names (max_price, time_of_day, max_stops, by, order) are the same in the HTML forms,
// in the page URL and here, so one name means one thing everywhere.

export const DEFAULT_SORT = { by: 'price', order: 'asc' };

const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'];
const SORT_FIELDS = { price: 'priceUsd', departure: 'departureTime', duration: 'durationMinutes' };

// Form fields arrive as text, and an empty field means "this filter is off".
// Returns { max_price?: number, time_of_day?: string, max_stops?: number }.
export function parseFilters(fields) {
  const filters = {};

  if (fields.max_price) {
    const maxPrice = Number(fields.max_price);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) {
      throw new Error('Maximum price must be a number that is 0 or more.');
    }
    filters.max_price = maxPrice;
  }

  if (fields.time_of_day) {
    if (!TIMES_OF_DAY.includes(fields.time_of_day)) {
      throw new Error('Departure period must be morning, afternoon or evening.');
    }
    filters.time_of_day = fields.time_of_day;
  }

  if (fields.max_stops) {
    const maxStops = Number(fields.max_stops);
    if (![0, 1, 2].includes(maxStops)) {
      throw new Error('Maximum stops must be 0, 1 or 2.');
    }
    filters.max_stops = maxStops;
  }

  return filters;
}

export function parseSort({ by, order }) {
  if (!(by in SORT_FIELDS)) {
    throw new Error('Sort by price, departure or duration.');
  }
  if (order !== 'asc' && order !== 'desc') {
    throw new Error('Sort order must be asc or desc.');
  }
  return { by, order };
}

export function getVisibleFlights(flights, filters, sort) {
  const matchingFlights = flights.filter((flight) => {
    if (filters.max_price !== undefined && flight.priceUsd > filters.max_price) {
      return false;
    }
    if (filters.time_of_day !== undefined && getTimeOfDay(flight) !== filters.time_of_day) {
      return false;
    }
    if (filters.max_stops !== undefined && flight.stops > filters.max_stops) {
      return false;
    }
    return true;
  });

  const sortField = SORT_FIELDS[sort.by];
  const direction = sort.order === 'asc' ? 1 : -1;

  return matchingFlights.sort((first, second) => {
    if (first[sortField] < second[sortField]) {
      return -1 * direction;
    }
    if (first[sortField] > second[sortField]) {
      return 1 * direction;
    }
    return 0;
  });
}

// morning: before 12:00, afternoon: 12:00 to 17:59, evening: 18:00 onward.
function getTimeOfDay(flight) {
  const hour = Number(flight.departureTime.slice(0, 2));
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 18) {
    return 'afternoon';
  }
  return 'evening';
}
