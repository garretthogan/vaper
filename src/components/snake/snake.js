
  const canvas = document.getElementById('snake-canvas');
  const statusEl = document.getElementById('snake-status');
  const restartBtn = document.getElementById('snake-restart');
  if (!canvas || !statusEl || !restartBtn) return;

  const root = canvas.closest('[data-component="snake"]');
  if (root) {
    root.setAttribute('tabindex', '0');
    root.addEventListener('click', function (e) {
      if (!e.target.closest('button')) canvas.focus();
    });
  }

  function hasFocus() {
    return root && root.contains(document.activeElement);
  }

  const ctx = canvas.getContext('2d');
  const COLS = 14;
  const ROWS = 14;
  const CELL = Math.min(canvas.width / COLS, canvas.height / ROWS);
  const PAD_X = (canvas.width - COLS * CELL) / 2;
  const PAD_Y = (canvas.height - ROWS * CELL) / 2;

  let snake = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 10, y: 7 };
  let score = 0;
  let running = false;
  let tickId = null;
  const TICK_MS = 120;

  function randCell() {
    return { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  }

  function placeFood() {
    do {
      food = randCell();
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function drawCell(x, y, fill) {
    const px = PAD_X + x * CELL;
    const py = PAD_Y + y * CELL;
    ctx.fillStyle = fill;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCell(food.x, food.y, '#ff00ff');
    snake.forEach((seg, i) => {
      drawCell(seg.x, seg.y, i === 0 ? '#00d4ff' : '#555');
    });
  }

  function tick() {
    if (!running) return;
    dir = nextDir;
    const head = snake[0];
    const nx = (head.x + dir.x + COLS) % COLS;
    const ny = (head.y + dir.y + ROWS) % ROWS;
    if (snake.some(s => s.x === nx && s.y === ny)) {
      running = false;
      setStatus('Game over! Score: ' + score + ' — Click Restart to play again.');
      return;
    }
    snake.unshift({ x: nx, y: ny });
    if (nx === food.x && ny === food.y) {
      score += 10;
      setStatus('Score: ' + score);
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function startLoop() {
    if (tickId) return;
    tickId = setInterval(tick, TICK_MS);
  }

  function stopLoop() {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
  }

  function start() {
    if (running) return;
    running = true;
    setStatus('Score: ' + score);
    startLoop();
  }

  function restart() {
    stopLoop();
    snake = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    placeFood();
    running = false;
    setStatus('Score: 0 — Press arrow keys or click canvas to start');
    draw();
  }

  document.addEventListener('keydown', function (e) {
    if (!hasFocus()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) === -1) return;
    e.preventDefault();
    if (!running && e.key) start();
    if (e.key === 'ArrowUp' && dir.y !== 1) nextDir = { x: 0, y: -1 };
    if (e.key === 'ArrowDown' && dir.y !== -1) nextDir = { x: 0, y: 1 };
    if (e.key === 'ArrowLeft' && dir.x !== 1) nextDir = { x: -1, y: 0 };
    if (e.key === 'ArrowRight' && dir.x !== -1) nextDir = { x: 1, y: 0 };
  });

  canvas.addEventListener('click', function () {
    if (!running) {
      canvas.focus();
      start();
    }
  });

  canvas.addEventListener('focus', function () {
    if (!running) setStatus('Score: 0 — Press an arrow key to start');
  });

  restartBtn.addEventListener('click', restart);

  placeFood();
  draw();
