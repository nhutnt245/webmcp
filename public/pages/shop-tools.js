import { tool } from '../shared/webmcp.js';
import { products } from './shop-state.js';
export function shopTools(shop, update) {
  const invoke = method => input => { const result = shop[method](input); update(); return result; };
  const tools = [tool('add_to_cart', 'Add a demo product to the cart; maximum 20 units per product.', {
    product_id: { type: 'string', enum: products.map(p => p.id) }, quantity: { type: 'integer', minimum: 1, maximum: 20, default: 1 }
  }, ['product_id'], invoke('add'))];
  if (shop.state.items.length) tools.push(
    tool('remove_from_cart', 'Remove an entire product line from the current cart.', { product_id: { type: 'string', enum: shop.state.items.map(p => p.id) } }, ['product_id'], invoke('remove')),
    tool('checkout', 'Place a demo order for the current cart. No payment is collected.', { name: { type: 'string', minLength: 1, maxLength: 100 }, address: { type: 'string', minLength: 1, maxLength: 300 } }, ['name', 'address'], invoke('checkout'))
  );
  return tools;
}
