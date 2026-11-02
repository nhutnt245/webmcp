// Responses API computer-use loop. `createResponse(body)` is injected so tests can replay documented fixtures.
// Contract: https://developers.openai.com/api/docs/guides/tools-computer-use-integration#repeat-the-computer-use-loop
import { captureScreenshot, parseActions, performActions } from './openai-actions.mjs';

const tools = [{ type: 'computer' }];

export async function runComputerUse({ page, createResponse, model, prompt, maxTurns, log = console.log, actionOptions }) {
  const actions = [];
  let request = { model, tools, input: prompt };
  for (let turn = 1; turn <= maxTurns; turn++) {
    const response = await createResponse(request);
    const { call, text } = interpret(response);
    for (const line of text) log(line);
    if (!call) {
      if (!actions.length) throw new Error('Model finished without requesting any computer action.');
      return { text, turns: turn, actions };
    }
    if (turn === maxTurns) throw new Error('Turn limit reached before completion; increase MAX_TURNS if needed.');
    const parsed = parseActions(call.actions, page.viewportSize());
    log(`Turn ${turn}/${maxTurns}: ${parsed.map(action => action.type).join(', ')}`);
    await performActions(page, parsed, actionOptions);
    actions.push(...parsed.map(action => action.type));
    const screenshot = await captureScreenshot(page);
    request = {
      model, tools, previous_response_id: response.id,
      input: [{
        type: 'computer_call_output', call_id: call.call_id,
        output: { type: 'computer_screenshot', image_url: `data:image/png;base64,${screenshot.toString('base64')}`, detail: 'original' },
      }],
    };
  }
}

// Returns the single pending computer_call (if any) plus model text, or throws without executing anything.
function interpret(response) {
  if (!response || typeof response !== 'object' || !Array.isArray(response.output)) throw new Error('OpenAI response has no output list.');
  if (response.error) throw new Error(`OpenAI response reported an error${code(response.error.code)}.`);
  if (response.status === 'incomplete') throw new Error(`OpenAI response was incomplete${code(response.incomplete_details?.reason)}; no action was executed.`);
  if (response.status !== 'completed') throw new Error(`OpenAI response status is ${JSON.stringify(String(response.status)).slice(0, 40)}, expected "completed".`);
  if (typeof response.id !== 'string' || !response.id) throw new Error('OpenAI response has no id to continue from.');
  const calls = [];
  const text = [];
  for (const item of response.output) {
    if (item?.type === 'computer_call') calls.push(item);
    else if (item?.type === 'message') {
      for (const part of item.content ?? []) {
        if (part?.type === 'refusal') throw new Error(`Model refused the task: ${String(part.refusal).slice(0, 200)}`);
        if (part?.type === 'output_text') text.push(part.text);
      }
    } else if (item?.type !== 'reasoning') throw new Error(`Unexpected output item type ${JSON.stringify(String(item?.type)).slice(0, 40)}; this demo only supports the computer tool.`);
  }
  if (calls.length > 1) throw new Error('Model returned more than one computer_call in a single response; stopping.');
  const [call] = calls;
  if (!call) {
    if (!text.length) throw new Error('Model returned neither a computer action nor a message.');
    return { text };
  }
  if (call.pending_safety_checks?.length) {
    const codes = call.pending_safety_checks.map(check => String(check?.code).replace(/[^\w.-]/g, '').slice(0, 64)).join(', ');
    throw new Error(`Model reported a pending safety check (${codes}). This demo never acknowledges safety checks automatically; review the page manually before retrying.`);
  }
  if (call.status !== 'completed') throw new Error('Model returned an incomplete computer_call; refusing to execute a partial action.');
  if (typeof call.call_id !== 'string' || !call.call_id) throw new Error('computer_call has no call_id.');
  return { call, text };
}

function code(value) { return typeof value === 'string' && /^[\w.-]{1,64}$/.test(value) ? ` (${value})` : ''; }
