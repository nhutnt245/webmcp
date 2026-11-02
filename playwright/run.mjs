import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: process.env.HEADED !== '1' });
try {
  const page = await browser.newPage();
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');
  await page.getByLabel('New todo').fill('Book demo flight');
  await page.getByRole('button', { name: 'Add todo', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Book demo flight', exact: true }).check();
  assert.equal(await page.getByRole('checkbox').count(), 1);
  assert.equal(await page.getByRole('checkbox').isChecked(), true);
  assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
  console.log('PASS: DOM driver added Book demo flight and completed it.');
} finally { await browser.close(); }
