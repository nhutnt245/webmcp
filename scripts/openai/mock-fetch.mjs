// Test-only preload (`node --import`): answers POST https://api.openai.com/v1/responses from a scenario file, so the
// real CLI can run offline without a production base-URL option. Scenario: { responses: [{ status, body }], recordTo }.
import { readFileSync, writeFileSync } from 'node:fs';

const scenario = JSON.parse(readFileSync(process.env.OPENAI_MOCK_SCENARIO, 'utf8'));
const queue = [...scenario.responses];
const requests = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url) !== 'https://api.openai.com/v1/responses') return realFetch(url, init);
  requests.push({ method: init.method, authorization: init.headers?.Authorization, hasSignal: Boolean(init.signal), body: JSON.parse(init.body) });
  writeFileSync(scenario.recordTo, JSON.stringify(requests));
  const next = queue.shift() ?? { status: 500, body: { error: { code: 'mock_exhausted' } } };
  return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'Content-Type': 'application/json' } });
};
