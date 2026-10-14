"use strict";
/* ============================================================
   LUMEN REACH — simulation core
   1 real second = 1 game minute at 1×.
   ============================================================ */
const DAY = 1440;
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const START_DATE = Date.UTC(2147, 9, 16); // Monday 16 Oct 2147, Day 1
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------------- Static data ---------------- */
const CONDITIONS = {
  autism: { name: "Autism", desc: "Crowds, robot hum and bright places build sensory load. Social time costs energy even when it's good. Your special interest makes that craft sing. Earbuds (H) and quiet rooms help. At full load you shut down." },
  adhd: { name: "ADHD", desc: "Your needs fade from awareness until they're urgent (Tab checks in). Long tasks drift: time vanishes into side quests, or you hyperfocus and forget to eat." },
  depression: { name: "Depression", desc: "Lower baseline mood and energy. Effortful things can refuse to start. Small wins (water, the window, the plant, going outside) build momentum." },
  anxiety: { name: "Anxiety", desc: "Stress climbs in conversations, crowds and unread messages. Breathing (B), routine and people you trust bring it down." },
  pain: { name: "Chronic back pain", desc: "Pain drifts through good and bad days. Standing work raises it; sitting, lying down, warmth and gentle movement ease it. Fiddly crafts cost more." },
  insomnia: { name: "Insomnia", desc: "Falling asleep can take a while and sleep restores less. Screens and stress late at night make it worse; a routine helps." }
};
const BACKGROUNDS = {
  engineer: { name: "Former orbital engineer", note: "Retired early when the yards automated. Knows the station by heart.", skills: { wood: .25, music: .05 } },
  teacher: { name: "Teacher between schools", note: "Taught kids until tutoring AIs took most classes. Good with people.", skills: { social: .4, journal: .2 } },
  artist: { name: "Restless artist", note: "Has tried every medium at least once.", skills: { ceramic: .25, music: .2 } },
  medic: { name: "Ex-medic", note: "Steady hands, too many night shifts behind you.", skills: { cooking: .35, wood: .15 } },
  drifter: { name: "Still figuring it out", note: "Plenty of degrees and starts. No single thing yet.", skills: { journal: .2, bread: .2, ceramic: .12 } }
};
const INTERESTS = { orbital: "Orbital mechanics", ceramic: "Ceramics", wood: "Woodcarving", bread: "Baking", music: "Music", journal: "Bookbinding", paint: "Painting", botany: "Botany & gardening", cats: "Cats" };
const SKIN = ["#f3d2b8", "#e2b48f", "#c58c66", "#9a6646", "#6c442d", "#47291b"];
const HAIR = ["#1d1814", "#4a3020", "#8a5a32", "#c99a5c", "#b9b2a6", "#7a2f2a", "#3c4f6e"];
const OUTFIT = ["#4c6b80", "#7a5a46", "#566f4f", "#8b4d57", "#d0b47a", "#5d5a7d", "#c8ccd0"];

const CRAFTS = {
  ceramic: { name: "Hand-thrown bowl", mat: "clay", min: 90, base: 42, where: "bench", verb: "Throw a bowl on the wheel", effort: 2, fine: true,
    traits: ["a thumbprint left on purpose under the rim", "glaze that pooled into deep blue at the foot", "a rim that dips once, like a shoreline", "tiny frost-like bubbles in the glaze", "a foot that rocks once, then settles", "throwing rings you can feel with your eyes closed"] },
  wood: { name: "Carved figure", mat: "wood", min: 120, base: 58, where: "bench", verb: "Carve a small figure", effort: 2, fine: true,
    traits: ["a heron mid-step, one knot as its eye", "an otter curled around itself", "a sleeping fox with tool marks left visible", "a little maintenance drone, oddly tender", "a whale whose grain runs like a current", "a pair of hands holding nothing"] },
  bread: { name: "Sourdough loaf", mat: "flour", min: 45, base: 16, where: "kitchen", verb: "Bake a sourdough loaf", effort: 2, fine: false,
    traits: ["an ear that burst exactly right", "a dark, blistered crust", "a crumb full of uneven holes", "a little rye for sourness", "toasted seeds pressed into the top", "flour stencilled with a crescent"] },
  journal: { name: "Hand-bound journal", mat: "paper", min: 80, base: 36, where: "bench", verb: "Bind a journal", effort: 1, fine: true,
    traits: ["coptic stitching in rust-red thread", "deckled edges you didn't trim", "a cover of reclaimed sailcloth", "endpapers printed with an orbit diagram", "a pressed fern inside the back cover", "a spine that lies perfectly flat"] }
};
CRAFTS.paint = { name: "Small oil painting", mat: "canvas", min: 100, base: 52, where: "easel", verb: "Paint a small canvas", effort: 2, fine: true,
  traits: ["the plaza fountain at dusk", "Halcyon as a bright dot over the rooftops", "your pothos in morning light", "a stranger at the café, half in shadow", "rain on the window, all blues", "Earth from the ring window"] };
const MATERIALS = {
  groceries: { name: "Groceries", price: 12, note: "Fresh ingredients for one real meal" },
  clay: { name: "Clay (1 kg)", price: 8, note: "Enough for one bowl" },
  wood: { name: "Carving block", price: 10, note: "Lime wood, kiln-dried" },
  flour: { name: "Flour & starter feed", price: 5, note: "One loaf's worth" },
  paper: { name: "Paper & thread", price: 6, note: "One journal's worth" },
  canvas: { name: "Canvas & paints", price: 9, note: "One small painting's worth" },
  seeds: { name: "Seed packet", price: 4, note: "For a garden plot: tomatoes, beans, herbs or sunflowers" },
  catfood: { name: "Cat food (3 meals)", price: 6, note: "Only matters if you have a cat" },
  feedstock: { name: "Weave feedstock (10 g)", price: 15, note: "Carbon & silicon slurry your nanites build from" }
};
const DISHES = ["lentil dal with flatbread", "miso soup and rice", "roast vegetables with tahini", "egg fried rice", "bean chili", "pasta with greens", "mushroom risotto", "tomato and white bean stew"];

/* NPC definitions. Conversations go to Claude when available. */
const NPCS = {
  mara: { model: { body: "Mage", head: "Rogue", extra: "curls", pal: { skin: "#6c442d", hair: "#c9c4bc", top: "#a0543a", bottom: "#5a3a2a", belt: "#e0b060" } }, name: "Mara Okonkwo", role: "Potter · runs the shared kiln", look: { sex: "f", hairStyle: "curly", clothing: "dress", lower: "#a0543a" }, color: "#a0543a", skin: "#6c442d", hair: "#b9b2a6", loc: "plaza", hours: [8, 18], spot: { x: -13.4, z: -8.6 }, wander: 1,
    persona: "Mara is 64, a potter who has worked clay for forty years and runs the shared kiln behind the market. Warm but blunt, a little impatient with self-pity, generous with practical help. She believes handmade things matter because they carry one person's choices, not because they're better. She dislikes vague praise. She'll teach if asked, and she notices people's hands. Speaks plainly, with dry jokes." },
  dev: { model: { body: "Rogue", head: "Knight", arms: "Mage", pal: { skin: "#9a6646", hair: "#1d1814", top: "#3f6f5a", top2: "#e9e2d0", bottom: "#2a3037", shoe: "#2a2420" } }, name: "Dev Raman", role: "Runs the Copper Kettle café", look: { sex: "m", hairStyle: "short", clothing: "trousers", lower: "#2a3037", beard: true }, color: "#3f6f5a", skin: "#9a6646", hair: "#1d1814", loc: "plaza", hours: [6, 21], spot: { x: 12.1, z: -5.5 }, wander: .4,
    persona: "Dev is 38 and runs the Copper Kettle, one of the few cafés in Lumen Reach where a human makes the coffee. Chatty, a bit anxious about whether the café will survive, remembers everyone's order, overshares about his sourdough starter named Gerald. Kind, occasionally scattered, honest about his own panic attacks if someone else is open first." },
  teo: { model: { body: "Barbarian", head: "Mage", extra: "bun", pal: { skin: "#c58c66", hair: "#4a3020", top: "#8b4d57", bottom: "#3a3f4a", shoe: "#2a2420" } }, name: "Teo Vasquez", role: "Busker & sound tinkerer", look: { sex: "m", hairStyle: "bun", clothing: "trousers", lower: "#3a3f4a" }, color: "#8b4d57", skin: "#c58c66", hair: "#4a3020", loc: "plaza", hours: [14, 23], spot: { x: 3.5, z: 5.8 },
    persona: "Teo is 26, plays a battered twelve-string near the fountain and builds synth modules from scrapped delivery bots. Has ADHD and talks about it casually. Enthusiastic, jumps topics, quick to invite people to jam, sometimes forgets what he was saying. Thinks UBI means people finally get to make weird things nobody asked for." },
  imani: { model: { body: "Mage", head: "Rogue", extra: "bun", pal: { skin: "#47291b", hair: "#1d1814", top: "#5d5a7d", bottom: "#2f2d45", belt: "#c9a0e0" } }, name: "Dr. Imani Osei", role: "Counselor · Wellness Center", look: { sex: "f", hairStyle: "bun", clothing: "skirt", lower: "#2f2d45" }, color: "#5d5a7d", skin: "#47291b", hair: "#1d1814", loc: "plaza", hours: [9, 17], spot: { x: 11.2, z: 8.6 }, wander: 1.2,
    persona: "Dr. Imani Osei is 51, a human counselor at the Wellness Center (people can choose an AI or a human; she's the human option). Calm, curious, never pushy, doesn't diagnose in the street. Asks good questions, respects autonomy, avoids platitudes. Outside of sessions she's friendly and talks about her garden and terrible puns. If someone discloses something heavy she responds with care and suggests booking a session, without lecturing." },
  juno: { name: "JUNO-7", role: "Municipal service robot", look: { sex: "x" }, color: "#c8ccd0", robot: true, loc: "plaza", hours: [0, 24], spot: { x: -2, z: -2 },
    persona: "JUNO-7 is a municipal service robot (knee-height torso on a gyro-balanced wheel, soft voice). It knows it's a robot. Literal, precise, helpful, gently funny without meaning to be. It explains how things in town work with real numbers (UBI, nanites, shuttle schedule, kiln times) and is honest about the limits of what robots are for. It finds human preferences fascinating and asks about them." },
  brandt: { model: { body: "Knight", head: "Rogue", extra: "ponytail", pal: { skin: "#f3d2b8", hair: "#c99a5c", top: "#566f4f", bottom: "#3a4a3a", shoe: "#2a2420" } }, name: "Anneliese Brandt", role: "Hydroponics lead, Halcyon", look: { sex: "f", hairStyle: "ponytail", clothing: "trousers", lower: "#566f4f" }, color: "#566f4f", skin: "#f3d2b8", hair: "#c99a5c", loc: "station", hours: [6, 22], spot: { x: -6.25, z: 1.2 }, wander: 1.2,
    persona: "Anneliese Brandt is 47, runs hydroponics on Halcyon station. Dry humor, precise, protective of her plants, quietly lonely after a long rotation. Loves explaining ring gravity, orbital sunrise every 92 minutes, and why tomatoes grown at 1 g but under artificial light taste different. Will put volunteers to work and respects anyone who shows up on time." },
  pip: { name: "PIP", role: "Station maintenance drone", look: { sex: "x" }, color: "#e8c56a", robot: true, loc: "station", hours: [0, 24], spot: { x: 4, z: -1 },
    persona: "PIP is a small station maintenance drone the size of a melon, with a chirpy speech synthesizer. It knows it's a robot. Cheerful, extremely literal, reports sensor readings unprompted (CO2 ppm, ring rpm, hull temperature), and is curious why humans like looking out windows." }
};

const TOWNSFOLK = {
  lena: { model: { body: "Knight", head: "Rogue", extra: "ponytail", pal: { skin: "#f3d2b8", hair: "#d8b878", top: "#3f5f80", bottom: "#2a3037", shoe: "#1d1d1d" } }, name: "Lena Hoffmann", role: "Drone dispatcher at the depot", look: { sex: "f", hairStyle: "ponytail", clothing: "trousers", lower: "#2a3037" }, color: "#4c6b80", skin: "#f3d2b8", hair: "#c99a5c", hours: [7, 20],
    greet: ["You look like you're looking for something. Lost?", "Oh, hey. Still alive, then."], persona: "Lena is 31, dispatches delivery drones at the depot. Dry wit, talks fast, runs marathons, skeptical of sentimental talk but secretly loves the fountain lit up at night. Practical, teases people she likes." },
  kwame: { model: { body: "Knight", head: "Barbarian", width: 1.08, pal: { skin: "#47291b", hair: "#2a2420", top: "#d0b47a", bottom: "#3a3f4a", shoe: "#2a2420" } }, name: "Kwame Asante", role: "Housing co-op organizer", look: { sex: "m", hairStyle: "short", clothing: "trousers", lower: "#3a3f4a", beard: true }, color: "#d0b47a", skin: "#47291b", hair: "#1d1814", hours: [9, 22],
    greet: ["My friend! You look like someone who plays chess. Do you play chess?", "Ah, you again! Good, good."], persona: "Kwame is 45, organizes the housing co-op. Booming laugh, plays chess in the plaza, always recruiting people for co-op meetings, opinionated about city planning, very proud of his two daughters at university. Warm and generous, argues for fun." },
  sofia: { model: { body: "Mage", head: "Rogue", pal: { skin: "#c58c66", hair: "#1d1814", top: "#8b4d57", bottom: "#2f2d45", belt: "#e8c070" } }, name: "Sofia Marquez", role: "Art student", look: { sex: "f", hairStyle: "long", clothing: "skirt", lower: "#2f2d45" }, color: "#8b4d57", skin: "#c58c66", hair: "#1d1814", hours: [10, 21],
    greet: ["Oh! Sorry. I was, um, sketching you. Not in a weird way.", "Hi again. I finished that sketch, if you want to see it. Or not."], persona: "Sofia is 22, an art student who sketches strangers in the plaza. Shy, apologizes too much, lights up talking about colour and light, worried that art means nothing when machines can paint. Sweet, earnest, funny once comfortable." },
  hiro: { model: { body: "Rogue", head: "Knight", arms: "Mage", height: .96, pal: { skin: "#e2b48f", hair: "#c9c4bc", top: "#566f4f", top2: "#d8d0c0", bottom: "#4a4f45", shoe: "#3b2f28" } }, name: "Hiro Tanaka", role: "Retired fusion engineer, birdwatcher", look: { sex: "m", hairStyle: "buzz", clothing: "trousers", lower: "#4a4f45" }, color: "#566f4f", skin: "#e2b48f", hair: "#b9b2a6", hours: [6, 17],
    greet: ["Shh. A goldfinch. There. ...Gone. Hello.", "Ah, hello. The sparrows are back on the fountain."], persona: "Hiro is 70, a retired fusion plant engineer who keeps a paper list of birds he's seen. Gentle, patient, explains things slowly and precisely, misses his late wife Emiko and speaks of her warmly. Enjoys quiet company." },
  priya: { model: { body: "Knight", head: "Rogue", extra: "bun", pal: { skin: "#9a6646", hair: "#1d1814", top: "#5d8c9c", bottom: "#4d7c8c", shoe: "#e8e8e8" } }, name: "Priya Nair", role: "Night-shift children's nurse", look: { sex: "f", hairStyle: "bun", clothing: "trousers", lower: "#5d7d8c" }, color: "#5d7d8c", skin: "#9a6646", hair: "#1d1814", hours: [12, 20],
    greet: ["Don't mind me, I'm technically asleep right now.", "Hey you. Tell me something nice, I've had a shift."], persona: "Priya is 40, a night-shift pediatric nurse. Tired, gallows humour, fierce about why human nurses still matter next to robots, runs on coffee, deeply kind, gives practical health advice but hates being treated as a free doctor." },
  marcus: { model: { body: "Rogue", head: "Barbarian", arms: "Mage", pal: { skin: "#6c442d", hair: "#1d1814", top: "#7a5a46", top2: "#c9a070", bottom: "#2a3037", shoe: "#2a2420" } }, name: "Marcus Bell", role: "Stay-at-home dad of twins", look: { sex: "m", hairStyle: "short", clothing: "trousers", lower: "#2a3037", beard: true }, color: "#7a5a46", skin: "#6c442d", hair: "#1d1814", hours: [8, 18],
    greet: ["Twins are at school. I have four hours of freedom. Talk to me about anything without glitter in it.", "Hey! You're the one who makes stuff, right?"], persona: "Marcus is 34, a stay-at-home dad of twins (they're at school). Sleep-deprived, cheerful, loves bread and dad jokes, sometimes worries he's 'just' a parent. Easily excited about other people's projects." },
  aiko: { model: { body: "Rogue", head: "Mage", arms: "Mage", extra: "bob", pal: { skin: "#f3d2b8", hair: "#2a3550", top: "#3a3550", top2: "#c8ccd0", bottom: "#1b1d20", shoe: "#c8ccd0" } }, name: "Aiko Mori", role: "Bassist · loves trains", look: { sex: "f", hairStyle: "bob", clothing: "trousers", lower: "#1b1d20" }, color: "#5d5a7d", skin: "#f3d2b8", hair: "#3c4f6e", hours: [13, 23],
    greet: ["Hello. I don't do small talk well. Do you like trains?", "Hello again. I have a new maglev fact if you want it."], persona: "Aiko is 27, plays bass in a band, is openly autistic. Direct, literal, info-dumps about maglev trains, dislikes small talk, wears ear defenders when the plaza is loud, very loyal once you're friends. Appreciates people being clear." },
  tomas: { model: { body: "Knight", head: "Barbarian", width: 1.05, pal: { skin: "#e2b48f", hair: "#7a5a40", top: "#3f565f", bottom: "#2f3f45", shoe: "#2a2420" } }, name: "Tomas Novak", role: "Aquaponics farmer, ex-fisherman", look: { sex: "m", hairStyle: "short", clothing: "trousers", lower: "#3f565f", beard: true }, color: "#3f565f", skin: "#e2b48f", hair: "#4a3020", hours: [6, 14],
    greet: ["Mm.", "You again. Fine. Fish is good today."], persona: "Tomas is 58, a former North Sea fisherman who now runs an aquaponics farm. Gruff, few words, kind underneath, misses the sea, distrusts drones, softens if you ask about boats or fish." },
  grace: { model: { body: "Mage", head: "Rogue", extra: "afro", pal: { skin: "#47291b", hair: "#b9b2a6", top: "#c97d4f", bottom: "#7a4a2a", belt: "#2f6f5a" } }, name: "Grace Oduya", role: "Runs the community garden", look: { sex: "f", hairStyle: "afro", clothing: "dress", lower: "#c97d4f" }, color: "#c97d4f", skin: "#47291b", hair: "#b9b2a6", hours: [7, 18], fixed: true, spot: { x: -6.2, z: 7.4 }, wander: .9,
    greet: ["You've got the look of someone who needs to put their hands in soil.", "There you are. Your plot's been asking about you."], persona: "Grace is 66, a retired teacher who runs the community garden. Warm, firm, teacher-voice, believes in dirt under the fingernails, will put you to work, very proud of her tomatoes, explains watering and soil plainly." },
  ezra: { model: { body: "Rogue", head: "Mage", arms: "Mage", extra: "curls", pal: { skin: "#c58c66", hair: "#8a3a2a", top: "#4c6b80", top2: "#e0d8c8", bottom: "#2a3037", shoe: "#3b2f28" } }, name: "Ezra Cohen", role: "Runs the paper book exchange", look: { sex: "x", hairStyle: "curly", clothing: "trousers", lower: "#2a3037" }, color: "#4c6b80", skin: "#c58c66", hair: "#7a2f2a", hours: [10, 19], pron: "they/them",
    greet: ["Have you read anything with your actual hands lately? I have recommendations.", "Back! Did you read the one I told you about?"], persona: "Ezra is 29, nonbinary (they/them), runs the paper book exchange off the plaza. Enthusiastic, recommends books constantly, a little chaotic, funny, believes owning one paper book changes how you read." }
};
for (const id in TOWNSFOLK) { const t = TOWNSFOLK[id]; NPCS[id] = Object.assign({ loc: "plaza", roam: !t.fixed, spot: t.spot || { x: 0, z: 0 } }, t); }

const BUYERS = [
  { who: "a dock engineer", likes: "ceramic", word: "rim" }, { who: "a retired pilot", likes: "wood", word: "drone" },
  { who: "a student from the station school", likes: "journal", word: "orbit" }, { who: "a couple on a date", likes: "bread", word: "crust" },
  { who: "a quiet man with paint on his sleeves", likes: "ceramic", word: "glaze" }, { who: "a botanist", likes: "journal", word: "fern" },
  { who: "a grandmother with a delivery bot in tow", likes: "bread", word: "seed" }, { who: "a kid's father", likes: "wood", word: "otter" },
  { who: "a tourist from Ceres", likes: "wood", word: "whale" }, { who: "someone from the housing co-op", likes: "ceramic", word: "foot" },
  { who: "a homesick station worker", likes: "paint", word: "Earth" }, { who: "a woman who collects rainy paintings", likes: "paint", word: "rain" }, { who: "a café regular", likes: "paint", word: "fountain" }
];

const THOUGHTS = {
  base: ["The fabricator hums like it's thinking about something else.", "Somewhere above, Halcyon is crossing the terminator.", "Rin's sky is butterscotch right now. Probably.", "Everything is automated except deciding what matters.", "A delivery drone chirps two streets over."],
  hungry: ["Your stomach has opinions.", "When did you last actually eat?"], tired: ["Your eyes feel sandy.", "Everything is a bit far away."],
  dirty: ["You can smell yourself a little. Others probably can too."], bladder: ["You really need the bathroom."],
  lonely: ["It's been a while since you talked to anyone.", "You could message Rin. The delay makes it easier somehow."],
  autism: ["The hum of the drones has edges today.", "Too many conversations layered over each other.", "You want the texture of clay, nothing else."],
  adhd: ["Wait, what were you about to do?", "Twelve tabs open in your head.", "You could reorganise the whole flat right now. Or not."],
  depression: ["Why bother.", "Even the good things feel behind glass.", "Getting up for the window feels like a lot. It might help."],
  anxiety: ["Did that sound weird earlier?", "Your chest is tight for no reason you can name.", "What if the shuttle's full."],
  pain: ["Your lower back is talking again.", "Sitting down would be a kindness."],
  good: ["This is a good day. Write that down somewhere.", "The light's nice. You notice it.", "You feel like making something."]
};

/* ---------------- State ---------------- */
let S = null;
function freshState(ch) {
  const bg = BACKGROUNDS[ch.bg] || BACKGROUNDS.drifter;
  const skills = { ceramic: .1, wood: .1, bread: .15, journal: .1, paint: .1, music: .1, cooking: .2, social: .2, garden: .1 };
  for (const k in bg.skills) skills[k] = bg.skills[k];
  if (ch.interest in skills) skills[ch.interest] = Math.max(skills[ch.interest], .3);
  const npcs = {};
  for (const id in NPCS) npcs[id] = { rel: id === "juno" || id === "pip" ? 10 : 0, notes: [], hist: [], met: false };
  return {
    v: 5, char: ch, stats: { tableMeals: 0, tableStreak: 0, lastTableDay: 0, sold: 0, earnedCraft: 0, commissions: 0, shifts: 0, harvests: 0, hub: 0, sunrise: 0, rinReplies: 0, tried: {}, threeMeals: 0 }, goalsDone: {},
    garden: [null, null, null, null], cat: null, settings: { deep: false, voice: true, keys: true, sound: true, music: true, vol: .8 }, warn: {}, t: 9 * 60, speed: 1, loc: "home", pos: { x: 2.4, z: -1.6 }, rot: 0,
    needs: { full: 46, energy: 82, hygiene: 62, bladder: 45, social: 52, fun: 50, comfort: 60 },
    stomach: 0, stress: ch.cond.anxiety ? 38 : 18, pain: ch.cond.pain ? 30 : 0, painBase: 30, sensory: 8, win: 0,
    weave: { wh: 32, max: 40, g: 20 }, moodlets: [], credits: 300,
    ledger: [{ t: 9 * 60, d: "Opening balance (UBI account)", a: 300 }],
    inv: { groceries: 2, clay: 1, wood: 0, flour: 1, paper: 1, canvas: 1, seeds: 2, catfood: 0, earbuds: 0 }, items: [], songs: 0, skills,
    hand: null, fridge: [], demand: { ceramic: 1, wood: 1, bread: 1, journal: 1, paint: 1 },
    commissions: [], board: [], kiln: [], npcs,
    mars: { msgs: [{ from: "rin", text: "Hey stranger. Jezero's dusty today, the dome filters are singing. Tell me something that happened to you that wasn't on a feed. — Rin", sent: 8 * 60, arrive: 8.5 * 60, read: false }] },
    log: [], flags: { earbuds: false, light: true, windowOpen: false, therapyDay: 0, harvestDay: 0, lastDayProcessed: 1, meds: false, medsDay: 0, plant: 70 },
    weatherDay: 0, weather: "clear", posture: "stand", asleep: false, deliveries: [], lastMealTable: 0, mealsToday: 0
  };
}

/* ---------------- Time helpers ---------------- */
const dayOf = t => Math.floor(t / DAY) + 1;
const hourOf = t => (t % DAY) / 60;
function dateOf(t) { return new Date(START_DATE + Math.floor(t / DAY) * 86400000); }
function fmtClock(t) { const m = Math.floor(t % DAY); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
function fmtDate(t) { const d = dateOf(t); return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · Day ${dayOf(t)}`; }
function fmtDur(m) { m = Math.max(0, Math.round(m)); if (m < 60) return m + "m"; const h = Math.floor(m / 60), r = m % 60; return h + "h" + (r ? " " + String(r).padStart(2, "0") + "m" : ""); }
const isMarketDay = t => dateOf(t).getUTCDay() === 6;
const isMusicNight = t => dateOf(t).getUTCDay() === 5 && hourOf(t) >= 19 && hourOf(t) < 23;
const isWeekend = t => { const w = dateOf(t).getUTCDay(); return w === 0 || w === 6; };

/* Sun for Lumen Reach (mid-latitude, October): rise ~06:52, set ~18:24 */
// Sun elevation (rough): 0 at sunrise/sunset, highest at solar noon, negative at night
function sunElev(t) {
  const h = hourOf(t), rise = 6.87, set = 18.4, noon = (rise + set) / 2, half = (set - rise) / 2, x = (h - noon) / half;
  return Math.abs(x) <= 1 ? Math.cos(x * Math.PI / 2) * 0.72 : -Math.min(.3, Math.sin(Math.min(1, Math.abs(x) - 1) * Math.PI / 2) * .3);
}
/* Halcyon: LEO, 92-minute orbit, ~36 min in Earth's shadow each orbit */
const ORBIT = 92;
function orbitPhase(t) { return (t % ORBIT) / ORBIT; }
function stationSunlit(t) { return orbitPhase(t) < 0.61; }
function nextOrbitalSunrise(t) { return ORBIT - (t % ORBIT); }
/* Earth–Mars distance from mean longitudes (circular-orbit approximation) */
function marsDelayMin(t) {
  const d = (START_DATE + t * 60000 - Date.UTC(2000, 0, 1, 12)) / 86400000;
  const le = (100.464 + 0.9856091 * d) * Math.PI / 180, lm = (355.433 + 0.5240384 * d) * Math.PI / 180;
  const ex = Math.cos(le), ey = Math.sin(le), mx = 1.5237 * Math.cos(lm), my = 1.5237 * Math.sin(lm);
  const au = Math.hypot(mx - ex, my - ey);
  return { au, min: au * 499.005 / 60 };
}
function weatherFor(day) { const r = mulberry(day * 7919 + 13)(); return r < .55 ? "clear" : r < .8 ? "cloudy" : "rain"; }
function crowd(t) {
  if (S.loc === "station") return .35;
  const h = hourOf(t); const g = (c, w, a) => a * Math.exp(-((h - c) ** 2) / (2 * w * w));
  let c = .06 + g(8.5, 1, .45) + g(12.5, 1.3, .85) + g(18, 1.6, .75) + g(15, 1.5, .35);
  if (isWeekend(t)) c *= 1.25; if (isMarketDay(t) && hourOf(t) > 8 && hourOf(t) < 17) c *= 1.2; if (S.weather === "rain") c *= .5;
  return clamp(c, 0, 1);
}

/* ---------------- Logging & moodlets ---------------- */
function logEv(text, kind = "info", toast = true) { S.log.push({ t: S.t, text, kind }); if (S.log.length > 160) S.log.shift(); if (toast) UI.toast(text, kind); }
function addMoodlet(id, label, v, hours) { S.moodlets = S.moodlets.filter(m => m.id !== id); S.moodlets.push({ id, label, v, until: S.t + hours * 60 }); }
function pay(amount, desc) { S.credits = Math.round((S.credits + amount) * 100) / 100; S.ledger.unshift({ t: S.t, d: desc, a: amount }); if (S.ledger.length > 60) S.ledger.pop(); }
function canAfford(a) { return S.credits >= a; }
function medsActive() { return !!(S.flags.meds && S.flags.medsDay === dayOf(S.t)); }
function smallWin(label) { S.win = Math.min(40, S.win + 9); if (label) addMoodlet("win-" + label, label, 3, 3); }

/* ---------------- Mood, motivation ---------------- */
function mood() {
  const n = S.needs, c = S.char.cond;
  let m = 50 + (n.full - 50) * .16 + (n.energy - 50) * .16 + (n.hygiene - 50) * .08 + (n.social - 50) * .1 + (n.fun - 50) * .12 + (n.comfort - 50) * .08;
  if (n.bladder > 70) m -= (n.bladder - 70) * .35;
  m -= S.stress * .22; if (c.pain) m -= S.pain * .18;
  if (c.autism && S.sensory > 55) m -= (S.sensory - 55) * .45;
  if (c.depression) m -= 11;
  for (const ml of S.moodlets) m += ml.v;
  return clamp(m, 0, 100);
}
function moodWord(m) { return m < 18 ? "Miserable" : m < 35 ? "Low" : m < 52 ? "Flat" : m < 68 ? "Okay" : m < 84 ? "Good" : "Bright"; }
function motivation() { return mood() + (S.needs.energy - 50) * .3 + S.win; }
/* Depression can stop effortful things from starting. Returns null if OK, or a message. */
function startBlocked(effort) {
  if (!S.char.cond.depression || !effort) return null;
  const p = clamp((effort * 26 - motivation() + 18) / 100, 0, .7) * (medsActive() ? .65 : 1);
  if (Math.random() < p) {
    S.win = Math.max(0, S.win - 2);
    return pick(["You stand there and can't make yourself start. Something smaller first might help.", "It feels like a mountain right now. A glass of water, the window, the plant — anything small.", "Not yet. Your body won't move toward it. That's not laziness; try a smaller step."]);
  }
  return null;
}

/* ---------------- Minute step ---------------- */
function noiseTarget() {
  const c = crowd(S.t);
  let tgt = S.loc === "home" ? 6 + (S.flags.windowOpen ? 6 : 0) : S.loc === "station" ? 30 : 18 + c * 70;
  if (Act.cur && Act.cur.loud) tgt += 25;
  if (S.flags.earbuds) tgt *= .45;
  return tgt;
}
function stepMinute() {
  const n = S.needs, c = S.char.cond, h = 1 / 60, asleep = S.asleep;
  S.t += 1;
  // digestion: food fills you over time, not instantly
  if (S.stomach > 0) { const a = Math.min(S.stomach, 16); S.stomach -= a; n.full = Math.min(115, n.full + a / 11); }
  n.full -= (asleep ? 2.8 : 6) * h;
  if (n.full > 100) { n.full -= 10 * h; n.comfort = Math.max(0, n.comfort - 12 * h); }
  // energy
  if (asleep) {
    let rate = 12.5; if (c.insomnia) rate = 8.2; if (S.stress > 60) rate *= .8; if (c.pain && S.pain > 50) rate *= .85;
    n.energy = Math.min(100, n.energy + rate * h);
  } else {
    let drain = 5.6 + (c.depression ? 1.1 : 0) + (c.pain ? S.pain * .02 : 0) + (Act.cur ? Act.cur.drain || 0 : 0);
    n.energy -= drain * h;
  }
  n.hygiene -= (asleep ? 1.4 : 3.4) * h;
  n.bladder += (asleep ? 3.2 : 6) * h;
  const withPeople = S.loc !== "home" && crowd(S.t) > .25;
  n.social -= (asleep ? .6 : withPeople ? 1.2 : c.autism ? 1.8 : 3.1) * h;
  n.fun -= (asleep ? .3 : 3.8) * h;
  const postureTarget = ({ stand: 52, sit: 78, lie: 90, walk: 55, work: 70, play: 50 }[S.posture] ?? 55) - (c.pain ? S.pain * .35 : 0);
  n.comfort = lerp(n.comfort, postureTarget, .03);
  // stress drifts toward a baseline shaped by needs
  let sBase = c.anxiety ? (medsActive() ? 24 : 32) : 14; if (n.full < 20) sBase += 10; if (n.energy < 20) sBase += 10; if (S.credits < 20) sBase += 12;
  if (c.anxiety && withPeople) sBase += crowd(S.t) * 18;
  if (c.anxiety && S.mars.msgs.some(m => m.from === "rin" && !m.read && m.arrive <= S.t)) sBase += 5;
  S.stress = lerp(S.stress, clamp(sBase, 0, 100), .012);
  // pain
  if (c.pain) {
    let pt = S.painBase; if (S.posture === "stand" || S.posture === "walk") pt += 8; if (S.posture === "lie") pt -= 12; if (S.posture === "sit") pt -= 5;
    if (Act.cur && Act.cur.strain) pt += Act.cur.strain;
    S.pain = clamp(lerp(S.pain, pt, .02), 0, 100);
  }
  // sensory load
  if (c.autism) {
    const tgt = noiseTarget();
    S.sensory = clamp(lerp(S.sensory, tgt, tgt > S.sensory ? .035 : .018), 0, 100);
    if (S.sensory >= 96 && !(Act.cur && Act.cur.id === "shutdown")) shutdown();
  }
  // weave recharge: induction mattress while asleep, trickle otherwise
  S.weave.wh = Math.min(S.weave.max, S.weave.wh + (asleep && S.loc === "home" ? 6 : .4) * h);
  S.win = Math.max(0, S.win - 4 * h);
  for (const k in n) n[k] = clamp(n[k], k === "full" ? -5 : 0, k === "full" ? 115 : 100);
  // food cools, fridge spoils
  if (S.hand && S.hand.kind === "meal" && S.hand.hot && S.t - S.hand.made > 40) { S.hand.hot = false; if (!asleep) logEv("Your food has gone cold.", "info"); }
  // gentle warnings, once per crossing
  const W = S.warn || (S.warn = {});
  const warnAt = (key, cond, reset, text) => { if (cond && !W[key]) { W[key] = 1; if (!asleep) { logEv(text, "bad"); Sound.alert(); } } else if (reset) W[key] = 0; };
  warnAt("bladder", n.bladder > 76, n.bladder < 40, "You'll need a bathroom soon.");
  warnAt("hungry", n.full < 22, n.full > 45, "You're getting hungry.");
  warnAt("tired", n.energy < 18, n.energy > 40, "You're running low on energy. Sleep or rest soon.");
  // consequences
  if (n.bladder >= 100) { n.bladder = 0; n.hygiene = 0; addMoodlet("accident", "Had an accident", -22, 10); logEv("You didn't make it to the bathroom in time. Shower, change, and let it go.", "bad"); }
  if (!asleep && n.energy <= 0 && !(Act.cur && (NEVER_INTERRUPT.has(Act.cur.id) || Act.cur.id === "sleep" || Act.cur.id === "nap"))) {
    Act.cancel(true);
    if (S.loc === "home" && typeof sleepAction === "function") { logEv("You're running on nothing. You make it to bed and you're out.", "bad"); sleepAction(true); }
    else { logEv("You're too exhausted to stay upright. You sit down where you are and doze.", "bad"); Act.sleepAnywhere(); }
  }
  if (n.full < 8 && Math.random() < .004) addMoodlet("starving", "Running on empty", -12, 2);
  // scheduled stuff
  S.moodlets = S.moodlets.filter(m => m.until > S.t);
  for (const m of S.mars.msgs) if (!m.notified && m.from === "rin" && m.arrive <= S.t) { m.notified = true; logEv("New message from Rin on Mars (read it at your desk terminal).", "info"); }
  for (const d of S.deliveries.slice()) if (d.at <= S.t) { S.deliveries.splice(S.deliveries.indexOf(d), 1); S.inv[d.item] = (S.inv[d.item] || 0) + d.qty; logEv(`A delivery drone dropped off ${MATERIALS[d.item].name.toLowerCase()} ×${d.qty} at your door.`, "good"); }
  if (dayOf(S.t) !== S.flags.lastDayProcessed && hourOf(S.t) >= 6) newDay();
  if (!asleep && S.t % 45 === 0 && Math.random() < .55) innerThought();
}
function newDay() {
  const d = dayOf(S.t); S.flags.lastDayProcessed = d;
  S.weather = weatherFor(d);
  if (dateOf(S.t).getUTCDay() === 1) { pay(840, "Universal Basic Income — weekly deposit"); logEv("UBI deposited: ₵840 for the week.", "good"); }
  for (const k in S.demand) S.demand[k] = Math.min(1.2, S.demand[k] + .07);
  if (S.char.cond.pain) { S.painBase = Math.random() < .25 ? 55 : Math.random() < .5 ? 34 : 24; if (S.painBase > 50) logEv("Your back woke up angry today. A bad pain day.", "bad"); }
  // kiln: greenware left yesterday is fired overnight
  for (const k of S.kiln) { k.state = "done"; S.items.push(k); }
  if (S.kiln.length) logEv(`Mara's kiln finished overnight: ${S.kiln.length} bowl${S.kiln.length > 1 ? "s" : ""} ready.`, "good");
  S.kiln = [];
  // bread goes stale
  for (const it of S.items) if (it.cat === "bread") it.q = Math.max(.05, it.q - (d - it.day > 1 ? .12 : 0));
  S.items = S.items.filter(it => !(it.cat === "bread" && d - it.day > 4));
  S.fridge = S.fridge.filter(f => d - dayOf(f.made) <= 3);
  // expire commissions
  for (const cm of S.commissions.slice()) if (cm.due < d) { S.commissions.splice(S.commissions.indexOf(cm), 1); logEv(`You missed the commission for ${cm.from}. They found something else.`, "bad"); }
  if (S.mealsToday >= 3) S.stats.threeMeals++;
  dailyExtras(d);
  makeBoard(); S.mealsToday = 0;
  S.flags.plant = Math.max(0, S.flags.plant - 18);
}
function makeBoard() {
  const r = mulberry(dayOf(S.t) * 131 + 7); const names = ["Halvorsen family", "Station school", "Co-op kitchen", "Lio from block C", "Tamsin (wedding)", "Hydroponics crew", "Old Mr. Adebayo", "The night-shift nurses"];
  const cats = Object.keys(CRAFTS); S.board = [];
  for (let i = 0; i < 2; i++) { const cat = cats[Math.floor(r() * cats.length)], base = CRAFTS[cat].base; S.board.push({ id: "b" + dayOf(S.t) + i, from: names[Math.floor(r() * names.length)], cat, price: Math.round(base * (1.15 + r() * .6)), due: dayOf(S.t) + 2 + Math.floor(r() * 3), note: pick(["something to give my mum", "for the common room shelf", "a gift that someone actually made", "nothing fancy, just yours", "we want the human-made one"]) }); }
}
function innerThought() {
  const n = S.needs, c = S.char.cond, pool = [];
  if (n.full < 25) pool.push(...THOUGHTS.hungry); if (n.energy < 25) pool.push(...THOUGHTS.tired);
  if (n.hygiene < 25) pool.push(...THOUGHTS.dirty); if (n.bladder > 75) pool.push(...THOUGHTS.bladder); if (n.social < 25) pool.push(...THOUGHTS.lonely);
  for (const k of ["autism", "adhd", "depression", "anxiety", "pain"]) if (c[k]) pool.push(...THOUGHTS[k]);
  if (mood() > 72) pool.push(...THOUGHTS.good);
  pool.push(...THOUGHTS.base);
  UI.thought(pick(pool));
}
function shutdown() {
  Act.cancel(true);
  addMoodlet("overload", "Sensory shutdown", -16, 3);
  logEv("Too much. Everything goes loud and flat at once. You need to get somewhere quiet.", "bad");
  Act.start({ id: "shutdown", name: "Shutting down — can't do anything but breathe", min: 25, posture: "sit", noCancel: true, tick: () => { S.sensory -= 1.2; S.needs.energy -= .1; }, done: () => logEv("It passes enough to move. Home or earbuds would help.", "info") });
}

/* ---------------- Activities ---------------- */
const EFFORTFUL = new Set(["craft", "gig", "song", "study", "job", "volunteer", "busk", "stall", "run", "workout", "garden", "shelterv", "catplay", "musicnight", "hub", "harvest"]);
const NEVER_INTERRUPT = new Set(["toilet", "travel", "shuttle", "shutdown", "collapse"]);
const Act = {
  cur: null,
  start(a) {
    if (this.cur) return false;
    this.cur = Object.assign({ elapsed: 0, loc0: S.loc }, a);
    if (a.posture) S.posture = a.posture;
    if (a.sleep) S.asleep = true;
    Sound.actStart(this.cur);
    if (a.anchor) { this.cur.prev = { x: S.pos.x, z: S.pos.z }; World.placePlayer(a.anchor); }
    World.setPose(a.anchor && a.anchor.pose ? a.anchor.pose : a.posture === "sit" ? "floor" : (a.posture || "stand"));
    UI.activity(); return true;
  },
  tick() {
    const a = this.cur; if (!a) return;
    a.elapsed += 1;
    const n = S.needs;
    if (a.selfCare) { if (n.bladder > 78) { n.bladder = 4; if (!a.usedLoo) { a.usedLoo = 1; logEv("You use the shuttle's little bathroom. Zero-g plumbing is an experience.", "info", false); } } if (n.full < 30 && !a.snack) { a.snack = 1; S.stomach += 320; logEv("The crew hands out snack packs. You eat yours.", "info", false); } }
    else if (!a.noCancel) {
      // Needs only interrupt effortful things. Eating, cooking, resting, washing,
      // the bathroom and getting somewhere are never blocked by the need they help with.
      let why = null;
      const effort = EFFORTFUL.has(a.id);
      if (n.bladder >= 92 && !NEVER_INTERRUPT.has(a.id)) why = a.id === "sleep" || a.id === "nap" ? "You wake up needing the bathroom." : "You need the bathroom. You stop what you're doing.";
      else if (n.full < 5 && effort) why = "You're too hungry to keep going. Eat something.";
      else if (n.energy < 3 && effort) why = "You're too exhausted to keep going. Rest or sleep.";
      if (why) { this.cancel(true); logEv(why, "bad"); Sound.alert(); return; }
    }
    if (a.tick) a.tick(a);
    if (a.adhdDrift && S.char.cond.adhd && !a.drifted && a.elapsed > a.min * .3 && Math.random() < (medsActive() ? .005 : .012)) {
      a.drifted = true;
      if (Math.random() < .55) { const lost = Math.round(rnd(15, 40)); a.min += lost; logEv(pick(["You got pulled into reading about tidal locking.", "You started reorganising a drawer mid-task.", "A video about deep-sea vents. Then another."]) + ` ${lost} minutes gone.`, "info"); }
      else { a.hyper = true; logEv("Hyperfocus. The world narrows to your hands. (Better work, but you won't notice hunger.)", "good"); }
    }
    if (a.elapsed >= a.min) this.finish();
  },
  restore(a) { if (a.prev && S.loc === a.loc0) { S.pos.x = a.prev.x; S.pos.z = a.prev.z; } },
  finish() { const a = this.cur; this.cur = null; S.asleep = false; Sound.actEnd(a, true); this.restore(a); if (a.done) a.done(a); if (!this.cur) { S.posture = "stand"; World.setPose("stand"); } UI.activity(); },
  cancel(force) {
    const a = this.cur; if (!a) return; if (a.noCancel && !force) { UI.toast("You can't stop this right now.", "bad"); return; }
    this.cur = null; S.asleep = false; Sound.actEnd(a, false); this.restore(a); if (a.partial) a.partial(a); S.posture = "stand"; World.setPose("stand"); UI.activity();
  },
  sleepAnywhere() { this.start({ id: "collapse", name: "Dozing where you sat", min: 90, sleep: true, posture: "sit", noCancel: true, done: () => addMoodlet("collapse", "Passed out somewhere odd", -8, 8) }); }
};

/* ---------------- Food ---------------- */
function makeMeal(name, kcal, q, hot = true) { return { kind: "meal", name, kcal, q, hot, made: S.t }; }
function eat(where) {
  const m = S.hand; if (!m || m.kind !== "meal") return;
  const sitting = where === "table";
  const min = sitting ? 20 : 8;
  Act.start({
    id: "eat", name: (sitting ? "Eating at the table: " : "Eating standing up: ") + m.name, min, posture: sitting ? "sit" : "stand", anchor: World.anchorFor(where), social: where === "cafe",
    tick: a => { S.stomach += m.kcal / min; if (S.needs.bladder < 100) S.needs.bladder += .15; },
    done: () => {
      S.hand = null; S.mealsToday++;
      let v = Math.round((m.q - .4) * 14);
      if (!m.hot) v -= 3;
      if (sitting) { v += 5; S.needs.comfort += 6; S.stats.tableMeals++; const td = dayOf(S.t); if (S.stats.lastTableDay !== td) { S.stats.tableStreak = S.stats.lastTableDay === td - 1 ? S.stats.tableStreak + 1 : 1; S.stats.lastTableDay = td; } addMoodlet("meal", m.hot ? "Sat down for a proper meal" : "Sat down to eat (it was cold)", v, 4); S.lastMealTable = S.t; }
      else addMoodlet("meal", "Ate standing at the counter", v - 4, 3);
      if (where === "cafe" || where === "galley") { S.needs.social += 6; S.needs.fun += 4; }
      smallWin(); UI.hand();
      if (S.char.cond.depression && sitting) S.win += 6;
      logEv(sitting ? "You finish eating. It'll settle in over the next half hour." : "Done. Eating standing up never quite feels like a meal.", "info", false);
    },
    partial: a => { const eaten = a.elapsed / min; if (eaten < .95) { m.kcal *= (1 - eaten); UI.hand(); } }
  });
}

/* ---------------- Crafting ---------------- */
function craftQuality(cat) {
  const sk = S.skills[cat] || .1; const m = mood();
  let q = .22 + sk * .55 + (m - 50) / 400 + rnd(-.1, .1);
  if (S.char.interest === cat) q += .12;
  if (S.char.cond.autism && S.char.interest === cat) q += .05;
  if (S.char.cond.pain && CRAFTS[cat] && CRAFTS[cat].fine) q -= S.pain / 600;
  if (S.char.cond.autism && S.sensory > 60) q -= .08;
  return clamp(q, .05, 1);
}
function startCraft(cat) {
  const C = CRAFTS[cat];
  if ((S.inv[C.mat] || 0) < 1) return UI.toast(`You need ${MATERIALS[C.mat].name.toLowerCase()}.`, "bad");
  const blocked = startBlocked(C.effort); if (blocked) return UI.toast(blocked, "bad");
  S.inv[C.mat]--;
  const interest = S.char.interest === cat;
  Act.start({
    id: "craft", cat, name: C.verb, min: C.min, posture: C.where === "bench" ? "sit" : "stand", anchor: World.anchorFor(C.where), adhdDrift: true, strain: C.fine ? 10 : 6, drain: 1,
    tick: a => { if (!a.hyper) S.needs.fun += (interest ? .12 : .06); S.stress -= .04; if (a.hyper) { S.needs.full -= .04; } },
    done: a => {
      let q = craftQuality(cat); if (a.hyper) q = Math.min(1, q + .12);
      S.skills[cat] = Math.min(1, (S.skills[cat] || .1) + .045 * (1 - (S.skills[cat] || .1)) * (interest ? 1.4 : 1));
      S.stats.tried[cat] = 1;
      const it = { id: "i" + S.t + Math.floor(Math.random() * 999), cat, name: C.name, q, trait: pick(C.traits), day: dayOf(S.t), keep: false, state: cat === "ceramic" ? "greenware" : "done" };
      if (cat === "ceramic") { S.items.push(it); logEv(`You threw a bowl: ${it.trait}. It's greenware now; it needs Mara's kiln (about 0.25 kWh to reach 1000 °C, far beyond what your weave stores).`, "good"); }
      else { S.items.push(it); logEv(`Finished: ${C.name.toLowerCase()} with ${it.trait}. Quality ${qWord(q)}.`, "good"); }
      addMoodlet("made", "Made something with my hands", interest ? 9 : 6, 6); smallWin();
    },
    partial: () => { S.inv[C.mat]++; UI.toast("You set it aside. Materials are still usable.", "info"); }
  });
}
const qWord = q => q < .3 ? "rough" : q < .5 ? "decent" : q < .7 ? "good" : q < .85 ? "lovely" : "exceptional";
function priceFor(it, buyer) {
  let p = CRAFTS[it.cat].base * (.45 + it.q * 1.25) * S.demand[it.cat] * rnd(.88, 1.12);
  if (buyer && buyer.likes === it.cat) p *= 1.15;
  if (buyer && it.trait.includes(buyer.word)) p *= 1.3;
  if (isMarketDay(S.t)) p *= 1.2;
  return Math.max(4, Math.round(p));
}

/* ---------------- Save / load ----------------
   Several lives can exist side by side. Each is saved on this device
   (localStorage) and, when the page runs inside Claude, to the player's
   account as well (the artifact "db" capability). */
const LIFE_PREFIX = "lumen-life-", LIVES_INDEX = "lumen-lives", LEGACY_KEY = "lumen-reach-life-v3";
function trimState() {
  if (S.log.length > 90) S.log.splice(0, S.log.length - 90);
  for (const id in S.npcs) { const h = S.npcs[id].hist; if (h.length > 26) h.splice(0, h.length - 26); }
  if (S.mars.msgs.length > 30) S.mars.msgs.splice(0, S.mars.msgs.length - 30);
}
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { } };
function livesIndex() { try { return JSON.parse(lsGet(LIVES_INDEX) || "{}"); } catch (e) { return {}; } }
function save(force) {
  if (!S || !S.char || S.char.name === "You") return;
  if (!S.slot) S.slot = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  trimState(); S.savedAt = Date.now();
  if (lsSet(LIFE_PREFIX + S.slot, JSON.stringify(S))) {
    const idx = livesIndex(); idx[S.slot] = { name: S.char.name, day: dayOf(S.t), savedAt: S.savedAt }; lsSet(LIVES_INDEX, JSON.stringify(idx));
    if (S.legacy) { lsDel(LEGACY_KEY); Cloud.remove("lifesave"); delete S.legacy; }
    if (Cloud.state !== "ok") UI.saved("device");
  }
  Cloud.save(force);
}
function migrate(o) {
  if (!o || !o.char || ![3, 4, 5].includes(o.v)) return null;
  const f = freshState(o.char);
  for (const k in f) if (o[k] === undefined) o[k] = f[k];
  for (const k of ["stats", "inv", "skills", "demand"]) for (const j in f[k]) if (o[k][j] === undefined) o[k][j] = f[k][j];
  for (const k in f.npcs) if (!o.npcs[k]) o.npcs[k] = f.npcs[k];
  o.settings = Object.assign({}, f.settings, o.settings || {});
  if (o.v === 3) o.settings.voice = true;
  o.v = 5; return o;
}
/* All saved lives, newest first: [{ key, name, day, savedAt, where, slot }] */
async function listLives() {
  const out = new Map();
  const idx = livesIndex();
  for (const slot in idx) out.set(slot, { key: "d:" + slot, slot, where: "device", ...idx[slot] });
  const leg = lsGet(LEGACY_KEY); if (leg) { try { const o = JSON.parse(leg); out.set("legacy", { key: "legacy", slot: null, where: "device", name: o.char.name, day: dayOf(o.t), savedAt: o.savedAt || 0 }); } catch (e) { } }
  for (const c of await Cloud.list()) {
    const slot = c.id === "lifesave" ? "legacy-cloud" : c.id.replace(/^life-/, ""), mine = out.get(slot);
    if (!mine || (c.savedAt || 0) > (mine.savedAt || 0)) out.set(slot, { key: "c:" + c.id, slot: c.id === "lifesave" ? null : slot, where: "account", name: c.name, day: c.day, savedAt: c.savedAt || 0 });
    else mine.where = "account";
  }
  return [...out.values()].filter(l => l.name).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}
async function loadLife(l) {
  let raw = null;
  if (l.key === "legacy") raw = lsGet(LEGACY_KEY);
  else if (l.key.startsWith("d:")) raw = lsGet(LIFE_PREFIX + l.slot);
  else if (l.key.startsWith("c:")) raw = await Cloud.get(l.key.slice(2));
  let o = null; try { o = migrate(JSON.parse(raw)); } catch (e) { o = null; }
  if (!o) return null;
  if (!l.slot) o.legacy = true; else o.slot = l.slot;
  return o;
}
async function deleteLife(l) {
  if (l.key === "legacy") lsDel(LEGACY_KEY);
  if (l.slot) { lsDel(LIFE_PREFIX + l.slot); const idx = livesIndex(); delete idx[l.slot]; lsSet(LIVES_INDEX, JSON.stringify(idx)); await Cloud.remove("life-" + l.slot); }
  if (l.key === "c:lifesave") await Cloud.remove("lifesave");
}
const Cloud = {
  db: null, uid: null, state: "pending", last: 0, inflight: false,
  async init() {
    try {
      if (!window.claude || !window.claude.use) { this.state = "none"; return; }
      const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
      if (!db || !user) { this.state = "none"; return; }
      const id = await user.id(); if (!id) { this.state = "none"; return; }
      this.db = db; this.uid = id; this.state = "ok";
    } catch (e) { this.state = "none"; }
  },
  doc(id) { return this.db.doc("data/users/" + this.uid + "/" + id); },
  async list() {
    if (this.state !== "ok") return [];
    try { const q = await this.db.collection("data/users/" + this.uid).get(); return q.docs.filter(d => d.id === "lifesave" || d.id.startsWith("life-")).map(d => { const x = d.data() || {}; return { id: d.id, name: x.name, day: x.day, savedAt: x.savedAt }; }); }
    catch (e) { return []; }
  },
  async get(id) { if (this.state !== "ok") return null; try { const d = await this.doc(id).get(); return d.exists ? d.data().json : null; } catch (e) { return null; } },
  async save(force) {
    if (this.state !== "ok" || !S || !S.slot) return; const now = Date.now();
    if (this.inflight || (!force && now - this.last < 20000)) return; this.last = now; this.inflight = true;
    try { await this.doc("life-" + S.slot).set({ json: JSON.stringify(S), savedAt: S.savedAt || now, name: S.char.name, day: dayOf(S.t) }); UI.saved("account"); }
    catch (e) { UI.saved("device"); }
    this.inflight = false;
  },
  async remove(id) { if (this.state !== "ok") return; try { await this.doc(id).delete(); } catch (e) { } }
};
