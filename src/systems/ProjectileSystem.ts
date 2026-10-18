import Phaser from 'phaser';
import type { EnemySystem } from './EnemySystem';
import type { PlayerController } from './PlayerController';

interface Projectile { sprite: Phaser.GameObjects.Image; vx: number; vy: number; life: number; damage: number; hostile: boolean; magic: boolean }
export class ProjectileSystem {
  private projectiles: Projectile[] = [];
  constructor(private scene: Phaser.Scene, private player: PlayerController, private enemies: EnemySystem,
    private blocked: (x: number, y: number, r: number) => boolean,
    private hitPlayer: (damage: number, x: number, y: number) => void,
    private particles: (x: number, y: number, color: number, count?: number) => void) {}
  shoot(x: number, y: number, angle: number, damage: number, hostile: boolean, magic = false, range?: number) {
    const sprite = this.scene.add.image(x, y, magic ? 'item_crystal' : 'item_arrow').setScale(magic ? 0.5 : 0.65).setRotation(angle + Math.PI / 4).setDepth(y + 15);
    if (hostile) sprite.setTint(magic ? 0xf08c78 : 0xf3bb8c);
    const speed = hostile ? magic ? 110 : 175 : magic ? 260 : 370;
    this.projectiles.push({ sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: hostile ? 3 : (range ?? (magic ? 420 : 390)) / speed, damage, hostile, magic });
  }
  update(dt: number) {
    for (const p of this.projectiles) {
      p.life -= dt;
      // Substeps keep fast arrows from tunnelling through thin walls or enemies.
      const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 8));
      for (let step = 0; step < steps && p.life > 0; step++) {
        p.sprite.x += p.vx * dt / steps; p.sprite.y += p.vy * dt / steps;
        if (this.blocked(p.sprite.x, p.sprite.y, 3)) { p.life = 0; break; }
        if (p.hostile) {
          if (Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, this.player.x, this.player.y - 10) < 17) {
            this.hitPlayer(p.damage, p.sprite.x - p.vx, p.sprite.y - p.vy); p.life = 0;
          }
        } else {
          const target = this.enemies.actors.find(a => !a.dead && Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, a.sprite.x, a.sprite.y - 15) < (a.def.boss ? 32 : 21));
          if (target) { this.enemies.hit(target, p.damage, p.sprite.x - p.vx, p.sprite.y - p.vy); p.life = 0; }
        }
      }
      p.sprite.setDepth(p.sprite.y + 15);
      if (p.magic && Math.random() < 0.25) this.particles(p.sprite.x, p.sprite.y, p.hostile ? 0xe4a77b : 0x88dece, 1);
      if (p.life <= 0) { this.particles(p.sprite.x, p.sprite.y, p.magic ? 0xa7d4dd : 0xd4b37a, 3); p.sprite.destroy(); }
    }
    this.projectiles = this.projectiles.filter(p => p.life > 0);
  }
  clear() { this.projectiles.forEach(p => p.sprite.destroy()); this.projectiles = []; }
}
