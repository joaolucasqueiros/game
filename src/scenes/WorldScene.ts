import Phaser from 'phaser';
import { ITEMS } from '../data/items';
import { NPCS } from '../data/npcs';
import { ENEMIES } from '../data/enemies';
import { STRUCTURES } from '../data/structures';
import { RECIPES } from '../data/recipes';
import { GameModel, createInitialState } from '../systems/GameModel';
import { saveGame, loadGame, hasSave } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { PlayerController } from '../systems/PlayerController';
import { EnemySystem } from '../systems/EnemySystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ResourceSystem } from '../systems/ResourceSystem';
import { BuildSystem } from '../systems/BuildSystem';
import { WorldMap, WORLD_WIDTH, WORLD_HEIGHT, START, TILE } from '../world/WorldMap';
import { WorldVisuals } from '../world/WorldVisuals';
import type { Building, NpcDef, PlacedStructure, ResourceNode, SavedLoot } from '../types';
import type { GameUI } from '../ui/GameUI';
import type { ChestSpawn } from '../world/WorldMap';

type Context = { kind: 'npc'; data: NpcDef; prompt: string } | { kind: 'resource'; data: ResourceNode; prompt: string } |
  { kind: 'structure'; data: PlacedStructure; prompt: string } | { kind: 'chest'; data: ChestSpawn; prompt: string } |
  { kind: 'building'; data: Building; prompt: string };
interface LootBag { sprite: Phaser.GameObjects.Image; data: SavedLoot; age: number }

export class WorldScene extends Phaser.Scene {
  ui!: GameUI;
  world = new WorldMap();
  player!: PlayerController;
  resources!: ResourceSystem;
  build!: BuildSystem;
  enemies!: EnemySystem;
  projectiles!: ProjectileSystem;
  visuals!: WorldVisuals;
  audio = new AudioSystem();
  started = false;
  ready = false;
  paused = true;
  openStorage?: PlacedStructure;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private attackCooldown = 0;
  private lootBags: LootBag[] = [];
  private marker!: Phaser.GameObjects.Graphics;
  private hudTimer = 0;
  private saveTimer = 0;
  private poison = 0;
  private poisonTick = 0;
  private lastRegion = '';
  private lastLevel = 1;
  private savedAt = 0;
  private elapsed = 0;
  private holdingAttack = false;
  private isDead = false;
  private loadingErrors: string[] = [];
  constructor(public model: GameModel, private onReady: () => void) { super('World'); }

  preload() {
    const w = this.scale.width, h = this.scale.height;
    const progress = this.add.graphics();
    const label = this.add.text(w / 2, h / 2 - 34, 'DESPERTANDO O VALE', { fontFamily: 'Georgia', fontSize: '17px', color: '#e2d2a6', letterSpacing: 4 }).setOrigin(0.5);
    this.load.on('progress', (value: number) => {
      progress.clear().fillStyle(0x38493d).fillRect(w / 2 - 120, h / 2, 240, 3).fillStyle(0xd8b77b).fillRect(w / 2 - 120, h / 2, 240 * value, 3);
    });
    this.load.on('loaderror', (file: { key: string }) => this.loadingErrors.push(file.key));
    this.load.once('complete', () => { progress.destroy(); label.destroy(); });
    this.load.image('terrain', '/assets/terrain.png');
    for (const key of ['path_edges', 'shore_edges', 'water_edges']) this.load.spritesheet(key, `/assets/${key}.png`, { frameWidth: 32, frameHeight: 32 });
    const images = ['tree_oak', 'tree_pine', 'tree_birch', 'rock', 'copper_ore', 'iron_ore', 'silver_ore', 'gold_ore', 'crystal', 'herb', 'mushroom', 'flower', 'berry', 'fiber', 'stump', 'chest', 'torch', 'workbench', 'furnace', 'forge', 'alchemy', 'carpentry', 'fence', 'wall', 'gate', 'garden', 'cabin', 'house', 'animal_pen', 'home', 'smithy', 'tavern', 'market', 'well', 'ruin_arch', 'mine_entrance', 'bridge', 'flowers', 'grass_tuft', 'sign', 'lily', 'log'];
    images.forEach(key => this.load.image(key, `/assets/${key}.png`));
    Object.keys(ITEMS).forEach(id => this.load.image(`item_${id}`, `/assets/items/${id}.png`));
    this.load.spritesheet('player', '/assets/player.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('armor_chest', '/assets/armor_chest.png', { frameWidth: 48, frameHeight: 64 });
    this.load.spritesheet('armor_helmet', '/assets/armor_helmet.png', { frameWidth: 48, frameHeight: 64 });
    NPCS.forEach(npc => this.load.spritesheet(npc.sprite, `/assets/${npc.sprite.replaceAll('-', '_')}.png`, { frameWidth: 48, frameHeight: 64 }));
    Object.values(ENEMIES).forEach(e => this.load.spritesheet(`enemy_${e.id}`, `/assets/enemy_${e.id}.png`, { frameWidth: e.boss ? 96 : 48, frameHeight: e.boss ? 112 : 64 }));
    ['chicken', 'sheep'].forEach(key => this.load.spritesheet(key, `/assets/${key}.png`, { frameWidth: 32, frameHeight: 32 }));
    this.load.spritesheet('butterfly', '/assets/butterfly.png', { frameWidth: 16, frameHeight: 16 });
  }
  create() {
    this.cameras.main.setBackgroundColor('#223c2e').setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT).setRoundPixels(true);
    this.visuals = new WorldVisuals(this, this.world);
    this.player = new PlayerController(this, () => this.model.state, (x, y, r) => this.blocked(x, y, r));
    this.player.onStep = () => this.audio.play('step');
    this.createSystems();
    this.marker = this.add.graphics().setDepth(7000);
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SHIFT,SPACE,E,I,C,B,M,J,K,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,F5') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture(['SPACE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'F5']);
    this.input.keyboard!.on('keydown', (event: KeyboardEvent) => this.onKey(event));
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.started || this.ui.isBlocking || this.model.state.health <= 0) return;
      pointer.updateWorldPoint(this.cameras.main);
      this.audio.unlock();
      if (pointer.rightButtonDown()) { this.secondary(); return; }
      if (!pointer.leftButtonDown()) return;
      if (this.build.type) { this.build.update(pointer.worldX, pointer.worldY); this.build.place(); return; }
      this.holdingAttack = true; this.useActive(pointer.worldX, pointer.worldY);
    });
    this.input.on('pointerup', () => { this.holdingAttack = false; this.player.blocking = false; });
    this.game.events.on('blur', () => { this.holdingAttack = false; this.player.blocking = false; if (this.started && !this.ui.isBlocking) this.ui.open('pause'); });
    this.scale.on('resize', () => this.resize());
    this.cameras.main.startFollow(this.player.sprite, true, 0.09, 0.09).setFollowOffset(0, -24);
    this.resize();
    this.ready = true;
    this.onReady();
    this.ui.showTitle(hasSave());
    if (this.loadingErrors.length) this.ui.toast(`Falha ao carregar arte: ${this.loadingErrors.join(', ')}. Atualize a página.`);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.started) this.save(false); });
    window.addEventListener('beforeunload', () => { if (this.started) this.save(false); });
    this.updateHud();
  }
  private createSystems() {
    const callbacks = {
      model: this.model, player: this.player, notice: (s: string) => this.ui?.toast(s),
      text: (x: number, y: number, s: string, color?: string) => this.floatingText(x, y, s, color),
      particles: (x: number, y: number, color: number, n?: number) => this.particles(x, y, color, n),
    };
    this.resources = new ResourceSystem(this, this.world.nodes, { ...callbacks, sound: t => this.audio.play(t), canRespawn: node => {
      if (Math.hypot(node.x - this.player.x, node.y - this.player.y) < 30) return false;
      return !this.model.state.structures.some(structure => {
        const def = STRUCTURES[structure.type];
        return node.x + 23 > structure.x * TILE && node.x - 23 < (structure.x + def.width) * TILE && node.y + 14 > structure.y * TILE && node.y - 14 < (structure.y + def.height) * TILE;
      });
    } });
    this.build = new BuildSystem(this, { ...callbacks, world: this.world, resources: this.resources, sound: () => this.audio.play('build'), occupied: (x, y, w, h) => this.enemies?.actors.some(a => !a.dead && a.sprite.x > x - 10 && a.sprite.x < x + w + 10 && a.sprite.y > y - 10 && a.sprite.y < y + h + 10) || this.visuals.npcs.some(n => n.sprite.x > x - 10 && n.sprite.x < x + w + 10 && n.sprite.y > y - 10 && n.sprite.y < y + h + 10) });
    this.enemies = new EnemySystem(this, this.world.enemySpawns, { ...callbacks,
      blocked: (x, y, r) => this.blocked(x, y, r), hitPlayer: (d, x, y, poison) => this.hitPlayer(d, x, y, poison),
      loot: (x, y, items, coins) => this.dropLoot(x, y, items, coins), shoot: (x, y, angle, damage, hostile, magic) => this.projectiles.shoot(x, y, angle, damage, hostile, magic), sound: t => this.audio.play(t),
    });
    this.projectiles = new ProjectileSystem(this, this.player, this.enemies, (x, y, r) => this.blocked(x, y, r), (d, x, y) => this.hitPlayer(d, x, y), (x, y, c, n) => this.particles(x, y, c, n));
    this.visuals.chestImages.forEach((image, id) => { image.clearTint().setAlpha(1); if (this.model.state.openedChests.includes(id)) this.visuals.setChestOpened(id); });
    for (const loot of this.model.state.loot) this.renderLoot(loot);
  }
  resize() {
    this.cameras.main.setZoom(this.scale.width < 700 ? 1.4 : this.scale.width < 1100 ? 1.8 : 2.15);
    this.visuals?.resize();
  }
  startGame(fresh: boolean) {
    if (!this.ready) return;
    if (fresh) {
      const settings = this.model.state.settings;
      this.model.state = createInitialState(); this.model.state.settings = settings;
    } else {
      const restored = loadGame();
      if (restored) this.model.state = restored;
    }
    this.tweens.killAll();
    this.resources.destroy(); this.build.destroy(); this.enemies.destroy(); this.projectiles.clear();
    this.lootBags.forEach(b => b.sprite.destroy()); this.lootBags = [];
    this.createSystems();
    this.player.action = 'idle'; this.player.actionTime = 0; this.player.onActionEnd = undefined;
    this.player.sprite.setAngle(0).setAlpha(1); this.player.invulnerable = 1;
    const position = this.model.state.position;
    this.player.teleport(position.x, position.y);
    if (this.blocked(this.player.x, this.player.y, 7)) this.player.teleport(START.x, START.y);
    this.started = true; this.paused = false; this.isDead = false; this.lastRegion = ''; this.saveTimer = 0; this.poison = 0;
    this.lastLevel = this.model.state.level;
    this.audio.unlock(); this.ui.close(); this.model.changed(); this.updateHud();
    this.cameras.main.centerOn(this.player.x, this.player.y);
    this.ui.toast(fresh ? 'Seu primeiro capítulo: colete madeira e pedra com E. O diário acompanha sua jornada.' : 'Bem-vindo de volta. Sua jornada continua.');
    if (this.model.state.health <= 0) this.die();
    else this.save(false);
  }
  save(notify = true) {
    if (!this.started) return;
    const result = saveGame(this.model.state);
    if (result.ok) this.savedAt = Date.now();
    if (notify || !result.ok) this.ui.toast(result.message);
    this.saveTimer = 0;
  }
  select(index: number) {
    this.model.state.selected = index;
    if (index === 0 && this.model.state.equipment.weapon) this.model.state.hotbar[0] = this.model.state.equipment.weapon;
    const id = this.model.state.hotbar[index];
    if (id && ITEMS[id]?.kind === 'consumable') {
      const slot = this.model.state.inventory.findIndex(s => s?.item === id);
      if (slot >= 0) { const result = this.model.consume(slot); this.ui.toast(result.message); }
      else this.ui.toast('Este consumível acabou. Reponha-o na fabricação ou no mercado.');
    }
    this.model.changed();
  }
  craft(id: string) {
    const stations = this.build.stations(this.player.x, this.player.y);
    const result = this.model.craft(id, stations);
    this.ui.toast(result.message);
    if (result.ok) {
      this.audio.play('build');
      const recipe = RECIPES.find(r => r.id === id)!;
      const item = ITEMS[recipe.item];
      if (item.kind === 'structure') {
        const free = this.model.state.hotbar.findIndex((slot, i) => i > 3 && !slot);
        if (free >= 0 && !this.model.state.hotbar.includes(item.id)) this.model.state.hotbar[free] = item.id;
      }
      if (item.kind === 'weapon') {
        const free = this.model.state.hotbar.findIndex((slot, i) => i > 3 && !slot);
        if (free >= 0 && !this.model.state.hotbar.includes(item.id)) this.model.state.hotbar[free] = item.id;
      }
      this.model.changed();
    }
  }
  get activeItem() {
    const id = this.model.state.hotbar[this.model.state.selected];
    if (id && (this.model.count(id) > 0 || Object.values(this.model.state.equipment).includes(id))) return id;
    return this.model.state.selected === 0 ? (this.model.state.equipment.weapon ?? '') : '';
  }
  private onKey(event: KeyboardEvent) {
    if (!this.ready || !this.started || event.repeat) return;
    if ((event.target as HTMLElement)?.matches('input,textarea,select')) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (this.build.type) { this.build.select(null); return; }
      if (this.ui.isBlocking) { if (!this.isDead) this.ui.close(); }
      else this.ui.open('pause');
      return;
    }
    if (key === 'f5') { event.preventDefault(); this.save(); return; }
    if (this.isDead) return;
    const menus: Record<string, string> = { i: 'inventory', c: 'craft', b: 'build', m: 'map', j: 'quests', k: 'skills' };
    if (menus[key]) {
      if (this.ui.activePanel === menus[key]) this.ui.close();
      else { this.build.select(null); this.ui.open(menus[key]); }
      return;
    }
    if (this.ui.isBlocking) return;
    if (/^[1-9]$/.test(key)) { this.select(Number(key) - 1); return; }
    if (key === 'e') this.interact();
    if (key === ' ') {
      event.preventDefault();
      const [dx, dy] = this.movement();
      if (this.player.evade(dx, dy)) { this.audio.play('sword'); this.particles(this.player.x, this.player.y, 0xc7c5a0, 6); }
    }
  }
  private movement(): [number, number] {
    return [Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown), Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown)];
  }
  blocked(x: number, y: number, r = 8) {
    return this.world.isStaticBlocked(x, y, r) || !!this.resources?.blocked(x, y, r) || !!this.build?.blocked(x, y, r);
  }
  private secondary() {
    if (this.model.state.equipment.shield) { this.player.blocking = true; this.ui.toast('Escudo erguido. Golpes frontais consomem energia ao bloquear.'); }
    else this.interact();
  }
  private useActive(worldX: number, worldY: number) {
    if (this.player.busy || this.attackCooldown > 0) return;
    const id = this.activeItem, item = ITEMS[id];
    if (!item) { this.ui.toast('Selecione sua espada [1], machado [2] ou picareta [3].'); this.holdingAttack = false; return; }
    this.player.face(worldX, worldY);
    if (item.kind === 'structure') { this.build.select(item.structure!); this.holdingAttack = false; return; }
    if (item.kind === 'consumable') { this.select(this.model.state.selected); this.holdingAttack = false; return; }
    if (item.kind !== 'weapon' && item.kind !== 'tool') return;
    if (item.tool) {
      const node = this.resources.nodes.filter(n => !this.resources.depleted.has(n.id) && (item.tool === 'axe' ? n.type === 'tree' : n.type === 'rock' || n.type === 'ore') && Math.hypot(n.x - this.player.x, n.y - this.player.y) < 68 && Math.hypot(n.x - worldX, n.y - worldY) < 90).sort((a, b) => Math.hypot(a.x - worldX, a.y - worldY) - Math.hypot(b.x - worldX, b.y - worldY))[0];
      if (node) { this.resources.gather(node, id); this.attackCooldown = 0.5; return; }
    }
    const ranged = item.weaponType === 'bow' || item.weaponType === 'staff';
    const cost = item.weaponType === 'axe' ? 9 : ranged ? 3 : 5;
    if (this.model.state.energy < cost) { this.ui.toast('Recupere energia antes de atacar.'); this.holdingAttack = false; return; }
    if (item.weaponType === 'bow' && !this.model.remove('arrow', 1)) { this.ui.toast('Sem flechas. Fabrique-as com madeira e pedra [C].'); this.holdingAttack = false; return; }
    if (item.weaponType === 'staff') {
      if (this.model.state.mana < 8) { this.ui.toast('Mana insuficiente. Espere ou use uma poção de vigor.'); this.holdingAttack = false; return; }
      this.model.state.mana -= 8;
    }
    this.model.state.energy -= cost;
    this.attackCooldown = (item.cooldown ?? 420) / 1000;
    this.player.setAction('attack', ranged ? 0.26 : this.attackCooldown * 0.7);
    const skill = ranged ? 'archery' : 'melee';
    const damage = (item.damage ?? 3) + (this.model.skillLevel(skill) - 1) + this.model.state.level - 1;
    if (ranged) {
      this.projectiles.shoot(this.player.x + Math.cos(this.player.angle) * 18, this.player.y - 14, this.player.angle, damage, false, item.weaponType === 'staff', item.range);
      this.audio.play(item.weaponType === 'staff' ? 'magic' : 'bow');
    } else {
      const swing = this.add.graphics().setDepth(this.player.y + 1);
      const radius = item.range ?? 54;
      const spread = item.weaponType === 'spear' ? 0.32 : item.weaponType === 'axe' ? 1.7 : 1.1;
      const x = this.player.x, y = this.player.y - 10, angle = this.player.angle;
      swing.lineStyle(item.weaponType === 'axe' ? 6 : 4, item.rarity === 'legendary' ? 0xf7d980 : 0xe6eed6, 0.8);
      if (item.weaponType === 'spear') swing.lineBetween(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10, x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
      else swing.beginPath().arc(x, y, radius * 0.65, angle - spread, angle + spread, false).strokePath();
      this.tweens.add({ targets: swing, alpha: 0, duration: 190, onComplete: () => swing.destroy() });
      this.audio.play('sword');
      for (const enemy of this.enemies.actors) {
        if (enemy.dead) continue;
        const dx = enemy.sprite.x - x, dy = enemy.sprite.y - this.player.y;
        const difference = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - angle);
        if (Math.hypot(dx, dy) < radius + (enemy.def.boss ? 24 : 10) && Math.abs(difference) < spread && !this.obstructed(x, this.player.y, enemy.sprite.x, enemy.sprite.y)) this.enemies.hit(enemy, damage, x, this.player.y);
      }
    }
    this.model.skillXP(skill, 1);
  }
  private obstructed(x: number, y: number, endX: number, endY: number) {
    const steps = Math.ceil(Math.hypot(endX - x, endY - y) / 10);
    for (let i = 1; i < steps; i++) if (this.blocked(x + (endX - x) * i / steps, y + (endY - y) * i / steps, 1)) return true;
    return false;
  }
  hitPlayer(damage: number, x: number, y: number, poison = false) {
    if (this.player.invulnerable > 0 || this.model.state.health <= 0) return;
    let amount = Math.max(1, Math.round(damage - this.model.defense * 0.65));
    if (this.player.blocking && this.model.state.energy >= 8 && Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(y - this.player.y, x - this.player.x) - this.player.angle)) < 1.7) {
      amount = Math.max(1, Math.round(amount * 0.25)); this.model.state.energy -= 8;
      this.floatingText(this.player.x, this.player.y - 50, 'BLOQUEIO', '#c2e1d8');
    }
    this.model.state.health = Math.max(0, this.model.state.health - amount);
    this.player.hurt(x, y); this.audio.play('hurt');
    this.floatingText(this.player.x, this.player.y - 38, `−${amount}`, '#ffad9a');
    this.particles(this.player.x, this.player.y - 14, 0xdb7764, 6);
    this.cameras.main.shake(90, 0.002);
    if (poison) { this.poison = 7; this.ui.toast('Envenenado: dano leve por alguns segundos. Uma poção pode ajudar.'); }
    this.model.changed();
    if (this.model.state.health <= 0) this.die();
  }
  private die() {
    this.isDead = true; this.player.setAction('dead', 10); this.player.sprite.setAngle(85);
    this.player.weapon.setVisible(false); this.player.armorChest.setVisible(false); this.player.armorHelmet.setVisible(false);
    this.holdingAttack = false; this.poison = 0; this.audio.play('death');
    this.time.delayedCall(500, () => this.ui.showDeath());
  }
  respawn() {
    const penalty = Math.min(25, Math.floor(this.model.state.coins * 0.1));
    this.model.state.coins -= penalty; this.model.state.health = this.model.maxHealth; this.model.state.energy = this.model.maxEnergy; this.model.state.mana = this.model.maxMana;
    this.player.teleport(START.x, START.y); this.player.action = 'idle'; this.player.actionTime = 0; this.player.onActionEnd = undefined; this.player.invulnerable = 3;
    this.player.sprite.setAngle(0); this.projectiles.clear(); this.poison = 0; this.isDead = false;
    this.ui.close(); this.model.changed(); this.cameras.main.centerOn(START.x, START.y);
    this.ui.toast(`Você despertou em casa. Perdeu ${penalty} moedas; seus itens estão seguros.`); this.save(false);
  }
  private context(): Context | undefined {
    const x = this.player.x, y = this.player.y;
    const npc = this.visuals.nearestNpc(x, y, 67);
    if (npc) return { kind: 'npc', data: npc, prompt: `Conversar com ${npc.name} · ${npc.role}` };
    const chest = this.world.chests.find(c => !this.model.state.openedChests.includes(c.id) && Math.hypot(c.x - x, c.y - y) < 60);
    if (chest) return { kind: 'chest', data: chest, prompt: 'Abrir baú de tesouro' };
    const structure = this.build.near(x, y, 48);
    if (structure) return { kind: 'structure', data: structure, prompt: structure.type === 'chest' ? 'Abrir armazenamento' : structure.type === 'garden' ? 'Colher canteiro' : `Usar ${STRUCTURES[structure.type].name}` };
    const resource = this.resources.near(x, y);
    if (resource) return { kind: 'resource', data: resource, prompt: `${resource.type === 'tree' ? 'Cortar' : ['ore', 'rock'].includes(resource.type) ? 'Minerar' : resource.type === 'fish' ? 'Pescar' : 'Coletar'} ${ITEMS[resource.item].name}` };
    const building = this.world.buildings.find(b => {
      const cx = Math.max(b.x - b.width / 2, Math.min(x, b.x + b.width / 2));
      return Math.hypot(x - cx, y - b.y) < 65;
    });
    if (building) return { kind: 'building', data: building, prompt: building.station ? `Usar ${building.name}` : building.id === 'player-home' ? 'Descansar em casa' : building.id === 'village-well' ? 'Beber água do poço' : building.name };
  }
  interact() {
    if (!this.started || this.ui.isBlocking || this.player.busy || this.isDead) return;
    const context = this.context();
    if (!context) { this.ui.toast('Aproxime-se de árvores, rochas, baús ou habitantes. Pressione E para interagir.'); return; }
    switch (context.kind) {
      case 'resource': this.resources.gather(context.data); break;
      case 'npc': this.model.metric(`talk:${context.data.id}`); this.ui.showNpc(context.data); this.audio.play('ui'); break;
      case 'chest': this.openTreasure(context.data); break;
      case 'structure': {
        const structure = context.data, def = STRUCTURES[structure.type];
        if (structure.type === 'chest') { this.openStorage = structure; this.ui.showStorage(structure); }
        else if (structure.type === 'garden') {
          if (this.model.state.time - (structure.plantedAt ?? 0) < 90) this.ui.toast(`Ervas crescendo. Próxima colheita em ${Math.ceil(90 - this.model.state.time + (structure.plantedAt ?? 0))} s.`);
          else if (this.model.add('herb', 4)) { structure.plantedAt = this.model.state.time; this.model.metric('gather:herb', 4); this.ui.toast('Colhido: 4 ervas. O canteiro voltará a crescer.'); this.model.changed(); }
          else this.ui.toast('Inventário cheio.');
        } else if (def.station) this.ui.open('craft');
        else if (['cabin', 'house'].includes(structure.type)) this.rest();
        else this.ui.toast(def.description);
        break;
      }
      case 'building': {
        const building = context.data;
        if (building.station) this.ui.open('craft');
        else if (building.id === 'player-home' || building.id.includes('cottage')) this.rest();
        else if (building.id === 'village-well') { this.model.state.energy = this.model.maxEnergy; this.model.changed(); this.ui.toast('A água fresca restaurou sua energia.'); }
        else if (building.id === 'village-tavern') {
          if (this.model.state.coins >= 5) { this.model.state.coins -= 5; this.rest(); this.ui.toast('Uma refeição na taverna: vida e energia restauradas por 5 moedas.'); }
          else this.ui.toast('A taverna serve uma refeição completa por 5 moedas.');
        } else if (building.id === 'mine-entrance') this.ui.toast('As galerias se estendem para o norte. Ferro pode ser extraído com a picareta de pedra.');
        else if (building.id === 'ruin-entrance') this.ui.toast('O Guardião espera a leste. Prepare armadura, poções e uma arma de ferro.');
        else this.ui.toast('As lojas atendem com os comerciantes da praça. Encontre Olívia e Breno.');
        break;
      }
    }
  }
  private rest() {
    if (this.enemies.inCombat) { this.ui.toast('Afaste os inimigos antes de descansar.'); return; }
    this.model.state.health = this.model.maxHealth; this.model.state.energy = this.model.maxEnergy; this.model.state.mana = this.model.maxMana; this.poison = 0;
    this.model.changed(); this.audio.play('pickup'); this.ui.toast('Um momento de descanso. Vida, energia e mana restauradas.'); this.save(false);
  }
  private openTreasure(chest: ChestSpawn) {
    // Preserve uncollected treasure when the backpack cannot fit the entire reward.
    const before = this.model.state.inventory.map(s => s ? { ...s } : null);
    for (const [id, qty] of Object.entries(chest.items)) {
      if (!this.model.add(id, qty)) { this.model.state.inventory = before; this.model.changed(); this.ui.toast('Libere espaço no inventário para abrir este baú.'); return; }
    }
    this.model.state.coins += chest.coins; this.model.state.openedChests.push(chest.id); this.model.addXP(15);
    this.visuals.setChestOpened(chest.id); this.audio.play('pickup');
    this.particles(chest.x, chest.y - 20, 0xffd77a, 18);
    this.ui.toast(`Tesouro encontrado: ${chest.coins} moedas e ${Object.entries(chest.items).map(([id, qty]) => `${qty} ${ITEMS[id].name}`).join(', ')}.`);
    this.model.changed(); this.save(false);
  }
  private dropLoot(x: number, y: number, items: Record<string, number>, coins: number) {
    const data: SavedLoot = { id: crypto.randomUUID(), x, y, items, coins };
    this.model.state.loot.push(data); this.renderLoot(data);
  }
  private renderLoot(data: SavedLoot) {
    const first = Object.keys(data.items)[0] ?? 'leather';
    const sprite = this.add.image(data.x, data.y - 5, `item_${first}`).setScale(0.8).setDepth(data.y + 0.5);
    this.lootBags.push({ sprite, data, age: 0 });
  }
  private collectLoot(dt: number) {
    for (const bag of this.lootBags) {
      bag.age += dt;
      bag.sprite.setAlpha(0.85 + Math.sin(bag.age * 5) * 0.15);
      if (bag.age < 0.6 || Math.hypot(this.player.x - bag.sprite.x, this.player.y - bag.sprite.y) > 35) continue;
      let got = false;
      for (const [id, qty] of Object.entries(bag.data.items)) if (this.model.add(id, qty)) {
        this.floatingText(bag.sprite.x, bag.sprite.y - 20, `+${qty} ${ITEMS[id].name}`, '#ebdaa8'); delete bag.data.items[id]; got = true;
      }
      if (bag.data.coins) { this.model.state.coins += bag.data.coins; bag.data.coins = 0; this.model.changed(); got = true; }
      if (got) this.audio.play('pickup');
      if (!Object.keys(bag.data.items).length && !bag.data.coins) { this.model.state.loot = this.model.state.loot.filter(loot => loot.id !== bag.data.id); bag.sprite.destroy(); }
    }
    this.lootBags = this.lootBags.filter(b => b.sprite.active);
  }
  floatingText(x: number, y: number, value: string, color = '#f2e6c8') {
    const text = this.add.text(x, y, value, { fontFamily: 'Verdana', fontSize: '10px', fontStyle: 'bold', color, stroke: '#16231f', strokeThickness: 3 }).setOrigin(0.5).setDepth(10001);
    this.tweens.add({ targets: text, y: y - 32, alpha: 0, delay: 150, duration: 850, onComplete: () => text.destroy() });
  }
  particles(x: number, y: number, color: number, count = 6) {
    for (let i = 0; i < count; i++) {
      const p = this.add.rectangle(x, y, Phaser.Math.Between(1, 3), Phaser.Math.Between(1, 3), color).setDepth(y + 25);
      this.tweens.add({ targets: p, x: x + Phaser.Math.Between(-22, 22), y: y + Phaser.Math.Between(-25, 10), alpha: 0, duration: Phaser.Math.Between(260, 600), onComplete: () => p.destroy() });
    }
  }
  private updateHud() {
    if (!this.ui || !this.player) return;
    const region = this.world.regionAt(this.player.x, this.player.y), minutes = Math.floor((8 * 60 + this.model.state.time / 50 * 60) % (24 * 60));
    this.ui.update({ region: region.name, subtitle: region.subtitle, time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`, day: Math.floor((this.model.state.time + 400) / 1200) + 1, x: this.player.x, y: this.player.y, prompt: this.build.type ? 'Clique para posicionar · Esc para cancelar' : this.context()?.prompt ?? '', stations: this.build.stations(this.player.x, this.player.y), buildType: this.build.type, buildValid: this.build.valid, boss: this.enemies.boss, paused: this.paused });
  }
  update(_time: number, delta: number) {
    if (!this.ready) return;
    const dt = Math.min(delta / 1000, 0.045);
    this.elapsed += dt;
    this.visuals.update(this.started && !this.paused && !this.ui.isBlocking ? dt : 0, this.model.state.time, this.player.x, this.player.y);
    this.build.tick(this.model.state.time);
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) { this.hudTimer = 0.12; this.updateHud(); }
    this.marker.clear();
    if (!this.started || this.paused || this.ui.isBlocking || this.isDead) { this.holdingAttack = false; return; }
    this.model.state.time += dt; this.saveTimer += dt; this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const [dx, dy] = this.movement();
    this.player.update(dt, dx, dy, this.keys.SHIFT.isDown, this.activeItem);
    this.resources.update(dt); this.enemies.update(dt); this.projectiles.update(dt); this.collectLoot(dt);
    if (this.model.state.health <= 0) return;
    if (!this.player.busy && !(this.keys.SHIFT.isDown && (dx || dy))) this.model.state.energy = Math.min(this.model.maxEnergy, this.model.state.energy + dt * 12);
    this.model.state.mana = Math.min(this.model.maxMana, this.model.state.mana + dt * 2.5);
    if (this.poison > 0) {
      this.poison -= dt; this.poisonTick -= dt;
      if (this.poisonTick <= 0) { this.poisonTick = 1; this.model.state.health = Math.max(0, this.model.state.health - 2); this.floatingText(this.player.x, this.player.y - 38, '−2 veneno', '#b7cf7d'); if (this.model.state.health <= 0) this.die(); }
    }
    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    if (this.build.type) this.build.update(pointer.worldX, pointer.worldY);
    else if (this.holdingAttack && pointer.isDown) this.useActive(pointer.worldX, pointer.worldY);
    const context = this.context();
    if (context) {
      const point = context.kind === 'structure' ? { x: (context.data.x + STRUCTURES[context.data.type].width / 2) * TILE, y: (context.data.y + STRUCTURES[context.data.type].height) * TILE } : context.data;
      this.marker.lineStyle(1, 0xf2dc9e, 0.65).strokeEllipse(point.x, point.y - 3, 28 + Math.sin(this.elapsed * 3) * 2, 11);
    }
    const region = this.world.regionAt(this.player.x, this.player.y);
    if (region.id !== this.lastRegion) {
      this.lastRegion = region.id; this.model.visit(region.id);
      if (region.id !== 'valley') this.ui.toast(`${region.name} · ${region.subtitle}`);
    }
    if (this.model.state.level > this.lastLevel) { this.lastLevel = this.model.state.level; this.audio.play('level'); this.particles(this.player.x, this.player.y - 18, 0xf2d18b, 22); }
    const settings = this.model.state.settings;
    this.audio.enabled = settings.sound; this.audio.music = settings.music; this.audio.volume = settings.volume;
    this.audio.update(dt, this.enemies.inCombat);
    if (this.saveTimer >= 20) this.save(false);
  }
}
