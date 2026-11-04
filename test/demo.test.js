import test from 'node:test';
import assert from 'node:assert/strict';
import { createBooking } from '../public/pages/booking-state.js';
import { bookingTools } from '../public/pages/booking-tools.js';
import { createShop } from '../public/pages/shop-state.js';
import { shopTools } from '../public/pages/shop-tools.js';
import { createToolRegistry } from '../public/shared/webmcp.js';
import { createDemoServer } from '../scripts/server.mjs';

const names = tools => tools.map(t => t.name).sort();
test('booking tools follow the workflow and confirmation cannot be repeated', async () => {
  const booking = createBooking();
  const tools = () => bookingTools(booking, () => {});
  assert.deepEqual(names(tools()), ['reset_booking', 'search_flights']);
  assert.throws(() => booking.confirm());
  await tools().find(t => t.name === 'search_flights').execute({ from: 'SFO', to: 'JFK', date: '2026-12-01' });
  assert.deepEqual(names(tools()), ['reset_booking', 'search_flights', 'select_flight']);
  assert.throws(() => booking.select({ flight_id: 'missing' }));
  booking.select({ flight_id: 'DM101' });
  assert.deepEqual(names(tools()), ['reset_booking', 'set_passenger']);
  assert.throws(() => booking.passenger({ name: 'Ada', email: 'bad' }));
  booking.passenger({ name: 'Ada', email: 'ada@example.test' });
  assert.deepEqual(names(tools()), ['confirm_booking', 'reset_booking']);
  assert.equal(booking.confirm().selected.price, 12900);
  assert.deepEqual(names(tools()), ['reset_booking']);
  assert.throws(() => booking.confirm());
  booking.reset();
  assert.throws(() => booking.search({ from: 'SFO', to: 'SFO', date: '2026-12-01' }));
  assert.throws(() => booking.search({ from: 'SFO', to: 'JFK', date: '2026-02-30' }));
});
test('shopping totals, persistence, removal and checkout preconditions', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k), setItem: (k,v) => data.set(k,v) };
  const shop = createShop(storage);
  const tools = () => shopTools(shop, () => {});
  assert.deepEqual(names(tools()), ['add_to_cart']);
  assert.throws(() => shop.checkout({ name: 'Ada', address: 'Demo street' }));
  shop.add({ product_id: 'notebook', quantity: 2 });
  shop.add({ product_id: 'mug' });
  assert.equal(shop.state.total, 4200);
  assert.equal(createShop(storage).state.total, 4200);
  assert.deepEqual(names(tools()), ['add_to_cart', 'checkout', 'remove_from_cart']);
  shop.remove({ product_id: 'mug' });
  assert.equal(shop.state.total, 2400);
  assert.throws(() => shop.add({ product_id: '__proto__' }));
  assert.throws(() => shop.add({ product_id: 'bag', quantity: 21 }));
  assert.throws(() => shop.checkout({ name: ' ', address: 'Demo street' }));
  shop.checkout({ name: 'Ada', address: 'Demo street' });
  assert.equal(shop.state.receipt.total, 2400);
  assert.equal(shop.state.items.length, 0);
  assert.equal(createShop(storage).state.total, 0);
  assert.deepEqual(names(tools()), ['add_to_cart']);
});
test('blocked or malformed storage falls back to an in-memory cart', () => {
  const shop = createShop({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
  shop.add({ product_id: 'bag' });
  assert.equal(shop.state.total, 2400);
  assert.equal(shop.state.storageAvailable, false);
});
test('adapter replaces modern registrations, rejects stale calls, and cleans up on pagehide', async () => {
  const registered = new Map();
  const view = new EventTarget();
  const currentDocument = {
    defaultView: view,
    modelContext: { async registerTool(tool, { signal }) {
      assert.equal(registered.has(tool.name), false);
      registered.set(tool.name, tool);
      signal.addEventListener('abort', () => registered.delete(tool.name));
    } }
  };
  const registry = createToolRegistry({ currentDocument, currentNavigator: {} });
  await registry.replace([{ name: 'first', execute: () => 'one' }]);
  const stale = registered.get('first');
  await registry.replace([{ name: 'second', execute: () => 'two' }]);
  assert.deepEqual([...registered.keys()], ['second']);
  await assert.rejects(() => stale.execute({}), /stale/);
  assert.equal(await registered.get('second').execute({}), 'two');
  view.dispatchEvent(new Event('pagehide'));
  assert.equal(registered.size, 0);
});
test('legacy provideContext replaces the complete tool list', async () => {
  let tools = [];
  const view = new EventTarget();
  const registry = createToolRegistry({ currentDocument: { defaultView: view }, currentNavigator: { modelContext: { provideContext(context) { tools = context.tools; } } } });
  await registry.replace([{ name: 'first', execute: () => true }]);
  await registry.replace([{ name: 'second', execute: () => true }]);
  assert.deepEqual(names(tools), ['second']);
  view.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(tools, []);
});
test('server serves all pages, fails the network probe, and contains paths', async t => {
  const server = createDemoServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/booking.html', '/shop.html', '/pages/home.js']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).length > 0);
  }
  assert.equal((await fetch(base + '/ping-test.json')).status, 404);
  assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
  assert.equal((await fetch(base + '/%FF')).status, 400);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
});
