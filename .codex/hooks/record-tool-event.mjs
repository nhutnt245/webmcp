// Read-only Codex PreToolUse/PostToolUse observer. It records what Codex supplies on stdin
// and never decides, rewrites, or prints anything: stdout stays empty, errors go to stderr.
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tracesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'artifacts', 'codex-hooks');
const imageExtensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const base64 = /^[A-Za-z0-9+/]+={0,2}$/;
// Ids come from the event; keep only path-safe characters so they cannot leave the trace folder.
const safe = value => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80) || 'unknown';

// Replace embedded image bytes with saved files; everything else is kept exactly as supplied.
// References (paths, URLs) are left alone and never fetched.
async function extractImages(value, save) {
  if (Array.isArray(value)) {
    const items = [];
    for (const item of value) items.push(await extractImages(item, save));
    return items;
  }
  if (typeof value === 'string') {
    const dataUrl = /^data:(image\/[a-z+.-]+);base64,(.+)$/is.exec(value);
    return (dataUrl && await save(dataUrl[1], dataUrl[2])) ?? value;
  }
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'image' && typeof value.data === 'string') {
    const saved = await save(value.mimeType, value.data);
    if (saved) { const { data, ...rest } = value; return { ...rest, ...saved }; }
  }
  const copy = {};
  for (const [key, item] of Object.entries(value)) copy[key] = await extractImages(item, save);
  return copy;
}

async function record(raw) {
  let event;
  try { event = JSON.parse(raw); } catch { throw new Error('stdin is not valid JSON'); }
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('hook event must be a JSON object');
  const name = event.hook_event_name;
  if (name !== 'PreToolUse' && name !== 'PostToolUse') { console.error(`codex tool trace: ignoring ${String(name)} event`); return; }
  const dir = path.join(tracesDir, safe(event.session_id));
  await mkdir(path.join(dir, 'images'), { recursive: true });
  let count = 0;
  const save = async (mimeType, data) => {
    const extension = imageExtensions[String(mimeType).toLowerCase()];
    if (!extension || !base64.test(data)) return undefined;
    const file = `images/${safe(event.tool_use_id)}-${name === 'PreToolUse' ? 'pre' : 'post'}-${++count}.${extension}`;
    await writeFile(path.join(dir, file), Buffer.from(data, 'base64'));
    return { savedImage: file };
  };
  const entry = { recordedAt: new Date().toISOString(), ...event };
  for (const key of ['tool_input', 'tool_response']) if (key in entry) entry[key] = await extractImages(entry[key], save);
  await appendFile(path.join(dir, 'events.jsonl'), `${JSON.stringify(entry)}\n`);
}

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;
try { await record(raw); } catch (error) {
  // Exit 1 reports a failed hook without blocking the tool (exit code 2 would block).
  console.error(`codex tool trace: ${error.message}`);
  process.exitCode = 1;
}
