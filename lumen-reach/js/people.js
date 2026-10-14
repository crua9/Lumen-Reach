/* ============================================================
   PEOPLE — modular 3D characters
   Models: KayKit "Adventurers" character pack by Kay Lousberg (CC0),
   RobotExpressive by Tomás Laulhé (CC0). See CREDITS.md.

   A character is assembled from parts of five source models that share
   one skeleton (head / body / arms / legs can come from different models),
   then recoloured by rewriting the swatches of the texture atlas.
   ============================================================ */
const People = (() => {
  const T = THREE;
  const K = 0.9; // model units → metres (about 1.5 m tall, chair-seat height when sitting)
  const MODEL_FILES = ["anims", "char_Rogue", "char_Rogue_Hooded", "char_Mage", "char_Knight", "char_Barbarian", "robot"];
  const MODELS = ["Rogue", "Rogue_Hooded", "Mage", "Knight", "Barbarian"];
  // Which texture swatch (8 columns × 4 rows) plays which role, per source model
  const ROLE = {
    Rogue: { "0,0": "skin", "1,0": "hair", "2,0": "eye", "3,0": "metal", "0,1": "top", "1,1": "top2", "6,0": "belt", "5,0": "top2", "7,1": "bottom", "3,2": "shoe", "5,2": "glove", "4,0": "metal" },
    Mage: { "0,0": "skin", "7,2": "skin", "1,0": "hair", "2,0": "eye", "1,1": "top2", "0,1": "top", "7,1": "topDark", "3,0": "trim", "4,0": "trim", "5,0": "belt", "2,2": "belt2", "0,2": "white", "3,2": "shoe" },
    Knight: { "0,0": "skin", "1,0": "hair", "2,0": "eye", "3,0": "top", "4,0": "topDark", "7,0": "trim", "2,1": "trim", "7,1": "topDark", "6,0": "belt", "0,1": "accent", "1,1": "white" },
    Barbarian: { "0,0": "skin", "1,0": "hair", "2,0": "eye", "0,1": "top", "1,1": "top", "6,0": "belt", "2,1": "trim", "7,0": "belt2", "3,0": "metal", "7,1": "bottom2", "3,2": "bottom", "7,2": "glove" }
  };
  ROLE.Rogue_Hooded = Object.assign({}, ROLE.Rogue);
  // Logical pose → animation clip
  const POSE_CLIP = { stand: "Unarmed_Idle", carry: "Unarmed_Idle", walk: "Walking_A", run: "Running_A", sit: "Sit_Chair_Idle", work: "Sit_Chair_Idle", floor: "Sit_Floor_Idle", lie: "Lie_Idle", use: "Interact", play: "Interact", cheer: "Cheer", float: "Jump_Idle", pick: "PickUp", wince: "Hit_A" };

  const gltf = {}, tmpl = {}, clips = {}, robotClips = {};
  const texCache = new Map(), matCache = new Map();
  const shadeHex = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); };
  const mixHex = (a, b, k) => { const c = new T.Color(a); c.lerp(new T.Color(b), k); return "#" + c.getHexString(); };

  /* ---------- Loading ---------- */
  async function getBuffer(name, onBytes) {
    // Single-file builds embed the models as base64 (window.LR_EMBED); the repo build fetches them.
    if (window.LR_EMBED && window.LR_EMBED[name]) {
      const bin = atob(window.LR_EMBED[name]), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      onBytes(buf.length); return buf.buffer;
    }
    const res = await fetch("assets/models/" + name + ".glb");
    if (!res.ok) throw new Error("Couldn't load assets/models/" + name + ".glb (" + res.status + ")");
    const b = await res.arrayBuffer(); onBytes(b.byteLength); return b;
  }
  async function load(onProgress) {
    const loader = new T.GLTFLoader(); let got = 0; const total = 3.7e6;
    await Promise.all(MODEL_FILES.map(async n => {
      const buf = await getBuffer(n, k => { got += k; onProgress && onProgress(Math.min(1, got / total)); });
      gltf[n] = await loader.parseAsync(buf, "");
    }));
    for (const m of MODELS) {
      const g = gltf["char_" + m], parts = {};
      g.scene.traverse(o => { if (o.isSkinnedMesh) { const k = (o.name.match(/(ArmLeft|ArmRight|Body|Head|LegLeft|LegRight)/) || [])[1]; if (k) parts[k] = o; } });
      tmpl[m] = { scene: g.scene, parts, image: (parts.Body || parts.Head).material.map.image };
    }
    for (const c of gltf.anims.animations) clips[c.name] = c;
    for (const c of gltf.robot.animations) robotClips[c.name] = c;
  }

  /* ---------- Recolouring ---------- */
  function roles(p) {
    const belt = p.belt || "#5a3d2a";
    return { skin: p.skin, hair: p.hair, top: p.top, top2: p.top2 || shadeHex(p.top, 1.22), topDark: shadeHex(p.top, .62), trim: p.trim || shadeHex(p.top, 1.45),
      belt, belt2: shadeHex(belt, 1.25), bottom: p.bottom, bottom2: shadeHex(p.bottom, .78), shoe: p.shoe || "#3b2f28", glove: p.glove || p.skin, metal: p.metal || "#a7aeb2", white: "#ececea", accent: p.accent || shadeHex(p.top, 1.3) };
  }
  function atlasFor(model, pal) {
    const key = model + JSON.stringify(pal);
    if (texCache.has(key)) return texCache.get(key);
    const W = 256, H = 256, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    g.drawImage(tmpl[model].image, 0, 0, W, H);
    const img = g.getImageData(0, 0, W, H), d = img.data, R = roles(pal), map = ROLE[model], cw = W / 8, ch = H / 4;
    for (const cell in map) {
      const target = R[map[cell]]; if (!target || map[cell] === "eye") continue;
      const [cx, cy] = cell.split(",").map(Number), hv = parseInt(target.replace("#", ""), 16);
      const sr = (hv >> 16) & 255, sg = (hv >> 8) & 255, sb = hv & 255;
      let sum = 0, n = 0;
      for (let y = cy * ch; y < (cy + 1) * ch; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) { const i = (y * W + x) * 4; sum += .3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]; n++; }
      const mean = Math.max(1, sum / n);
      for (let y = cy * ch; y < (cy + 1) * ch; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) {
        const i = (y * W + x) * 4, k = .55 + .45 * (.3 * d[i] + .59 * d[i + 1] + .11 * d[i + 2]) / mean;
        d[i] = Math.min(255, sr * k); d[i + 1] = Math.min(255, sg * k); d[i + 2] = Math.min(255, sb * k);
      }
    }
    g.putImageData(img, 0, 0);
    const t = new T.CanvasTexture(c); t.flipY = false; t.colorSpace = T.SRGBColorSpace;
    texCache.set(key, t); return t;
  }
  function matFor(model, pal) {
    const key = model + JSON.stringify(pal);
    if (!matCache.has(key)) matCache.set(key, new T.MeshStandardMaterial({ map: atlasFor(model, pal), roughness: .72, metalness: 0 }));
    return matCache.get(key);
  }

  /* ---------- Assembly ---------- */
  function attachPart(src, base) {
    const m = new T.SkinnedMesh(src.geometry, src.material);
    m.name = src.name; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    const bones = src.skeleton.bones.map(b => base.getObjectByName(b.name));
    m.bind(new T.Skeleton(bones, src.skeleton.boneInverses.map(x => x.clone())), src.bindMatrix.clone());
    const parent = (src.parent && base.getObjectByName(src.parent.name)) || base;
    parent.add(m); m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
    return m;
  }
  // Extra hair volumes on the head bone, low-poly to match the models
  function addExtra(head, style, hairHex) {
    if (!head || !style || style === "none") return null;
    const m = new T.MeshStandardMaterial({ color: hairHex, roughness: .8, flatShading: true });
    const g = new T.Group(); g.name = "hairExtra"; head.add(g);
    const ico = (r, x, y, z, sx = 1, sy = 1, sz = 1, det = 1) => { const me = new T.Mesh(new T.IcosahedronGeometry(r, det), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; g.add(me); return me; };
    switch (style) {
      case "bun": ico(.24, 0, 1.0, -.38); break;
      case "highbun": ico(.26, 0, 1.3, -.12); break;
      case "ponytail": ico(.2, 0, 1.0, -.6); ico(.17, 0, .68, -.7, 1, 1.6, 1); ico(.12, 0, .36, -.7, 1, 1.4, 1); break;
      case "afro": ico(.62, 0, .95, -.12, 1.06, .95, 1.02, 2); break;
      case "curls": for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, e = .35 + (i % 3) * .3; ico(.22, Math.cos(a) * .58 * Math.sin(e + .4), .62 + Math.cos(e) * .32, Math.sin(a) * .55 * Math.sin(e + .4) - .1, 1, 1, 1, 0); } break;
      case "bob": ico(.5, 0, .72, -.14, 1.15, .95, 1.05, 1); break;
    }
    return g;
  }
  /* look = { body, head, arms, legs, extra, height, width, pal: { skin, hair, top, top2, bottom, shoe, belt, accent, trim } } */
  function build(look) {
    const body = look.body || "Rogue";
    const base = T.SkeletonUtils.clone(tmpl[body].scene);
    const want = { Head: look.head || body, ArmLeft: look.arms || body, ArmRight: look.arms || body, Body: body, LegLeft: look.legs || body, LegRight: look.legs || body };
    const parts = {};
    base.traverse(o => { if (o.isSkinnedMesh) { const k = (o.name.match(/(ArmLeft|ArmRight|Body|Head|LegLeft|LegRight)/) || [])[1]; if (k) parts[k] = o; } });
    for (const k in parts) if (want[k] !== body) { parts[k].parent.remove(parts[k]); delete parts[k]; }
    for (const k in want) if (!parts[k] && tmpl[want[k]].parts[k]) parts[k] = attachPart(tmpl[want[k]].parts[k], base);
    const root = new T.Group(); root.add(base);
    const p = { root, base, parts, srcOf: want, mixer: new T.AnimationMixer(base), actions: {}, pose: null, cur: null, held: {} };
    base.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    p.headBone = base.getObjectByName("head"); p.handR = base.getObjectByName("handslot.r"); p.handL = base.getObjectByName("handslot.l");
    applyLook(p, look); setPose(p, "stand", 0);
    return p;
  }
  function applyLook(p, look) {
    p.look = look;
    for (const k in p.parts) p.parts[k].material = matFor(p.srcOf[k], look.pal);
    if (p.extra) { p.extra.parent.remove(p.extra); p.extra = null; }
    p.extra = addExtra(p.headBone, look.extra, look.pal.hair);
    const h = (look.height || 1) * K, w = look.width || 1;
    p.root.scale.set(h * w, h, h * w);
  }
  function setPose(p, pose, fade = .25, speed = 1) {
    const name = POSE_CLIP[pose] || pose;
    if (p.pose === pose && p.cur) { p.cur.timeScale = speed; return; }
    let a = p.actions[name]; if (!a) { const c = clips[name]; if (!c) return; a = p.actions[name] = p.mixer.clipAction(c); }
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = speed; a.setLoop(T.LoopRepeat, Infinity); a.play();
    if (p.cur && p.cur !== a) { if (fade > 0) p.cur.crossFadeTo(a, fade, false); else p.cur.stop(); }
    p.cur = a; p.pose = pose;
  }
  function hold(p, key, obj) {
    if (p.held[key] === obj) return;
    if (p.held[key]) { p.held[key].parent && p.held[key].parent.remove(p.held[key]); delete p.held[key]; }
    if (obj && p.handR) { p.handR.add(obj); p.held[key] = obj; }
  }

  /* ---------- Robots ---------- */
  function robot(color = "#f0c24a", height = 1.05) {
    const base = T.SkeletonUtils.clone(gltf.robot.scene);
    base.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      const one = m => { const c = m.clone(); if (m.name === "Main") c.color.set(color); if (m.name === "Grey") c.color.set("#d9dde0"); c.roughness = .45; c.metalness = .15; return c; };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); });
    const root = new T.Group(); root.add(base);
    base.updateMatrixWorld(true); const b = new T.Box3().setFromObject(base); const s = height / Math.max(.01, b.max.y - b.min.y);
    base.scale.multiplyScalar(s); base.position.y = -b.min.y * s;
    const r = { root, base, mixer: new T.AnimationMixer(base), actions: {}, pose: null, cur: null, robot: true };
    r.setPose = (pose, fade = .25) => {
      const name = { stand: "Idle", walk: "Walking", run: "Running", wave: "Wave", yes: "Yes", no: "No", dance: "Dance", sit: "Sitting", thumbs: "ThumbsUp" }[pose] || "Idle";
      if (r.pose === pose) return; let a = r.actions[name]; if (!a) { const c = robotClips[name]; if (!c) return; a = r.actions[name] = r.mixer.clipAction(c); }
      a.reset(); a.play(); if (r.cur && r.cur !== a) r.cur.crossFadeTo(a, fade, false); r.cur = a; r.pose = pose;
    };
    r.setPose("stand", 0);
    return r;
  }

  /* ---------- Look helpers ---------- */
  const HEADS = { Rogue: "Long hair", Mage: "Shoulder-length hair", Knight: "Short side-swept hair", Barbarian: "Bald with beard", Rogue_Hooded: "Hood up" };
  const OUTFITS = { Rogue: "Tunic & belt", Mage: "Long robe", Knight: "Work jumpsuit", Barbarian: "Shirt & harness" };
  const EXTRAS = { none: "Nothing extra", bun: "Low bun", highbun: "High bun", ponytail: "Ponytail", curls: "Curls", afro: "Afro", bob: "Full bob" };
  // Turn a saved character (any save version) into a look
  function lookFromChar(c) {
    const L = c.look || {};
    return {
      body: L.body || (c.clothing === "dress" || c.clothing === "skirt" ? "Mage" : "Rogue"),
      head: L.head || (c.sex === "f" ? "Rogue" : c.beard ? "Barbarian" : "Knight"),
      arms: L.arms || "Mage", legs: L.legs,
      extra: L.extra || "none",
      height: L.height || 1, width: c.build === "broad" ? 1.08 : c.build === "slight" ? .94 : 1,
      pal: { skin: c.skin || "#c58c66", hair: c.hair || "#4a3020", top: c.outfit || "#4c6b80", bottom: c.lower || "#2a3037", shoe: L.shoe || "#3b2f28", belt: L.belt || "#5a3d2a" }
    };
  }
  /* Where the hips and head end up in a pose, relative to the character's root (facing +z) */
  function measure(pose) {
    const p = build(lookFromChar({})); setPose(p, pose, 0); p.mixer.update(1); p.root.updateMatrixWorld(true);
    const hip = new T.Vector3(), head = new T.Vector3();
    p.base.getObjectByName("hips").getWorldPosition(hip); p.base.getObjectByName("head").getWorldPosition(head);
    p.mixer.stopAllAction(); return { hip, head };
  }
  return { measure, load, build, applyLook, setPose, hold, robot, lookFromChar, HEADS, OUTFITS, EXTRAS, shadeHex, mixHex, K };
})();
