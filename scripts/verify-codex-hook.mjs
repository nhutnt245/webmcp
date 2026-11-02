// Behavioral checks for the Codex tool-call observer. Events follow the documented
// PreToolUse/PostToolUse schema (https://learn.chatgpt.com/docs/hooks); they are fixtures,
// not evidence about a live Codex session. The hook runs through its configured command
// from a subdirectory of a throwaway git repository that holds a copy of the recorder.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const hooksConfig = JSON.parse(await readFile(new URL('../.codex/hooks.json', import.meta.url), 'utf8'));
const windows = process.platform === 'win32';
const command = event => {
  const [group] = hooksConfig.hooks[event];
  assert.equal(group.hooks.length, 1);
  assert.equal(group.hooks[0].type, 'command');
  return windows ? group.hooks[0].commandWindows : group.hooks[0].command;
};

const parent = await mkdtemp(path.join(os.tmpdir(), 'codex-hook-'));
const repo = path.join(parent, 'repo');
const sub = path.join(repo, 'deep', 'subdirectory');
await mkdir(sub, { recursive: true });
execFileSync('git', ['init', '-q'], { cwd: repo });
await mkdir(path.join(repo, '.codex'), { recursive: true });
await cp(new URL('../.codex/hooks', import.meta.url), path.join(repo, '.codex', 'hooks'), { recursive: true });
const traces = path.join(repo, 'artifacts', 'codex-hooks');

// Runs the configured hook command with `input` on stdin; a stuck child is killed after 20s.
function runHook(event, input, cwd = sub) {
  return new Promise((resolve, reject) => {
    const child = spawn(command(event), { cwd, shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}
const base = { session_id: 'session-1', turn_id: 'turn-1', cwd: sub, model: 'test-model', permission_mode: 'default', transcript_path: null };
const pre = (toolUseId, toolName, toolInput, extra = {}) => ({ ...base, hook_event_name: 'PreToolUse', tool_use_id: toolUseId, tool_name: toolName, tool_input: toolInput, ...extra });
const post = (toolUseId, toolName, toolInput, toolResponse, extra = {}) => ({ ...pre(toolUseId, toolName, toolInput, extra), hook_event_name: 'PostToolUse', tool_response: toolResponse });
const readEvents = async session => (await readFile(path.join(traces, session, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
const listing = dir => readdir(dir, { recursive: true });
// Public 1x1 PNG, so the expected bytes come from outside the recorder.
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const png = Buffer.from(pngBase64, 'base64');

try {
  // Paired pre/post events keep their IDs, arguments and result exactly as supplied.
  const input = { action: 'click', coordinate: [10, 20], nested: { list: [1, 'two', null] } };
  const result = { content: [{ type: 'text', text: 'Clicked at 10,20' }], structuredContent: { ok: true } };
  for (const [event, payload] of [['PreToolUse', pre('call-1', 'mcp__computer__click', input)], ['PostToolUse', post('call-1', 'mcp__computer__click', input, result)]]) {
    const outcome = await runHook(event, payload);
    assert.equal(outcome.code, 0, outcome.stderr);
    assert.equal(outcome.stdout, '', 'hook must not print decisions or context');
  }
  const [first, second] = await readEvents('session-1');
  assert.deepEqual([first.hook_event_name, second.hook_event_name], ['PreToolUse', 'PostToolUse']);
  for (const record of [first, second]) {
    assert.equal(record.tool_use_id, 'call-1');
    assert.equal(record.turn_id, 'turn-1');
    assert.equal(record.tool_name, 'mcp__computer__click');
    assert.deepEqual(record.tool_input, input);
    assert.ok(!Number.isNaN(Date.parse(record.recordedAt)));
  }
  assert.equal('tool_response' in first, false, 'no result is invented for the pre event');
  assert.deepEqual(second.tool_response, result);
  assert.deepEqual(await readdir(parent), ['repo'], 'nothing is written outside the repository');
  console.log('PASS: paired pre/post events preserve IDs, input and result via the configured command from a subdirectory.');

  // Embedded images become files; references and non-image data stay as supplied.
  const reference = { type: 'image', url: 'https://example.invalid/screen.png', path: '/tmp/screen.png' };
  const notBase64 = { type: 'image', data: 'not base64!', mimeType: 'image/png' };
  const unsupported = { type: 'image', data: pngBase64, mimeType: 'image/svg+xml' };
  const imageResult = { content: [{ type: 'image', data: pngBase64, mimeType: 'image/png' }, { type: 'text', text: 'Screenshot' }, reference, notBase64, unsupported], more: { image_url: `data:image/png;base64,${pngBase64}` } };
  assert.equal((await runHook('PostToolUse', post('shot-1', 'mcp__computer__screenshot', {}, imageResult, { session_id: 'images' }))).code, 0);
  const [imageEvent] = await readEvents('images');
  const [block, text, ...rest] = imageEvent.tool_response.content;
  assert.deepEqual(block, { type: 'image', mimeType: 'image/png', savedImage: 'images/shot-1-post-1.png' });
  assert.deepEqual(text, { type: 'text', text: 'Screenshot' });
  assert.deepEqual(rest, [reference, notBase64, unsupported]);
  assert.deepEqual(imageEvent.tool_response.more.image_url, { savedImage: 'images/shot-1-post-2.png' });
  for (const file of ['shot-1-post-1.png', 'shot-1-post-2.png']) assert.deepEqual(await readFile(path.join(traces, 'images', 'images', file)), png);
  assert.deepEqual((await listing(path.join(traces, 'images', 'images'))).sort(), ['shot-1-post-1.png', 'shot-1-post-2.png']);
  const logText = await readFile(path.join(traces, 'images', 'events.jsonl'), 'utf8');
  assert.equal(logText.split(pngBase64).length - 1, 1, 'only the unsupported-type block keeps inline data');
  console.log('PASS: embedded images are saved as files; references and unsupported data are preserved, not fetched.');

  // Errors and plain-string results are preserved verbatim.
  const failed = { isError: true, content: [{ type: 'text', text: 'target app is not visible' }] };
  await runHook('PostToolUse', post('err-1', 'mcp__computer__click', { x: 1 }, failed, { session_id: 'errors' }));
  await runHook('PostToolUse', post('bash-1', 'Bash', { command: 'false' }, 'exit 1\nstderr text', { session_id: 'errors' }));
  const [errorEvent, bashEvent] = await readEvents('errors');
  assert.deepEqual(errorEvent.tool_response, failed);
  assert.equal(bashEvent.tool_response, 'exit 1\nstderr text');
  console.log('PASS: error and string results are preserved verbatim.');

  // Sessions are separated and hostile identifiers cannot escape the trace folder.
  await runHook('PreToolUse', pre('a', 'tool', {}, { session_id: 'other-session' }));
  assert.equal((await readEvents('other-session')).length, 1);
  assert.equal((await readEvents('session-1')).length, 2);
  const hostile = await runHook('PostToolUse', post('../../escape', 'tool', {}, { content: [{ type: 'image', data: pngBase64, mimeType: 'image/png' }] }, { session_id: '../../../escape' }));
  assert.equal(hostile.code, 0, hostile.stderr);
  const sessions = await readdir(traces);
  assert.ok(sessions.every(name => !name.includes('.')), `unexpected session folders: ${sessions}`);
  assert.deepEqual((await readdir(repo)).sort(), ['.codex', '.git', 'artifacts', 'deep']);
  assert.deepEqual((await readdir(parent)).sort(), ['repo']);
  console.log('PASS: sessions are separated and hostile IDs stay inside artifacts/codex-hooks.');

  // Concurrent hooks (Codex launches matching hooks in parallel) leave intact JSON lines.
  await Promise.all(Array.from({ length: 12 }, (_, index) => runHook('PreToolUse', pre(`parallel-${index}`, 'tool', { index }, { session_id: 'parallel' }))));
  const parallel = await readEvents('parallel');
  assert.deepEqual(parallel.map(record => record.tool_input.index).sort((a, b) => a - b), Array.from({ length: 12 }, (_, index) => index));
  console.log('PASS: concurrent invocations append intact records.');

  // Malformed input and unsupported events never print, never block (exit code 2), and name the problem.
  for (const bad of ['{not json', '[]', 'null', '']) {
    const outcome = await runHook('PreToolUse', bad);
    assert.equal(outcome.stdout, '');
    assert.equal(outcome.code, 1, `input ${JSON.stringify(bad)}`);
    assert.match(outcome.stderr, /codex tool trace: /);
  }
  const before = await listing(traces);
  const ignored = await runHook('PreToolUse', { ...base, hook_event_name: 'SessionStart', session_id: 'ignored' });
  assert.deepEqual([ignored.code, ignored.stdout], [0, '']);
  assert.match(ignored.stderr, /ignoring SessionStart/);
  assert.deepEqual(await listing(traces), before);
  console.log('PASS: malformed input fails visibly on stderr without output or blocking; other events are ignored.');

  // A recording failure (artifacts is a file) is reported on stderr without a decision.
  await rm(path.join(repo, 'artifacts'), { recursive: true });
  await writeFile(path.join(repo, 'artifacts'), 'not a directory');
  const blocked = await runHook('PostToolUse', post('x', 'tool', {}, 'ok'));
  assert.deepEqual([blocked.code, blocked.stdout], [1, '']);
  assert.match(blocked.stderr, /codex tool trace: /);
  console.log('PASS: recording failures are visible on stderr and never block the tool.');
} finally {
  await rm(parent, { recursive: true, force: true });
}
