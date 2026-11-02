import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const tracePath = path.resolve('artifacts/playwright-trace.zip');
await mkdir(path.dirname(tracePath), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  headless: process.env.HEADED !== '1',
});
let context;
let traceStarted = false;

try {
  context = await browser.newContext();
  const page = await context.newPage();
  await context.tracing.start({ screenshots: true, snapshots: true });
  traceStarted = true;

  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');

  const title = 'Book demo flight';
  const input = page.getByLabel('New todo', { exact: true });
  assert.equal(await input.count(), 1, 'new-todo input should be unique');
  await input.fill(title);

  const addButton = page.getByRole('button', { name: 'Add todo', exact: true });
  assert.equal(await addButton.count(), 1, 'Add todo button should be unique');
  await addButton.click();

  const checkbox = page.getByRole('checkbox', { name: title, exact: true });
  assert.equal(await checkbox.count(), 1, 'new todo checkbox should be unique');
  await checkbox.check();

  assert.equal(await page.getByRole('checkbox').count(), 1);
  assert.equal(await checkbox.isChecked(), true);
  assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
  console.log('Playwright flow complete: 1 todo added and checked.');
} finally {
  try {
    if (traceStarted) {
      await context.tracing.stop({ path: tracePath });
      console.log(`Trace saved: ${tracePath}`);
    }
  } finally {
    try {
      await context?.close();
    } finally {
      await browser.close();
    }
  }
}
