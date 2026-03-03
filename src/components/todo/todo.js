import itemMarkup from '../todo-item/todo-item.html';

(function () {
  const STORAGE_KEY = 'vaper-todo';
  const listEl = root.querySelector('#todo-list');
  const inputEl = root.querySelector('#todo-input');
  const formEl = root.querySelector('#todo-form');
  const addBtn = root.querySelector('#todo-add');
  const clearBtn = root.querySelector('#todo-clear-completed');

  if (!listEl || !inputEl || !formEl) return;

  let itemTemplateEl = null;
  function getItemEl() {
    if (!itemTemplateEl) {
      const wrap = document.createElement('div');
      wrap.innerHTML = itemMarkup;
      itemTemplateEl = wrap.firstElementChild;
    }
    return itemTemplateEl;
  }

  let items = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      items = raw ? JSON.parse(raw) : [];
    } catch (_) {
      items = [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function render() {
    listEl.innerHTML = '';
    if (items.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'todo-list-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.textContent = 'No items yet — add one above.';
      listEl.appendChild(placeholder);
      return;
    }
    const itemEl = getItemEl();
    if (!itemEl) return;
    items.forEach((item) => {
      const li = itemEl.cloneNode(true);
      const checkbox = li.querySelector('.todo-item-checkbox');
      const label = li.querySelector('.todo-item-label');
      const delBtn = li.querySelector('.todo-item-delete');
      if (checkbox) {
        checkbox.id = 'todo-item-' + item.id;
        checkbox.checked = item.done;
        checkbox.setAttribute('data-id', String(item.id));
      }
      if (label) {
        label.htmlFor = 'todo-item-' + item.id;
        label.textContent = item.text;
        if (item.done) label.style.textDecoration = 'line-through';
      }
      if (delBtn) delBtn.setAttribute('data-id', String(item.id));
      listEl.appendChild(li);
    });
  }

  function toggle(id) {
    const item = items.find((i) => i.id === id);
    if (item) {
      item.done = !item.done;
      save();
      render();
    }
  }

  function remove(id) {
    items = items.filter((i) => i.id !== id);
    save();
    render();
  }

  function add(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    items.push({ id: Date.now(), text: trimmed, done: false });
    save();
    render();
    inputEl.value = '';
    inputEl.focus();
  }

  function clearCompleted() {
    items = items.filter((i) => !i.done);
    save();
    render();
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    add(inputEl.value);
  });

  listEl.addEventListener('change', function (e) {
    if (e.target.type === 'checkbox' && e.target.dataset.id) {
      toggle(Number(e.target.dataset.id));
    }
  });

  listEl.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-id]');
    if (btn && btn.dataset.id) {
      remove(Number(btn.dataset.id));
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', clearCompleted);
  }

  load();
  render();
})();
