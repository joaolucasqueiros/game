import { test, expect, type Page } from '@playwright/test';

// Teleports shorten journeys across the large map. All resource gathering,
// crafting, equipping, building and combat actions use real keyboard/mouse input.
const diagnostics = new WeakMap<Page, { errors: string[]; external: string[] }>();

test.beforeEach(async ({ page }) => {
  const captured = { errors: [] as string[], external: [] as string[] };
  diagnostics.set(page, captured);
  page.on('pageerror', error => captured.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') captured.errors.push(message.text()); });
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:5173/')) captured.external.push(url);
  });
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__chronicles?.scene?.ready);
  await expect(page.locator('[data-action="start"]')).toBeVisible();
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => (window as any).__chronicles.scene.started && !(window as any).__chronicles.ui.isBlocking);
});

test.afterEach(async ({ page }) => {
  expect(diagnostics.get(page)?.errors, 'browser runtime and asset errors').toEqual([]);
  expect(diagnostics.get(page)?.external, 'the game must run without external APIs or assets').toEqual([]);
});

async function idle(page: Page) {
  await page.waitForFunction(() => !(window as any).__chronicles.scene.player.busy);
}

async function closeMenu(page: Page) {
  if (await page.evaluate(() => (window as any).__chronicles.ui.isBlocking)) {
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => (window as any).__chronicles.ui.isBlocking)).toBe(false);
  }
}

async function teleport(page: Page, x: number, y: number) {
  await closeMenu(page);
  await idle(page);
  await page.evaluate(({ x, y }) => {
    const { scene } = (window as any).__chronicles;
    if (scene.blocked(x, y, 8)) throw new Error(`Blocked teleport destination ${x},${y}`);
    scene.player.teleport(x, y);
    scene.cameras.main.centerOn(x, y);
  }, { x, y });
  await page.waitForTimeout(160);
}

async function count(page: Page, id: string) {
  return page.evaluate(id => (window as any).__chronicles.model.count(id), id) as Promise<number>;
}

async function screenPoint(page: Page, x: number, y: number) {
  return page.evaluate(({ x, y }) => {
    const camera = (window as any).__chronicles.scene.cameras.main;
    const origin = camera.getWorldPoint(0, 0);
    return { x: (x - origin.x) * camera.zoom, y: (y - origin.y) * camera.zoom };
  }, { x, y });
}

async function rest(page: Page) {
  await teleport(page, 1000, 1692);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.context()?.data?.id)).toBe('player-home');
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.energy)).toBe(await page.evaluate(() => (window as any).__chronicles.model.maxEnergy));
}

async function gather(page: Page, item: string, nodesToExhaust: number, needsConstructionPlot = false) {
  await closeMenu(page);
  for (let i = 0; i < nodesToExhaust; i++) {
    if (await page.evaluate(() => (window as any).__chronicles.model.state.energy < 28)) await rest(page);
    await idle(page);
    const node = await page.evaluate(({ item, needsConstructionPlot }) => {
      const { scene } = (window as any).__chronicles;
      const nodes = scene.world.nodes.filter((node: any) => node.item === item && !scene.resources.depleted.has(node.id) &&
        scene.enemies.actors.every((actor: any) => actor.dead || Math.hypot(actor.sprite.x - node.x, actor.sprite.y - node.y) > 240) &&
        (!needsConstructionPlot || scene.world.canPlace({ id: 'fence', item: 'fence', name: 'Cerca', description: '', width: 1, height: 1, solid: true }, Math.floor(node.x / 32), Math.floor(node.y / 32), scene.world.nodes, scene.model.state.structures, new Set([...scene.resources.depleted, node.id]))));
      nodes.sort((a: any, b: any) => Math.hypot(a.x - 1120, a.y - 1728) - Math.hypot(b.x - 1120, b.y - 1728));
      for (const node of nodes) {
        for (const [dx, dy] of [[-35, 24], [35, 24], [0, 38], [-42, 0], [42, 0], [0, -38]]) {
          const x = node.x + dx, y = node.y + dy;
          if (scene.blocked(x, y, 8)) continue;
          scene.player.teleport(x, y);
          if (scene.context()?.kind !== 'resource' || scene.context()?.data.id !== node.id) continue;
          scene.cameras.main.centerOn(x, y);
          return { id: node.id, item: node.item, hp: node.hp };
        }
      }
      throw new Error(`No accessible ${item} resource`);
    }, { item, needsConstructionPlot });
    const before = await count(page, item);
    for (let hit = 0; hit < node.hp + 2; hit++) {
      if (await page.evaluate(id => (window as any).__chronicles.scene.resources.depleted.has(id), node.id)) break;
      await page.keyboard.press('e');
      await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.player.busy)).toBe(true);
      await idle(page);
      await page.waitForTimeout(65);
    }
    await expect.poll(() => page.evaluate(id => (window as any).__chronicles.scene.resources.depleted.has(id), node.id)).toBe(true);
    expect(await count(page, item)).toBeGreaterThan(before);
  }
}

async function craft(page: Page, id: string, repetitions = 1) {
  if (await page.evaluate(() => (window as any).__chronicles.ui.activePanel !== 'craft')) await page.keyboard.press('c');
  await page.locator(`[data-recipe="${id}"]`).click();
  for (let i = 0; i < repetitions; i++) {
    const before = await count(page, id);
    await expect(page.locator(`[data-craft="${id}"]`)).toBeEnabled();
    await page.locator(`[data-craft="${id}"]`).click();
    expect(await count(page, id)).toBeGreaterThan(before);
  }
}

async function equip(page: Page, id: string) {
  await closeMenu(page);
  await page.locator('.main-nav [data-panel="inventory"]').click();
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.ui.activePanel)).toBe('inventory');
  const index = await page.evaluate(id => (window as any).__chronicles.model.state.inventory.findIndex((stack: any) => stack?.item === id), id);
  expect(index).toBeGreaterThanOrEqual(0);
  await page.locator(`[data-slot="${index}"]`).click();
  await page.locator('[data-action="equip"]').click();
  await closeMenu(page);
}

async function build(page: Page, type: string) {
  await closeMenu(page);
  await idle(page);
  const before = await page.evaluate(() => (window as any).__chronicles.model.state.structures.length);
  await page.keyboard.press('b');
  await page.locator(`[data-build="${type}"]`).click();
  const plot = await page.evaluate(() => {
    const { scene } = (window as any).__chronicles;
    const tx = Math.floor(scene.player.x / 32), ty = Math.floor(scene.player.y / 32);
    for (const dy of [2, 3, -2, -3, 1, -1, 0]) for (const dx of [-2, 1, -3, 2, -4, 3, 0]) {
      const x = (tx + dx) * 32 + 16, y = (ty + dy) * 32 + 16;
      scene.build.update(x, y);
      const origin = scene.cameras.main.getWorldPoint(0, 0), zoom = scene.cameras.main.zoom;
      const screen = { x: (x - origin.x) * zoom, y: (y - origin.y) * zoom };
      if (scene.build.valid && screen.x > 365 && screen.x < 1050 && screen.y > 260 && screen.y < 700) return { ...screen, worldX: x, worldY: y };
    }
    throw new Error(`No valid visible construction plot for ${scene.build.type}`);
  });
  const pointer = await screenPoint(page, plot.worldX, plot.worldY);
  await page.mouse.move(pointer.x, pointer.y);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.build.valid)).toBe(true);
  await page.mouse.click(pointer.x, pointer.y);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.structures.length)).toBe(before + 1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.build.type)).toBe(null);
  await idle(page);
  return page.evaluate(() => ({ ...(window as any).__chronicles.model.state.structures.at(-1) }));
}

async function approachEnemy(page: Page, id: string) {
  await idle(page);
  await closeMenu(page);
  await page.evaluate(id => {
    const { scene } = (window as any).__chronicles;
    const actor = scene.enemies.actors.find((actor: any) => actor.spawn.id === id);
    for (const [dx, dy] of [[-30, 0], [30, 0], [0, 30], [0, -30]]) {
      if (scene.blocked(actor.sprite.x + dx, actor.sprite.y + dy, 8)) continue;
      scene.player.teleport(actor.sprite.x + dx, actor.sprite.y + dy);
      scene.cameras.main.centerOn(scene.player.x, scene.player.y);
      return;
    }
    throw new Error(`Cannot approach ${id}`);
  }, id);
  await page.waitForTimeout(200);
}

async function attackEnemy(page: Page, id: string, untilDead = true) {
  await page.keyboard.press('1');
  for (let attempt = 0; attempt < (untilDead ? 18 : 1); attempt++) {
    await idle(page);
    await page.waitForFunction(() => (window as any).__chronicles.scene.attackCooldown <= 0);
    const enemy = await page.evaluate(id => {
      const actor = (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.spawn.id === id);
      return { x: actor.sprite.x, y: actor.sprite.y, dead: actor.dead };
    }, id);
    if (enemy.dead) return;
    const point = await screenPoint(page, enemy.x, enemy.y);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(445);
  }
  if (untilDead) expect(await page.evaluate(id => (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.spawn.id === id).dead, id)).toBe(true);
}

test('acceptance: gather, craft, build, fight, mine, equip, store and resume a persistent journey', async ({ page }) => {
  expect(await count(page, 'wood')).toBe(0);
  expect(await count(page, 'stone')).toBe(0);
  const start = await page.evaluate(() => ({ ...(window as any).__chronicles.model.state.position }));
  await page.keyboard.down('d'); await page.waitForTimeout(320);
  expect(await page.evaluate(() => (window as any).__chronicles.scene.player.direction)).toBe('right');
  expect(await page.evaluate(() => (window as any).__chronicles.scene.player.sprite.anims.currentAnim.key)).toBe('player_right_walk');
  await page.keyboard.up('d');
  expect(await page.evaluate(() => (window as any).__chronicles.scene.player.x)).toBeGreaterThan(start.x + 20);
  // Walk into the real house footprint, with input still held across several frames.
  await teleport(page, 1024, 1695);
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  expect(await page.evaluate(() => (window as any).__chronicles.scene.player.y)).toBeGreaterThanOrEqual(1671);
  expect(await page.evaluate(() => (window as any).__chronicles.scene.blocked((window as any).__chronicles.scene.player.x, (window as any).__chronicles.scene.player.y))).toBe(false);
  const energy = await page.evaluate(() => (window as any).__chronicles.model.state.energy);
  await page.keyboard.down('s'); await page.keyboard.press('Space'); await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as any).__chronicles.scene.player.action)).toBe('dodge');
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.energy)).toBeLessThan(energy);
  await page.keyboard.up('s'); await idle(page);

  await gather(page, 'wood', 4);
  await gather(page, 'stone', 3);
  expect(await count(page, 'wood')).toBeGreaterThanOrEqual(24);
  expect(await count(page, 'stone')).toBeGreaterThanOrEqual(12);
  await page.keyboard.press('i');
  await expect(page.locator('.inventory-slot img[src="/assets/items/wood.png"]')).toBeVisible();
  await expect(page.locator('.inventory-slot img[src="/assets/items/stone.png"]')).toBeVisible();
  await closeMenu(page);
  await rest(page);
  await teleport(page, 1120, 1728);
  await craft(page, 'workbench');
  await closeMenu(page);
  const bench = await build(page, 'workbench');
  await craft(page, 'wood_sword');
  await equip(page, 'wood_sword');
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.equipment.weapon)).toBe('wood_sword');

  const slimes = await page.evaluate(() => (window as any).__chronicles.scene.enemies.actors.filter((actor: any) => actor.spawn.type === 'slime').slice(0, 5).map((actor: any) => actor.spawn.id));
  for (let i = 0; i < slimes.length; i++) {
    await approachEnemy(page, slimes[i]);
    if (i === 0) {
      const health = await page.evaluate(() => (window as any).__chronicles.model.state.health);
      await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.health)).toBeLessThan(health);
    }
    await attackEnemy(page, slimes[i]);
    await page.waitForTimeout(650);
    const loot = await page.evaluate(() => {
      const { scene, model } = (window as any).__chronicles;
      const bag = scene.lootBags.at(-1);
      return bag ? { x: bag.sprite.x, y: bag.sprite.y, coins: bag.data.coins, before: model.state.coins } : null;
    });
    if (loot) {
      // Approach the bag on foot; only the journey between encounters is skipped.
      for (let step = 0; step < 8; step++) {
        const position = await page.evaluate(() => ({ ...(window as any).__chronicles.model.state.position }));
        if (Math.hypot(loot.x - position.x, loot.y - position.y) < 30) break;
        const key = Math.abs(loot.x - position.x) > Math.abs(loot.y - position.y) ? (loot.x > position.x ? 'd' : 'a') : (loot.y > position.y ? 's' : 'w');
        await page.keyboard.down(key); await page.waitForTimeout(140); await page.keyboard.up(key);
      }
      await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.coins)).toBeGreaterThanOrEqual(loot.before + loot.coins);
    }
  }
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.metrics['kill:slime'])).toBe(5);
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.level)).toBeGreaterThanOrEqual(2);
  await teleport(page, 1632, 1044);
  await page.keyboard.press('e');
  await expect(page.locator('.npc-dialogue')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.metrics['talk:smith'])).toBe(1);
  await closeMenu(page);
  await gather(page, 'iron_ore', 1);
  expect(await count(page, 'iron_ore')).toBe(4);
  await teleport(page, 1780, 1120);
  await craft(page, 'iron_bar', 2);
  await craft(page, 'iron_helmet');
  const defense = await page.evaluate(() => (window as any).__chronicles.model.defense);
  await equip(page, 'iron_helmet');
  expect(await page.evaluate(() => (window as any).__chronicles.model.defense)).toBeGreaterThan(defense);

  await gather(page, 'wood', 4);
  await gather(page, 'stone', 2);
  await teleport(page, 1280, 1350);
  await craft(page, 'cabin');
  await closeMenu(page);
  await teleport(page, (bench.x + 1) * 32, (bench.y + 2) * 32);
  await craft(page, 'chest');
  await craft(page, 'fence');
  await closeMenu(page);
  const chest = await build(page, 'chest');
  await build(page, 'fence');
  await build(page, 'fence');
  await build(page, 'cabin');
  // Adjacent new buildings can occupy one side of the chest. Approach a free
  // side that really resolves to this chest through the interaction system.
  await idle(page);
  await page.evaluate(id => {
    const { scene, model } = (window as any).__chronicles;
    const chest = model.state.structures.find((structure: any) => structure.id === id);
    for (const [dx, dy] of [[16, -20], [16, 52], [-20, 16], [52, 16]]) {
      const x = chest.x * 32 + dx, y = chest.y * 32 + dy;
      if (scene.blocked(x, y, 8)) continue;
      scene.player.teleport(x, y);
      if (scene.context()?.kind !== 'structure' || scene.context()?.data.id !== id) continue;
      scene.cameras.main.centerOn(x, y);
      return;
    }
    throw new Error('The storage chest has no accessible interaction side');
  }, chest.id);
  await page.keyboard.press('e');
  await expect(page.locator('.storage-layout')).toBeVisible();
  const stoneIndex = await page.evaluate(() => (window as any).__chronicles.model.state.inventory.findIndex((stack: any) => stack?.item === 'stone'));
  const storedQuantity = await count(page, 'stone');
  await page.locator(`[data-transfer="${stoneIndex}"][data-to-storage="true"]`).click();
  expect(await count(page, 'stone')).toBe(0);
  expect(await page.evaluate(id => (window as any).__chronicles.model.state.structures.find((structure: any) => structure.id === id).storage.find((stack: any) => stack?.item === 'stone').qty, chest.id)).toBe(storedQuantity);
  await closeMenu(page);
  await page.locator('[aria-label="Salvar partida"]').click();
  const snapshot = await page.evaluate(() => {
    const { model } = (window as any).__chronicles;
    return { inventory: model.state.inventory, equipment: model.state.equipment, structures: model.state.structures, resources: model.state.resources, quests: model.state.quests, position: model.state.position, coins: model.state.coins, health: model.state.health };
  });
  await page.screenshot({ path: 'test-results/acceptance-world.png' });
  await page.reload();
  await page.waitForFunction(() => (window as any).__chronicles?.scene?.ready);
  await page.locator('[data-action="continue"]').click();
  const restored = await page.evaluate(() => {
    const { model } = (window as any).__chronicles;
    return { inventory: model.state.inventory, equipment: model.state.equipment, structures: model.state.structures, resources: model.state.resources, quests: model.state.quests, position: model.state.position, coins: model.state.coins, health: model.state.health };
  });
  expect(restored).toEqual(snapshot);
  expect(restored.structures.some((structure: any) => structure.type === 'cabin')).toBe(true);
  expect(restored.quests.length).toBeGreaterThanOrEqual(8);
});

test('death offers a real respawn with a bounded coin penalty and preserved equipment', async ({ page }) => {
  await page.evaluate(() => {
    const { model } = (window as any).__chronicles;
    model.state.health = 1; model.state.coins = 100; model.changed();
  });
  await approachEnemy(page, 'slime-0');
  await expect(page.locator('[data-action="respawn"]')).toBeVisible();
  await page.locator('[data-action="respawn"]').click();
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.coins)).toBe(90);
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.position)).toEqual({ x: 1120, y: 1728 });
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.health)).toBe(await page.evaluate(() => (window as any).__chronicles.model.maxHealth));
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.equipment.weapon)).toBe('wood_sword');
  await expect(page.locator('.death-card')).not.toBeVisible();
});

test('ranged attacks consume ammunition and mana, and the guardian changes attack phase', async ({ page }) => {
  // Explicit fixtures isolate advanced combat from the long gathering progression.
  await page.evaluate(() => {
    const { model } = (window as any).__chronicles;
    for (const id of ['hunting_bow', 'staff', 'iron_sword', 'iron_helmet']) model.add(id, 1);
    model.add('arrow', 1);
  });
  await equip(page, 'hunting_bow');
  await approachEnemy(page, 'slime-0');
  const hp = await page.evaluate(() => (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.spawn.id === 'slime-0').hp);
  await attackEnemy(page, 'slime-0', false);
  expect(await count(page, 'arrow')).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.spawn.id === 'slime-0').hp)).toBeLessThan(hp);
  await attackEnemy(page, 'slime-0', false);
  expect(await count(page, 'arrow')).toBe(0);
  await expect(page.locator('.game-toast').filter({ hasText: 'Sem flechas' })).toBeVisible();
  await equip(page, 'staff');
  const mana = await page.evaluate(() => (window as any).__chronicles.model.state.mana);
  await attackEnemy(page, 'slime-0', false);
  expect(await page.evaluate(() => (window as any).__chronicles.model.state.mana)).toBeLessThan(mana - 4);
  await page.evaluate(() => { (window as any).__chronicles.model.state.mana = 0; });
  await page.waitForFunction(() => (window as any).__chronicles.scene.attackCooldown <= 0);
  const emptyAim = await page.evaluate(() => {
    const { scene } = (window as any).__chronicles;
    return { x: scene.player.x + 40, y: scene.player.y };
  });
  const emptyPoint = await screenPoint(page, emptyAim.x, emptyAim.y);
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await expect(page.locator('.game-toast').filter({ hasText: 'Mana insuficiente' })).toBeVisible();
  await equip(page, 'iron_sword');
  await equip(page, 'iron_helmet');
  await page.evaluate(() => {
    const { scene } = (window as any).__chronicles;
    scene.enemies.actors.find((actor: any) => actor.def.boss).hp = 328;
  });
  await approachEnemy(page, 'guardian-0');
  await attackEnemy(page, 'guardian-0', false);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.def.boss).phase)).toBe(2);
  await expect(page.locator('.boss-hud')).toContainText('Fúria ancestral');
  await expect.poll(() => page.evaluate(() => {
    const actor = (window as any).__chronicles.scene.enemies.actors.find((actor: any) => actor.def.boss);
    return actor.special && actor.windup > 0;
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.projectiles.projectiles.some((projectile: any) => projectile.hostile && projectile.magic))).toBe(true);
});

test('day and night render effective darkness and player-built torches emit light', async ({ page }) => {
  expect(await page.evaluate(() => {
    const night = (window as any).__chronicles.scene.visuals.night;
    return night.alpha * night.fillAlpha;
  })).toBe(0);
  await page.evaluate(() => {
    const { model } = (window as any).__chronicles;
    model.state.time = 700; // 22:00, avoiding a long wait through the day.
    model.add('torch', 1);
  });
  await expect.poll(() => page.evaluate(() => {
    const night = (window as any).__chronicles.scene.visuals.night;
    return night.alpha * night.fillAlpha;
  })).toBeGreaterThan(.5);
  await expect(page.locator('.world-time')).toContainText('22:');
  const torch = await build(page, 'torch');
  await expect.poll(() => page.evaluate(id => (window as any).__chronicles.scene.build.lights.get(id)?.alpha ?? 0, torch.id)).toBeGreaterThan(.6);
  await page.screenshot({ path: 'test-results/night-regression.png' });
  await page.evaluate(() => { (window as any).__chronicles.model.state.time = 0; });
  await expect.poll(() => page.evaluate(() => {
    const night = (window as any).__chronicles.scene.visuals.night;
    return night.alpha * night.fillAlpha;
  })).toBe(0);
  await expect.poll(() => page.evaluate(id => (window as any).__chronicles.scene.build.lights.get(id)?.alpha ?? 0, torch.id)).toBeLessThan(.2);
});

test('harvested trees stay depleted under a construction and regrow after it is removed', async ({ page }) => {
  await gather(page, 'wood', 1, true);
  const node = await page.evaluate(() => {
    const { scene } = (window as any).__chronicles;
    return { ...scene.world.nodes.find((node: any) => node.type === 'tree' && scene.resources.depleted.has(node.id)) };
  });
  await page.evaluate(() => (window as any).__chronicles.model.add('fence', 1));
  await page.keyboard.press('b');
  await page.locator('[data-build="fence"]').click();
  const point = await screenPoint(page, node.x, node.y);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.build.valid)).toBe(true);
  await page.mouse.click(point.x, point.y);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.structures.length)).toBe(1);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.build.type)).toBe(null);
  await idle(page);
  await page.evaluate(() => { (window as any).__chronicles.model.state.time += 300; });
  await expect.poll(() => page.evaluate(id => {
    const { model } = (window as any).__chronicles;
    return model.state.resources[id].respawnAt > model.state.time;
  }, node.id)).toBe(true);
  expect(await page.evaluate(id => (window as any).__chronicles.scene.resources.depleted.has(id), node.id)).toBe(true);
  expect(await page.evaluate(id => (window as any).__chronicles.scene.resources.images.get(id).texture.key, node.id)).toBe('stump');

  await page.keyboard.press('b');
  await page.locator('[data-action="remove-build"]').click();
  const removalPoint = await screenPoint(page, node.x, node.y);
  await page.mouse.move(removalPoint.x, removalPoint.y);
  await page.mouse.click(removalPoint.x, removalPoint.y);
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.model.state.structures.length)).toBe(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.build.type)).toBe(null);
  await teleport(page, 1120, 1728);
  await page.evaluate(() => { (window as any).__chronicles.model.state.time += 25; });
  await expect.poll(() => page.evaluate(id => (window as any).__chronicles.scene.resources.depleted.has(id), node.id)).toBe(false);
  expect(await page.evaluate(id => (window as any).__chronicles.scene.resources.images.get(id).texture.key, node.id)).toBe(node.texture);
  expect(await page.evaluate(id => (window as any).__chronicles.scene.resources.images.get(id).visible, node.id)).toBe(true);
});

test('fishing reaches the furthest lake fishing spot from a walkable shore', async ({ page }) => {
  const target = await page.evaluate(() => {
    const { scene } = (window as any).__chronicles;
    const candidates = scene.world.nodes.filter((node: any) => node.type === 'fish').map((node: any) => {
      const shore: { x: number; y: number; distance: number }[] = [];
      for (let dy = -128; dy <= 128; dy += 8) for (let dx = -128; dx <= 128; dx += 8) {
        const distance = Math.hypot(dx, dy), x = node.x + dx, y = node.y + dy;
        if (distance > 112 || scene.blocked(x, y, 8)) continue;
        shore.push({ x, y, distance });
      }
      shore.sort((a, b) => a.distance - b.distance);
      return { node, shore, closest: shore[0]?.distance ?? Infinity };
    }).sort((a: any, b: any) => b.closest - a.closest);
    const furthest = candidates[0];
    if (!furthest || !Number.isFinite(furthest.closest)) throw new Error('Fishing spot has no walkable shore within casting range');
    if (furthest.closest <= 82) throw new Error('The fixture must cover the former 82px casting limit');
    for (const shore of furthest.shore) {
      scene.player.teleport(shore.x, shore.y);
      if (scene.context()?.kind !== 'resource' || scene.context()?.data.id !== furthest.node.id) continue;
      scene.cameras.main.centerOn(shore.x, shore.y);
      return { id: furthest.node.id, distance: shore.distance };
    }
    throw new Error(`No usable fishing interaction on the shore for ${furthest.node.id}`);
  });
  expect(target.distance).toBeGreaterThan(82);
  expect(target.distance).toBeLessThanOrEqual(112);
  await page.keyboard.press('e');
  await expect.poll(() => page.evaluate(() => (window as any).__chronicles.scene.player.action)).toBe('fish');
  await page.screenshot({ path: 'test-results/fishing-regression.png' });
  await idle(page);
  expect(await count(page, 'fish')).toBe(2);
  expect(await page.evaluate(id => (window as any).__chronicles.scene.resources.depleted.has(id), target.id)).toBe(true);
});
