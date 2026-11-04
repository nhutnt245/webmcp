// Deterministic WebMCP check, no LLM and no API key: serves the demo, then runs the official
// webmcp-evals smoke evaluator (the same engine as `webmcp-evals smoke`) against evals/evals.json.
// It opens a fresh page per case and calls each required expectedCall in authored order through the
// browser's real tool registry. It does not measure whether a model would choose those calls.
//
// Browser: set CHROME_PATH to a Chrome that has WebMCP (the official launch flags, including
// --enable-features=WebMCP, are reused). Without it the CLI default channel (chrome-canary) must be installed.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { PUPPETEER_FLAGS } from 'webmcp-evals/dist/evaluator/browser.js';
import { executeSmokeEvals } from 'webmcp-evals/dist/evaluator/smokeEvaluator.js';
import { createDemoServer } from './server.mjs';

const evalsPath = fileURLToPath(new URL('../evals/evals.json', import.meta.url));
const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');
const launchBrowser = () =>
  puppeteer.launch({
    browser: 'chrome',
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: [...PUPPETEER_FLAGS],
  });
const server = createDemoServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;
try {
  const tests = JSON.parse(await readFile(evalsPath, 'utf-8'));
  const summary = await executeSmokeEvals(
    tests,
    {
      url,
      verbose,
      timeoutMs: 30_000,
      chromeChannel: 'chrome-canary',
    },
    process.env.CHROME_PATH && { launchBrowser },
  );
  for (const result of summary.results) {
    const status = result.outcome === 'pass' ? 'PASS ' : 'ERROR';
    console.log(
      `${status} ${result.testName} #${result.stepIndex} ${result.functionName}${result.error ? ` - ${result.error}` : ''}`,
    );
  }
  console.log(`Passed steps: ${summary.passCount}/${summary.totalExpectedSteps} across ${summary.testCount} case(s).`);
  if (summary.errorCount > 0 || summary.passCount !== summary.totalExpectedSteps) process.exitCode = 1;
} finally {
  server.close();
}
