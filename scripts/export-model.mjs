import { mkdir, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createMushroom } from '../src/model.js';

// The exporter uses the browser FileReader API even when there are no image textures.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); })
      .catch(error => this.onerror?.(error));
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then(result => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
      this.onloadend?.();
    }).catch(error => this.onerror?.(error));
  }
};

const lamp = createMushroom();
const scene = new THREE.Scene();
scene.add(lamp);
const data = await new GLTFExporter().parseAsync(scene, { binary: true });
const destination = new URL('../public/models/', import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL('mushroom-lamp.glb', destination), Buffer.from(data));
