/* ============================================================
   UI — HUD, menus, drawers, conversations, creator, input, loop
   ============================================================ */
const TOUCH = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
const UI = (() => {
  let menuOpen = null, drawerKind = null, talking = null, tabHeld = false, lastHud = 0, thoughtTimer = null, busy = false, abortCtl = null;
  const tagEls = {};
  const hud = $("#hud"), menu = $("#menu"), drawer = $("#drawer");

  function toast(text, kind = "info") {
    const el = document.createElement("div"); el.className = "toast " + kind; el.textContent = text; $("#toasts").prepend(el);
    const all = $("#toasts").children; while (all.length > 4) all[all.length - 1].remove();
    setTimeout(() => el.remove(), Math.min(9000, 3500 + text.length * 40));
  }
  function thought(t) { const el = $("#thought"); el.textContent = t; el.classList.add("on"); clearTimeout(thoughtTimer); thoughtTimer = setTimeout(() => el.classList.remove("on"), 7000); }
  function activity() {
    const a = Act.cur; $("#activity").hidden = !a;
    if (a) { $("#aName").textContent = a.name; }
    menuClose();
  }
  function hand() {
    const h = S.hand, el = $("#hand"); el.hidden = !h;
    if (h) el.innerHTML = `<small>Carrying</small>${esc(h.name)}${h.kind === "meal" ? ` · <span style="color:${h.hot ? "var(--amber)" : "var(--ink-dim)"}">${h.hot ? "hot" : "cold"}</span>` : ""}`;
  }
  function blocking() { return !!(menuOpen || (drawerKind && drawerKind !== "terminal-bg") || !$("#creator").hidden); }
  function talkingTo() { return talking; }

  /* ---------- HUD ---------- */
  const NEEDS = [["full", "Fullness"], ["energy", "Energy"], ["hygiene", "Hygiene"], ["bladder", "Bladder", true], ["social", "Social"], ["fun", "Fun"], ["comfort", "Comfort"]];
  function barColor(v) { return v < 20 ? "var(--bad)" : v < 40 ? "var(--warn)" : "var(--good)"; }
  function renderHud(force) {
    if (!force && performance.now() - lastHud < 200) return; lastHud = performance.now();
    $("#hTime").textContent = fmtClock(S.t); $("#hDate").textContent = fmtDate(S.t);
    $("#hCr").textContent = "₵ " + Math.floor(S.credits).toLocaleString();
    const W = World.cur;
    $("#hLoc").textContent = W ? W.name : "";
    let sub = [];
    if (S.loc === "station") { sub.push(stationSunlit(S.t) ? `Orbital day · sunset in ${fmtDur(ORBIT * .61 - (S.t % ORBIT))}` : `Earth's shadow · sunrise in ${fmtDur(nextOrbitalSunrise(S.t))}`); sub.push("Ring 2 rpm · 1.0 g"); }
    else { sub.push({ clear: "Clear", cloudy: "Overcast", rain: "Rain" }[S.weather] + " · " + (sunElev(S.t) > 0 ? "daylight" : "night")); if (S.loc === "plaza") sub.push("Crowd: " + crowdWord()); }
    const md = marsDelayMin(S.t); sub.push(`Mars light-delay ${md.min.toFixed(1)} min`);
    $("#hSub").innerHTML = sub.map(esc).join("<br>");
    const c = S.char.cond, m = mood(), adhdFade = c.adhd && !tabHeld;
    let html = `<div class="mood"><span>Mood</span><b>${moodWord(m)}</b></div>`;
    for (const [k, label, inv] of NEEDS) {
      const v = S.needs[k], show = inv ? 100 - v : v;
      const faded = adhdFade && (inv ? v < 75 : v > 28);
      html += `<div class="need${faded ? " faded" : ""}"><span>${label}</span><div class="bar"><i style="width:${clamp(show, 0, 100)}%;background:${barColor(show)}"></i></div></div>`;
    }
    const extra = [["Stress", S.stress, true]]; if (c.pain) extra.push(["Pain", S.pain, true]); if (c.autism) extra.push(["Sensory", S.sensory, true]);
    for (const [label, v] of extra) html += `<div class="need"><span>${label}</span><div class="bar"><i style="width:${clamp(v, 0, 100)}%;background:${v > 70 ? "var(--bad)" : v > 45 ? "var(--warn)" : "var(--violet)"}"></i></div></div>`;
    html += `<div class="need"><span>Weave</span><div class="bar"><i style="width:${S.weave.wh / S.weave.max * 100}%;background:var(--cyan)"></i></div></div>`;
    html += `<div id="moodlets">${S.moodlets.slice(-5).map(x => `<span class="${x.v >= 0 ? "pos" : "neg"}">${esc(x.label)}</span>`).join("")}${S.flags.earbuds ? '<span>Earbuds in</span>' : ""}</div>`;
    $("#needs").innerHTML = html;
    if (Act.cur) { const a = Act.cur; $("#aLeft").textContent = fmtDur(a.min - a.elapsed) + " left"; $("#aBar").style.width = (a.elapsed / a.min * 100) + "%"; $("#aName").textContent = a.name; }
    for (const b of $("#speeds").children) b.classList.toggle("on", +b.dataset.sp === S.speed);
    // interaction prompt
    const p = $("#prompt");
    if (!Act.cur && !blocking()) { const nb = World.nearest(); if (nb) { p.hidden = false; p.innerHTML = `${TOUCH ? "" : "<kbd>E</kbd> "}${nb.kind === "npc" ? "Talk to " : ""}${esc(nb.name)}${typeof BIZ !== "undefined" && BIZ[nb.id] ? ` <span class="pstat">· ${esc(bizStatus(nb.id))}</span>` : ""}`; } else p.hidden = true; } else p.hidden = true;
  }
  function tags(list) {
    const host = $("#tags"); const seen = {};
    for (const t of list) { seen[t.id] = 1; let el = tagEls[t.id]; if (!el) { el = tagEls[t.id] = document.createElement("div"); el.className = "tag"; host.appendChild(el); }
      el.style.left = t.x + "px"; el.style.top = t.y + "px"; el.innerHTML = esc(t.name) + (t.sub ? `<em>${esc(t.sub)}</em>` : ""); el.style.borderColor = t.near ? "var(--amber)" : ""; el.hidden = !!talking; }
    for (const id in tagEls) if (!seen[id]) { tagEls[id].remove(); delete tagEls[id]; }
  }

  /* ---------- Action menu ---------- */
  function interact() {
    if (Act.cur || blocking()) return;
    const nb = World.nearest(); if (!nb) return;
    if (nb.kind === "npc") return openChat(nb.id);
    const acts = getActions(nb.id); if (!acts.length) return;
    menuOpen = { title: nb.name, acts };
    menu.innerHTML = `<h3>${esc(nb.name)}</h3>` + acts.map((a, i) => `<button class="act" data-i="${i}" ${a.disabled ? "disabled" : ""}><span class="n">${i + 1}</span><span><span class="t">${esc(a.label)}</span><span class="d">${esc(a.disabled ? a.disabled + (a.desc ? " · " + a.desc : "") : a.desc)}</span></span><span class="m">${esc(a.meta || "")}</span></button>`).join("");
    menu.hidden = false; Sound.click();
    menu.querySelectorAll(".act").forEach(b => b.onclick = () => choose(+b.dataset.i));
    const first = menu.querySelector(".act:not([disabled])"); if (first) first.focus({ preventScroll: true });
  }
  function choose(i) { if (!menuOpen) return; const a = menuOpen.acts[i]; if (!a || a.disabled) return; menuClose(); a.run(); renderHud(true); }
  function menuClose() { menuOpen = null; menu.hidden = true; }

  /* ---------- Drawers ---------- */
  function openDrawer(kind, title, sub, bodyHtml, after) {
    menuClose(); drawerKind = kind;
    drawer.innerHTML = `<header><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div><button class="close" id="dClose">${TOUCH ? "Close" : "Close · Esc"}</button></header><div class="body" id="dBody">${bodyHtml}</div>`;
    drawer.hidden = false; $("#dClose").onclick = closeDrawer; if (after) after();
  }
  function closeDrawer() {
    if (talking) endChat();
    drawerKind = null; drawer.hidden = true; drawer.innerHTML = "";
  }

  function things() {
    const it = S.items;
    const mats = Object.keys(MATERIALS).filter(k => k !== "feedstock").map(k => `<div class="rowline"><span>${esc(MATERIALS[k].name)}</span><span class="r">${S.inv[k] || 0}</span></div>`).join("");
    const items = it.length ? it.map(x => `<div class="rowline"><span>${esc(x.name)} <span class="chip">${qWord(x.q)}</span>${x.state === "greenware" ? ' <span class="chip">unfired</span>' : ""}<br><span class="note">${esc(x.trait)}</span></span><button class="btn" data-keep="${x.id}">${x.keep ? "Keeping" : "For sale"}</button></div>`).join("") : '<p class="note">Nothing made yet. The workbench is by the left wall; bread happens in the kitchen.</p>';
    const comm = S.commissions.length ? S.commissions.map(cm => `<div class="rowline"><span>${esc(cm.from)}: ${esc(CRAFTS[cm.cat].name.toLowerCase())}<br><span class="note">“${esc(cm.note)}” · due Day ${cm.due}</span></span><span class="r">₵${cm.price}</span></div>`).join("") : '<p class="note">None accepted. Check the board in the plaza, or people may ask you directly.</p>';
    const fridge = S.fridge.length ? S.fridge.map(f => `<div class="rowline"><span>${esc(f.name)}</span><span class="r">Day ${dayOf(f.made)}</span></div>`).join("") : '<p class="note">Empty.</p>';
    openDrawer("things", "Your things", `${S.songs} song${S.songs === 1 ? "" : "s"} in your set · earbuds ${S.inv.earbuds ? "owned (H)" : "not owned"}`,
      `<div class="section"><h4>Made by you</h4>${items}</div><div class="section"><h4>Commissions</h4>${comm}</div><div class="section"><h4>Materials</h4>${mats}</div><div class="section"><h4>Fridge</h4>${fridge}</div>`,
      () => drawer.querySelectorAll("[data-keep]").forEach(b => b.onclick = () => { const x = S.items.find(i => i.id === b.dataset.keep); x.keep = !x.keep; things(); }));
  }
  function shop() {
    const rows = Object.entries(MATERIALS).map(([k, m]) => `<div class="rowline"><span>${esc(m.name)}<br><span class="note">${esc(m.note)}</span></span><button class="btn" data-buy="${k}">₵${m.price}</button></div>`).join("")
      + `<div class="rowline"><span>Noise-cancelling earbuds<br><span class="note">Halves how much noise reaches you. Toggle with H.</span></span><button class="btn" data-buy="earbuds" ${S.inv.earbuds ? "disabled" : ""}>${S.inv.earbuds ? "Owned" : "₵45"}</button></div>`;
    openDrawer("shop", "Automat", `Robot-stocked, robot-priced. Balance ₵${Math.floor(S.credits)} · weave feedstock ${S.weave.g} g`, rows, () => drawer.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
      const k = b.dataset.buy, price = k === "earbuds" ? 45 : MATERIALS[k].price;
      if (!canAfford(price)) return toast("Not enough credits.", "bad");
      pay(-price, "Automat: " + (k === "earbuds" ? "earbuds" : MATERIALS[k].name));
      if (k === "feedstock") S.weave.g += 10; else if (k === "earbuds") S.inv.earbuds = 1; else S.inv[k] = (S.inv[k] || 0) + (k === "catfood" ? 3 : 1);
      shop();
    }));
  }
  function board() {
    const avail = S.board.filter(b => !S.commissions.some(c => c.id === b.id)).map(b => `<div class="rowline"><span>${esc(b.from)} wants a ${esc(CRAFTS[b.cat].name.toLowerCase())}<br><span class="note">“${esc(b.note)}” · by Day ${b.due}</span></span><button class="btn" data-acc="${b.id}">Accept · ₵${b.price}</button></div>`).join("") || '<p class="note">Nothing new today. The board refreshes each morning.</p>';
    const mine = S.commissions.map(c => { const ok = S.items.find(i => i.cat === c.cat && i.state === "done"); return `<div class="rowline"><span>${esc(c.from)}: ${esc(CRAFTS[c.cat].name.toLowerCase())}<br><span class="note">due Day ${c.due}${ok ? "" : " · none ready"}</span></span><button class="btn ${ok ? "primary" : ""}" data-del="${c.id}" ${ok ? "" : "disabled"}>Deliver · ₵${c.price}</button></div>`; }).join("") || '<p class="note">You have no open commissions.</p>';
    openDrawer("board", "Commission board", "People asking for things a person made. Deliveries go in the locker.", `<div class="section"><h4>Open requests</h4>${avail}</div><div class="section"><h4>Yours to deliver</h4>${mine}</div><p class="note">Pieces you deliver leave your stock; the best match is used.</p>`, () => {
      drawer.querySelectorAll("[data-acc]").forEach(b => b.onclick = () => { const x = S.board.find(q => q.id === b.dataset.acc); S.commissions.push({ ...x }); toast(`Accepted. Due Day ${x.due}.`, "good"); board(); });
      drawer.querySelectorAll("[data-del]").forEach(b => b.onclick = () => deliver(b.dataset.del, board));
    });
  }
  function deliver(cid, refresh) {
    const c = S.commissions.find(x => x.id === cid); if (!c) return;
    const opts = S.items.filter(i => i.cat === c.cat && i.state === "done").sort((a, b) => b.q - a.q); if (!opts.length) return;
    const it = opts[0]; S.items.splice(S.items.indexOf(it), 1); S.commissions.splice(S.commissions.indexOf(c), 1);
    const bonus = it.q > .7 ? Math.round(c.price * .15) : 0;
    pay(c.price + bonus, `Commission: ${it.name} for ${c.from}`); S.stats.commissions++; S.stats.earnedCraft += c.price + bonus; Sound.coins();
    logEv(`Delivered to ${c.from}: ₵${c.price}${bonus ? ` + ₵${bonus} because it's lovely` : ""}.`, "good");
    addMoodlet("commission", "Made something someone asked for", 10, 24);
    if (c.npc && S.npcs[c.npc]) S.npcs[c.npc].rel = Math.min(100, S.npcs[c.npc].rel + 6);
    if (refresh) refresh();
  }
  function weave() {
    const w = S.weave;
    const rows = WEAVE.map(x => `<div class="rowline"><span><b>${esc(x.name)}</b> <span class="chip">${x.wh} Wh${x.g ? " · " + x.g + " g" : ""} · ${x.min}m</span><br><span class="note">${esc(x.desc)}</span></span><button class="btn" data-w="${x.id}" ${w.wh < x.wh || w.g < x.g ? "disabled" : ""}>Use</button></div>`).join("");
    openDrawer("weave", "Your weave", `${w.wh.toFixed(1)} / ${w.max} Wh stored · ${w.g} g feedstock`,
      `<p class="note">Your weave is a colony of nanites living in a thin mesh under your skin and in your sleeve cuffs. It looks like magic and it isn't: every effect is paid for in stored energy and in grams of feedstock. 40 Wh is about what a 150 g battery holds, enough to warm a cup of tea from fridge-cold to drinking temperature twice. It recharges on your induction mattress while you sleep (about 6 Wh an hour), and feedstock comes from the automat.</p>${rows}<p class="note">What it can't do: fire a clay bowl (that needs roughly 250 Wh, so the kiln does it), replace food (your body needs about 2,300 kcal, or 2,700 Wh, a day), or make anything from nothing.</p>`,
      () => drawer.querySelectorAll("[data-w]").forEach(b => b.onclick = () => useWeave(WEAVE.find(x => x.id === b.dataset.w))));
  }

  /* ---------- Terminal ---------- */
  let termTab = "msg";
  function terminal(tab) {
    if (tab) termTab = tab;
    const tabs = [["msg", "Messages"], ["money", "Money"], ["order", "Deliveries"], ["skills", "Skills"]];
    const head = `<div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${termTab === k ? "on" : ""}">${l}${k === "msg" && unreadRin() ? " •" : ""}</button>`).join("")}</div>`;
    let body = "";
    if (termTab === "msg") {
      const md = marsDelayMin(S.t);
      const msgs = S.mars.msgs.filter(m => m.from === "me" || m.arrive <= S.t);
      for (const m of msgs) if (m.from === "rin" && !m.read) { m.read = true; if (m.sent > 6 * 60) S.stats.rinReplies++; }
      const pending = S.mars.msgs.filter(m => m.from === "rin" && m.arrive > S.t).length;
      body = `<p class="note">Rin Hale is a hydrologist at Jezero Station on Mars, a friend from university. Mars is ${md.au.toFixed(2)} AU away right now, so each message takes <b>${md.min.toFixed(1)} minutes</b> to arrive at light speed. Replies take at least twice that, plus however long Rin needs to write.</p>
        <div class="log" id="rinLog">${msgs.map(m => `<div class="msg ${m.from === "me" ? "me" : "them"}">${esc(m.text)}<br><span class="note mono" style="font-size:10.5px">${m.from === "me" ? "sent " + fmtClock(m.sent) + " · lands on Mars " + fmtClock(m.arrive) : "arrived " + fmtClock(m.arrive) + " Day " + dayOf(m.arrive)}</span></div>`).join("")}${pending ? `<div class="msg sys">A reply is crossing the gap. ${pending > 1 ? pending + " messages" : "It"} will arrive in ${fmtDur(Math.min(...S.mars.msgs.filter(m => m.from === "rin" && m.arrive > S.t).map(m => m.arrive)) - S.t)}.</div>` : ""}</div>
        <div style="display:flex;gap:8px;margin-top:12px"><textarea id="rinBox" style="flex:1;min-width:0;height:70px;resize:vertical;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.04);padding:9px;font:inherit" placeholder="Write to Rin…"></textarea><button class="btn primary" id="rinSend">Send</button></div>`;
    } else if (termTab === "money") {
      const d = dateOf(S.t), toMon = (8 - d.getUTCDay()) % 7 || 7;
      body = `<div class="section"><h4>Balance</h4><div style="font-family:var(--f-display);font-size:40px">₵${Math.floor(S.credits).toLocaleString()}</div><p class="note">UBI pays ₵840 every Monday at 06:00 (next in ${toMon} day${toMon > 1 ? "s" : ""}). Housing, healthcare and transit basics are covered; food, materials and anything special cost credits. Most goods are made by machines and cheap. What people pay extra for is something a particular person chose to make.</p></div><div class="section"><h4>Recent</h4>${S.ledger.slice(0, 25).map(l => `<div class="rowline"><span>${esc(l.d)}<br><span class="note">Day ${dayOf(l.t)} ${fmtClock(l.t)}</span></span><span class="r" style="color:${l.a >= 0 ? "var(--good)" : "var(--ink-dim)"}">${l.a >= 0 ? "+" : ""}${l.a}</span></div>`).join("")}</div><div class="section"><h4>Market demand</h4>${Object.keys(S.demand).map(k => `<div class="rowline"><span>${CRAFTS[k].name}s</span><span class="r">${Math.round(S.demand[k] * 100)}%</span></div>`).join("")}<p class="note">Selling a lot of one thing lowers what people will pay for it. Demand recovers a little each day.</p></div>`;
    } else if (termTab === "order") {
      const pend = S.deliveries.map(dl => `<div class="rowline"><span>${esc(MATERIALS[dl.item].name)}</span><span class="r">arrives ${fmtClock(dl.at)}</span></div>`).join("");
      body = `<p class="note">A drone brings it to your door in about 25 minutes. ₵2 delivery on top of the automat price.</p>${Object.entries(MATERIALS).filter(([k]) => k !== "feedstock").map(([k, m]) => `<div class="rowline"><span>${esc(m.name)}</span><button class="btn" data-ord="${k}">₵${m.price + 2}</button></div>`).join("")}${pend ? `<div class="section" style="margin-top:14px"><h4>On the way</h4>${pend}</div>` : ""}`;
    } else {
      const names = { ceramic: "Ceramics", wood: "Woodcarving", bread: "Baking", journal: "Bookbinding", music: "Music", cooking: "Cooking", social: "Conversation" };
      body = Object.keys(names).map(k => `<div class="need" style="grid-template-columns:110px 1fr;margin:8px 0"><span>${names[k]}${S.char.interest === k ? " ★" : ""}</span><div class="bar"><i style="width:${S.skills[k] * 100}%;background:var(--amber)"></i></div></div>`).join("") + `<p class="note">Skills grow with practice and slow down as you get good. ★ marks your special interest.</p>`;
    }
    openDrawer("terminal", "Terminal", fmtDate(S.t), head + body, () => {
      drawer.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => terminal(b.dataset.tab));
      drawer.querySelectorAll("[data-ord]").forEach(b => b.onclick = () => { const k = b.dataset.ord, p = MATERIALS[k].price + 2; if (!canAfford(p)) return toast("Not enough credits.", "bad"); pay(-p, "Delivery: " + MATERIALS[k].name); S.deliveries.push({ item: k, qty: 1, at: S.t + 25 }); terminal(); });
      const send = $("#rinSend"); if (send) { send.onclick = sendRin; const lg = $("#dBody"); lg.scrollTop = lg.scrollHeight; }
    });
  }
  function unreadRin() { return S.mars.msgs.some(m => m.from === "rin" && m.arrive <= S.t && !m.read); }
  async function sendRin() {
    const box = $("#rinBox"), text = box.value.trim(); if (!text) return;
    const md = marsDelayMin(S.t);
    const mine = { from: "me", text, sent: S.t, arrive: S.t + Math.round(md.min) };
    S.mars.msgs.push(mine); box.value = ""; terminal();
    S.needs.social += 4; smallWin();
    const compose = Math.round(rnd(25, 110)), arrive = S.t + Math.round(md.min * 2) + compose;
    const history = S.mars.msgs.slice(-8).map(m => (m.from === "me" ? S.char.name : "Rin") + ": " + m.text).join("\n\n");
    let reply = null;
    if (AI.provider !== "none") {
      try {
        const prompt = `You are Rin Hale, 34, a hydrologist at Jezero Station on Mars in the year 2147, writing a letter-style message to your old university friend ${S.char.name} (${S.char.pron}) who lives in Lumen Reach on Earth. Light delay right now is ${md.min.toFixed(1)} minutes each way (${md.au.toFixed(2)} AU), so you write in letters, not chat. Your life: dust storms, ice-mining crews, the dome's filtered butterscotch sky, a sol is 24h 39m, gravity 0.38 g makes your knees lazy, you miss rain. You are wry, warm, curious about small real details of their life, and honest. Respond to what they actually wrote. 3 to 6 sentences, no greeting cliches, sign off "— Rin". Never mention being an AI.\n\nRecent letters:\n${history}\n\nWrite Rin's reply now. Reply with only the letter text.`;
        reply = await AI.send([{ role: "user", content: prompt }], { deep: S.settings.deep });
      } catch (e) { reply = null; }
    }
    if (!reply) reply = pick([`Got your message ${fmtDur(md.min)} after you sent it, which still delights me. Tell me more about the small stuff. The dust storm's been sitting on us for three sols and the dome filters sound like a choir. Write back. — Rin`, `I read your letter twice. Here it's mid-sol and the sky is the colour of weak tea. I miss your weather. Send me something ordinary. — Rin`]);
    S.mars.msgs.push({ from: "rin", text: reply, sent: arrive - Math.round(md.min), arrive, read: false });
    if (drawerKind === "terminal") terminal();
  }

  /* ---------- Conversations ---------- */
  const GREET = {
    mara: ["You've got clay-hands. Or you want them. Which is it?", "Back again. Good. Sit if you want, I'm trimming."],
    dev: ["Hi! Hi. Sorry, Gerald, that's my starter, had a moment. What can I get you?", "Oh, it's you! Usual? I don't actually know your usual yet. Let's make one."],
    teo: ["Hey! You look like someone with a song stuck in them. Want to hear a weird one?", "Yo! I rebuilt a delivery bot's speaker into a tremolo. Listen."],
    imani: ["Afternoon. Lovely light today. How are you, really?", "Good to see you. No session needed to say hello."],
    juno: ["Hello. I am JUNO-7, municipal service unit. I can explain things, give directions, or listen. Listening is in my spec sheet.", "Hello again. My records show you were here before. That is a nice record."],
    brandt: ["Mind the seedlings. If you're here to look, look. If you're here to help, wash your hands.", "You again. Good. The chard's bolting and I need hands."],
    pip: ["HELLO! CO2 at 610 ppm, ring at 2.00 rpm, all nominal! Who are you?", "HELLO AGAIN! You have visited Halcyon before! That is my favourite kind of human!"]
  };
  function relWord(r) { return World.relWord(r); }
  function openChat(id) {
    const st = S.npcs[id], d = NPCS[id]; talking = id;
    if (!st.hist.length || S.t - (st.lastTalk || 0) > 120) {
      const g = (GREET[id] || NPCS[id].greet)[st.met ? 1 : 0];
      st.hist.push({ r: "n", text: g, sys: false }); Sound.speak(g, id);
      if (st.hist.length > 24) st.hist.splice(0, st.hist.length - 24);
    }
    st.met = true; st.lastTalk = S.t;
    if (S.char.cond.anxiety) S.stress += st.rel < 20 ? 4 : 1;
    drawChat();
  }
  function drawChat(pendingText) {
    const id = talking, st = S.npcs[id], d = NPCS[id];
    const due = S.commissions.filter(c => c.npc === id && S.items.some(i => i.cat === c.cat && i.state === "done"));
    const lim = AI.provider === "none" ? `<div class="msg sys">No AI is connected, so replies are simple. Play this inside Claude, or connect a model in Journal → Settings, for real conversations.</div>` : "";
    openDrawer("chat", esc(d.name), `${esc(d.role)} · ${relWord(st.rel)}<div class="relbar"><i style="width:${clamp((st.rel + 30) / 130 * 100, 2, 100)}%"></i></div>`,
      `${lim}<div class="log" id="chatLog">${st.hist.map(m => `<div class="msg ${m.r === "p" ? "me" : m.r === "n" ? "them" : m.r === "i" ? "inner" : "sys"}">${esc(m.text)}</div>`).join("")}${pendingText != null ? `<div class="msg them" id="pend">${esc(pendingText)}</div>` : ""}</div>`,
      () => {
        drawer.insertAdjacentHTML("beforeend", `<div class="composer"><textarea id="chatBox" placeholder="Say something to ${esc(d.name.split(" ")[0])}…" aria-label="Your message"></textarea><button class="btn primary" id="chatSend" ${busy ? "disabled" : ""}>Say</button></div><div style="display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 12px">${due.map(c => `<button class="btn" data-dl="${c.id}">Hand over ${esc(CRAFTS[c.cat].name.toLowerCase())} · ₵${c.price}</button>`).join("")}<button class="btn" id="chatLeave">Say goodbye</button></div>`);
        const box = $("#chatBox"); box.focus();
        box.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } });
        $("#chatSend").onclick = sendChat; $("#chatLeave").onclick = closeDrawer;
        drawer.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => { deliver(b.dataset.dl); st.hist.push({ r: "s", text: "You hand it over." }); drawChat(); });
        const lg = $("#dBody"); lg.scrollTop = lg.scrollHeight;
      });
  }
  function observable() {
    const n = S.needs, o = [];
    if (n.energy < 25) o.push("looks exhausted"); if (n.full < 20) o.push("looks hungry and a bit shaky");
    if (n.hygiene < 22) o.push("hasn't washed in a while; there's a noticeable smell"); else if (n.hygiene < 40) o.push("looks a little unkempt");
    if (S.stress > 65) o.push("seems tense, fidgety"); if (S.char.cond.autism && S.sensory > 70) o.push("is wincing at noise, avoiding eye contact more than usual");
    if (S.char.cond.pain && S.pain > 55) o.push("moves stiffly, like their back hurts");
    if (S.hand) o.push("is holding " + S.hand.name.toLowerCase()); if (S.flags.earbuds) o.push("has earbuds in");
    const m = mood(); o.push(m < 30 ? "seems low" : m > 72 ? "seems in good spirits" : "seems ordinary");
    return o.join("; ");
  }
  function npcRules(id) {
    const d = NPCS[id], st = S.npcs[id], c = S.char;
    const where = id === "brandt" || id === "pip" ? "Halcyon station, ring deck C" : "the plaza in Lumen Reach";
    const items = S.items.filter(i => i.state === "done").slice(0, 4).map(i => `${i.name} (${qWord(i.q)}, ${i.trait})`).join("; ") || "nothing finished yet";
    const myComm = S.commissions.filter(x => x.npc === id).map(x => `${CRAFTS[x.cat].name} for ₵${x.price}, due day ${x.due}`).join("; ") || "none";
    return `You are voicing ${d.name} in "Lumen Reach", a grounded, cozy near-future life simulation set in ${dateOf(S.t).getUTCFullYear()}. Stay fully in character.

WORLD (true facts you can rely on): Universal basic income (₵840/week) covers basics. Robots and AIs automate most production, so machine-made goods are cheap; people still pay more for human-made things because each one carries a particular person's choices, not because machines can't make them. Personal "weaves" are nanite colonies that look like magic but obey physics: limited by stored energy (~40 Wh), grams of feedstock, and heat. Halcyon is an orbital station: 224 m radius ring spinning at 2 rpm for ~1 g, 92-minute orbit, sunrise every 92 minutes; the shuttle takes ~2h40. Mars is minutes of light-delay away. The shared kiln behind the market fires overnight. Currency is credits (₵).

YOUR CHARACTER: ${d.persona}

YOUR PRONOUNS: ${d.pron || (d.look && d.look.sex === "f" ? "she/her" : d.look && d.look.sex === "m" ? "he/him" : "it/its (you're a machine)")}.

THE PLAYER CHARACTER: ${c.name}, ${c.age}, pronouns ${c.pron}. Background: ${BACKGROUNDS[c.bg].name}. Their visible craft: ${items}. Commissions between you two: ${myComm}. Right now they ${observable()}. You do NOT know any private diagnosis or condition unless they tell you in this conversation or your memory notes say so.

YOUR RELATIONSHIP: ${relWord(st.rel)} (score ${Math.round(st.rel)} on -100..100). Your memory notes about them: ${st.notes.length ? st.notes.join(" | ") : "none yet, you've just met or barely talked."}

SITUATION: ${fmtDate(S.t)}, ${fmtClock(S.t)}, at ${where}. Weather: ${S.weather}. ${S.loc === "plaza" ? "Crowd: " + crowdWord() + "." : ""}

HOW TO TALK: Speak like a real person (or, for robots, a real robot) in a short spoken exchange, usually 1 to 4 sentences. React to what they actually said; ask things back; have your own opinions, moods and boundaries; it's fine to be busy, disagree, misunderstand, joke, or change the subject. Notice what's observable about them only if a real person would comment. No narration in asterisks, no stage directions. Never mention AI models, prompts, or games (robots know they are robots). If they share something painful, respond with genuine care and no lecturing. Friendship, flirting and romance can grow naturally over time if it's mutual and fits your character; keep anything sexual off-screen (fade to black).

ACTIONS (rare, only when natural): "commission" if you'd genuinely want to buy something they make, with a realistic price 20-160 (cat one of ceramic, wood, bread, journal); "gift" a small amount of credits (max 30) only for real reasons; "end" if you need to leave the conversation.

OUTPUT: Reply with only a JSON object: {"reply": string, "relationship": integer -5..5 (how this exchange changed how you feel about them), "player_mood": integer -6..6 (how this exchange likely made them feel), "memory": string (one short fact worth remembering about them from their latest message, or ""), "action": null or {"type":"commission","cat":"ceramic","price":60,"note":"..."} or {"type":"gift","credits":10} or {"type":"end"}}`;
  }
  function fallbackReply(id, text) {
    const t = text.toLowerCase(), d = NPCS[id];
    if (/\b(hi|hello|hey)\b/.test(t)) return pick(["Hello to you too.", "Hey. Good to see a face.", "Hi. What's on your mind?"]);
    if (/sell|buy|commission|make/.test(t)) return id === "mara" ? "Bring me something you made and I'll tell you what it's worth. Honestly." : "If you make something good, people here notice. The board by the fountain has requests.";
    if (/sad|tired|hard|depress|anxious|lonely/.test(t)) return id === "imani" ? "That sounds heavy. You don't have to carry it on the street; my door's open weekdays." : "That sounds rough. I'm glad you said it out loud.";
    if (d.robot) return "I have logged that. Would you like directions, a schedule, or a fact about the town?";
    return pick(["Huh. Tell me more.", "I hadn't thought of it like that.", "Fair enough.", "Mm. What made you think of that?"]);
  }
  async function sendChat() {
    if (busy) return; const box = $("#chatBox"); const text = box.value.trim(); if (!text) return;
    const id = talking, st = S.npcs[id], c = S.char.cond;
    st.hist.push({ r: "p", text }); box.value = "";
    // time and needs: a real exchange takes a couple of minutes and costs or gives energy
    for (let i = 0; i < 2; i++) stepMinute();
    S.needs.social = Math.min(100, S.needs.social + (c.autism ? 2.5 : 4)); S.needs.fun += 1;
    if (c.autism) { S.needs.energy -= .9; S.sensory += 2; }
    if (c.anxiety) S.stress += st.rel < 20 ? 2.5 : .8;
    S.skills.social = Math.min(1, S.skills.social + .004);
    busy = true; drawChat("…");
    let out = null;
    if (AI.provider !== "none") {
      try {
        const turns = [{ role: "user", content: npcRules(id) + "\n\nThe conversation so far follows. Respond to the player's latest message." }];
        for (const m of st.hist.slice(-16)) { if (m.r === "p") turns.push({ role: "user", content: "PLAYER: " + m.text }); else if (m.r === "n") turns.push({ role: "assistant", content: m.text }); }
        if (turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: "PLAYER: " + text });
        abortCtl = new AbortController();
        out = await AI.send(turns, { json: true, deep: S.settings.deep, signal: abortCtl.signal });
      } catch (e) {
        if (e && e.code === "rate_limited") toast("Too many conversations at once. Give it a moment.", "bad");
        else if (e && e.code === "cancelled") { busy = false; return; }
      }
    }
    busy = false;
    if (talking !== id) return;
    let reply = out && typeof out.reply === "string" ? out.reply.trim() : fallbackReply(id, text);
    st.hist.push({ r: "n", text: reply });
    if (out) {
      const dr = clamp(+out.relationship || 0, -5, 5); st.rel = clamp(st.rel + dr, -100, 100);
      const pm = clamp(+out.player_mood || 0, -6, 6); if (pm) addMoodlet("talk-" + id, pm > 0 ? `Talked with ${NPCS[id].name.split(" ")[0]}` : `Awkward talk with ${NPCS[id].name.split(" ")[0]}`, pm, 6);
      if (out.memory && typeof out.memory === "string" && out.memory.length > 3) { st.notes.push(out.memory.slice(0, 140)); if (st.notes.length > 12) st.notes.shift(); }
      const a = out.action;
      if (a && a.type === "commission" && CRAFTS[a.cat]) { const price = clamp(Math.round(+a.price || 40), 15, 180); const cm = { id: "n" + S.t + id, from: NPCS[id].name, npc: id, cat: a.cat, price, due: dayOf(S.t) + 3, note: String(a.note || "something you made").slice(0, 80) }; S.commissions.push(cm); st.hist.push({ r: "s", text: `Commission accepted: ${CRAFTS[a.cat].name.toLowerCase()} for ₵${price}, by Day ${cm.due}.` }); }
      if (a && a.type === "gift") { const cr = clamp(Math.round(+a.credits || 0), 0, 30); if (cr > 0) { pay(cr, "Gift from " + NPCS[id].name); st.hist.push({ r: "s", text: `${NPCS[id].name.split(" ")[0]} sends you ₵${cr}.` }); } }
      if (a && a.type === "end") st.hist.push({ r: "s", text: `${NPCS[id].name.split(" ")[0]} has to go.` });
    } else st.rel = clamp(st.rel + 1, -100, 100);
    if (c.anxiety && Math.random() < .3) st.hist.push({ r: "i", text: pick(THOUGHTS.anxiety) });
    if (st.hist.length > 30) st.hist.splice(0, st.hist.length - 30);
    speak(reply, id);
    drawChat();
    if (out && out.action && out.action.type === "end") setTimeout(() => { if (talking === id) closeDrawer(); }, 2200);
  }
  function endChat() {
    const id = talking; talking = null; if (abortCtl) { try { abortCtl.abort(); } catch (e) { } abortCtl = null; } busy = false;
    if (!id) return; if (S.char.cond.anxiety) S.stress = Math.max(0, S.stress - 3);
    if (S.char.cond.depression) smallWin();
    Sound.hush();
  }
  function speak(text, id) { Sound.speak(text, id); }

  /* ---------- Journal ---------- */
  let jTab = "you";
  function journal(tab) {
    if (tab) jTab = tab;
    const c = S.char, tabs = [["you", "You"], ["goals", "Goals"], ["people", "People"], ["log", "Log"], ["settings", "Settings"]];
    let body = `<div class="tabs">${tabs.map(([k, l]) => `<button data-jt="${k}" class="${jTab === k ? "on" : ""}">${l}</button>`).join("")}</div>`;
    if (jTab === "you") {
      const conds = Object.keys(c.cond).filter(k => c.cond[k]);
      body += `<div class="section"><h4>${esc(c.name)}, ${c.age} · ${esc(c.pron)}</h4><p class="note">${esc(BACKGROUNDS[c.bg].name)}. ${esc(BACKGROUNDS[c.bg].note)} Special interest: ${esc(INTERESTS[c.interest])}.</p></div>
      <div class="section"><h4>Living with</h4>${conds.length ? conds.map(k => `<div class="rowline"><span><b>${CONDITIONS[k].name}</b><br><span class="note">${CONDITIONS[k].desc}</span></span></div>`).join("") : '<p class="note">No conditions enabled.</p>'}${S.flags.meds ? `<p class="note">Daily medication: ${medsActive() ? "taken today" : "not taken yet today (bathroom)"}.</p>` : ""}</div>
      <div class="section"><h4>Right now</h4><p class="note">Mood ${Math.round(mood())}/100. Stress ${Math.round(S.stress)}. ${c.cond.pain ? "Pain " + Math.round(S.pain) + ". " : ""}${c.cond.autism ? "Sensory load " + Math.round(S.sensory) + ". " : ""}Food still digesting: ${Math.round(S.stomach)} kcal. Meals today: ${S.mealsToday}.</p>${S.moodlets.map(m => `<div class="rowline"><span>${esc(m.label)}</span><span class="r" style="color:${m.v >= 0 ? "var(--good)" : "var(--bad)"}">${m.v >= 0 ? "+" : ""}${m.v} · ${fmtDur(m.until - S.t)}</span></div>`).join("")}</div>`;
    } else if (jTab === "goals") {
      const done = GOALS.filter(g => S.goalsDone[g.id]).length;
      body += `<p class="note">${done} of ${GOALS.length} done. Nothing forces you to do any of these; they're ideas for a life.</p>` + GOALS.map(g => { const d = S.goalsDone[g.id]; return `<div class="rowline"><span style="${d ? "color:var(--good)" : ""}">${d ? "✓ " : ""}${esc(g.text)}<br><span class="note">${esc(g.hint)}</span></span><span class="r">${d ? "Day " + d : ""}</span></div>`; }).join("");
    } else if (jTab === "people") {
      body += Object.keys(NPCS).map(id => { const st = S.npcs[id], d = NPCS[id]; return `<div class="section"><h4>${esc(d.name)} · ${st.met ? relWord(st.rel) : "not met"}</h4><p class="note">${esc(d.role)}. ${d.loc === "station" ? "On Halcyon" : "In the plaza"}, ${d.hours[0] === 0 && d.hours[1] === 24 ? "always around" : `about ${d.hours[0]}:00–${d.hours[1]}:00`}.</p>${st.notes.length ? `<p class="note">They remember: ${st.notes.map(esc).join("; ")}</p>` : ""}</div>`; }).join("");
    } else if (jTab === "log") {
      body += S.log.slice().reverse().map(l => `<div class="rowline"><span>${esc(l.text)}</span><span class="r">D${dayOf(l.t)} ${fmtClock(l.t)}</span></div>`).join("") || '<p class="note">Nothing yet.</p>';
    } else {
      body += `<div class="section"><label class="cond"><input type="checkbox" id="setDeep" ${S.settings.deep ? "checked" : ""}><span><b>Deeper conversations</b><span>Uses a stronger model for people you talk to. Richer replies, a few seconds slower.</span></span></label>
      <label class="cond"><input type="checkbox" id="setSound" ${S.settings.sound !== false ? "checked" : ""}><span><b>Sound</b><span>Ambience, footsteps, effects. M toggles.</span></span></label>
      <label class="cond"><input type="checkbox" id="setMusic" ${S.settings.music !== false ? "checked" : ""}><span><b>Background music</b><span>A quiet pad that follows the time of day.</span></span></label>
      <label class="cond"><input type="checkbox" id="setVoice" ${S.settings.voice ? "checked" : ""}><span><b>Spoken voices</b><span>People speak their replies aloud (women and men get different voices; robots sound like robots). If your device has no voices, they murmur instead.</span></span></label>
      <div class="field" style="margin-top:8px"><label for="setVol">Volume</label><input type="range" id="setVol" min="0" max="1" step=".05" value="${S.settings.vol ?? .8}" style="width:100%;accent-color:var(--amber)"></div>
      <label class="cond"><input type="checkbox" id="setKeys" ${S.settings.keys ? "checked" : ""}><span><b>Show key guide</b><span>Also toggled with /.</span></span></label></div>
      <div class="section"><h4>Conversations</h4><p class="note">${AI.provider === "claude" ? "Live: people answer through Claude, using your own Claude usage. The first message asks your permission." : AI.provider === "custom" ? "Live: people answer through the model you connected below." : "No AI connected: people give short built-in replies."}</p>
      ${AI.provider !== "claude" ? `<details style="margin-top:8px"><summary class="note" style="cursor:pointer">Connect your own AI model</summary><p class="note">The key stays in this browser only and is sent straight to the endpoint you enter. Calls cost whatever your provider charges.</p>
      <div class="field"><label for="aiFmt">API style</label><select id="aiFmt"><option value="openai">OpenAI-compatible (chat/completions)</option><option value="anthropic">Anthropic (messages)</option></select></div>
      <div class="field"><label for="aiUrl">Endpoint URL</label><input type="text" id="aiUrl" placeholder="https://api.openai.com/v1/chat/completions"></div>
      <div class="field"><label for="aiModel">Model</label><input type="text" id="aiModel" placeholder="model name"></div>
      <div class="field"><label for="aiKey">API key</label><input type="text" id="aiKey" placeholder="optional for local models" autocomplete="off"></div>
      <button class="btn primary" id="aiSave">Save</button> <button class="btn" id="aiClear">Disconnect</button></details>` : ""}</div>
      <div class="section"><h4>Saving</h4><p class="note">${Cloud.state === "ok" ? "Your life saves to your Claude account automatically, so it continues on any device where you open this page." : "Saving on this device only (account saving isn't available in this view)."}</p></div>
      <div class="section"><h4>Lives</h4><p class="note">This life is saved. You can keep several lives and switch between them.</p><button class="btn" id="editChar">Edit character</button> <button class="btn" id="switchLife">Switch or start a life</button></div>`;
    }
    openDrawer("journal", "Journal", fmtDate(S.t), body, () => {
      drawer.querySelectorAll("[data-jt]").forEach(b => b.onclick = () => journal(b.dataset.jt));
      const dp = $("#setDeep"); if (dp) { dp.onchange = () => S.settings.deep = dp.checked;
        $("#setSound").onchange = e => S.settings.sound = e.target.checked; $("#setMusic").onchange = e => S.settings.music = e.target.checked; $("#setVol").oninput = e => S.settings.vol = +e.target.value; $("#setVoice").onchange = e => S.settings.voice = e.target.checked; $("#setKeys").onchange = e => { S.settings.keys = e.target.checked; $("#keys").classList.toggle("hidden", !S.settings.keys); };
        $("#editChar").onclick = () => { save(true); Game.creator({ edit: true }); };
        $("#switchLife").onclick = () => { save(true); closeDrawer(); Game.creator(); };
        const af = $("#aiFmt"); if (af) { const c = AI.config() || {}; af.value = c.format || "openai"; $("#aiUrl").value = c.endpoint || ""; $("#aiModel").value = c.model || ""; $("#aiKey").value = c.key || "";
          $("#aiSave").onclick = () => { AI.setConfig({ format: af.value, endpoint: $("#aiUrl").value.trim(), model: $("#aiModel").value.trim(), key: $("#aiKey").value.trim() }); toast(AI.provider === "custom" ? "Model connected." : "Add an endpoint and model name.", AI.provider === "custom" ? "good" : "bad"); journal("settings"); };
          $("#aiClear").onclick = () => { AI.setConfig(null); toast("Disconnected.", "info"); journal("settings"); }; } }
    });
  }
  function locChanged() { renderHud(true); save(true); }
  let savedWhere = "";
  function saved(where) { savedWhere = where; const el = $("#hSave"); if (el) { el.textContent = where === "account" ? "Saved to your account" : "Saved on this device"; el.style.opacity = 1; setTimeout(() => el.style.opacity = .45, 1500); } }
  function adopt() {
    const r = mulberry(Math.floor(dayOf(S.t) / 7) + 11), NAMES = ["Biscuit", "Nova", "Pixel", "Mochi", "Juniper", "Tofu", "Comet", "Sprocket", "Pepper", "Orbit"], COL = [["#d8893d", "ginger"], ["#2b2b2b", "black"], ["#8f9396", "grey"], ["#e9e2d6", "cream"], ["#6e5338", "brown tabby"]], TEMP = { shy: "Shy, takes time, then devoted", cuddly: "Cuddly, lap-seeking, purrs at nothing", chaotic: "Chaotic, knocks things off shelves, very funny" };
    const cats = [0, 1, 2].map(i => { const col = COL[Math.floor(r() * COL.length)]; return { name: NAMES[Math.floor(r() * NAMES.length)], color: col[0], colName: col[1], temper: Object.keys(TEMP)[i] }; });
    openDrawer("adopt", "Paws & Circuits", "Three cats looking for a home this week. Adoption ₵40, includes three meals of food.", cats.map((c, i) => `<div class="section"><h4><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.color};vertical-align:middle;margin-right:6px"></span>${esc(c.name)} · ${c.colName}</h4><p class="note">${TEMP[c.temper]}.</p><div style="display:flex;gap:8px"><input type="text" id="cn${i}" value="${esc(c.name)}" maxlength="16" aria-label="Name" style="flex:1;min-width:0;border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:10px;padding:8px;font:inherit"><button class="btn primary" data-ad="${i}">Adopt</button></div></div>`).join("") + '<p class="note">A cat needs feeding once a day at your kitchen (cat food from the automat). It won\'t die if you forget, but it will let you know, loudly, and sulk.</p>',
      () => drawer.querySelectorAll("[data-ad]").forEach(b => b.onclick = () => { if (!canAfford(40)) return toast("Adoption costs ₵40.", "bad"); const c = cats[+b.dataset.ad]; const name = ($("#cn" + b.dataset.ad).value.trim() || c.name).slice(0, 16); pay(-40, "Cat adoption: " + name); S.cat = { name, color: c.color, temper: c.temper, fedDay: dayOf(S.t), love: 50 }; S.inv.catfood += 3; closeDrawer(); logEv(`${name} comes home with you. They'll be waiting in the flat.`, "good"); addMoodlet("adopted", "Adopted " + name, 12, 48); Sound.meow(); }));
  }

  return { toast, thought, activity, hand, blocking, talkingTo, renderHud, tags, interact, choose, menuClose, get menuOpen() { return menuOpen; }, get drawerKind() { return drawerKind; },
    closeDrawer, things, shop, board, weave, terminal, journal, locChanged, saved, adopt, setTab(v) { tabHeld = v; renderHud(true); } };
})();

/* ============================================================
   GAME — creator, input, loop
   ============================================================ */
const Game = (() => {
  let running = false, acc = 0, last = performance.now(), saveAcc = 0, rainAcc = 0, goalAcc = 0, cloudReady = Promise.resolve();
  /* Character creator. opts.edit = change the current character instead of starting a new life. */
  function creator(opts = {}) {
    const edit = !!opts.edit && S && S.char && S.char.name !== "You";
    running = false; $("#hud").hidden = true; UI.closeDrawer(); document.body.classList.remove("playing"); $("#quick").hidden = true;
    const base = { name: "", age: 38, pron: "they/them", skin: SKIN[2], hair: HAIR[1], outfit: OUTFIT[0], lower: LOWER[0], build: "average", bg: "drifter", interest: "orbital", cond: {}, meds: false,
      look: { body: "Rogue", head: "Rogue", extra: "none", height: 1, shoe: "#3b2f28" } };
    const ch = edit ? JSON.parse(JSON.stringify(Object.assign({}, base, S.char))) : base;
    if (!ch.look) ch.look = People.lookFromChar(ch), ch.look = { body: ch.look.body, head: ch.look.head, extra: ch.look.extra, height: 1, shoe: "#3b2f28" };
    if (edit) ch.meds = !!S.flags.meds;
    const keepS = edit ? S : null;
    if (!edit) { S = freshState({ ...ch, name: "You" }); S.settings = { deep: false, voice: true, keys: true, sound: true, music: true, vol: .8 }; World.setLoc("home", { x: 2.6, z: -1.2 }); S.rot = Math.PI * .85; S.t = 10 * 60; }
    let lives = [], livesState = edit ? "skip" : "loading", confirmDel = null;
    const el = $("#creator"); el.hidden = false;
    const sw = (arr, key, sub) => `<div class="swatches">${arr.map(c => `<button class="sw${(sub ? ch.look[key] : ch[key]) === c ? " on" : ""}" style="background:${c}" data-sw="${key}" data-sub="${sub ? 1 : ""}" data-c="${c}" aria-label="${key} ${c}"></button>`).join("")}</div>`;
    const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${v}</option>`).join("");
    const sync = () => { const tgt = edit ? keepS.char : S.char; Object.assign(tgt, { skin: ch.skin, hair: ch.hair, outfit: ch.outfit, lower: ch.lower, build: ch.build, look: JSON.parse(JSON.stringify(ch.look)) }); World.restyle(); };
    const livesHtml = () => {
      if (livesState === "skip") return "";
      if (livesState === "loading") return '<p class="note">Looking for saved lives…</p>';
      if (!lives.length) return "";
      return `<div class="field"><span class="lbl">Your lives</span>${lives.map(l => `<div class="rowline"><span>${esc(l.name)} · Day ${l.day}<br><span class="note">${l.where === "account" ? "Saved to your account" : "Saved on this device"}</span></span><span style="display:flex;gap:6px">${confirmDel === l.key ? `<button class="btn" data-del-yes="${esc(l.key)}">Delete for good</button><button class="btn" data-del-no="1">Keep</button>` : `<button class="btn" data-del="${esc(l.key)}" aria-label="Delete ${esc(l.name)}">Delete</button><button class="btn primary" data-load="${esc(l.key)}">Play</button>`}</span></div>`).join("")}</div><p class="note" style="margin:-6px 0 16px">Or make someone new below.</p>`;
    };
    const render = () => {
      el.innerHTML = `<div class="scroll"><h1>Lumen <i>Reach</i></h1>${edit ? '<p class="lede">Change how you look, your name, or what you live with. Your life carries on where you left it.</p>' : `<p class="lede">A small town on Earth in 2147, a ring station overhead, a friend on Mars. Robots do most of the work and basic income covers the basics. What's left is the living: eating at a table, making things with your hands, and the people you talk to.</p>`}
      ${livesHtml()}
      <div class="field"><label for="cName">Name</label><input type="text" id="cName" value="${esc(ch.name)}" placeholder="Who are you?" maxlength="28"></div>
      <div class="two"><div class="field"><label for="cAge">Age · ${ch.age}</label><input type="range" id="cAge" min="18" max="85" value="${ch.age}" style="width:100%;accent-color:var(--amber)"></div>
      <div class="field"><label for="cPron">Pronouns</label><select id="cPron">${["he/him", "she/her", "they/them"].map(p => `<option ${ch.pron === p ? "selected" : ""}>${p}</option>`).join("")}</select></div></div>
      <div class="two"><div class="field"><label for="cHead">Face & hair</label><select id="cHead">${opt(People.HEADS, ch.look.head)}</select></div>
      <div class="field"><label for="cExtra">Hair extra</label><select id="cExtra">${opt(People.EXTRAS, ch.look.extra)}</select></div></div>
      <div class="two"><div class="field"><label for="cBody">Outfit</label><select id="cBody">${opt(People.OUTFITS, ch.look.body)}</select></div>
      <div class="field"><label for="cBuild">Build</label><select id="cBuild">${["slight", "average", "broad"].map(p => `<option ${ch.build === p ? "selected" : ""}>${p}</option>`).join("")}</select></div></div>
      <div class="field"><label for="cHeight">Height · ${Math.round(ch.look.height * 170)} cm</label><input type="range" id="cHeight" min=".9" max="1.1" step=".01" value="${ch.look.height}" style="width:100%;accent-color:var(--amber)"></div>
      <div class="field"><span class="lbl">Skin</span>${sw(SKIN, "skin")}</div>
      <div class="field"><span class="lbl">Hair</span>${sw(HAIR, "hair")}</div>
      <div class="field"><span class="lbl">Top</span>${sw(OUTFIT, "outfit")}</div>
      <div class="field"><span class="lbl">Bottoms</span>${sw(LOWER, "lower")}</div>
      <div class="field"><span class="lbl">Shoes</span>${sw(["#3b2f28", "#1d1d1d", "#e8e8e6", "#7a4a2a", "#4c6b80", "#8b4d57"], "shoe", true)}</div>
      <div class="two"><div class="field"><label for="cInt">Special interest</label><select id="cInt">${opt(INTERESTS, ch.interest)}</select></div>
      <div class="field"><label for="cBg">Background</label><select id="cBg" ${edit ? "disabled" : ""}>${Object.entries(BACKGROUNDS).map(([k, v]) => `<option value="${k}" ${ch.bg === k ? "selected" : ""}>${v.name}</option>`).join("")}</select></div></div>
      <p class="note" style="margin:-8px 0 16px">${esc(BACKGROUNDS[ch.bg].note)}</p>
      <div class="field"><span class="lbl">Real-world conditions (optional)</span>${Object.entries(CONDITIONS).map(([k, v]) => `<label class="cond"><input type="checkbox" data-cond="${k}" ${ch.cond[k] ? "checked" : ""}><span><b>${v.name}</b><span>${v.desc}</span></span></label>`).join("")}
      ${ch.cond.adhd || ch.cond.depression || ch.cond.anxiety ? `<label class="cond"><input type="checkbox" id="cMeds" ${ch.meds ? "checked" : ""}><span><b>Takes daily medication</b><span>A small daily task at the bathroom cabinet. Softens ADHD drift, depression's inertia and anxiety's baseline. Forget it and you'll feel the difference.</span></span></label>` : ""}</div>
      </div><footer>${edit ? '<button class="btn" id="cCancel">Cancel</button>' : '<span class="note">Your character is shown behind this panel.</span>'}<button class="btn primary" id="cGo">${edit ? "Save changes" : "Begin this life"}</button></footer>`;
      el.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { if (b.dataset.sub) ch.look[b.dataset.sw] = b.dataset.c; else ch[b.dataset.sw] = b.dataset.c; sync(); render(); });
      $("#cName").oninput = e => ch.name = e.target.value;
      $("#cAge").oninput = e => { ch.age = +e.target.value; e.target.previousElementSibling.textContent = "Age · " + ch.age; };
      $("#cPron").onchange = e => ch.pron = e.target.value;
      $("#cHead").onchange = e => { ch.look.head = e.target.value; sync(); };
      $("#cExtra").onchange = e => { ch.look.extra = e.target.value; sync(); };
      $("#cBody").onchange = e => { ch.look.body = e.target.value; sync(); };
      $("#cBuild").onchange = e => { ch.build = e.target.value; sync(); };
      $("#cHeight").oninput = e => { ch.look.height = +e.target.value; e.target.previousElementSibling.textContent = "Height · " + Math.round(ch.look.height * 170) + " cm"; sync(); };
      $("#cInt").onchange = e => ch.interest = e.target.value;
      $("#cBg").onchange = e => { ch.bg = e.target.value; render(); };
      el.querySelectorAll("[data-cond]").forEach(b => b.onchange = () => { ch.cond[b.dataset.cond] = b.checked; render(); });
      const m = $("#cMeds"); if (m) m.onchange = () => ch.meds = m.checked;
      el.querySelectorAll("[data-load]").forEach(b => b.onclick = async () => { b.disabled = true; const o = await loadLife(lives.find(l => l.key === b.dataset.load)); if (o) resume(o); else { b.disabled = false; UI.toast("That save couldn't be read.", "bad"); } });
      el.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { confirmDel = b.dataset.del; render(); });
      el.querySelectorAll("[data-del-no]").forEach(b => b.onclick = () => { confirmDel = null; render(); });
      el.querySelectorAll("[data-del-yes]").forEach(b => b.onclick = async () => { const l = lives.find(x => x.key === b.dataset.delYes); await deleteLife(l); lives = lives.filter(x => x !== l); confirmDel = null; render(); });
      if (edit) $("#cCancel").onclick = () => { S = keepS; Object.assign(S.char, JSON.parse(JSON.stringify(opts.orig))); begin(); };
      $("#cGo").onclick = () => {
        if (edit) {
          S = keepS; Object.assign(S.char, { name: ch.name.trim() || S.char.name, age: ch.age, pron: ch.pron, skin: ch.skin, hair: ch.hair, outfit: ch.outfit, lower: ch.lower, build: ch.build, look: ch.look, interest: ch.interest, cond: ch.cond });
          S.flags.meds = !!ch.meds && !!(ch.cond.adhd || ch.cond.depression || ch.cond.anxiety);
          begin(); UI.toast("Changes saved.", "good");
        } else start({ ...ch, name: ch.name.trim() || "Sam" });
      };
    };
    if (edit) opts.orig = JSON.parse(JSON.stringify(keepS.char));
    sync(); render();
    if (!edit) cloudReady.then(() => listLives()).then(l => { lives = l; livesState = "ok"; if (!$("#creator").hidden && !running) render(); });
  }
  function start(ch) {
    const settings = S.settings;
    S = freshState(ch); S.settings = settings; S.flags.lastDayProcessed = 1; S.flags.meds = !!ch.meds && !!(ch.cond.adhd || ch.cond.depression || ch.cond.anxiety);
    S.weather = weatherFor(1); makeBoard();
    begin();
    logEv(`Day 1. ${ch.name}, ${ch.age}. Your flat in Linden Court, 9 on a Monday morning in October. You haven't had breakfast. The fabricator's ready, the fridge has groceries, and Rin wrote from Mars overnight.`, "info");
    setTimeout(() => UI.toast(TOUCH ? "Drag on the left side to walk, drag on the right to look around. Tap E near things and people." : "Walk with WASD. Press E near things and people. Your desk terminal has Rin's message.", "info"), 1600);
  }
  function resume(o) { S = o; begin(); UI.toast(`Welcome back, ${S.char.name}. ${fmtDate(S.t)}, ${fmtClock(S.t)}.`, "info"); }
  function begin() {
    $("#creator").hidden = true; $("#hud").hidden = false; document.body.classList.add("playing");
    $("#keys").classList.toggle("hidden", !S.settings.keys);
    World.restyle(); World.setLoc(S.loc, S.pos);
    UI.hand(); UI.activity(); UI.renderHud(true);
    running = true; save();
  }
  function tickRain() {
    if (S.loc === "plaza" && S.weather === "rain" && !(Act.cur && /therapy|quiet|travel|shuttle/.test(Act.cur.id))) { S.flags.rainMin = (S.flags.rainMin || 0) + 1; if (S.flags.rainMin === 12) { addMoodlet("soaked", "Soaked through", -5, 3); logEv("You're getting soaked. (Your weave can dry you: N.)", "info"); } }
    else if (S.loc !== "plaza") S.flags.rainMin = 0;
  }
  function frame() {
    const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
    let steps = 0;
    if (running && S) {
      const chatting = UI.drawerKind === "chat" || !!UI.menuOpen;
      let rate = S.speed * .5; if (Act.cur && S.speed > 0) rate = Math.max(rate, Act.cur.ff || 8);
      if (chatting) rate = 0;
      acc += dt * rate;
      while (acc >= 1 && steps < 240) { acc -= 1; steps++; stepMinute(); Act.tick(); tickRain(); }
      if (steps) { saveAcc += steps; goalAcc += steps; if (saveAcc >= 30) { saveAcc = 0; save(); } if (goalAcc >= 20) { goalAcc = 0; checkGoals(); } }
      UI.renderHud();
    }
    if (S) World.update(dt, steps);
    requestAnimationFrame(frame);
  }
  function onKey(e, down) {
    const tag = (e.target && e.target.tagName) || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    if (typing && e.key !== "Escape") return;
    World.keys[e.code] = down;
    if (!down || !running) { if (!down && e.code === "Tab") UI.setTab(false); return; }
    if (["Space", "Tab", "ArrowUp", "ArrowDown"].includes(e.code) && !typing) e.preventDefault();
    if (e.code === "Escape") { if (UI.menuOpen) return UI.menuClose(); if (UI.drawerKind) return UI.closeDrawer(); if (Act.cur) return Act.cancel(); return; }
    if (UI.menuOpen) { const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) UI.choose(n - 1); if (e.code === "KeyE") UI.menuClose(); return; }
    if (UI.drawerKind) { if (e.code === "KeyI" && UI.drawerKind === "things" || e.code === "KeyJ" && UI.drawerKind === "journal" || e.code === "KeyN" && UI.drawerKind === "weave") UI.closeDrawer(); return; }
    switch (e.code) {
      case "KeyE": UI.interact(); break;
      case "KeyI": UI.things(); break;
      case "KeyJ": UI.journal(); break;
      case "KeyN": UI.weave(); break;
      case "KeyB": if (!Act.cur) breathe(); break;
      case "KeyH": if (!S.inv.earbuds) UI.toast("No earbuds. The automat in the plaza sells noise-cancelling ones.", "info"); else { S.flags.earbuds = !S.flags.earbuds; UI.toast(S.flags.earbuds ? "Earbuds in. The world goes soft at the edges." : "Earbuds out.", "info"); } break;
      case "KeyL": if (S.loc === "home") { S.flags.light = !S.flags.light; UI.toast(S.flags.light ? "Lights on." : "Lights off.", "info"); } break;
      case "Tab": UI.setTab(true); break;
      case "KeyM": S.settings.sound = S.settings.sound === false; UI.toast(S.settings.sound ? "Sound on." : "Sound muted.", "info"); break;
      case "KeyR": UI.toast(World.toggleRun() ? "Running on (R to walk)." : "Walking.", "info"); break;
      case "Slash": S.settings.keys = !S.settings.keys; $("#keys").classList.toggle("hidden", !S.settings.keys); break;
      case "Space": S.speed = S.speed === 0 ? (S.lastSpeed || 1) : (S.lastSpeed = S.speed, 0); break;
      case "Digit1": S.speed = 1; break; case "Digit2": S.speed = 3; break; case "Digit3": S.speed = 10; break;
    }
    UI.renderHud(true);
  }
  async function boot() {
    const ld = $("#loading");
    try { await People.load(p => { if (ld) ld.textContent = `Waking the town… ${Math.round(p * 100)}%`; }); }
    catch (e) { console.error(e); if (ld) ld.textContent = "The character models couldn't load. If you opened index.html straight from disk, serve the folder instead (see README)."; return; }
    World.init($("#stage"));
    ld && ld.remove();
    if (TOUCH) document.body.classList.add("touch");
    const unlock = () => Sound.init();
    document.addEventListener("pointerdown", unlock); document.addEventListener("keydown", unlock);
    cloudReady = Cloud.init();
    document.addEventListener("keydown", e => onKey(e, true));
    document.addEventListener("keyup", e => onKey(e, false));
    window.addEventListener("blur", () => { for (const k in World.keys) World.keys[k] = false; World.setMove(0, 0); UI.setTab(false); });
    $("#speeds").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { S.speed = +b.dataset.sp; UI.renderHud(true); } });
    $("#prompt").addEventListener("click", () => UI.interact());
    $("#needs").addEventListener("click", () => $("#needs").classList.toggle("open"));
    touchControls();
    document.addEventListener("visibilitychange", () => { if (document.hidden && running) save(true); });
    window.addEventListener("pagehide", () => { if (running) save(true); });
    AI.init();
    creator();
    requestAnimationFrame(frame);
  }
  /* Touch: drag on the left half to walk (virtual stick), drag on the right half to look, pinch to zoom */
  function touchControls() {
    const stage = $("#stage"), joy = $("#joy"), knob = joy.querySelector("i"), pts = new Map(); let stick = null, pinch = 0;
    stage.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, side: e.clientX < innerWidth * .45 ? "move" : "look" });
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); if (stick) { stick = null; joy.hidden = true; World.setMove(0, 0); } return; }
      if (pts.get(e.pointerId).side === "move" && !stick) { stick = { id: e.pointerId, x: e.clientX, y: e.clientY }; joy.style.left = e.clientX + "px"; joy.style.top = e.clientY + "px"; knob.style.transform = ""; joy.hidden = false; }
    });
    stage.addEventListener("pointermove", e => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; p.x = e.clientX; p.y = e.clientY; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) World.zoom(pinch / Math.max(20, d)); pinch = d; return; }
      if (stick && stick.id === e.pointerId) {
        let dx = e.clientX - stick.x, dy = e.clientY - stick.y; const l = Math.hypot(dx, dy), R = 50;
        if (l > R) { dx *= R / l; dy *= R / l; }
        knob.style.transform = `translate(${dx}px,${dy}px)`; World.setMove(dx / R, dy / R);
      } else if (p.side === "look") { World.look(e.clientX - p.x, e.clientY - p.y); }
      p.x = e.clientX; p.y = e.clientY;
    });
    const end = e => { pts.delete(e.pointerId); if (stick && stick.id === e.pointerId) { stick = null; joy.hidden = true; World.setMove(0, 0); } if (pts.size < 2) pinch = 0; };
    for (const ev of ["pointerup", "pointercancel", "pointerleave"]) stage.addEventListener(ev, end);
    $("#touchE").onclick = () => { if (UI.menuOpen) UI.menuClose(); else UI.interact(); };
    $("#touchRun").onclick = () => { const r = World.toggleRun(); $("#touchRun").classList.toggle("on", r); };
    const quick = $("#quick");
    $("#touchMenu").onclick = () => { quick.hidden = !quick.hidden; };
    quick.addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return; quick.hidden = true;
      const q = b.dataset.q;
      if (q === "things") UI.things(); else if (q === "journal") UI.journal(); else if (q === "weave") UI.weave();
      else if (q === "breathe") { if (!Act.cur) breathe(); }
      else if (q === "earbuds") onKey({ code: "KeyH", key: "h", target: document.body, preventDefault() { } }, true);
      else if (q === "lights") onKey({ code: "KeyL", key: "l", target: document.body, preventDefault() { } }, true);
      else if (q === "body") { UI.setTab(true); $("#needs").classList.add("open"); setTimeout(() => UI.setTab(false), 6000); }
    });
  }
  return { boot, creator };
})();

window.addEventListener("load", () => {
  if (!window.THREE) { $("#loading").textContent = "The 3D engine couldn't load. Check your connection and reload."; return; }
  Game.boot().catch(e => { console.error(e); $("#loading") && ($("#loading").textContent = "Something went wrong starting the town."); });
});
