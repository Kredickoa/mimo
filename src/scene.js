import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** GLB renderer for the product page. */
export class LampScene {
  constructor(canvas, { floating = false, onReady = () => {}, onError = () => {} } = {}) {
    this.canvas = canvas;
    this.target = { light: 0, color: new THREE.Color('#bd1729') };
    this.lightLevel = 0;
    this.exploded = 0;
    this.brightness = 0.75;
    this.pose = { x: 0, y: 0, rotation: 0, tilt: 0, scale: 1 };
    this.frame = 0;
    this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.86;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
    this.camera.position.set(0, 2.45, 9.6);
    this.camera.lookAt(0, 2.05, 0);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.30;

    this.key = new THREE.DirectionalLight('#fff5e8', 1.25);
    this.key.position.set(-3.5, 7, 5);
    this.key.target.position.set(0, 2.05, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    Object.assign(this.key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16 });
    this.key.shadow.normalBias = 0.012;
    this.key.shadow.bias = -0.00015;
    this.scene.add(this.key.target);
    this.scene.add(this.key);
    this.fill = new THREE.DirectionalLight('#fff4e4', 0.45);
    this.fill.position.set(4, 3, 5);
    this.scene.add(this.fill);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.3);
    this.scene.add(this.ambient);
    this.warmLight = new THREE.PointLight('#ffc778', 0, 9, 2);
    this.warmLight.position.set(0, 2.1, 0.8);
    this.scene.add(this.warmLight);
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      const index = (y * 64 + x) * 4;
      pixels[index] = 45; pixels[index + 1] = 28; pixels[index + 2] = 26;
      pixels[index + 3] = Math.round(Math.max(0, 1 - radius) ** 2 * 120);
    }
    this.contactTexture = new THREE.DataTexture(pixels, 64, 64);
    this.contactTexture.magFilter = THREE.LinearFilter;
    this.contactTexture.minFilter = THREE.LinearFilter;
    this.contactTexture.needsUpdate = true;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.9), new THREE.MeshBasicMaterial({ map: this.contactTexture, transparent: true, depthWrite: false }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.03;
    this.floor.receiveShadow = true;
    this.floor.visible = !floating;
    this.scene.add(this.floor);

    // Restrict bloom to bright emissive surfaces; color and geometry remain ordinary PBR materials.
    if (innerWidth > 760) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0, 0.3, 1.2);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.visibilityHandler = () => {
      if (document.hidden) cancelAnimationFrame(this.frame);
      else { this.lastTime = performance.now(); this.frame = requestAnimationFrame(t => this.render(t)); }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    new GLTFLoader().load(new URL('./models/mushroom-lamp.glb', document.baseURI).href, gltf => {
      if (this.disposed) return;
      this.model = gltf.scene;
      this.materials = {};
      this.parts = {};
      this.model.traverse(object => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        this.materials[object.material.name] = object.material;
        this.parts[object.name] = { mesh: object, restY: object.position.y };
      });
      this.scene.add(this.model);
      this.lastTime = performance.now();
      if (!document.hidden) this.frame = requestAnimationFrame(t => this.render(t));
      onReady(this);
    }, undefined, error => { console.error('Lamp model failed to load', error); onError(error); });
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const distance = 9.6 / Math.min(1, this.camera.aspect / 1.02);
    this.camera.position.set(0, 2.45, distance);
    this.camera.lookAt(0, 2.05, 0);
  }

  setLight(value) { this.target.light = THREE.MathUtils.clamp(value, 0, 1); }
  setPose(pose) { Object.assign(this.pose, pose); }

  /** Apply a reversible exploded view to rigid physical parts. */
  setExploded(value) { this.exploded = THREE.MathUtils.clamp(value, 0, 1); }



  render(time) {
    if (this.disposed || document.hidden) return;
    const delta = Math.min((time - (this.lastTime ?? time)) / 1000, 0.05);
    this.lastTime = time;
    const blend = 1 - Math.exp(-delta * 6);
    this.lightLevel = THREE.MathUtils.lerp(this.lightLevel, this.target.light, blend);
    const level = this.lightLevel * this.brightness;
    const cap = this.materials['Cherry-glazed-cap'];
    cap?.color.lerp(this.target.color, blend);
    const windows = this.materials['Warm-light-windows'];
    windows?.emissive.set('#ffe4b8');
    if (windows) windows.emissiveIntensity = level * 2.0;
    const underside = this.materials['Warm-cap-underside'];
    underside?.emissive.set('#ffc779');
    if (underside) underside.emissiveIntensity = level * 1.3;
    const stem = this.materials['Ivory-ceramic-stem'];
    stem?.emissive.set('#ffcb8b');
    if (stem) stem.emissiveIntensity = level * 0.3;
    const led = this.materials['Warm-LED-module'];
    if (led) led.emissiveIntensity = level * 2.0;
    const diffuser = this.materials['Opal-diffuser-material'];
    if (diffuser) diffuser.emissiveIntensity = level * .65;
    const cover = this.materials['Ivory-bottom-cover'];
    if (cover) cover.emissiveIntensity = level * .3;
    // All cap surfaces move together; the spots never detach or change position.
    const lift = THREE.MathUtils.smoothstep(this.exploded, 0, .85);
    for (const name of ['Cap', 'Light-windows', 'Rolled-cap-rim', 'Cap-underside']) {
      const part = this.parts[name];
      if (part) part.mesh.position.y = part.restY + lift * 2.15;
    }
    const offsets = [
      ['Opal-diffuser', 1.0, .12, .9],
      ['LED-module', .20, .24, .95],
      ['Stem', -.30, .18, 1],
      ['Bottom-cover', -.80, .35, 1],
    ];
    for (const [name, distance, from, to] of offsets) {
      const part = this.parts[name];
      if (part) part.mesh.position.y = part.restY + distance * THREE.MathUtils.smoothstep(this.exploded, from, to);
    }
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.30, 0.17, this.lightLevel);
    this.key.intensity = THREE.MathUtils.lerp(1.25, 0.8, this.lightLevel);
    this.fill.intensity = THREE.MathUtils.lerp(0.45, 0.3, this.lightLevel);
    this.warmLight.intensity = level * 1.15;
    if (this.bloom) this.bloom.strength = level * 0.20;
    this.model.position.set(this.pose.x, this.pose.y, 0);
    this.model.rotation.set(this.pose.pitch ?? 0, this.pose.rotation, this.pose.tilt);
    this.model.scale.setScalar(this.pose.scale);
    this.floor.position.x = this.pose.x;
    this.floor.position.y = this.pose.y - 0.015;
    this.warmLight.position.x = this.pose.x;
    this.warmLight.position.y = 2.1 + this.pose.y;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(t => this.render(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.resizeObserver.disconnect();
    this.model?.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
    Object.values(this.materials ?? {}).forEach(m => m.dispose());
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.contactTexture.dispose();
    this.environment.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
  }
}
