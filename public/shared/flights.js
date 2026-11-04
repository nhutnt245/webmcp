export const airports = ['SFO', 'LAX', 'JFK'];
export function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
export const token = (seed, label) => hash(`${seed}:${label}`).toString(36).toUpperCase().padStart(7, '0');
export function validateSearch({ from, to, date }) {
  if (!airports.includes(from) || !airports.includes(to) || from === to) throw new Error('Choose two different listed airports.');
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Enter a valid travel date.');
  return { from, to, date };
}
export function flightsFor(seed, input) {
  const search = validateSearch(input);
  const n = hash(seed);
  return ['DM101', 'DM202', 'DM303', 'DM404', 'DM505', 'DM606'].map((id, i) => ({
    ...search, id, time: `${String(6 + (n % 3) + i * 3).padStart(2, '0')}:${n % 2 ? '30' : '00'}`,
    price: 10000 + n % 4000 + i * 1700, seats: 2 + (n + i * 3) % 8,
    stops: i % 3, duration: 100 + (n + i * 43) % 180,
    fareClass: i % 2 ? 'FLEX' : 'BASIC', cssClass: `flight-${token(seed, id)}`,
    baggage: `$${20 + (n + i) % 20} baggage fee`, fareRule: `FARE-${token(seed, id + ':rule')}`
  }));
}
export function probeValues(seed, page) {
  return {
    draftKey: `flight-draft-${token(seed, 'draft')}`,
    consoleToken: `booking-${page}-${token(seed, page + ':console')}`,
    failedRequest: `/missing-${token(seed, 'network')}.json`,
    confirmation: `BOOK-${token(seed, 'confirmation')}`,
    cheapestColour: ['#e4f3e8', '#e5effa', '#fff2d8'][hash(seed) % 3], cheapestContent: `Lowest fare ${token(seed, 'cue')}`
  };
}
