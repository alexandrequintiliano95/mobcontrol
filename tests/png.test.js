import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encodePng } from '../tools/png.mjs';

test('encodePng writes a valid RGBA PNG', () => {
  const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]), png = encodePng(2, 1, px);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 2); assert.equal(png.readUInt32BE(20), 1);
  assert.equal(png[24], 8); assert.equal(png[25], 6);
  const idat = png.indexOf('IDAT'), len = png.readUInt32BE(idat - 4);
  assert.deepEqual([...inflateSync(png.subarray(idat + 4, idat + 4 + len))], [0, ...px]);
});
