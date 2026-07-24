# 🎮 Game Jam Simulator

A silly 2D pixel-art simulator about surviving a 7-day game jam. Open **booster
packs** for game mechanics, wire **gears** to the glowing **CORE**, slap on
**art styles**, and beat a stressful **countdown** to hit your **HYPE** goal —
then pick a questionable **energy drink** each night and do it all again.

A little bit *Balatro*, a little bit *coffee-fuelled crunch*, styled like a
cursed game-dev IDE.

![Game Jam Simulator](assets/screenshot.png)

## ▶ How to play

**No build step, no libraries.** Open `index.html` in a modern browser, or serve
the folder (recommended, so image keying works):

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

### The loop, each day
1. **Walk to your computer** (click it) and boot into **GearOS** — launch the
   **GearEngine** app to start working.
2. **Rip open a booster pack** → pick **1 of 3** cards → wait for it to
   **install**. Packs are themed (mechanics / art / pets) and your collection
   grows across the jam.
3. In the **IDE**, click a gear in the **Asset Browser**, then an empty slot next
   to the **CORE** to wire it in — energy flows down the wires like a little
   factory. Only gears **connected to the CORE** score. Paint gears with **art
   styles** for bonus points.
4. The **countdown** is ticking. Hit **▶ RUN** to compile: gears spin up, points
   rain, **combos** fire, and it all tallies into **HYPE**. Beat the day's goal
   or you're out.
5. At night, **pick an energy drink** — each refuels you but comes with a debuff.

Reach **SUBMISSION DAY** and you win the jam. 🏆

## 🧮 Scoring — `HYPE = chips × mult`
- **chips** (blue) + **mult** (pink) come from connected gears, their **traits**,
  and art styles. Multipliers apply last (Balatro-style).
- Every gear has a **family** — Movement, Action, Content, System, Feel — and a
  **trait** that reads your machine (e.g. JUMP `+2 chips per Movement gear`,
  PROC-GEN `+2 mult per Content gear`, GAME JUICE `+2 mult per art style`).
- **Adjacency** pays: touching connected gears of the same **art style** give
  `+3 mult`; same **family** gives `+1 mult`.
- **Combos** (Balatro "hands") fire when your machine qualifies and pop a banner:
  `SPEEDRUN` (2+ Movement), `BULLET HELL` (2+ Action), `JUICE BAR` (2+ Feel),
  `CONTENT FARM` (3+ Content), `ART DIRECTION` (3+ same style), `FULL STACK`
  (all five families).
- Coding drains **⚡ energy**; hit zero mid-code and you **pass out**.

## 🖼️ Using your own pixel art (`/assets`)

The game ships with procedural fallback art, but it will **automatically use real
pixel-art files** if you drop them in `assets/`. Missing files just fall back —
so you can add them one at a time.

| File | What it is | Notes |
|------|-----------|-------|
| `assets/room.gif` | Room background (animated) | Any 16:9 image/GIF; rendered as a layer behind the canvas so it keeps animating. Computer on the **left** (see `CONFIG.room` in `js/data.js`). `.png` also works. |
| `assets/player.png` | Player sprite sheet | **4 columns × 2 rows** grid. Frame order: `walkA, walkB, sit, back, drink, tired, cheer`. Dark/solid backgrounds are flood-keyed to transparent per cell. |
| `assets/drinks.png` | 5 drink sprites in a row | **Green-screen** background (auto-keyed). Order: `cola, monster, beer, orange-juice, water`. |
| `assets/pack_gears.png` | Mechanics booster pack | Single sprite; solid background keyed out. |
| `assets/pack_graphics.png` | Art booster pack | Single sprite. |
| `assets/pack_pets.png` | Pets booster pack | Single sprite (a rarer "wildcard" pack). |

Frame layout and the room's interactive zones are all configurable in
`js/data.js` (`CONFIG.room`, `CONFIG.playerSheet`, `CONFIG.playerFrames`) — tweak
those numbers to match your exact sheets.

> **Tip:** green-screen keying and sheet slicing read pixels back from the
> canvas, which some browsers block for `file://` images. If your drink
> green-screen doesn't key out, **serve over http** (the command above, or the
> hosted link) and it works.

## 🎛 Controls
- **Room:** click to walk; click the computer (or press `E`) to work.
- **IDE:** click a card, click the board to place/apply. Click a placed gear to
  pick it up and move it; `Esc` returns it. `Enter` = RUN. 🔊 toggles sound.

## 🛠 Tech / layout
Pure vanilla HTML5 Canvas + JavaScript. Procedural pixel art + Web Audio SFX,
with an asset pipeline that overlays real uploaded art when present.

```
index.html
css/style.css
js/
  audio.js    # WebAudio sound effects
  data.js     # gears, art, drinks, days, packs, room/player config (all tuning)
  assets.js   # loads /assets art: green-screen keying + sheet slicing + fallback
  render.js   # procedural + asset-aware pixel-art renderer
  game.js     # phase state machine, scoring, packs, countdown, run, drinks, tutorial
```

---

Made for fun. Crunch responsibly. 💜
