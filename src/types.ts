export type Direction = 'down' | 'left' | 'right' | 'up';
export type EquipmentSlot = 'weapon' | 'shield' | 'head' | 'chest' | 'legs' | 'boots' | 'accessory';
export type Station = 'hand' | 'workbench' | 'furnace' | 'forge' | 'alchemy' | 'carpentry';
export type Skill = 'melee' | 'archery' | 'mining' | 'woodcutting' | 'smithing' | 'survival';
export type ItemKind = 'resource' | 'weapon' | 'tool' | 'armor' | 'consumable' | 'structure' | 'ammo';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface Stack { item: string; qty: number; durability?: number }
export interface ItemDef {
  id: string; name: string; description: string; kind: ItemKind; rarity: Rarity;
  stack: number; value: number; slot?: EquipmentSlot; damage?: number; defense?: number;
  range?: number; cooldown?: number; weaponType?: 'sword' | 'axe' | 'spear' | 'bow' | 'staff';
  tool?: 'axe' | 'pickaxe' | 'rod'; tier?: number; heal?: number; energy?: number; mana?: number; structure?: string;
}
export interface Recipe { id: string; item: string; qty: number; costs: Record<string, number>; station: Station; level: number }
export interface StructureDef { id: string; name: string; item: string; width: number; height: number; solid: boolean; station?: Station; description: string }
export interface PlacedStructure { id: string; type: string; x: number; y: number; storage?: (Stack | null)[]; plantedAt?: number }
export interface SavedLoot { id: string; x: number; y: number; items: Record<string, number>; coins: number }
export interface QuestDef { id: string; title: string; description: string; metric: string; target: number; reward: { coins: number; xp: number; items?: Record<string, number> }; requires?: string }
export interface SaveState {
  version: number; position: { x: number; y: number }; health: number; energy: number; mana: number;
  level: number; xp: number; coins: number; inventory: (Stack | null)[];
  equipment: Record<EquipmentSlot, string | null>; hotbar: string[];
  skills: Record<Skill, number>; metrics: Record<string, number>; quests: string[];
  structures: PlacedStructure[]; resources: Record<string, { remaining: number; respawnAt: number }>;
  enemies: Record<string, number>; openedChests: string[]; visited: string[]; loot: SavedLoot[];
  time: number; selected: number; settings: { sound: boolean; music: boolean; volume: number; showHints: boolean };
}
export interface Result { ok: boolean; message: string }
export interface NpcDef { id: string; name: string; role: string; x: number; y: number; sprite: string; dialogue: string[]; stock: string[]; station?: Station }
export interface EnemyDef { id: string; name: string; hp: number; damage: number; speed: number; aggro: number; range: number; cooldown: number; xp: number; coins: number; loot: { item: string; min: number; max: number; chance: number }[]; ranged?: boolean; poison?: boolean; boss?: boolean }
export interface ResourceNode { id: string; type: 'tree' | 'rock' | 'ore' | 'plant' | 'fish'; item: string; x: number; y: number; texture: string; hp: number; tier: number; solid: boolean }
export interface Building { id: string; x: number; y: number; width: number; height: number; texture: string; name: string; station?: Station }
export interface Region { id: string; name: string; subtitle: string; color: string; x: number; y: number; width: number; height: number; danger: number }
