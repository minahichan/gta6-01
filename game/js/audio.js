// Solara Bay — synthesized sound: WebAudio only, no audio files.
// Every effect is built from oscillators and filtered noise at play time.
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;
  var engineNodes = null;
  var sirenNodes = null;
  var musicTimer = null;
  var musicStep = 0;

  /** Lazily create the AudioContext (must follow a user gesture). */
  function ensureAudio() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) {
      return null; // headless or muted device: play silent
    }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    return ctx;
  }

  /** Toggle mute; returns the new muted state. */
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }

  /** True when sound is muted. */
  function isMuted() {
    return muted;
  }

  /** Short filtered-noise burst (gunshot, crash, thud). */
  function noiseBurst(dur, freq, gainVal, type) {
    if (!ensureAudio()) return;
    var t = ctx.currentTime;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
  }

  /** Single oscillator note with an envelope. */
  function tone(freq, dur, gainVal, type, slideTo) {
    if (!ensureAudio()) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** UI click blip for menu buttons. */
  function playClick() {
    tone(660, 0.06, 0.15, 'triangle');
  }

  /** Gunshot crack. */
  function playGunshot() {
    noiseBurst(0.14, 1800, 0.5, 'bandpass');
    tone(140, 0.1, 0.25, 'square', 60);
  }

  /** Cash pickup chime: two bright notes. */
  function playPickup() {
    tone(880, 0.09, 0.22, 'triangle');
    setTimeout(function () { tone(1318, 0.14, 0.22, 'triangle'); }, 70);
  }

  /** Mission-complete jingle. */
  function playMissionComplete() {
    var notes = [523, 659, 784, 1047];
    notes.forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.22, 0.25, 'triangle'); }, i * 110);
    });
  }

  /** Mission-failed low sting. */
  function playMissionFailed() {
    tone(220, 0.35, 0.25, 'sawtooth', 110);
    setTimeout(function () { tone(165, 0.4, 0.22, 'sawtooth', 82); }, 160);
  }

  /** Car horn beep. */
  function playHorn() {
    tone(370, 0.18, 0.2, 'square');
    tone(466, 0.18, 0.16, 'square');
  }

  /** Punch thump. */
  function playPunch() {
    noiseBurst(0.09, 500, 0.35);
  }

  /** Crash thud, scaled by impact 0..1. */
  function playCrash(impact) {
    noiseBurst(0.25, 300, 0.2 + 0.5 * impact);
  }

  /** Skid squeal while drifting. */
  function playSkid() {
    noiseBurst(0.18, 2400, 0.1, 'highpass');
  }

  /** Police siren loop while wanted; call with true to start, false to stop. */
  function setSiren(on) {
    if (on && !sirenNodes) {
      if (!ensureAudio()) return;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 720;
      var g = ctx.createGain();
      g.gain.value = 0.05;
      var lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 0.9;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(master);
      osc.start();
      lfo.start();
      sirenNodes = { osc: osc, lfo: lfo, gain: g };
    } else if (!on && sirenNodes) {
      try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch (e) { /* already stopped */ }
      sirenNodes = null;
    }
  }

  /** Engine hum loop; speed 0..1 sets pitch and loudness. */
  function setEngine(speed) {
    if (!engineNodes) {
      if (!ensureAudio()) return;
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      var filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      var g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start();
      engineNodes = { osc: osc, filter: filter, gain: g };
    }
    var t = ctx.currentTime;
    engineNodes.osc.frequency.setTargetAtTime(55 + speed * 165, t, 0.08);
    engineNodes.filter.frequency.setTargetAtTime(380 + speed * 900, t, 0.1);
    engineNodes.gain.gain.setTargetAtTime(speed > 0.03 ? 0.05 + speed * 0.06 : 0, t, 0.1);
  }

  /** Stop the engine loop. */
  function stopEngine() {
    if (!engineNodes) return;
    try { engineNodes.osc.stop(); } catch (e) { /* already stopped */ }
    engineNodes = null;
  }

  /** Light menu music: a lazy latin-flavoured bass loop. */
  function startMusic() {
    if (musicTimer || !ensureAudio()) return;
    var bass = [110, 0, 130.8, 0, 98, 0, 146.8, 123.5];
    musicStep = 0;
    musicTimer = setInterval(function () {
      if (muted) return;
      var f = bass[musicStep % bass.length];
      if (f) tone(f, 0.32, 0.07, 'triangle');
      if (musicStep % 4 === 2) tone(660, 0.1, 0.03, 'sine');
      musicStep++;
    }, 240);
  }

  /** Stop the menu music loop. */
  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  SB.audio = {
    ensureAudio: ensureAudio,
    toggleMute: toggleMute,
    isMuted: isMuted,
    playClick: playClick,
    playGunshot: playGunshot,
    playPickup: playPickup,
    playMissionComplete: playMissionComplete,
    playMissionFailed: playMissionFailed,
    playHorn: playHorn,
    playPunch: playPunch,
    playCrash: playCrash,
    playSkid: playSkid,
    setSiren: setSiren,
    setEngine: setEngine,
    stopEngine: stopEngine,
    startMusic: startMusic,
    stopMusic: stopMusic
  };
})();
