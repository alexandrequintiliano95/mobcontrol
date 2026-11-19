// Renderer, scene, camera and lighting.
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Fog, CanvasTexture, SRGBColorSpace,
} from 'three';

export const SKY_TOP = '#8ec5ff';
export const HORIZON = '#ffd29a';

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(0.55, '#ffc9a0');
  g.addColorStop(1, HORIZON);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function createStage(container) {
  let cap = 2;
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = skyTexture();
  scene.fog = new Fog(HORIZON, 45, 120);

  scene.add(new HemisphereLight(0xfff4e0, 0xc98f4e, 2.2));
  const sun = new DirectionalLight(0xffe2b8, 2.2);
  sun.position.set(-6, 12, 5);
  scene.add(sun);

  const camera = new PerspectiveCamera(50, 1, 0.1, 220);

  function resize() {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    renderer, scene, camera, resize,
    setPixelRatioCap(next) { cap = next; resize(); },
    get pixelRatioCap() { return cap; },
  };
}
