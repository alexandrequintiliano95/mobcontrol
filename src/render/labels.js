// Text sprites drawn on a canvas, redrawn only when the text or color changes.
import { Sprite, SpriteMaterial, CanvasTexture, SRGBColorSpace } from 'three';

export function createLabel({ width = 256, height = 128, worldHeight = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new Sprite(material);
  sprite.scale.set((worldHeight * width) / height, worldHeight, 1);
  let last = '';

  function set(text, fg = '#ffffff', bg = null) {
    const key = `${text}|${fg}|${bg}`;
    if (key === last) return;
    last = key;
    ctx.clearRect(0, 0, width, height);
    if (bg) {
      ctx.fillStyle = bg;
      const r = height * 0.25;
      ctx.beginPath();
      ctx.roundRect(4, 4, width - 8, height - 8, r);
      ctx.fill();
    }
    ctx.font = `900 ${Math.floor(height * 0.72)}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = height * 0.12;
    ctx.strokeStyle = 'rgba(20,20,30,0.9)';
    ctx.strokeText(text, width / 2, height * 0.54);
    ctx.fillStyle = fg;
    ctx.fillText(text, width / 2, height * 0.54);
    texture.needsUpdate = true;
  }

  return {
    sprite,
    set,
    dispose() { texture.dispose(); material.dispose(); },
  };
}
