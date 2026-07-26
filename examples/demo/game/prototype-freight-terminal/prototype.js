"use strict";

// THROWAWAY PROTOTYPE: tune the accepted flat-baseline encounter, then delete or absorb.
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const LEVEL_WIDTH = 5000;
const FLOOR_Y = 620;
const keys = new Set();
const pressed = new Set();
let viewWidth = 1280;
let viewHeight = 720;
let debug = true;
let previousTime = performance.now();
let game;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, amount) => value < target
  ? Math.min(value + amount, target)
  : Math.max(value - amount, target);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  canvas.width = Math.round(viewWidth * ratio);
  canvas.height = Math.round(viewHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function makeSentry(x, lane, final = false) {
  return { type: "sentry", x, y: FLOOR_Y - 46, w: 34, h: 46, hp: 4, lane, final, active: false, timer: 0.55, telegraph: 0, shot: 0 };
}

function reset() {
  game = {
    elapsed: 0,
    completed: false,
    archiveTimer: 0,
    radio: { text: "CONTROL: Restore cargo control. Keep moving.", time: 5 },
    triggers: new Set(),
    camera: { x: 0, y: FLOOR_Y - viewHeight * 0.72, look: 0, vx: 0 },
    player: {
      x: 120, y: FLOOR_Y - 48, w: 26, h: 48,
      vx: 0, vy: 0, facing: 1, grounded: true,
      coyote: 0.1, jumpBuffer: 0, jumpHeld: false, jumpHold: 0,
      sliding: 0, fireCooldown: 0, invulnerable: 0,
      integrity: 5, aimX: 1, aimY: 0,
    },
    enemies: [
      makeSentry(1020, "low"),
      makeSentry(1700, "high"),
      { type: "shield", x: 2510, y: FLOOR_Y - 58, w: 42, h: 58, hp: 8, state: "dormant", timer: 0, vx: 0, hitFlash: 0 },
      makeSentry(4040, "alternate", true),
    ],
    playerBullets: [],
    enemyBullets: [],
    crane: { x: 3660, w: 112, phase: 0, top: 190, bottom: 190, damaging: false },
  };
}

function controlState() {
  let move = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  let aimX = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
  let aimY = (keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0);
  let jump = keys.has("Space");
  let slide = pressed.has("ShiftLeft") || pressed.has("ShiftRight") || pressed.has("KeyS");
  let interact = pressed.has("KeyE");

  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    const lx = Math.abs(pad.axes[0] || 0) > 0.3 ? pad.axes[0] : 0;
    move = Math.abs(lx) > 0 ? Math.sign(lx) : move;
    if (pad.buttons[14]?.pressed) move = -1;
    if (pad.buttons[15]?.pressed) move = 1;
    const rx = pad.axes[2] || 0;
    const ry = pad.axes[3] || 0;
    if (Math.hypot(rx, ry) > 0.35) {
      aimX = rx;
      aimY = ry;
    }
    jump ||= pad.buttons[0]?.pressed;
    slide ||= pad.buttons[1]?.pressed && !game.padSlideHeld;
    interact ||= pad.buttons[2]?.pressed && !game.padInteractHeld;
    game.padSlideHeld = Boolean(pad.buttons[1]?.pressed);
    game.padInteractHeld = Boolean(pad.buttons[2]?.pressed);
  }
  return { move, aimX, aimY, jump, slide, interact };
}

function quantizeAim(x, y) {
  if (x === 0 && y === 0) return null;
  const angle = Math.atan2(y, x);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  return { x: Math.cos(snapped), y: Math.sin(snapped) };
}

function updatePlayer(dt, controls) {
  const p = game.player;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.coyote = p.grounded ? 0.1 : Math.max(0, p.coyote - dt);
  p.jumpBuffer = controls.jump && !p.jumpHeld ? 0.1 : Math.max(0, p.jumpBuffer - dt);

  if (controls.slide && p.grounded && p.sliding <= 0) {
    p.sliding = 0.38;
    p.facing = controls.move || p.facing;
    p.vx = p.facing * 330;
  }
  p.sliding = Math.max(0, p.sliding - dt);
  p.h = p.sliding > 0 ? 22 : 48;
  p.y = p.grounded ? FLOOR_Y - p.h : p.y;

  if (p.sliding <= 0) {
    const target = controls.move * 245;
    const accel = p.grounded ? 2300 : 1050;
    p.vx = approach(p.vx, target, accel * dt);
    if (controls.move) p.facing = controls.move;
  }

  if (p.jumpBuffer > 0 && p.coyote > 0 && p.sliding <= 0) {
    p.vy = -500;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuffer = 0;
    p.jumpHold = 0.16;
  }
  if (!p.grounded) {
    const holding = controls.jump && p.jumpHold > 0 && p.vy < 0;
    p.vy += (holding ? 760 : 1550) * dt;
    p.jumpHold = controls.jump ? Math.max(0, p.jumpHold - dt) : 0;
    p.vy = Math.min(p.vy, 850);
  }
  p.jumpHeld = controls.jump;

  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 20, LEVEL_WIDTH - p.w - 20);
  if (p.y + p.h >= FLOOR_Y) {
    p.y = FLOOR_Y - p.h;
    p.vy = 0;
    p.grounded = true;
  }

  const craneBox = craneCollisionBox();
  if (craneBox && overlap(p, craneBox)) {
    const cameFromLeft = p.x + p.w / 2 < craneBox.x + craneBox.w / 2;
    p.x = cameFromLeft ? craneBox.x - p.w : craneBox.x + craneBox.w;
    p.vx = 0;
  }

  const aim = quantizeAim(controls.aimX, controls.aimY);
  if (aim) {
    p.aimX = aim.x;
    p.aimY = aim.y;
    if (p.fireCooldown <= 0) {
      game.playerBullets.push({ x: p.x + p.w / 2, y: p.y + p.h * 0.45, vx: aim.x * 720, vy: aim.y * 720, r: 4, life: 1.25 });
      p.fireCooldown = 0.12;
    }
  }

  if (controls.interact && Math.abs(p.x - 4680) < 90 && !game.completed) {
    game.completed = true;
    game.archiveTimer = 0;
    showRadio("SYSTEM: BIOMETRIC MATCH — [UNKNOWN] — KILLED IN ACTION", 4.5);
  }
}

function updateSentry(enemy, dt) {
  if (enemy.hp <= 0) return;
  if (!enemy.active) {
    if (game.player.x < enemy.x - 700) return;
    enemy.active = true;
  }
  enemy.timer -= dt;
  enemy.telegraph = Math.max(0, enemy.telegraph - dt);
  if (enemy.timer <= 0) {
    enemy.shot += 1;
    const lane = enemy.lane === "alternate" ? (enemy.shot % 2 ? "low" : "high") : enemy.lane;
    enemy.telegraph = 0.28;
    enemy.pendingLane = lane;
    enemy.timer = enemy.final ? 1.05 : 1.35;
  }
  if (enemy.telegraph > 0 && enemy.telegraph - dt <= 0) {
    const y = enemy.pendingLane === "low" ? FLOOR_Y - 21 : FLOOR_Y - 38;
    game.enemyBullets.push({ x: enemy.x - 8, y, vx: -330, vy: 0, r: 6, damage: 1, life: 4, lane: enemy.pendingLane });
  }
}

function updateShield(enemy, dt) {
  if (enemy.hp <= 0) return;
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  const p = game.player;
  enemy.timer -= dt;
  if (enemy.state === "dormant") {
    if (p.x < 2050) return;
    enemy.state = "advance";
    enemy.vx = -38;
  }
  if (enemy.state === "advance") {
    enemy.x += enemy.vx * dt;
    if (p.x < enemy.x && enemy.x - p.x < 390) {
      enemy.state = "telegraph";
      enemy.timer = 0.55;
      enemy.vx = 0;
    }
  } else if (enemy.state === "telegraph" && enemy.timer <= 0) {
    enemy.state = "charge";
    enemy.timer = 0.68;
    enemy.vx = -450;
  } else if (enemy.state === "charge") {
    enemy.x += enemy.vx * dt;
    if (enemy.timer <= 0) {
      enemy.state = "recover";
      enemy.timer = 1.2;
      enemy.vx = 0;
    }
  } else if (enemy.state === "recover" && enemy.timer <= 0) {
    enemy.state = "advance";
    enemy.vx = -38;
  }
  enemy.x = Math.max(enemy.x, 2070);
  if (overlap(p, enemy)) {
    hurtPlayer(1, p.x < enemy.x ? -1 : 1);
  }
}

function updateEnemies(dt) {
  for (const enemy of game.enemies) {
    if (enemy.type === "sentry") updateSentry(enemy, dt);
    else updateShield(enemy, dt);
  }
}

function craneCollisionBox() {
  const c = game.crane;
  if (c.bottom < FLOOR_Y - 4) return null;
  return { x: c.x, y: FLOOR_Y - 130, w: c.w, h: 130 };
}

function updateCrane(dt) {
  const c = game.crane;
  c.phase = (c.phase + dt) % 4.3;
  const p = c.phase;
  let t = 0;
  if (p < 0.7) t = 0;
  else if (p < 1.1) t = (p - 0.7) / 0.4;
  else if (p < 2.35) t = 1;
  else if (p < 2.75) t = 1 - (p - 2.35) / 0.4;
  c.bottom = 190 + (FLOOR_Y - 190) * t;
  c.damaging = p >= 0.7 && p < 1.1;
  const box = { x: c.x, y: c.bottom - 130, w: c.w, h: 130 };
  if (c.damaging && overlap(game.player, box)) hurtPlayer(2, -1);
}

function updateBullets(dt) {
  const craneBox = craneCollisionBox();
  for (const bullet of game.playerBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (craneBox && overlap({ x: bullet.x - 2, y: bullet.y - 2, w: 4, h: 4 }, craneBox)) bullet.life = 0;
    for (const enemy of game.enemies) {
      if (enemy.hp <= 0 || bullet.life <= 0 || !overlap({ x: bullet.x - 3, y: bullet.y - 3, w: 6, h: 6 }, enemy)) continue;
      if (enemy.type === "shield" && bullet.vx > 0 && bullet.x < enemy.x + enemy.w * 0.55) {
        bullet.life = 0;
        enemy.hitFlash = 0.12;
      } else {
        enemy.hp -= 1;
        bullet.life = 0;
      }
    }
  }
  for (const bullet of game.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (craneBox && overlap({ x: bullet.x - bullet.r, y: bullet.y - bullet.r, w: bullet.r * 2, h: bullet.r * 2 }, craneBox)) bullet.life = 0;
    const p = game.player;
    if (bullet.life > 0 && overlap({ x: bullet.x - bullet.r, y: bullet.y - bullet.r, w: bullet.r * 2, h: bullet.r * 2 }, p)) {
      bullet.life = 0;
      hurtPlayer(bullet.damage, -1);
    }
  }
  game.playerBullets = game.playerBullets.filter(b => b.life > 0 && b.x > 0 && b.x < LEVEL_WIDTH && b.y > 0 && b.y < FLOOR_Y + 20);
  game.enemyBullets = game.enemyBullets.filter(b => b.life > 0 && b.x > 0);
}

function hurtPlayer(amount, push) {
  const p = game.player;
  if (p.invulnerable > 0) return;
  p.integrity -= amount;
  p.invulnerable = 0.65;
  p.vx = push * 230;
  p.vy = -180;
  p.grounded = false;
  if (p.integrity <= 0) {
    showRadio("INTEGRITY ZERO — restarting introduction", 2);
    setTimeout(reset, 700);
  }
}

function showRadio(text, time = 3.5) {
  game.radio.text = text;
  game.radio.time = time;
}

function updateTriggers() {
  const x = game.player.x;
  const trigger = (name, at, text) => {
    if (x >= at && !game.triggers.has(name)) {
      game.triggers.add(name);
      showRadio(text);
    }
  };
  trigger("low", 690, "CREW: Low firing lane ahead. Jump the shot or return fire.");
  trigger("high", 1380, "CREW: Barrel is high. Get under it — slide.");
  trigger("shield", 2160, "QUESTIONING VOICE: Enforcer front is sealed. Make it commit.");
  trigger("reset", 3020, "CONTROL: Rail control is ahead. Crane cycle remains active.");
  trigger("crane", 3430, "CREW: Container blocks the lane and incoming fire. Watch the beacon.");
  trigger("terminal", 4490, "CONTROL: Use the rail terminal.");
}

function updateCamera(dt) {
  const c = game.camera;
  const p = game.player;
  c.look = approach(c.look, Math.sign(p.vx) * 115, 260 * dt);
  const target = p.x + c.look;
  const left = c.x + viewWidth * 0.38;
  const right = c.x + viewWidth * 0.62;
  let desired = c.x;
  if (target < left) desired = target - viewWidth * 0.38;
  if (target > right) desired = target - viewWidth * 0.62;
  c.vx += (desired - c.x) * 8 * dt;
  c.vx *= Math.pow(0.035, dt);
  c.x = clamp(c.x + c.vx * dt, 0, Math.max(0, LEVEL_WIDTH - viewWidth));
  c.y = FLOOR_Y - viewHeight * 0.72;
}

function update(dt) {
  game.elapsed += dt;
  game.radio.time = Math.max(0, game.radio.time - dt);
  const controls = controlState();
  updatePlayer(dt, controls);
  updateCrane(dt);
  updateEnemies(dt);
  updateBullets(dt);
  updateTriggers();
  updateCamera(dt);
  if (game.completed) {
    game.archiveTimer += dt;
    if (game.archiveTimer > 4.6 && !game.controllerReply) {
      game.controllerReply = true;
      showRadio("CONTROL: Legacy registry corruption. Cargo control is restored. Proceed to extraction.", 7);
    }
  }
}

function worldX(x) { return Math.round(x - game.camera.x); }
function worldY(y) { return Math.round(y - game.camera.y); }

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(worldX(x), worldY(y), Math.ceil(w), Math.ceil(h));
}

function drawBackground() {
  ctx.fillStyle = "#091012";
  ctx.fillRect(0, 0, viewWidth, viewHeight);
  const parallax = game.camera.x * 0.18;
  ctx.fillStyle = "#111d1e";
  for (let x = -200 - (parallax % 320); x < viewWidth + 320; x += 320) {
    ctx.fillRect(x, worldY(245), 210, 375);
    ctx.fillStyle = "#172729";
    ctx.fillRect(x + 26, worldY(285), 16, 255);
    ctx.fillRect(x + 88, worldY(260), 9, 300);
    ctx.fillStyle = "#111d1e";
  }
  ctx.strokeStyle = "#294044";
  ctx.lineWidth = 3;
  const railY = worldY(205);
  ctx.beginPath(); ctx.moveTo(0, railY); ctx.lineTo(viewWidth, railY); ctx.stroke();
  ctx.fillStyle = "#1d2d2d";
  ctx.fillRect(0, worldY(FLOOR_Y), viewWidth, viewHeight);
  ctx.fillStyle = "#4b615d";
  ctx.fillRect(0, worldY(FLOOR_Y), viewWidth, 5);
  for (let x = -(game.camera.x % 64); x < viewWidth; x += 64) {
    ctx.fillStyle = "#263b39";
    ctx.fillRect(x, worldY(FLOOR_Y + 18), 42, 4);
  }
}

function drawBeatMarkers() {
  const beats = [
    [120, "01 SAFE ARRIVAL"], [760, "02 LOW SENTRY"], [1440, "03 HIGH SENTRY"],
    [2180, "04 SHIELD ENFORCER"], [3020, "05 RESET"], [3400, "06 CRANE + SENTRY"], [4490, "07 RAIL CONTROL"],
  ];
  ctx.font = "11px ui-monospace, monospace";
  for (const [x, label] of beats) {
    const sx = worldX(x);
    if (sx < -180 || sx > viewWidth + 30) continue;
    ctx.fillStyle = "#57716b";
    ctx.fillRect(sx, worldY(FLOOR_Y - 125), 2, 125);
    ctx.fillText(label, sx + 8, worldY(FLOOR_Y - 108));
  }
}

function drawPlayer() {
  const p = game.player;
  const blink = p.invulnerable > 0 && Math.floor(p.invulnerable * 20) % 2 === 0;
  if (blink) return;
  drawRect(p.x, p.y, p.w, p.h, p.sliding > 0 ? "#9ed8c4" : "#72bca5");
  drawRect(p.x + (p.facing > 0 ? p.w - 2 : -8), p.y + 13, 10, 5, "#d8e9df");
  ctx.strokeStyle = "#cde9df";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(worldX(p.x + p.w / 2), worldY(p.y + p.h * 0.45));
  ctx.lineTo(worldX(p.x + p.w / 2 + p.aimX * 25), worldY(p.y + p.h * 0.45 + p.aimY * 25));
  ctx.stroke();
}

function drawEnemies() {
  for (const e of game.enemies) {
    if (e.hp <= 0) {
      drawRect(e.x, FLOOR_Y - 7, e.w, 7, "#3b4844");
      continue;
    }
    if (e.type === "sentry") {
      drawRect(e.x, e.y, e.w, e.h, e.telegraph > 0 ? "#e9a84a" : "#b65b4a");
      drawRect(e.x - 13, e.y + (e.pendingLane === "high" ? 7 : 25), 16, 7, "#e7d6b4");
    } else {
      drawRect(e.x, e.y, e.w, e.h, e.hitFlash > 0 ? "#e7d6b4" : "#9d6950");
      drawRect(e.x - 8, e.y + 3, 13, e.h - 6, "#d4b15d");
      if (e.state === "telegraph") {
        ctx.strokeStyle = "#f0b94f";
        ctx.strokeRect(worldX(e.x - 5), worldY(e.y - 5), e.w + 10, e.h + 10);
      }
    }
  }
}

function drawCrane() {
  const c = game.crane;
  const sx = worldX(c.x);
  const top = worldY(c.bottom - 130);
  ctx.fillStyle = c.phase < 0.7 ? "#d98d38" : "#bb5c3f";
  ctx.fillRect(sx + c.w / 2 - 5, worldY(205), 10, top - worldY(205));
  ctx.fillStyle = "#765b3d";
  ctx.fillRect(sx, top, c.w, 130);
  ctx.strokeStyle = "#d1a355";
  ctx.lineWidth = 4;
  ctx.strokeRect(sx, top, c.w, 130);
  if (c.phase < 0.7) {
    ctx.fillStyle = "rgba(230, 151, 55, .25)";
    ctx.fillRect(sx, worldY(FLOOR_Y - 8), c.w, 8);
  }
}

function drawTerminal() {
  drawRect(4680, FLOOR_Y - 92, 52, 92, game.completed ? "#72bca5" : "#496f74");
  drawRect(4690, FLOOR_Y - 78, 32, 24, game.completed ? "#d1eadf" : "#8db0ac");
  if (Math.abs(game.player.x - 4680) < 90 && !game.completed) {
    ctx.fillStyle = "#e4eee8";
    ctx.font = "14px ui-monospace, monospace";
    ctx.fillText("E / X: ACTIVATE", worldX(4635), worldY(FLOOR_Y - 115));
  }
}

function drawBullets() {
  ctx.fillStyle = "#d8f5df";
  for (const b of game.playerBullets) {
    ctx.beginPath(); ctx.arc(worldX(b.x), worldY(b.y), b.r, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of game.enemyBullets) {
    ctx.fillStyle = b.lane === "high" ? "#f0b25b" : "#e16b55";
    ctx.beginPath(); ctx.arc(worldX(b.x), worldY(b.y), b.r, 0, Math.PI * 2); ctx.fill();
  }
}

function currentBeat() {
  const x = game.player.x;
  if (x < 700) return "Safe arrival";
  if (x < 1370) return "Low-fire sentry";
  if (x < 2100) return "High-fire sentry";
  if (x < 2980) return "Shield Enforcer";
  if (x < 3380) return "Brief reset";
  if (x < 4480) return "Crane + sentry";
  return "Rail-control terminal";
}

function drawHud() {
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = "rgba(5, 10, 11, .84)";
  ctx.fillRect(18, 18, 310, 60);
  ctx.fillStyle = "#98aaa2";
  ctx.font = "11px ui-monospace, monospace";
  ctx.fillText("RIFLE MARINE · INTEGRITY", 32, 40);
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.player.integrity ? "#72bca5" : "#263533";
    ctx.fillRect(32 + i * 39, 51, 30, 10);
  }
  ctx.fillStyle = "#9fb2aa";
  ctx.fillText(`${currentBeat()} · ${game.elapsed.toFixed(1)}s`, 32, 72);

  if (game.radio.time > 0) {
    const width = Math.min(760, viewWidth - 40);
    ctx.fillStyle = "rgba(8, 16, 17, .92)";
    ctx.fillRect(20, viewHeight - 104, width, 62);
    ctx.fillStyle = "#d7e4dc";
    ctx.font = "14px ui-monospace, monospace";
    wrapText(game.radio.text, 38, viewHeight - 78, width - 36, 20);
  }
  if (debug) {
    const p = game.player;
    ctx.fillStyle = "rgba(5, 10, 11, .84)";
    ctx.fillRect(viewWidth - 315, 18, 297, 110);
    ctx.fillStyle = "#9fb2aa";
    ctx.font = "11px ui-monospace, monospace";
    const lines = [
      "PROTOTYPE STATE", `x ${p.x.toFixed(0)}  y ${p.y.toFixed(0)}`,
      `vx ${p.vx.toFixed(0)}  vy ${p.vy.toFixed(0)}`, `grounded ${p.grounded}  slide ${p.sliding.toFixed(2)}`,
      `coyote ${p.coyote.toFixed(2)}  buffer ${p.jumpBuffer.toFixed(2)}`, `camera ${game.camera.x.toFixed(0)}  bullets ${game.playerBullets.length}/${game.enemyBullets.length}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, viewWidth - 299, 38 + i * 15));
  }
  if (game.completed) {
    ctx.fillStyle = "rgba(5, 10, 11, .88)";
    ctx.fillRect(viewWidth / 2 - 260, 120, 520, 78);
    ctx.textAlign = "center";
    ctx.fillStyle = "#72bca5";
    ctx.font = "18px ui-monospace, monospace";
    ctx.fillText("CARGO LINE RESTORED", viewWidth / 2, 150);
    ctx.fillStyle = "#d8b267";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText("BIOMETRIC RECORD INTERRUPTED · R TO REPLAY", viewWidth / 2, 177);
    ctx.textAlign = "left";
  }
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = `${line}${word} `;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = `${word} `;
      y += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}

function draw() {
  drawBackground();
  drawBeatMarkers();
  drawTerminal();
  drawCrane();
  drawEnemies();
  drawBullets();
  drawPlayer();
  drawHud();
}

function frame(time) {
  const dt = Math.min((time - previousTime) / 1000, 1 / 30);
  previousTime = time;
  update(dt);
  draw();
  pressed.clear();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", event => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (!keys.has(event.code)) pressed.add(event.code);
  keys.add(event.code);
  if (event.code === "KeyR") reset();
  if (event.code === "F1") { debug = !debug; event.preventDefault(); }
});
window.addEventListener("keyup", event => keys.delete(event.code));
window.addEventListener("blur", () => { keys.clear(); pressed.clear(); });

resize();
reset();
requestAnimationFrame(frame);
