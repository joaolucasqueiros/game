import Phaser from 'phaser';
import { STRUCTURES } from '../data/structures';
import { ITEMS } from '../data/items';
import type { PlacedStructure, Stack, Station } from '../types';
import { TILE, type WorldMap } from '../world/WorldMap';
import type { GameModel } from './GameModel';
import type { PlayerController } from './PlayerController';
import type { ResourceSystem } from './ResourceSystem';

interface BuildHost {
  model: GameModel; player: PlayerController; world: WorldMap; resources: ResourceSystem;
  notice: (message: string) => void; particles: (x: number, y: number, color: number, count?: number) => void;
  sound: () => void; occupied: (x: number, y: number, width: number, height: number) => boolean;
}
export class BuildSystem {
  images = new Map<string, Phaser.GameObjects.Image>();
  type: string | null = null;
  valid = false;
  tileX = 0; tileY = 0;
  private preview: Phaser.GameObjects.Image;
  private grid: Phaser.GameObjects.Graphics;
  private lights = new Map<string, Phaser.GameObjects.Image>();
  constructor(private scene: Phaser.Scene, private host: BuildHost) {
    this.preview = scene.add.image(0, 0, 'workbench').setOrigin(0.5, 1).setAlpha(0.55).setVisible(false).setDepth(9990);
    this.grid = scene.add.graphics().setDepth(9989);
    for (const structure of host.model.state.structures) this.render(structure);
  }
  private render(structure: PlacedStructure) {
    const def = STRUCTURES[structure.type];
    const x = (structure.x + def.width / 2) * TILE, y = (structure.y + def.height) * TILE;
    const image = this.scene.add.image(x, y, structure.type).setOrigin(0.5, 1).setDepth(y);
    this.images.set(structure.id, image);
    if (structure.type === 'torch') this.lights.set(structure.id, this.scene.add.image(x, y - 28, 'world-warm-glow').setDepth(8001).setBlendMode(Phaser.BlendModes.ADD));
  }
  select(type: string | null) {
    this.type = type;
    if (type && type !== '__remove' && STRUCTURES[type]) this.preview.setTexture(type).setVisible(true);
    else this.preview.setVisible(false);
    this.grid.clear();
    if (type) this.host.notice(type === '__remove' ? 'Clique numa construção sua para recolhê-la. Esc cancela.' : `${STRUCTURES[type].name}: escolha o terreno e clique para construir. Esc cancela.`);
  }
  update(x: number, y: number) {
    this.grid.clear();
    if (!this.type) return;
    this.tileX = Math.floor(x / TILE); this.tileY = Math.floor(y / TILE);
    if (this.type === '__remove') {
      const found = this.at(this.tileX, this.tileY);
      if (found) {
        const def = STRUCTURES[found.type];
        this.grid.lineStyle(2, 0xe9a66f).strokeRect(found.x * TILE, found.y * TILE, def.width * TILE, def.height * TILE);
      }
      return;
    }
    const def = STRUCTURES[this.type];
    if (!def) return;
    const left = this.tileX * TILE, top = this.tileY * TILE, w = def.width * TILE, h = def.height * TILE;
    const closestX = Math.max(left, Math.min(this.host.player.x, left + w));
    const closestY = Math.max(top, Math.min(this.host.player.y, top + h));
    this.valid = this.host.model.count(def.item) > 0 && this.host.world.canPlace(def, this.tileX, this.tileY, this.host.resources.nodes, this.host.model.state.structures, this.host.resources.depleted) &&
      Math.hypot(this.host.player.x - closestX, this.host.player.y - closestY) > 15 &&
      Math.hypot(this.host.player.x - (left + w / 2), this.host.player.y - (top + h / 2)) < 180 &&
      !this.host.occupied(left, top, w, h);
    const color = this.valid ? 0xb0d58e : 0xef8b6e;
    this.preview.setPosition(left + w / 2, top + h).setTint(color).setVisible(true);
    this.grid.fillStyle(color, 0.13).fillRect(left, top, w, h);
    this.grid.lineStyle(1, color, 0.7);
    for (let ix = 0; ix <= def.width; ix++) this.grid.lineBetween(left + ix * TILE, top, left + ix * TILE, top + h);
    for (let iy = 0; iy <= def.height; iy++) this.grid.lineBetween(left, top + iy * TILE, left + w, top + iy * TILE);
  }
  place() {
    if (!this.type || this.host.player.busy) return;
    if (this.type === '__remove') { this.remove(this.at(this.tileX, this.tileY)); return; }
    if (!this.valid) { this.host.notice('Local inválido: escolha chão livre perto do personagem e confira seus recursos.'); return; }
    const def = STRUCTURES[this.type];
    if (!this.host.model.remove(def.item, 1)) return;
    const structure: PlacedStructure = { id: crypto.randomUUID(), type: this.type, x: this.tileX, y: this.tileY };
    if (structure.type === 'chest') structure.storage = Array(18).fill(null);
    if (structure.type === 'garden') structure.plantedAt = this.host.model.state.time;
    this.host.model.state.structures.push(structure); this.render(structure);
    this.host.model.metric(`build:${structure.type}`); this.host.model.addXP(10);
    this.host.player.setAction('build', 0.3); this.host.sound();
    this.host.player.actionItem = 'wood_axe';
    this.host.particles((structure.x + def.width / 2) * TILE, (structure.y + def.height) * TILE, 0xdfc18c, 14);
    this.host.notice(`${def.name} construída. ${def.station ? 'Aproxime-se e abra a fabricação com C.' : 'Seu progresso é salvo automaticamente.'}`);
    this.host.model.changed();
  }
  private remove(structure?: PlacedStructure) {
    if (!structure) { this.host.notice('Clique na base de uma construção colocada por você.'); return; }
    const def = STRUCTURES[structure.type];
    if (Math.hypot((structure.x + def.width / 2) * TILE - this.host.player.x, (structure.y + def.height) * TILE - this.host.player.y) > 180) { this.host.notice('Aproxime-se da construção.'); return; }
    if (structure.storage?.some(Boolean)) { this.host.notice('Esvazie o baú antes de recolhê-lo.'); return; }
    if (!this.host.model.add(def.item, 1)) { this.host.notice('O inventário está cheio.'); return; }
    this.host.model.state.structures = this.host.model.state.structures.filter(s => s.id !== structure.id);
    this.images.get(structure.id)?.destroy(); this.images.delete(structure.id);
    this.lights.get(structure.id)?.destroy(); this.lights.delete(structure.id);
    this.host.model.changed(); this.host.sound(); this.host.notice(`${def.name} guardada no inventário.`);
  }
  at(tx: number, ty: number) {
    return this.host.model.state.structures.find(s => { const def = STRUCTURES[s.type]; return tx >= s.x && tx < s.x + def.width && ty >= s.y && ty < s.y + def.height; });
  }
  near(x: number, y: number, range = 80) {
    return this.host.model.state.structures.map(s => {
      const def = STRUCTURES[s.type];
      const cx = Math.max(s.x * TILE, Math.min(x, (s.x + def.width) * TILE));
      const cy = Math.max(s.y * TILE, Math.min(y, (s.y + def.height) * TILE));
      return { structure: s, distance: Math.hypot(x - cx, y - cy) };
    }).filter(s => s.distance < range).sort((a, b) => a.distance - b.distance)[0]?.structure;
  }
  blocked(x: number, y: number, radius = 8) {
    return this.host.model.state.structures.some(s => {
      const def = STRUCTURES[s.type]; if (!def.solid) return false;
      return x + radius > s.x * TILE && x - radius < (s.x + def.width) * TILE && y + radius > s.y * TILE && y - radius < (s.y + def.height) * TILE;
    });
  }
  stations(x: number, y: number): Set<Station> {
    const stations = new Set<Station>(['hand']);
    for (const building of this.host.world.buildings) {
      const cx = Math.max(building.x - building.width / 2, Math.min(x, building.x + building.width / 2));
      const cy = Math.max(building.y - building.height, Math.min(y, building.y));
      if (building.station && Math.hypot(cx - x, cy - y) < 105) stations.add(building.station);
    }
    for (const structure of this.host.model.state.structures) {
      const def = STRUCTURES[structure.type];
      const cx = Math.max(structure.x * TILE, Math.min(x, (structure.x + def.width) * TILE));
      const cy = Math.max(structure.y * TILE, Math.min(y, (structure.y + def.height) * TILE));
      if (def.station && Math.hypot(cx - x, cy - y) < 90) stations.add(def.station);
    }
    return stations;
  }
  tick(gameTime: number) {
    const hour = (8 + gameTime / 50) % 24;
    const night = hour >= 19 ? Math.min(1, (hour - 19) / 2) : hour < 6 ? Math.min(1, (6 - hour) / 2) : 0;
    for (const [id, light] of this.lights) light.setAlpha(0.1 + night * (0.6 + Math.sin(gameTime * 8 + id.length) * 0.05));
    for (const structure of this.host.model.state.structures) {
      if (structure.type === 'garden') this.images.get(structure.id)?.setTint(gameTime - (structure.plantedAt ?? 0) >= 90 ? 0xffffff : 0xaaa177);
    }
  }
  transfer(structure: PlacedStructure, index: number, toStorage: boolean) {
    const { model } = this.host;
    if (!structure.storage || !model.state.structures.includes(structure)) return;
    if (!toStorage) {
      const stack = structure.storage[index];
      if (stack && model.add(stack.item, stack.qty)) { structure.storage[index] = null; model.changed(); }
      else this.host.notice('Não foi possível transferir: inventário cheio ou espaço vazio.');
      return;
    }
    const stack = model.state.inventory[index];
    if (!stack) return;
    const candidate: (Stack | null)[] = structure.storage.map(s => s ? { ...s } : null);
    let remaining = stack.qty;
    for (const existing of candidate) {
      if (existing?.item !== stack.item) continue;
      const qty = Math.min(remaining, ITEMS[stack.item].stack - existing.qty);
      existing.qty += qty; remaining -= qty;
    }
    for (let i = 0; i < candidate.length && remaining; i++) {
      if (candidate[i]) continue;
      const qty = Math.min(remaining, ITEMS[stack.item].stack);
      candidate[i] = { ...stack, qty }; remaining -= qty;
    }
    if (remaining) { this.host.notice('O baú está cheio.'); return; }
    structure.storage = candidate; model.state.inventory[index] = null; model.changed();
  }
  destroy() { this.images.forEach(i => i.destroy()); this.lights.forEach(i => i.destroy()); this.preview.destroy(); this.grid.destroy(); }
}
