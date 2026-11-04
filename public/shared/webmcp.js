// Current document API + the older navigator proposal. No fake native API.
export function createToolRegistry({ currentDocument = document, currentNavigator = navigator } = {}) {
  const context = currentDocument.modelContext || currentNavigator.modelContext;
  const modern = Boolean(currentDocument.modelContext);
  let active = [];
  let controller;
  let queue = Promise.resolve();
  let generation = 0;
  const supported = context && (modern ? context.registerTool : ((context.registerTool && context.unregisterTool) || context.provideContext));
  function clear() {
    controller?.abort();
    if (!modern && supported) {
      if (context.registerTool && context.unregisterTool) {
        for (const tool of active) context.unregisterTool(tool.name);
      } else context.provideContext({ tools: [] });
    }
    active = [];
  }
  function replace(tools) {
    const version = ++generation;
    queue = queue.then(async () => {
      clear();
      if (!supported) return;
      controller = new AbortController();
      const wrapped = tools.map(tool => ({ ...tool, execute: async (input = {}) => {
        if (version !== generation) throw new Error('Tool is stale; refresh the tool list.');
        return tool.execute(input);
      } }));
      if (!modern && !(context.registerTool && context.unregisterTool)) {
        await context.provideContext({ tools: wrapped });
        active = wrapped;
      } else {
        for (const tool of wrapped) {
          await context.registerTool(tool, modern ? { signal: controller.signal } : undefined);
          active.push(tool);
        }
      }
    }).catch(error => {
      clear();
      console.warn('WebMCP registration failed:', error);
    });
    return queue;
  }
  currentDocument.defaultView?.addEventListener('pagehide', () => { ++generation; clear(); });
  currentDocument.defaultView?.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  return { replace };
}
export function tool(name, description, properties, required, execute) {
  return { name, description, inputSchema: { type: 'object', properties, required, additionalProperties: false }, execute };
}
