/* =========================================================
   GAME JAM SIMULATOR — data.js
   All tunable content + shared geometry.
     GEARS    : game "mechanics" (nodes) you wire to the CORE
     GRAPHICS : art-style stickers you apply to gears
     DRINKS   : energy drinks with brand cans + a debuff
     DAYS     : escalating Hype goals across the jam
     PACKS    : booster-pack draw config
     TUTORIAL : first-run guided steps
   Scoring:  HYPE = chips × mult
   ========================================================= */
(function (global) {
  "use strict";

  // ---- shared canvas + IDE layout (used by render + game) ----
  var LAYOUT = {
    W: 640, H: 360,
    toolbar: { x: 0, y: 0, w: 640, h: 30 },
    nodePanel: { x: 8, y: 34, w: 420, h: 262 },
    inspector: { x: 434, y: 34, w: 198, h: 262 },
    console: { x: 8, y: 300, w: 624, h: 52 },
    // gear board (inside nodePanel)
    cols: 6, rows: 5, cell: 48, bx: 74, by: 56,
    coreCell: { c: 2, r: 2 }
  };

  /* ---------------------------------------------------------
     GEARS
     type: 'core'|'chips'|'mult'|'both'|'chain'|'xmult'
     icon: glyph key drawn on the cog
     rarity: 'common'|'uncommon'|'rare'
  --------------------------------------------------------- */
  var GEARS = {
    core:   { id:"core",   type:"core",  name:"CORE LOOP",  icon:"core",   teeth:8,  chips:4,  mult:0, energy:0, tint:"#ffcf4d", rarity:"core",     blurb:"The heart of your game. Everything wires back to this." },

    jump:   { id:"jump",   type:"chips", name:"JUMP",       icon:"up",     teeth:6,  chips:3,  mult:0, energy:2, tint:"#5ad1ff", rarity:"common",   blurb:"+3 chips. Press button, go up. A classic." },
    shoot:  { id:"shoot",  type:"chips", name:"SHOOT",      icon:"bullet", teeth:6,  chips:4,  mult:0, energy:2, tint:"#ff934d", rarity:"common",   blurb:"+4 chips. Pew pew. Instant appeal." },
    dash:   { id:"dash",   type:"chips", name:"DASH",       icon:"dash",   teeth:7,  chips:6,  mult:0, energy:3, tint:"#8ee65a", rarity:"common",   blurb:"+6 chips. Everybody loves a good dash." },
    collect:{ id:"collect",type:"both",  name:"COLLECT",    icon:"coin",   teeth:6,  chips:2,  mult:1, energy:3, tint:"#ffd94d", rarity:"common",   blurb:"+2 chips & +1 mult. Shiny things to grab." },
    music:  { id:"music",  type:"chips", name:"CHIPTUNE",   icon:"note",   teeth:6,  chips:5,  mult:0, energy:3, tint:"#c58bff", rarity:"common",   blurb:"+5 chips. A banger soundtrack sells itself." },

    physics:{ id:"physics",type:"both",  name:"PHYSICS",    icon:"ball",   teeth:9,  chips:5,  mult:2, energy:5, tint:"#7aa2ff", rarity:"uncommon", blurb:"+5 chips & +2 mult. Ragdolls sell copies." },
    story:  { id:"story",  type:"chips", name:"STORY MODE", icon:"bubble", teeth:8,  chips:9,  mult:0, energy:4, tint:"#ff8ac2", rarity:"uncommon", blurb:"+9 chips. Made a stranger cry (happy tears)." },
    juice:  { id:"juice",  type:"mult",  name:"GAME JUICE", icon:"spark",  teeth:8,  chips:0,  mult:3, energy:4, tint:"#ffe14d", rarity:"uncommon", blurb:"+3 mult. Screenshake, squash, sparkle." },
    skill:  { id:"skill",  type:"chain", name:"SKILL TREE", icon:"branch", teeth:10, chips:0,  mult:0, energy:4, tint:"#5fe0a8", rarity:"uncommon", blurb:"+2 chips for every connected gear." },
    save:   { id:"save",   type:"both",  name:"SAVE SYS",   icon:"disk",   teeth:7,  chips:4,  mult:1, energy:3, tint:"#9aa7c7", rarity:"uncommon", blurb:"+4 chips & +1 mult. Respect the player's time." },

    boss:   { id:"boss",   type:"chips", name:"BOSS FIGHT", icon:"skull",  teeth:12, chips:18, mult:0, energy:6, tint:"#ff5d7a", rarity:"rare",     blurb:"+18 chips. Huge, heavy, thrilling." },
    proc:   { id:"proc",   type:"mult",  name:"PROC-GEN",   icon:"infin",  teeth:8,  chips:0,  mult:6, energy:5, tint:"#b57bff", rarity:"rare",     blurb:"+6 mult. Infinite content, zero sleep." },
    combo:  { id:"combo",  type:"xmult", name:"COMBO SYS",  icon:"cross",  teeth:8,  xmult:1.5, chips:0, mult:0, energy:6, tint:"#ff5df0", rarity:"rare",  blurb:"×1.5 to your whole mult. Stacks!" },
    online: { id:"online", type:"xmult", name:"MULTIPLAYER",icon:"people", teeth:9,  xmult:1.5, chips:2, mult:0, energy:7, tint:"#5df0ff", rarity:"rare", blurb:"+2 chips, ×1.5 mult. Now with friends (and lag)." }
  };

  /* ---------------------------------------------------------
     GRAPHICS (art styles) — applied on top of a gear.
     Matching styles on connected, touching gears = synergy mult.
  --------------------------------------------------------- */
  var GRAPHICS = {
    pixel:   { id:"pixel",   name:"PIXEL ART",  icon:"pixel",   chips:4, mult:0, energy:1, tint:"#5ad1ff", rarity:"common",   blurb:"+4 chips. Nostalgic and cheap." },
    neon:    { id:"neon",    name:"NEON",       icon:"neon",    chips:2, mult:1, energy:1, tint:"#ff5df0", rarity:"common",   blurb:"+2 chips, +1 mult. Glows in the dark." },
    lowpoly: { id:"lowpoly", name:"LOW-POLY",   icon:"lowpoly", chips:3, mult:1, energy:1, tint:"#8ee65a", rarity:"common",   blurb:"+3 chips, +1 mult. Faceted charm." },
    vapor:   { id:"vapor",   name:"VAPORWAVE",  icon:"vapor",   chips:6, mult:0, energy:2, tint:"#c58bff", rarity:"uncommon", blurb:"+6 chips. A e s t h e t i c." },
    clay:    { id:"clay",    name:"CLAYMATION", icon:"clay",    chips:5, mult:1, energy:2, tint:"#ff9a5a", rarity:"uncommon", blurb:"+5 chips, +1 mult. Squishy and warm." },
    crt:     { id:"crt",     name:"CRT GLITCH", icon:"crt",     chips:3, mult:2, energy:2, tint:"#5fe0a8", rarity:"uncommon", blurb:"+3 chips, +2 mult. Retro-futuristic." },
    hand:    { id:"hand",    name:"HAND-DRAWN", icon:"hand",    chips:9, mult:0, energy:2, tint:"#ffd94d", rarity:"rare",     blurb:"+9 chips. Lovingly doodled." },
    anime:   { id:"anime",   name:"ANIME",      icon:"anime",   chips:5, mult:2, energy:3, tint:"#ff8ac2", rarity:"rare",     blurb:"+5 chips, +2 mult. Big sparkly eyes." }
  };

  var ART_SYNERGY_MULT = 3;

  /* ---------------------------------------------------------
     ENERGY DRINKS — one per uploaded drink sprite (5 total).
     'sprite' = column index in assets/drinks.png (green-screen).
     'can' = procedural fallback colours/logo when no sprite file.
     Minimal surfaced info: energy given + a small debuff badge.
     Sprite order in the sheet: 0 cola, 1 monster, 2 beer, 3 OJ, 4 water.
  --------------------------------------------------------- */
  var DRINKS = [
    { id:"cola",    sprite:0, name:"HYPER-COLA",   energy:22, debuff:null,      can:{body:"#8a2f3a", accent:"#ffffff", logo:"cola"}, blurb:"Clean, classic, weak. No side effects." },
    { id:"monster", sprite:1, name:"MONSTER SLURP",energy:34, debuff:"jittery", can:{body:"#2f8f3f", accent:"#8ef05a", logo:"bolt"}, blurb:"Tastes like blue. Definitely blue." },
    { id:"brew",    sprite:2, name:"NIGHT BREW",   energy:30, debuff:"foggy",   can:{body:"#6a3a1a", accent:"#d6a24d", logo:"drop"}, blurb:"Just one to take the edge off." },
    { id:"oj",      sprite:3, name:"SUNRISE OJ",   energy:28, debuff:"crash",   can:{body:"#e08020", accent:"#ffd24d", logo:"drop"}, blurb:"Vitamin C and a sugar high." },
    { id:"water",   sprite:4, name:"HYDRO BOOST",  energy:20, debuff:null,      can:{body:"#3a86c8", accent:"#bfe6ff", logo:"drop"}, blurb:"Responsible. Hydrating. Boring." }
  ];

  // Short debuff descriptions (badges/tooltips).
  var DEBUFFS = {
    jittery:  { name:"Jittery",  text:"-15s on the clock (the shakes).",     icon:"⏱" },
    crash:    { name:"Crash",    text:"First gear costs DOUBLE energy.",     icon:"🩸" },
    foggy:    { name:"Brain Fog",text:"Start with 20% less energy.",         icon:"🌫" },
    wired:    { name:"Over-caffeinated", text:"Every gear costs +1 energy.", icon:"☕" },
    meltdown: { name:"Meltdown", text:"One owned gear is JAMMED today.",     icon:"☢" },
    glitch:   { name:"Glitch",   text:"The clock ticks 20% faster.",         icon:"⚡" }
  };

  /* ---------------------------------------------------------
     DAYS — the jam schedule. Hit the goal before the clock dies.
  --------------------------------------------------------- */
  var DAYS = [
    { goal:18,  seconds:80, title:"Day 1 — Kickoff",         note:"Theme announced: 'CONNECTION'. Wire up some mechanics!" },
    { goal:42,  seconds:80, title:"Day 2 — Finding the Fun", note:"Your prototype is... a prototype. Push for hype." },
    { goal:85,  seconds:75, title:"Day 3 — The Grind",       note:"People are posting screenshots. Panic productively." },
    { goal:160, seconds:75, title:"Day 4 — Feature Creep",   note:"Maybe just ONE more mechanic. And an art pass." },
    { goal:300, seconds:70, title:"Day 5 — Crunch",          note:"Sleep is a mechanic you forgot to implement." },
    { goal:520, seconds:70, title:"Day 6 — Polish Pass",     note:"Juice everything. Screenshake for the soul." },
    { goal:850, seconds:65, title:"Day 7 — SUBMISSION DAY",  note:"Ship the game or ship nothing. No pressure." }
  ];

  /* ---------------------------------------------------------
     PACKS — booster draws. Pick 1 of 3, then it installs.
  --------------------------------------------------------- */
  var RARITY_WEIGHT = { common: 100, uncommon: 42, rare: 15 };

  // Combined draw pool of gear + graphic card refs, weighted by rarity.
  function buildDrawPool() {
    var pool = [];
    Object.keys(GEARS).forEach(function (k) {
      var g = GEARS[k]; if (g.rarity === "core") return;
      var w = RARITY_WEIGHT[g.rarity] || 20;
      for (var i = 0; i < w; i++) pool.push({ kind: "gear", id: k, rarity: g.rarity });
    });
    Object.keys(GRAPHICS).forEach(function (k) {
      var g = GRAPHICS[k];
      var w = Math.round((RARITY_WEIGHT[g.rarity] || 20) * 0.7); // art slightly rarer
      for (var i = 0; i < w; i++) pool.push({ kind: "graphic", id: k, rarity: g.rarity });
    });
    return pool;
  }

  var CONFIG = {
    startEnergy: 26,
    startInventory: {
      gears: { jump: 1, shoot: 1, collect: 1 },
      graphics: { pixel: 1 }
    },
    packsForDay: function (dayIdx) { return Math.min(1 + Math.floor(dayIdx / 2), 2); },
    installMs: 2600,

    // Walkable room. Coords are normalized (0..1) over the room image,
    // so they track the background whatever its native resolution.
    room: {
      floorY: [0.74, 0.88],        // player Y range (feet) on the carpet
      computerZone: { x: 0.02, y: 0.42, w: 0.30, h: 0.34 }, // the desk/PC
      computerStand: { x: 0.135, y: 0.86 }, // where the player stands to work
      spawnX: 0.72,                // where the dev walks in from
      playerScale: 0.30,           // sprite height as fraction of canvas height
      walkSpeed: 0.32              // fraction of width per second
    },

    // assets/player.png sheet layout + named frames (grid cell indices).
    playerSheet: { cols: 4, rows: 2 },
    playerFrames: { walkA: 0, walkB: 1, sit: 2, back: 3, drink: 4, tired: 5, cheer: 6 }
  };

  /* ---------------------------------------------------------
     TUTORIAL — first run only. Each step: text + optional anchor.
     anchor: {sel} DOM selector OR {rect} internal-canvas rect.
     advance: 'next' | event name the game fires.
  --------------------------------------------------------- */
  var TUTORIAL = [
    { id:"welcome", text:"Welcome to your first game jam! You've got 7 days. Let's grab some assets — open your booster pack.", advance:"pack-opened", anchor:{ center:true } },
    { id:"pick",    text:"Pick ONE of the three cards. Rarer cards are stronger!", advance:"pack-picked", anchor:{ center:true } },
    { id:"install", text:"Assets install in real time. Real dev software, baby. Hang tight…", advance:"installed", anchor:{ center:true } },
    { id:"place",   text:"This is your engine. Click a gear in the ASSET BROWSER below, then click an empty slot next to the glowing CORE to wire it in.", advance:"gear-placed", anchor:{ sel:"#tray" } },
    { id:"connect", text:"Only gears CONNECTED to the CORE spin and score. Click a placed gear to pick it up and move it (free).", advance:"next", anchor:{ rect:"board" } },
    { id:"art",     text:"Select an ART STYLE card, then click a gear to apply it for bonus points. Matching styles that touch = big mult!", advance:"next", anchor:{ sel:"#tray" } },
    { id:"clock",   text:"Watch the COUNTDOWN — when it hits zero, you auto-ship. Stressful? Welcome to game dev.", advance:"next", anchor:{ sel:"#hud-clock" } },
    { id:"run",     text:"When you're ready, hit ▶ RUN to compile: your gears spin up and rain points. Reach the goal to survive the day!", advance:"ran", anchor:{ sel:"#btn-run" } }
  ];

  global.JamData = {
    LAYOUT: LAYOUT,
    GEARS: GEARS,
    GRAPHICS: GRAPHICS,
    ART_SYNERGY_MULT: ART_SYNERGY_MULT,
    DRINKS: DRINKS,
    DEBUFFS: DEBUFFS,
    DAYS: DAYS,
    CONFIG: CONFIG,
    RARITY_WEIGHT: RARITY_WEIGHT,
    buildDrawPool: buildDrawPool,
    TUTORIAL: TUTORIAL
  };
})(window);
