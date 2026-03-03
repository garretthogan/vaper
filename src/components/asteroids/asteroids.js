const canvas = document.getElementById('asteroids-canvas');
  const statusEl = document.getElementById('asteroids-status');
  const restartBtn = document.getElementById('asteroids-restart');
  if (!canvas || !statusEl || !restartBtn) return;

  const root = canvas.closest('[data-component="asteroids"]');
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
  const W = canvas.width;
  const H = canvas.height;
  const TURN = 0.08;
  const THRUST = 0.25;
  const BULLET_SPEED = 8;
  const BULLET_TTL = 45;
  const ASTEROID_RADII = { 3: 28, 2: 16, 1: 8 };
  const SHIP_R = 10;
  const INVULN_FRAMES = 90;

  let ship = { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
  let bullets = [];
  let asteroids = [];
  let score = 0;
  let running = false;
  let invuln = 0;
  let animId = null;

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function wrap(x, y) {
    return [(x + W) % W, (y + H) % H];
  }

  function spawnAsteroid(size, atEdge) {
    const r = ASTEROID_RADII[size];
    let x, y;
    if (atEdge) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = -r; y = Math.random() * H; }
      else if (side === 1) { x = W + r; y = Math.random() * H; }
      else if (side === 2) { x = Math.random() * W; y = -r; }
      else { x = Math.random() * W; y = H + r; }
    } else {
      x = Math.random() * W;
      y = Math.random() * H;
    }
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.8 + Math.random() * 0.8;
    asteroids.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size,
      r,
      verts: 8,
      rot: (Math.random() - 0.5) * 0.02,
      rotOff: Math.random() * Math.PI * 2,
    });
  }

  function initAsteroids() {
    asteroids = [];
    for (let i = 0; i < 4; i++) spawnAsteroid(3, true);
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function hitShipAsteroid() {
    if (invuln > 0) return false;
    for (const a of asteroids) {
      const [sx, sy] = wrap(ship.x, ship.y);
      let ax = a.x, ay = a.y;
      for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
        if (Math.hypot(sx - (ax + dx), sy - (ay + dy)) < a.r + SHIP_R) return true;
      }
    }
    return false;
  }

  function tick() {
    if (!running) return;

    if (invuln > 0) invuln--;

    ship.angle += ship.turn || 0;
    if (ship.thrust) {
      ship.vx += Math.cos(ship.angle) * THRUST;
      ship.vy += Math.sin(ship.angle) * THRUST;
    }
    ship.vx *= 0.98;
    ship.vy *= 0.98;
    ship.x += ship.vx;
    ship.y += ship.vy;
    [ship.x, ship.y] = wrap(ship.x, ship.y);

    bullets = bullets.filter((b) => {
      b.x += b.vx;
      b.y += b.vy;
      b.ttl--;
      if (b.ttl <= 0) return false;
      [b.x, b.y] = wrap(b.x, b.y);
      return true;
    });

    for (const a of asteroids) {
      a.x += a.vx;
      a.y += a.vy;
      a.rotOff += a.rot;
      [a.x, a.y] = wrap(a.x, a.y);
    }

    bulletLoop: for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const [bx, by] = wrap(b.x, b.y);
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const a = asteroids[j];
        for (const dx of [-W, 0, W]) {
          for (const dy of [-H, 0, H]) {
            if (Math.hypot(bx - (a.x + dx), by - (a.y + dy)) < a.r) {
              score += a.size * 10;
              setStatus('Score: ' + score);
              asteroids.splice(j, 1);
              if (a.size > 1) {
                const angle = Math.atan2(b.vy, b.vx);
                const r = ASTEROID_RADII[a.size - 1];
                [1, -1].forEach((s) => {
                  const off = s * 0.5;
                  asteroids.push({
                    x: a.x, y: a.y,
                    vx: a.vx + Math.cos(angle + off) * 1.5,
                    vy: a.vy + Math.sin(angle + off) * 1.5,
                    size: a.size - 1,
                    r,
                    verts: 8,
                    rot: (Math.random() - 0.5) * 0.02,
                    rotOff: Math.random() * Math.PI * 2,
                  });
                });
              }
              bullets.splice(i, 1);
              continue bulletLoop;
            }
          }
        }
      }
    }

    if (hitShipAsteroid()) {
      running = false;
      setStatus('Game over! Score: ' + score + ' — Restart to play again.');
      return;
    }

    if (asteroids.length === 0) {
      initAsteroids();
    }

    draw();
  }

  function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (const a of asteroids) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < a.verts; i++) {
        const angle = a.rotOff + (i / a.verts) * Math.PI * 2;
        const r = a.r * (0.7 + Math.sin(i * 1.3) * 0.3);
        const x = a.x + Math.cos(angle) * r;
        const y = a.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    for (const b of bullets) {
      const [x, y] = wrap(b.x, b.y);
      ctx.fillStyle = '#00d4ff';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const [sx, sy] = wrap(ship.x, ship.y);
    ctx.strokeStyle = invuln > 0 && Math.floor(invuln / 5) % 2 === 0 ? '#555' : '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const n = 3;
    for (let i = 0; i <= n; i++) {
      const angle = ship.angle + (i / n) * Math.PI * 2;
      const r = i === 0 ? SHIP_R : SHIP_R * 0.6;
      const x = sx + Math.cos(angle) * r;
      const y = sy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function start() {
    if (running) return;
    running = true;
    invuln = INVULN_FRAMES;
    setStatus('Score: ' + score);
    if (!animId) loop();
  }

  function loop() {
    tick();
    animId = running ? requestAnimationFrame(loop) : null;
  }

  function restart() {
    running = false;
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    ship = { x: W / 2, y: H / 2, angle: -Math.PI / 2, vx: 0, vy: 0 };
    bullets = [];
    score = 0;
    initAsteroids();
    invuln = 0;
    setStatus('Score: 0 — Arrow keys move, Space to shoot. Click canvas to start.');
    draw();
  }

  document.addEventListener('keydown', function (e) {
    if (!hasFocus()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) === -1) return;
    e.preventDefault();
    if (!running && e.key !== ' ') { start(); }
    if (e.key === 'ArrowLeft') ship.turn = -TURN;
    if (e.key === 'ArrowRight') ship.turn = TURN;
    if (e.key === 'ArrowUp') ship.thrust = true;
    if (e.key === 'ArrowDown') ship.thrust = false;
    if (e.key === ' ' && running && bullets.length < 6) {
      bullets.push({
        x: ship.x,
        y: ship.y,
        vx: ship.vx + Math.cos(ship.angle) * BULLET_SPEED,
        vy: ship.vy + Math.sin(ship.angle) * BULLET_SPEED,
        ttl: BULLET_TTL,
      });
    }
  });

  document.addEventListener('keyup', function (e) {
    if (!hasFocus()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') ship.turn = 0;
    if (e.key === 'ArrowUp') ship.thrust = false;
  });

  canvas.addEventListener('click', function () {
    if (!running) { canvas.focus(); start(); }
  });

  canvas.addEventListener('focus', function () {
    if (!running) setStatus('Score: ' + score + ' — Press arrow keys or space to start.');
  });

  restartBtn.addEventListener('click', restart);

  initAsteroids();
  draw();
