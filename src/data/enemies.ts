import type { EnemyDef } from '../types';

const definitions: EnemyDef[] = [
  { id: 'slime', name: 'Slime do vale', hp: 26, damage: 7, speed: 36, aggro: 145, range: 29, cooldown: 1200, xp: 18, coins: 3, loot: [{ item: 'essence', min: 1, max: 1, chance: 0.5 }, { item: 'herb', min: 1, max: 2, chance: 0.6 }] },
  { id: 'wolf', name: 'Lobo selvagem', hp: 48, damage: 12, speed: 90, aggro: 220, range: 35, cooldown: 950, xp: 26, coins: 5, loot: [{ item: 'leather', min: 1, max: 2, chance: 1 }, { item: 'fang', min: 1, max: 2, chance: 0.8 }] },
  { id: 'goblin', name: 'Goblin saqueador', hp: 62, damage: 14, speed: 64, aggro: 190, range: 40, cooldown: 1100, xp: 32, coins: 10, loot: [{ item: 'copper_ore', min: 1, max: 3, chance: 1 }, { item: 'health_potion', min: 1, max: 1, chance: 0.15 }] },
  { id: 'skeleton', name: 'Esqueleto guerreiro', hp: 82, damage: 18, speed: 48, aggro: 190, range: 42, cooldown: 1250, xp: 40, coins: 11, loot: [{ item: 'bone', min: 1, max: 3, chance: 1 }, { item: 'iron_ore', min: 1, max: 2, chance: 0.5 }, { item: 'iron_sword', min: 1, max: 1, chance: 0.025 }] },
  { id: 'archer', name: 'Arqueiro esqueleto', hp: 55, damage: 13, speed: 48, aggro: 290, range: 230, cooldown: 1700, xp: 38, coins: 10, ranged: true, loot: [{ item: 'bone', min: 1, max: 2, chance: 1 }, { item: 'arrow', min: 4, max: 8, chance: 1 }] },
  { id: 'spider', name: 'Aranha gigante', hp: 57, damage: 10, speed: 76, aggro: 180, range: 33, cooldown: 1400, xp: 33, coins: 6, poison: true, loot: [{ item: 'fiber', min: 2, max: 4, chance: 1 }, { item: 'essence', min: 1, max: 2, chance: 0.5 }] },
  { id: 'golem', name: 'Golem de pedra', hp: 150, damage: 28, speed: 30, aggro: 180, range: 53, cooldown: 1950, xp: 75, coins: 20, loot: [{ item: 'stone', min: 4, max: 8, chance: 1 }, { item: 'crystal', min: 1, max: 2, chance: 0.7 }, { item: 'silver_ore', min: 1, max: 2, chance: 0.4 }] },
  { id: 'guardian', name: 'Guardião das Ruínas', hp: 650, damage: 27, speed: 43, aggro: 350, range: 75, cooldown: 1800, xp: 300, coins: 150, boss: true, loot: [{ item: 'core', min: 1, max: 1, chance: 1 }, { item: 'ancient_blade', min: 1, max: 1, chance: 1 }, { item: 'crystal', min: 3, max: 5, chance: 1 }] },
];
export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(definitions.map(entry => [entry.id, entry]));
