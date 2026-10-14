/* ============================================================
   WORLD — three.js scenes: home, plaza, Halcyon ring station
   ============================================================ */
const World = (() => {
  const T = THREE;
  let renderer, scene, camera, sun, hemi, fill;
  const scenes = {};
  let cur = null, player = null, plate = null, holo = null;
  let yaw = .55, pitch = .62, dist = 8.5, camT = new T.Vector3();
  const keys = {}; const moveVec = { x: 0, z: 0 };
  const matCache = {}, geoCache = {};
  const npcObjs = {};
  let drones = [], rain = null, stars = null, spaceTex = null, spaceCtx = null, spaceCanvas = null, spaceDrawnAt = -999;
  let pose = "stand", walkPh = 0, lastTagUpdate = 0, runToggle = false, cat = null, gardenMeshes = [];
  const R_RING = 224;

  function M(color, rough = .8, metal = 0, emissive = null, ei = 1, opts = {}) {
    const k = [color, rough, metal, emissive, ei, JSON.stringify(opts)].join("|");
    if (!matCache[k]) {
      matCache[k] = new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, emissive ? { emissive, emissiveIntensity: ei } : {}, opts));
    }
    return matCache[k];
  }
  function rboxGeo(w, h, d, r) {
    r = Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001);
    const k = [w, h, d, r].map(v => v.toFixed(3)).join(","); if (geoCache[k]) return geoCache[k];
    const s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.moveTo(x, y); s.lineTo(x + W, y); s.lineTo(x + W, y + H); s.lineTo(x, y + H); s.lineTo(x, y);
    const g = new T.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals();
    return geoCache[k] = g;
  }
  function box(parent, w, h, d, x, y, z, mat, r = .03, rotY = 0) {
    const m = new T.Mesh(r > 0 ? rboxGeo(w, h, d, r) : new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = rotY; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function cyl(parent, rt, rb, h, x, y, z, mat, seg = 24) { const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function sph(parent, r, x, y, z, mat, seg = 20) { const m = new T.Mesh(new T.SphereGeometry(r, seg, Math.round(seg * .7)), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
  function canvasTex(w, h, draw, rep = [1, 1]) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const woodTex = () => canvasTex(512, 512, (g, w, h) => {
    const r = mulberry(4); for (let i = 0; i < 8; i++) { const y = i * h / 8; const base = 120 + r() * 26; g.fillStyle = `rgb(${base + 24},${base - 8},${base - 46})`; g.fillRect(0, y, w, h / 8);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,35,20,${.05 + r() * .08})`; g.beginPath(); const yy = y + r() * h / 8; g.moveTo(0, yy); g.bezierCurveTo(w * .3, yy + r() * 6 - 3, w * .6, yy + r() * 6 - 3, w, yy); g.stroke(); }
      g.fillStyle = "rgba(30,18,10,.55)"; g.fillRect(0, y, w, 2); g.fillRect(r() * w, y, 2, h / 8); }
  }, [3, 3]);
  const tileTex = () => canvasTex(512, 512, (g, w, h) => {
    const r = mulberry(9); g.fillStyle = "#8f9290"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 128 + r() * 30; g.fillStyle = `rgb(${v + 8},${v + 6},${v})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
      for (let k = 0; k < 30; k++) { g.fillStyle = `rgba(0,0,0,${r() * .06})`; g.fillRect(x * 64 + r() * 60, y * 64 + r() * 60, 2, 2); } }
  }, [10, 10]);
  const panelTex = () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#c9cdcf"; g.fillRect(0, 0, w, h); const r = mulberry(21);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = 196 + r() * 14; g.fillStyle = `rgb(${v},${v + 3},${v + 5})`; g.fillRect(x * 128 + 3, y * 128 + 3, 122, 122);
      g.fillStyle = "rgba(0,0,0,.18)"; for (const [a, b] of [[10, 10], [112, 10], [10, 112], [112, 112]]) { g.beginPath(); g.arc(x * 128 + a, y * 128 + b, 3, 0, 7); g.fill(); } }
    g.fillStyle = "rgba(240,180,106,.5)"; g.fillRect(0, h / 2 - 3, w, 6);
  }, [40, 3]);

  /* ---------- People & robots ---------- */
  function shade(hex, k) { const c = new T.Color(hex); c.multiplyScalar(k); return "#" + c.getHexString(); }
  function makePip() {
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const shell = M("#e8c56a", .4, .2), dark = M("#2b3238", .5, .4), glow = M("#bfffe0", .3, 0, "#7cd3cc", 2);
    sph(body, .18, 0, 1.5, 0, shell, 22);
    const eye = sph(body, .055, 0, 1.52, .16, glow, 12);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .78; cyl(body, .012, .012, .25, Math.cos(a) * .2, 1.5, Math.sin(a) * .2, dark, 6).rotation.z = Math.PI / 2;
      const rotor = new T.Mesh(new T.CircleGeometry(.09, 16), new T.MeshBasicMaterial({ color: "#9fb0bc", transparent: true, opacity: .35, side: T.DoubleSide })); rotor.rotation.x = -Math.PI / 2; rotor.position.set(Math.cos(a) * .3, 1.6, Math.sin(a) * .3); body.add(rotor); }
    return { root, body, head: eye, robot: true, hover: true };
  }
  // Drive a character's animation from a logical state ("stand", "walk", "sit", ...)
  function animatePerson(p, state, dt, speed = 1) {
    if (p.hover) { p.body.position.y = Math.sin(performance.now() / 400) * .06; return; }
    if (p.robot) { p.setPose(state === "walk" || state === "run" ? "walk" : "stand"); p.mixer.update(dt); return; }
    People.setPose(p, state, .25, speed); p.mixer.update(dt);
  }

  function signpost(g, sc, title, sub, x, z, ry) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 200; const x2 = c.getContext("2d");
    x2.fillStyle = "#1d2b33"; x2.beginPath(); x2.roundRect(4, 4, 504, 192, 22); x2.fill();
    x2.fillStyle = "#f6efe2"; x2.textAlign = "center"; x2.font = '64px "Instrument Serif", Georgia, serif'; x2.fillText(title, 256, 92);
    x2.fillStyle = "#c9d6dc"; x2.font = '26px "Atkinson Hyperlegible", system-ui, sans-serif'; x2.fillText(sub, 256, 150, 480);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
    const grp = new T.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp);
    cyl(grp, .04, .05, 1.5, 0, .75, -.03, M("#30373c", .5, .5), 10);
    const board = new T.Mesh(new T.PlaneGeometry(1.3, .51), new T.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#ffffff", emissiveIntensity: .35, roughness: .6 })); board.position.set(0, 1.55, 0); grp.add(board);
    const back = new T.Mesh(new T.PlaneGeometry(1.34, .55), M("#2b2420", .6)); back.position.set(0, 1.55, -.012); back.rotation.y = Math.PI; grp.add(back);
    sc.colliders.push([x - .15, z - .15, x + .15, z + .15]);
  }
  function makeGuitar() { const g = new T.Group(); const b = sph(g, .28, 0, 0, 0, M("#a8652f", .5), 14); b.scale.set(1, 1.2, .35); box(g, .07, .7, .04, 0, .55, 0, M("#3a2a1e", .6), .01); g.rotation.set(0, 0, 1.1); g.position.set(0, .1, .15); return g; }

  /* ---------- Scene: Home ---------- */
  function buildHome() {
    const g = new T.Group(), sc = { id: "home", name: "Home", group: g, colliders: [], inter: [], walls: [], anchors: {}, bounds: { x1: -4.75, x2: 4.75, z1: -3.75, z2: 3.75 }, lights: [], spawn: { x: 3.9, z: .8 }, floorY: () => 0, camDist: 8.5 };
    const floor = new T.Mesh(new T.PlaneGeometry(10, 8), new T.MeshStandardMaterial({ map: woodTex(), roughness: .72 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
    const rug = new T.Mesh(new T.CircleGeometry(1.5, 48), M("#5a6e74", .95)); rug.rotation.x = -Math.PI / 2; rug.position.set(.4, .005, .6); rug.receiveShadow = true; g.add(rug);
    const wallM = M("#d9d2c6", .92), trimM = M("#b9b0a2", .8);
    const H = 2.7, th = .15;
    function wall(x1, z1, x2, z2, nx, nz, holes = []) {
      const wg = new T.Group(); g.add(wg);
      const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(z2 - z1, x2 - x1);
      wg.position.set(x1, 0, z1); wg.rotation.y = -ang;
      let pos = 0; const segs = [];
      holes.sort((a, b) => a.at - b.at);
      for (const h of holes) { segs.push([pos, h.at - h.w / 2, 0, H]); segs.push([h.at - h.w / 2, h.at + h.w / 2, 0, h.y1]); segs.push([h.at - h.w / 2, h.at + h.w / 2, h.y2, H]); pos = h.at + h.w / 2; }
      segs.push([pos, len, 0, H]);
      for (const [a, b, y1, y2] of segs) if (b - a > .01 && y2 - y1 > .01) { const m = new T.Mesh(new T.BoxGeometry(b - a, y2 - y1, th), wallM); m.position.set((a + b) / 2, (y1 + y2) / 2, 0); m.castShadow = true; m.receiveShadow = true; wg.add(m); }
      const base = new T.Mesh(new T.BoxGeometry(len, .1, th + .03), trimM); base.position.set(len / 2, .05, 0); wg.add(base);
      sc.walls.push({ g: wg, nx, nz });
      return wg;
    }
    // back wall with window, left wall, right wall with door, front wall
    const back = wall(-5, -4, 5, -4, 0, -1, [{ at: 3.0, w: 2.0, y1: .85, y2: 2.25 }]);
    wall(-5, 4, -5, -4, -1, 0); wall(5, -4, 5, 4, 1, 0, [{ at: 4.8, w: 1.0, y1: 0, y2: 2.15 }]); wall(5, 4, -5, 4, 0, 1);
    // window glass + exterior
    const glass = new T.Mesh(new T.PlaneGeometry(2, 1.4), new T.MeshStandardMaterial({ color: "#a9c6d6", roughness: .05, metalness: .1, transparent: true, opacity: .18 }));
    glass.position.set(-2, 1.55, -4.0); g.add(glass);
    const sill = box(g, 2.2, .06, .3, -2, .84, -3.86, trimM, .02);
    const ext = new T.Group(); g.add(ext); sc.ext = [];
    for (let i = 0; i < 9; i++) { const w = rnd(2, 5), hgt = rnd(6, 22), x = -14 + i * 3.6, z = -12 - rnd(0, 6);
      const b = box(ext, w, hgt, 3, x, hgt / 2 - 1, z, M(pick(["#55606a", "#6b6560", "#4f5a63", "#7a7268"]), .9), .1);
      const lit = new T.Mesh(new T.PlaneGeometry(w * .8, hgt * .8), new T.MeshStandardMaterial({ color: "#000", emissive: "#f5c27a", emissiveIntensity: 0, transparent: true, opacity: .0 })); lit.position.set(x, hgt / 2 - 1, z + 1.51); ext.add(lit); sc.ext.push(lit); }
    // bed
    const frame = M("#6b4f3a", .7), linen = M("#e8e3da", .95), duvet = M("#6f8794", .95);
    box(g, 2.1, .32, 1.55, -3.9, .2, -3.0, frame, .06); box(g, 2.0, .2, 1.45, -3.9, .45, -3.0, linen, .08); box(g, 1.3, .14, 1.5, -3.55, .6, -3.0, duvet, .07);
    box(g, .38, .12, .6, -4.7, .62, -3.25, linen, .06); box(g, .38, .12, .6, -4.7, .62, -2.65, linen, .06);
    sc.colliders.push([-5, -3.8, -2.8, -2.2]);
    // nightstand + lamp
    box(g, .45, .5, .4, -4.65, .25, -1.85, frame, .04); cyl(g, .02, .06, .3, -4.65, .65, -1.85, M("#2b2f33", .4, .6));
    const shade = cyl(g, .1, .16, .2, -4.65, .86, -1.85, M("#efe4cf", .9, 0, "#f3c27a", .4));
    const lamp1 = new T.PointLight("#ffc98a", .9, 7, 2); lamp1.position.set(-4.4, 1.2, -1.7); g.add(lamp1); sc.lights.push({ l: lamp1, base: .9, m: shade.material, me: .4 });
    sc.colliders.push([-4.9, -2.1, -4.4, -1.6]);
    sc.anchors.bed = { x: -3.75, z: -3.0, rot: -Math.PI / 2, pose: "lie", y: .56 };
    sc.inter.push({ id: "bed", name: "Bed", x: -3.0, z: -2.1, r: 1.4 });
    sc.anchors.bedside = { x: -3.6, z: -2.4, rot: 0, pose: "sit", y: .55 };
    // window interact
    sc.inter.push({ id: "window", name: "Window", x: -2.0, z: -3.45, r: 1.2 });
    // plant
    const pot = cyl(g, .16, .12, .3, -.6, .15, -3.6, M("#b06a49", .8));
    const leafM = M("#4d7d4e", .7); sc.plantLeaves = [];
    for (let i = 0; i < 7; i++) { const l = sph(g, .16, -.6 + rnd(-.15, .15), .45 + rnd(0, .35), -3.6 + rnd(-.12, .12), leafM, 10); l.scale.set(1, .6, 1); sc.plantLeaves.push(l); }
    sc.colliders.push([-.8, -3.85, -.4, -3.4]);
    sc.inter.push({ id: "plant", name: "Pothos plant", x: -.6, z: -3.2, r: 1.1 });
    // desk + terminal
    box(g, 1.3, .06, .6, .5, .75, -3.6, frame, .02); for (const dx of [-.6, .6]) box(g, .05, .75, .55, .5 + dx, .375, -3.6, frame, .01);
    const screen = box(g, .7, .42, .03, .5, 1.12, -3.78, M("#1b2228", .3, .2, "#7cd3cc", .45), .02);
    box(g, .45, .45, .45, .5, .25, -2.95, M("#3c4a52", .8), .08);
    sc.colliders.push([-.2, -3.95, 1.2, -3.25]);
    sc.anchors.desk = { x: .5, z: -2.95, rot: Math.PI, pose: "sit" };
    sc.inter.push({ id: "desk", name: "Desk terminal", x: .5, z: -2.7, r: 1.2 });
    // kitchen
    const counterM = M("#e9e6e0", .45), cabM = M("#56707a", .7);
    box(g, 3.2, .85, .65, 3.15, .43, -3.6, cabM, .03); box(g, 3.3, .05, .72, 3.15, .88, -3.6, counterM, .02);
    const fab = box(g, .62, .62, .5, 2.0, 1.22, -3.66, M("#2c3439", .35, .5), .06);
    const fabGlow = new T.Mesh(new T.PlaneGeometry(.42, .3), M("#0f1416", .3, 0, "#7cd3cc", 1)); fabGlow.position.set(2.0, 1.22, -3.4); g.add(fabGlow); sc.fabGlow = fabGlow;
    box(g, .7, .02, .5, 3.4, .915, -3.6, M("#1d2125", .2, .6), .01);
    cyl(g, .13, .13, .015, 3.25, .93, -3.65, M("#3b3f44", .4, .5)); cyl(g, .1, .1, .015, 3.6, .93, -3.5, M("#3b3f44", .4, .5));
    box(g, .4, .02, .35, 4.2, .91, -3.6, M("#9aa3a8", .2, .9), .01);
    box(g, .8, 1.95, .7, 4.5, .98, -3.55, M("#cfd5d7", .35, .3), .05);
    sc.colliders.push([1.5, -4, 4.95, -3.2]);
    sc.anchors.kitchen = { x: 3.3, z: -2.85, rot: Math.PI, pose: "stand" };
    sc.inter.push({ id: "kitchen", name: "Kitchen & fabricator", x: 3.0, z: -2.75, r: 1.3 });
    // table + chairs
    const top = cyl(g, .62, .62, .05, .4, .74, .4, M("#8a6648", .55), 40); cyl(g, .06, .1, .72, .4, .36, .4, frame); cyl(g, .3, .3, .03, .4, .015, .4, frame);
    const chairM = M("#3f565f", .8);
    for (const [cx, ry] of [[-.55, Math.PI / 2], [1.35, -Math.PI / 2]]) {
      box(g, .44, .06, .44, cx, .45, .4, chairM, .03); box(g, .06, .5, .44, cx + (cx < .4 ? -.2 : .2), .72, .4, chairM, .03);
      for (const [lx, lz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) box(g, .04, .45, .04, cx + lx, .22, .4 + lz, frame, .01);
    }
    sc.colliders.push([-.3, -.3, 1.1, 1.1], [-.8, .15, -.3, .65], [1.1, .15, 1.6, .65]);
    sc.anchors.table = { x: -.62, z: .4, rot: Math.PI / 2, pose: "sit" };
    sc.inter.push({ id: "table", name: "Dining table", x: -.85, z: .4, r: 1.3 });
    // sofa + holo
    const sofaM = M("#8a5a48", .95);
    box(g, .9, .42, 2.1, -4.3, .24, 2.3, sofaM, .1); box(g, .25, .55, 2.1, -4.66, .65, 2.3, sofaM, .1);
    box(g, .9, .3, .25, -4.3, .55, 1.3, sofaM, .08); box(g, .9, .3, .25, -4.3, .55, 3.3, sofaM, .08);
    box(g, .7, .32, 1.0, -2.9, .16, 2.3, M("#6b4f3a", .6), .05);
    sc.colliders.push([-4.85, 1.15, -3.85, 3.45], [-3.25, 1.8, -2.55, 2.8]);
    holo = new T.Mesh(new T.PlaneGeometry(1.4, .8), new T.MeshBasicMaterial({ color: "#7cd3cc", transparent: true, opacity: .32, side: T.DoubleSide })); holo.position.set(-2.4, 1.3, 2.3); holo.rotation.y = -Math.PI / 2; holo.visible = false; g.add(holo);
    sc.anchors.sofa = { x: -4.2, z: 2.3, rot: Math.PI / 2, pose: "sit" };
    sc.inter.push({ id: "sofa", name: "Sofa", x: -3.6, z: 2.3, r: 1.3 });
    // workbench (left wall, mid)
    box(g, .75, .06, 1.7, -4.55, .78, -.3, M("#a07a52", .7), .02); for (const dz of [-.75, .75]) box(g, .6, .76, .06, -4.55, .38, -.3 + dz, frame, .01);
    cyl(g, .22, .24, .1, -4.55, .87, -.65, M("#6d7378", .4, .6)); sph(g, .1, -4.55, .97, -.65, M("#b07a5a", .9), 14).scale.y = .8;
    box(g, .25, .12, .25, -4.55, .87, .2, M("#c9a57a", .8), .02);
    box(g, .4, .45, .4, -3.8, .23, -.3, M("#3c4a52", .8), .08);
    sc.colliders.push([-4.95, -1.2, -4.15, .6]);
    sc.anchors.bench = { x: -3.75, z: -.3, rot: -Math.PI / 2, pose: "work" };
    sc.inter.push({ id: "bench", name: "Workbench", x: -3.5, z: -.3, r: 1.2 });
    // bathroom (glass partition)
    const glassM = new T.MeshStandardMaterial({ color: "#bcd9e2", transparent: true, opacity: .22, roughness: .05 });
    const part = new T.Mesh(new T.BoxGeometry(1.4, 2.1, .04), glassM); part.position.set(4.3, 1.05, 1.9); g.add(part);
    box(g, 1.5, .06, 1.4, 4.25, .03, 3.3, M("#e6ecee", .3), .02);
    cyl(g, .1, .1, .03, 4.6, 2.2, 3.5, M("#9aa3a8", .2, .9), 16);
    box(g, .4, .4, .55, 3.4, .2, 3.55, M("#f1f3f3", .25), .12); box(g, .4, .3, .15, 3.4, .55, 3.82, M("#f1f3f3", .25), .05);
    box(g, .55, .12, .4, 3.0, .85, 2.05, M("#f1f3f3", .25), .05); cyl(g, .05, .07, .8, 3.0, .4, 2.05, M("#f1f3f3", .25));
    sc.colliders.push([3.6, 1.85, 5, 1.95], [3.2, 3.3, 3.62, 3.95]);
    sc.anchors.shower = { x: 4.35, z: 3.2, rot: 0, pose: "stand" };
    sc.anchors.toilet = { x: 3.4, z: 3.5, rot: Math.PI, pose: "sit", y: .42 };
    sc.anchors.sink = { x: 3.0, z: 1.55, rot: 0, pose: "stand" };
    sc.inter.push({ id: "bath", name: "Bathroom", x: 3.5, z: 2.6, r: 1.4 });
    // ceiling light
    const ceil = cyl(g, .25, .25, .04, 0, 2.66, 0, M("#f5efe2", .5, 0, "#ffe2b0", .8));
    const cl = new T.PointLight("#ffe0b0", .8, 12, 2); cl.position.set(0, 2.4, 0); g.add(cl); sc.lights.push({ l: cl, base: .8, m: ceil.material, me: .8 });
    // door
    const door = box(g, .08, 2.1, .95, 4.96, 1.05, .8, M("#5b4636", .6), .02);
    sc.door = door;
    sc.inter.push({ id: "homedoor", name: "Front door", x: 4.4, z: .8, r: 1.1 });
    sc.anchors.door = { x: 4.4, z: .8, rot: Math.PI / 2 };
    // easel by the window
    const easelM = M("#8a6648", .7);
    for (const [dx, rz] of [[-.25, .12], [.25, -.12]]) { const l = box(g, .04, 1.6, .04, -1.6 + dx, .8, -2.75, easelM, .01); l.rotation.z = rz; }
    box(g, .04, 1.5, .04, -1.6, .75, -2.45, easelM, .01).rotation.x = -.2;
    box(g, .6, .5, .03, -1.6, 1.25, -2.78, M("#efe8da", .9), .01);
    box(g, .65, .04, .1, -1.6, .98, -2.74, easelM, .01);
    sc.colliders.push([-1.95, -3.0, -1.25, -2.4]);
    sc.anchors.easel = { x: -1.6, z: -2.05, rot: Math.PI, pose: "stand" };
    sc.inter.push({ id: "easel", name: "Easel", x: -1.6, z: -1.9, r: 1.1 });
    // yoga mat
    const mat = box(g, .6, .012, 1.7, -2.3, .006, -.6, M("#6b8f86", .95), .005); mat.castShadow = false;
    sc.anchors.mat = { x: -2.3, z: -1.2, rot: 0, pose: "floor" };
    sc.inter.push({ id: "mat", name: "Exercise mat", x: -2.3, z: -.6, r: 1.0 });
    // cat bowl
    sc.catBowl = cyl(g, .09, .07, .04, 4.0, .02, -2.7, M("#c97d4f", .5), 18);
    sc.spawn = { x: 4.2, z: .8 };
    // window light shaft
    sc.sunTarget = new T.Vector3(-1.5, 0, -1.5);
    sc.shadowBox = 8;
    return sc;
  }

  /* ---------- Scene: Plaza ---------- */
  function buildPlaza() {
    const g = new T.Group(), sc = { id: "plaza", name: "Lumen Reach · Plaza", group: g, colliders: [], inter: [], walls: [], anchors: {}, bounds: { x1: -19, x2: 19, z1: -19, z2: 19 }, lights: [], spawn: { x: -15, z: 11.5 }, floorY: () => 0, camDist: 10.5 };
    const ground = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ map: tileTex(), roughness: .9 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);
    const grassM = M("#58714a", .95);
    for (const [x, z, w, d] of [[-6, 9, 9, 5], [8, 6, 6, 5], [-12, 0, 5, 5]]) { const p = box(g, w, .12, d, x, .06, z, grassM, .2); }
    // buildings around
    const bm = ["#c7bfb3", "#a9b4b7", "#b9a796", "#8f9ea4", "#d1c7b8"];
    sc.windows = [];
    function building(x, z, w, d, h, color, label) {
      const b = box(g, w, h, d, x, h / 2, z, M(color, .88), .25);
      const rows = Math.floor(h / 3.2), cols = Math.max(1, Math.floor(w / 2.2));
      const winM = new T.MeshStandardMaterial({ color: "#2a3640", roughness: .15, metalness: .4, emissive: "#f3c27a", emissiveIntensity: 0 });
      sc.windows.push(winM);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (Math.random() < .25) continue;
        for (const side of [1, -1]) { const wn = new T.Mesh(new T.PlaneGeometry(1.1, 1.4), winM); wn.position.set(x - w / 2 + (c + .5) * w / cols, 2 + r * 3.2, z + side * (d / 2 + .02)); if (side < 0) wn.rotation.y = Math.PI; g.add(wn); } }
      sc.colliders.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
      return b;
    }
    building(-16, 18.5, 12, 6, 13, bm[0]); building(-1, 23, 14, 6, 18, bm[1]); building(15, 14.5, 10, 8, 9, bm[3]);
    building(16.5, -5.5, 7, 9, 7, bm[2]); building(-21.5, -4, 6, 18, 11, bm[4]); building(-10, -22.5, 12, 6, 15, bm[1]); building(12, -22.5, 14, 6, 12, bm[0]); building(23, 4, 6, 10, 16, bm[2]);
    // home entrance (Linden Court)
    box(g, 1.6, 2.4, .2, -15, 1.2, 15.45, M("#4e3b2e", .6), .04);
    box(g, 2.6, .12, 1.4, -15, 2.7, 14.9, M("#3a4a52", .5, .3), .04);
    sc.inter.push({ id: "plazahome", name: "Linden Court (home)", x: -15, z: 14.6, r: 1.6 });
    // fountain
    cyl(g, 2.3, 2.45, .5, 0, .25, 2, M("#a9aaa5", .7), 48);
    const water = new T.Mesh(new T.CircleGeometry(2.1, 48), new T.MeshStandardMaterial({ color: "#5d8ea1", roughness: .08, metalness: .3, transparent: true, opacity: .85 })); water.rotation.x = -Math.PI / 2; water.position.set(0, .45, 2); g.add(water); sc.water = water;
    cyl(g, .25, .35, 1.6, 0, .8, 2, M("#a9aaa5", .7)); const crown = sph(g, .35, 0, 1.75, 2, M("#7cd3cc", .2, .3, "#7cd3cc", .5), 20);
    sc.colliders.push([-2.4, -.4, 2.4, 4.4]);
    // trees
    const trunkM = M("#5a4433", .9), leafA = M("#4f7346", .85), leafB = M("#6a8a4c", .85);
    for (const [x, z] of [[-11.5, 6.5], [-1.2, 11.5], [7, 7.5], [9.5, 4.5], [-12, 1.5], [-11, -2], [6, -12], [-4, -11], [16, 2], [-17, 8]]) {
      cyl(g, .12, .18, 2.2, x, 1.1, z, trunkM, 10);
      const L = (Math.random() < .5 ? leafA : leafB).clone(); L.transparent = true; sc.trees = sc.trees || []; sc.trees.push({ x, z, m: L });
      for (let i = 0; i < 4; i++) sph(g, rnd(.7, 1.05), x + rnd(-.5, .5), 2.6 + rnd(0, .9), z + rnd(-.5, .5), L, 14);
      sc.colliders.push([x - .3, z - .3, x + .3, z + .3]);
    }
    // street lamps
    sc.lampMats = [];
    for (const [x, z] of [[-7, 3], [6, -1], [-3, -8], [9, 10], [-12, 12], [4, -15]]) {
      cyl(g, .05, .07, 3.6, x, 1.8, z, M("#30373c", .4, .7), 10);
      const lm = new T.MeshStandardMaterial({ color: "#f8edd6", emissive: "#ffcf8a", emissiveIntensity: 0, roughness: .4 }); sc.lampMats.push(lm);
      const bulb = new T.Mesh(new T.SphereGeometry(.18, 14, 10), lm); bulb.position.set(x, 3.65, z); g.add(bulb);
      sc.colliders.push([x - .12, z - .12, x + .12, z + .12]);
    }
    const pl1 = new T.PointLight("#ffcf8a", 0, 16, 2); pl1.position.set(-7, 3.4, 3); g.add(pl1);
    const pl2 = new T.PointLight("#ffcf8a", 0, 16, 2); pl2.position.set(9, 3.4, 10); g.add(pl2);
    sc.streetLights = [pl1, pl2];
    // market: player's stall + Mara's kiln hut
    const stallM = M("#8a6648", .7), awn = M("#c97d4f", .9);
    box(g, 2.2, .9, .9, -9, .45, -9, stallM, .04);
    for (const dx of [-1, 1]) cyl(g, .04, .04, 2.3, -9 + dx, 1.15, -9.4, M("#30373c", .5, .5), 8);
    box(g, 2.4, .06, 1.3, -9, 2.3, -9.1, awn, .02);
    sc.colliders.push([-10.1, -9.45, -7.9, -8.55]);
    sc.inter.push({ id: "stall", name: "Your market stall", x: -9, z: -8.0, r: 1.3 });
    sc.anchors.stall = { x: -9, z: -9.85, rot: 0, pose: "stand" };
    box(g, 3.2, 2.6, 2.6, -16, 1.3, -12, M("#9c6b52", .9), .2);
    const kilnGlow = new T.Mesh(new T.PlaneGeometry(.7, .5), M("#2a1b12", .4, 0, "#ff8a3d", .9)); kilnGlow.position.set(-14.38, 1, -12); kilnGlow.rotation.y = Math.PI / 2; g.add(kilnGlow);
    sc.colliders.push([-17.6, -13.3, -14.4, -10.7]);
    sc.inter.push({ id: "kiln", name: "Shared kiln", x: -13.8, z: -11.4, r: 1.3 });
    // automat kiosk
    box(g, 1.6, 2.2, .8, -5.5, 1.1, -15, M("#3b4a52", .4, .4), .1);
    const kscr = new T.Mesh(new T.PlaneGeometry(1.1, .8), M("#0f1416", .2, 0, "#f0b36a", .9)); kscr.position.set(-5.5, 1.4, -14.58); g.add(kscr);
    sc.colliders.push([-6.35, -15.45, -4.65, -14.55]);
    sc.inter.push({ id: "automat", name: "Automat (groceries & materials)", x: -5.5, z: -13.9, r: 1.3 });
    // notice board
    box(g, 1.5, 1.1, .1, -3, 1.6, -6, M("#6b4f3a", .7), .03); box(g, 1.3, .9, .02, -3, 1.6, -5.94, M("#e6dccb", .95), .01);
    for (const dx of [-.6, .6]) cyl(g, .04, .04, 1.1, -3 + dx, .55, -6, M("#30373c", .5, .5), 8);
    box(g, .9, .7, .5, -1.7, .35, -6, M("#56707a", .5, .3), .05);
    sc.colliders.push([-3.8, -6.2, -1.4, -5.8]);
    sc.inter.push({ id: "board", name: "Commission board & drop locker", x: -2.6, z: -5.1, r: 1.3 });
    // café: Copper Kettle
    const cafeFront = box(g, .2, 2.6, 6, 12.9, 1.3, -5.5, M("#6e4a36", .7), .04);
    box(g, 1.8, 1.0, .7, 12.1, .5, -4.5, M("#8a6648", .6), .04);
    box(g, 1.2, .1, 2.2, 11.9, 2.75, -5.5, M("#b5623e", .9), .03);
    sc.colliders.push([11.2, -4.85, 13.0, -4.15]);
    sc.inter.push({ id: "cafecounter", name: "Copper Kettle counter", x: 11.9, z: -3.7, r: 1.3 });
    for (const [tx, tz] of [[8.5, -6.5], [8.5, -2.5]]) {
      cyl(g, .45, .45, .04, tx, .74, tz, M("#e9e6e0", .4), 32); cyl(g, .04, .06, .72, tx, .36, tz, M("#30373c", .5, .6));
      box(g, .42, .06, .42, tx - .75, .45, tz, M("#30373c", .6, .3), .03); box(g, .06, .45, .42, tx - .95, .7, tz, M("#30373c", .6, .3), .03);
      box(g, .42, .06, .42, tx + .75, .45, tz, M("#30373c", .6, .3), .03);
      sc.colliders.push([tx - .45, tz - .45, tx + .45, tz + .45]);
    }
    sc.anchors.cafe = { x: 7.78, z: -6.5, rot: Math.PI / 2, pose: "sit" };
    sc.inter.push({ id: "cafetable", name: "Café table", x: 7.3, z: -6.5, r: 1.2 });
    // bench
    box(g, 2.0, .08, .55, -6, .46, 4.6, M("#8a6648", .6), .03); box(g, 2.0, .45, .08, -6, .75, 4.35, M("#8a6648", .6), .03);
    for (const dx of [-.85, .85]) box(g, .08, .46, .5, -6 + dx, .23, 4.6, M("#30373c", .5, .6), .02);
    sc.colliders.push([-7.05, 4.3, -4.95, 4.9]);
    sc.anchors.plazabench = { x: -6, z: 4.6, rot: 0, pose: "sit", y: .5 };
    sc.inter.push({ id: "plazabench", name: "Bench under the trees", x: -6, z: 5.4, r: 1.3 });
    // busking spot
    const mark = new T.Mesh(new T.RingGeometry(.5, .6, 40), M("#f0b36a", .5, 0, "#f0b36a", .3)); mark.rotation.x = -Math.PI / 2; mark.position.set(-2.8, .01, 5.6); g.add(mark);
    sc.inter.push({ id: "busk", name: "Busking spot", x: -2.8, z: 5.6, r: 1.1 });
    sc.anchors.busk = { x: -2.8, z: 5.6, rot: Math.PI, pose: "play" };
    // wellness center door
    box(g, 2.0, 2.4, .2, 12.5, 1.2, 10.45, M("#5d5a7d", .5, .2), .04);
    const wsign = new T.Mesh(new T.PlaneGeometry(1.8, .35), M("#151a20", .4, 0, "#b8a6f0", .9)); wsign.position.set(12.5, 2.75, 10.33); wsign.rotation.y = Math.PI; g.add(wsign);
    sc.inter.push({ id: "wellness", name: "Wellness Center", x: 12.5, z: 9.4, r: 1.4 });
    // transit hub (shuttle line to the launch loop)
    const arcM = M("#c8ccd0", .35, .5);
    const arch = new T.Mesh(new T.TorusGeometry(3, .25, 16, 48, Math.PI), arcM); arch.position.set(0, 0, -17.8); arch.castShadow = true; g.add(arch);
    const tg = new T.Mesh(new T.PlaneGeometry(4.6, 2.6), M("#0f1820", .3, 0, "#7cd3cc", .35)); tg.position.set(0, 1.4, -18.2); g.add(tg);
    sc.colliders.push([-3.4, -19, 3.4, -18]);
    sc.inter.push({ id: "transit", name: "Transit hub · shuttle to Halcyon", x: 0, z: -16.6, r: 1.6 });
    // signposts with names and opening hours
    const signs = [
      ["Copper Kettle Café", "Daily 06:00–21:00", 12.2, -1.4, Math.PI / 2],
      ["Wellness Center", "Counseling Mon–Fri 9–17 · Quiet room 7–22", 10.9, 9.7, Math.PI],
      ["Paws & Circuits", "Cat shelter · daily 10:00–18:00", -8.0, -13.7, 0],
      ["Automat", "Groceries & supplies · 24 hours", -4.1, -13.9, 0],
      ["Okonkwo Kiln", "Drop-off any time · fires nightly", -13.6, -13.9, 0],
      ["Transit · Halcyon", "Shuttles even hours 08–20 · ₵30", 3.4, -16.0, 0],
      ["Restroom", "Open 24 hours", 10.0, -13.6, 0],
      ["Community Garden", "Beds 1–4 · water daily", -10.6, 8.0, 0]
    ];
    for (const [t1, t2, x, z, ry] of signs) signpost(g, sc, t1, t2, x, z, ry);
    // community garden: four raised beds
    for (let i = 0; i < 4; i++) {
      const bx = -8.6 + i * 1.75;
      box(g, 1.45, .28, 1.05, bx, .14, 9.7, M("#6b4f3a", .8), .03);
      const soil = box(g, 1.35, .04, .95, bx, .29, 9.7, M("#3d2b1f", .98), .01); soil.castShadow = false;
      const plants = new T.Group(); plants.position.set(bx, .3, 9.7); g.add(plants); gardenMeshes.push(plants);
      sc.colliders.push([bx - .72, 9.17, bx + .72, 10.23]);
    }
    const gsign = box(g, .9, .5, .05, -10.4, 1, 8.6, M("#e6dccb", .9), .02);
    sc.inter.push({ id: "garden", name: "Community garden (your beds)", x: -6, z: 8.5, r: 2.6 });
    sc.anchors.garden = { x: -6, z: 8.85, rot: 0, pose: "floor" };
    // public restroom
    box(g, 2.2, 2.6, 2.0, 8.5, 1.3, -15.4, M("#9fb0b7", .6), .1); box(g, .9, 2.0, .05, 8.5, 1.0, -14.38, M("#3b4a52", .4, .3), .02);
    sc.colliders.push([7.4, -16.4, 9.6, -14.4]);
    sc.inter.push({ id: "restroom", name: "Public restroom", x: 8.5, z: -13.6, r: 1.3 });
    // cat shelter kiosk
    box(g, 2.4, 2.4, 1.3, -9.8, 1.2, -15.3, M("#d0b47a", .8), .12);
    const ss = new T.Mesh(new T.PlaneGeometry(1.8, .4), M("#151a20", .4, 0, "#f0b36a", .9)); ss.position.set(-9.8, 2.1, -14.63); g.add(ss);
    const kc = makeCatMesh("#d8893d"); kc.g.position.set(-9.4, .9, -14.4); kc.g.rotation.y = .3; g.add(kc.g);
    box(g, 1.2, .9, .4, -9.8, .45, -14.5, M("#8a6648", .7), .03);
    sc.colliders.push([-11, -16, -8.6, -14.3]);
    sc.inter.push({ id: "shelter", name: "Paws & Circuits cat shelter", x: -9.8, z: -13.6, r: 1.4 });
    // fountain edge
    sc.inter.push({ id: "fountain", name: "Fountain", x: 0, z: -.9, r: 1.3 });
    sc.anchors.fountain = { x: 0, z: -.45, rot: Math.PI, pose: "sit", y: .5 };
    // stars (visible at night)
    const sg = new T.BufferGeometry(); const pts = [];
    for (let i = 0; i < 900; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * .45; const r = 140; pts.push(r * Math.cos(th) * Math.sin(ph), r * Math.cos(ph), r * Math.sin(th) * Math.sin(ph)); }
    sg.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    stars = new T.Points(sg, new T.PointsMaterial({ color: "#ffffff", size: .9, sizeAttenuation: true, transparent: true, opacity: 0, fog: false })); g.add(stars);
    // rain
    const rg = new T.BufferGeometry(); const rp = new Float32Array(1800 * 3); for (let i = 0; i < rp.length; i += 3) { rp[i] = rnd(-20, 20); rp[i + 1] = rnd(0, 18); rp[i + 2] = rnd(-20, 20); }
    rg.setAttribute("position", new T.BufferAttribute(rp, 3));
    rain = new T.Points(rg, new T.PointsMaterial({ color: "#b8c9d6", size: .06, transparent: true, opacity: .55 })); rain.visible = false; g.add(rain);
    // drones
    for (let i = 0; i < 4; i++) { const d = new T.Group(); sph(d, .22, 0, 0, 0, M("#d8dcdf", .3, .3), 14).scale.y = .5; const lt = sph(d, .06, 0, -.08, 0, M("#fff", .3, 0, i % 2 ? "#ec8877" : "#7cd3cc", 2), 8); g.add(d); drones.push({ g: d, r: rnd(6, 16), h: rnd(6, 10), sp: rnd(.04, .09) * (Math.random() < .5 ? -1 : 1), off: rnd(0, 6) }); }
    // townsfolk
    sc.shadowBox = 30; sc.sunTarget = new T.Vector3(0, 0, 0);
    return sc;
  }

  /* ---------- Scene: Halcyon ring ---------- */
  function ringY(x) { return R_RING - Math.sqrt(R_RING * R_RING - x * x); }
  function buildStation() {
    const g = new T.Group(), sc = { id: "station", name: "Halcyon · Ring Deck C", group: g, colliders: [], inter: [], walls: [], anchors: {}, bounds: { x1: -14, x2: 14, z1: -4.6, z2: 4.6 }, lights: [], spawn: { x: 11, z: 0 }, floorY: ringY, camDist: 8.5, ring: true };
    const cylG = new T.CylinderGeometry(R_RING, R_RING, 11, 360, 1, true);
    const ft = panelTex(); ft.repeat.set(160, 2);
    const floor = new T.Mesh(cylG, new T.MeshStandardMaterial({ map: ft, side: T.BackSide, roughness: .55, metalness: .2 }));
    floor.rotation.x = Math.PI / 2; floor.position.set(0, R_RING, 0); floor.receiveShadow = true; g.add(floor);
    // side walls (annular)
    const wallM = new T.MeshStandardMaterial({ color: "#aeb6ba", roughness: .6, metalness: .2, side: T.DoubleSide });
    for (const z of [-5.5, 5.5]) { const w = new T.Mesh(new T.RingGeometry(R_RING - 9, R_RING, 360, 1), wallM); w.position.set(0, R_RING, z); w.receiveShadow = true; g.add(w); }
    // strip lights along both walls following the ring
    sc.stripMats = [];
    const stripM = new T.MeshStandardMaterial({ color: "#fff", emissive: "#ffd9a8", emissiveIntensity: 1 }); sc.stripMats.push(stripM);
    for (const z of [-5.45, 5.45]) { const s = new T.Mesh(new T.RingGeometry(R_RING - 3.2, R_RING - 3.0, 360, 1), stripM); s.position.set(0, R_RING, z); g.add(s); }
    // observation window (space view rotates with the ring at 2 rpm)
    spaceCanvas = document.createElement("canvas"); spaceCanvas.width = spaceCanvas.height = 1024; spaceCtx = spaceCanvas.getContext("2d");
    spaceTex = new T.CanvasTexture(spaceCanvas); spaceTex.center.set(.5, .5); spaceTex.colorSpace = T.SRGBColorSpace;
    const win = new T.Mesh(new T.CircleGeometry(2.6, 64), new T.MeshBasicMaterial({ map: spaceTex })); win.position.set(0, 2.9, -5.42); g.add(win);
    const rim = new T.Mesh(new T.TorusGeometry(2.65, .14, 12, 64), M("#7d878c", .35, .7)); rim.position.copy(win.position); g.add(rim);
    sc.inter.push({ id: "obs", name: "Observation window", x: 0, z: -3.9, r: 1.6 });
    // bench at window
    box(g, 2.4, .1, .5, 0, .46, -3.5, M("#5c6a70", .5, .3), .04); box(g, 2.4, .46, .1, 0, .23, -3.5, M("#3f4a50", .5, .3), .02);
    sc.colliders.push([-1.2, -3.8, 1.2, -3.2]);
    sc.anchors.obs = { x: 0, z: -3.5, rot: Math.PI, pose: "sit", y: .51 };
    // hydroponics racks
    const rackM = M("#d5dadc", .4, .5), plantM = M("#5f9a52", .75), redM = M("#b8483a", .6);
    for (const x of [-10, -7.5, -5]) for (const z of [2.6, 4.2]) {
      for (let lv = 0; lv < 3; lv++) { const y0 = ringY(x); box(g, 2, .05, .9, x, y0 + .4 + lv * .65, z, rackM, .02);
        for (let k = 0; k < 6; k++) { const p = sph(g, .13, x - .8 + k * .32, y0 + .52 + lv * .65, z + rnd(-.25, .25), plantM, 8); p.scale.y = .7; if (lv === 1 && Math.random() < .5) sph(g, .045, x - .8 + k * .32, y0 + .48 + lv * .65, z + .2, redM, 6); }
        const gl = new T.Mesh(new T.PlaneGeometry(1.9, .04), M("#000", .5, 0, "#ff6fc8", 1.6)); gl.position.set(x, y0 + .98 + lv * .65, z - .44); g.add(gl); }
      sc.colliders.push([x - 1.05, z - .5, x + 1.05, z + .5]);
    }
    const gp = new T.PointLight("#ff8fd6", .7, 9, 2); gp.position.set(-7.5, 2.2, 3.4); g.add(gp);
    sc.inter.push({ id: "hydro", name: "Hydroponics bay", x: -7.5, z: 1.4, r: 1.6 });
    sc.anchors.hydro = { x: -7.5, z: 1.6, rot: 0, pose: "stand" };
    // galley
    box(g, 2.4, .95, .7, 7, ringY(7) + .47, 4.6, M("#56707a", .6), .04);
    box(g, 2.5, .05, .78, 7, ringY(7) + .97, 4.6, M("#e9e6e0", .4), .02);
    sc.colliders.push([5.75, 4.2, 8.25, 5.0]);
    sc.inter.push({ id: "galley", name: "Galley", x: 7, z: 3.6, r: 1.3 });
    const ty = ringY(6.5);
    cyl(g, .55, .55, .05, 6.5, ty + .74, 1.2, M("#e9e6e0", .4), 32); cyl(g, .05, .07, .72, 6.5, ty + .36, 1.2, M("#30373c", .5, .6));
    box(g, .42, .06, .42, 5.7, ty + .45, 1.2, M("#30373c", .6, .3), .03); box(g, .06, .45, .42, 5.5, ty + .7, 1.2, M("#30373c", .6, .3), .03);
    sc.colliders.push([5.95, .65, 7.05, 1.75]);
    sc.anchors.galley = { x: 5.72, z: 1.2, rot: Math.PI / 2, pose: "sit" };
    sc.inter.push({ id: "galleytable", name: "Galley table", x: 5.2, z: 1.2, r: 1.1 });
    // dock hatch
    const hatch = new T.Mesh(new T.CircleGeometry(1.2, 40), M("#3a4248", .35, .7)); hatch.position.set(12.5, ringY(12.5) + 1.4, -5.4); g.add(hatch);
    const hr = new T.Mesh(new T.TorusGeometry(1.25, .08, 10, 40), M("#f0b36a", .4, 0, "#f0b36a", .5)); hr.position.copy(hatch.position); g.add(hr);
    sc.inter.push({ id: "dock", name: "Docking hatch · shuttle home", x: 12.5, z: -4.2, r: 1.5 });
    // restroom door and the spoke ladder to the hub
    box(g, 1.0, 2.1, .08, 10.2, ringY(10.2) + 1.05, 5.4, M("#56707a", .4, .3), .02);
    sc.inter.push({ id: "srestroom", name: "Restroom", x: 10.2, z: 4.4, r: 1.2 });
    for (let i = 0; i < 9; i++) box(g, .7, .04, .04, -12, ringY(-12) + .3 + i * .32, -5.3, M("#c8ccd0", .3, .7), .01);
    for (const dx of [-.36, .36]) box(g, .05, 3.2, .05, -12 + dx, ringY(-12) + 1.6, -5.3, M("#c8ccd0", .3, .7), .01);
    sc.inter.push({ id: "hub", name: "Spoke ladder to the spin hub", x: -12, z: -4.4, r: 1.3 });
    const hl = new T.HemisphereLight("#ffe6c7", "#4d5559", .35); g.add(hl); sc.hemiLocal = hl;
    sc.shadowBox = 16; sc.sunTarget = new T.Vector3(0, 0, 0);
    return sc;
  }
  function drawSpace(t) {
    const g = spaceCtx, W = 1024; g.fillStyle = "#02040a"; g.fillRect(0, 0, W, W);
    const r = mulberry(77); for (let i = 0; i < 700; i++) { const a = r() * .9 + .1; g.fillStyle = `rgba(255,255,255,${a * a})`; const s = r() < .05 ? 2.2 : 1.2; g.fillRect(r() * W, r() * W, s, s); }
    const lit = stationSunlit(t), ph = orbitPhase(t);
    // Earth below-left of the view, huge
    const cx = W * .32, cy = W * .82, R = W * .62;
    const atm = g.createRadialGradient(cx, cy, R * .98, cx, cy, R * 1.08); atm.addColorStop(0, lit ? "rgba(120,180,255,.7)" : "rgba(60,90,160,.25)"); atm.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = atm; g.beginPath(); g.arc(cx, cy, R * 1.08, 0, 7); g.fill();
    const eg = g.createRadialGradient(cx - R * .3, cy - R * .4, R * .1, cx, cy, R);
    if (lit) { eg.addColorStop(0, "#5b9bd5"); eg.addColorStop(.6, "#22578f"); eg.addColorStop(1, "#0d2a4a"); }
    else { eg.addColorStop(0, "#0a1424"); eg.addColorStop(1, "#04080f"); }
    g.fillStyle = eg; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    const cr = mulberry(Math.floor(t / 23) + 5);
    for (let i = 0; i < 40; i++) { g.fillStyle = lit ? `rgba(255,255,255,${.25 + cr() * .4})` : `rgba(80,90,110,${.1 + cr() * .1})`; g.beginPath(); g.ellipse(cx - R + cr() * 2 * R, cy - R + cr() * R * 1.2, 30 + cr() * 90, 8 + cr() * 18, cr() * 3, 0, 7); g.fill(); }
    if (!lit) for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,${190 + cr() * 40},120,${.4 + cr() * .5})`; g.fillRect(cx - R + cr() * 2 * R, cy - R * .9 + cr() * R, 1.6, 1.6); }
    g.restore();
    if (lit && ph < .04) { const sg = g.createRadialGradient(W * .8, W * .3, 0, W * .8, W * .3, W * .5); sg.addColorStop(0, "rgba(255,240,210,.95)"); sg.addColorStop(.2, "rgba(255,170,90,.4)"); sg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = sg; g.fillRect(0, 0, W, W); }
    spaceTex.needsUpdate = true;
  }

  /* ---------- NPCs ---------- */
  function ensureNPC(id) {
    if (npcObjs[id]) return npcObjs[id];
    const d = NPCS[id];
    const p = id === "juno" ? People.robot("#cfd5d9", 1.0) : id === "pip" ? makePip() : People.build(d.model);
    scenes[d.loc].group.add(p.root);
    const o = { id, p, x: d.roam ? rnd(-14, 14) : d.spot.x, z: d.roam ? rnd(-12, 12) : d.spot.z, tx: d.spot.x, tz: d.spot.z, wait: 0, ph: 0, present: false, rot: 0 };
    if (d.roam) { o.tx = o.x; o.tz = o.z; }
    return npcObjs[id] = o;
  }
  const ROAMERS = () => Object.keys(NPCS).filter(k => NPCS[k].roam);
  function npcPresent(id) {
    const d = NPCS[id]; const h = hourOf(S.t); if (d.loc !== S.loc || h < d.hours[0] || h >= d.hours[1]) return false;
    if (!d.roam) return true;
    if (S.weather === "rain" && Math.random() < 0) return false;
    const list = ROAMERS(), rank = (list.indexOf(id) * 7 + dayOf(S.t) * 3) % list.length;
    return rank < Math.round(crowd(S.t) * list.length * 1.25) + 1 || UI.talkingTo() === id;
  }

  /* ---------- Cat ---------- */
  function makeCatMesh(color) {
    const g = new T.Group(), fur = M(color, .9), dark = M(shade(color, .7), .9);
    const body = sph(g, .12, 0, .17, 0, fur, 16); body.scale.set(.95, .85, 1.9);
    const headG = new T.Group(); headG.position.set(0, .27, .22); g.add(headG);
    sph(headG, .082, 0, 0, 0, fur, 16).scale.set(1.05, .95, .95);
    for (const sx of [-1, 1]) { const e = new T.Mesh(new T.ConeGeometry(.032, .07, 8), dark); e.position.set(sx * .045, .075, -.005); e.rotation.z = -sx * .25; headG.add(e);
      sph(headG, .014, sx * .032, .012, .072, M("#d8e070", .3, 0, "#9aa020", .4), 8); }
    sph(headG, .03, 0, -.022, .065, M(shade(color, 1.1), .9), 8).scale.set(1.3, .8, .8);
    const tail = new T.Group(); tail.position.set(0, .22, -.22); g.add(tail);
    const tm = cyl(tail, .02, .013, .32, 0, .14, -.04, dark, 8); tm.rotation.x = -.35;
    const legs = []; for (const [lx, lz] of [[-.06, .13], [.06, .13], [-.06, -.13], [.06, -.13]]) legs.push(cyl(g, .022, .018, .14, lx, .07, lz, fur, 8));
    return { g, tail, headG, legs, body };
  }
  function ensureCat() {
    if (!S.cat) { if (cat) { cat.g.visible = false; } return null; }
    if (!cat || cat.color !== S.cat.color) { if (cat) scenes.home.group.remove(cat.g); cat = makeCatMesh(S.cat.color); cat.color = S.cat.color; scenes.home.group.add(cat.g); cat.x = 1.5; cat.z = 1.2; cat.tx = 1.5; cat.tz = 1.2; cat.wait = 0; cat.mode = "walk"; cat.ph = 0; cat.rot = 0; }
    cat.g.visible = true; return cat;
  }
  function updateCat(dt, sm) {
    const c = ensureCat(); if (!c) return; if (S.loc !== "home") return;
    const hungry = S.cat.fedDay !== dayOf(S.t) && hourOf(S.t) > 8, sleepy = S.asleep;
    c.wait -= sm;
    if (Act.cur && Act.cur.id === "pet") { c.mode = "sit"; c.tx = c.x; c.tz = c.z; }
    else if (sleepy) { c.tx = -3.2; c.tz = -3.0; c.mode = "sleep"; }
    else if (hungry && Math.hypot(S.pos.x - c.x, S.pos.z - c.z) > 1.1) { c.tx = S.pos.x + .6; c.tz = S.pos.z + .4; c.mode = "walk"; }
    else if (c.wait <= 0) { const r = Math.random(); if (r < .3) { c.tx = -4.2; c.tz = 2.4; c.mode = "perch"; } else if (r < .45) { c.tx = 4.0; c.tz = -2.45; c.mode = "walk"; } else { c.tx = rnd(-3.5, 3.5); c.tz = rnd(-2, 3); c.mode = "walk"; } c.wait = rnd(20, 70); }
    const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz); let y = 0, moving = false;
    if (d > .12) { const sp = Math.min(d, (hungry ? 1.4 : .8) * dt); let nx = c.x + dx / d * sp, nz = c.z + dz / d * sp; if (c.mode !== "perch" && c.mode !== "sleep") [nx, nz] = collide(nx, nz, .15); c.x = nx; c.z = nz; c.rot = Math.atan2(dx, dz); moving = true; c.ph += dt * 10; }
    if (!moving && c.mode === "perch") y = .45; if (!moving && c.mode === "sleep") y = .62;
    c.g.position.set(c.x, y, c.z); c.g.rotation.y = c.rot;
    c.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(c.ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .5 : 0);
    c.tail.rotation.z = Math.sin(performance.now() / (moving ? 200 : 700)) * .35;
    c.body.scale.y = !moving && (c.mode === "sleep" || c.mode === "perch") ? .62 : .85;
    if (scenes.home.catBowl) scenes.home.catBowl.material.color.set(S.cat.fedDay === dayOf(S.t) ? "#c97d4f" : "#8a6a5a");
  }
  function catSpot() { return cat && S.cat && S.loc === "home" ? { x: cat.x, z: cat.z } : null; }
  /* ---------- Garden ---------- */
  const CROP_LOOK = { tomatoes: ["#4f7d3e", "#c8412f"], beans: ["#5d8a44", "#a9c96a"], herbs: ["#6aa05a", "#8fc06e"], sunflowers: ["#5a8a3a", "#f2c53d"] };
  let gardenSig = "";
  function updateGarden() {
    const sig = JSON.stringify(S.garden.map(p => p && [p.crop, Math.round(p.growth * 10), p.dead]));
    if (sig === gardenSig) return; gardenSig = sig;
    S.garden.forEach((p, i) => {
      const grp = gardenMeshes[i]; while (grp.children.length) grp.remove(grp.children[0]);
      if (!p) return;
      const [leaf, fruit] = CROP_LOOK[p.crop] || CROP_LOOK.herbs, gr = p.dead ? .4 : Math.max(.12, p.growth);
      const lm = M(p.dead ? "#7a6a45" : leaf, .8), fm = M(fruit, .5);
      for (let k = 0; k < 6; k++) { const px = -.48 + (k % 3) * .48, pz = k < 3 ? -.22 : .22;
        if (p.crop === "sunflowers") { cyl(grp, .015, .02, .9 * gr, px, .45 * gr, pz, lm, 6); if (gr > .7 && !p.dead) { const hd = cyl(grp, .1, .1, .03, px, .9 * gr, pz + .03, fm, 14); hd.rotation.x = 1.2; } }
        else { const b = sph(grp, .13 * gr + .03, px, .1 * gr + .03, pz, lm, 10); b.scale.y = .8; if (gr >= 1 && !p.dead) for (let q = 0; q < 3; q++) sph(grp, .03, px + rnd(-.08, .08), .12 + rnd(0, .1), pz + rnd(-.08, .08), fm, 8); }
      }
    });
  }

  /* ---------- Init ---------- */
  function init(container) {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.useLegacyLights = true; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    scene = new T.Scene(); scene.fog = new T.Fog("#9fb6c6", 30, 120);
    camera = new T.PerspectiveCamera(48, container.clientWidth / container.clientHeight, .1, 900);
    hemi = new T.HemisphereLight("#cfe0ee", "#5a4a3c", .6); scene.add(hemi);
    sun = new T.DirectionalLight("#fff3e0", 1.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
    fill = new T.AmbientLight("#ffffff", .08); scene.add(fill);
    scenes.home = buildHome(); scenes.plaza = buildPlaza(); scenes.station = buildStation();
    for (const k in scenes) { scene.add(scenes[k].group); scenes[k].group.visible = false; }
    player = People.build(People.lookFromChar({})); scene.add(player.root);
    plate = new T.Group(); cyl(plate, .14, .12, .02, 0, 0, 0, M("#f1efe9", .3), 24); sph(plate, .08, 0, .04, 0, M("#c9844a", .8), 10).scale.y = .5;
    scene.add(plate); plate.visible = false;
    for (const id in NPCS) ensureNPC(id);
    window.addEventListener("resize", () => { renderer.setSize(container.clientWidth, container.clientHeight); camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); });
    container.addEventListener("wheel", e => { dist = clamp(dist + Math.sign(e.deltaY) * .8, 4, 16); e.preventDefault(); }, { passive: false });
    let drag = null;
    container.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener("pointerup", () => drag = null);
    window.addEventListener("pointermove", e => { if (!drag || e.pointerType === "touch") return; yaw -= (e.clientX - drag.x) * .006; pitch = clamp(pitch + (e.clientY - drag.y) * .004, .25, 1.2); drag = { x: e.clientX, y: e.clientY }; });
  }
  function restyle() {
    const c = S.char;
    scene.remove(player.root);
    player = People.build(People.lookFromChar(c)); scene.add(player.root);
  }
  function setLoc(loc, spawnAt) {
    for (const k in scenes) scenes[k].group.visible = k === loc;
    cur = scenes[loc]; S.loc = loc;
    if (spawnAt) { S.pos = { x: spawnAt.x, z: spawnAt.z }; }
    dist = cur.camDist; const sb = cur.shadowBox;
    const sc = sun.shadow.camera; sc.left = -sb; sc.right = sb; sc.top = sb; sc.bottom = -sb; sc.near = .5; sc.far = 160; sc.updateProjectionMatrix();
    for (const id in npcObjs) { const o = npcObjs[id]; const d = NPCS[id]; if (d.loc !== loc) continue; if (d.roam) { o.x = rnd(-15, 15); o.z = rnd(-13, 13); } else { o.x = d.spot.x; o.z = d.spot.z; } [o.x, o.z] = collide(o.x, o.z, .4); o.tx = o.x; o.tz = o.z; o.wait = rnd(0, 10); }
    spaceDrawnAt = -999;
  }

  /* ---------- Movement & collision ---------- */
  function collide(x, z, r = .26) {
    const b = cur.bounds; x = clamp(x, b.x1 + r, b.x2 - r); z = clamp(z, b.z1 + r, b.z2 - r);
    for (const c of cur.colliders) {
      const [x1, z1, x2, z2] = c;
      const cx = clamp(x, x1, x2), cz = clamp(z, z1, z2); const dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) { if (d2 > 1e-6) { const d = Math.sqrt(d2); x = cx + dx / d * r; z = cz + dz / d * r; } else { const l = x - x1, rr = x2 - x, t = z - z1, bt = z2 - z; const m = Math.min(l, rr, t, bt); if (m === l) x = x1 - r; else if (m === rr) x = x2 + r; else if (m === t) z = z1 - r; else z = z2 + r; } }
    }
    return [x, z];
  }
  /* Anchors describe the furniture, not the body:
     sit/work → seat centre (y = seat height, rot = facing);  lie → mattress centre (y = top, rot = direction the head points);
     floor/stand → where the feet go. The character's root is offset so hips land on the seat or mattress. */
  let OFF = null;
  function placePlayer(a) {
    if (!a) return;
    if (!OFF) OFF = { sit: People.measure("sit"), lie: People.measure("lie") };
    const pz = a.pose === "work" ? "sit" : a.pose;
    if (pz === "sit") {
      const r = a.rot || 0, h = OFF.sit.hip, seatY = a.y ?? .45;
      S.rot = r; S.pos = { x: a.x - Math.sin(r) * h.z, z: a.z - Math.cos(r) * h.z };
      player.anchorY = seatY + .03 - h.y;
    } else if (pz === "lie") {
      const r = (a.rot || 0) + Math.PI, h = OFF.lie.hip;
      S.rot = r; S.pos = { x: a.x - (Math.sin(r) * h.z + Math.cos(r) * h.x), z: a.z - (Math.cos(r) * h.z - Math.sin(r) * h.x) };
      player.anchorY = (a.y ?? .55) - .02;
    } else { S.pos = { x: a.x, z: a.z }; S.rot = a.rot || 0; player.anchorY = a.y || 0; }
  }
  function anchorFor(name) { return cur && cur.anchors[name] ? cur.anchors[name] : null; }
  function setPose(p) { pose = p === "work" ? "sit" : p; if (p === "stand") player.anchorY = 0; }

  function nearest() {
    if (!cur) return null;
    let best = null, bd = 1e9;
    const fx = Math.sin(S.rot), fz = Math.cos(S.rot);
    for (const it of cur.inter) { const dx = it.x - S.pos.x, dz = it.z - S.pos.z, d = Math.hypot(dx, dz); if (d > (it.r || 1.3)) continue; const facing = d < .5 ? 1 : (dx * fx + dz * fz) / d; const score = d - facing * .4; if (score < bd) { bd = score; best = { kind: "obj", ...it }; } }
    for (const id in npcObjs) { const o = npcObjs[id]; if (!o.present) continue; const d = Math.hypot(o.x - S.pos.x, o.z - S.pos.z); if (d < 1.9 && d - .6 < bd) { bd = d - .6; best = { kind: "npc", id, name: NPCS[id].name }; } }
    const cs = catSpot(); if (cs) { const d = Math.hypot(cs.x - S.pos.x, cs.z - S.pos.z); if (d < 1.2 && d - .3 < bd) { bd = d - .3; best = { kind: "obj", id: "cat", name: S.cat.name }; } }
    return best;
  }

  /* ---------- Per-frame ---------- */
  let ringSpin = 0;
  function update(dt, simMinutes) {
    if (!cur) return;
    const t = S.t, loc = S.loc;
    // player movement
    let moving = false;
    if (!Act.cur && !UI.blocking()) {
      let ix = 0, iz = 0;
      if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
      ix += moveVec.x; iz += moveVec.z;
      const mag = Math.min(1, Math.hypot(ix, iz));
      if (mag > .15) {
        const l = Math.hypot(ix, iz); ix /= l; iz /= l;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix;
        const running = (keys.ShiftLeft || keys.ShiftRight || runToggle) && S.needs.energy > 8;
        let speed = (running ? 3.6 : 1.55) * (moveVec.x || moveVec.z ? Math.max(.45, mag) : 1); if (S.char.cond.pain && S.pain > 50) speed *= .78; if (S.needs.energy < 15) speed *= .8;
        if (running) { S.needs.energy -= dt * .02; if (S.char.cond.pain) S.pain = Math.min(100, S.pain + dt * .05); }
        const [nx, nz] = collide(S.pos.x + mx * speed * dt, S.pos.z + mz * speed * dt);
        S.pos.x = nx; S.pos.z = nz;
        const tr = Math.atan2(mx, mz); let dr = tr - S.rot; while (dr > Math.PI) dr -= Math.PI * 2; while (dr < -Math.PI) dr += Math.PI * 2; S.rot += dr * Math.min(1, dt * 12);
        moving = true; const prevPh = walkPh; walkPh += dt * (running ? 13 : 8.5);
        if (Math.floor(prevPh / Math.PI) !== Math.floor(walkPh / Math.PI)) Sound.step(loc === "home" ? "wood" : loc === "station" ? "metal" : "tile");
      }
    }
    S.posture = Act.cur ? S.posture : moving ? "walk" : "stand";
    if (keys.KeyZ) yaw += dt * 1.6; if (keys.KeyC) yaw -= dt * 1.6;
    // player transform
    const fy = cur.floorY(S.pos.x);
    player.root.position.set(S.pos.x, fy + (player.anchorY || 0), S.pos.z);
    player.root.rotation.set(0, S.rot, 0);
    player.root.visible = !(Act.cur && Act.cur.hide);
    if (cur.ring) player.root.rotation.z = Math.asin(S.pos.x / R_RING);
    // the spin-hub climb: up the spoke ladder, then floating
    if (Act.cur && Act.cur.id === "hub") { const e = Act.cur.elapsed; const up = Math.min(1, e / 8); player.root.position.y = fy + up * 3.4 + (e > 8 ? Math.sin(performance.now() / 900) * .25 : 0); if (e > 8) player.root.rotation.y = S.rot + performance.now() / 4000; }
    const running = !Act.cur && moving && (keys.ShiftLeft || keys.ShiftRight || runToggle) && S.needs.energy > 8;
    let apose = Act.cur ? (Act.cur.id === "hub" ? (Act.cur.elapsed > 8 ? "float" : "use") : pose === "stand" && S.hand ? "carry" : pose) : running ? "run" : moving ? "walk" : S.hand ? "carry" : "stand";
    const limp = S.char.cond.pain && S.pain > 50 && apose === "walk" ? .75 : 1;
    animatePerson(player, apose, dt, limp);
    // the plate: in hand while carrying, on the table while eating seated
    const eatingSeated = Act.cur && Act.cur.id === "eat" && pose === "sit";
    plate.visible = !!(S.hand && S.hand.kind === "meal") || !!eatingSeated;
    if (eatingSeated) { plate.position.set(S.pos.x + Math.sin(S.rot) * .5, fy + .78, S.pos.z + Math.cos(S.rot) * .5); }
    else if (plate.visible) { plate.position.set(S.pos.x + Math.sin(S.rot) * .38, fy + .95, S.pos.z + Math.cos(S.rot) * .38); }
    holo.visible = !!(Act.cur && Act.cur.holo);
    // camera
    camT.lerp(new T.Vector3(S.pos.x, fy + 1.05, S.pos.z), Math.min(1, dt * 6));
    const cd = dist, ox = Math.sin(yaw) * Math.cos(pitch) * cd, oy = Math.sin(pitch) * cd, oz = Math.cos(yaw) * Math.cos(pitch) * cd;
    camera.position.set(camT.x + ox, camT.y + oy, camT.z + oz); camera.lookAt(camT);
    if (cur.ring) { const a = Math.asin(clamp(camT.x / R_RING, -1, 1)); camera.up.set(-Math.sin(a), Math.cos(a), 0); } else camera.up.set(0, 1, 0);
    // cutaway walls
    for (const w of cur.walls) { const d = Math.sin(yaw) * w.nx + Math.cos(yaw) * w.nz; const target = d > .25 ? .1 : 1; w.g.scale.y = lerp(w.g.scale.y, target, Math.min(1, dt * 8)); }
    // lighting
    lightFor(t, loc, dt);
    // NPCs
    for (const id in npcObjs) {
      const o = npcObjs[id], d = NPCS[id];
      const pres = npcPresent(id); o.present = pres; o.p.root.visible = pres;
      if (!pres) continue;
      const talking = UI.talkingTo() === id;
      let st = "stand";
      if (talking) { const tr = Math.atan2(S.pos.x - o.x, S.pos.z - o.z); o.rot = tr; }
      else if (id === "teo" && hourOf(t) >= 16) { o.tx = -2.8; o.tz = 5.6; if (Math.hypot(o.tx - o.x, o.tz - o.z) < .2) { st = "play"; o.rot = Math.PI; } }
      else {
        o.wait -= simMinutes;
        if (o.wait <= 0 && Math.hypot(o.tx - o.x, o.tz - o.z) < .25) { if (d.roam) { o.tx = rnd(-16, 16); o.tz = rnd(-15, 14); o.wait = rnd(3, 25); } else { const r = id === "juno" ? 9 : (d.wander ?? 1.6); o.tx = d.spot.x + rnd(-r, r); o.tz = d.spot.z + rnd(-r, r); o.wait = rnd(8, 30); } [o.tx, o.tz] = collide(o.tx, o.tz, .4); }
      }
      if (!talking && st !== "play") {
        const dx = o.tx - o.x, dz = o.tz - o.z, dd = Math.hypot(dx, dz);
        if (dd > .15) { const sp = (d.robot ? 1.1 : .95) * dt; const ox = o.x, oz = o.z; [o.x, o.z] = collideFor(o.x + dx / dd * Math.min(sp, dd), o.z + dz / dd * Math.min(sp, dd)); if (Math.hypot(o.x - ox, o.z - oz) < sp * .3) { o.tx = o.x; o.tz = o.z; o.wait = 0; } o.rot = Math.atan2(dx, dz); st = "walk"; o.ph += dt * 7; }
      }
      // keep NPCs from overlapping the player
      const px = o.x - S.pos.x, pz = o.z - S.pos.z, pd = Math.hypot(px, pz); if (pd < .55 && pd > 1e-3) { o.x = S.pos.x + px / pd * .55; o.z = S.pos.z + pz / pd * .55; }
      o.p.root.position.set(o.x, cur.floorY(o.x), o.z); o.p.root.rotation.set(0, o.rot, cur.ring ? Math.asin(o.x / R_RING) : 0);
      if (!o.p.robot && !o.p.hover) People.hold(o.p, "g", st === "play" ? (o.guitar || (o.guitar = makeGuitar())) : null);
      animatePerson(o.p, st, dt);
    }
    // crowd
    if (loc === "plaza") {
      const now = performance.now() / 1000;
      for (const d of drones) { const a = now * d.sp * 6 + d.off; d.g.position.set(Math.cos(a) * d.r, d.h + Math.sin(now + d.off) * .3, Math.sin(a) * d.r - 2); }
      if (cur.water) cur.water.material.opacity = .82 + Math.sin(now * 2) * .03;
      rain.visible = S.weather === "rain";
      if (rain.visible) { const p = rain.geometry.attributes.position; for (let i = 1; i < p.array.length; i += 3) { p.array[i] -= dt * 14; if (p.array[i] < 0) p.array[i] = 18; } p.needsUpdate = true; rain.position.set(Math.round(S.pos.x / 4) * 4 - 0, 0, Math.round(S.pos.z / 4) * 4); }
    }
    if (loc === "station") {
      ringSpin += dt * 2 * Math.PI * 2 / 60; // 2 rpm, real time
      spaceTex.rotation = ringSpin;
      if (Math.abs(t - spaceDrawnAt) >= 2) { drawSpace(t); spaceDrawnAt = t; }
    }
    if (loc === "home") {
      cur.fabGlow.material.emissiveIntensity = Act.cur && Act.cur.fab ? 1.5 + Math.sin(performance.now() / 90) * .5 : .5;
      const pl = S.flags.plant / 100; for (const l of cur.plantLeaves) l.material.color.setHSL(.3, .25 + pl * .25, .22 + pl * .12);
    }
    // keep townspeople from standing inside each other
    const pres = Object.values(npcObjs).filter(o => o.present);
    for (let i = 0; i < pres.length; i++) for (let j = i + 1; j < pres.length; j++) { const a = pres[i], b = pres[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < .7 && d > 1e-3) { const k = (.7 - d) / 2 / d; a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k; } }
    // fade tree canopies that block the view of you
    if (cur.trees) { const cx = camera.position.x, cz = camera.position.z, px = S.pos.x, pz = S.pos.z, vx = px - cx, vz = pz - cz, L2 = vx * vx + vz * vz;
      for (const tr of cur.trees) { const t2 = clamp(((tr.x - cx) * vx + (tr.z - cz) * vz) / L2, 0, 1), d = Math.hypot(cx + vx * t2 - tr.x, cz + vz * t2 - tr.z); const hide = d < 2.4 && t2 < .97; tr.m.opacity = lerp(tr.m.opacity, hide ? .22 : 1, Math.min(1, dt * 8)); tr.m.depthWrite = tr.m.opacity > .9; } }
    if (loc === "home" || cat) updateCat(dt, simMinutes);
    if (loc === "plaza") updateGarden();
    Sound.update(loc === "plaza" && Math.hypot(S.pos.x, S.pos.z - 2) < 5);
    renderer.render(scene, camera);
    if (performance.now() - lastTagUpdate > 60) { lastTagUpdate = performance.now(); UI.tags(projectTags()); }
  }
  function collideFor(x, z) { return collide(x, z, .24); }
  function projectTags() {
    const out = []; const v = new T.Vector3();
    for (const id in npcObjs) { const o = npcObjs[id]; if (!o.present) continue; const d = Math.hypot(o.x - S.pos.x, o.z - S.pos.z); if (d > 7) continue;
      v.set(o.x, cur.floorY(o.x) + (NPCS[id].robot ? (id === "pip" ? 1.9 : 1.7) : 2.0), o.z).project(camera); if (v.z > 1) continue;
      out.push({ id, name: NPCS[id].name, sub: S.npcs[id].met ? relWord(S.npcs[id].rel) : "", x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, near: d < 1.9 }); }
    return out;
  }
  function lightFor(t, loc, dt) {
    const pref = S.flags.light;
    if (loc === "station") {
      const lit = stationSunlit(t), ph = orbitPhase(t);
      const a = ph * Math.PI * 2;
      sun.position.set(Math.cos(a) * 40, 30, -20); sun.target.position.set(0, 0, 0);
      sun.intensity = lit ? 1.1 : 0; sun.color.set(ph < .05 || (ph > .56 && ph < .61) ? "#ffb070" : "#fff6ea");
      hemi.intensity = .35; hemi.color.set("#e9eef2"); hemi.groundColor.set("#545c60");
      scene.background = new T.Color("#0b0f14"); scene.fog.color.set("#2a3238"); scene.fog.near = 40; scene.fog.far = 260;
      for (const m of cur.stripMats) m.emissiveIntensity = lit ? .7 : 1.4;
      cur.hemiLocal.intensity = lit ? .3 : .55;
      return;
    }
    const e = sunElev(t), day = clamp((e + .08) / .32, 0, 1), dusk = clamp(1 - Math.abs(e) / .2, 0, 1);
    const h = hourOf(t), az = (h - 6) / 12 * Math.PI;
    sun.position.set(Math.cos(az) * 30 + (cur.sunTarget ? cur.sunTarget.x : 0), Math.max(.06, e) * 42 + 3, -24);
    sun.target.position.copy(cur.sunTarget || new T.Vector3());
    const rainK = S.weather === "rain" ? .45 : S.weather === "cloudy" ? .7 : 1;
    sun.intensity = day * 1.7 * rainK;
    sun.color.setHSL(.09, .6 * dusk + .1, .55 + .35 * (1 - dusk));
    const skyDay = new T.Color(S.weather === "clear" ? "#9cc3dd" : "#a3adb5"), skyNight = new T.Color("#0c1422"), skyDusk = new T.Color("#e39a6c");
    const sky = skyNight.clone().lerp(skyDay, day).lerp(skyDusk, dusk * .45 * day + dusk * .2);
    hemi.color.copy(sky).lerp(new T.Color("#ffffff"), .3); hemi.groundColor.set(day > .3 ? "#6b5a48" : "#1b1d22");
    hemi.intensity = .18 + .55 * day;
    if (loc === "plaza") {
      scene.background = sky; scene.fog.color.copy(sky); scene.fog.near = 25; scene.fog.far = S.weather === "rain" ? 55 : 110;
      const night = 1 - day;
      for (const m of cur.lampMats) m.emissiveIntensity = night * 2.2;
      for (const l of cur.streetLights) l.intensity = night * 1.1;
      for (const m of cur.windows) m.emissiveIntensity = night * .9;
      stars.material.opacity = S.weather === "clear" ? clamp(night - .2, 0, 1) : 0;
    } else {
      scene.background = sky.clone().multiplyScalar(.35); scene.fog.color.copy(sky); scene.fog.near = 14; scene.fog.far = 60;
      const night = 1 - day;
      for (const m of cur.ext) { m.material.opacity = night * .55; m.material.emissiveIntensity = night * .8; }
      for (const L of cur.lights) { const on = pref ? 1 : 0; L.l.intensity = on * L.base * (.45 + night * .75); L.m.emissiveIntensity = on * L.me; }
    }
  }
  function relWord(r) { return r < -20 ? "strained" : r < 8 ? "acquaintance" : r < 30 ? "friendly" : r < 60 ? "friend" : "close friend"; }

  return { setMove(x, z) { moveVec.x = x; moveVec.z = z; }, look(dx, dy) { yaw -= dx * .006; pitch = clamp(pitch + dy * .004, .25, 1.2); }, zoom(k) { dist = clamp(dist * k, 4, 16); },
    init, update, setLoc, restyle, toggleRun() { runToggle = !runToggle; return runToggle; }, placePlayer, anchorFor, setPose, nearest, keys, relWord, get cur() { return cur; }, npcPresent, ringY,
    turn(d) { yaw += d; } };
})();
