import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS } from '../src/data/items';
import { RECIPES } from '../src/data/recipes';
import { ENEMIES } from '../src/data/enemies';
import { GameModel, createInitialState } from '../src/systems/GameModel';
import { BACKUP_KEY, SAVE_KEY, deleteSave, hasSave, loadGame, saveGame } from '../src/systems/SaveSystem';
import type { Station } from '../src/types';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  }, configurable: true,
});
beforeEach(() => storage.clear());
const allStations = new Set<Station>(['hand', 'workbench', 'furnace', 'forge', 'alchemy', 'carpentry']);

test('every recipe and enemy loot refers to real items with valid quantities', () => {
  assert.equal(new Set(RECIPES.map(recipe => recipe.id)).size, RECIPES.length);
  for (const recipe of RECIPES) {
    assert.ok(ITEMS[recipe.item], recipe.id);
    assert.ok(recipe.qty > 0);
    for (const [id, qty] of Object.entries(recipe.costs)) {
      assert.ok(ITEMS[id], id);
      assert.ok(Number.isSafeInteger(qty) && qty > 0);
    }
  }
  for (const enemy of Object.values(ENEMIES)) {
    assert.ok(enemy.cooldown > 100 && enemy.cooldown < 10000, 'enemy cooldowns are in milliseconds');
    for (const drop of enemy.loot) {
      assert.ok(ITEMS[drop.item], drop.item);
      assert.ok(drop.min > 0 && drop.max >= drop.min && drop.chance > 0 && drop.chance <= 1);
    }
  }
});

test('the player starts with real tools, a sword, three potions, and zero gathered resources', () => {
  const model = new GameModel();
  assert.equal(model.state.equipment.weapon, 'wood_sword');
  assert.equal(model.count('wood_axe'), 1);
  assert.equal(model.count('stone_pickaxe'), 1);
  assert.equal(model.count('health_potion'), 3);
  assert.equal(model.count('wood'), 0);
  assert.equal(model.count('stone'), 0);
});

test('add respects stack sizes and never partially inserts into a full inventory', () => {
  const model = new GameModel();
  model.state.inventory = Array.from({ length: 36 }, () => ({ item: 'wood_sword', qty: 1 }));
  model.state.inventory[0] = { item: 'wood', qty: 98 };
  const before = JSON.stringify(model.state.inventory);
  assert.equal(model.add('wood', 2), false);
  assert.equal(JSON.stringify(model.state.inventory), before);
  assert.equal(model.add('wood', 1), true);
  assert.equal(model.count('wood'), 99);
  assert.equal(model.add('not-real', 1), false);
  assert.equal(model.add('wood', -1), false);
  assert.equal(model.add('wood', Number.POSITIVE_INFINITY), false);
});

test('removal, selling, buying, and invalid requests preserve items and coins atomically', () => {
  const model = new GameModel();
  model.add('wood', 4);
  assert.equal(model.remove('wood', 5), false);
  assert.equal(model.count('wood'), 4);
  const before = JSON.stringify(model.state);
  assert.equal(model.buy('iron_sword', 2).ok, false);
  assert.equal(model.sell(0, -5).ok, false);
  assert.equal(model.buy('wood', -3).ok, false);
  assert.equal(JSON.stringify(model.state), before);
  const coins = model.state.coins;
  assert.equal(model.buy('wood', 2).ok, true);
  assert.equal(model.state.coins, coins - ITEMS.wood.value * 2);
  assert.equal(model.count('wood'), 6);
});

test('buying and selling an item cannot create coins, including low-value ammunition', () => {
  for (const item of Object.values(ITEMS)) {
    const model = new GameModel();
    model.state.inventory.fill(null);
    model.state.coins = 10000;
    assert.equal(model.buy(item.id).ok, true);
    assert.equal(model.sell(0).ok, true);
    assert.ok(model.state.coins <= 10000, `${item.id} creates coins in a trade round trip`);
    assert.equal(model.count(item.id), 0);
  }
});

test('buying ingredients, crafting, and selling output cannot create an infinite shop profit', () => {
  for (const recipe of RECIPES) {
    const model = new GameModel();
    model.state.inventory.fill(null);
    model.state.level = 10;
    model.state.coins = 10000;
    for (const [id, qty] of Object.entries(recipe.costs)) assert.equal(model.buy(id, qty).ok, true);
    assert.equal(model.craft(recipe.id, allStations).ok, true);
    for (let slot = 0; slot < model.state.inventory.length; slot++) {
      const stack = model.state.inventory[slot];
      if (stack) assert.equal(model.sell(slot, stack.qty).ok, true);
    }
    assert.ok(model.state.coins <= 10000, `${recipe.id} creates coins using purchased ingredients`);
  }
});

test('full inventory rejects purchases before spending coins, and merging preserves exact quantities', () => {
  const model = new GameModel();
  model.state.inventory = Array.from({ length: 36 }, () => ({ item: 'wood_sword', qty: 1 }));
  const coins = model.state.coins;
  assert.equal(model.buy('wood').ok, false);
  assert.equal(model.state.coins, coins);
  model.state.inventory[0] = { item: 'wood', qty: 70 };
  model.state.inventory[1] = { item: 'wood', qty: 60 };
  assert.equal(model.move(1, 0).ok, true);
  assert.equal(model.state.inventory[0]?.qty, 99);
  assert.equal(model.state.inventory[1]?.qty, 31);
  assert.equal(model.count('wood'), 130);
  assert.equal(model.move(-1, 0).ok, false);
  assert.equal(model.move(0, 36).ok, false);
  assert.equal(model.count('wood'), 130);
});

test('crafting checks station and resources before spending, and reuses space freed by ingredients', () => {
  const model = new GameModel();
  model.add('wood', 8);
  const before = JSON.stringify(model.state);
  assert.equal(model.craft('workbench', new Set()).ok, false);
  assert.equal(JSON.stringify(model.state), before);
  model.add('stone', 4);
  assert.equal(model.craft('workbench', new Set()).ok, true);
  assert.equal(model.count('workbench'), 1);
  assert.equal(model.count('wood'), 0);
  assert.equal(model.count('stone'), 0);
  model.add('wood', 5);
  model.add('stone', 2);
  const noStation = JSON.stringify(model.state);
  assert.equal(model.craft('wood_sword', new Set()).ok, false);
  assert.equal(JSON.stringify(model.state), noStation);
  assert.equal(model.craft('wood_sword', new Set(['workbench'])).ok, true);
  assert.equal(model.count('wood_sword'), 1);
  assert.equal(model.state.metrics['craft:weapon'], 1);
});

test('a full inventory does not consume ingredients if crafted output cannot fit', () => {
  const model = new GameModel();
  model.state.inventory = Array.from({ length: 36 }, () => ({ item: 'wood_sword', qty: 1 }));
  model.state.inventory[0] = { item: 'wood', qty: 99 };
  model.state.inventory[1] = { item: 'stone', qty: 99 };
  const before = JSON.stringify(model.state);
  assert.equal(model.craft('workbench', allStations).ok, false);
  assert.equal(JSON.stringify(model.state), before);
  model.state.inventory[0] = { item: 'wood', qty: 8 };
  model.state.inventory[1] = { item: 'stone', qty: 4 };
  assert.equal(model.craft('workbench', allStations).ok, true);
  assert.equal(model.count('workbench'), 1);
});

test('equipment changes defense, swaps back without loss, and cannot be unequipped into a full bag', () => {
  const model = new GameModel();
  const defense = model.defense;
  model.add('iron_helmet', 1);
  let slot = model.state.inventory.findIndex(stack => stack?.item === 'iron_helmet');
  assert.equal(model.equip(slot).ok, true);
  assert.equal(model.defense, defense + ITEMS.iron_helmet.defense!);
  assert.equal(model.unequip('head').ok, true);
  assert.equal(model.defense, defense);
  model.add('iron_sword', 1);
  slot = model.state.inventory.findIndex(stack => stack?.item === 'iron_sword');
  assert.equal(model.equip(slot).ok, true);
  assert.equal(model.state.equipment.weapon, 'iron_sword');
  assert.equal(model.count('wood_sword'), 1);
  assert.ok(model.attack > ITEMS.wood_sword.damage!);
  model.state.inventory = Array.from({ length: 36 }, () => ({ item: 'wood_sword', qty: 1 }));
  assert.equal(model.unequip('weapon').ok, false);
  assert.equal(model.state.equipment.weapon, 'iron_sword');
});

test('potions restore and clamp stats and are not wasted at full health', () => {
  const model = new GameModel();
  assert.equal(model.consume(2).ok, false);
  assert.equal(model.count('health_potion'), 3);
  model.state.health = 90;
  assert.equal(model.consume(2).ok, true);
  assert.equal(model.state.health, model.maxHealth);
  assert.equal(model.count('health_potion'), 2);
});

test('quest completion checks both initial resources and pays each reward only once', () => {
  const model = new GameModel();
  const notices: string[] = [];
  model.onNotice = text => notices.push(text);
  model.metric('gather:wood', 8);
  assert.deepEqual(model.state.quests, []);
  model.metric('build:workbench'); // Earlier actions still count when their quest becomes available.
  model.metric('gather:stone', 6);
  assert.deepEqual(model.state.quests, ['gather_supplies', 'first_bench']);
  const coins = model.state.coins;
  model.metric('gather:stone', 6);
  model.changed();
  assert.equal(model.state.coins, coins);
  assert.equal(notices.filter(text => text.startsWith('Missão concluída:')).length, 2);
});

test('the acceptance progression can gather, build, forge armor, level up, and persist its base', () => {
  const model = new GameModel();
  model.add('wood', 60);
  model.add('stone', 45);
  model.metric('gather:wood', 60);
  model.metric('gather:stone', 45);
  assert.equal(model.craft('workbench', allStations).ok, true);
  assert.equal(model.remove('workbench', 1), true);
  model.state.structures.push({ id: 'bench-1', type: 'workbench', x: 25, y: 47 });
  model.metric('build:workbench');
  assert.equal(model.craft('wood_sword', allStations).ok, true);
  model.metric('kill:slime', 5);
  model.addXP(ENEMIES.slime.xp * 5);
  model.metric('talk:smith');
  model.add('iron_ore', 4);
  model.metric('gather:iron_ore', 4);
  assert.equal(model.craft('furnace', allStations).ok, true);
  assert.equal(model.craft('iron_bar', allStations).ok, true);
  assert.equal(model.craft('iron_bar', allStations).ok, true);
  assert.equal(model.craft('iron_helmet', allStations).ok, true);
  const defense = model.defense;
  assert.equal(model.equip(model.state.inventory.findIndex(stack => stack?.item === 'iron_helmet')).ok, true);
  assert.ok(model.defense > defense);
  assert.ok(model.state.level > 1);
  assert.ok(model.state.quests.includes('iron_armor'));
  model.visit('mine');
  assert.equal(model.state.quests.includes('deep_mine'), true);
  model.state.enemies.guardian = model.state.time + 1e12;
  assert.equal(saveGame(model.state).ok, true);
  const loaded = loadGame();
  assert.deepEqual(loaded, model.state);
  assert.equal(loaded?.structures[0].id, 'bench-1');
  assert.equal(loaded?.equipment.head, 'iron_helmet');
});

test('saves recover from a corrupt primary with a validated backup', () => {
  const model = new GameModel();
  assert.equal(saveGame(model.state).ok, true);
  model.add('wood', 9);
  assert.equal(saveGame(model.state).ok, true);
  assert.ok(storage.has(BACKUP_KEY));
  storage.set(SAVE_KEY, '{corrupt');
  assert.equal(loadGame()?.inventory.some(stack => stack?.item === 'wood'), false);
  assert.equal(hasSave(), true);
  deleteSave();
  assert.equal(hasSave(), false);
});

test('save validation rejects invalid stacks, unsupported future versions, and prototype keys', () => {
  const state = createInitialState();
  state.inventory[0] = { item: 'wood', qty: 100000 };
  assert.equal(saveGame(state).ok, false);
  state.inventory[0] = { item: 'wood', qty: 4 };
  storage.set(SAVE_KEY, JSON.stringify({ ...state, version: 999 }));
  assert.equal(loadGame(), null);
  storage.set(SAVE_KEY, JSON.stringify(state).replace('"metrics":{}', '"metrics":{"__proto__":1}'));
  assert.equal(loadGame(), null);
});

test('version zero save migration fills missing optional world fields without losing inventory', () => {
  const state = createInitialState();
  storage.set(SAVE_KEY, JSON.stringify({ version: 0, position: state.position, inventory: [{ item: 'wood', qty: 7 }] }));
  const loaded = loadGame();
  assert.equal(loaded?.version, 2);
  assert.equal(loaded?.inventory.length, 36);
  assert.equal(loaded?.inventory[0]?.qty, 7);
  assert.deepEqual(loaded?.structures, []);
  assert.deepEqual(loaded?.loot, []);
});

test('version one saves migrate in the same storage key with empty ground loot', () => {
  const { loot: _loot, ...legacy } = createInitialState();
  storage.set(SAVE_KEY, JSON.stringify({ ...legacy, version: 1 }));
  const loaded = loadGame();
  assert.equal(SAVE_KEY, 'cronicas-de-ferro.save.v1');
  assert.equal(loaded?.version, 2);
  assert.deepEqual(loaded?.loot, []);
  assert.deepEqual(loaded?.inventory, legacy.inventory);
  assert.deepEqual(loaded?.equipment, legacy.equipment);
});

test('uncollected boss rewards and ordinary ground loot survive save and reload', () => {
  const state = createInitialState();
  state.inventory = Array.from({ length: 36 }, () => ({ item: 'wood_sword', qty: 1 }));
  state.enemies['guardian-0'] = state.time + 1e12;
  state.loot = [
    { id: 'guardian-drop', x: 3024, y: 2096, items: { ancient_blade: 1, core: 1, crystal: 5 }, coins: 150 },
    { id: 'wolf-drop', x: 1414.5, y: 732.25, items: { leather: 2, fang: 1 }, coins: 5 },
  ];
  assert.equal(saveGame(state).ok, true);
  const loaded = loadGame();
  assert.deepEqual(loaded?.loot, state.loot);
  assert.equal(loaded?.enemies['guardian-0'], 1e12);
  if (loaded) loaded.loot[0].items.core = 9;
  assert.equal(state.loot[0].items.core, 1);
});

test('ground loot validation rejects duplicate IDs, unknown items and unsafe quantities or coordinates', () => {
  const base = { id: 'drop-1', x: 1200, y: 1700, items: { wood: 3 }, coins: 4 };
  for (const loot of [
    [base, base],
    [{ ...base, items: { unknown_item: 1 } }],
    [{ ...base, items: { wood: 0 } }],
    [{ ...base, items: { wood: 1000 } }],
    [{ ...base, items: { wood: 1.5 } }],
    [{ ...base, coins: -1 }],
    [{ ...base, coins: 1.5 }],
    [{ ...base, x: 112 * 32 }],
    [{ ...base, y: -1 }],
  ]) {
    const state = createInitialState();
    state.loot = loot;
    assert.equal(saveGame(state).ok, false);
  }
});

test('placed structure coordinates are whole tile indices and include the full footprint inside world bounds', () => {
  for (const [x, y] of [[800, 1504], [25.5, 47], [0, 47], [110, 47], [25, 87]]) {
    const state = createInitialState();
    state.structures = [{ id: 'bench', type: 'workbench', x, y }];
    assert.equal(saveGame(state).ok, false, `${x},${y} must not be accepted`);
  }
  const valid = createInitialState();
  valid.structures = [{ id: 'bench', type: 'workbench', x: 25, y: 47 }];
  assert.equal(saveGame(valid).ok, true);
  assert.deepEqual(loadGame()?.structures, valid.structures);
});
