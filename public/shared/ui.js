export function element(tag, text, attrs = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
export function button(text, action) {
  const node = element('button', text, { type: 'button' });
  node.addEventListener('click', () => attempt(action));
  return node;
}
export function attempt(action) {
  const message = document.querySelector('#message');
  if (message) message.textContent = '';
  try { return action(); } catch (error) {
    if (message) message.textContent = error.message;
  }
}
export const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export function installLayout() {
  const params = new URLSearchParams(location.search);
  document.querySelectorAll('nav a').forEach(link => {
    const url = new URL(link.href);
    for (const key of ['seed', 'key']) if (params.has(key)) url.searchParams.set(key, params.get(key));
    link.href = url;
    if (url.pathname === location.pathname || (location.pathname === '/' && url.pathname === '/index.html')) link.setAttribute('aria-current', 'page');
  });
}
