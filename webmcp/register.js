// A tiny local harness, not a browser-agent integration or full WebMCP polyfill.
export async function registerTodoTools(store) {
  const tools = [
    { name: 'list_todos', description: 'List the todos in this session.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true }, execute: () => store.list() },
    { name: 'add_todo', description: 'Add a todo to this session.',
      inputSchema: { type: 'object', properties: { title: { type: 'string', minLength: 1, maxLength: 120 } }, required: ['title'], additionalProperties: false },
      execute: input => store.add(input) },
    { name: 'complete_todo', description: 'Set whether a todo is complete.',
      inputSchema: { type: 'object', properties: { id: { type: 'integer' }, completed: { type: 'boolean' } }, required: ['id', 'completed'], additionalProperties: false },
      execute: input => store.complete(input) },
  ];
  const native = document.modelContext ?? navigator.modelContext;
  let registration = 'local fallback';
  if (typeof native?.registerTool === 'function') {
    try {
      for (const tool of tools) await native.registerTool(tool);
      registration = document.modelContext ? 'document.modelContext' : 'navigator.modelContext (legacy)';
    } catch (error) {
      registration = `native registration failed: ${error.message}; local fallback`;
    }
  }
  window.todoTools = {
    registration,
    // Always available so ordinary browsers can demonstrate the structured boundary.
    list: () => tools.map(({ execute, ...metadata }) => metadata),
    async call(name, input = {}) {
      const tool = tools.find(tool => tool.name === name);
      return tool ? tool.execute(input) : { error: `Unknown tool: ${name}` };
    },
  };
  document.querySelector('#tools-status').textContent = `Tool registration: ${registration}`;
}
