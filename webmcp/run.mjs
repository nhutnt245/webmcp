import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Playwright only transports JavaScript into the page; it does not click or fill.
const native = process.argv.includes('--native');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  headless: process.env.HEADED !== '1',
  args: native ? ['--enable-features=WebMCPTesting'] : [],
});
try {
  const page = await browser.newPage();
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');
  const result = await page.evaluate(async native => {
    await window.demoReady;
    const context = document.modelContext ?? navigator.modelContext;
    if (native && (typeof context?.getTools !== 'function' || typeof context?.executeTool !== 'function' || window.todoTools.registration.includes('failed'))) {
      throw new Error('Native WebMCP consumer API unavailable. Use a compatible experimental Chrome or omit --native for the local fallback.');
    }
    const tools = native ? await context.getTools() : window.todoTools.list();
    async function call(name, args) {
      if (!native) return window.todoTools.call(name, args);
      const tool = tools.find(t => t.name === name);
      if (!tool) throw new Error(`Missing native tool: ${name}`);
      let output;
      try { output = await context.executeTool(tool, args); }
      catch (error) {
        if (!error.message.startsWith('Failed to parse input')) throw error;
        output = await context.executeTool(tool, JSON.stringify(args));
      }
      return typeof output === 'string' ? JSON.parse(output) : output;
    }
    const added = await call('add_todo', { title: 'Book demo flight' });
    if (added.error) throw new Error(added.error);
    await call('complete_todo', { id: added.todo.id, completed: true });
    return { registration: window.todoTools.registration, transport: native ? 'native WebMCP' : 'local structured-tool fallback', tools: tools.map(t => t.name), state: await call('list_todos', {}) };
  }, native);
  assert.deepEqual(result.state.todos.map(({ title, completed }) => ({ title, completed })), [{ title: 'Book demo flight', completed: true }]);
  assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
  console.log('PASS:', JSON.stringify(result, null, 2));
} finally { await browser.close(); }
