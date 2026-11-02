// Pixel/keyboard transport for the OpenAI `computer` tool: no selectors, accessibility tree, or page.evaluate.
// Action shapes: https://developers.openai.com/api/docs/guides/tools-computer-use-integration#implement-action-handlers
const keyNames = {
  ENTER: 'Enter', RETURN: 'Enter', ESC: 'Escape', ESCAPE: 'Escape', TAB: 'Tab', SPACE: 'Space',
  BACKSPACE: 'Backspace', DELETE: 'Delete', DEL: 'Delete', HOME: 'Home', END: 'End',
  PAGEUP: 'PageUp', PAGEDOWN: 'PageDown',
  UP: 'ArrowUp', ARROWUP: 'ArrowUp', DOWN: 'ArrowDown', ARROWDOWN: 'ArrowDown',
  LEFT: 'ArrowLeft', ARROWLEFT: 'ArrowLeft', RIGHT: 'ArrowRight', ARROWRIGHT: 'ArrowRight',
  CTRL: 'Control', CONTROL: 'Control', SHIFT: 'Shift', OPTION: 'Alt', ALT: 'Alt',
  META: 'Meta', CMD: 'Meta', COMMAND: 'Meta',
};
const modifiers = new Set(['Control', 'Shift', 'Alt', 'Meta']);
const buttons = { left: 'left', right: 'right', wheel: 'middle' };
const limits = { actions: 20, dragPoints: 50, keys: 5, keyLength: 32, text: 2000, scroll: 10_000 };

export const normalizeKey = key => keyNames[key.toUpperCase()] ?? key;

// Validates a whole batch against the viewport before anything runs, so a bad action never leaves a half-executed batch.
export function parseActions(actions, viewport) {
  if (!viewport) throw new Error('Page has no viewport; cannot validate coordinates');
  if (!Array.isArray(actions) || !actions.length) throw new Error('computer_call has no actions');
  if (actions.length > limits.actions) throw new Error(`computer_call has more than ${limits.actions} actions`);
  return actions.map((action, index) => {
    try { return parseAction(action, viewport); } catch (error) { throw new Error(`Action ${index + 1}: ${error.message}`); }
  });
}

function parseAction(action, viewport) {
  if (!action || typeof action !== 'object') throw new Error('Expected an action object');
  const at = () => ({ x: coordinate(action.x, 'x', viewport.width), y: coordinate(action.y, 'y', viewport.height) });
  switch (action.type) {
    case 'screenshot': return { type: 'screenshot' };
    case 'wait': return { type: 'wait' };
    case 'type':
      if (typeof action.text !== 'string' || action.text.length > limits.text) throw new Error(`type needs text up to ${limits.text} characters`);
      return { type: 'type', text: action.text };
    case 'keypress': {
      const keys = keyList(action.keys, 'keypress');
      return { type: 'keypress', chord: keys.map(normalizeKey).join('+') };
    }
    case 'click': return { type: 'click', ...at(), button: button(action.button), modifiers: modifierKeys(action.keys) };
    case 'double_click': return { type: 'double_click', ...at(), modifiers: modifierKeys(action.keys) };
    case 'move': return { type: 'move', ...at(), modifiers: modifierKeys(action.keys) };
    case 'scroll': return {
      type: 'scroll', ...at(), modifiers: modifierKeys(action.keys),
      scrollX: scrollDelta(action.scroll_x, 'scroll_x'), scrollY: scrollDelta(action.scroll_y, 'scroll_y'),
    };
    case 'drag': {
      const path = action.path;
      if (!Array.isArray(path) || path.length < 2 || path.length > limits.dragPoints) throw new Error(`drag needs a path of 2–${limits.dragPoints} points`);
      return { type: 'drag', modifiers: modifierKeys(action.keys), path: path.map(point => {
        // Both documented path shapes: {x, y} objects and [x, y] pairs.
        const [x, y] = Array.isArray(point) ? point : [point?.x, point?.y];
        return { x: coordinate(x, 'x', viewport.width), y: coordinate(y, 'y', viewport.height) };
      }) };
    }
    default: throw new Error(`Unsupported action type: ${JSON.stringify(String(action.type)).slice(0, 40)}`);
  }
}

export async function performActions(page, parsed, { waitMs = 2000 } = {}) {
  for (const action of parsed) {
    switch (action.type) {
      case 'screenshot': break;
      case 'wait': await new Promise(resolve => setTimeout(resolve, waitMs)); break;
      case 'type': await page.keyboard.type(action.text); break;
      case 'keypress': await page.keyboard.press(action.chord); break;
      case 'click': await withModifiers(page, action.modifiers, () => page.mouse.click(action.x, action.y, { button: action.button })); break;
      case 'double_click': await withModifiers(page, action.modifiers, () => page.mouse.dblclick(action.x, action.y)); break;
      case 'move': await withModifiers(page, action.modifiers, () => page.mouse.move(action.x, action.y)); break;
      case 'scroll':
        await withModifiers(page, action.modifiers, async () => {
          await page.mouse.move(action.x, action.y);
          await page.mouse.wheel(action.scrollX, action.scrollY);
        });
        break;
      case 'drag':
        await withModifiers(page, action.modifiers, async () => {
          const [start, ...rest] = action.path;
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
          try { for (const point of rest) await page.mouse.move(point.x, point.y); } finally { await page.mouse.up(); }
        });
        break;
    }
  }
}

export async function runActions(page, actions, options) {
  const parsed = parseActions(actions, page.viewportSize());
  await performActions(page, parsed, options);
  return parsed;
}

// Let input events paint before capturing their visible result.
export async function captureScreenshot(page) {
  await new Promise(resolve => setTimeout(resolve, 100));
  return page.screenshot({ type: 'png' });
}

async function withModifiers(page, keys, callback) {
  const pressed = [];
  try {
    for (const key of keys) { await page.keyboard.down(key); pressed.push(key); }
    await callback();
  } finally {
    for (const key of pressed.reverse()) await page.keyboard.up(key);
  }
}

function coordinate(value, axis, size) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value >= size) throw new Error(`${axis} must be a number inside the ${size}px viewport`);
  return value;
}
function scrollDelta(value = 0, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limits.scroll) throw new Error(`${name} must be a number within ±${limits.scroll} pixels`);
  return value;
}
function button(name = 'left') {
  if (!Object.hasOwn(buttons, name)) throw new Error(`Unsupported mouse button: ${JSON.stringify(String(name)).slice(0, 40)}`);
  return buttons[name];
}
function keyList(keys, label) {
  if (!Array.isArray(keys) || !keys.length || keys.length > limits.keys
    || !keys.every(key => typeof key === 'string' && key.length > 0 && key.length <= limits.keyLength)) {
    throw new Error(`${label} needs 1–${limits.keys} non-empty key names`);
  }
  return keys;
}
function modifierKeys(keys) {
  if (keys === undefined || keys === null) return [];
  const names = keyList(keys, 'keys').map(normalizeKey);
  if (!names.every(name => modifiers.has(name))) throw new Error('Only Ctrl, Shift, Alt, and Meta may be held during mouse actions');
  return names;
}
