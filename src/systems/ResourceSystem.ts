import Phaser from 'phaser';
import { ITEMS } from '../data/items';
import type { ResourceNode } from '../types';
import type { GameModel } from './GameModel';
import type { PlayerController } from './PlayerController';

interface ResourceHost {
  model: GameModel; player: PlayerController;
  notice: (message: string) => void;
  text: (x: number, y: number, text: string, color?: string) => void;
  particles: (x: number, y: number, color: number, count?: number) => void;
  sound: (type: 'wood' | 'stone' | 'pickup' | 'fish') => void;
  canRespawn: (node: ResourceNode) => boolean;
}
export class ResourceSystem {
  images = new Map<string, Phaser.GameObjects.Image>();
  depleted = new Set<string>();
  private elapsed = 0;
  private respawnTimer = 0;
  constructor(private scene: Phaser.Scene, public nodes: ResourceNode[], private host: ResourceHost) {
    for (const node of nodes) {
      const image = scene.add.image(node.x, node.y, node.texture).setOrigin(0.5, 1).setDepth(node.y);
      this.images.set(node.id, image);
      const state = host.model.state.resources[node.id];
      if (state && state.remaining <= 0) this.setDepleted(node, false);
    }
  }
  private setDepleted(node: ResourceNode, animate: boolean) {
    this.depleted.add(node.id);
    const image = this.images.get(node.id)!;
    if (node.type === 'tree') {
      const finish = () => image.setTexture('stump').setAngle(0).setAlpha(1).setScale(1);
      if (animate) this.scene.tweens.add({ targets: image, angle: 65, alpha: 0, duration: 360, ease: 'Quad.easeIn', onComplete: finish });
      else finish();
    } else image.setVisible(false);
  }
  near(x: number, y: number, range = 62) {
    return this.nodes.filter(n => !this.depleted.has(n.id) && Math.hypot(n.x - x, n.y - y) < (n.type === 'fish' ? 112 : range)).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  }
  blocked(x: number, y: number, radius = 8) {
    return this.nodes.some(n => n.solid && !this.depleted.has(n.id) && Math.abs(n.y - y) < radius + (n.type === 'tree' ? 10 : 12) && Math.abs(n.x - x) < radius + (n.type === 'tree' ? 12 : 16));
  }
  gather(node: ResourceNode, selected?: string) {
    const { model, player } = this.host;
    if (player.busy || this.depleted.has(node.id)) return;
    const needed = node.type === 'tree' ? 'axe' : ['rock', 'ore'].includes(node.type) ? 'pickaxe' : null;
    const owned = [...model.state.inventory.filter(Boolean).map(s => s!.item), ...Object.values(model.state.equipment).filter((s): s is string => !!s)];
    const tool = selected && ITEMS[selected]?.tool === needed && owned.includes(selected) ? ITEMS[selected] : owned.map(id => ITEMS[id]).filter(i => i.tool === needed).sort((a, b) => (b.tier ?? 1) - (a.tier ?? 1))[0];
    if (needed && !tool) { this.host.notice(needed === 'axe' ? 'Você precisa de um machado para cortar madeira.' : 'Você precisa de uma picareta para minerar.'); return; }
    if (needed && (tool.tier ?? 1) < node.tier) { this.host.notice('Este recurso exige uma ferramenta de ferro. Fabrique uma na forja.'); return; }
    if (model.state.energy < 5) { this.host.notice('Sem energia. Descanse um instante ou consuma alimento.'); return; }
    model.state.energy -= needed ? 5 : 2;
    const skill = node.type === 'tree' ? 'woodcutting' : needed ? 'mining' : 'survival';
    const duration = node.type === 'fish' ? 2.2 : Math.max(0.25, (needed ? 0.46 : 0.3) - (model.skillLevel(skill) - 1) * 0.025);
    player.face(node.x, node.y);
    player.setAction(node.type === 'tree' ? 'woodcut' : needed ? 'mine' : node.type === 'fish' ? 'fish' : 'gather', duration, () => {
      if (model.state.health <= 0 || this.depleted.has(node.id) || Math.hypot(player.x - node.x, player.y - node.y) > (node.type === 'fish' ? 120 : 100)) return;
      const record = model.state.resources[node.id] ?? { remaining: node.hp, respawnAt: 0 };
      const damage = tool && (tool.tier ?? 1) > 1 ? 2 : 1;
      const yieldAmount = node.type === 'tree' ? 6 : node.type === 'rock' ? 4 : node.type === 'ore' ? 4 : node.type === 'fish' ? 2 : 2;
      const exhausted = record.remaining - damage <= 0;
      if (exhausted && !model.add(node.item, yieldAmount)) { this.host.notice('Inventário cheio. Libere um espaço antes de coletar.'); return; }
      record.remaining = Math.max(0, record.remaining - damage);
      model.state.resources[node.id] = record;
      const image = this.images.get(node.id)!;
      this.scene.tweens.add({ targets: image, x: node.x + 3, duration: 45, yoyo: true, repeat: 1, onComplete: () => image.x = node.x });
      this.host.sound(node.type === 'tree' ? 'wood' : needed ? 'stone' : node.type === 'fish' ? 'fish' : 'pickup');
      this.host.particles(node.x, node.y - 15, node.type === 'tree' ? 0xcc9f5b : needed ? 0xc3b9a3 : 0xacd778, 8);
      if (exhausted) {
        record.respawnAt = model.state.time + (node.type === 'tree' ? 240 : node.type === 'ore' ? 300 : 140);
        this.setDepleted(node, true);
        model.metric(`gather:${node.item}`, yieldAmount); model.skillXP(skill, 12); model.addXP(6);
        this.host.text(node.x, node.y - 45, `+${yieldAmount} ${ITEMS[node.item].name}`, '#e9d49d');
      } else {
        model.skillXP(skill, 2);
        this.host.text(node.x, node.y - 35, `${node.hp - record.remaining}/${node.hp}`, '#ded9bd');
      }
      model.changed();
    });
    if (needed && tool) player.actionItem = tool.id;
    if (node.type === 'fish') player.fishingTarget = { x: node.x, y: node.y };
  }
  update(dt: number) {
    this.elapsed += dt; this.respawnTimer -= dt;
    const { player, model } = this.host;
    for (const node of this.nodes) {
      if (Math.abs(node.x - player.x) > 600 || Math.abs(node.y - player.y) > 500 || this.depleted.has(node.id)) continue;
      const image = this.images.get(node.id)!;
      if (node.type === 'tree') image.setAlpha(player.y < node.y && player.y > node.y - 105 && Math.abs(player.x - node.x) < 40 ? 0.55 : 1);
      else if (node.type === 'plant') image.setRotation(Math.sin(this.elapsed * 1.5 + node.x) * 0.035);
      else if (node.type === 'fish') image.y = node.y + Math.sin(this.elapsed * 2 + node.x) * 2;
    }
    if (this.respawnTimer > 0) return;
    this.respawnTimer = 1;
    for (const node of this.nodes) {
      const record = model.state.resources[node.id];
      if (record && record.remaining === 0 && record.respawnAt <= model.state.time) {
        // A cleared plot remains clear while occupied by a base or a character.
        if (!this.host.canRespawn(node)) { record.respawnAt = model.state.time + 20; continue; }
        delete model.state.resources[node.id]; this.depleted.delete(node.id);
        this.images.get(node.id)!.setTexture(node.texture).setVisible(true).setAngle(0).setAlpha(1);
      }
    }
  }
  destroy() { this.images.forEach(i => i.destroy()); }
}
