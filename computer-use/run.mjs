import { chromium } from 'playwright';
import { act } from './actions.mjs';

const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error('Set ANTHROPIC_API_KEY in your shell; this demo makes paid API calls.');
const maxTurns = Number(process.env.MAX_TURNS ?? 20);
if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 100) throw new Error('MAX_TURNS must be an integer from 1 to 100');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: process.env.HEADED !== '1' });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');
  const messages = [{ role: 'user', content: [
    { type: 'text', text: 'On the open todo demo, add exactly one todo titled Book demo flight, then mark it complete. Verify the visible page says 1 of 1 complete. Use only the computer tool. The tool controls a browser content viewport, not an OS desktop. Stay on this page. When finished, explain the result.' },
    await act(page, { action: 'screenshot' }),
  ] }];
  for (let turn = 1; turn <= maxTurns; turn++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: AbortSignal.timeout(120_000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'computer-use-2025-11-24' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6', max_tokens: 2048,
        tools: [{ type: 'computer_20251124', name: 'computer', display_width_px: 1024, display_height_px: 768 }], messages,
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API returned HTTP ${response.status}; check key, model access, and tool compatibility.`);
    const answer = await response.json();
    messages.push({ role: 'assistant', content: answer.content });
    const calls = answer.content.filter(block => block.type === 'tool_use');
    for (const block of answer.content) if (block.type === 'text') console.log(block.text);
    if (!calls.length) {
      if (answer.stop_reason !== 'end_turn') throw new Error(`Model stopped without completion: ${answer.stop_reason}`);
      console.log('Model ended its turn. This is a model claim; inspect artifacts/computer-final.png to confirm.');
      await page.screenshot({ path: await artifactPath() });
      break;
    }
    console.log(`Turn ${turn}/${maxTurns}: ${calls.map(call => call.input.action).join(', ')}`);
    const results = [];
    for (const call of calls) {
      try {
        if (call.name !== 'computer') throw new Error('Unknown tool');
        results.push({ type: 'tool_result', tool_use_id: call.id, content: [await act(page, call.input)] });
      } catch (error) {
        results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: [{ type: 'text', text: error.message }] });
      }
    }
    messages.push({ role: 'user', content: results });
    if (turn === maxTurns) throw new Error('Turn limit reached before completion; increase MAX_TURNS if needed.');
  }
} finally { await browser.close(); }
async function artifactPath() {
  const { mkdir } = await import('node:fs/promises');
  await mkdir('artifacts', { recursive: true });
  return 'artifacts/computer-final.png';
}
