import Phaser from 'phaser';
import { NPCS } from '../data/npcs';
import type { Direction, NpcDef } from '../types';
import { TILE, WorldMap } from './WorldMap';

type NpcActor = {
  def: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  role: Phaser.GameObjects.Text;
  direction: Direction;
  phase: number;
};
type Animal = { sprite: Phaser.GameObjects.Sprite; homeX: number; homeY: number; phase: number; speed: number };
type Butterfly = { sprite: Phaser.GameObjects.Sprite; x: number; y: number; phase: number };
type Smoke = { image: Phaser.GameObjects.Image; x: number; y: number; phase: number; depth: number };
const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];

/** Ambient presentation only; resources, gameplay interaction and collisions remain in their systems. */
export class WorldVisuals {
  readonly npcs: Array<{ def: NpcDef; sprite: Phaser.GameObjects.Sprite }> = [];
  readonly chestImages = new Map<string, Phaser.GameObjects.Image>();
  private readonly npcActors: NpcActor[] = [];
  private readonly animals: Animal[] = [];
  private readonly butterflies: Butterfly[] = [];
  private readonly smoke: Smoke[] = [];
  private readonly foliage: Array<{ image: Phaser.GameObjects.Image; phase: number }> = [];
  private readonly torchLights: Array<{ image: Phaser.GameObjects.Image; phase: number }> = [];
  private readonly nodeCells = new Map<string, Array<{ x: number; y: number; radius: number }>>();
  private readonly waves: Phaser.GameObjects.Graphics;
  private readonly motes: Phaser.GameObjects.Graphics;
  private readonly dusk: Phaser.GameObjects.Rectangle;
  private readonly night: Phaser.GameObjects.Rectangle;
  private readonly playerGlow: Phaser.GameObjects.Image;
  private readonly interaction: Phaser.GameObjects.Text;
  private elapsed = 0;
  private waveClock = -1;
  private lastViewX = Number.NaN;
  private lastViewY = Number.NaN;
  private viewportZoom = Number.NaN;

  constructor(private readonly scene: Phaser.Scene, private readonly world: WorldMap) {
    const tilemap = scene.make.tilemap({ data: world.terrain, tileWidth: TILE, tileHeight: TILE });
    const tileset = tilemap.addTilesetImage('terrain', 'terrain', TILE, TILE, 0, 0);
    if (tileset) tilemap.createLayer(0, tileset, 0, 0)?.setDepth(-10000).setCullPadding(3, 3);
    this.makeTerrainTransitions();
    this.waves = scene.add.graphics().setDepth(-9500);

    for (const node of world.nodes) {
      if (!node.solid) continue;
      const key = `${Math.floor(node.x / 64)},${Math.floor(node.y / 64)}`;
      const entries = this.nodeCells.get(key) ?? [];
      entries.push({ x: node.x, y: node.y, radius: node.type === 'tree' ? 18 : 22 });
      this.nodeCells.set(key, entries);
    }

    // The collision footprint is deliberately smaller than the illustrated roof.
    for (const building of world.buildings) {
      scene.add.ellipse(building.x + 6, building.y - 2, building.width + 14, 22, 0x172a22, 0.15).setDepth(building.y - 0.2);
      scene.add.image(building.x, building.y, building.texture).setOrigin(0.5, 1).setDepth(building.y);
    }

    this.makeAmbientTextures();
    for (const [index, decoration] of world.decorations.entries()) {
      const image = scene.add.image(decoration.x, decoration.y, decoration.texture)
        .setOrigin(0.5, 1).setDepth(decoration.texture === 'bridge' ? -9000 : decoration.y)
        .setScale(decoration.scale ?? 1).setFlipX(decoration.flip ?? false);
      if (['grass_tuft', 'flowers', 'lily'].includes(decoration.texture)) this.foliage.push({ image, phase: index * 2.713 });
      if (decoration.texture === 'torch') {
        this.torchLights.push({ image: scene.add.image(decoration.x, decoration.y - 25, 'world-warm-glow').setDepth(8001).setBlendMode(Phaser.BlendModes.ADD), phase: index * 0.71 });
      }
    }
    for (const chest of world.chests) {
      this.chestImages.set(chest.id, scene.add.image(chest.x, chest.y, 'chest').setOrigin(0.5, 1).setDepth(chest.y));
    }

    for (const [index, def] of NPCS.entries()) {
      for (const [row, direction] of DIRECTIONS.entries()) {
        for (const [action, frames, rate] of [['idle', [0, 1], 2], ['walk', [2, 3, 4, 5], 7]] as const) {
          const key = `${def.sprite}_${direction}_${action}`;
          if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map(frame => ({ key: def.sprite, frame: row * 8 + frame })), frameRate: rate, repeat: -1 });
        }
      }
      const sprite = scene.add.sprite(def.x, def.y, def.sprite, 0).setOrigin(0.5, 0.92).setScale(0.8).setDepth(def.y);
      const label = scene.add.text(def.x, def.y - 52, def.name, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', color: '#f6e5bb', stroke: '#17241e', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(8003).setVisible(false);
      const role = scene.add.text(def.x, def.y - 43, def.role, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '9px', color: '#d9ca9e', stroke: '#17241e', strokeThickness: 2 }).setOrigin(0.5, 1).setDepth(8003).setVisible(false);
      this.npcs.push({ def, sprite });
      this.npcActors.push({ def, sprite, label, role, direction: 'down', phase: index * 1.97 });
    }

    this.makeAnimals();
    for (let index = 0; index < 13; index++) {
      const x = index < 7 ? 940 + index * 87 : 500 + (index - 7) * 137;
      const y = index < 7 ? 1780 + Math.sin(index * 2.1) * 145 : 740 + (index - 7) * 119;
      const sprite = scene.add.sprite(x, y, 'butterfly', 0).setDepth(y + 10).setAlpha(0.8);
      this.butterflies.push({ sprite, x, y, phase: index * 2.31 });
    }
    for (const building of world.buildings.filter(entry => ['home', 'smithy', 'tavern', 'furnace'].includes(entry.texture))) {
      for (let index = 0; index < 3; index++) {
        const x = building.x + (building.texture === 'furnace' ? 5 : 31);
        const y = building.y - (building.texture === 'furnace' ? 42 : 130);
        const image = scene.add.image(x, y, 'world-smoke').setDepth(building.y + 0.1).setAlpha(0.12);
        this.smoke.push({ image, x, y, phase: index / 3, depth: building.y + 0.1 });
      }
    }

    this.motes = scene.add.graphics().setDepth(7998);
    this.dusk = scene.add.rectangle(0, 0, 1, 1, 0xd8783b, 1).setAlpha(0).setScrollFactor(0).setDepth(7999);
    this.night = scene.add.rectangle(0, 0, 1, 1, 0x142540, 1).setAlpha(0).setScrollFactor(0).setDepth(8000);
    this.playerGlow = scene.add.image(0, 0, 'world-soft-glow').setDepth(8001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.interaction = scene.add.text(0, 0, 'E', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#fff0c7', backgroundColor: '#354338', padding: { x: 5, y: 2 }, stroke: '#18281c', strokeThickness: 1 }).setOrigin(0.5, 0.5).setDepth(8004).setVisible(false);
    this.resize();
    scene.scale.on('resize', this.resize, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', this.resize, this));
  }

  nearestNpc(x: number, y: number, range = 65): NpcDef | undefined {
    let nearest: { def: NpcDef; sprite: Phaser.GameObjects.Sprite } | undefined;
    let distance = range;
    for (const actor of this.npcs) {
      const current = Math.hypot(actor.sprite.x - x, actor.sprite.y - y);
      if (current <= distance) { nearest = actor; distance = current; }
    }
    return nearest ? { ...nearest.def, x: nearest.sprite.x, y: nearest.sprite.y } : undefined;
  }

  setChestOpened(id: string): void { this.chestImages.get(id)?.setTint(0x9a9987).setAlpha(0.62); }

  resize(): void {
    const camera = this.scene.cameras.main;
    this.viewportZoom = camera.zoom;
    const width = camera.width / Math.max(camera.zoom, 0.1) + 64;
    const height = camera.height / Math.max(camera.zoom, 0.1) + 64;
    this.dusk.setPosition(camera.width / 2, camera.height / 2).setDisplaySize(width, height);
    this.night.setPosition(camera.width / 2, camera.height / 2).setDisplaySize(width, height);
  }

  update(dt: number, gameTime: number, playerX: number, playerY: number): void {
    this.elapsed += Math.max(0, dt);
    this.waveClock += Math.max(0, dt);
    const camera = this.scene.cameras.main;
    if (camera.zoom !== this.viewportZoom) this.resize();
    const view = camera.worldView;
    const visible = (x: number, y: number, margin = 100) => x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin;

    if (this.waveClock < 0 || this.waveClock > 0.12 || Math.abs(view.x - this.lastViewX) > TILE || Math.abs(view.y - this.lastViewY) > TILE || Number.isNaN(this.lastViewX)) {
      this.drawWater(); this.waveClock = 0; this.lastViewX = view.x; this.lastViewY = view.y;
    }
    for (const actor of this.npcActors) {
      const distance = Math.hypot(actor.sprite.x - playerX, actor.sprite.y - playerY);
      let dx = 0, dy = 0;
      const isVisiting = distance < 76;
      const cycle = this.elapsed * 0.11 + actor.phase;
      if (!isVisiting && Math.sin(cycle * 0.7) > -0.2 && dt > 0) {
        const targetX = actor.def.x + Math.sin(cycle) * 25;
        const targetY = actor.def.y + Math.sin(cycle * 1.39) * 17;
        const remaining = Math.hypot(targetX - actor.sprite.x, targetY - actor.sprite.y);
        if (remaining > 2) {
          const step = Math.min(remaining, 13 * dt);
          dx = (targetX - actor.sprite.x) / remaining * step;
          dy = (targetY - actor.sprite.y) / remaining * step;
          this.move(actor.sprite, dx, dy, 8);
        }
      }
      if (isVisiting) actor.direction = this.direction(playerX - actor.sprite.x, playerY - actor.sprite.y);
      else if (Math.abs(dx) + Math.abs(dy) > 0.01) actor.direction = this.direction(dx, dy);
      actor.sprite.play(`${actor.def.sprite}_${actor.direction}_${Math.abs(dx) + Math.abs(dy) > 0.01 ? 'walk' : 'idle'}`, true);
      // A paused world keeps the current pose; Phaser animations otherwise advance independently of dt.
      if (dt === 0) actor.sprite.anims.pause(); else actor.sprite.anims.resume();
      actor.sprite.setDepth(actor.sprite.y);
      actor.label.setPosition(actor.sprite.x, actor.sprite.y - 53).setVisible(distance < 110);
      actor.role.setPosition(actor.sprite.x, actor.sprite.y - 43).setVisible(distance < 110);
    }

    for (const animal of this.animals) {
      const cycle = this.elapsed * 0.32 + animal.phase;
      let moving = false;
      if (Math.sin(cycle * 0.63) > -0.3 && dt > 0) {
        const targetX = animal.homeX + Math.sin(cycle) * 40;
        const targetY = animal.homeY + Math.cos(cycle * 1.21) * 26;
        const distance = Math.hypot(targetX - animal.sprite.x, targetY - animal.sprite.y);
        if (distance > 2) {
          const step = Math.min(distance, animal.speed * dt);
          const dx = (targetX - animal.sprite.x) / distance * step, dy = (targetY - animal.sprite.y) / distance * step;
          moving = this.move(animal.sprite, dx, dy, 7);
          if (Math.abs(dx) > 0.01) animal.sprite.setFlipX(dx < 0);
        }
      }
      animal.sprite.setFrame(moving ? 1 + Math.floor(this.elapsed * 5) % 3 : 0).setDepth(animal.sprite.y);
    }
    for (const butterfly of this.butterflies) {
      const phase = this.elapsed * 0.62 + butterfly.phase;
      const x = butterfly.x + Math.sin(phase) * 48, y = butterfly.y + Math.sin(phase * 1.71) * 25;
      butterfly.sprite.setPosition(x, y).setFrame(Math.floor(this.elapsed * 9 + butterfly.phase) % 4).setDepth(y + 30).setVisible(visible(x, y));
    }
    for (const plant of this.foliage) {
      if (visible(plant.image.x, plant.image.y)) plant.image.setAngle(Math.sin(this.elapsed * 1.7 + plant.phase) * 2.2);
    }
    for (const puff of this.smoke) {
      const progress = (this.elapsed / 5 + puff.phase) % 1;
      puff.image.setPosition(puff.x + Math.sin(progress * 4 + puff.phase) * 9 + progress * 14, puff.y - progress * 41)
        .setScale(0.3 + progress * 0.65).setAlpha(Math.sin(progress * Math.PI) * 0.19).setVisible(visible(puff.x, puff.y, 180));
    }

    const hour = (8 + gameTime / 50) % 24;
    const nightAmount = hour >= 19 ? Math.min(1, (hour - 19) / 2) : hour < 5 ? 1 : hour < 7 ? (7 - hour) / 2 : 0;
    const duskAmount = hour > 16 && hour < 21 ? Math.sin((hour - 16) / 5 * Math.PI) : hour > 5 && hour < 8 ? Math.sin((hour - 5) / 3 * Math.PI) * 0.4 : 0;
    this.night.setAlpha(nightAmount * 0.53);
    this.dusk.setAlpha(duskAmount * 0.12);
    for (const light of this.torchLights) light.image.setVisible(visible(light.image.x, light.image.y, 180)).setAlpha((0.08 + nightAmount * 0.36) * (0.95 + Math.sin(this.elapsed * 7 + light.phase) * 0.05));
    this.playerGlow.setPosition(playerX, playerY - 13).setAlpha(nightAmount * 0.2);
    const nearest = this.nearestNpc(playerX, playerY);
    this.interaction.setVisible(!!nearest);
    if (nearest) this.interaction.setPosition(nearest.x + 25, nearest.y - 30 - Math.sin(this.elapsed * 3) * 2);
    this.drawMotes(nightAmount);
  }

  private direction(dx: number, dy: number): Direction {
    return Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down';
  }

  private blocked(x: number, y: number, radius: number): boolean {
    if (this.world.isStaticBlocked(x, y, radius)) return true;
    const cx = Math.floor(x / 64), cy = Math.floor(y / 64);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      for (const node of this.nodeCells.get(`${cx + ox},${cy + oy}`) ?? []) {
        if (Math.hypot(node.x - x, node.y - y) < node.radius + radius) return true;
      }
    }
    return false;
  }

  private move(sprite: Phaser.GameObjects.Sprite, dx: number, dy: number, radius: number): boolean {
    const beforeX = sprite.x, beforeY = sprite.y;
    if (!this.blocked(sprite.x + dx, sprite.y, radius)) sprite.x += dx;
    if (!this.blocked(sprite.x, sprite.y + dy, radius)) sprite.y += dy;
    return sprite.x !== beforeX || sprite.y !== beforeY;
  }

  private makeAnimals(): void {
    const positions: Array<[string, number, number]> = [['sheep', 920, 1815], ['sheep', 974, 1850], ['chicken', 1080, 1795], ['chicken', 1165, 1670], ['chicken', 1210, 1730], ['chicken', 1450, 1320], ['sheep', 1260, 1435]];
    for (const [index, [texture, proposedX, proposedY]] of positions.entries()) {
      let x = proposedX, y = proposedY;
      for (let attempt = 0; attempt < 20 && this.blocked(x, y, 9); attempt++) {
        x = proposedX + Math.cos(attempt * 2.4) * (16 + attempt * 4);
        y = proposedY + Math.sin(attempt * 2.4) * (16 + attempt * 4);
      }
      if (this.blocked(x, y, 9)) continue;
      this.animals.push({ sprite: this.scene.add.sprite(x, y, texture, 0).setOrigin(0.5, 0.84).setDepth(y), homeX: x, homeY: y, phase: index * 2.07, speed: texture === 'chicken' ? 18 : 12 });
    }
  }

  private makeTerrainTransitions(): void {
    const layers = [
      { texture: 'path_edges', tile: 2, depth: -9999, outside: (neighbor: number) => neighbor === 0 || neighbor === 1 || neighbor === 6 },
      { texture: 'shore_edges', tile: 5, depth: -9998, outside: (neighbor: number) => neighbor === 0 || neighbor === 1 || neighbor === 6 },
      { texture: 'water_edges', tile: 4, depth: -9499, outside: (neighbor: number) => neighbor !== 4 },
    ];
    const directions = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]] as const;
    // Build once; Phaser subsequently culls these sparse tile layers with the camera.
    // Atlas frame bits describe the exposed north/east/south/west sides respectively.
    for (const layer of layers) {
      if (!this.scene.textures.exists(layer.texture)) continue;
      const data = this.world.terrain.map((row, y) => row.map((tile, x) => {
        if (tile !== layer.tile) return -1;
        let mask = 0;
        for (const [dx, dy, bit] of directions) if (layer.outside(this.world.tileAt(x + dx, y + dy))) mask |= bit;
        return mask || -1;
      }));
      const map = this.scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage(layer.texture, layer.texture, TILE, TILE, 0, 0);
      if (tileset) map.createLayer(0, tileset, 0, 0)?.setDepth(layer.depth).setCullPadding(3, 3);
    }
  }

  private drawWater(): void {
    this.waves.clear();
    const view = this.scene.cameras.main.worldView;
    const minX = Math.max(0, Math.floor(view.x / TILE) - 1), maxX = Math.min(this.world.width - 1, Math.ceil(view.right / TILE) + 1);
    const minY = Math.max(0, Math.floor(view.y / TILE) - 1), maxY = Math.min(this.world.height - 1, Math.ceil(view.bottom / TILE) + 1);
    for (let ty = minY; ty <= maxY; ty++) for (let tx = minX; tx <= maxX; tx++) {
      if (this.world.tileAt(tx, ty) !== 4) continue;
      const seed = tx * 17 + ty * 31;
      const x = tx * TILE, y = ty * TILE;
      const wave = Math.sin(this.elapsed * 1.6 + seed);
      this.waves.lineStyle(1, 0xb2e5d0, 0.09 + Math.max(0, wave) * 0.14);
      if (seed % 3 === 0) this.waves.lineBetween(x + 5 + wave * 3, y + 11, x + 17 + wave * 3, y + 11);
      if (seed % 4 === 0) this.waves.lineBetween(x + 17 - wave * 2, y + 24, x + 24 - wave * 2, y + 24);
      this.waves.lineStyle(1, 0xc3e4bd, 0.3 + wave * 0.06);
      if (this.world.tileAt(tx, ty - 1) !== 4) this.waves.lineBetween(x + 3, y + 3 + wave, x + TILE - 3, y + 3 + wave);
      if (this.world.tileAt(tx - 1, ty) !== 4) this.waves.lineBetween(x + 3 + wave, y + 3, x + 3 + wave, y + TILE - 3);
    }
  }

  private drawMotes(nightAmount: number): void {
    this.motes.clear();
    const view = this.scene.cameras.main.worldView;
    for (let index = 0; index < 22; index++) {
      const seedX = Math.sin(index * 78.233 + 1) * 43758.5453;
      const seedY = Math.sin(index * 13.73 + 7) * 3791.41;
      const x = view.x + ((seedX - Math.floor(seedX)) * (view.width + 60) + this.elapsed * (index % 2 ? 2 : -3)) % (view.width + 60);
      const y = view.y + (seedY - Math.floor(seedY)) * view.height + Math.sin(this.elapsed * 0.7 + index) * 9;
      const glint = 0.5 + Math.sin(this.elapsed * 1.3 + index * 1.47) * 0.5;
      this.motes.fillStyle(nightAmount > 0.5 ? 0xe2eea2 : 0xf9edd0, (0.1 + nightAmount * 0.34) * glint).fillRect(Math.floor(x), Math.floor(y), 1.5, 1.5);
    }
  }

  private makeAmbientTextures(): void {
    for (const [key, color, size] of [['world-warm-glow', '255,177,76', 192], ['world-soft-glow', '154,185,139', 224], ['world-smoke', '215,217,193', 48]] as const) {
      if (this.scene.textures.exists(key)) continue;
      const canvas = this.scene.textures.createCanvas(key, size, size);
      if (!canvas) continue;
      const context = canvas.context;
      const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, `rgba(${color},0.65)`);
      gradient.addColorStop(0.27, `rgba(${color},0.3)`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);
      canvas.refresh();
    }
  }
}
