/* =========================================================
   GAME JAM SIMULATOR — game.js
   State machine, scoring, day loop and all interaction.
   Depends on: JamAudio, JamData, JamRender
   ========================================================= */
(function (global) {
  "use strict";

  var D = global.JamData;
  var R = global.JamRender;
  var A = global.JamAudio;
  var GEARS = D.GEARS, GRAPHICS = D.GRAPHICS, CONFIG = D.CONFIG, DAYS = D.DAYS;

  // ---- board geometry (internal canvas coords) ----
  var CELL = 42, BX = 12, BY = 20;
  var COLS = CONFIG.boardCols, ROWS = CONFIG.boardRows;

  // ---- DOM ----
  var canvas, ctx, els = {};
  var uid = 1;

  // ---- game state ----
  var G = {
    state: "title",
    day: 0,
    goal: 0,
    time: 0, maxTime: CONFIG.baseTime,
    energy: 0, maxEnergy: 36,
    board: [],
    hand: [],
    cursor: null,           // {mode:'place'|'graphic'|'move', idx?, c?, r?}
    hoverCell: null,        // {c,r}
    hoverSpot: null,        // 'monitor' | 'fridge'
    score: { chips: 0, mult: 1, hype: 0, connected: new Set(), wires: [] },
    debuff: null, debuffInfo: null,
    pendingDebuff: null, pendingDebuffInfo: null,
    nextEnergy: CONFIG.startEnergy,
    crashUsed: false,
    fridgeActive: false,
    running: false,
    runClock: 0,
    toastTimer: 0
  };

  // =========================================================
  //  INIT
  // =========================================================
  function init() {
    canvas = document.getElementById("game");
    ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    els.hud = document.getElementById("hud");
    els.tray = document.getElementById("tray");
    els.hand = document.getElementById("hand");
    els.overlay = document.getElementById("overlay");
    els.tooltip = document.getElementById("tooltip");
    els.status = document.getElementById("statusbar");
    els.stage = document.getElementById("stage");
    els.day = document.getElementById("hud-day");
    els.goal = document.getElementById("hud-goal");
    els.time = document.getElementById("hud-time");
    els.energy = document.getElementById("hud-energy");
    els.hype = document.getElementById("hud-hype");
    els.barTime = document.getElementById("bar-time");
    els.barEnergy = document.getElementById("bar-energy");
    els.chipsOut = document.getElementById("chips-out");
    els.multOut = document.getElementById("mult-out");
    els.runBtn = document.getElementById("btn-run");
    els.muteBtn = document.getElementById("btn-mute");

    // input
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerleave", function () {
      G.hoverCell = null; G.hoverSpot = null; hideTooltip();
    });
    els.runBtn.addEventListener("click", doRun);
    els.muteBtn.addEventListener("click", function () {
      var m = A.toggleMute();
      els.muteBtn.textContent = m ? "🔇" : "🔊";
    });
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", function () { A.unlock(); }, { once: true });

    showTitle();
    requestAnimationFrame(loop);
  }

  // =========================================================
  //  COORDINATE MAPPING (handles object-fit: contain)
  // =========================================================
  function toInternal(e) {
    var rect = canvas.getBoundingClientRect();
    var scale = Math.min(rect.width / R.W, rect.height / R.H);
    var dw = R.W * scale, dh = R.H * scale;
    var ox = (rect.width - dw) / 2, oy = (rect.height - dh) / 2;
    var x = (e.clientX - rect.left - ox) / scale;
    var y = (e.clientY - rect.top - oy) / scale;
    return { x: x, y: y };
  }

  function cellAt(x, y) {
    var c = Math.floor((x - BX) / CELL);
    var r = Math.floor((y - BY) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { c: c, r: r };
  }

  function cellCenter(c, r) {
    return { x: BX + c * CELL + CELL / 2, y: BY + r * CELL + CELL / 2 };
  }

  function inRect(x, y, R2) {
    return x >= R2.x && x <= R2.x + R2.w && y >= R2.y && y <= R2.y + R2.h;
  }

  // =========================================================
  //  INPUT
  // =========================================================
  function onPointerMove(e) {
    var p = toInternal(e);
    if (G.state === "room") {
      var hs = null;
      if (inRect(p.x, p.y, R.HOTSPOTS.monitor)) hs = "monitor";
      else if (G.fridgeActive && inRect(p.x, p.y, R.HOTSPOTS.fridge)) hs = "fridge";
      if (hs !== G.hoverSpot) { G.hoverSpot = hs; }
      hideTooltip();
    } else if (G.state === "workshop") {
      var cell = cellAt(p.x, p.y);
      G.hoverCell = cell;
      // tooltip for board gears
      if (cell) {
        var cc = G.board[cell.r][cell.c];
        if (cc.gid) { showGearTooltip(cc, e.clientX, e.clientY); }
        else hideTooltip();
      } else hideTooltip();
    }
  }

  function onPointerDown(e) {
    var p = toInternal(e);
    if (G.state === "room") {
      if (inRect(p.x, p.y, R.HOTSPOTS.monitor)) { A.sfx.ui(); enterWorkshop(); }
      else if (G.fridgeActive && inRect(p.x, p.y, R.HOTSPOTS.fridge)) { A.sfx.ui(); openDrinkChoice(); }
    } else if (G.state === "workshop") {
      var cell = cellAt(p.x, p.y);
      if (cell) onBoardClick(cell.c, cell.r);
    }
  }

  function onKey(e) {
    if (G.state !== "workshop") return;
    if (e.key === "Escape") { G.cursor = null; renderTray(); updateHint(); }
    else if (e.key === "Enter") doRun();
  }

  // =========================================================
  //  DAY LIFECYCLE
  // =========================================================
  function newGame() {
    G.day = 0;
    G.pendingDebuff = null; G.pendingDebuffInfo = null;
    G.nextEnergy = CONFIG.startEnergy;
    startDay();
  }

  function startDay() {
    var dd = DAYS[G.day];
    G.goal = dd.goal;
    G.debuff = G.pendingDebuff;
    G.debuffInfo = G.pendingDebuffInfo;
    G.pendingDebuff = null; G.pendingDebuffInfo = null;

    G.energy = (G.day === 0) ? CONFIG.startEnergy : G.nextEnergy;
    G.maxEnergy = 36;
    G.time = CONFIG.baseTime - (G.debuff === "jittery" ? 3 : 0);
    G.maxTime = CONFIG.baseTime;

    buildBoard();
    dealHand();
    G.crashUsed = false;
    G.cursor = null;
    G.fridgeActive = false;
    G.running = false;

    computeScore();
    showDayIntro(dd);
    updateHUD();
  }

  function buildBoard() {
    G.board = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push({ gid: null, graphic: null, angle: Math.random() * 6.28 });
      G.board.push(row);
    }
    var cc = CONFIG.coreCell;
    G.board[cc.r][cc.c] = { gid: "core", graphic: null, angle: 0 };
  }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function dealHand() {
    G.hand = [];
    var nGears = CONFIG.handGears - (G.debuff === "foggy" ? 1 : 0);
    var i, hasBasic = false;
    for (i = 0; i < nGears; i++) {
      var gid = pick(D.GEAR_POOL);
      if (gid === "jump" || gid === "shoot" || gid === "dash") hasBasic = true;
      G.hand.push({ kind: "gear", gid: gid, jammed: false, uid: uid++ });
    }
    // guarantee at least one cheap chip gear so the day is always doable
    if (!hasBasic && G.hand.length) {
      G.hand[(Math.random() * G.hand.length) | 0] = { kind: "gear", gid: "jump", jammed: false, uid: uid++ };
    }
    for (i = 0; i < CONFIG.handGraphics; i++) {
      G.hand.push({ kind: "graphic", grid: pick(D.GRAPHIC_POOL), uid: uid++ });
    }
    // meltdown debuff jams one random gear card
    if (G.debuff === "meltdown") {
      var gearCards = G.hand.filter(function (h) { return h.kind === "gear"; });
      if (gearCards.length) gearCards[(Math.random() * gearCards.length) | 0].jammed = true;
    }
  }

  function enterWorkshop() {
    G.state = "workshop";
    applyChrome();
    renderTray();
    updateHUD();
    updateHint();
  }

  // =========================================================
  //  BOARD ACTIONS
  // =========================================================
  function onHandCardClick(idx) {
    if (G.running) return;
    var card = G.hand[idx];
    if (!card) return;
    if (card.jammed) { toast("⚠ That gear is JAMMED — try another."); A.sfx.error(); return; }

    if (card.kind === "gear") {
      var gd = GEARS[card.gid];
      if (G.time < gd.time) { toast("⏱ Not enough time to code that."); A.sfx.error(); return; }
      if (G.energy <= 0) { toast("⚡ You're out of energy — hit SHIP IT!"); A.sfx.error(); return; }
      if (G.cursor && G.cursor.mode === "place" && G.cursor.idx === idx) G.cursor = null;
      else G.cursor = { mode: "place", idx: idx };
    } else {
      if (G.energy <= 0) { toast("⚡ Too tired to paint — hit SHIP IT!"); A.sfx.error(); return; }
      if (G.cursor && G.cursor.mode === "graphic" && G.cursor.idx === idx) G.cursor = null;
      else G.cursor = { mode: "graphic", idx: idx };
    }
    A.sfx.select();
    renderTray();
    updateHint();
  }

  function onBoardClick(c, r) {
    if (G.running) return;
    var cell = G.board[r][c];
    var cur = G.cursor;

    if (cur && cur.mode === "place") {
      if (cell.gid) { toast("That slot's already taken."); A.sfx.error(); return; }
      placeGear(cur.idx, c, r);
    } else if (cur && cur.mode === "graphic") {
      if (!cell.gid) { toast("Apply art to a GEAR, not empty space."); A.sfx.error(); return; }
      applyGraphic(cur.idx, c, r);
    } else if (cur && cur.mode === "move") {
      if (c === cur.c && r === cur.r) { G.cursor = null; A.sfx.select(); }
      else if (cell.gid === "core") { toast("The CORE is bolted down."); A.sfx.error(); }
      else if (cell.gid) { G.cursor = { mode: "move", c: c, r: r }; A.sfx.select(); }
      else moveGear(cur.c, cur.r, c, r);
    } else {
      if (cell.gid === "core") { toast("That's your CORE LOOP — everything connects to it."); }
      else if (cell.gid) { G.cursor = { mode: "move", c: c, r: r }; A.sfx.select(); }
    }
    renderTray();
    updateHint();
  }

  function placeGear(idx, c, r) {
    var card = G.hand[idx];
    var gd = GEARS[card.gid];
    if (G.time < gd.time) { toast("⏱ Not enough time."); A.sfx.error(); return; }

    var eCost = gd.energy + (G.debuff === "wired" ? 1 : 0);
    if (G.debuff === "crash" && !G.crashUsed) eCost *= 2;
    var over = eCost > G.energy;

    G.board[r][c] = { gid: card.gid, graphic: null, angle: Math.random() * 6.28 };
    G.time -= gd.time;
    G.energy = Math.max(0, G.energy - eCost);
    G.crashUsed = true;
    G.hand.splice(idx, 1);
    G.cursor = null;
    A.sfx.place();
    computeScore();
    updateHUD();
    if (over) triggerPassout();
  }

  function applyGraphic(idx, c, r) {
    var card = G.hand[idx];
    var gr = GRAPHICS[card.grid];
    if (G.time < gr.time) { toast("⏱ Not enough time to polish."); A.sfx.error(); return; }
    var over = gr.energy > G.energy;

    G.board[r][c].graphic = card.grid;
    G.time -= gr.time;
    G.energy = Math.max(0, G.energy - gr.energy);
    G.hand.splice(idx, 1);
    G.cursor = null;
    A.sfx.apply();
    computeScore();
    updateHUD();
    if (over) triggerPassout();
  }

  function moveGear(fc, fr, tc, tr) {
    G.board[tr][tc] = G.board[fr][fc];
    G.board[fr][fc] = { gid: null, graphic: null, angle: 0 };
    G.cursor = null;
    A.sfx.place();
    computeScore();
    updateHUD();
  }

  // =========================================================
  //  SCORING  (HYPE = chips × mult)
  // =========================================================
  function computeScore() {
    var cc = CONFIG.coreCell;
    var connected = new Set();
    var stack = [[cc.c, cc.r]];
    connected.add(cc.c + "," + cc.r);
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length) {
      var cur = stack.pop();
      for (var d = 0; d < 4; d++) {
        var nc = cur[0] + dirs[d][0], nr = cur[1] + dirs[d][1];
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        var key = nc + "," + nr;
        if (connected.has(key)) continue;
        if (G.board[nr][nc].gid) { connected.add(key); stack.push([nc, nr]); }
      }
    }

    var n = connected.size;
    var chips = 0, mult = 1, xmults = [];
    connected.forEach(function (key) {
      var parts = key.split(","), c = +parts[0], r = +parts[1];
      var cell = G.board[r][c];
      var gd = GEARS[cell.gid];
      chips += gd.chips;
      mult += gd.mult;
      if (gd.type === "chain") chips += 2 * (n - 1);
      if (gd.type === "xmult") xmults.push(gd.xmult);
      if (cell.graphic) {
        var gr = GRAPHICS[cell.graphic];
        chips += gr.chips;
        mult += gr.mult;
      }
    });

    // art-direction synergy: connected, adjacent gears sharing a style
    var wires = [];
    connected.forEach(function (key) {
      var parts = key.split(","), c = +parts[0], r = +parts[1];
      [[1, 0], [0, 1]].forEach(function (dir) {
        var nc = c + dir[0], nr = r + dir[1];
        if (!connected.has(nc + "," + nr)) return;
        wires.push([c, r, nc, nr]);
        var a = G.board[r][c], b = G.board[nr][nc];
        if (a.graphic && b.graphic && a.graphic === b.graphic) mult += D.ART_SYNERGY_MULT;
      });
    });

    for (var x = 0; x < xmults.length; x++) mult *= xmults[x];
    mult = Math.round(mult * 100) / 100;

    G.score = {
      chips: chips,
      mult: mult,
      hype: Math.round(chips * Math.max(mult, 0)),
      connected: connected,
      wires: wires,
      connCount: n
    };
    return G.score;
  }

  function triggerPassout() {
    G.running = true;
    G.cursor = null;
    A.sfx.passout();
    updateHUD();
    renderTray();
    overlay(
      '<div class="modal">' +
      '<h1>😵 YOU PASSED OUT</h1>' +
      '<p class="lead">You pushed past your last drop of energy and faceplanted on the keyboard.</p>' +
      '<p>The build ships with whatever you managed to finish.</p>' +
      '<button class="big-btn" id="ov-btn">Ugh… see the damage →</button>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () { hideOverlay(); finalizeRun(); };
  }

  // =========================================================
  //  RUN / FINALIZE
  // =========================================================
  function doRun() {
    if (G.running || G.state !== "workshop") return;
    G.running = true;
    G.cursor = null;
    renderTray();
    updateHint();
    els.runBtn.disabled = true;
    A.sfx.run();
    G.runClock = 1.25; // seconds of dramatic spinning
  }

  function finalizeRun() {
    G.running = false;
    els.runBtn.disabled = false;
    var sc = computeScore();
    var passed = sc.hype >= G.goal;
    var isFinal = G.day === DAYS.length - 1;
    if (passed && isFinal) { showWin(sc); }
    else if (passed) { showResult(sc); }
    else { showLose(sc); }
  }

  // =========================================================
  //  DRINKS
  // =========================================================
  function openDrinkChoice() {
    G.state = "fridge";
    applyChrome();
    // offer 3 random distinct drinks
    var pool = D.DRINKS.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0; var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    var offer = pool.slice(0, 3);
    var html = '<div class="modal"><h1>🧊 THE FRIDGE</h1>' +
      '<p class="lead">Another all-nighter looms. Choose your fuel — each one hits different (and worse).</p>' +
      '<div class="choices">';
    offer.forEach(function (d, k) {
      html += '<div class="drink" data-i="' + k + '">' +
        '<div class="d-emoji">' + d.emoji + '</div>' +
        '<div class="d-name">' + d.name + '</div>' +
        '<div class="d-energy">⚡ Wake with ' + d.energy + ' energy</div>' +
        '<div class="d-debuff">😖 ' + d.debuffName + ':<br>' + d.debuffText + '</div>' +
        '<div class="d-flavor">"' + d.flavor + '"</div>' +
        '</div>';
    });
    html += '</div></div>';
    overlay(html);
    var nodes = els.overlay.querySelectorAll(".drink");
    nodes.forEach(function (node) {
      node.onclick = function () { chooseDrink(offer[+node.getAttribute("data-i")]); };
    });
  }

  function chooseDrink(d) {
    A.sfx.sip();
    G.nextEnergy = d.energy;
    G.pendingDebuff = d.debuff;
    G.pendingDebuffInfo = d;
    hideOverlay();
    G.day++;
    startDay();
  }

  // =========================================================
  //  MODALS
  // =========================================================
  function showTitle() {
    G.state = "title";
    applyChrome();
    overlay(
      '<div class="modal">' +
      '<h1>🎮 GAME JAM<br>SIMULATOR</h1>' +
      '<p class="lead">You have <b>7 days</b> to make a game. You have a computer, a mini-fridge, and questionable life choices.</p>' +
      '<p>Build your game by connecting <b>gears</b> (mechanics) to the glowing <b>CORE</b>. ' +
      'Slap on <b>art styles</b> for bonus points. Hit the <b>HYPE</b> goal before <b>time</b> runs out — ' +
      'but coding drains <b>energy</b>, and if it hits zero, you pass out.</p>' +
      '<ul class="tips">' +
      '<li>HYPE = <span style="color:#6ee7ff">chips</span> × <span style="color:#ff5d8f">mult</span>. Both come from connected gears.</li>' +
      '<li>Only gears connected to the CORE spin and score.</li>' +
      '<li>Two touching gears with the <i>same</i> art style give a big mult bonus.</li>' +
      '<li>Coding costs ⚡energy &amp; ⏱time. Each night, pick an energy drink (they all have a catch).</li>' +
      '</ul>' +
      '<button class="big-btn" id="ov-btn">▶ START THE JAM</button>' +
      '<p class="small">Tip: click a card, then click the board. Click a placed gear to move it (free).</p>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); newGame(); };
  }

  function showDayIntro(dd) {
    G.state = "dayintro";
    applyChrome();
    var debuffHtml = "";
    if (G.debuff && G.debuffInfo) {
      debuffHtml = '<p style="color:#ff5d8f">😖 Hangover — <b>' + G.debuffInfo.debuffName + '</b>: ' +
        G.debuffInfo.debuffText + '</p>';
    }
    overlay(
      '<div class="modal">' +
      '<h1>' + dd.title + '</h1>' +
      '<p class="lead">' + dd.note + '</p>' +
      '<h2>Goal: <span class="big-num">' + dd.goal + ' HYPE</span></h2>' +
      '<p>⚡ Energy <b>' + G.energy + '</b> &nbsp; ⏱ Time <b>' + G.time + '</b></p>' +
      debuffHtml +
      '<button class="big-btn" id="ov-btn">🖥️ Get to work →</button>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () {
      A.sfx.ui(); hideOverlay(); G.state = "room"; G.hoverSpot = null; applyChrome(); updateHint();
    };
  }

  function breakdownHtml(sc) {
    return '<div class="scoreline" style="display:inline-block;margin:10px auto">' +
      '<span id="" style="color:#6ee7ff">' + sc.chips + '</span> ' +
      '<span style="color:#9a93b8">×</span> ' +
      '<span style="color:#ff5d8f">' + fmtMult(sc.mult) + '</span> ' +
      '<span style="color:#9a93b8">=</span> ' +
      '<span style="color:#ff8a3d">' + sc.hype + '</span></div>';
  }

  function showResult(sc) {
    G.state = "result";
    applyChrome();
    A.sfx.cash();
    overlay(
      '<div class="modal">' +
      '<h1 class="win">✅ DAY CLEARED!</h1>' +
      '<p class="lead">You hit <b>' + sc.hype + '</b> hype (needed ' + G.goal + '). The build compiles. Miracles happen.</p>' +
      breakdownHtml(sc) +
      '<p>' + flavorForScore(sc) + '</p>' +
      '<button class="big-btn" id="ov-btn">🧊 Hit the fridge →</button>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () {
      A.sfx.ui(); hideOverlay(); G.state = "room"; G.fridgeActive = true; G.hoverSpot = null;
      applyChrome(); updateHint();
    };
  }

  function showWin(sc) {
    G.state = "win";
    applyChrome();
    A.sfx.win();
    overlay(
      '<div class="modal">' +
      '<h1 class="win">🏆 YOU SHIPPED IT!</h1>' +
      '<p class="lead">Final day hype: <b>' + sc.hype + '</b> / ' + G.goal + '. Your game is <b>submitted</b>!</p>' +
      breakdownHtml(sc) +
      '<p>The jam is over. You survived on ' + '7 nights of energy drinks and spite. ' +
      'Somewhere, a stranger is about to rate your game 5 stars.</p>' +
      '<p class="small">Thanks for playing GAME JAM SIMULATOR 💜</p>' +
      '<button class="big-btn" id="ov-btn">🔁 Jam again</button>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); showTitle(); };
  }

  function showLose(sc) {
    G.state = "gameover";
    applyChrome();
    A.sfx.lose();
    var reason = G.energy <= 0 ? "You ran out of steam" : "You ran out of time";
    overlay(
      '<div class="modal">' +
      '<h1 class="lose">💀 JAM OVER</h1>' +
      '<p class="lead">Day ' + (G.day + 1) + ': only <b>' + sc.hype + '</b> hype (needed ' + G.goal + ').</p>' +
      breakdownHtml(sc) +
      '<p>' + reason + ', and the deadline waits for no one. Your game page reads ' +
      '"' + snarkyName() + ' — coming soon" forever.</p>' +
      '<button class="big-btn" id="ov-btn">🔁 Try the jam again</button>' +
      '</div>'
    );
    document.getElementById("ov-btn").onclick = function () { A.sfx.ui(); hideOverlay(); showTitle(); };
  }

  function flavorForScore(sc) {
    if (sc.mult >= 8) return "That combo multiplier is downright illegal. Chef's kiss.";
    if (sc.connCount >= 7) return "A glorious mega-machine of interlocking ideas.";
    if (sc.chips >= 40) return "Chunky, chip-heavy, and undeniably content-rich.";
    return "Scrappy, but it works. Ship it and sleep... eventually.";
  }

  var NAMES = ["Untitled Gear Game", "Gears: The Gearening", "ProtoJam", "Definitely Not Finished", "Almost: A Game"];
  function snarkyName() { return NAMES[(Math.random() * NAMES.length) | 0]; }

  function fmtMult(m) { return Number.isInteger(m) ? String(m) : m.toFixed(1); }

  // =========================================================
  //  RENDERING
  // =========================================================
  var last = 0;
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt, now / 1000);
    render(now / 1000);
    requestAnimationFrame(loop);
  }

  function update(dt, t) {
    // spin board gears
    if (G.board.length) {
      for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
        var cell = G.board[r][c];
        if (!cell.gid) continue;
        var connected = G.score.connected && G.score.connected.has(c + "," + r);
        var speed = connected ? (G.running ? 9 : 2.2) : 0.5;
        if (cell.gid === "core") speed = G.running ? 9 : 2.6;
        var dir = ((c + r) % 2 === 0) ? 1 : -1;
        cell.angle += speed * dir * dt;
      }
    }
    // run countdown
    if (G.runClock > 0) {
      G.runClock -= dt;
      if (G.runClock <= 0) { G.runClock = 0; finalizeRun(); }
    }
  }

  function render(t) {
    ctx.imageSmoothingEnabled = false;
    if (G.state === "workshop" || G.state === "result") {
      renderBoard(t);
    } else {
      // room-ish backdrop for title / dayintro / room / fridge / win / lose
      var mood = (G.state === "win") ? "happy" : (G.hoverSpot === "monitor" ? "" : "");
      R.room(ctx, t, {
        hover: G.hoverSpot,
        fridgeActive: G.fridgeActive && G.state === "room",
        mood: mood
      });
    }
  }

  function renderBoard(t) {
    R.clear(ctx);
    // backdrop
    R.px(ctx, 0, 0, R.W, R.H, "#171326");
    R.px(ctx, 0, 0, R.W, R.H, "#171326");
    var grad = ctx.createLinearGradient(0, 0, 0, R.H);
    grad.addColorStop(0, "#1e1a30"); grad.addColorStop(1, "#14101f");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, R.W, R.H);

    // ---- grid slots ----
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var x = BX + c * CELL, y = BY + r * CELL;
      var cell = G.board[r][c];
      // slot
      R.px(ctx, x + 2, y + 2, CELL - 4, CELL - 4, "#0f0c1a");
      ctx.strokeStyle = "#2a2440"; ctx.lineWidth = 1;
      ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);

      // placement / target highlight
      var hov = G.hoverCell && G.hoverCell.c === c && G.hoverCell.r === r;
      var cur = G.cursor;
      if (hov && cur) {
        var ok = false, col = "#ffd23f";
        if (cur.mode === "place" && !cell.gid) ok = true;
        if (cur.mode === "move" && !cell.gid) ok = true;
        if (cur.mode === "graphic" && cell.gid) { ok = true; col = "#6ee7ff"; }
        if (ok) {
          ctx.save(); ctx.globalAlpha = 0.18; R.px(ctx, x + 2, y + 2, CELL - 4, CELL - 4, col); ctx.restore();
          ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);
        }
      }
      // show currently-selected move source
      if (cur && cur.mode === "move" && cur.c === c && cur.r === r) {
        ctx.strokeStyle = "#6ee7ff"; ctx.lineWidth = 2; ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5);
      }
    }

    // ---- wires between connected gears (under gears) ----
    ctx.save();
    ctx.strokeStyle = "#4a3f6a"; ctx.lineWidth = 3;
    G.score.wires.forEach(function (w) {
      var a = cellCenter(w[0], w[1]), b = cellCenter(w[2], w[3]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });
    ctx.restore();

    // ---- gears ----
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      var cl = G.board[r2][c2];
      if (!cl.gid) continue;
      var ctr = cellCenter(c2, r2);
      var gd = GEARS[cl.gid];
      var connected = G.score.connected.has(c2 + "," + r2);
      var rad = CELL * 0.34;
      R.gear(ctx, ctr.x, ctr.y, rad, gd.teeth, cl.angle, gd.tint, {
        glow: connected,
        glowColor: cl.gid === "core" ? "#ffd23f" : "#6ee7ff",
        graphicTint: cl.graphic ? GRAPHICS[cl.graphic].tint : null
      });
      if (!connected) {
        ctx.save(); ctx.globalAlpha = 0.45; R.circle(ctx, ctr.x, ctr.y, rad + 2, "#14101f"); ctx.restore();
      }
      if (cl.gid === "core") {
        // little "CORE" tag
        ctx.fillStyle = "#ffd23f"; ctx.font = "7px 'Courier New', monospace";
        ctx.textAlign = "center"; ctx.fillText("CORE", ctr.x, ctr.y + rad + 9);
      }
    }

    // ---- right side panel: hype gauge + reacting dev ----
    renderPanel(t);
  }

  function renderPanel(t) {
    var px0 = BX + COLS * CELL + 12;
    var pw = R.W - px0 - 12;
    // panel bg
    R.px(ctx, px0, BY, pw, ROWS * CELL, "#100d1c");
    ctx.strokeStyle = "#2a2440"; ctx.lineWidth = 1;
    ctx.strokeRect(px0 + 0.5, BY + 0.5, pw - 1, ROWS * CELL - 1);

    // labels
    ctx.fillStyle = "#9a93b8"; ctx.font = "8px 'Courier New', monospace"; ctx.textAlign = "center";
    ctx.fillText("PROJECTED HYPE", px0 + pw / 2, BY + 14);
    ctx.fillStyle = G.score.hype >= G.goal ? "#a0e060" : "#ff8a3d";
    ctx.font = "20px 'Courier New', monospace";
    ctx.fillText(String(G.score.hype), px0 + pw / 2, BY + 36);
    ctx.fillStyle = "#9a93b8"; ctx.font = "8px 'Courier New', monospace";
    ctx.fillText("GOAL " + G.goal, px0 + pw / 2, BY + 50);

    // gauge tube
    var gx = px0 + pw / 2 - 10, gy = BY + 60, gw = 20, gh = ROWS * CELL - 90;
    R.px(ctx, gx - 2, gy - 2, gw + 4, gh + 4, "#000");
    R.px(ctx, gx, gy, gw, gh, "#1c1830");
    var frac = Math.max(0, Math.min(1, G.goal ? G.score.hype / G.goal : 0));
    var fh = gh * frac;
    var col = frac >= 1 ? "#a0e060" : (frac > 0.6 ? "#ffd23f" : (frac > 0.3 ? "#ff8a3d" : "#ff5d8f"));
    R.px(ctx, gx, gy + gh - fh, gw, fh, col);
    // bubbling highlight
    if (frac > 0) {
      ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 6);
      R.px(ctx, gx + 3, gy + gh - fh, 3, fh, "#ffffff");
      ctx.globalAlpha = 1;
    }
    // goal line at top
    ctx.strokeStyle = "#a0e060"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx - 3, gy); ctx.lineTo(gx + gw + 3, gy); ctx.stroke();

    // reacting dev
    var mood = G.score.hype >= G.goal ? "happy" : "";
    R.character(ctx, px0 + pw / 2, BY + ROWS * CELL - 14, t, mood);

    // connected-count pips
    ctx.fillStyle = "#6ee7ff"; ctx.font = "8px 'Courier New', monospace";
    ctx.fillText("gears: " + Math.max(0, G.score.connCount - 1), px0 + pw / 2, BY + ROWS * CELL - 2);
    ctx.textAlign = "left";
  }

  // =========================================================
  //  HUD / TRAY / CHROME
  // =========================================================
  function updateHUD() {
    els.day.textContent = (G.day + 1) + "/" + DAYS.length;
    els.goal.textContent = G.goal;
    els.time.textContent = G.time;
    els.energy.textContent = G.energy;
    els.hype.textContent = G.score.hype;
    els.hype.style.color = G.score.hype >= G.goal ? "#a0e060" : "#ff8a3d";
    els.barTime.style.width = clampPct(G.time / G.maxTime) + "%";
    els.barEnergy.style.width = clampPct(G.energy / G.maxEnergy) + "%";
    els.chipsOut.textContent = G.score.chips;
    els.multOut.textContent = fmtMult(G.score.mult);
  }
  function clampPct(f) { return Math.max(0, Math.min(1, f)) * 100; }

  function renderTray() {
    els.hand.innerHTML = "";
    G.hand.forEach(function (card, idx) {
      var div = document.createElement("div");
      div.className = "card" + (card.kind === "graphic" ? " graphic" : "");
      var affordable = true;
      if (card.kind === "gear") {
        var gd = GEARS[card.gid];
        if (G.time < gd.time || G.energy <= 0) affordable = false;
      } else if (G.energy <= 0) affordable = false;
      if (!affordable) div.className += " unaffordable";
      if (card.jammed) div.className += " jammed";
      if (G.cursor && ((G.cursor.mode === "place" && card.kind === "gear" && G.cursor.idx === idx) ||
        (G.cursor.mode === "graphic" && card.kind === "graphic" && G.cursor.idx === idx))) {
        div.className += " selected";
      }

      var cv = document.createElement("canvas");
      cv.width = 40; cv.height = 40;
      if (card.kind === "gear") R.gearThumb(cv, GEARS[card.gid], 0.5);
      else R.graphicThumb(cv, GRAPHICS[card.grid]);
      div.appendChild(cv);

      var name = document.createElement("div"); name.className = "c-name";
      name.textContent = card.kind === "gear" ? GEARS[card.gid].name : GRAPHICS[card.grid].name;
      div.appendChild(name);

      var stat = document.createElement("div"); stat.className = "c-stat";
      stat.textContent = statLine(card);
      div.appendChild(stat);

      var cost = document.createElement("div"); cost.className = "c-cost";
      cost.textContent = costLine(card);
      div.appendChild(cost);

      (function (i) {
        div.addEventListener("click", function () { onHandCardClick(i); });
        div.addEventListener("pointerenter", function (e) { showCardTooltip(card, e.clientX, e.clientY); });
        div.addEventListener("pointerleave", hideTooltip);
      })(idx);

      els.hand.appendChild(div);
    });
  }

  function statLine(card) {
    if (card.kind === "graphic") {
      var gr = GRAPHICS[card.grid]; var s = [];
      if (gr.chips) s.push("+" + gr.chips + "c");
      if (gr.mult) s.push("+" + gr.mult + "m");
      return s.join(" ");
    }
    var gd = GEARS[card.gid];
    if (gd.type === "xmult") return "×" + gd.xmult + " mult";
    if (gd.type === "chain") return "+2c / gear";
    var s2 = [];
    if (gd.chips) s2.push("+" + gd.chips + "c");
    if (gd.mult) s2.push("+" + gd.mult + "m");
    return s2.join(" ") || "—";
  }

  function costLine(card) {
    var e, tm;
    if (card.kind === "graphic") { e = GRAPHICS[card.grid].energy; tm = GRAPHICS[card.grid].time; }
    else { e = GEARS[card.gid].energy; tm = GEARS[card.gid].time; }
    return "⚡" + e + "  ⏱" + tm;
  }

  function applyChrome() {
    var s = G.state;
    els.hud.classList.toggle("hidden", s === "title");
    els.tray.classList.toggle("hidden", s !== "workshop");
    if (s !== "room" && s !== "workshop") { els.status.classList.add("hidden"); }
  }

  // =========================================================
  //  HINTS / TOASTS / TOOLTIPS
  // =========================================================
  function updateHint() {
    var s = G.state, msg = null;
    if (s === "room") {
      msg = G.fridgeActive
        ? "💰 Payday! Click the MINI-FRIDGE to grab tonight's drink."
        : "🖱️ Click the COMPUTER to start building your game.";
    } else if (s === "workshop") {
      var cur = G.cursor;
      if (!cur) msg = "Click a card, then click the board. Connect gears to the glowing CORE!";
      else if (cur.mode === "place") msg = "Placing " + GEARS[G.hand[cur.idx].gid].name + " — click an EMPTY slot touching the machine.";
      else if (cur.mode === "graphic") msg = "Painting " + GRAPHICS[G.hand[cur.idx].grid].name + " — click a GEAR to apply it.";
      else if (cur.mode === "move") msg = "Moving a gear — click an empty slot (click it again to cancel).";
    }
    if (msg) { els.status.textContent = msg; els.status.classList.remove("hidden"); els.status.style.color = "#9a93b8"; }
    else els.status.classList.add("hidden");
  }

  function toast(msg) {
    clearTimeout(G.toastTimer);
    els.status.textContent = msg;
    els.status.classList.remove("hidden");
    els.status.style.color = "#ff5d8f";
    G.toastTimer = setTimeout(updateHint, 1700);
  }

  function showCardTooltip(card, cx, cy) {
    var html;
    if (card.kind === "gear") {
      var gd = GEARS[card.gid];
      html = '<div class="tt-name">' + gd.name + '</div>' +
        '<div class="tt-tag">' + statLine(card) + '</div>' +
        '<div>' + gd.blurb + '</div>' +
        '<div class="tt-cost">cost: ⚡' + (gd.energy) + ' energy · ⏱' + gd.time + ' time</div>';
    } else {
      var gr = GRAPHICS[card.grid];
      html = '<div class="tt-name">' + gr.name + '</div>' +
        '<div class="tt-tag">' + statLine(card) + ' · same-style bonus +' + D.ART_SYNERGY_MULT + ' mult</div>' +
        '<div>' + gr.blurb + '</div>' +
        '<div class="tt-cost">cost: ⚡' + gr.energy + ' energy · ⏱' + gr.time + ' time</div>';
    }
    showTooltip(html, cx, cy);
  }

  function showGearTooltip(cell, cx, cy) {
    var gd = GEARS[cell.gid];
    var extra = cell.graphic ? '<div class="tt-tag">art: ' + GRAPHICS[cell.graphic].name + '</div>' : "";
    var connected = G.score.connected.has(findCell(cell));
    var html = '<div class="tt-name">' + gd.name + '</div>' +
      '<div class="tt-tag">' + statLineFor(gd) + '</div>' + extra +
      '<div>' + gd.blurb + '</div>' +
      (cell.gid === "core" ? "" : '<div class="tt-cost">click to move (free)</div>');
    showTooltip(html, cx, cy);
  }

  function findCell(cell) {
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) if (G.board[r][c] === cell) return c + "," + r;
    return "-1,-1";
  }
  function statLineFor(gd) {
    if (gd.type === "xmult") return "×" + gd.xmult + " mult";
    if (gd.type === "chain") return "+2 chips per connected gear";
    if (gd.type === "core") return "+" + gd.chips + " chips (the source)";
    var s = [];
    if (gd.chips) s.push("+" + gd.chips + " chips");
    if (gd.mult) s.push("+" + gd.mult + " mult");
    return s.join(", ");
  }

  function showTooltip(html, cx, cy) {
    els.tooltip.innerHTML = html;
    els.tooltip.classList.remove("hidden");
    var srect = els.stage.getBoundingClientRect();
    var x = cx - srect.left + 14, y = cy - srect.top + 14;
    var tw = els.tooltip.offsetWidth, th = els.tooltip.offsetHeight;
    if (x + tw > srect.width) x = cx - srect.left - tw - 14;
    if (y + th > srect.height) y = cy - srect.top - th - 14;
    els.tooltip.style.left = Math.max(4, x) + "px";
    els.tooltip.style.top = Math.max(4, y) + "px";
  }
  function hideTooltip() { els.tooltip.classList.add("hidden"); }

  // =========================================================
  //  OVERLAY
  // =========================================================
  function overlay(html) {
    els.overlay.innerHTML = html;
    els.overlay.classList.add("show");
  }
  function hideOverlay() { els.overlay.classList.remove("show"); els.overlay.innerHTML = ""; }

  // ---- boot ----
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  global.Game = G; // expose for debugging
})(window);
