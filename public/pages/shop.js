import { installLayout, element, button, money, attempt } from '../shared/ui.js';
import { createToolsPanel } from '../shared/webmcp.js';
import { createShop, products } from './shop-state.js';
import { shopTools } from './shop-tools.js';
installLayout();
let storage;
try { storage = localStorage; } catch { /* In-memory shopping still works. */ }
const shop = createShop(storage);
const tools = createToolsPanel();
const checkout = document.querySelector('#checkout-form');
for (const product of products) {
  const card = element('article', undefined, { class: 'card' });
  card.append(element('h2', product.name), element('p', money(product.price)), button(`Add ${product.name}`, () => { shop.add({ product_id: product.id }); render(); }));
  document.querySelector('#products').append(card);
}
checkout.addEventListener('submit', event => {
  event.preventDefault();
  attempt(() => { shop.checkout(Object.fromEntries(new FormData(checkout))); checkout.reset(); render(); });
});
function render() {
  const state = shop.state;
  const cart = document.querySelector('#cart-items');
  cart.replaceChildren();
  if (!state.items.length) cart.append(element('p', 'Your cart is empty.'));
  for (const item of state.items) {
    const row = element('div');
    row.append(element('p', `${item.name} × ${item.quantity} · ${money(item.price * item.quantity)}`), button(`Remove ${item.name}`, () => { shop.remove({ product_id: item.id }); render(); }));
    cart.append(row);
  }
  document.querySelector('#total').textContent = `Total: ${money(state.total)}`;
  checkout.hidden = !state.items.length;
  document.querySelector('#storage-note').textContent = state.storageAvailable && storage ? 'Cart saved locally in this browser.' : 'Storage unavailable; cart lasts for this page visit.';
  const receipt = document.querySelector('#receipt');
  receipt.hidden = !state.receipt;
  receipt.replaceChildren();
  if (state.receipt) receipt.append(element('h2', 'Demo order placed'), element('p', `${state.receipt.id} · ${money(state.receipt.total)}`), element('p', `${state.receipt.name} · ${state.receipt.address}`));
  tools.replace(shopTools(shop, render));
}
render();
