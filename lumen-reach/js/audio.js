/* ============================================================
   SOUND — procedural ambience, footsteps, effects, music, voices
   ============================================================ */
const Sound = (() => {
  let ctx = null, master, sfx, ambBus, musBus, noiseBuf, ch = {}, loops = {}, lastUpd = 0, nextBird = 0, nextPad = 0, nextDrone = 0, nextMeow = 0, voices = [], musicTimer = null;
  const on = () => ctx && S && S.settings && S.settings.sound !== false;
  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = (S && S.settings && S.settings.vol) ?? .8; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = .9; sfx.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = .8; ambBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = .5; musBus.connect(master);
    const len = ctx.sampleRate * 3; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + w * .029; b1 = .985 * b1 + w * .032; b2 = .95 * b2 + w * .048; d[i] = (b0 + b1 + b2 + w * .05) * .9; }
    ch.murmur = noiseCh("bandpass", 520, .7); ch.murmur2 = noiseCh("bandpass", 1150, 1.2);
    ch.rain = noiseCh("highpass", 1400, .3); ch.rumble = noiseCh("lowpass", 120, .5); ch.fountain = noiseCh("bandpass", 2600, .4);
    ch.hvac = noiseCh("lowpass", 420, .7); ch.room = noiseCh("lowpass", 260, .5);
    ch.hum = oscCh(58, "sine"); ch.hum2 = oscCh(117, "sine");
    // slow wobble on the crowd so it breathes like voices
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .23; lg.gain.value = .25; lfo.connect(lg); lg.connect(ch.murmur.mod.gain); lfo.start();
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = .41; lg2.gain.value = .3; lfo2.connect(lg2); lg2.connect(ch.murmur2.mod.gain); lfo2.start();
    loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { }
  }
  function noiseCh(type, f, q) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.loopStart = Math.random();
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const mod = ctx.createGain(); mod.gain.value = 1; const g = ctx.createGain(); g.gain.value = 0;
    src.connect(fl); fl.connect(mod); mod.connect(g); g.connect(ambBus); src.start(ctx.currentTime + Math.random() * .2);
    return { g, fl, mod };
  }
  function oscCh(f, type) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(ambBus); o.start(); return { g, o }; }
  const set = (c, v, tc = .8) => c && c.g.gain.setTargetAtTime(v, ctx.currentTime, tc);

  /* One-shot helpers */
  function tone(f, dur, { type = "sine", vol = .2, at = 0, attack = .005, f2 = null, dest = sfx, q = null } = {}) {
    if (!ctx) return; const t = ctx.currentTime + at;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    let node = o; if (q) { const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = q[0]; fl.Q.value = q[1]; o.connect(fl); node = fl; }
    node.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
  }
  function burst(dur, { type = "bandpass", f = 800, q = 1, vol = .2, at = 0, f2 = null, dest = sfx, attack = .004 } = {}) {
    if (!ctx) return; const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loopStart = Math.random() * 2;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 2); s.stop(t + dur + .05);
  }
  function loopNoise(key, type, f, q, vol, lfoRate = 0) {
    if (!on() || loops[key]) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(vol, ctx.currentTime, .2);
    s.connect(fl); fl.connect(g); g.connect(sfx); s.start();
    if (lfoRate) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = lfoRate; lg.gain.value = vol * .8; l.connect(lg); lg.connect(g.gain); l.start(); loops[key] = { s, g, l }; }
    else loops[key] = { s, g };
  }
  function stopLoop(key) { const L = loops[key]; if (!L) return; L.g.gain.setTargetAtTime(0, ctx.currentTime, .15); setTimeout(() => { try { L.s.stop(); L.l && L.l.stop(); } catch (e) { } }, 700); delete loops[key]; }

  /* Effects */
  const fx = {
    click() { tone(1400, .05, { vol: .06, type: "triangle" }); },
    step(surface) { if (!on()) return; const f = { wood: 380, tile: 900, metal: 1600 }[surface] || 600; burst(.07, { f: f * (0.9 + Math.random() * .2), q: 1.2, vol: surface === "metal" ? .09 : .13 }); if (surface === "metal") tone(2100 + Math.random() * 300, .05, { vol: .015, type: "triangle" }); if (surface === "tile" && S.weather === "rain" && S.loc === "plaza") burst(.08, { type: "highpass", f: 3000, vol: .05, at: .01 }); },
    fab() { [880, 1175, 1568].forEach((f, i) => tone(f, .12, { at: i * .14, vol: .07, type: "sine" })); },
    ding() { tone(1046, .6, { vol: .12 }); tone(1568, .8, { vol: .08, at: .09 }); },
    coins() { for (let i = 0; i < 4; i++) tone(2400 + Math.random() * 900, .09, { at: i * .05, vol: .05, type: "triangle" }); fx.ding(); },
    flush() { burst(1.6, { type: "lowpass", f: 2400, f2: 200, q: .7, vol: .35, attack: .05 }); },
    door() { burst(.25, { type: "lowpass", f: 300, vol: .4 }); tone(90, .2, { vol: .15 }); },
    clink() { tone(2600 + Math.random() * 500, .18, { vol: .05, type: "sine" }); },
    meow() { if (!on()) return; const p = .85 + Math.random() * .3; tone(520 * p, .55, { type: "sawtooth", vol: .07, f2: 760 * p, q: [1100, 3] }); tone(760 * p, .35, { type: "sawtooth", vol: .05, f2: 480 * p, at: .4, q: [900, 3] }); },
    chirp() { const n = 2 + Math.floor(Math.random() * 4), b = 2800 + Math.random() * 1800; for (let i = 0; i < n; i++) tone(b, .07, { f2: b * 1.35, vol: .035, at: i * .11 + Math.random() * .03 }); },
    whir() { tone(190, 2.4, { type: "sawtooth", vol: .012, f2: 160, q: [400, 2], attack: .8 }); },
    alert() { tone(660, .18, { vol: .07 }); tone(523, .25, { vol: .07, at: .18 }); },
    page() { burst(.18, { type: "highpass", f: 2500, vol: .05 }); },
    pluck(f, at = 0, vol = .09) { tone(f, 1.6, { type: "triangle", vol, at, attack: .003 }); tone(f * 2, .6, { type: "sine", vol: vol * .3, at }); burst(.03, { f: f * 4, q: 2, vol: vol * .4, at }); }
  };
  function actStart(a) {
    if (!on() || !a) return;
    switch (a.id) {
      case "fab": fx.fab(); loopNoise("fab", "bandpass", 1800, 8, .03, 6); break;
      case "shower": loopNoise("shower", "highpass", 2400, .5, .16); break;
      case "cook": loopNoise("cook", "highpass", 3800, .6, .05, 9); break;
      case "tea": loopNoise("kettle", "bandpass", 2200, 2, .06); break;
      case "shuttle": loopNoise("shuttle", "lowpass", 140, .8, .5); break;
      case "travel": fx.door(); break;
      case "busk": case "musicnight": startMusic(a.id === "busk" ? 1 : .7); break;
      case "run": loopNoise("run", "lowpass", 500, .5, .05, 2.8); break;
      case "pet": loopNoise("purr", "lowpass", 160, .6, .18, 24); break;
      case "eat": a._clink = setInterval(() => Math.random() < .5 && fx.clink(), 2600); break;
    }
  }
  function actEnd(a, done) {
    if (!a) return;
    for (const k of ["fab", "shower", "cook", "kettle", "shuttle", "run", "purr"]) stopLoop(k);
    if (a._clink) clearInterval(a._clink);
    if (a.id === "busk" || a.id === "musicnight") stopMusic();
    if (!on() || !done) return;
    if (a.id === "fab") fx.ding(); if (a.id === "toilet") fx.flush(); if (a.id === "tea") fx.clink(); if (a.id === "travel") fx.door();
  }

  /* Music: a gentle pad for the background, and a picked guitar for busking/music night */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const CHORDS = [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17], [2, 5, 9, 12]];
  function pad() {
    if (!on() || S.settings.music === false) return;
    const night = sunElev(S.t) < 0, root = S.loc === "station" ? 49 : night ? 45 : 48;
    const ch_ = CHORDS[Math.floor(Math.random() * CHORDS.length)];
    for (const n of ch_.slice(0, 3)) {
      const f = 440 * Math.pow(2, (root + n - 57) / 12), t = ctx.currentTime;
      for (const det of [-3, 3]) {
        const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f; o.detune.value = det;
        const fl = ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 900;
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.018, t + 3); g.gain.linearRampToValueAtTime(.014, t + 6); g.gain.linearRampToValueAtTime(0, t + 11);
        o.connect(fl); fl.connect(g); g.connect(musBus); o.start(t); o.stop(t + 11.2);
      }
    }
    if (Math.random() < .5) { const n = SCALE[Math.floor(Math.random() * SCALE.length)]; tone(440 * Math.pow(2, (root + 12 + n - 57) / 12), 2.5, { type: "sine", vol: .02, at: 2 + Math.random() * 3, attack: .02, dest: musBus }); }
  }
  let musicStep = 0;
  function startMusic(level) {
    stopMusic(); if (!on()) return; musicStep = 0;
    const prog = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], base = 52;
    musicTimer = setInterval(() => {
      const c = prog[Math.floor(musicStep / 8) % prog.length], i = musicStep % 8;
      const pat = [0, 1, 2, 1, 0, 2, 1, 2], n = c[pat[i]] + (i === 0 ? -12 : 0);
      fx.pluck(440 * Math.pow(2, (base + n - 57) / 12), 0, .07 * level);
      if (i === 0) fx.pluck(440 * Math.pow(2, (base + c[0] - 69) / 12), 0, .06 * level);
      musicStep++;
    }, 260);
  }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }

  /* Per-frame ambience */
  function update(nearFountain) {
    if (!ctx) return; const now = performance.now(); if (now - lastUpd < 150) return; lastUpd = now;
    master.gain.setTargetAtTime(S.settings.sound === false ? 0 : (S.settings.vol ?? .8), ctx.currentTime, .2);
    const loc = S.loc, day = sunElev(S.t) > 0, cr = crowd(S.t), muffle = S.flags.earbuds ? .35 : 1, asleep = S.asleep;
    const rain = S.weather === "rain" && loc !== "station";
    const outdoor = loc === "plaza", home = loc === "home", win = S.flags.windowOpen ? .5 : .12;
    const k = asleep ? .3 : 1;
    set(ch.murmur, (outdoor ? .05 + cr * .22 : home ? cr * .05 * win : loc === "station" ? .03 : 0) * muffle * k);
    set(ch.murmur2, (outdoor ? cr * .12 : 0) * muffle * k);
    set(ch.rain, (rain ? (outdoor ? .28 : .1) : 0) * muffle);
    set(ch.fountain, outdoor ? (nearFountain ? .12 : .03) * muffle : 0);
    set(ch.rumble, (loc === "station" ? .22 : 0) * muffle);
    set(ch.hvac, (loc === "station" ? .1 : home ? .025 : 0) * muffle);
    set(ch.room, home ? .05 : 0);
    set(ch.hum, (loc === "station" ? .03 : home ? .012 : 0) * muffle);
    set(ch.hum2, (loc === "station" ? .015 : 0) * muffle);
    if (!asleep && outdoor && day && S.weather !== "rain" && now > nextBird) { fx.chirp(); nextBird = now + 2500 + Math.random() * 7000 / (1 + cr); }
    if (!asleep && home && day && S.flags.windowOpen && now > nextBird) { fx.chirp(); nextBird = now + 6000 + Math.random() * 9000; }
    if (outdoor && now > nextDrone) { fx.whir(); nextDrone = now + 9000 + Math.random() * 14000; }
    if (now > nextPad) { pad(); nextPad = now + 8000 + Math.random() * 3000; }
    if (home && S.cat && !asleep && now > nextMeow) { const hungry = S.cat.fedDay !== dayOf(S.t) && hourOf(S.t) > 8; if (hungry || Math.random() < .15) fx.meow(); nextMeow = now + (hungry ? 9000 : 40000) + Math.random() * 20000; }
  }

  /* Voices */
  const FEM = /(samantha|victoria|karen|zira|susan|fiona|moira|tessa|serena|allison|ava|jenny|aria|libby|sonia|hazel|female|catherine|kate|joanna|salli|kimberly|ivy|emma|olivia|amy|natasha|clara|michelle|nicky|veena|elizabeth|ruth|lisa)/i;
  const MAS = /(daniel|alex\b|david|mark|fred|male|guy|ryan|thomas|arthur|aaron|tom\b|james|george|oliver|brian|matthew|justin|joey|eric|christopher|roger|steffan|william|rishi|lee|gordon)/i;
  function loadVoices() { try { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) { voices = []; } }
  function pickVoice(sex, idx) {
    if (!voices.length) loadVoices(); if (!voices.length) return null;
    const pool = voices.filter(v => sex === "f" ? FEM.test(v.name) : sex === "m" ? MAS.test(v.name) && !FEM.test(v.name) : true);
    const list = pool.length ? pool : voices; return list[idx % list.length];
  }
  function babble(text, sex, robot) {
    if (!ctx) return; const words = text.split(/\s+/).slice(0, 40); let t = 0;
    const base = robot ? 260 : sex === "f" ? 215 : sex === "m" ? 118 : 165;
    const F = [[730, 1090], [530, 1840], [270, 2290], [570, 840], [440, 1020], [300, 870], [660, 1700]];
    for (const w of words) {
      const syl = Math.max(1, Math.round(w.replace(/[^a-z]/gi, "").length / 3));
      for (let i = 0; i < syl; i++) {
        const f = F[Math.floor(Math.random() * F.length)], p = base * (1 + (Math.random() - .5) * .18) * (/[?]$/.test(w) && i === syl - 1 ? 1.25 : 1);
        tone(p, .11, { type: robot ? "square" : "sawtooth", vol: .05, at: t, q: [f[0], 5] });
        tone(p, .11, { type: robot ? "square" : "sawtooth", vol: .03, at: t, q: [f[1], 6] });
        t += .1 + Math.random() * .04;
      }
      t += .07;
    }
  }
  function speak(text, npcId) {
    if (!S.settings.voice || S.settings.sound === false) return;
    const d = NPCS[npcId] || {}, sex = d.look ? d.look.sex : "x", robot = !!d.robot;
    const idx = Object.keys(NPCS).indexOf(npcId);
    let used = false;
    try {
      if (window.speechSynthesis) {
        const v = pickVoice(sex === "x" && !robot ? (idx % 2 ? "f" : "m") : sex, idx);
        if (v) {
          const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang;
          u.pitch = robot ? (npcId === "pip" ? 1.8 : 1.35) : sex === "f" ? 1.05 + (idx % 3) * .05 : .9 + (idx % 3) * .05;
          u.rate = robot ? 1.05 : .98 + (idx % 4) * .03; u.volume = Math.min(1, (S.settings.vol ?? .8) + .1);
          speechSynthesis.cancel(); speechSynthesis.speak(u); used = true;
        }
      }
    } catch (e) { used = false; }
    if (!used) babble(text, sex, robot);
  }
  function hush() { try { speechSynthesis.cancel(); } catch (e) { } }

  return { init, update, actStart, actEnd, speak, hush, startMusic, stopMusic, step: s => fx.step(s), click: () => on() && fx.click(), ding: () => on() && fx.ding(), coins: () => on() && fx.coins(), alert: () => on() && fx.alert(), meow: () => on() && fx.meow(), page: () => on() && fx.page(), get ready() { return !!ctx; } };
})();
