// One HTTP call to the OpenAI Responses API. The key only appears in the Authorization header and never in messages.
// https://developers.openai.com/api/docs/guides/tools-computer-use
export const defaultModel = 'gpt-6.1-sol';
const responsesUrl = 'https://api.openai.com/v1/responses';

export async function createResponse(apiKey, body, { timeoutMs = 120_000 } = {}) {
  let response;
  try {
    response = await fetch(responsesUrl, {
      method: 'POST', signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error(`OpenAI API request timed out after ${timeoutMs / 1000} seconds.`);
    throw new Error(`OpenAI API request failed before a response arrived (${label(error?.cause?.code) ?? label(error?.name) ?? 'unknown error'}).`);
  }
  if (!response.ok) throw new Error(await describeHttpError(response));
  try { return await response.json(); } catch { throw new Error('OpenAI API returned a body that is not valid JSON.'); }
}

async function describeHttpError(response) {
  // The error message can echo part of the key, so report only a bounded error code.
  const detail = await response.json().then(body => label(body?.error?.code) ?? label(body?.error?.type), () => undefined);
  const hint = {
    400: 'the request was rejected; check that the model supports the computer tool',
    401: 'the API key was rejected; check OPENAI_API_KEY',
    403: 'the key or project lacks access to this model or the computer tool; check OPENAI_MODEL and project access',
    404: 'the model or endpoint was not found; check OPENAI_MODEL and model access',
    429: 'rate limit or quota exceeded; check usage limits and billing',
  }[response.status] ?? (response.status >= 500 ? 'OpenAI service error; retry later' : 'unexpected response');
  return `OpenAI API returned HTTP ${response.status}: ${hint}${detail ? ` (${detail})` : ''}.`;
}

function label(value) { return typeof value === 'string' && /^[\w.-]{1,64}$/.test(value) ? value : undefined; }
