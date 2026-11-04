import { installLayout } from '../shared/ui.js';
import { installProbe } from '../shared/probe.js';
import { createToolsPanel, tool } from '../shared/webmcp.js';
installLayout();
const probe = installProbe();
const tools = createToolsPanel();
tools.replace([tool('run_probe', 'Run the console and deliberately missing network request probes.', {}, [], probe.run)]);
