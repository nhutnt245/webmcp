import { AIRPORTS, isRealDate } from './flights.js';
import { showError, showMessage } from './messages.js';

// EXPERIMENTS: test how WebMCP behaves in edge cases. See README.md for activation URLs and inspection steps.
// Only the search page loads this file (see the hook at the bottom of search-page.js).
// The comments say what to look at. They do not claim a result: run the case and write down what you see.

// form is the search form.
export async function runExperiment(name, { form }) {
  if (name === 'imperative-same-name') {
    await registerSameNameTool(form);
  } else if (name === 'imperative-diff-name') {
    await registerDifferentNameTool(form);
  } else {
    console.warn(`Unknown experiment "${name}".`);
  }
}

// The two experiments below expose the search form a second way, with a DIFFERENT action:
//   - action 1 is the form submit in search-page.js: it searches and opens the results page.
//   - action 2 is this function: it does not search and does not open the results page.
// It fills the form from its arguments (if it got any), then shows a message on the page that starts with
// "[imperative action 2]" and names the route and date. So you can tell on screen which action ran.
function imperativeAction2(form, { from, to, date } = {}) {
  if (date !== undefined && !isRealDate(date)) {
    const error = 'Enter a valid travel date in YYYY-MM-DD format.';
    showError(error);
    return { error };
  }

  if (from) form.elements.from.value = from;
  if (to) form.elements.to.value = to;
  if (date !== undefined) form.elements.date.value = date;

  const message = `[imperative action 2] from ${form.elements.from.value} to ${form.elements.to.value} on ${form.elements.date.value}`;
  showMessage(message);
  return { message };
}

// CASE 2a: an imperative tool with the same name as the declarative form tool.
// The form in index.html is already the tool "search_flights" (action 1). Here JavaScript tries to register
// "search_flights" too, and its execute() runs action 2.
//
// Look at:
//   - the console: does registerTool resolve, or throw? The line below logs the outcome, with the error name and message.
//   - DevTools > Application > WebMCP: how many tools are named search_flights, and is the description the form's or this one?
//   - await document.modelContext.getTools(): same question.
//   - call search_flights as an agent: which implementation runs? Action 1 (the form submit: the results page opens)
//     or action 2 (the message starting with "[imperative action 2]" shows under the form)?
//     Or was the registration rejected, so only the form tool remains?
async function registerSameNameTool(form) {
  try {
    await document.modelContext.registerTool({
      name: 'search_flights',
      description: 'Experiment: imperative tool with the same name as the declarative search_flights form tool.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return imperativeAction2(form);
      },
    });
    console.log('[experiment] registerTool("search_flights") resolved without an error.');
  } catch (error) {
    console.log('[experiment] registerTool("search_flights") failed:', error.name, error.message);
  }
}

// CASE 2b: an imperative tool with a different name for the same form.
// "search_flights_imperative" runs action 2 (the same function as CASE 2a), not the form submit.
//
// Look at:
//   - DevTools > Application > WebMCP: are both search_flights and search_flights_imperative listed?
//   - call each one with the same route and date: search_flights should run action 1 (the results page opens)
//     and search_flights_imperative should run action 2 (a "[imperative action 2]" message shows). Is that what happens?
//   - given a prompt like "search flights from SFO to JFK", which of the two tools does an agent pick?
async function registerDifferentNameTool(form) {
  try {
    await document.modelContext.registerTool({
      name: 'search_flights_imperative',
      description:
        'Experiment: show the requested route and travel date on the page. It does not search and does not open the results page.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', enum: AIRPORTS, description: 'Departure airport code: SFO, LAX or JFK.' },
          to: { type: 'string', enum: AIRPORTS, description: 'Arrival airport code. Must differ from the departure.' },
          date: { type: 'string', description: 'Travel date in YYYY-MM-DD format.' },
        },
        required: ['from', 'to', 'date'],
      },
      async execute(args) {
        return imperativeAction2(form, args);
      },
    });
    console.log('[experiment] registerTool("search_flights_imperative") resolved without an error.');
  } catch (error) {
    console.log('[experiment] registerTool("search_flights_imperative") failed:', error.name, error.message);
  }
}
