import { registerTodoTools } from '/webmcp/register.js';

let todos = [];
let nextId = 1;
const list = document.querySelector('#todos');
const summary = document.querySelector('#summary');
function render() {
  list.replaceChildren();
  for (const todo of todos) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => store.complete({ id: todo.id, completed: checkbox.checked }));
    const text = document.createElement('span');
    text.textContent = todo.title;
    label.append(checkbox, text);
    li.append(label);
    list.append(li);
  }
  summary.textContent = `${todos.filter(t => t.completed).length} of ${todos.length} complete`;
}
const store = {
  list: () => ({ todos: todos.map(t => ({ ...t })) }),
  add(input) {
    if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120) {
      return { error: 'title must contain 1–120 non-whitespace characters' };
    }
    const todo = { id: nextId++, title: input.title.trim(), completed: false };
    todos.push(todo);
    render();
    return { todo: { ...todo } };
  },
  complete(input) {
    if (!input || !Number.isInteger(input.id) || typeof input.completed !== 'boolean') {
      return { error: 'id must be an integer and completed must be boolean' };
    }
    const todo = todos.find(t => t.id === input.id);
    if (!todo) return { error: 'Todo not found' };
    todo.completed = input.completed;
    render();
    return { todo: { ...todo } };
  },
};
document.querySelector('#todo-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#title');
  const result = store.add({ title: input.value });
  if (!result.error) { input.value = ''; input.focus(); }
});
document.querySelector('#reset').addEventListener('click', () => { todos = []; nextId = 1; render(); });
window.demoReady = registerTodoTools(store);
