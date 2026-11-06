// Fictional flight data. Everything is generated locally: there is no backend and no real airline.

export const AIRPORTS = ['SFO', 'LAX', 'JFK'];

// Every search shows the same six flight numbers, with different times and prices per route and date.
export const FLIGHT_IDS = ['DM101', 'DM202', 'DM303', 'DM404', 'DM505', 'DM606'];

// Throws an Error with a readable message when the search is not valid.
// Both the human submit and the agent submit of the search form go through here.
export function validateSearch({ from, to, date }) {
  if (!AIRPORTS.includes(from) || !AIRPORTS.includes(to)) {
    throw new Error('Choose the departure and arrival airports from the list.');
  }
  if (from === to) {
    throw new Error('Departure and arrival airports must be different.');
  }
  if (!isRealDate(date)) {
    throw new Error('Enter a valid travel date in YYYY-MM-DD format.');
  }
  return { from, to, date };
}

export function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '')) {
    return false;
  }
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.getUTCFullYear() > 0 && parsed.toISOString().slice(0, 10) === text;
}

// The same search always gives the same six flights.
export function findFlights(search) {
  const routeNumber = hashText(`${search.from}-${search.to}-${search.date}`);

  return FLIGHT_IDS.map((id, index) => {
    const departureHour = 6 + (routeNumber % 3) + index * 3;
    const departureMinute = routeNumber % 2 === 0 ? '00' : '30';

    return {
      id,
      from: search.from,
      to: search.to,
      date: search.date,
      departureTime: `${String(departureHour).padStart(2, '0')}:${departureMinute}`,
      priceUsd: 90 + ((routeNumber + index * 53) % 160),
      stops: index % 3,
      durationMinutes: 100 + ((routeNumber + index * 43) % 180),
      seatsLeft: 2 + ((routeNumber + index * 3) % 8),
    };
  });
}

// What an agent reads back about a flight: plain data with the units in the names.
export function describeFlight(flight) {
  return {
    id: flight.id,
    from: flight.from,
    to: flight.to,
    date: flight.date,
    departs: flight.departureTime,
    price_usd: flight.priceUsd,
    stops: flight.stops,
    duration_minutes: flight.durationMinutes,
    seats_left: flight.seatsLeft,
  };
}

function hashText(text) {
  let hash = 2166136261;
  for (const character of text) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}
