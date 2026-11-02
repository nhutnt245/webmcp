// Pixel/keyboard transport only: no selectors, accessibility tree, or page.evaluate.
const keys = { Return: 'Enter', space: ' ', BackSpace: 'Backspace', Page_Up: 'PageUp', Page_Down: 'PageDown', Super_L: 'Meta', Control_L: 'Control', Alt_L: 'Alt', Shift_L: 'Shift', Escape: 'Escape' };
export async function act(page, input) {
  const { action } = input;
  const move = async () => {
    const point = input.coordinate;
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error('Expected [x,y] coordinate');
    await page.mouse.move(...point);
  };
  switch (action) {
    case 'screenshot': break;
    case 'mouse_move': await move(); break;
    case 'left_click': case 'right_click': case 'middle_click': case 'double_click': case 'triple_click': {
      await move();
      const button = action === 'right_click' ? 'right' : action === 'middle_click' ? 'middle' : 'left';
      await page.mouse.down({ button });
      await page.mouse.up({ button });
      if (action === 'double_click' || action === 'triple_click') {
        // clickCount communicates the platform double/triple-click event semantics.
        const count = action === 'double_click' ? 2 : 3;
        for (let i = 2; i <= count; i++) {
          await page.mouse.down({ button, clickCount: i });
          await page.mouse.up({ button, clickCount: i });
        }
      }
      break;
    }
    case 'left_mouse_down': await page.mouse.down(); break;
    case 'left_mouse_up': await page.mouse.up(); break;
    case 'left_click_drag':
      await page.mouse.down();
      try { await move(); } finally { await page.mouse.up(); }
      break;
    case 'type':
      if (typeof input.text !== 'string') throw new Error('Expected text');
      await page.keyboard.insertText(input.text);
      break;
    case 'key': {
      if (typeof input.text !== 'string') throw new Error('Expected key chord');
      const chord = input.text.split('+').map(key => keys[key] ?? key).join('+');
      await page.keyboard.press(chord);
      break;
    }
    case 'hold_key': {
      const key = keys[input.text] ?? input.text;
      const duration = boundedDuration(input.duration);
      await page.keyboard.down(key);
      try { await new Promise(resolve => setTimeout(resolve, duration)); }
      finally { await page.keyboard.up(key); }
      break;
    }
    case 'scroll': {
      await move();
      const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
      const direction = directions[input.scroll_direction];
      if (!direction || !Number.isInteger(input.scroll_amount) || input.scroll_amount < 0 || input.scroll_amount > 100) throw new Error('Invalid scroll direction or amount');
      await page.mouse.wheel(direction[0] * input.scroll_amount * 80, direction[1] * input.scroll_amount * 80);
      break;
    }
    case 'wait': await new Promise(resolve => setTimeout(resolve, boundedDuration(input.duration))); break;
    default: throw new Error(`Unsupported action: ${action}`);
  }
  // Let input events paint before capturing their visible result.
  await new Promise(resolve => setTimeout(resolve, 100));
  return { type: 'image', source: { type: 'base64', media_type: 'image/png', data: (await page.screenshot()).toString('base64') } };
}
function boundedDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 5) throw new Error('Duration must be 0–5 seconds');
  return seconds * 1000;
}
