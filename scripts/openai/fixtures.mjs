// Offline Responses API fixtures for the OpenAI computer-use demo. Shapes follow the current official guides:
//   https://developers.openai.com/api/docs/guides/tools-computer-use
//   https://developers.openai.com/api/docs/guides/tools-computer-use-integration
// A computer_call carries an ordered actions[] batch; the client answers with a computer_call_output that has the
// same call_id and a computer_screenshot, continuing via previous_response_id.
let counter = 0;
const base = (output, extra = {}) => ({ id: `resp_fixture_${++counter}`, object: 'response', status: 'completed', error: null, output, ...extra });

export const computerCall = (callId, actions, extra = {}) =>
  base([{ type: 'computer_call', id: `cu_${callId}`, call_id: callId, actions, status: 'completed', pending_safety_checks: [], ...extra }]);
export const messageResponse = text =>
  base([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] }]);
export const refusalResponse = text =>
  base([{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: text }] }]);
export const incompleteResponse = reason => base([], { status: 'incomplete', incomplete_details: { reason } });
export const failedResponse = code => base([], { status: 'failed', error: { code, message: 'fixture failure' } });
export const functionCallResponse = () =>
  base([{ type: 'function_call', call_id: 'call_fn', name: 'exec_js', arguments: '{}', status: 'completed' }]);

// The todo flow, as screenshot-driven actions. `layout` holds pixel coordinates read from a probe page in the test,
// standing in for the position a model would read from the screenshot.
export function todoFlow({ input, checkbox }) {
  return [
    computerCall('call_1', [{ type: 'screenshot' }]),
    computerCall('call_2', [
      { type: 'click', button: 'left', x: input.x, y: input.y },
      { type: 'type', text: 'Book demo flight' },
      { type: 'keypress', keys: ['ENTER'] },
    ]),
    computerCall('call_3', [{ type: 'click', button: 'left', x: checkbox.x, y: checkbox.y }]),
    messageResponse('Added "Book demo flight" and marked it complete; the page shows 1 of 1 complete.'),
  ];
}
