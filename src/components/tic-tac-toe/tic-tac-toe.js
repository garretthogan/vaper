const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  let squares = Array(9).fill(null);
  let currentPlayer = 'X';

  const root = document.querySelector('[data-component="tic-tac-toe"]');
  if (!root) return;
  const board = root.querySelector('#board');
  const status = root.querySelector('#status');
  const restartBtn = root.querySelector('#restart');

  if (!board || !status || !restartBtn) return;

  function getWinner() {
    for (const [a, b, c] of LINES) {
      const v = squares[a];
      if (v && v === squares[b] && v === squares[c]) return v;
    }
    return null;
  }

  function isDraw() {
    return squares.every(Boolean);
  }

  function getCellElements() {
    return board.querySelectorAll('[data-cell]');
  }

  function renderCells() {
    getCellElements().forEach((el, i) => {
      el.textContent = squares[i] || '';
      el.disabled = !!squares[i];
    });
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function updateStatus() {
    const winner = getWinner();
    if (winner) {
      setStatus(`Player ${winner} wins!`);
      return;
    }
    if (isDraw()) {
      setStatus("It's a draw!");
      return;
    }
    setStatus(`Player ${currentPlayer}'s turn`);
  }

  function handleCellClick(e) {
    const btn = e.target.closest('[data-cell]');
    if (!btn || btn.disabled) return;
    const i = parseInt(btn.dataset.cell, 10);
    if (squares[i] != null) return;
    squares[i] = currentPlayer;
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    renderCells();
    updateStatus();
  }

  function restart() {
    squares = Array(9).fill(null);
    currentPlayer = 'X';
    renderCells();
    updateStatus();
  }

  board.addEventListener('click', handleCellClick);
  restartBtn.addEventListener('click', restart);

  renderCells();
  updateStatus();
