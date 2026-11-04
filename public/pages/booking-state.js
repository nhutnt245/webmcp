export const airports = ['SFO', 'LAX', 'JFK'];
export function createBooking() {
  let state = { stage: 'search', flights: [], selected: null, passenger: null, confirmation: null };
  return {
    get state() { return structuredClone(state); },
    search({ from, to, date }) {
      if (!airports.includes(from) || !airports.includes(to) || from === to) throw new Error('Choose two different listed airports.');
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Enter a valid travel date.');
      state = { stage: 'select', flights: [
        { id: 'DM101', from, to, date, time: '09:00', price: 12900 },
        { id: 'DM202', from, to, date, time: '15:30', price: 17900 }
      ], selected: null, passenger: null, confirmation: null };
      return this.state;
    },
    select({ flight_id }) {
      if (state.stage !== 'select') throw new Error('Search for flights first.');
      const flight = state.flights.find(item => item.id === flight_id);
      if (!flight) throw new Error('Choose a flight from the current search.');
      state.selected = flight;
      state.stage = 'passengers';
      return this.state;
    },
    passenger({ name, email }) {
      if (state.stage !== 'passengers') throw new Error('Select a flight first.');
      if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a passenger name and valid email.');
      state.passenger = { name: name.trim(), email: email.trim() };
      state.stage = 'review';
      return this.state;
    },
    confirm() {
      if (state.stage !== 'review' || !state.selected || !state.passenger) throw new Error('Complete the flight and passenger steps before confirming.');
      state.confirmation = 'BOOK-' + crypto.randomUUID().slice(0, 8).toUpperCase();
      state.stage = 'confirmed';
      return this.state;
    },
    reset() { state = { stage: 'search', flights: [], selected: null, passenger: null, confirmation: null }; return this.state; }
  };
}
