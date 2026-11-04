// Imperative WebMCP tools: https://developer.chrome.com/docs/ai/webmcp/imperative-api
// Each tool is an explicit { name, description, inputSchema, execute } object registered with
// document.modelContext.registerTool(tool, { signal }). Aborting that signal unregisters the tool.
// search_flights, filter_flights and sort_flights are NOT here: their forms declare them in the HTML.
// Where document.modelContext does not exist nothing is registered and the ordinary page still works.
const gone = 'This tool is no longer available on this page. Read the current tool list again.';
// A failure is returned as a result so the agent reads the real reason (errors thrown or rejected inside a
// tool only reach it as a generic failure). { content: [{ type: 'text', text }], isError: true } is the shape
// what WebMCP clients read as a failed call.
export const toolError = (error) => ({ content: [{ type: 'text', text: error.message }], isError: true });
// Aborting a signal removes the tool but not calls already in flight, so every execute checks it.
const whileRegistered = (signal, run) => async (input) => {
  try {
    if (signal.aborted) throw new Error(gone);
    return await run(input ?? {});
  } catch (error) {
    return toolError(error);
  }
};

export function createImperativeTools({ page, booking, actions, modelContext = document.modelContext, view = window }) {
  // Page lifetime: get_flight_results and edit_search stay registered until the page is left.
  const pageLife = new AbortController();
  // State lifetime: replaced after every state change so the tools below always match what is visible.
  let stateLife = new AbortController();
  let queue = Promise.resolve();
  let left = false;

  function pageTools(signal) {
    const getFlightResults = {
      name: 'get_flight_results',
      description: 'Read the flights currently visible on the results page in display order. Changes nothing.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: whileRegistered(signal, () => actions.getResults()),
    };
    const editSearch = {
      name: 'edit_search',
      description:
        'Open the search form to change route or date. The current results stay until a new search is submitted.',
      inputSchema: { type: 'object', properties: {} },
      execute: whileRegistered(signal, () => actions.editSearch()),
    };
    if (page === 'results') return [getFlightResults, editSearch];
    if (page === 'summary') return [editSearch];
    return [];
  }

  function stateTools(signal) {
    if (page !== 'results') return [];
    const state = booking.state;
    const tools = [];
    if (Object.keys(state.filters).length) {
      const clearFilters = {
        name: 'clear_filters',
        description: 'Remove every active filter so all flights for the search are visible again.',
        inputSchema: { type: 'object', properties: {} },
        execute: whileRegistered(signal, () => actions.clearFilters()),
      };
      tools.push(clearFilters);
    }
    if (state.visibleFlights.length) {
      const selectFlight = {
        name: 'select_flight',
        description: 'Select one of the currently visible flights and open its summary page.',
        inputSchema: {
          type: 'object',
          properties: {
            flight_id: {
              type: 'string',
              enum: state.visibleFlights.map((flight) => flight.id),
              description: 'ID of a visible flight, for example the first result of get_flight_results.',
            },
          },
          required: ['flight_id'],
        },
        execute: whileRegistered(signal, ({ flight_id }) => actions.select({ flight_id })),
      };
      tools.push(selectFlight);
    }
    return tools;
  }

  function register(tools, signal) {
    if (!modelContext) return;
    queue = queue.then(async () => {
      for (const tool of tools) {
        if (signal.aborted) return;
        try {
          await modelContext.registerTool(tool, { signal });
        } catch (error) {
          console.warn(`registerTool(${tool.name}) failed:`, error);
        }
      }
    });
  }

  function suspend() {
    left = true;
    pageLife.abort();
    stateLife.abort();
  }
  view.addEventListener('pagehide', suspend);

  return {
    // Register the tools that stay for the whole page lifetime.
    mount() {
      register(pageTools(pageLife.signal), pageLife.signal);
    },
    // Call after every state change: drops the previous state-dependent tools, registers the current ones.
    sync() {
      if (left) return;
      stateLife.abort();
      stateLife = new AbortController();
      register(stateTools(stateLife.signal), stateLife.signal);
    },
    // Call before navigating away so no tool can be called against the page that is going away.
    suspend,
    // Resolves when every queued registration has finished (tests and tools that need to wait).
    settled: () => queue,
  };
}
