import test from 'node:test';
import assert from 'node:assert/strict';
import { WorldMap, TILE, WORLD_WIDTH, WORLD_HEIGHT, START, REGIONS } from '../src/world/WorldMap';
import { STRUCTURES } from '../src/data/structures';
import { ITEMS } from '../src/data/items';
import { ENEMIES } from '../src/data/enemies';
import { NPCS } from '../src/data/npcs';

test('a continuous deterministic world has valid resources and encounter definitions', () => {
  const world = new WorldMap();
  assert.equal(world.width * TILE, WORLD_WIDTH);
  assert.equal(world.height * TILE, WORLD_HEIGHT);
  assert.equal(world.terrain.length, 88);
  assert.ok(world.terrain.every(row => row.length === 112 && row.every(tile => tile >= 0 && tile <= 9)));
  assert.deepEqual(world.nodes, new WorldMap().nodes);
  assert.equal(new Set(world.nodes.map(node => node.id)).size, world.nodes.length);
  assert.ok(world.nodes.filter(node => node.type === 'tree').length >= 290);
  assert.ok(world.nodes.filter(node => node.type === 'ore' || node.type === 'rock').length >= 65);
  for (const node of world.nodes) assert.ok(ITEMS[node.item], `undefined resource ${node.item}`);
  for (const spawn of world.enemySpawns) {
    assert.ok(ENEMIES[spawn.type], `undefined enemy ${spawn.type}`);
    assert.ok(!world.isStaticBlocked(spawn.x, spawn.y), `blocked spawn ${spawn.id}`);
    assert.ok(Math.hypot(spawn.x - START.x, spawn.y - START.y) > 210, 'the homestead must be safe on arrival');
  }
  assert.equal(world.regionAt(32 * TILE, 53 * TILE).id, 'valley');
  assert.equal(world.regionAt(48 * TILE, 33 * TILE).id, 'village');
  assert.equal(world.regionAt(20 * TILE, 20 * TILE).id, 'forest');
  assert.equal(world.regionAt(94 * TILE, 20 * TILE).id, 'mine');
  assert.equal(world.regionAt(94 * TILE, 65 * TILE).id, 'ruins');
  assert.equal(REGIONS.length, 5);
});

test('the start, NPCs, both bridges and every destination are connected on foot', () => {
  const world = new WorldMap();
  assert.equal(world.isStaticBlocked(START.x, START.y), false);
  const startX = Math.floor(START.x / TILE), startY = Math.floor(START.y / TILE);
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>([`${startX},${startY}`]);
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx, ty = y + dy, key = `${tx},${ty}`;
      if (visited.has(key) || world.isStaticBlocked(tx * TILE + 16, ty * TILE + 16, 8)) continue;
      visited.add(key); queue.push([tx, ty]);
    }
  }
  for (const npc of NPCS) {
    assert.ok(!world.isStaticBlocked(npc.x, npc.y, 12), `${npc.id} inside a building`);
    assert.ok(visited.has(`${Math.floor(npc.x / TILE)},${Math.floor(npc.y / TILE)}`), `${npc.id} unreachable`);
    assert.ok(!world.nodes.some(node => node.solid && Math.hypot(node.x - npc.x, node.y - npc.y) < 50), `${npc.id} obstructed by resources`);
  }
  for (const [x, y] of [[68, 40], [68, 64], [21, 12], [94, 18], [94, 65], [35, 54]]) {
    assert.ok(visited.has(`${x},${y}`), `destination ${x},${y} unreachable`);
  }
  assert.ok(visited.size > 7500);
});

test('building placement checks water, bounds, ground footprints, resources and occupied plots', () => {
  const world = new WorldMap();
  const workbench = STRUCTURES.workbench;
  assert.equal(world.canPlace(workbench, -1, 54, [], [], new Set()), false);
  assert.equal(world.canPlace(workbench, 111, 54, [], [], new Set()), false);
  assert.equal(world.canPlace(workbench, 20, 67, [], [], new Set()), false);
  assert.equal(world.canPlace(workbench, 31, 51, [], [], new Set()), false, 'a house footprint is occupied');
  assert.equal(world.canPlace(workbench, 34, 56, [], [], new Set()), true);
  const tree = world.nodes.find(node => node.type === 'tree' && node.item === 'wood')!;
  const tx = Math.floor(tree.x / TILE), ty = Math.floor(tree.y / TILE);
  assert.equal(world.canPlace(workbench, tx, ty, [tree], [], new Set()), false);
  assert.equal(world.canPlace(workbench, tx, ty, [tree], [], new Set([tree.id])), true);
  const torch = { id: 'placed-torch', type: 'torch', x: 34, y: 56 };
  assert.equal(world.canPlace(workbench, 34, 56, [], [torch], new Set()), false, 'non-solid decoration still owns its plot');
  assert.equal(world.canPlace(workbench, 35, 56, [], [torch], new Set()), true, 'adjacent plots do not overlap');
});

test('a roof does not behave like an invisible solid wall', () => {
  const world = new WorldMap();
  const home = world.buildings.find(building => building.id === 'player-home')!;
  assert.equal(world.isStaticBlocked(home.x, home.y - home.height / 2, 4), true);
  assert.equal(world.isStaticBlocked(home.x, home.y - 110, 4), false);
  assert.equal(world.isStaticBlocked(0, 100), true);
  assert.equal(world.isStaticBlocked(WORLD_WIDTH, WORLD_HEIGHT), true);
});
