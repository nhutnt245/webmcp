// EXPERIMENTS: test how WebMCP behaves in edge cases. Nothing here runs unless the URL has a flag:
//   /?experiment=duplicate-field
//   /?experiment=imperative-same-name
//   /?experiment=imperative-diff-name
// Open the page with one flag, then look at Chrome DevTools > Application > WebMCP and at the console.
// Only the search page loads this file (see the hook at the bottom of search-page.js).
// The comments say what to look at. They do not claim a result: run the case and write down what you see.

// form is the search form. search runs the same code as the "Search flights" button.
export async function runExperiment(name, { form, search }) {
  if (name === 'duplicate-field') {
    addDuplicateField(form);
  } else if (name === 'imperative-same-name') {
    await registerSameNameTool(search);
  } else if (name === 'imperative-diff-name') {
    await registerDifferentNameTool(form, search);
  } else {
    console.warn(`Unknown experiment "${name}".`);
  }
}

// CASE 1: two form items with the same name.
// The form already has <select name="from">, <select name="to"> and <input name="date">.
// This adds a second control named "date" (with another default value), so the form has two items called "date".
//
// Look at in DevTools > Application > WebMCP, tool search_flights, its input schema:
//   - is "date" one property, two properties, or an array?
//   - which description, default and "required" does the "date" property show?
//   - does the schema differ if you reload the page with the flag compared with no flag?
// Also run in the console: await document.modelContext.getTools()  and compare with the panel.
// Then call the tool and look at which date the search uses. On a normal submit, new FormData(form) in
// search-page.js lists both "date" values, and Object.fromEntries keeps the last one.
function addDuplicateField(form) {
  const field = document.createElement('div');
  field.className = 'field';
  field.innerHTML = `
    <label for="date-2">Second travel date (experiment: same name as the first one)</label>
    <input
      id="date-2"
      name="date"
      type="date"
      value="2026-12-15"
      required
      toolparamdescription="Second travel date in YYYY-MM-DD format (experiment: duplicate field name)."
    />
  `;
  form.querySelector('button[type="submit"]').before(field);
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
  const airports = ['SFO', 'LAX', 'JFK'];

  try {
    await document.modelContext.registerTool({
      name: 'search_flights_imperative',
      description:
        'Search fictional flights between two different airports on a travel date. A successful search opens the results page.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', enum: airports, description: 'Departure airport code: SFO, LAX or JFK.' },
          to: { type: 'string', enum: airports, description: 'Arrival airport code. Must differ from the departure.' },
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
