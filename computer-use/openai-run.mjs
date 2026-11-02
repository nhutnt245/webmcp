import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createResponse, defaultModel } from './openai-api.mjs';
import { runComputerUse } from './openai-loop.mjs';
import { taskPrompt, viewport } from './task.mjs';

const finalScreenshot = 'artifacts/openai-computer-final.png';
const failureScreenshot = 'artifacts/openai-computer-failure.png';
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('Set OPENAI_API_KEY in your shell; this demo makes paid OpenAI API calls.');
const maxTurns = Number(process.env.MAX_TURNS ?? 20);
if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 100) throw new Error('MAX_TURNS must be an integer from 1 to 100');
const model = process.env.OPENAI_MODEL || defaultModel;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: process.env.HEADED !== '1' });
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(process.env.DEMO_URL ?? 'http://127.0.0.1:3000');
  try {
    await runComputerUse({ page, model, prompt: taskPrompt, maxTurns, createResponse: body => createResponse(key, body) });
  } catch (error) {
    await mkdir('artifacts', { recursive: true });
    await page.screenshot({ path: failureScreenshot }).then(() => console.error(`Saved ${failureScreenshot}`), () => {});
    throw error;
  }
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: finalScreenshot });
  console.log(`Model ended its turn. This is a model claim; inspect ${finalScreenshot} to confirm.`);
} finally { await browser.close(); }
