import Phaser from 'phaser';
import { ENEMIES } from '../data/enemies';
import type { EnemyDef } from '../types';
import type { GameModel } from './GameModel';
import type { PlayerController } from './PlayerController';
import type { EnemySpawn } from '../world/WorldMap';

export interface EnemyActor {
  spawn: EnemySpawn; def: EnemyDef; sprite: Phaser.GameObjects.Sprite;
  hp: number; cooldown: number; windup: number; invulnerable: number; alert: boolean;
  phase: number; knockX: number; knockY: number; dead: boolean; special: boolean;
}
export interface EnemyHost {
  model: GameModel; player: PlayerController;
  blocked: (x: number, y: number, r?: number) => boolean;
  hitPlayer: (damage: number, x: number, y: number, poison?: boolean) => void;
  text: (x: number, y: number, text: string, color?: string) => void;
  particles: (x: number, y: number, color: number, count?: number) => void;
  loot: (x: number, y: number, items: Record<string, number>, coins: number) => void;
  shoot: (x: number, y: number, angle: number, damage: number, enemy: boolean, magic?: boolean) => void;
  sound: (type: 'hit' | 'death' | 'magic') => void;
  notice: (message: string) => void;
}
export class EnemySystem {
  actors: EnemyActor[] = [];
  private graphics: Phaser.GameObjects.Graphics;
  private elapsed = 0;
  constructor(private scene: Phaser.Scene, spawns: EnemySpawn[], private host: EnemyHost) {
    this.graphics = scene.add.graphics().setDepth(10000);
    for (const spawn of spawns) {
      const def = ENEMIES[spawn.type];
      if (!def) continue;
      const key = `enemy_${spawn.type}`;
      if (!scene.anims.exists(`${key}_walk`)) scene.anims.create({ key: `${key}_walk`, frames: [0, 1, 2, 1].map(i => ({ key, frame: i })), frameRate: spawn.type === 'slime' ? 4 : 7, repeat: -1 });
      const sprite = scene.add.sprite(spawn.x, spawn.y, key).setOrigin(0.5, 0.9).setScale(def.boss ? 1 : 0.85);
      const dead = (host.model.state.enemies[spawn.id] ?? 0) > host.model.state.time;
      sprite.setVisible(!dead);
      this.actors.push({ spawn, def, sprite, hp: def.hp, cooldown: 0.8, windup: 0, invulnerable: 0, alert: false, phase: 1, knockX: 0, knockY: 0, dead, special: false });
    }
  }
  get inCombat() { return this.actors.some(a => !a.dead && a.alert); }
  get boss() {
    const actor = this.actors.find(a => a.def.boss && !a.dead && Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, this.host.player.x, this.host.player.y) < 450);
    return actor ? { name: actor.def.name + (actor.phase === 2 ? ' · Fúria ancestral' : ''), hp: actor.hp, max: actor.def.hp } : null;
  }
  private move(a: EnemyActor, dx: number, dy: number) {
    const radius = a.def.boss ? 19 : 9;
    if (!this.host.blocked(a.sprite.x + dx, a.sprite.y, radius)) a.sprite.x += dx;
    if (!this.host.blocked(a.sprite.x, a.sprite.y + dy, radius)) a.sprite.y += dy;
    a.sprite.setFlipX(dx < 0);
  }
  update(dt: number) {
    const host = this.host, player = host.player;
    this.elapsed += dt;
    this.graphics.clear();
    for (const a of this.actors) {
      if (a.dead) {
        if ((host.model.state.enemies[a.spawn.id] ?? Infinity) <= host.model.state.time) {
          a.dead = false; a.hp = a.def.hp; a.sprite.setPosition(a.spawn.x, a.spawn.y).setAlpha(1).setScale(a.def.boss ? 1 : 0.85).setVisible(true);
        }
        continue;
      }
      const x = a.sprite.x, y = a.sprite.y, distance = Phaser.Math.Distance.Between(x, y, player.x, player.y);
      if (distance > 750) { a.alert = false; continue; }
      a.invulnerable = Math.max(0, a.invulnerable - dt);
      a.cooldown -= dt;
      const fromHome = Phaser.Math.Distance.Between(x, y, a.spawn.x, a.spawn.y);
      if (a.def.boss && a.hp <= a.def.hp * 0.5 && a.phase === 1) {
        a.phase = 2; a.cooldown = 0.6;
        host.notice('O Guardião despertou sua fúria ancestral. Esquive das runas!');
        host.particles(x, y - 25, 0xd9a865, 24); host.sound('magic');
      }
      const hour = (8 + host.model.state.time / 50) % 24;
      const aggro = a.def.aggro + (hour >= 19 || hour < 6 ? 35 : 0);
      if (distance < aggro && host.model.state.health > 0) a.alert = true;
      if (distance > aggro * 2 || fromHome > (a.def.boss ? 450 : 360) || host.model.state.health <= 0) a.alert = false;
      if (a.knockX || a.knockY) {
        this.move(a, a.knockX * dt, a.knockY * dt);
        a.knockX *= Math.exp(-dt * 13); a.knockY *= Math.exp(-dt * 13);
        if (Math.abs(a.knockX) + Math.abs(a.knockY) < 5) a.knockX = a.knockY = 0;
      }
      let moving = false;
      if (a.windup > 0) {
        a.windup -= dt;
        const radius = a.special ? 110 : a.def.range + 8;
        this.graphics.lineStyle(2, a.special ? 0xec9856 : 0xe45f50, 0.8).strokeCircle(x, y, radius);
        this.graphics.fillStyle(0xd84936, 0.14 + Math.sin(this.elapsed * 20) * 0.05).fillCircle(x, y, radius);
        a.sprite.setFrame(3).setTint(0xffbc9d);
        if (a.windup <= 0) {
          a.sprite.clearTint();
          if (a.special) {
            host.particles(x, y, 0xf6a452, 26);
            if (distance < 112) host.hitPlayer(a.def.damage * 1.2, x, y);
            for (let i = 0; i < 8; i++) host.shoot(x, y - 15, i * Math.PI / 4 + this.elapsed, a.def.damage * 0.6, true, true);
          } else if (a.def.ranged) host.shoot(x, y - 20, Math.atan2(player.y - y, player.x - x), a.def.damage, true);
          else if (distance < a.def.range + 18) host.hitPlayer(a.def.damage, x, y, a.def.poison);
          a.cooldown = a.def.cooldown / 1000 * (a.phase === 2 ? 0.65 : 1);
        }
      } else if (a.alert) {
        const angle = Math.atan2(player.y - y, player.x - x);
        if (a.def.boss && a.phase === 2 && a.cooldown <= 0 && distance < 190) {
          a.special = true; a.windup = 0.9;
        } else if (distance <= a.def.range + (a.def.ranged ? 60 : 5) && a.cooldown <= 0) {
          a.special = false; a.windup = a.def.boss ? 0.7 : a.def.ranged ? 0.65 : 0.4;
        } else if (distance > (a.def.ranged ? 120 : a.def.range * 0.75)) {
          const speed = a.def.speed * (a.phase === 2 ? 1.25 : 1);
          this.move(a, Math.cos(angle) * speed * dt, Math.sin(angle) * speed * dt); moving = true;
        } else if (a.def.ranged && distance < 85) {
          this.move(a, -Math.cos(angle) * a.def.speed * dt, -Math.sin(angle) * a.def.speed * dt); moving = true;
        }
      } else {
        const targetX = a.spawn.x + Math.sin(this.elapsed * 0.2 + a.spawn.x) * 42;
        const targetY = a.spawn.y + Math.cos(this.elapsed * 0.18 + a.spawn.y) * 32;
        const angle = Math.atan2(targetY - y, targetX - x);
        if (Phaser.Math.Distance.Between(x, y, targetX, targetY) > 8) {
          this.move(a, Math.cos(angle) * a.def.speed * 0.33 * dt, Math.sin(angle) * a.def.speed * 0.33 * dt); moving = true;
        }
      }
      if (a.windup <= 0) {
        if (moving) a.sprite.play(`enemy_${a.spawn.type}_walk`, true);
        else { a.sprite.stop(); a.sprite.setFrame(0); }
      }
      a.sprite.setDepth(a.sprite.y).setAlpha(a.invulnerable > 0 ? 0.6 : 1);
      if (a.hp < a.def.hp || a.alert) {
        const w = a.def.boss ? 66 : 30, by = y - (a.def.boss ? 97 : 51);
        this.graphics.fillStyle(0x151d21, 0.9).fillRoundedRect(x - w / 2 - 1, by - 1, w + 2, 5, 2);
        this.graphics.fillStyle(a.def.boss ? 0xd5a25b : 0xce6255).fillRect(x - w / 2, by, w * a.hp / a.def.hp, 3);
      }
    }
  }
  hit(a: EnemyActor, damage: number, fromX: number, fromY: number) {
    if (a.dead || a.invulnerable > 0) return false;
    a.hp = Math.max(0, a.hp - damage); a.invulnerable = 0.12; a.alert = true;
    const angle = Math.atan2(a.sprite.y - fromY, a.sprite.x - fromX);
    const force = a.def.boss ? 25 : a.spawn.type === 'golem' ? 60 : 155;
    a.knockX = Math.cos(angle) * force; a.knockY = Math.sin(angle) * force;
    this.host.text(a.sprite.x, a.sprite.y - 35, `${Math.round(damage)}`, '#f8df9b');
    this.host.particles(a.sprite.x, a.sprite.y - 14, 0xf7cc8b, 7); this.host.sound('hit');
    if (a.hp <= 0) this.kill(a);
    return true;
  }
  private kill(a: EnemyActor) {
    a.dead = true; a.alert = false; a.windup = 0;
    const { model } = this.host;
    model.state.enemies[a.spawn.id] = model.state.time + (a.def.boss ? 1e12 : 180);
    model.addXP(a.def.xp); model.metric(`kill:${a.spawn.type}`);
    const loot: Record<string, number> = {};
    for (const entry of a.def.loot) if (Math.random() <= entry.chance) loot[entry.item] = Phaser.Math.Between(entry.min, entry.max);
    this.host.loot(a.sprite.x, a.sprite.y, loot, a.def.coins);
    this.host.text(a.sprite.x, a.sprite.y - 50, `+${a.def.xp} EXP`, '#a8d5bf');
    this.scene.tweens.add({ targets: a.sprite, alpha: 0, scaleX: 0.2, scaleY: 0.2, y: a.sprite.y - 15, duration: 380, onComplete: () => a.sprite.setVisible(false) });
    if (a.def.boss) this.host.notice('Guardião derrotado! A Lâmina Ancestral pertence a quem ousa explorar.');
    model.changed();
  }
  destroy() { this.graphics.destroy(); this.actors.forEach(a => a.sprite.destroy()); }
}
