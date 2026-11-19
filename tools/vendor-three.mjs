// Copies the pinned three.js build from node_modules into vendor/ (served as-is, no build step).
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
const from = 'node_modules/three/build/';
mkdirSync('vendor', { recursive: true });
copyFileSync(from + 'three.module.min.js', 'vendor/three.module.min.js');
const src = readFileSync(from + 'three.module.min.js', 'utf8');
if (src.includes('three.core.min.js') && existsSync(from + 'three.core.min.js')) {
  copyFileSync(from + 'three.core.min.js', 'vendor/three.core.min.js');
}
console.log('three.js copiado para vendor/');
