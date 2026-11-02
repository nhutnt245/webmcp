// Offline checks for the OpenAI Responses computer-use demo: no API key, no network, no paid call.
// Model replies are documented fixtures (scripts/openai/fixtures.mjs); the browser is a real local Chromium and the
// todo outcome is judged from the DOM, which never reaches the model loop.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createResponse } from '../computer-use/openai-api.mjs';
import { normalizeKey, runActions } from '../computer-use/openai-actions.mjs';
import { runComputerUse } from '../computer-use/openai-loop.mjs';
import { taskPrompt, viewport } from '../computer-use/task.mjs';
import { startServer } from './server.mjs';
import * as fx from './openai/fixtures.mjs';

const root = path.resolve(import.meta.dirname, '..');
const server = await startServer(0);
const url = `http://127.0.0.1:${server.address().port}`;
const tmp = await mkdtemp(path.join(os.tmpdir(), 'webmcp-openai-'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
const secret = 'sk-test-secret-0123456789';
const pass = message => console.log(`PASS: ${message}`);

async function freshPage(target = url) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(target);
  return page;
}
const centre = box => ({ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) });
const replay = (responses, requests = []) => async body => {
  requests.push(structuredClone(body));
  const next = responses.shift();
  if (!next) throw new Error('fixture exhausted');
  return next;
};
const silent = () => {};
const png = dataUrl => Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');

try {
  // Pixel coordinates a model would read off the screenshots, measured on a probe page.
  const probe = await freshPage();
  const input = centre(await probe.getByLabel('New todo').boundingBox());
  await probe.getByLabel('New todo').fill('Book demo flight');
  await probe.getByRole('button', { name: 'Add todo' }).click();
  const checkbox = centre(await probe.getByRole('checkbox').boundingBox());
  await probe.close();
  const flow = () => fx.todoFlow({ input, checkbox });

  // 1. Full flow: request/continuation payloads, action order, and independent DOM verification.
  {
    const page = await freshPage();
    const requests = [];
    const logs = [];
    const responses = flow();
    const result = await runComputerUse({ page, model: 'gpt-6.1-sol', prompt: taskPrompt, maxTurns: 6, log: line => logs.push(line), createResponse: replay([...responses], requests) });
    assert.deepEqual(result.actions, ['screenshot', 'click', 'type', 'keypress', 'click']);
    assert.equal(result.turns, 4);
    assert.equal(requests.length, 4);
    assert.deepEqual(requests[0], { model: 'gpt-6.1-sol', tools: [{ type: 'computer' }], input: taskPrompt });
    const calls = ['call_1', 'call_2', 'call_3'];
    const images = [];
    requests.slice(1).forEach((request, index) => {
      assert.deepEqual(Object.keys(request).sort(), ['input', 'model', 'previous_response_id', 'tools']);
      assert.deepEqual(request.tools, [{ type: 'computer' }]);
      assert.equal(request.previous_response_id, responses[index].id);
      assert.equal(request.input.length, 1);
      const [item] = request.input;
      assert.deepEqual(Object.keys(item).sort(), ['call_id', 'output', 'type']);
      assert.equal(item.type, 'computer_call_output');
      assert.equal(item.call_id, calls[index]);
      assert.deepEqual(Object.keys(item.output).sort(), ['detail', 'image_url', 'type']);
      assert.equal(item.output.type, 'computer_screenshot');
      assert.equal(item.output.detail, 'original');
      assert.match(item.output.image_url, /^data:image\/png;base64,/);
      const bytes = png(item.output.image_url);
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [1024, 768]);
      images.push(item.output.image_url);
    });
    assert.notEqual(images[0], images[1], 'typing must change the screenshot returned to the model');
    assert.notEqual(images[1], images[2], 'completing the todo must change the screenshot returned to the model');
    assert.doesNotMatch(JSON.stringify(requests), /tool_result|tool_use|anthropic/i);
    assert.ok(!logs.join('\n').match(/base64|[A-Za-z0-9+/]{200,}/), 'logs must not contain screenshot data');
    assert.match(logs.join('\n'), /Turn 2\/6: click, type, keypress/);
    // Independent verification, outside anything the model saw.
    assert.equal(await page.locator('#summary').textContent(), '1 of 1 complete');
    assert.equal(await page.getByRole('checkbox', { name: 'Book demo flight' }).isChecked(), true);
    assert.equal(await page.locator('#todos li').count(), 1);
    await page.close();
    pass('OpenAI loop sends task, matching call_id screenshots and previous_response_id; DOM confirms 1 of 1 complete.');
  }

  // 2. Action adapter against a real page.
  {
    const page = await freshPage('about:blank');
    await page.setContent(`<body style="margin:0;height:6000px"><textarea id="t" style="width:300px;height:100px"></textarea>
      <div id="pad" style="width:400px;height:300px;background:#ccc"></div><script>
      window.log = [];
      for (const type of ['mousedown', 'mouseup', 'dblclick', 'mousemove', 'contextmenu'])
        document.addEventListener(type, e => log.push([type, e.button, e.clientX, e.clientY, e.ctrlKey, e.shiftKey]), true);
      document.addEventListener('keydown', e => log.push(['keydown', e.key, e.ctrlKey, e.shiftKey]), true);
      </script></body>`);
    const log = () => page.evaluate(() => { const copy = window.log; window.log = []; return copy; });
    await runActions(page, [{ type: 'click', button: 'right', x: 50, y: 150 }]);
    await runActions(page, [{ type: 'click', button: 'wheel', x: 60, y: 160 }]);
    await runActions(page, [{ type: 'click', x: 70, y: 170 }]);
    assert.deepEqual((await log()).filter(e => e[0] === 'mousedown').map(e => e.slice(1, 4)), [[2, 50, 150], [1, 60, 160], [0, 70, 170]]);
    await runActions(page, [{ type: 'double_click', x: 80, y: 180 }]);
    assert.equal((await log()).filter(e => e[0] === 'dblclick').length, 1);
    await runActions(page, [{ type: 'click', x: 90, y: 190, keys: ['CTRL', 'SHIFT'] }]);
    assert.deepEqual((await log()).filter(e => e[0] === 'mousedown').map(e => e.slice(4)), [[true, true]]);
    await runActions(page, [{ type: 'click', x: 90, y: 190 }]);
    assert.deepEqual((await log()).filter(e => e[0] === 'mousedown').map(e => e.slice(4)), [[false, false]], 'modifiers must be released after the action');
    await runActions(page, [{ type: 'drag', path: [{ x: 10, y: 120 }, [20, 130], { x: 30, y: 140 }] }]);
    const drag = await log();
    assert.deepEqual(drag.map(e => e[0]), ['mousemove', 'mousedown', 'mousemove', 'mousemove', 'mouseup']);
    assert.deepEqual(drag.filter(e => e[0] !== 'mouseup').map(e => [e[2], e[3]]), [[10, 120], [10, 120], [20, 130], [30, 140]]);
    await runActions(page, [{ type: 'move', x: 5, y: 6 }]);
    assert.deepEqual((await log()).map(e => e.slice(0, 4)), [['mousemove', 0, 5, 6]]);
    await runActions(page, [{ type: 'scroll', x: 100, y: 150, scroll_x: 0, scroll_y: 300 }]);
    await page.waitForFunction(() => scrollY === 300);
    // Ordered batch: focus, type, select all, delete.
    await page.evaluate(() => window.scrollTo(0, 0));
    await runActions(page, [{ type: 'click', x: 20, y: 20 }, { type: 'type', text: 'hello' }, { type: 'keypress', keys: ['CTRL', 'A'] }]);
    assert.equal(await page.locator('#t').inputValue(), 'hello');
    await log();
    await runActions(page, [{ type: 'keypress', keys: ['BACKSPACE'] }]);
    assert.equal(await page.locator('#t').inputValue(), '');
    await runActions(page, [{ type: 'type', text: 'hello' }]);
    assert.equal(await page.locator('#t').inputValue(), 'hello');
    await log();
    await runActions(page, [{ type: 'keypress', keys: ['enter'] }, { type: 'keypress', keys: ['SHIFT', 'TAB'] }]);
    assert.deepEqual((await log()).filter(e => e[0] === 'keydown').map(e => [e[1], e[3]]), [['Enter', false], ['Shift', true], ['Tab', true]]);
    assert.equal(await page.locator('#t').inputValue(), 'hello\n');
    const started = Date.now();
    await runActions(page, [{ type: 'wait' }], { waitMs: 60 });
    assert.ok(Date.now() - started >= 55);
    assert.equal(normalizeKey('CMD'), 'Meta');
    assert.equal(normalizeKey('arrowleft'), 'ArrowLeft');
    assert.equal(normalizeKey('a'), 'a');
    await page.close();
    pass('adapter maps buttons, modifiers, drag paths, scroll pixels, typing, and keys in order on a real page.');
  }

  // 3. Malformed and unsupported actions are rejected before anything executes.
  {
    const page = await freshPage();
    const rejected = [
      [[{ type: 'zoom' }], /Action 1: Unsupported action type/],
      [[{ type: 'click', x: '1', y: 2 }], /x must be a number/],
      [[{ type: 'click', x: 2000, y: 10 }], /inside the 1024px viewport/],
      [[{ type: 'click', x: 10, y: -1 }], /y must be a number inside the 768px viewport/],
      [[{ type: 'click', x: 1, y: 1, button: 'back' }], /Unsupported mouse button/],
      [[{ type: 'click', x: 1, y: 1, keys: ['Q'] }], /Only Ctrl, Shift, Alt, and Meta/],
      [[{ type: 'drag', path: [{ x: 1, y: 1 }] }], /drag needs a path/],
      [[{ type: 'drag', path: [{ x: 1, y: 1 }, { x: 'a', y: 2 }] }], /x must be a number/],
      [[{ type: 'keypress', keys: [] }], /keypress needs/],
      [[{ type: 'type', text: 5 }], /type needs text/],
      [[{ type: 'scroll', x: 1, y: 1, scroll_y: Infinity }], /scroll_y must be/],
      [['click'], /Expected an action object/],
      [[], /no actions/],
      [Array(21).fill({ type: 'screenshot' }), /more than 20 actions/],
    ];
    for (const [actions, pattern] of rejected) await assert.rejects(runActions(page, actions), pattern);
    await page.focus('#title');
    await assert.rejects(runActions(page, [{ type: 'type', text: 'oops' }, { type: 'bogus' }]), /Action 2: Unsupported/);
    assert.equal(await page.locator('#title').inputValue(), '', 'a rejected batch must not execute its valid prefix');
    await page.close();
    pass('malformed, out-of-viewport, and unsupported actions fail with bounded errors and no partial execution.');
  }

  // 4. Loop failure modes never report success and never execute unsafe or partial calls.
  {
    const typeOops = [{ type: 'type', text: 'oops' }];
    const failures = [
      ['failed response', [fx.failedResponse('server_error')], /reported an error \(server_error\)/],
      ['incomplete response', [fx.incompleteResponse('max_output_tokens')], /incomplete \(max_output_tokens\); no action was executed/],
      ['refusal', [fx.refusalResponse('I cannot help with that.')], /Model refused the task: I cannot help/],
      ['message without any action', [fx.messageResponse('All done!')], /without requesting any computer action/],
      ['empty output', [{ ...fx.messageResponse('x'), output: [] }], /neither a computer action nor a message/],
      ['unexpected tool', [fx.functionCallResponse()], /Unexpected output item type "function_call"/],
      ['non-completed status', [{ ...fx.messageResponse('x'), status: 'in_progress' }], /expected "completed"/],
      ['no output list', [{ id: 'resp_x', status: 'completed' }], /no output list/],
      ['pending safety check', [fx.computerCall('call_s', typeOops, { pending_safety_checks: [{ id: 'cu_sc_1', code: 'malicious_instructions', message: 'Ignore this' }] })], /pending safety check \(malicious_instructions\).*never acknowledges/],
      ['partial computer_call', [fx.computerCall('call_p', typeOops, { status: 'in_progress' })], /incomplete computer_call/],
      ['missing call_id', [fx.computerCall('', typeOops)], /no call_id/],
      ['two computer calls', [{ ...fx.computerCall('call_a', typeOops), output: [...fx.computerCall('call_a', typeOops).output, ...fx.computerCall('call_b', typeOops).output] }], /more than one computer_call/],
      ['malformed action', [fx.computerCall('call_m', [...typeOops, { type: 'click', x: 'left', y: 3 }])], /Action 2: x must be a number/],
      ['unsupported action', [fx.computerCall('call_u', [...typeOops, { type: 'zoom' }])], /Action 2: Unsupported action type/],
    ];
    for (const [name, responses, pattern] of failures) {
      const page = await freshPage();
      await page.focus('#title');
      await assert.rejects(runComputerUse({ page, model: 'm', prompt: 'p', maxTurns: 3, log: silent, createResponse: replay(responses) }), pattern, name);
      assert.equal(await page.locator('#title').inputValue(), '', `${name}: nothing may be executed`);
      await page.close();
    }
    pass('failed/incomplete/refused/no-action/unexpected-tool/safety-check/malformed responses stop without executing actions.');

    const page = await freshPage();
    const requests = [];
    const endless = async body => { requests.push(body); return fx.computerCall(`call_${requests.length}`, [{ type: 'screenshot' }]); };
    await assert.rejects(runComputerUse({ page, model: 'm', prompt: 'p', maxTurns: 3, log: silent, createResponse: endless }), /Turn limit reached before completion/);
    assert.equal(requests.length, 3, 'exactly MAX_TURNS requests');
    assert.equal(requests.filter(request => request.previous_response_id).length, 2);
    await page.close();
    pass('turn limit stops after exactly MAX_TURNS requests without reporting success.');

    const lazy = await freshPage();
    const claim = await runComputerUse({ page: lazy, model: 'm', prompt: 'p', maxTurns: 3, log: silent, createResponse: replay([fx.computerCall('call_1', [{ type: 'screenshot' }]), fx.messageResponse('Done, 1 of 1 complete.')]) });
    assert.match(claim.text[0], /1 of 1 complete/);
    assert.equal(await lazy.locator('#summary').textContent(), '0 of 0 complete', 'model text alone is not proof of the todo outcome');
    await lazy.close();
    pass('a model completion claim is not treated as proof; the independent DOM check catches a false claim.');
  }

  // 5. HTTP layer against a stubbed global fetch (no network, no production base-URL option).
  {
    const realFetch = globalThis.fetch;
    const stub = handler => { globalThis.fetch = handler; };
    try {
      let seen;
      stub(async (target, init) => { seen = { target, init }; return Response.json(fx.messageResponse('ok')); });
      const body = { model: 'm', tools: [{ type: 'computer' }], input: 'p' };
      assert.equal((await createResponse(secret, body)).status, 'completed');
      assert.equal(seen.target, 'https://api.openai.com/v1/responses');
      assert.equal(seen.init.method, 'POST');
      assert.equal(seen.init.headers.Authorization, `Bearer ${secret}`);
      assert.equal(seen.init.headers['Content-Type'], 'application/json');
      assert.deepEqual(JSON.parse(seen.init.body), body);
      assert.ok(seen.init.signal instanceof AbortSignal);

      const cases = [
        [401, /HTTP 401: the API key was rejected; check OPENAI_API_KEY/],
        [403, /HTTP 403: .*OPENAI_MODEL and project access/],
        [404, /HTTP 404: .*OPENAI_MODEL/],
        [429, /HTTP 429: rate limit or quota/],
        [400, /HTTP 400: .*supports the computer tool \(invalid_prompt\)/],
        [503, /HTTP 503: OpenAI service error/],
      ];
      for (const [status, pattern] of cases) {
        stub(async () => Response.json({ error: { message: `Incorrect API key provided: ${secret}`, code: status === 400 ? 'invalid_prompt' : null } }, { status }));
        await assert.rejects(createResponse(secret, body), error => {
          assert.match(error.message, pattern);
          assert.ok(!error.message.includes(secret) && !error.message.includes('Incorrect API key'), 'error text must not echo the API message or key');
          return true;
        });
      }
      stub(async () => new Response('<html>nope</html>', { status: 502 }));
      await assert.rejects(createResponse(secret, body), /HTTP 502: OpenAI service error; retry later\.$/);
      stub(async () => new Response('not json', { status: 200 }));
      await assert.rejects(createResponse(secret, body), /not valid JSON/);
      stub(async () => { throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); });
      await assert.rejects(createResponse(secret, body), /before a response arrived \(ECONNREFUSED\)/);
      stub((target, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))));
      await assert.rejects(createResponse(secret, body, { timeoutMs: 20 }), /timed out after 0\.02 seconds/);
    } finally { globalThis.fetch = realFetch; }
    pass('HTTP errors, malformed bodies, network failures, and timeouts produce actionable messages without secrets.');
  }

  // 6. The real CLI, with Responses served from a scenario file through a test-only fetch preload.
  {
    const run = (env, cwd, preload) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [...(preload ? ['--import', path.join(root, 'scripts/openai/mock-fetch.mjs')] : []), path.join(root, 'computer-use/openai-run.mjs')], {
        cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH, CHROMIUM_EXECUTABLE_PATH: process.env.CHROMIUM_EXECUTABLE_PATH, HOME: process.env.HOME, DEMO_URL: url, ...env },
      });
      let output = '';
      // Every CLI run is finite: a hung child is killed and reported instead of stalling the suite.
      const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
      child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
      child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); signal ? reject(new Error(`CLI killed by ${signal} after 60s:\n${output}`)) : resolve({ code, output }); });
    });
    const scenario = async (name, responses) => {
      const dir = await mkdtemp(path.join(tmp, `${name}-`));
      const file = path.join(dir, 'scenario.json');
      await writeFile(file, JSON.stringify({ responses, recordTo: path.join(dir, 'requests.json') }));
      return { dir, env: { OPENAI_MOCK_SCENARIO: file, OPENAI_API_KEY: secret }, requests: () => readFile(path.join(dir, 'requests.json'), 'utf8').then(JSON.parse) };
    };

    const noKey = await run({}, tmp);
    assert.notEqual(noKey.code, 0);
    assert.match(noKey.output, /Set OPENAI_API_KEY in your shell; this demo makes paid OpenAI API calls/);
    const badTurns = await run({ OPENAI_API_KEY: secret, MAX_TURNS: '0' }, tmp);
    assert.notEqual(badTurns.code, 0);
    assert.match(badTurns.output, /MAX_TURNS must be an integer from 1 to 100/);
    pass('CLI fails fast without OPENAI_API_KEY or with an invalid MAX_TURNS, before launching a browser.');

    const ok = await scenario('ok', flow().map(body => ({ status: 200, body })));
    const success = await run({ ...ok.env, MAX_TURNS: '6' }, ok.dir, true);
    assert.equal(success.code, 0, success.output);
    assert.match(success.output, /Turn 1\/6: screenshot/);
    assert.match(success.output, /Turn 2\/6: click, type, keypress/);
    assert.match(success.output, /Turn 3\/6: click/);
    assert.match(success.output, /Model ended its turn\. This is a model claim; inspect artifacts\/openai-computer-final\.png to confirm\./);
    assert.ok(!success.output.includes(secret) && !/base64|[A-Za-z0-9+/]{200,}/.test(success.output), 'output must not contain the key or screenshot data');
    const recorded = await ok.requests();
    assert.equal(recorded.length, 4);
    assert.ok(recorded.every(request => request.authorization === `Bearer ${secret}` && request.method === 'POST' && request.hasSignal));
    assert.ok(recorded.every(request => request.body.model === 'gpt-6.1-sol' && request.body.tools[0].type === 'computer'));
    const artifact = await readFile(path.join(ok.dir, 'artifacts/openai-computer-final.png'));
    assert.deepEqual([artifact.readUInt32BE(16), artifact.readUInt32BE(20)], [1024, 768]);
    assert.notEqual(artifact.toString('base64'), recorded[1].body.input[0].output.image_url.split(',')[1], 'final artifact must show the completed todo, not the initial page');
    pass('CLI runs the fixture flow with the default model, saves artifacts/openai-computer-final.png, and prints the model-claim wording.');

    const denied = await scenario('denied', [{ status: 401, body: { error: { message: `Incorrect API key provided: ${secret}`, code: 'invalid_api_key' } } }]);
    const rejectedRun = await run({ ...denied.env, OPENAI_MODEL: 'gpt-test-model' }, denied.dir, true);
    assert.notEqual(rejectedRun.code, 0);
    assert.match(rejectedRun.output, /HTTP 401: the API key was rejected; check OPENAI_API_KEY \(invalid_api_key\)/);
    assert.ok(!rejectedRun.output.includes(secret));
    assert.doesNotMatch(rejectedRun.output, /Model ended its turn/);
    assert.equal((await denied.requests())[0].body.model, 'gpt-test-model');
    assert.ok((await stat(path.join(denied.dir, 'artifacts/openai-computer-failure.png'))).size > 0);
    pass('CLI exits nonzero on HTTP 401 without leaking the key, honors OPENAI_MODEL, and saves a failure screenshot.');
  }
  console.log('PASS: OpenAI computer-use checks ran offline with no model calls.');
} finally {
  await browser.close();
  await rm(tmp, { recursive: true, force: true });
  await new Promise(resolve => server.close(resolve));
}
