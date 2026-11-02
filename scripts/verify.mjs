import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { startServer } from './server.mjs';
import { act } from '../computer-use/actions.mjs';

const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}`;
const artifactDir = await mkdtemp(path.join(os.tmpdir(), 'webmcp-playwright-'));
let browser;
try {
  const tracePath = path.join(artifactDir, 'playwright-trace.zip');
  const playwrightRun = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['playwright/run.mjs', '--trace', tracePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DEMO_URL: url },
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`playwright/run.mjs exited ${code}:\n${output}`)));
  });
  assert.match(playwrightRun, /STEP 1: Navigate to the todo demo/);
  assert.match(playwrightRun, /getByLabel\('New todo', \{ exact: true \}\)/);
  assert.match(playwrightRun, /getByRole\('button', \{ name: 'Add todo', exact: true \}\)/);
  assert.match(playwrightRun, /matched 1 element; expected 1/);
  assert.match(playwrightRun, /FLOW COMPLETE: 1 checkbox, checked=true, summary="1 of 1 complete"/);
  assert.match(playwrightRun, /Trace saved:/);
  assert.doesNotMatch(playwrightRun, /Press Enter to continue/);
  assert.ok((await stat(tracePath)).size > 0, 'Playwright trace should be recorded');
  console.log('PASS: Playwright flow emits locator evidence and records a noninteractive trace.');

  const interactiveWithoutTty = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['playwright/run.mjs', '--interactive'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, DEMO_URL: url },
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => resolve({ code, output }));
  });
  assert.notEqual(interactiveWithoutTty.code, 0);
  assert.match(interactiveWithoutTty.output, /--interactive requires an interactive terminal/);
  console.log('PASS: interactive mode rejects non-TTY input without launching or hanging.');

  for (const script of ['webmcp/run.mjs']) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script], { stdio: 'inherit', env: { ...process.env, DEMO_URL: url } });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
    });
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage();
  await page.goto(url);
  const result = await page.evaluate(async () => {
    await window.demoReady;
    const call = window.todoTools.call;
    const invalidTitle = await call('add_todo', { title: '  ' });
    const missingTodo = await call('complete_todo', { id: 99, completed: true });
    const invalidCompletion = await call('complete_todo', { id: 1, completed: 'yes' });
    const hostileText = '<img src=x onerror=alert(1)>';
    await call('add_todo', { title: hostileText });
    return { invalidTitle, missingTodo, invalidCompletion, state: await call('list_todos'), hostileText };
  });
  assert.ok(result.invalidTitle.error);
  assert.ok(result.missingTodo.error);
  assert.ok(result.invalidCompletion.error);
  assert.deepEqual(result.state.todos, [{ id: 1, title: result.hostileText, completed: false }]);
  assert.equal(await page.locator('#todos img').count(), 0);
  assert.equal(await page.getByRole('checkbox').getAttribute('type'), 'checkbox');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  assert.equal(await page.locator('#summary').textContent(), '0 of 0 complete');
  assert.equal((await fetch(`${url}/.env`)).status, 404);
  // Exercise the pixel transport without spending an API key. DOM is the test oracle.
  const box = await page.getByLabel('New todo').boundingBox();
  const shot = await act(page, { action: 'left_click', coordinate: [box.x + 10, box.y + 10] });
  assert.equal(shot.source.media_type, 'image/png');
  assert.ok(Buffer.from(shot.source.data, 'base64').length > 100);
  await act(page, { action: 'type', text: 'Book demo flight' });
  await act(page, { action: 'key', text: 'Return' });
  const checkbox = await page.getByRole('checkbox', { name: 'Book demo flight' }).boundingBox();
  await act(page, { action: 'left_click', coordinate: [checkbox.x + 5, checkbox.y + 5] });
  assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
  await assert.rejects(act(page, { action: 'wait', duration: -1 }), /Duration/);
  console.log('PASS: computer screenshot/mouse/keyboard adapter (no model calls).');
  console.log('PASS: invalid tools leave state intact; text renders safely; reset and server boundaries work.');
} finally {
  await browser?.close();
  await rm(artifactDir, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
}
