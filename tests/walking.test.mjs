import test from 'node:test';
import assert from 'node:assert/strict';
import { WalkMap, EYE_HEIGHT } from '../src/walking.js';
import { sceneRoutes } from '../src/scene-routes.js';
const map = new WalkMap();

test('every standing destination is reachable from every other destination', () => {
  for (const [from, a] of Object.entries(sceneRoutes)) for (const [to, b] of Object.entries(sceneRoutes)) {
    const path = map.path(a.position, b.position);
    assert.ok(path?.length, `${from} → ${to} must have a path`);
    assert.deepEqual(path.at(-1), b.position);
    let previous = a.position;
    for (const point of path) { assert.ok(map.clearSegment(previous, point), `${from} → ${to} crosses an obstacle`); previous = point; }
  }
  assert.equal(EYE_HEIGHT, 1.65);
});
test('the doorway permits entry and return, while the front wall blocks movement', () => {
  assert.ok(map.clearSegment({ x: 1.4, z: 3.7 }, { x: 1.4, z: 1.8 }));
  assert.ok(map.clearSegment({ x: 1.4, z: 1.8 }, { x: 1.4, z: 3.7 }));
  const blocked = map.slide({ x: 0, z: 3.5 }, 0, -4);
  assert.ok(blocked.z >= 2.75 && blocked.z < 2.82);
});
test('large movement steps cannot tunnel through furniture or windows', () => {
  const desk = map.slide({ x: 0.65, z: 0.85 }, 0, -10);
  assert.ok(desk.z >= 0.47 && desk.z < 0.54);
  const window = map.slide({ x: -2.25, z: -0.72 }, -20, 0);
  assert.ok(window.x >= -3.1 && window.x < -3.03);
});
test('movement slides along a blocked furniture edge', () => {
  const next = map.slide({ x: 1.5, z: -0.2 }, -0.6, -0.5);
  assert.ok(map.isWalkable(next));
  assert.ok(next.x > 1.36);
  assert.ok(next.z < -0.65);
});
test('invalid destinations fail safely', () => {
  for (const goal of [{ x: 0, z: 0 }, { x: -8, z: 0 }, { x: NaN, z: 1 }, { x: 2.65, z: 0.24 }]) assert.equal(map.path(sceneRoutes.home.position, goal), null);
});
