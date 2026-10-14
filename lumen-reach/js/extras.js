/* ============================================================
   EXTRAS — daily world changes, goals
   ============================================================ */
const LOWER = ["#2a3037", "#3f4f63", "#6b5a48", "#2f2d45", "#8b4d57", "#c8ccd0", "#566f4f", "#a0543a"];
const CROP_DAYS = { tomatoes: 4, beans: 3, herbs: 2, sunflowers: 5 };
function dailyExtras(d) {
  const rainedYesterday = weatherFor(d - 1) === "rain";
  S.garden.forEach(p => {
    if (!p || p.dead || p.growth >= 1) return;
    if (rainedYesterday) p.lastWater = Math.max(p.lastWater, d - 1);
    if (p.lastWater >= d - 1) p.growth = Math.min(1, p.growth + 1 / CROP_DAYS[p.crop] * (1 + S.skills.garden * .3));
    else if (d - 1 - p.lastWater >= 2) { p.dead = true; logEv(`Your ${p.crop} wilted. Two dry days was too many.`, "bad"); }
    if (p.growth >= 1) logEv(`Your ${p.crop} are ready to harvest.`, "good");
  });
  if (S.cat && S.cat.fedDay < d - 1) { S.cat.love = Math.max(0, (S.cat.love || 50) - 12); logEv(`${S.cat.name} missed a meal yesterday and is sulking under the sofa.`, "bad"); }
  const wd = dateOf(S.t).getUTCDay();
  if (wd === 6) logEv("Saturday: market day. The plaza fills up and people pay more for handmade things.", "info");
  if (wd === 5) logEv("Friday: music night at the Copper Kettle from 19:00.", "info");
  if ([2, 4, 6].includes(wd)) logEv("Dev needs a hand at the café today, 10:00–14:00.", "info", false);
}
const GOALS = [
  { id: "table", text: "Sit down at a table for a meal", hint: "Carry a plate to the table and sit.", test: () => S.stats.tableMeals >= 1 },
  { id: "streak", text: "Eat at a table three days running", hint: "Real meals, sitting down.", test: () => S.stats.tableStreak >= 3 },
  { id: "three", text: "Three proper meals in one day", hint: "Breakfast, lunch, dinner.", test: () => S.stats.threeMeals >= 1 },
  { id: "sold", text: "Sell something you made", hint: "Tend your stall in the plaza.", test: () => S.stats.sold >= 1 },
  { id: "earn", text: "Earn ₵300 from your own hands", hint: "Sales and commissions count.", test: () => S.stats.earnedCraft >= 300 },
  { id: "commission", text: "Finish a commission", hint: "Commission board, or someone asks you.", test: () => S.stats.commissions >= 1 },
  { id: "tried", text: "Try every craft", hint: "Bowl, carving, bread, journal, painting.", test: () => Object.keys(S.stats.tried).length >= 5 },
  { id: "skill", text: "Get good at something (50% skill)", hint: "Practice. It slows down as you improve.", test: () => ["ceramic", "wood", "bread", "journal", "paint", "music", "cooking"].some(k => S.skills[k] >= .5) },
  { id: "friend", text: "Make a friend", hint: "Talk to people more than once.", test: () => Object.values(S.npcs).some(n => n.rel >= 30) },
  { id: "close", text: "Have a close friend", hint: "It takes a while. That's the point.", test: () => Object.values(S.npcs).some(n => n.rel >= 60) },
  { id: "rin", text: "Get a letter back from Rin", hint: "Write from your desk terminal. Mind the light delay.", test: () => S.stats.rinReplies >= 1 },
  { id: "cat", text: "Adopt a cat", hint: "Paws & Circuits, by the automat.", test: () => !!S.cat },
  { id: "harvest", text: "Eat something you grew", hint: "Plant, water daily, harvest.", test: () => S.stats.harvests >= 1 },
  { id: "shift", text: "Work a shift", hint: "Café (Tue/Thu/Sat), Mara's class (Wed), Grace's garden (mornings), station tours (Sun).", test: () => S.stats.shifts >= 1 },
  { id: "space", text: "Go to space", hint: "Shuttle from the transit arch.", test: () => S.loc === "station" || S.moodlets.some(m => m.id === "trip") },
  { id: "sunrise", text: "Watch an orbital sunrise", hint: "Observation window, timed right.", test: () => S.stats.sunrise >= 1 },
  { id: "hub", text: "Float in the spin hub", hint: "The spoke ladder on Halcyon.", test: () => S.stats.hub >= 1 }
];
function checkGoals() {
  for (const g of GOALS) {
    if (S.goalsDone[g.id]) continue;
    let ok = false; try { ok = g.test(); } catch (e) { }
    if (ok) { S.goalsDone[g.id] = dayOf(S.t); addMoodlet("goal-" + g.id, "Did a thing I wanted to", 6, 12); logEv("Goal reached: " + g.text + ".", "good"); Sound.ding(); }
  }
}

/* Business hours — shown on signs, in prompts and checked by actions */
const BIZ = {
  cafecounter: { name: "Copper Kettle", open: [6, 21], text: "06:00–21:00" },
  wellness: { name: "Wellness Center", open: [7, 22], text: "quiet room 07:00–22:00 · counseling Mon–Fri 09:00–17:00" },
  shelter: { name: "Paws & Circuits", open: [10, 18], text: "10:00–18:00" },
  kiln: { name: "Okonkwo Kiln", open: [0, 24], text: "drop-off any time · fires nightly" },
  automat: { name: "Automat", open: [0, 24], text: "open 24 hours" },
  transit: { name: "Transit", open: [7, 21], text: "shuttles 08:00–20:00 on even hours" },
  restroom: { name: "Restroom", open: [0, 24], text: "open 24 hours" }
};
function bizOpen(id) { const b = BIZ[id]; if (!b) return true; const h = hourOf(S.t); return h >= b.open[0] && h < b.open[1]; }
function bizStatus(id) {
  const b = BIZ[id]; if (!b) return "";
  if (b.open[0] === 0 && b.open[1] === 24) return b.text;
  return bizOpen(id) ? "open until " + String(b.open[1]).padStart(2, "0") + ":00" : "closed · opens " + String(b.open[0]).padStart(2, "0") + ":00";
}
