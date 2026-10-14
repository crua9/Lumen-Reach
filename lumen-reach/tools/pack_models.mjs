/* Model packing script used to make assets/models/*.glb from the original
   KayKit and three.js example files (run with Node + @gltf-transform/core,
   @gltf-transform/functions). Expects the source packs cloned into ./a/... */
import { NodeIO, Document } from '@gltf-transform/core';
import { prune, dedup, mergeDocuments, unpartition } from '@gltf-transform/functions';
import fs from 'fs'; import path from 'path';
const io = new NodeIO();
const OUT = 'out'; fs.mkdirSync(OUT, { recursive: true });
const KEEP_ANIMS = ['Unarmed_Idle','Idle','Walking_A','Walking_B','Walking_C','Running_A','Running_B','Sit_Chair_Down','Sit_Chair_Idle','Sit_Chair_StandUp','Sit_Floor_Down','Sit_Floor_Idle','Sit_Floor_StandUp','Lie_Down','Lie_Idle','Lie_StandUp','Interact','Use_Item','PickUp','Cheer','Hit_A','Jump_Idle','Jump_Full_Short','Spellcasting','Throw','Walking_Backwards','Unarmed_Pose','Dodge_Forward'];
function killAnim(a){ for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()){ s.dispose(); } a.dispose(); }
const PART = /_(ArmLeft|ArmRight|Body|Head|Head_Hooded|LegLeft|LegRight)$/;
for (const nm of ['Rogue','Rogue_Hooded','Mage','Knight','Barbarian']) {
  const doc = await io.read(`a/chars/${nm}.glb`);
  for (const n of doc.getRoot().listNodes()) if (n.getMesh() && !PART.test(n.getName())) n.dispose();
  if (nm === 'Rogue') {
    const ad = await io.read(`a/chars/${nm}.glb`);
    for (const a of ad.getRoot().listAnimations()) if (!KEEP_ANIMS.includes(a.getName())) killAnim(a);
    for (const n of ad.getRoot().listNodes()) if (n.getMesh()) n.dispose();
    for (const s of ad.getRoot().listSkins()) s.dispose();
    await ad.transform(prune(), prune());
    await io.write(`${OUT}/anims.glb`, ad);
  }
  for (const a of doc.getRoot().listAnimations()) killAnim(a);
  await doc.transform(prune(), dedup());
  await io.write(`${OUT}/char_${nm}.glb`, doc);
}
// prop packs
async function packDir(dir, names, outName) {
  const files = names || fs.readdirSync(dir).filter(f => f.endsWith('.gltf') || f.endsWith('.glb')).map(f => f.replace(/\.(gltf|glb)$/, ''));
  const target = new Document(); target.createBuffer();
  const scene = target.createScene('props');
  for (const f of files) {
    const p = fs.existsSync(`${dir}/${f}.gltf`) ? `${dir}/${f}.gltf` : `${dir}/${f}.glb`;
    if (!fs.existsSync(p)) { console.log('missing', p); continue; }
    const d = await io.read(p);
    const sc = d.getRoot().listScenes()[0];
    const wrap = d.createNode(f);
    for (const c of sc.listChildren()) { sc.removeChild(c); wrap.addChild(c); }
    sc.addChild(wrap);
    const map = mergeDocuments(target, d);
    const ws = map.get(sc);
    for (const c of ws.listChildren()) { ws.removeChild(c); scene.addChild(c); }
    ws.dispose();
  }
  target.getRoot().setDefaultScene(scene);
  await target.transform(unpartition(), dedup(), prune());
  await io.write(`${OUT}/${outName}.glb`, target);
  console.log(outName, files.length, (fs.statSync(`${OUT}/${outName}.glb`).size / 1024).toFixed(0) + 'KB');
}
await packDir('a/city', null, 'city');
await packDir('a/furn', null, 'furn');
const rest = fs.readdirSync('a/rest').filter(f => f.endsWith('.gltf')).map(f => f.replace('.gltf', '')).filter(f => !/burger|ingredient_bun|_trash|ketchup|mustard|pan_006|uncooked/.test(f));
await packDir('a/rest', rest, 'rest');
const space = fs.readdirSync('a/space').filter(f => f.endsWith('.gltf')).map(f => f.replace('.gltf', '')).filter(f => !/terrain|tunnel|rock|lander|drill|spacetruck|landingpad|windturbine/.test(f));
await packDir('a/space', space, 'space');
await packDir('a/kc', ['pavement-fountain', 'grass-trees', 'grass-trees-tall'], 'kc');
fs.copyFileSync('a/misc/RobotExpressive.glb', `${OUT}/robot.glb`);
for (const f of fs.readdirSync(OUT)) console.log(f.padEnd(24), (fs.statSync(`${OUT}/${f}`).size / 1024).toFixed(0) + 'KB');
