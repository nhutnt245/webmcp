import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { chromium } from 'playwright';

function parseOptions(args) {
  let interactive = false;
  let tracePath;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--interactive') interactive = true;
    else if (args[index] === '--trace') {
      tracePath = args[index + 1] && !args[index + 1].startsWith('--')
        ? args[++index]
        : 'artifacts/playwright-trace.zip';
    } else {
      throw new Error(`Unknown option: ${args[index]}\nUsage: node playwright/run.mjs [--interactive] [--trace [path]]`);
    }
  }
  return { interactive, tracePath };
}

const { interactive, tracePath } = parseOptions(process.argv.slice(2));
if (interactive && (!process.stdin.isTTY || !process.stdout.isTTY)) {
  throw new Error('--interactive requires an interactive terminal (TTY stdin and stdout).');
}

const traceFile = tracePath && path.resolve(tracePath);
if (traceFile) await mkdir(path.dirname(traceFile), { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  headless: interactive ? false : process.env.HEADED !== '1',
});
const context = await browser.newContext();
const page = await context.newPage();
const prompt = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;
let traceStarted = false;
let stepNumber = 0;

async function advance() {
  if (prompt) await prompt.question('Press Enter to continue... ');
}

async function locateAndAct({ name, locator, strategy, rationale, expected, action }) {
  stepNumber += 1;
  const count = await locator.count();
  console.log(`\nSTEP ${stepNumber}: ${name}`);
  console.log(`  Locator: ${strategy}`);
  console.log(`  Rationale: ${rationale}`);
  console.log(`  Evidence: matched ${count} element${count === 1 ? '' : 's'}; expected ${expected}.`);
  assert.equal(count, expected, `${name}: unexpected locator match count`);

  if (interactive) {
    await locator.evaluate(element => {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
      element.style.outline = '4px solid #e11d48';
      element.style.outlineOffset = '3px';
      element.style.boxShadow = '0 0 0 6px #fff';
    });
    console.log('  Target highlighted in the visible browser.');
  }
  await advance();
  const outcome = await action();
  console.log(`  Outcome: ${outcome}`);
}

try {
  if (traceFile) {
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    traceStarted = true;
  }

  stepNumber += 1;
  console.log(`\nSTEP ${stepNumber}: Navigate to the todo demo`);
  console.log(`  Target: ${process.env.DEMO_URL ?? 'http://127.0.0.1:3000'}`);
  console.log('  Rationale: the demo page is the fixed starting point for this deterministic flow.');
  await advance();
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');
  console.log(`  Outcome: loaded ${page.url()}.`);

  const title = 'Book demo flight';
  const input = page.getByLabel('New todo', { exact: true });
  await locateAndAct({
    name: 'Locate and fill the new-todo input',
    locator: input,
    strategy: "getByLabel('New todo', { exact: true })",
    rationale: 'the visible accessible label identifies the input without depending on its CSS layout or position.',
    expected: 1,
    action: async () => { await input.fill(title); return `filled the input with ${JSON.stringify(title)}.`; },
  });

  const addButton = page.getByRole('button', { name: 'Add todo', exact: true });
  await locateAndAct({
    name: 'Locate and click the Add todo button',
    locator: addButton,
    strategy: "getByRole('button', { name: 'Add todo', exact: true })",
    rationale: 'the button role and exact accessible name distinguish the intended submit control.',
    expected: 1,
    action: async () => { await addButton.click(); return `clicked Add todo; a checkbox for ${JSON.stringify(title)} is now available.`; },
  });

  const checkbox = page.getByRole('checkbox', { name: title, exact: true });
  await locateAndAct({
    name: 'Locate and check the new todo',
    locator: checkbox,
    strategy: `getByRole('checkbox', { name: ${JSON.stringify(title)}, exact: true })`,
    rationale: 'the checkbox role plus its todo label targets this item among any other todo controls.',
    expected: 1,
    action: async () => { await checkbox.check(); return 'checked the todo.'; },
  });

  assert.equal(await page.getByRole('checkbox').count(), 1);
  assert.equal(await checkbox.isChecked(), true);
  assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
  console.log('\nFLOW COMPLETE: 1 checkbox, checked=true, summary="1 of 1 complete".');
} catch (error) {
  console.error(`\nFLOW FAILED: ${error.message}`);
  try {
    const screenshotPath = path.resolve('artifacts/playwright-failure.png');
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`Failure screenshot: ${screenshotPath}`);
  } catch (screenshotError) {
    console.error(`Could not save failure screenshot: ${screenshotError.message}`);
  }
  throw error;
} finally {
  prompt?.close();
  if (traceStarted) {
    try {
      await context.tracing.stop({ path: traceFile });
      console.log(`Trace saved: ${traceFile}`);
    } catch (traceError) {
      console.error(`Could not save trace: ${traceError.message}`);
    }
  }
  await context.close();
  await browser.close();
}
