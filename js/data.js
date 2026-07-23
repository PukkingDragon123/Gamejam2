/* =========================================================
   GAME JAM SIMULATOR — data.js
   All the tunable content lives here:
     - GEARS      : game "mechanics" you connect to the CORE
     - GRAPHICS   : art-style cards you slap onto gears
     - DRINKS     : end-of-day energy drinks (each has a debuff)
     - DAYS       : escalating Hype goals for the jam
   Scoring model is Balatro-flavoured:  HYPE = chips × mult
   ========================================================= */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------
     GEAR TYPES
     type:
       'core'  the starting gear (fixed on the board)
       'chips' plain chip producer
       'mult'  adds flat mult
       'both'  adds chips AND mult
       'chain' chips scale with how many gears are connected
       'xmult' multiplies the final mult (rare, powerful)
     energy = energy cost to "code" (place) it
     time   = time (hours) spent coding it
     weight = how often it appears in your hand (higher = commoner)
     tint   = base pixel colour of the gear sprite
  --------------------------------------------------------- */
  var GEARS = {
    core: {
      id: "core", type: "core", name: "CORE LOOP", teeth: 8,
      chips: 4, mult: 0, energy: 0, time: 0, weight: 0, tint: "#ffd23f",
      blurb: "The heart of your game. Everything connects back to this."
    },
    jump: {
      id: "jump", type: "chips", name: "JUMP", teeth: 6,
      chips: 3, mult: 0, energy: 2, time: 1, weight: 10, tint: "#6ee7ff",
      blurb: "+3 chips. A classic. Press button, go up."
    },
    shoot: {
      id: "shoot", type: "chips", name: "SHOOT", teeth: 6,
      chips: 4, mult: 0, energy: 2, time: 1, weight: 10, tint: "#ff8a3d",
      blurb: "+4 chips. Pew pew. Instant appeal."
    },
    dash: {
      id: "dash", type: "chips", name: "DASH", teeth: 7,
      chips: 6, mult: 0, energy: 3, time: 1, weight: 8, tint: "#a0e060",
      blurb: "+6 chips. Everybody loves a good dash."
    },
    collect: {
      id: "collect", type: "both", name: "COLLECT", teeth: 6,
      chips: 2, mult: 1, energy: 3, time: 1, weight: 8, tint: "#ffd23f",
      blurb: "+2 chips and +1 mult. Shiny things to grab."
    },
    physics: {
      id: "physics", type: "both", name: "PHYSICS", teeth: 9,
      chips: 5, mult: 2, energy: 5, time: 2, weight: 5, tint: "#7aa2ff",
      blurb: "+5 chips and +2 mult. Ragdolls sell copies."
    },
    boss: {
      id: "boss", type: "chips", name: "BOSS FIGHT", teeth: 12,
      chips: 16, mult: 0, energy: 6, time: 2, weight: 4, tint: "#ff5d8f",
      blurb: "+16 chips. Huge, heavy, thrilling. Costs a lot of coffee."
    },
    proc: {
      id: "proc", type: "mult", name: "PROC-GEN", teeth: 8,
      chips: 0, mult: 5, energy: 5, time: 2, weight: 5, tint: "#c08bff",
      blurb: "+5 mult. Infinite content, zero sleep."
    },
    skill: {
      id: "skill", type: "chain", name: "SKILL TREE", teeth: 10,
      chips: 0, mult: 0, energy: 4, time: 2, weight: 5, tint: "#66e0b0",
      blurb: "+2 chips for every gear connected to the machine."
    },
    combo: {
      id: "combo", type: "xmult", name: "COMBO SYS", teeth: 8, xmult: 1.5,
      chips: 0, mult: 0, energy: 6, time: 2, weight: 3, tint: "#ff4dff",
      blurb: "×1.5 to your total mult. Chain reactions!"
    }
  };

  // Weighted draw pool (excludes the core).
  var GEAR_POOL = [];
  Object.keys(GEARS).forEach(function (k) {
    var g = GEARS[k];
    for (var i = 0; i < g.weight; i++) GEAR_POOL.push(k);
  });

  /* ---------------------------------------------------------
     GRAPHIC CARDS (art styles)
     Applied on top of a gear. Give bonus chips/mult, and when two
     connected gears share the same style they get an "art
     direction" synergy bonus.
  --------------------------------------------------------- */
  var GRAPHICS = {
    pixel:   { id: "pixel",   name: "PIXEL ART",  chips: 4, mult: 0, energy: 1, time: 0, tint: "#6ee7ff", blurb: "+4 chips. Nostalgic and cheap." },
    neon:    { id: "neon",    name: "NEON",       chips: 2, mult: 1, energy: 1, time: 0, tint: "#ff4dff", blurb: "+2 chips, +1 mult. Glows in the dark." },
    vapor:   { id: "vapor",   name: "VAPORWAVE",  chips: 6, mult: 0, energy: 1, time: 0, tint: "#c08bff", blurb: "+6 chips. A e s t h e t i c." },
    hand:    { id: "hand",    name: "HAND-DRAWN", chips: 8, mult: 0, energy: 2, time: 1, tint: "#ffd23f", blurb: "+8 chips. Lovingly doodled." },
    lowpoly: { id: "lowpoly", name: "LOW-POLY",   chips: 3, mult: 1, energy: 1, time: 0, tint: "#a0e060", blurb: "+3 chips, +1 mult. Faceted charm." }
  };

  var GRAPHIC_POOL = Object.keys(GRAPHICS);

  // Bonus mult granted for each connected, adjacent pair of gears
  // that share the same art style. Consistent art direction pays off.
  var ART_SYNERGY_MULT = 3;

  /* ---------------------------------------------------------
     ENERGY DRINKS — chosen at the end of each day.
     'energy'  = how much energy you wake up with next day
     'debuff'  = applied only to the following day
  --------------------------------------------------------- */
  var DRINKS = [
    {
      id: "monster", name: "MONSTER SLURP", emoji: "🥤",
      energy: 32, debuff: "jittery",
      debuffName: "Jittery", debuffText: "-3 TIME tomorrow (the shakes).",
      flavor: "Tastes like blue. Definitely blue."
    },
    {
      id: "codered", name: "CODE RED", emoji: "🧃",
      energy: 28, debuff: "crash",
      debuffName: "Sugar Crash", debuffText: "First gear you code costs DOUBLE energy.",
      flavor: "Legally distinct from a real brand."
    },
    {
      id: "zerozap", name: "ZERO ZAP", emoji: "🥫",
      energy: 24, debuff: "foggy",
      debuffName: "Brain Fog", debuffText: "You draw 1 fewer gear tomorrow.",
      flavor: "Zero sugar. Zero taste. Zero regrets?"
    },
    {
      id: "beanblast", name: "BEAN BLAST", emoji: "☕",
      energy: 26, debuff: "wired",
      debuffName: "Over-caffeinated", debuffText: "Every gear costs +1 energy to code.",
      flavor: "Just coffee. So much coffee."
    },
    {
      id: "nuclear", name: "NUCLEAR NECTAR", emoji: "☢️",
      energy: 36, debuff: "meltdown",
      debuffName: "Meltdown", debuffText: "One random gear in your hand is JAMMED tomorrow.",
      flavor: "Glows faintly. Probably fine."
    }
  ];

  /* ---------------------------------------------------------
     DAYS — the jam schedule. Reach the Hype goal or you're out.
     The last day is the big submission deadline.
  --------------------------------------------------------- */
  var DAYS = [
    { goal: 18,  title: "Day 1 — Kickoff",        note: "The theme is announced: 'CONNECTION'. Wire up some mechanics!" },
    { goal: 42,  title: "Day 2 — Finding the Fun", note: "Your prototype is... a prototype. Push for more hype." },
    { goal: 85,  title: "Day 3 — The Grind",       note: "People online are posting screenshots. Panic productively." },
    { goal: 160, title: "Day 4 — Feature Creep",   note: "Maybe just ONE more mechanic. And another art pass." },
    { goal: 300, title: "Day 5 — Crunch",          note: "Sleep is a mechanic you forgot to implement." },
    { goal: 520, title: "Day 6 — Polish Pass",     note: "Juice everything. Screenshake for the soul." },
    { goal: 850, title: "Day 7 — SUBMISSION DAY",  note: "Ship the game or ship nothing. No pressure." }
  ];

  // Base run settings (before any debuffs).
  var CONFIG = {
    boardCols: 6,
    boardRows: 5,
    coreCell: { c: 1, r: 2 },     // where the CORE gear sits
    startEnergy: 26,              // day 1 energy (you slept, once)
    baseTime: 12,                 // time budget per day
    handGears: 6,                 // gears drawn per day
    handGraphics: 3               // art-style cards drawn per day
  };

  global.JamData = {
    GEARS: GEARS,
    GEAR_POOL: GEAR_POOL,
    GRAPHICS: GRAPHICS,
    GRAPHIC_POOL: GRAPHIC_POOL,
    ART_SYNERGY_MULT: ART_SYNERGY_MULT,
    DRINKS: DRINKS,
    DAYS: DAYS,
    CONFIG: CONFIG
  };
})(window);
