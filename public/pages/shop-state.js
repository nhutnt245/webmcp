export const products = [
  { id: 'notebook', name: 'Field notebook', price: 1200 },
  { id: 'mug', name: 'Blue mug', price: 1800 },
  { id: 'bag', name: 'Canvas bag', price: 2400 }
];
export function createShop(storage) {
  let cart = {};
  let receipt = null;
  let storageAvailable = true;
  try {
    const saved = JSON.parse(storage?.getItem('demo_cart') || '{}');
    if (saved && typeof saved === 'object') for (const product of products) {
      const quantity = saved[product.id];
      if (Number.isInteger(quantity) && quantity > 0 && quantity <= 20) cart[product.id] = quantity;
    }
  } catch { storageAvailable = false; }
  function save() {
    try { storage?.setItem('demo_cart', JSON.stringify(cart)); } catch { storageAvailable = false; }
  }
  return {
    get state() {
      const items = products.filter(p => cart[p.id]).map(p => ({ ...p, quantity: cart[p.id] }));
      return { items, total: items.reduce((sum, p) => sum + p.price * p.quantity, 0), receipt: structuredClone(receipt), storageAvailable };
    },
    add({ product_id, quantity = 1 }) {
      if (!products.some(p => p.id === product_id) || !Number.isInteger(quantity) || quantity < 1 || (cart[product_id] || 0) + quantity > 20) throw new Error('Choose a listed product and quantity from 1 to 20 per product.');
      cart[product_id] = (cart[product_id] || 0) + quantity;
      receipt = null;
      save();
      return this.state;
    },
    remove({ product_id }) {
      if (!Object.hasOwn(cart, product_id)) throw new Error('That product is not in the cart.');
      delete cart[product_id];
      save();
      return this.state;
    },
    checkout({ name, address }) {
      if (!Object.keys(cart).length) throw new Error('Add an item before checkout.');
      if (typeof name !== 'string' || !name.trim() || name.length > 100 || typeof address !== 'string' || !address.trim() || address.length > 300) throw new Error('Enter a demo recipient and delivery address.');
      receipt = { id: 'ORDER-' + crypto.randomUUID().slice(0, 8).toUpperCase(), name: name.trim(), address: address.trim(), total: this.state.total, items: this.state.items };
      cart = {};
      save();
      return this.state;
    }
  };
}
