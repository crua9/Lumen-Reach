/* esbuild entry used to make js/vendor/three.bundle.min.js:
   npx esbuild tools/vendor_entry.js --bundle --minify --format=iife --outfile=js/vendor/three.bundle.min.js
   (three@0.160.0) */
import * as THREE_ from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const THREE = Object.assign({}, THREE_, { GLTFLoader, SkeletonUtils, BufferGeometryUtils, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, GTAOPass, Sky, RoomEnvironment });
window.THREE = THREE;
