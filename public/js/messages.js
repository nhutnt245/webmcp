// The status line under the page content (<p id="message">).
// It is read by screen readers and shows the same text after a human click or an agent call.

const messageElement = document.querySelector('#message');

export function showMessage(text) {
  messageElement.textContent = text;
  messageElement.classList.remove('error');
}

export function showError(text) {
  messageElement.textContent = text;
  messageElement.classList.add('error');
}
