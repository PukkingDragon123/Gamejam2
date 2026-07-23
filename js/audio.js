/* =========================================================
   GAME JAM SIMULATOR — audio.js
   Tiny WebAudio sound engine. Procedural blips only, no files.
   ========================================================= */
(function (global) {
  "use strict";

  var ctx = null;
  var muted = false;

  function ac() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    // Browsers suspend audio until a user gesture; resume on demand.
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /**
   * Play a single tone.
   * @param {number} freq   frequency in Hz
   * @param {number} dur    duration in seconds
   * @param {string} type   oscillator type
   * @param {number} when   offset (s) from now
   * @param {number} vol    peak gain
   */
  function tone(freq, dur, type, when, vol) {
    if (muted) return;
    var c = ac();
    if (!c) return;
    when = when || 0;
    vol = vol == null ? 0.18 : vol;
    var t0 = c.currentTime + when;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function arp(freqs, step, type, vol) {
    for (var i = 0; i < freqs.length; i++) {
      tone(freqs[i], step * 1.4, type || "square", i * step, vol);
    }
  }

  // Public sound effects -----------------------------------
  var Sfx = {
    ui:      function () { tone(520, 0.05, "square", 0, 0.10); },
    select:  function () { tone(680, 0.06, "square", 0, 0.12); },
    place:   function () { tone(300, 0.05, "square"); tone(440, 0.07, "square", 0.04); },
    apply:   function () { arp([600, 800, 1000], 0.05, "triangle", 0.12); },
    error:   function () { tone(140, 0.18, "sawtooth", 0, 0.16); },
    tick:    function () { tone(760, 0.03, "square", 0, 0.06); },
    run:     function () { arp([392, 494, 587, 784], 0.08, "square", 0.15); },
    cash:    function () { arp([784, 988, 1319], 0.07, "triangle", 0.14); },
    passout: function () { tone(300, 0.5, "sawtooth", 0, 0.18); tone(150, 0.6, "sawtooth", 0.1, 0.16); },
    sip:     function () { tone(200, 0.1, "sine", 0, 0.14); tone(380, 0.14, "sine", 0.08, 0.12); },
    win:     function () { arp([523, 659, 784, 1047, 1319], 0.11, "square", 0.16); },
    lose:    function () { arp([392, 349, 294, 233], 0.14, "sawtooth", 0.16); },
    packOpen:function () { tone(180, 0.12, "sawtooth", 0, 0.14); arp([600, 900, 1200], 0.05, "triangle", 0.13); },
    install: function () { tone(440, 0.06, "square", 0, 0.06); },
    point:   function () { tone(880, 0.05, "triangle", 0, 0.12); tone(1320, 0.05, "triangle", 0.02, 0.08); },
    timerLow:function () { tone(1000, 0.05, "square", 0, 0.14); },
    submit:  function () { arp([392, 523, 659], 0.06, "square", 0.14); }
  };

  var Audio = {
    sfx: Sfx,
    toggleMute: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    unlock: function () { ac(); }
  };

  global.JamAudio = Audio;
})(window);
