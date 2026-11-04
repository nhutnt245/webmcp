export const airports = ['SFO', 'LAX', 'JFK'];
export function hash(value) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
export function validateSearch({ from, to, date }) {
  if (!airports.includes(from) || !airports.includes(to) || from === to)
    throw new Error('Choose two different listed airports.');
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new Error('Enter a valid travel date.');
  return { from, to, date };
}
export function flightsFor(seed, input) {
  const search = validateSearch(input);
  const n = hash(seed);
  return ['DM101', 'DM202', 'DM303', 'DM404', 'DM505', 'DM606'].map((id, i) => ({
    ...search,
    id,
    time: `${String(6 + (n % 3) + i * 3).padStart(2, '0')}:${n % 2 ? '30' : '00'}`,
    price: 10000 + (n % 4000) + i * 1700,
    seats: 2 + ((n + i * 3) % 8),
    stops: i % 3,
    duration: 100 + ((n + i * 43) % 180),
  }));
}
// One artificial example per access layer. The CSS cue lives in styles.css. See README "Access examples".
export const probes = {
  dataAttribute: 'FARE-7K2',
  hiddenText: 'HIDDEN-3M8',
  comment: 'RULE-9T4',
  runtime: 'RUNTIME-6B1',
  storageKey: 'flight-probe',
  storage: 'STORE-2D5',
  console: 'CONSOLE-8X3',
  networkHeader: 'X-Flight-Probe',
  network: 'NET-5W7',
};
