import { element } from './ui.js';
export function probeValues(seed) {
  function hash(text) {
    let value = 2166136261;
    for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
    return value >>> 0;
  }
  const token = label => 'T' + hash(`${seed}:${label}`).toString(36).toUpperCase().padStart(7, '0');
  return {
    visible_text: token('visible'), accessible_name: 'Close notice ' + token('aria'),
    data_batch: token('data'), css_class: 'flag-' + token('class'),
    background_hex: '#' + (hash(`${seed}:color`) % 0x1000000).toString(16).padStart(6, '0'),
    html_comment: token('comment'), hidden_text: token('hidden'),
    runtime_build: token('runtime'), local_storage: token('storage'),
    console_message: 'probe-console ' + token('console'), failed_request: '/ping-' + token('network') + '.json'
  };
}
export function installProbe() {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') || 'demo';
  const values = probeValues(seed);
  document.querySelector('#reference').textContent = values.visible_text;
  const dismiss = document.querySelector('#dismiss');
  dismiss.setAttribute('aria-label', values.accessible_name);
  dismiss.addEventListener('click', () => document.querySelector('#notice').hidden = true);
  const swatch = document.querySelector('#swatch');
  swatch.dataset.batch = values.data_batch;
  swatch.classList.add(values.css_class);
  swatch.style.backgroundColor = values.background_hex;
  document.body.append(document.createComment(` note: ${values.html_comment} `));
  document.querySelector('#hidden-probe').textContent = values.hidden_text;
  window.__APP_STATE__ = { build: values.runtime_build };
  let storage = 'available';
  try { localStorage.setItem('probe_key', values.local_storage); } catch { storage = 'blocked'; }
  document.querySelector('#storage-status').textContent = `Probe storage: ${storage}.`;
  let runs = 0;
  async function run() {
    document.querySelector('#runs').textContent = `Probe runs: ${++runs}`;
    console.log(values.console_message);
    try {
      const response = await fetch(values.failed_request);
      document.querySelector('#network-result').textContent = `Probe request completed: HTTP ${response.status} (expected 404).`;
    } catch {
      document.querySelector('#network-result').textContent = 'Probe request failed at the transport layer.';
    }
    return { runs };
  }
  document.querySelector('#run-probe').addEventListener('click', run);
  if (params.get('key') === '1') {
    const key = document.querySelector('#answer-key');
    key.hidden = false;
    key.append(element('h2', `Answer key · seed: ${seed}`));
    const table = element('table');
    const body = element('tbody');
    for (const [name, value] of Object.entries(values)) {
      const row = element('tr');
      row.append(element('th', name, { scope: 'row' }), element('td', value));
      body.append(row);
    }
    table.append(body);
    key.append(table);
  }
  return { run };
}
