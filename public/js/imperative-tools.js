// WebMCP IMPERATIVE API: tools that are registered from JavaScript.
// https://developer.chrome.com/docs/ai/webmcp/imperative-api
//
// A tool is an object with four main parts:
//   name         what the agent calls
//   description  tells the agent what the tool does and when to use it
//   inputSchema  JSON Schema of the arguments (an empty object means "no arguments")
//   execute      the function that runs when the agent calls the tool
//
// document.modelContext.registerTool(tool) makes the tool visible to agents. A tool name can be
// registered once per page. These pages are separate documents, so each page registers its own tools.
//
// For API ownership and optional schema experiments, see README.md.
//
// Every tool calls the same functions as the buttons on the page, so a human and an agent get the same result.

import { FLIGHT_IDS } from './flights.js';

// Browsers without WebMCP have no document.modelContext. The page then works as an ordinary website.
// Inside a cross-origin iframe without allow="tools", document.modelContext exists but registerTool() rejects
// with NotAllowedError. The try/catch in the functions below turns that into a console warning, and the page
// keeps working for humans.
function isWebMcpAvailable() {
  return Boolean(document.modelContext);
}

// actions come from results-page.js.
export async function registerResultsTools(actions) {
  if (!isWebMcpAvailable()) {
    return;
  }

  try {
    await document.modelContext.registerTool({
      name: 'get_flight_results',
      description: 'Read the flights that are visible on the results page, in display order. Changes nothing.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        return actions.describeResults();
      },
    });

    await document.modelContext.registerTool({
      name: 'select_flight',
      description:
        'Select one of the visible flights and open its summary page. The flight must be in the visible results.',
      inputSchema: {
        type: 'object',
        properties: {
          flight_id: {
            type: 'string',
            enum: FLIGHT_IDS,
            description: 'ID of a visible flight, for example the first flight from get_flight_results.',
          },
        },
        required: ['flight_id'],
      },
      async execute({ flight_id }) {
        return actions.selectFlight(flight_id);
      },
    });

    await document.modelContext.registerTool({
      name: 'clear_filters',
      description: 'Remove every filter so that all flights of the search are visible again.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return actions.clearFilters();
      },
    });

    await document.modelContext.registerTool({
      name: 'edit_search',
      description: 'Open the search form to change the route or date. Your current search is filled in.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return actions.editSearch();
      },
    });
  } catch (error) {
    console.warn('Could not register the WebMCP tools:', error);
  }
}

// actions come from summary-page.js.
export async function registerSummaryTools(actions) {
  if (!isWebMcpAvailable()) {
    return;
  }

  try {
    await document.modelContext.registerTool({
      name: 'back_to_results',
      description: 'Go back to the flight results. Your filters and sorting are kept.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return actions.backToResults();
      },
    });

    await document.modelContext.registerTool({
      name: 'edit_search',
      description: 'Open the search form to change the route or date. Your current search is filled in.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return actions.editSearch();
      },
    });
  } catch (error) {
    console.warn('Could not register the WebMCP tools:', error);
  }
}
