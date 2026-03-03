const STORAGE_KEY = 'vaper-movie-ranking';
const listEl = document.getElementById('movie-ranking-list');
const templateEl = document.getElementById('movie-ranking-item-template');
const inputEl = document.getElementById('movie-ranking-input');
const rankInputEl = document.getElementById('movie-ranking-rank');
const formEl = document.getElementById('movie-ranking-form');

if (!listEl || !inputEl || !formEl || !rankInputEl) return;

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
  if (!templateEl || !templateEl.content) return;
  items.forEach((item, index) => {
    const li = templateEl.content.cloneNode(true);
    const row = li.querySelector('.movie-ranking-item');
    const rankBadge = li.querySelector('.movie-ranking-rank-badge');
    const titleEl = li.querySelector('.movie-ranking-title');
    const delBtn = li.querySelector('.movie-ranking-delete');
    if (row) {
      row.setAttribute('data-id', String(item.id));
      row.setAttribute('data-index', String(index));
    }
    if (rankBadge) rankBadge.textContent = '#' + (index + 1);
    if (titleEl) titleEl.textContent = item.title;
    if (delBtn) delBtn.setAttribute('data-id', String(item.id));
    listEl.appendChild(li);
  });
}

function add(title, initialRank) {
  const trimmed = (title || '').trim();
  if (!trimmed) return;
  const rank = Math.max(1, Math.min((initialRank | 0) || 1, items.length + 1));
  const newItem = { id: Date.now(), title: trimmed };
  items.splice(rank - 1, 0, newItem);
  save();
  render();
  inputEl.value = '';
  rankInputEl.value = String(items.length);
  inputEl.focus();
}

function remove(id) {
  items = items.filter((i) => i.id !== id);
  save();
  render();
  const nextRank = items.length + 1;
  if (rankInputEl) rankInputEl.value = String(nextRank);
}

function moveItem(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const [removed] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, removed);
  save();
  render();
}

let draggedIndex = null;

formEl.addEventListener('submit', function (e) {
  e.preventDefault();
  add(inputEl.value, Number(rankInputEl.value) || 1);
});

listEl.addEventListener('click', function (e) {
  const btn = e.target.closest('button[data-id]');
  if (btn && btn.dataset.id) {
    remove(Number(btn.dataset.id));
  }
});

listEl.addEventListener('dragstart', function (e) {
  const row = e.target.closest('.movie-ranking-item');
  if (!row || !row.dataset.index) return;
  draggedIndex = parseInt(row.dataset.index, 10);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', row.dataset.id);
  row.classList.add('movie-ranking-dragging');
});

listEl.addEventListener('dragend', function (e) {
  const row = e.target.closest('.movie-ranking-item');
  if (row) row.classList.remove('movie-ranking-dragging');
  draggedIndex = null;
});

listEl.addEventListener('dragover', function (e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const row = e.target.closest('.movie-ranking-item');
  if (row && row.dataset.index != null) {
    const toIndex = parseInt(row.dataset.index, 10);
    if (draggedIndex !== null && draggedIndex !== toIndex) {
      row.classList.add('movie-ranking-drag-over');
    }
  }
});

listEl.addEventListener('dragleave', function (e) {
  const row = e.target.closest('.movie-ranking-item');
  if (row) row.classList.remove('movie-ranking-drag-over');
});

listEl.addEventListener('drop', function (e) {
  e.preventDefault();
  const row = e.target.closest('.movie-ranking-item');
  if (row) row.classList.remove('movie-ranking-drag-over');
  if (draggedIndex == null || !row || row.dataset.index == null) return;
  const toIndex = parseInt(row.dataset.index, 10);
  if (draggedIndex !== toIndex) {
    moveItem(draggedIndex, toIndex);
  }
  draggedIndex = null;
});

load();
render();
if (rankInputEl) rankInputEl.value = String(items.length + 1);
