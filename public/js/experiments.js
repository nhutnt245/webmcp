import { AIRPORTS } from './flights.js';

// EXPERIMENTS: test how WebMCP behaves in edge cases. See README.md for activation URLs and inspection steps.
// Only the search page loads this file (see the hook at the bottom of search-page.js).
// The comments say what to look at. They do not claim a result: run the case and write down what you see.

// form is the search form. search runs the same code as the "Search flights" button.
export async function runExperiment(name, { form, search }) {
  if (name === 'imperative-same-name') {
    await registerSameNameTool(search);
  } else if (name === 'imperative-diff-name') {
    await registerDifferentNameTool(form, search);
  } else {
    console.warn(`Unknown experiment "${name}".`);
  }
}

// CASE 2a: an imperative tool with the same name as the declarative form tool.
// The form in index.html is already the tool "search_flights". Here JavaScript tries to register "search_flights" too.
//
// Look at:
//   - the console: does registerTool resolve, or throw? The message below shows the outcome.
//   - DevTools > Application > WebMCP: how many tools are named search_flights, and is the description the form's or this one?
//   - await document.modelContext.getTools(): same question.
//   - call search_flights as an agent: which implementation runs (the form submit or this execute)?
async function registerSameNameTool(search) {
  try {
    await document.modelContext.registerTool({
      name: 'search_flights',
      description: 'Experiment: imperative tool with the same name as the declarative search_flights form tool.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        console.log('[experiment] the IMPERATIVE search_flights ran.');
        return search();
      },
    });
    console.log('[experiment] registerTool("search_flights") resolved without an error.');
  } catch (error) {
    console.log('[experiment] registerTool("search_flights") failed:', error.name, error.message);
  }
}

// CASE 2b: an imperative tool with a different name for the same form.
// "search_flights_imperative" runs the same search as the form. It fills the form fields from its arguments first,
// then calls search(), which is the code the form's submit handler uses.
//
// Look at:
//   - DevTools > Application > WebMCP: are both search_flights and search_flights_imperative listed?
//   - call each one with the same route and date: is the result the same, and does the results page open both times?
//   - given a prompt like "search flights from SFO to JFK", which of the two tools does an agent pick?
async function registerDifferentNameTool(form, search) {
  try {
    await document.modelContext.registerTool({
      name: 'search_flights_imperative',
      description:
        'Search fictional flights between two different airports on a travel date. A successful search opens the results page.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', enum: AIRPORTS, description: 'Departure airport code: SFO, LAX or JFK.' },
          to: { type: 'string', enum: AIRPORTS, description: 'Arrival airport code. Must differ from the departure.' },
          date: { type: 'string', description: 'Travel date in YYYY-MM-DD format.' },
        },
        required: ['from', 'to', 'date'],
      },
      async execute({ from, to, date }) {
        form.elements.from.value = from;
        form.elements.to.value = to;
        form.elements.date.value = date;
        try {
          return search();
        } catch (error) {
          return { error: error.message };
        }
      },
    });
    console.log('[experiment] registerTool("search_flights_imperative") resolved without an error.');
  } catch (error) {
    console.log('[experiment] registerTool("search_flights_imperative") failed:', error.name, error.message);
  }
}
