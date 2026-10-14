# Lumen Reach

A cozy near-future life sim that runs in a web browser. You make a character and live their days in a small town in 2147, with a ring station overhead and a friend on Mars.

The game's focus is meaning over magic. Food fills you up slowly as you digest it, and eating at a table feels better than eating standing at the counter. Basic income covers the basics, and you earn more by making things by hand. Nanites look like magic but run on stored watt-hours and grams of feedstock. Orbits, light delay and spin gravity use real numbers.

You can turn on real-world conditions, and each one changes how the game plays:

- **Autism:** sensory load, social cost, and special interests.
- **ADHD:** needs fade out of view, and tasks drift or turn into hyperfocus.
- **Depression:** effortful things can refuse to start, and small wins help.
- **Anxiety:** stress from crowds and unread messages.
- **Chronic pain:** good and bad days, and posture matters.
- **Insomnia:** falling asleep takes a while.

This started as a test of how far an AI can get building a game in a few sessions. It's released as a starting point that people, and their AIs, can build on.

## Play it

- **Online:** turn on GitHub Pages for this repo (Settings → Pages → Deploy from branch → `main` / root). The game will then be at `https://<you>.github.io/<repo>/`.
- **Locally:** run `python3 -m http.server 8000` in this folder and open `http://localhost:8000`.
  - Opening `index.html` straight from disk won't work, because browsers block loading the 3D models from `file://`.
- **One file:** `python3 tools/build_single_file.py` writes `dist/lumen-reach.html` with everything embedded (about 5 MB).

### Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Walk | WASD or arrow keys | Drag on the left side of the screen |
| Run | Hold Shift, or R to toggle | Run button |
| Look around | Drag with the mouse; Z / C | Drag on the right side |
| Zoom | Mouse wheel | Pinch |
| Use, talk | E | Use button, or tap the prompt |
| Things / journal / weave | I / J / N | ☰ menu |
| Breathe, earbuds, lights | B / H / L | ☰ menu |
| Check in with your body | Hold Tab | ☰ menu |
| Time speed | Space (pause), 1, 2, 3 | Buttons under the clock |

## Talking to people

Townspeople answer what you actually type. Who writes their replies depends on where the game runs:

1. **Inside Claude** (as a Claude artifact): Claude voices them, using the player's own Claude plan.
2. **A model you connect:** go to Journal → Settings → *Connect your own AI model*. It works with any OpenAI-compatible chat endpoint (OpenAI, OpenRouter, local LM Studio or Ollama, and so on) or Anthropic's Messages API. The key is stored only in that browser.
3. **No AI:** short built-in replies.

All of this lives in `js/ai.js`. To add another provider, add a branch to `send()`.

Romance can happen between characters. Anything sexual stays off-screen.

## Saving

Saves live in the browser's `localStorage`, and you can keep several lives at once. When the game runs as a Claude artifact, it also saves to the player's Claude account, so the same life continues on another device.

## How the code is laid out

Plain JavaScript with no build step. The scripts load in this order (see `index.html`):

| File | What it does |
|---|---|
| `js/vendor/three.bundle.min.js` | three.js r160 plus the add-ons used (GLTFLoader, SkeletonUtils and others), as one global `THREE` |
| `js/people.js` | Loads the models. Builds characters from mixed parts (head, body, arms and legs from different models on one skeleton), recolours outfits by rewriting texture swatches, and sets animation poses. Also builds the robots. |
| `js/core.js` | The simulation: time, needs, digestion, mood, conditions, the activity system (`Act`), food, crafting, prices, and saving and loading lives. One game minute passes per tick. |
| `js/audio.js` | Ambience, footsteps, effects and music, all generated with WebAudio. Voices use the browser's speech synthesis. |
| `js/extras.js` | Garden growth, daily world changes, goals, and business hours. |
| `js/ai.js` | Picks who voices the townspeople (see above). |
| `js/world.js` | The three.js scenes (home, plaza, Halcyon station), camera, movement and collision, lighting by time of day, NPC movement, cat, signs, and anchors. |
| `js/actions.js` | Everything you can do with each object. `getActions(id)` returns the menu for an interactable. |
| `js/ui.js` | HUD, menus, drawers, conversations, journal, character creator, input (keyboard and touch), and the main loop. |

### Key ideas, for anyone extending it

- **Activities.** Everything that takes time is an `Act.start({...})` with a duration in game minutes, `tick` and `done` callbacks, an optional `anchor` (where the body goes) and flags. Needs only interrupt activities in the `EFFORTFUL` set. Eating, cooking, the bathroom and travel are never blocked by the need they fix.
- **Anchors.** Each anchor describes the furniture, not the body. For `sit` it's the seat centre plus seat height. For `lie` it's the mattress centre, the mattress height, and the direction the head points. `World.placePlayer` offsets the character so the hips land on the seat or mattress, using measured animation poses.
- **Adding something to do.** Add an interactable in a scene (`sc.inter.push({ id, name, x, z, r })` in `world.js`), then add a `case "id":` in `getActions` in `actions.js`.
- **Adding a townsperson.** Add an entry to `NPCS` or `TOWNSFOLK` in `core.js`. It needs a `model` (a look: `body`, `head`, `extra` and a `pal` colour palette), a `persona`, `hours` and a `spot`.
- **Time.** At 1× speed, one game minute passes every 2 real seconds. Long activities fast-forward.

### Ideas for next steps

- Walk-in interiors for the café, wellness center, market and studio.
- Proper daily routines for townspeople (home, work, lunch, errands) with pathfinding.
- A household robot that cooks, does chores and reminds you about things.
- More character variety. There are five base models, so the faces are limited.
- Stronger condition effects: sensory overload shown on screen, a social battery, masking in conversation.
- Real furniture models in the home. The KayKit Furniture and Restaurant packs fit this style.

## Credits

See [CREDITS.md](CREDITS.md). The code is MIT licensed ([LICENSE](LICENSE)). The 3D models are CC0 (public domain).
