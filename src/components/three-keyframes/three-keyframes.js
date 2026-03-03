import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import Stats from 'three/addons/libs/stats.module.js';

const container = document.getElementById('three-keyframes-container');
const width = 280;
const height = 280;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.domElement.setAttribute('tabindex', '0');
renderer.domElement.setAttribute('aria-label', '3D view – drag to orbit');
container.appendChild(renderer.domElement);

const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0';
stats.dom.style.left = '0';
container.appendChild(stats.dom);

const scene = new THREE.Scene();

const sky = new Sky();
const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 0;
skyUniforms['rayleigh'].value = 3;
skyUniforms['mieDirectionalG'].value = 0.7;
skyUniforms['sunPosition'].value.set(-0.8, 0.19, 0.56);
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(sky).texture;
scene.background = envMap;
scene.environment = envMap;

const camera = new THREE.PerspectiveCamera(40, width / height, 1, 100);
camera.position.set(5, 2, 8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.7, 0);
controls.update();

let mixer = null;
let animationId = null;
let lastTime = 0;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const modelUrl = 'https://threejs.org/examples/models/gltf/LittlestTokyo.glb';

gltfLoader.load(
  modelUrl,
  (gltf) => {
    const model = gltf.scene;
    model.position.set(1, 1, 0);
    model.scale.set(0.01, 0.01, 0.01);
    scene.add(model);

    mixer = new THREE.AnimationMixer(model);
    if (gltf.animations && gltf.animations[0]) {
      mixer.clipAction(gltf.animations[0]).play();
    }

    lastTime = performance.now() / 1000;
    animationId = renderer.setAnimationLoop(animate);
  },
  undefined,
  (err) => console.error('GLTF load error:', err)
);

function animate(time) {
  const t = time / 1000;
  const delta = t - lastTime;
  lastTime = t;

  if (mixer) mixer.update(delta);
  controls.update();
  stats.update();
  renderer.render(scene, camera);
}

const root = container.closest('[data-component="three-keyframes"]');
if (root) {
  root.setAttribute('tabindex', '0');
  root.addEventListener('click', (e) => {
    if (!e.target.closest('a')) renderer.domElement.focus();
  });
}
