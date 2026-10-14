/* ============================================================
   ACTIONS — what you can do at each object
   ============================================================ */
function A(label, meta, desc, run, disabled = null) { return { label, meta, desc, run, disabled }; }
const today = () => dayOf(S.t);
const handFree = () => S.hand ? "Your hands are full" : null;

function travel(to, min, name, spawn, rot = 0, extra = {}) {
  Act.start(Object.assign({ id: "travel", name, min, posture: "stand", ff: 10, hide: true, done: () => { World.setLoc(to, spawn); S.rot = rot; UI.locChanged(); if (extra.arrive) extra.arrive(); } }, extra));
}
function nextDeparture(oddHours) {
  const m = S.t % DAY, h = Math.floor(m / 60);
  for (let hh = h; hh < h + 30; hh++) { const H = ((hh % 24) + 24) % 24; if (H < 7 || H > 21) continue; if ((H % 2 === 1) !== !!oddHours) continue; const at = hh * 60; if (at >= m) return at - m; }
  return 600;
}
function shuttle(toStation) {
  const wait = nextDeparture(!toStation);
  if (wait > 15) {
    const at = fmtClock(S.t + wait);
    Act.start({ id: "gate", name: `Waiting at the gate for the ${at} departure`, min: wait, posture: "sit", ff: 20, tick: () => { S.needs.fun -= .02; }, done: () => board(toStation, 0) });
    UI.toast(`Next departure ${at}. You can stop waiting any time (Esc) and come back.`, "info");
    return;
  }
  board(toStation, wait);
}
function board(toStation, wait) {
  if (!canAfford(30)) return UI.toast("A seat costs ₵30. Not enough in your account.", "bad");
  pay(-30, toStation ? "Shuttle ticket · Lumen Reach → Halcyon" : "Shuttle ticket · Halcyon → Lumen Reach");
  const total = wait + 160; let said = {};
  Act.start({
    id: "shuttle", name: toStation ? "Shuttle to Halcyon" : "Shuttle home", min: total, posture: "sit", ff: 30, loud: true, hide: true, selfCare: true,
    tick: a => {
      const e = a.elapsed - wait;
      if (e === 0 && !said.a) { said.a = 1; logEv(toStation ? "Boarding. The launch loop catapults you east; three gees press you into the seat for ninety seconds." : "Undocking. The shuttle drops behind Halcyon to lower its orbit, then waits for the deorbit window.", "info"); }
      if (e === 9 && !said.b) { said.b = 1; logEv(toStation ? "Main engine cutoff at 7.8 km/s. You're weightless. Your stomach takes a minute to agree." : "Deorbit burn. A long fall begins; the heat shield will glow orange in twenty minutes.", "info"); if (S.char.cond.anxiety) S.stress += 8; }
      if (e === 110 && !said.c) { said.c = 1; logEv(toStation ? "Phasing orbit. Halcyon is a bright dot catching up from below; two more burns to match it." : "Reentry plasma flickers past the window. Then sky, then clouds.", "info"); }
      if (e > 0) { S.needs.fun += .03; if (S.char.cond.autism) S.sensory += .06; }
    },
    done: () => {
      if (toStation) { World.setLoc("station", { x: 11, z: -2.6 }); S.rot = -Math.PI / 2; logEv("Docked. You step into Halcyon's ring: 224 m radius, two turns a minute, close enough to one g that your knees don't notice.", "good"); }
      else { World.setLoc("plaza", { x: 0, z: -15.2 }); S.rot = 0; logEv("Back on the ground in Lumen Reach. Gravity feels heavier for a few minutes, though it isn't.", "info"); }
      UI.locChanged(); addMoodlet("trip", toStation ? "Went to space today" : "Came home from orbit", 6, 10);
    },
    partial: a => { if (a.elapsed < wait) { pay(30, "Shuttle ticket refund"); UI.toast("You left the queue. Ticket refunded.", "info"); } }
  });
}

function sleepAction(until7) {
  let min; if (until7) { const m = S.t % DAY; min = (m < 7 * 60 ? 7 * 60 - m : DAY - m + 7 * 60); } else min = 480;
  let onset = S.char.cond.insomnia ? Math.round(rnd(25, 85) + S.stress * .4) : Math.round(10 + S.stress * .15);
  if (S.char.cond.insomnia && S.flags.lateScreen === today()) onset += 30;
  const start = S.t;
  Act.start({
    id: "sleep", name: "Sleeping", min, posture: "lie", anchor: World.anchorFor("bed"), ff: 60,
    tick: a => { const asleepNow = a.elapsed >= onset; S.asleep = asleepNow; a.name = asleepNow ? "Asleep" : "Lying awake…"; },
    done: a => {
      S.asleep = false; const slept = (S.t - start - onset) / 60;
      if (slept >= 7 && !S.char.cond.insomnia) addMoodlet("sleep", "Well rested", 7, 10);
      else if (slept >= 6.5) addMoodlet("sleep", "Slept okay", 3, 8);
      else addMoodlet("sleep", "Not enough sleep", -7, 12);
      if (S.char.cond.insomnia && onset > 50) logEv(`It took about ${fmtDur(onset)} to fall asleep.`, "info");
      logEv(`You wake at ${fmtClock(S.t)}.`, "info", false); S.flags.lastWake = S.t;
    },
    partial: a => { S.asleep = false; const slept = (a.elapsed - onset) / 60; if (slept > 1) addMoodlet("sleep", "Woke up early", -3, 6); }
  });
}

function getActions(id) {
  const n = S.needs, c = S.char.cond, h = hourOf(S.t), out = [];
  const meal = S.hand && S.hand.kind === "meal";
  switch (id) {
    /* ---------- HOME ---------- */
    case "bed": {
      const night = h >= 19 || h < 5;
      out.push(A(night ? "Go to sleep" : "Sleep 8 hours", night ? "until 07:00" : "8h", c.insomnia ? "Sleep may take a while to come." : "The induction mattress also recharges your weave.", () => sleepAction(night), meal ? "Put the food down first" : null));
      out.push(A("Nap", "30m", "Takes the edge off. Too long and you'll feel worse.", () => Act.start({ id: "nap", name: "Napping", min: 30, posture: "lie", anchor: World.anchorFor("bed"), ff: 20, sleep: true, done: () => addMoodlet("nap", "Short nap", 2, 3) }), meal ? "Put the food down first" : null));
      out.push(A("Lie down and rest", "20m", "Off your feet. Good for pain and for when everything's a lot.", () => Act.start({ id: "rest", name: "Resting", min: 20, posture: "lie", anchor: World.anchorFor("bed"), tick: () => { S.stress -= .25; S.sensory -= .8; } }), meal ? "Put the food down first" : null));
      break;
    }
    case "window": {
      const day = sunElev(S.t) > 0;
      out.push(A("Look outside", "3m", day ? (S.weather === "rain" ? "Rain on the glass, drones flying low." : "Sky over the rooftops.") : "City lights and a few stars.", () => Act.start({ id: "look", name: "Looking outside", min: 3, posture: "stand", done: () => { smallWin("Looked outside"); if (day && S.weather === "clear") addMoodlet("sky", "Saw the sky", 3, 4); else if (S.weather === "rain") addMoodlet("sky", "Watched the rain", 3, 4); } })));
      out.push(A(S.flags.windowOpen ? "Close the window" : "Open the window", "1m", S.flags.windowOpen ? "Quieter in here." : "Fresh air. More street noise too.", () => { S.flags.windowOpen = !S.flags.windowOpen; if (S.flags.windowOpen) { smallWin(); addMoodlet("air", "Fresh air", 2, 3); } UI.toast(S.flags.windowOpen ? "Window open. You can hear the plaza." : "Window closed.", "info"); }));
      break;
    }
    case "plant": out.push(A("Water the pothos", "2m", S.flags.plant > 85 ? "Soil's still damp." : "It perks up within the hour.", () => Act.start({ id: "water", name: "Watering the plant", min: 2, done: () => { S.flags.plant = 100; smallWin("Looked after the plant"); } }), S.flags.plant > 85 ? "Doesn't need water yet" : null)); break;
    case "desk": {
      out.push(A("Use the terminal", "", "Messages, money, deliveries, skills.", () => UI.terminal()));
      out.push(A("Human-review gig work", "1h · +₵12", "Rating AI design drafts where a human's taste is the point. Dull but honest pay.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "gig", name: "Reviewing design drafts", min: 60, posture: "sit", anchor: World.anchorFor("desk"), adhdDrift: true, drain: 1.5, tick: () => { S.needs.fun -= .1; }, done: a => { const pay_ = a.hyper ? 16 : 12; pay(pay_, "Gig: human design review"); logEv(`Gig done. +₵${pay_}.`, "good"); }, partial: a => { const p = Math.round(a.elapsed / 60 * 12); if (p > 0) pay(p, "Gig: partial review"); } }); }));
      out.push(A("Write a song", "1h", "Adds to your busking set. Music skill " + Math.round(S.skills.music * 100) + "%.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "song", name: "Writing a song", min: 60, posture: "sit", anchor: World.anchorFor("desk"), adhdDrift: true, tick: () => { S.needs.fun += .1; }, done: () => { S.songs++; S.skills.music = Math.min(1, S.skills.music + .05 * (1 - S.skills.music) * (S.char.interest === "music" ? 1.5 : 1)); logEv(`You wrote a song. Your set is ${S.songs} song${S.songs > 1 ? "s" : ""} long.`, "good"); addMoodlet("made", "Made something", 6, 6); } }); }));
      out.push(A("Study craft technique", "1h", "Online masterclass by a human potter, carver or binder.", () => { const b = startBlocked(1); if (b) return UI.toast(b, "bad"); Act.start({ id: "study", name: "Studying technique", min: 60, posture: "sit", anchor: World.anchorFor("desk"), adhdDrift: true, done: () => { for (const k of ["ceramic", "wood", "bread", "journal"]) S.skills[k] = Math.min(1, S.skills[k] + .012); if (S.skills[S.char.interest] != null) S.skills[S.char.interest] = Math.min(1, S.skills[S.char.interest] + .02); logEv("You learned something small and real.", "good"); } }); }));
      if (h >= 22 || h < 4) out.push(A("Doomscroll the feeds", "30m", "You know how this goes.", () => Act.start({ id: "scroll", name: "Scrolling", min: 30, posture: "sit", anchor: World.anchorFor("desk"), tick: () => { S.needs.fun += .1; S.stress += .05; }, done: () => { S.flags.lateScreen = today(); addMoodlet("scroll", "Scrolled too late", -3, 6); } })));
      break;
    }
    case "kitchen": {
      if (meal) {
        out.push(A("Eat standing at the counter", "8m", "Fast. It never feels like a real meal.", () => eat("counter")));
        out.push(A("Put it in the fridge", "1m", "Keeps for three days.", () => { S.fridge.push(S.hand); S.hand = null; UI.hand(); UI.toast("Saved for later.", "info"); }));
      }
      out.push(A("Print a meal with the fabricator", "6m · ₵4", "Nutritionally complete, texturally fine, emotionally beige.", () => { if (!canAfford(4)) return UI.toast("Not enough credits for feedstock.", "bad"); pay(-4, "Fabricator meal feedstock"); Act.start({ id: "fab", fab: true, name: "Fabricator printing", min: 6, posture: "stand", anchor: World.anchorFor("kitchen"), done: () => { S.hand = makeMeal("Printed " + pick(["noodle bowl", "grain bowl", "curry bowl", "protein stew"]), 620, .3); UI.hand(); } }); }, handFree()));
      out.push(A("Cook a real meal", "35m · groceries", "Two portions: one now, one for the fridge. Cooking " + Math.round(S.skills.cooking * 100) + "%.", () => {
        if (S.inv.groceries < 1) return UI.toast("No groceries. The automat in the plaza has them, or order a delivery at your desk.", "bad");
        const b = startBlocked(2); if (b) return UI.toast(b, "bad");
        S.inv.groceries--; const dish = pick(DISHES);
        Act.start({ id: "cook", name: "Cooking " + dish, min: 35, posture: "stand", anchor: World.anchorFor("kitchen"), strain: 6, adhdDrift: true, tick: () => { S.needs.fun += .05; }, done: () => { const q = clamp(.42 + S.skills.cooking * .5 + rnd(-.08, .08), .2, 1); S.skills.cooking = Math.min(1, S.skills.cooking + .03); S.hand = makeMeal("Home-cooked " + dish, 700, q); S.fridge.push(makeMeal("Leftover " + dish, 650, q - .08, false)); UI.hand(); addMoodlet("cooked", "Cooked for myself", 4, 5); smallWin(); }, partial: () => { S.inv.groceries++; } });
      }, handFree()));
      const bread = S.items.find(i => i.cat === "bread" && !i.keep);
      if (bread) out.push(A("Slice your sourdough", "3m", "Butter, salt, a sharp knife.", () => Act.start({ id: "slice", name: "Slicing bread", min: 3, done: () => { S.items.splice(S.items.indexOf(bread), 1); S.hand = makeMeal("Your own sourdough with butter", 430, .45 + bread.q * .5, false); UI.hand(); } }), handFree()));
      if (S.fridge.length) out.push(A("Reheat leftovers", "4m", S.fridge[0].name, () => Act.start({ id: "reheat", name: "Reheating", min: 4, done: () => { const f = S.fridge.shift(); f.hot = true; f.made = S.t; S.hand = f; UI.hand(); } }), handFree()));
      out.push(A(CRAFTS.bread.verb, "45m · flour", "Bake to eat or to sell. Baking " + Math.round(S.skills.bread * 100) + "%.", () => startCraft("bread"), handFree()));
      if (S.cat) out.push(A(`Feed ${S.cat.name}`, "1m", S.cat.fedDay === today() ? "Already fed today. (Don't believe the meowing.)" : `${S.inv.catfood} meals of cat food left.`, () => { S.inv.catfood--; S.cat.fedDay = today(); S.cat.love = Math.min(100, (S.cat.love || 50) + 4); smallWin(); Sound.meow(); UI.toast(`${S.cat.name} eats like it's the first meal in history.`, "good"); }, S.cat.fedDay === today() ? "Fed today" : S.inv.catfood < 1 ? "No cat food (automat)" : null));
      out.push(A("Drink a glass of water", "1m", "Tiny, real.", () => { S.needs.bladder += 6; smallWin("Drank water"); S.t += 0; UI.toast("Cold water. Small win.", "good"); }));
      out.push(A("Make tea", "6m", "Kettle, mug, the steam on your face.", () => Act.start({ id: "tea", name: "Making tea", min: 6, anchor: World.anchorFor("kitchen"), done: () => { S.needs.bladder += 10; S.stress -= 6; addMoodlet("tea", "Cup of tea", 3, 2); } })));
      break;
    }
    case "table": {
      if (meal) out.push(A("Sit down and eat", "20m", S.hand.hot ? "Hot food at a table. The way it's meant to go." : "It's cold, but still better sitting down.", () => eat("table")));
      out.push(A("Sit for a while", "15m", "Off your feet.", () => Act.start({ id: "sit", name: "Sitting", min: 15, posture: "sit", anchor: World.anchorFor("table"), tick: () => { S.stress -= .1; } })));
      break;
    }
    case "sofa": {
      out.push(A("Watch the feed", "30m", "Documentaries, a Ceres soap opera, the orbital race.", () => Act.start({ id: "feed", holo: true, name: "Watching the feed", min: 30, posture: "sit", anchor: World.anchorFor("sofa"), tick: () => { S.needs.fun += .38; }, done: () => { if (h >= 22 || h < 4) S.flags.lateScreen = today(); } })));
      out.push(A("Read a book", "45m", "A paper one. Mara lent it to someone who lent it to you.", () => Act.start({ id: "read", name: "Reading", min: 45, posture: "sit", anchor: World.anchorFor("sofa"), adhdDrift: true, tick: () => { S.needs.fun += .25; S.stress -= .12; S.sensory -= .5; } })));
      out.push(A("Breathing exercise", "5m", "In for four, hold for four, out for six.", () => breathe()));
      break;
    }
    case "bench": {
      for (const cat of ["ceramic", "wood", "journal"]) { const C = CRAFTS[cat]; const have = S.inv[C.mat] || 0;
        out.push(A(C.verb, fmtDur(C.min) + " · " + MATERIALS[C.mat].name.split(" (")[0].toLowerCase(), `${have} in stock · skill ${Math.round(S.skills[cat] * 100)}%` + (S.char.interest === cat ? " · your thing" : "") + (cat === "ceramic" ? " · needs the kiln after" : ""), () => startCraft(cat), handFree() || (have < 1 ? "No " + MATERIALS[C.mat].name.split(" (")[0].toLowerCase() : null))); }
      break;
    }
    case "bath": {
      out.push(A("Shower", "12m", "Hot water is still the best technology.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "shower", name: "Showering", min: 12, posture: "stand", anchor: World.anchorFor("shower"), tick: () => { S.needs.hygiene += 8; S.stress -= .3; if (c.pain) S.pain -= .5; }, done: () => { addMoodlet("shower", "Warm shower", 4, 4); smallWin(); } }); }, handFree()));
      out.push(A("Use the toilet", "3m", "", () => Act.start({ id: "toilet", name: "Bathroom", min: 3, posture: "sit", anchor: World.anchorFor("toilet"), done: () => { S.needs.bladder = 0; } }), handFree()));
      out.push(A("Brush teeth", "3m", "", () => Act.start({ id: "teeth", name: "Brushing teeth", min: 3, anchor: World.anchorFor("sink"), done: () => { S.needs.hygiene = Math.min(100, S.needs.hygiene + 6); if (h < 11) addMoodlet("teeth", "Fresh start", 2, 4); smallWin(); } }), handFree()));
      if (S.flags.meds) out.push(A("Take daily medication", "1m", S.flags.medsDay === today() ? "Already taken today." : "Works quietly in the background, as long as you keep it up.", () => { S.flags.medsDay = today(); UI.toast("Taken. It'll help a little, all day.", "good"); smallWin(); }, S.flags.medsDay === today() ? "Taken today" : null));
      break;
    }
    case "homedoor": out.push(A("Go out to the plaza", "6m walk", S.weather === "rain" ? "It's raining." : "Lumen Reach plaza is two blocks away.", () => { const b = startBlocked(1); if (b) return UI.toast(b, "bad"); travel("plaza", 6, "Walking to the plaza", { x: -15, z: 13.3 }, Math.PI, { arrive: () => { if (!S.flags.outToday || S.flags.outToday !== today()) { S.flags.outToday = today(); smallWin("Went outside"); } } }); })); break;

    /* ---------- PLAZA ---------- */
    case "plazahome": out.push(A("Go home", "6m walk", "Linden Court, third floor.", () => travel("home", 6, "Walking home", { x: 4.2, z: .8 }, -Math.PI / 2))); break;
    case "automat": out.push(A("Browse the automat", "", "Groceries, craft materials, weave feedstock, earbuds.", () => UI.shop())); out.push(A("Print a snack bar", "₵3", "Oat and pea-protein. Fills a gap.", () => { if (!canAfford(3)) return UI.toast("Not enough credits.", "bad"); pay(-3, "Snack bar"); S.hand = makeMeal("Snack bar", 260, .22, false); UI.hand(); }, handFree())); break;
    case "stall": {
      const stock = S.items.filter(i => i.state === "done" && !i.keep);
      out.push(A("Tend your stall", "1h", stock.length ? `${stock.length} piece${stock.length > 1 ? "s" : ""} for sale. Busier at lunch and early evening.` : "Nothing to sell yet.", () => tendStall(), stock.length ? null : "Nothing to sell"));
      out.push(A("Choose what's for sale", "", "Mark pieces to keep in your things (I).", () => UI.things()));
      break;
    }
    case "kiln": {
      const g = S.items.filter(i => i.state === "greenware");
      out.push(A("Leave greenware in the kiln", g.length ? `${g.length} bowl${g.length > 1 ? "s" : ""}` : "", "Mara fires the shared kiln overnight. Ready after 06:00 tomorrow.", () => { for (const it of g) { S.items.splice(S.items.indexOf(it), 1); it.state = "firing"; S.kiln.push(it); } logEv(`Left ${g.length} bowl${g.length > 1 ? "s" : ""} for tonight's firing.`, "info"); }, g.length ? null : "No unfired bowls"));
      if (dateOf(S.t).getUTCDay() === 3 && h >= 16 && h < 17) out.push(A("Assist Mara's pottery class", "until 18:00 · ₵20/h", S.skills.ceramic >= .25 ? "Centering clay for eight beginners." : "Mara wants assistants with some skill (ceramics 25%).", () => job("class", Math.round(18 * 60 - (S.t % DAY)), 20, "mara"), S.skills.ceramic < .25 ? "Ceramics 25% needed" : handFree()));
      if (S.kiln.length) out.push(A("Check the kiln", "", `${S.kiln.length} of yours in tonight's load.`, () => UI.toast("Stacked on the shelf with everyone else's. Tomorrow.", "info")));
      break;
    }
    case "board": out.push(A("Read the commission board", "", "People asking for human-made things. Delivery locker underneath.", () => UI.board())); break;
    case "cafecounter": {
      const open = h >= 6 && h < 21;
      out.push(A("Order lunch from Dev", "₵14", "Whatever he cooked today. He cooks it himself.", () => { if (!canAfford(14)) return UI.toast("Not enough credits.", "bad"); pay(-14, "Copper Kettle lunch"); S.hand = makeMeal("Dev's " + pick(DISHES), 680, .74); UI.hand(); UI.toast("Hot plate. The café tables are right outside.", "info"); }, !open ? "Closed" : handFree()));
      const dw = dateOf(S.t).getUTCDay();
      if ([2, 4, 6].includes(dw) && h >= 10 && h < 13.5) out.push(A("Work a café shift with Dev", `until 14:00 · ₵16/h`, "Taking orders, steaming milk, wiping tables. Busy at lunch.", () => job("cafe", Math.round(14 * 60 - (S.t % DAY)), 16, "dev", World.anchorFor("cafe")), handFree()));
      out.push(A("Order a coffee", "₵5", "Hand-pulled.", () => { if (!canAfford(5)) return UI.toast("Not enough credits.", "bad"); pay(-5, "Coffee"); S.needs.energy += 7; S.needs.bladder += 14; if (c.anxiety) S.stress += 5; if (c.insomnia && h >= 15) S.flags.lateCoffee = today(); addMoodlet("coffee", "Good coffee", 3, 3); UI.toast("Bitter, bright, made by a person.", "good"); }, !open ? "Closed" : null));
      out.push(A("Order tea", "₵4", "", () => { if (!canAfford(4)) return UI.toast("Not enough credits.", "bad"); pay(-4, "Tea"); S.needs.bladder += 12; S.stress -= 5; addMoodlet("tea", "Cup of tea", 3, 2); }, !open ? "Closed" : null));
      break;
    }
    case "cafetable":
      if (isMusicNight(S.t)) out.push(A("Listen to music night", "45m", "Friday at the Copper Kettle. Teo and friends play.", () => Act.start({ id: "musicnight", name: "Music night", min: 45, posture: "sit", anchor: World.anchorFor("cafe"), loud: true, tick: () => { S.needs.fun += .5; S.needs.social += .3; }, done: () => addMoodlet("music", "Music night", 8, 12) })));
      if (isMusicNight(S.t) && S.songs) out.push(A("Play a song at music night", "20m", "Teo hands you the twelve-string.", () => Act.start({ id: "musicnight", name: "Playing for the room", min: 20, posture: "stand", loud: true, tick: () => { S.needs.fun += .6; S.needs.social += .4; if (c.anxiety) S.stress += .4; }, done: () => { const t = Math.round(10 + S.skills.music * 30); pay(t, "Music night tips"); addMoodlet("stage", "Played for a room", 10, 24); logEv(`The room claps. Properly. ₵${t} in the jar.`, "good"); } })));
      if (meal) out.push(A("Sit and eat here", "20m", "Among people, at a table.", () => eat("cafe")));
      out.push(A("Sit and people-watch", "20m", "The plaza going about its day.", () => Act.start({ id: "watch", name: "People-watching", min: 20, posture: "sit", anchor: World.anchorFor("cafe"), loud: true, tick: () => { S.needs.social += .2; S.needs.fun += .2; } })));
      break;
    case "plazabench": out.push(A("Sit and watch the world", "20m", "Sparrows, delivery bots, a kid chasing a drone.", () => Act.start({ id: "bench", name: "Sitting on the bench", min: 20, posture: "sit", anchor: World.anchorFor("plazabench"), tick: () => { S.needs.social += .12; S.needs.fun += .22; S.stress -= .15; }, done: () => smallWin() }))); break;
    case "busk": out.push(A("Busk for an hour", "1h", S.songs ? `Your set: ${S.songs} song${S.songs > 1 ? "s" : ""}. Music ${Math.round(S.skills.music * 100)}%. Crowd now: ${crowdWord()}.` : "Write a song at your desk first.", () => busk(), S.songs ? handFree() : "No songs yet")); break;
    case "wellness": {
      const open = h >= 9 && h < 17 && !isWeekend(S.t);
      out.push(A("Counseling session with Dr. Osei", "50m · free", "Covered like all basic healthcare. Once a day.", () => Act.start({ id: "therapy", name: "Session with Dr. Osei", min: 50, posture: "sit", ff: 10, hide: true, tick: () => { S.stress -= .5; }, done: () => { S.flags.therapyDay = today(); addMoodlet("therapy", "Talked it through", 8, 24); S.npcs.imani.met = true; S.npcs.imani.rel = Math.min(100, S.npcs.imani.rel + 4); logEv("You leave a bit lighter. Dr. Osei gave you one small thing to try this week: notice one good minute a day.", "good"); } }), !open ? "Open weekdays 9–17" : S.flags.therapyDay === today() ? "Already had a session today" : null));
      out.push(A("Use the quiet room", "30m", "Low light, no screens, thick walls. Anyone can use it.", () => Act.start({ id: "quiet", name: "In the quiet room", min: 30, posture: "sit", hide: true, tick: () => { S.sensory = Math.max(0, S.sensory - 2.2); S.stress -= .35; } }), h >= 7 && h < 22 ? null : "Closed overnight"));
      break;
    }
    case "transit": out.push(A("Shuttle to Halcyon station", "₵30 · ~2h40", `Departs on even hours 08–20. Next in ${fmtDur(nextDeparture(false))}. Launch loop, then two phasing burns to rendezvous.`, () => shuttle(true), handFree())); break;

    /* ---------- STATION ---------- */
    case "obs": if (dateOf(S.t).getUTCDay() === 0 && h >= 11 && h < 13.5) out.push(A("Guide a station tour", "until 14:00 · ₵20/h", "Visitors from the ground. You explain spin gravity and orbital sunrise.", () => job("tour", Math.round(14 * 60 - (S.t % DAY)), 20, "brandt"), handFree()));
      out.push(A("Watch Earth", "20m", stationSunlit(S.t) ? `Orbital day. Sunset in ${fmtDur(ORBIT * .61 - (S.t % ORBIT))}.` : `Earth's shadow. Sunrise in ${fmtDur(nextOrbitalSunrise(S.t))}.`, () => watchEarth())); break;
    case "hydro":
      out.push(A("Volunteer shift with Brandt", "2h · ₵36 stipend", "Thinning seedlings, checking nutrient flow. Real work, small pay.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "volunteer", name: "Hydroponics shift", min: 120, posture: "stand", anchor: World.anchorFor("hydro"), ff: 10, strain: 8, drain: 1, tick: () => { S.needs.social += .06; S.needs.fun += .1; }, done: () => { pay(36, "Halcyon volunteer stipend"); S.npcs.brandt.rel = Math.min(100, S.npcs.brandt.rel + 3); S.npcs.brandt.met = true; addMoodlet("useful", "Was useful", 7, 12); logEv("Shift done. +₵36. Your hands smell like basil.", "good"); }, partial: a => { const p = Math.round(a.elapsed / 120 * 36); if (p) pay(p, "Partial volunteer stipend"); } }); }, handFree()));
      out.push(A("Harvest herbs to take home", "10m", "Brandt lets volunteers take a bundle.", () => Act.start({ id: "harvest", name: "Harvesting", min: 10, anchor: World.anchorFor("hydro"), done: () => { S.inv.groceries++; S.flags.harvestDay = today(); logEv("Basil, chard and a fistful of cherry tomatoes. That's a meal's worth.", "good"); } }), S.flags.harvestDay === today() ? "Already harvested today" : handFree()));
      break;
    case "galley": out.push(A("Get a galley meal", "₵16", "Grown forty metres from here.", () => { if (!canAfford(16)) return UI.toast("Not enough credits.", "bad"); pay(-16, "Halcyon galley meal"); S.hand = makeMeal("Halcyon " + pick(["tomato and basil pasta", "chard and bean stew", "fresh greens and rice"]), 680, .72); UI.hand(); }, handFree())); break;
    case "galleytable":
      if (meal) out.push(A("Sit and eat", "20m", "The floor curves up into the distance behind your plate.", () => eat("galley")));
      out.push(A("Sit for a while", "15m", "", () => Act.start({ id: "sit", name: "Sitting", min: 15, posture: "sit", anchor: World.anchorFor("galley") })));
      break;
    /* ---------- NEW PLACES ---------- */
    case "easel": out.push(A(CRAFTS.paint.verb, fmtDur(CRAFTS.paint.min) + " · canvas", `${S.inv.canvas || 0} canvases · painting ${Math.round(S.skills.paint * 100)}%` + (S.char.interest === "paint" ? " · your thing" : ""), () => startCraft("paint"), handFree() || ((S.inv.canvas || 0) < 1 ? "No canvas" : null))); break;
    case "mat":
      out.push(A("Stretch and yoga", "20m", c.pain ? "Slow, gentle. Good for backs on most days." : "Loosens everything up.", () => Act.start({ id: "yoga", name: "Stretching", min: 20, posture: "sit", anchor: World.anchorFor("mat"), tick: () => { S.stress -= .25; S.needs.comfort += .3; if (c.pain) S.pain -= S.painBase > 50 ? .1 : .45; }, done: () => { addMoodlet("yoga", "Stretched", 4, 6); smallWin(); } }), handFree()));
      out.push(A("Bodyweight workout", "25m", "Squats, push-ups, planks. Sweaty.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "workout", name: "Working out", min: 25, posture: "stand", anchor: World.anchorFor("mat"), strain: c.pain ? 10 : 0, drain: 3, tick: () => { S.needs.hygiene -= .5; S.stress -= .3; S.needs.fun += .1; }, done: () => { addMoodlet("endorphins", "Endorphins", 7, 6); smallWin(); } }); }, handFree()));
      break;
    case "cat": {
      const k = S.cat; if (!k) break;
      out.push(A(`Pet ${k.name}`, "5m", { shy: "Slow blink first. Let them come to you.", cuddly: "Instantly in your lap.", chaotic: "Might bite. Affectionately." }[k.temper] || "", () => Act.start({ id: "pet", name: `Petting ${k.name}`, min: 5, posture: "sit", tick: () => { S.stress -= .8; S.sensory -= .8; S.needs.fun += .3; }, done: () => { k.love = Math.min(100, (k.love || 50) + 2); addMoodlet("cat", `${k.name} purred at me`, 5, 5); smallWin(); } })));
      out.push(A(`Play with ${k.name}`, "15m", "The feather-on-a-string. Undefeated.", () => Act.start({ id: "catplay", name: `Playing with ${k.name}`, min: 15, posture: "stand", tick: () => { S.needs.fun += .6; S.stress -= .3; }, done: () => { k.love = Math.min(100, (k.love || 50) + 3); addMoodlet("catplay", "Played with the cat", 5, 6); } })));
      break;
    }
    case "garden": {
      const names = { tomatoes: "Tomatoes (4 days)", beans: "Beans (3 days)", herbs: "Herbs (2 days)", sunflowers: "Sunflowers (5 days)" };
      S.garden.forEach((p, i) => {
        if (!p) { for (const crop of ["tomatoes", "beans", "herbs", "sunflowers"]) if (i === S.garden.indexOf(null)) out.push(A(`Plant ${names[crop].split(" (")[0].toLowerCase()} in bed ${i + 1}`, "15m · seeds", names[crop] + ". Water once a day; rain counts.", () => plant(i, crop), (S.inv.seeds || 0) < 1 ? "No seeds (automat)" : handFree())); return; }
        if (p.dead) { out.push(A(`Clear the dead ${p.crop} in bed ${i + 1}`, "10m", "Missed two days of water. It happens.", () => Act.start({ id: "garden", name: "Clearing the bed", min: 10, posture: "sit", anchor: World.anchorFor("garden"), done: () => { S.garden[i] = null; } }))); return; }
        if (p.growth >= 1) { out.push(A(`Harvest ${p.crop} from bed ${i + 1}`, "20m", "Ripe.", () => harvest(i))); return; }
        const watered = p.lastWater === today() || S.weather === "rain";
        out.push(A(`Water ${p.crop} in bed ${i + 1}`, "5m", `${Math.round(p.growth * 100)}% grown${watered ? " · already watered today" : ""}`, () => Act.start({ id: "garden", name: "Watering", min: 5, posture: "stand", anchor: World.anchorFor("garden"), done: () => { p.lastWater = today(); smallWin("Watered the garden"); } }), watered ? "Watered today" : null));
      });
      if (h >= 8 && h < 11) out.push(A("Help Grace in the shared beds", "2h · ₵24", "Weeding, compost, hauling. Grace pays from the co-op fund.", () => job("garden", 120, 24, "grace", World.anchorFor("garden")), handFree()));
      break;
    }
    case "restroom": case "srestroom": out.push(A("Use the restroom", "4m", "Clean, free, robot-maintained.", () => Act.start({ id: "toilet", name: "Restroom", min: 4, posture: "stand", hide: true, done: () => { S.needs.bladder = 0; S.needs.hygiene = Math.min(100, S.needs.hygiene + 3); } }))); break;
    case "shelter": {
      if (!bizOpen("shelter")) { out.push(A("Paws & Circuits is closed", "", "Open daily " + BIZ.shelter.text + ".", () => { }, "Closed now")); break; }
      out.push(A(S.cat ? `Buy a treat for ${S.cat.name}` : "Meet the cats", S.cat ? "₵3" : "₵40 to adopt", S.cat ? "Freeze-dried shrimp. Ridiculous. Beloved." : "Three cats need a home. Adoption covers chip, checkups and a bed.", () => { if (S.cat) { if (!canAfford(3)) return UI.toast("Not enough credits.", "bad"); pay(-3, "Cat treat"); S.cat.love = Math.min(100, (S.cat.love || 50) + 5); UI.toast(`${S.cat.name} will be thrilled.`, "good"); } else UI.adopt(); }));
      out.push(A("Volunteer: socialize the shelter cats", "1h", "Sitting quietly so shy cats learn people are okay.", () => Act.start({ id: "shelterv", name: "Sitting with shelter cats", min: 60, posture: "sit", hide: true, tick: () => { S.stress -= .25; S.sensory -= .4; S.needs.fun += .2; }, done: () => { addMoodlet("cats", "Sat with shelter cats", 6, 8); smallWin(); } })));
      break;
    }
    case "fountain":
      out.push(A("Go for a run around town", "30m", c.pain && S.painBase > 50 ? "Bad back day. This will hurt." : "Loop past the market, the garden and the transit arch.", () => { const b = startBlocked(2); if (b) return UI.toast(b, "bad"); Act.start({ id: "run", name: "Running", min: 30, posture: "stand", hide: true, ff: 10, drain: 6, strain: c.pain ? (S.painBase > 50 ? 25 : -6) : 0, tick: () => { S.needs.hygiene -= .6; S.stress -= .5; S.needs.fun += .2; }, done: () => { addMoodlet("endorphins", "Runner's high", 8, 6); smallWin("Went for a run"); } }); }, handFree()));
      out.push(A("Sit on the fountain's edge", "15m", "Spray on your neck, pigeons at your feet.", () => Act.start({ id: "fsit", name: "Sitting by the fountain", min: 15, posture: "sit", anchor: World.anchorFor("fountain"), tick: () => { S.stress -= .2; S.needs.fun += .2; S.needs.social += .1; } })));
      out.push(A("Toss a coin and make a wish", "₵1", "Teo says the coins go to the shelter. He might be lying.", () => { if (!canAfford(1)) return; pay(-1, "Fountain wish"); addMoodlet("wish", "Made a wish", 2, 6); UI.toast("Plink.", "info"); }));
      break;
    case "hub": out.push(A("Climb the spoke to the spin hub", "45m", "Gravity falls with every rung: half a g halfway up, almost none at the hub. Then you float.", () => Act.start({ id: "hub", name: "Climbing to the spin hub, then floating", min: 45, posture: "stand", ff: 2, tick: a => { S.needs.fun += .8; S.stress -= .3; if (a.elapsed === 1) logEv("You climb the spoke ladder. Every rung up, you weigh a little less.", "info"); if (a.elapsed === 4) logEv("Halfway up: half a g. Your arms do most of the work now.", "info"); if (a.elapsed === 10) logEv("At the hub you push off a wall and drift. The whole ring turns around you, a slow green-and-steel horizon.", "good"); }, done: () => { S.stats.hub++; addMoodlet("float", "Flew in the hub", 12, 24); } }), handFree())); break;
    case "dock": out.push(A("Shuttle home to Lumen Reach", "₵30 · ~2h40", `Departs on odd hours 07–21. Next in ${fmtDur(nextDeparture(true))}.`, () => shuttle(false), handFree())); break;
  }
  return out;
}
function crowdWord() { const c = crowd(S.t); return c < .2 ? "nearly empty" : c < .45 ? "light" : c < .7 ? "busy" : "packed"; }
function breathe() {
  Act.start({ id: "breathe", name: "Breathing: in 4, hold 4, out 6", min: 5, posture: S.posture === "sit" ? "sit" : "stand", tick: () => { S.stress = Math.max(0, S.stress - 2.2); S.sensory = Math.max(0, S.sensory - 1.4); }, done: () => smallWin() });
}
function tendStall() {
  const b = startBlocked(1); if (b) return UI.toast(b, "bad");
  Act.start({
    id: "stall", name: "Tending your stall", min: 60, posture: "stand", anchor: World.anchorFor("stall"), loud: true, strain: 6, sold: 0,
    tick: a => {
      S.needs.social += .1;
      if (a.elapsed % 10 !== 0) return;
      const stock = S.items.filter(i => i.state === "done" && !i.keep); if (!stock.length) return;
      if (Math.random() > .18 + crowd(S.t) * .55) return;
      const buyer = pick(BUYERS); stock.sort((x, y) => (y.cat === buyer.likes) - (x.cat === buyer.likes));
      const it = Math.random() < .7 ? stock[0] : pick(stock);
      const price = priceFor(it, buyer);
      if (Math.random() < .2 + (1 - it.q) * .3) { logEv(`${cap(buyer.who)} picks up your ${it.name.toLowerCase()}, turns it over, puts it back.`, "info"); return; }
      S.items.splice(S.items.indexOf(it), 1); pay(price, `Sold: ${it.name} (${it.trait})`); S.demand[it.cat] *= .86; a.sold++; S.stats.sold++; S.stats.earnedCraft += price; Sound.coins();
      const why = it.trait.includes(buyer.word) ? ` They loved ${it.trait}.` : "";
      logEv(`Sold your ${it.name.toLowerCase()} to ${buyer.who} for ₵${price}.${why}`, "good");
      addMoodlet("sold", "Someone wanted what I made", 9, 10);
    },
    done: a => { if (!a.sold) logEv("No sales this hour. Lunch and early evening are busier.", "info"); }
  });
}
function busk() {
  const b = startBlocked(2); if (b) return UI.toast(b, "bad");
  Act.start({
    id: "busk", name: "Busking", min: 60, posture: "play", anchor: World.anchorFor("busk"), loud: true, ff: 8, earned: 0,
    tick: a => {
      S.needs.fun += .12; S.needs.social += .1; if (S.char.cond.anxiety) S.stress += .12;
      if (a.elapsed % 10) return;
      const tip = crowd(S.t) * (2 + S.skills.music * 9) * (1 + .15 * Math.min(S.songs, 5)) * rnd(.5, 1.4);
      if (tip >= 1) { const t = Math.round(tip); a.earned += t; pay(t, "Busking tips"); }
    },
    done: a => { S.skills.music = Math.min(1, S.skills.music + .02); logEv(a.earned ? `You played for an hour. ₵${a.earned} in tips${a.earned > 25 ? ", and a kid danced." : "."}` : "An hour of playing to the pigeons. Still, you played.", a.earned ? "good" : "info"); addMoodlet("busk", "Played for people", 5, 6); }
  });
}
function watchEarth() {
  const startLit = stationSunlit(S.t); let saw = false;
  Act.start({
    id: "obs", name: "Watching Earth turn below", min: 20, posture: "sit", anchor: World.anchorFor("obs"),
    tick: () => { S.needs.fun += .6; S.stress -= .3; if (!saw && orbitPhase(S.t) < .02) saw = true; },
    done: () => {
      if (saw) { S.stats.sunrise++; addMoodlet("sunrise", "Saw an orbital sunrise", 14, 24); logEv("The sun comes up over Earth's edge in eight seconds flat: black, a thin blue line, then everything. It happens sixteen times a day up here and it still gets you.", "good"); }
      else addMoodlet("earth", "Watched the Earth", 7, 12);
      logEv(`Through the window the stars wheel once every 30 seconds. That's the ring's spin: 2 rpm at 224 m gives about 1 g. ${saw ? "" : "Next orbital sunrise in " + fmtDur(nextOrbitalSunrise(S.t)) + "."}`, "info", false);
    }
  });
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Weave (nanites) ---------- */
const WEAVE = [
  { id: "cleanse", name: "Cleanse", wh: 3, g: 1, min: 5, desc: "Nanites strip oils and bacteria from skin and clothes and are shed with them. Caps out around 75% clean: no substitute for water and soap.", run: () => { S.needs.hygiene = Math.max(S.needs.hygiene, Math.min(75, S.needs.hygiene + 35)); } },
  { id: "ease", name: "Ease muscles", wh: 4, g: 0, min: 10, desc: "Gentle localized warming (about 14 kJ, delivered over ten minutes) and vasodilation. Like a heat pad you're wearing.", run: () => { if (S.char.cond.pain) S.pain = Math.max(0, S.pain - 18); S.needs.comfort += 12; } },
  { id: "dry", name: "Dry & warm", wh: 2.5, g: 0, min: 3, desc: "Wicks rain from your clothes. Evaporating 100 g of water takes ~63 Wh, so this only works because the weave mostly moves water, not boils it.", run: () => { S.moodlets = S.moodlets.filter(m => m.id !== "soaked"); S.flags.rainMin = 0; } }
];
function useWeave(w) {
  if (S.weave.wh < w.wh) return UI.toast(`Not enough charge: ${w.wh} Wh needed, ${S.weave.wh.toFixed(1)} Wh stored. Sleep on the induction mattress to recharge.`, "bad");
  if (S.weave.g < w.g) return UI.toast("Out of feedstock. The automat sells it.", "bad");
  if (Act.cur) return UI.toast("Finish what you're doing first.", "bad");
  S.weave.wh -= w.wh; S.weave.g -= w.g;
  Act.start({ id: "weave", name: "Weave: " + w.name, min: w.min, posture: S.posture === "sit" ? "sit" : "stand", done: () => { w.run(); logEv(`Weave: ${w.name.toLowerCase()} done. ${S.weave.wh.toFixed(1)} Wh left.`, "info", false); } });
  UI.closeDrawer();
}

function job(kind, min, perHour, npc, anchor) {
  if (min < 15) return UI.toast("Too late to start this shift today.", "bad");
  const b = startBlocked(2); if (b) return UI.toast(b, "bad");
  const names = { cafe: "Café shift at the Copper Kettle", class: "Assisting Mara's class", tour: "Guiding a station tour", garden: "Helping in the shared beds" };
  Act.start({ id: "job", name: names[kind], min, posture: kind === "class" ? "sit" : "stand", anchor, ff: 12, loud: kind === "cafe", strain: 6, drain: 2,
    tick: () => { S.needs.social += .12; S.needs.fun += .03; },
    done: () => { const p = Math.round(min / 60 * perHour); pay(p, names[kind]); S.stats.shifts++; if (S.npcs[npc]) { S.npcs[npc].rel = Math.min(100, S.npcs[npc].rel + 3); S.npcs[npc].met = true; } addMoodlet("work", "Did honest work", 6, 12); logEv(`Shift done. +₵${p}.`, "good"); Sound.coins(); },
    partial: a => { const p = Math.round(a.elapsed / 60 * perHour); if (p) pay(p, names[kind] + " (left early)"); }
  });
}
function plant(i, crop) {
  S.inv.seeds--;
  Act.start({ id: "garden", name: `Planting ${crop}`, min: 15, posture: "sit", anchor: World.anchorFor("garden"), done: () => { S.garden[i] = { crop, planted: today(), growth: 0, lastWater: today(), dead: false }; smallWin("Planted something"); logEv(`Planted ${crop} in bed ${i + 1}. Water it once a day (rain counts).`, "good"); }, partial: () => { S.inv.seeds++; } });
}
function harvest(i) {
  const p = S.garden[i];
  Act.start({ id: "garden", name: `Harvesting ${p.crop}`, min: 20, posture: "sit", anchor: World.anchorFor("garden"), done: () => {
    const yieldN = { tomatoes: 2, beans: 2, herbs: 1, sunflowers: 0 }[p.crop];
    S.inv.groceries += yieldN; S.stats.harvests++; S.skills.garden = Math.min(1, S.skills.garden + .05);
    S.garden[i] = null; addMoodlet("harvest", "Grew my own food", p.crop === "sunflowers" ? 12 : 9, 24);
    logEv(p.crop === "sunflowers" ? "You cut an armful of sunflowers. The flat looks different with them in it." : `Harvested ${p.crop}: ${yieldN} meal${yieldN > 1 ? "s" : ""} of groceries.`, "good");
  } });
}
