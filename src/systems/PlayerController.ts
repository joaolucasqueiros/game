import Phaser from 'phaser';
import type { Direction, SaveState } from '../types';
import { ITEMS } from '../data/items';

export type PlayerAction = 'idle' | 'walk' | 'run' | 'attack' | 'woodcut' | 'mine' | 'gather' | 'fish' | 'build' | 'hurt' | 'dodge' | 'dead';
export class PlayerController {
  sprite: Phaser.GameObjects.Sprite;
  weapon: Phaser.GameObjects.Image;
  armorChest: Phaser.GameObjects.Sprite;
  armorHelmet: Phaser.GameObjects.Sprite;
  private fishingRod: Phaser.GameObjects.Graphics;
  direction: Direction = 'down';
  action: PlayerAction = 'idle';
  actionTime = 0;
  invulnerable = 0;
  angle = Math.PI / 2;
  blocking = false;
  actionItem?: string;
  fishingTarget?: { x: number; y: number };
  private elapsed = 0;
  private stepTime = 0;
  private dodge = new Phaser.Math.Vector2();
  private knockback = new Phaser.Math.Vector2();
  onStep?: () => void;
  onActionEnd?: () => void;
  constructor(private scene: Phaser.Scene, private state: () => SaveState, private blocked: (x: number, y: number, radius: number) => boolean) {
    const s = state();
    this.sprite = scene.add.sprite(s.position.x, s.position.y, 'player').setOrigin(0.5, 0.92).setScale(0.8);
    this.weapon = scene.add.image(s.position.x, s.position.y, 'item_wood_sword').setOrigin(0.4, 0.8).setScale(0.7);
    this.armorChest = scene.add.sprite(s.position.x, s.position.y, 'armor_chest').setOrigin(0.5, 0.92).setScale(0.8).setVisible(false);
    this.armorHelmet = scene.add.sprite(s.position.x, s.position.y, 'armor_helmet').setOrigin(0.5, 0.92).setScale(0.8).setVisible(false);
    this.fishingRod = scene.add.graphics();
    for (const [row, dir] of ['down', 'left', 'right', 'up'].entries()) {
      for (const [name, frames, rate] of [['idle', [0, 1], 3], ['walk', [2, 3, 4, 5], 10], ['action', [6, 7], 11]] as const) {
        const key = `player_${dir}_${name}`;
        if (!scene.anims.exists(key)) scene.anims.create({ key, frames: frames.map(i => ({ key: 'player', frame: row * 8 + i })), frameRate: rate, repeat: -1 });
      }
    }
  }
  get x() { return this.sprite.x; }
  get y() { return this.sprite.y; }
  get busy() { return this.actionTime > 0 && this.action !== 'walk' && this.action !== 'run'; }
  face(x: number, y: number) {
    this.angle = Math.atan2(y - this.y, x - this.x);
    this.direction = Math.abs(Math.cos(this.angle)) > Math.abs(Math.sin(this.angle)) ? (Math.cos(this.angle) < 0 ? 'left' : 'right') : (Math.sin(this.angle) < 0 ? 'up' : 'down');
  }
  setAction(action: PlayerAction, duration: number, onEnd?: () => void) {
    this.action = action; this.actionTime = duration; this.onActionEnd = onEnd;
  }
  evade(dx: number, dy: number) {
    if (this.busy || this.state().energy < 18) return false;
    this.state().energy -= 18;
    this.dodge.set(dx || Math.cos(this.angle), dy || Math.sin(this.angle)).normalize();
    this.invulnerable = 0.4;
    this.setAction('dodge', 0.24);
    return true;
  }
  hurt(fromX: number, fromY: number) {
    this.invulnerable = 0.8;
    this.knockback.set(this.x - fromX, this.y - fromY).normalize().scale(180);
    this.setAction('hurt', 0.16);
  }
  teleport(x: number, y: number) {
    this.knockback.set(0, 0); this.dodge.set(0, 0); this.blocking = false;
    this.fishingTarget = undefined;
    this.sprite.setPosition(x, y); this.state().position = { x, y };
  }
  private move(dx: number, dy: number) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(this.x + dx / steps, this.y, 8)) this.sprite.x += dx / steps;
      if (!this.blocked(this.x, this.y + dy / steps, 8)) this.sprite.y += dy / steps;
    }
  }
  update(dt: number, dx: number, dy: number, run: boolean, activeItem: string) {
    const state = this.state();
    this.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.sprite.setAlpha(this.invulnerable > 0 && Math.floor(this.elapsed * 18) % 2 === 0 ? 0.48 : 1);
    if (this.actionTime > 0) {
      this.actionTime -= dt;
      if (this.actionTime <= 0) { const callback = this.onActionEnd; this.onActionEnd = undefined; this.action = 'idle'; this.actionItem = undefined; this.fishingTarget = undefined; callback?.(); }
    }
    this.fishingRod.clear();
    if (state.health <= 0) { this.action = 'dead'; this.sprite.setAngle(85); this.weapon.setVisible(false); this.armorChest.setVisible(false); this.armorHelmet.setVisible(false); return; }
    this.sprite.setAngle(0);
    if (this.action === 'dodge') this.move(this.dodge.x * 340 * dt, this.dodge.y * 340 * dt);
    else if (this.knockback.length() > 4) { this.move(this.knockback.x * dt, this.knockback.y * dt); this.knockback.scale(Math.exp(-dt * 14)); }
    else if (!this.busy) {
      const direction = new Phaser.Math.Vector2(dx, dy).normalize();
      const moving = direction.lengthSq() > 0;
      const running = run && state.energy > 1 && moving;
      const speed = this.blocking ? 52 : running ? 170 : 115;
      if (moving) {
        this.face(this.x + direction.x * 20, this.y + direction.y * 20);
        this.move(direction.x * speed * dt, direction.y * speed * dt);
        this.action = running ? 'run' : 'walk';
        if (running) state.energy = Math.max(0, state.energy - dt * 12);
        this.stepTime -= dt;
        if (this.stepTime <= 0) { this.onStep?.(); this.stepTime = running ? 0.23 : 0.34; }
      } else this.action = 'idle';
    }
    const moving = this.action === 'walk' || this.action === 'run' || this.action === 'dodge';
    const acting = ['attack', 'woodcut', 'mine', 'gather', 'fish', 'build', 'hurt'].includes(this.action);
    this.sprite.play(`player_${this.direction}_${moving ? 'walk' : acting ? 'action' : 'idle'}`, true);
    this.sprite.anims.timeScale = this.action === 'run' || this.action === 'dodge' ? 1.5 : 1;
    this.sprite.setDepth(this.y);
    activeItem = this.actionItem ?? activeItem;
    const item = ITEMS[activeItem];
    const armed = item && (item.kind === 'weapon' || item.kind === 'tool');
    this.weapon.setVisible(!!armed && this.action !== 'fish');
    if (armed) {
      this.weapon.setTexture(`item_${activeItem}`);
      const swing = acting ? Math.sin(this.elapsed * 19) * 1.1 : 0;
      const angle = this.angle + swing;
      this.weapon.setPosition(this.x + Math.cos(angle) * 10, this.y - 14 + Math.sin(angle) * 5);
      this.weapon.setRotation(angle + Math.PI / 4);
      this.weapon.setDepth(this.y + (this.direction === 'up' ? -0.2 : 0.3));
    }
    for (const [layer, visible] of [[this.armorChest, !!state.equipment.chest], [this.armorHelmet, !!state.equipment.head]] as const)
      layer.setVisible(visible).setPosition(this.x, this.y).setFrame(this.sprite.frame.name).setDepth(this.y + 0.1).setAlpha(this.sprite.alpha);
    if (this.action === 'fish') {
      const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
      const tipX = this.x + dx * 27, tipY = this.y - 26 + dy * 12;
      const bobX = this.fishingTarget?.x ?? this.x + dx * 70, bobY = this.fishingTarget?.y ?? this.y + dy * 70;
      this.fishingRod.setDepth(this.y + 1).lineStyle(2, 0xb7945d).lineBetween(this.x + dx * 7, this.y - 17, tipX, tipY);
      this.fishingRod.lineStyle(1, 0xe5d9a9, 0.8).lineBetween(tipX, tipY, bobX, bobY);
      this.fishingRod.fillStyle(0xe9a36a).fillCircle(bobX, bobY + Math.sin(this.elapsed * 9), 2);
    }
    state.position.x = this.x; state.position.y = this.y;
  }
  destroy() { this.sprite.destroy(); this.weapon.destroy(); this.armorChest.destroy(); this.armorHelmet.destroy(); this.fishingRod.destroy(); }
}
