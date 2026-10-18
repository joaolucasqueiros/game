import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { STRUCTURES } from '../data/structures';
import type { PlacedStructure, Result, SaveState, Stack } from '../types';
import { createInitialState, EQUIPMENT_SLOTS, INVENTORY_SIZE, SAVE_VERSION, SKILLS } from './GameModel';

export const SAVE_KEY = 'cronicas-de-ferro.save.v1';
export const BACKUP_KEY = `${SAVE_KEY}.backup`;

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
const integer = (value: unknown, minimum: number, maximum: number): value is number => finite(value, minimum, maximum) && Number.isSafeInteger(value);
const knownItem = (id: unknown): id is string => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ITEMS, id);
const safeKey = (key: string) => key.length > 0 && key.length < 150 && !['__proto__', 'constructor', 'prototype'].includes(key);

function validStacks(value: unknown, size: number): value is (Stack | null)[] {
  if (!Array.isArray(value) || value.length !== size) return false;
  return value.every(stack => stack === null || (object(stack) && knownItem(stack.item) && integer(stack.qty, 1, ITEMS[stack.item].stack) && (stack.durability === undefined || finite(stack.durability, 0, 100000))));
}

function stringArray(value: unknown, limit: number): value is string[] {
  return Array.isArray(value) && value.length <= limit && value.every(entry => typeof entry === 'string' && safeKey(entry));
}

function migrate(value: unknown): unknown {
  if (!object(value)) return null;
  if (value.version === SAVE_VERSION) return value;
  // Keep the storage key stable, so existing version-one browser saves remain discoverable.
  if (value.version === 1) return { ...value, version: SAVE_VERSION, loot: [] };
  // Version zero used the same item IDs but did not include every world/settings field.
  if (value.version !== 0 && value.version !== undefined) return null;
  if (!Array.isArray(value.inventory) || !object(value.position)) return null;
  const inventory = value.inventory;
  const initial = createInitialState();
  return {
    ...initial, ...value, version: SAVE_VERSION, loot: [],
    inventory: inventory.length <= INVENTORY_SIZE ? Array.from({ length: INVENTORY_SIZE }, (_, index) => inventory[index] ?? null) : inventory,
    equipment: { ...initial.equipment, ...(object(value.equipment) ? value.equipment : {}) },
    skills: { ...initial.skills, ...(object(value.skills) ? value.skills : {}) },
    settings: { ...initial.settings, ...(object(value.settings) ? value.settings : {}) },
  };
}

/** Reject malformed or future saves before they can enter the game simulation. */
function validState(candidate: unknown): candidate is SaveState {
  if (!object(candidate) || candidate.version !== SAVE_VERSION) return false;
  if (!object(candidate.position) || !finite(candidate.position.x, 0, 112 * 32) || !finite(candidate.position.y, 0, 88 * 32)) return false;
  if (!finite(candidate.health, 0, 10000) || !finite(candidate.energy, 0, 10000) || !finite(candidate.mana, 0, 10000)) return false;
  if (!integer(candidate.level, 1, 99) || !finite(candidate.xp, 0, 1e9) || !integer(candidate.coins, 0, 1e9)) return false;
  if (!validStacks(candidate.inventory, INVENTORY_SIZE) || !object(candidate.equipment)) return false;
  const equipment = candidate.equipment;
  if (!EQUIPMENT_SLOTS.every(slot => equipment[slot] === null || (knownItem(equipment[slot]) && ITEMS[equipment[slot] as string].slot === slot))) return false;
  if (!Array.isArray(candidate.hotbar) || candidate.hotbar.length !== 9 || !candidate.hotbar.every(id => id === '' || knownItem(id))) return false;
  if (!integer(candidate.selected, 0, 8) || !finite(candidate.time, 0, 1e12)) return false;
  if (!object(candidate.skills)) return false;
  const skills = candidate.skills;
  if (!SKILLS.every(skill => integer(skills[skill], 0, 1e9))) return false;
  if (!object(candidate.metrics) || Object.entries(candidate.metrics).some(([key, value]) => !safeKey(key) || !integer(value, 0, 1e9))) return false;
  if (!stringArray(candidate.quests, QUESTS.length) || candidate.quests.some(id => !QUESTS.some(quest => quest.id === id)) || new Set(candidate.quests).size !== candidate.quests.length) return false;
  if (!Array.isArray(candidate.structures) || candidate.structures.length > 2000) return false;
  const structureIds = new Set<string>();
  for (const structure of candidate.structures) {
    if (!object(structure) || typeof structure.id !== 'string' || !safeKey(structure.id) || structureIds.has(structure.id)) return false;
    structureIds.add(structure.id);
    if (typeof structure.type !== 'string' || !Object.prototype.hasOwnProperty.call(STRUCTURES, structure.type)) return false;
    const definition = STRUCTURES[structure.type];
    if (!integer(structure.x, 1, 111) || !integer(structure.y, 1, 87) || structure.x + definition.width >= 112 || structure.y + definition.height >= 88) return false;
    if (structure.storage !== undefined && !validStacks(structure.storage, 18)) return false;
    if (structure.plantedAt !== undefined && !finite(structure.plantedAt, 0, 1e12)) return false;
  }
  if (!object(candidate.resources) || Object.keys(candidate.resources).length > 20000) return false;
  for (const [id, resource] of Object.entries(candidate.resources)) {
    if (!safeKey(id) || !object(resource) || !finite(resource.remaining, 0, 100000) || !finite(resource.respawnAt, 0, 1e12)) return false;
  }
  if (!object(candidate.enemies) || Object.entries(candidate.enemies).some(([id, time]) => !safeKey(id) || !finite(time, 0, Number.MAX_SAFE_INTEGER))) return false;
  if (!Array.isArray(candidate.loot) || candidate.loot.length > 2000) return false;
  const lootIds = new Set<string>();
  for (const loot of candidate.loot) {
    if (!object(loot) || typeof loot.id !== 'string' || !safeKey(loot.id) || lootIds.has(loot.id)) return false;
    lootIds.add(loot.id);
    if (!finite(loot.x, 0, 112 * 32 - 1) || !finite(loot.y, 0, 88 * 32 - 1) || !integer(loot.coins, 0, 1e9)) return false;
    if (!object(loot.items) || Object.entries(loot.items).some(([item, qty]) => !knownItem(item) || !integer(qty, 1, 999))) return false;
  }
  if (!stringArray(candidate.openedChests, 10000) || !stringArray(candidate.visited, 100)) return false;
  if (!object(candidate.settings) || typeof candidate.settings.sound !== 'boolean' || typeof candidate.settings.music !== 'boolean' || typeof candidate.settings.showHints !== 'boolean' || !finite(candidate.settings.volume, 0, 1)) return false;
  return true;
}

function parse(raw: string | null): SaveState | null {
  if (!raw || raw.length > 5_000_000) return null;
  try {
    const migrated: unknown = migrate(JSON.parse(raw));
    if (!validState(migrated)) return null;
    // Build a clean data tree. Never retain executable objects or inherited properties.
    const state = migrated;
    return {
      version: SAVE_VERSION, position: { x: state.position.x, y: state.position.y },
      health: state.health, energy: state.energy, mana: state.mana,
      level: state.level, xp: state.xp, coins: state.coins,
      inventory: state.inventory.map(stack => stack ? { item: stack.item, qty: stack.qty, ...(stack.durability === undefined ? {} : { durability: stack.durability }) } : null),
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, state.equipment[slot]])) as SaveState['equipment'],
      hotbar: [...state.hotbar], skills: { ...state.skills }, metrics: { ...state.metrics }, quests: [...state.quests],
      structures: state.structures.map((structure: PlacedStructure) => ({ id: structure.id, type: structure.type, x: structure.x, y: structure.y, ...(structure.storage ? { storage: structure.storage.map(stack => stack ? { ...stack } : null) } : {}), ...(structure.plantedAt === undefined ? {} : { plantedAt: structure.plantedAt }) })),
      resources: Object.fromEntries(Object.entries(state.resources).map(([id, resource]) => [id, { remaining: resource.remaining, respawnAt: resource.respawnAt }])),
      enemies: { ...state.enemies }, openedChests: [...state.openedChests], visited: [...state.visited],
      loot: state.loot.map(loot => ({ id: loot.id, x: loot.x, y: loot.y, items: { ...loot.items }, coins: loot.coins })),
      time: state.time, selected: state.selected, settings: { ...state.settings },
    };
  } catch {
    return null;
  }
}

export function saveGame(state: SaveState): Result {
  try {
    const serialized = JSON.stringify(state);
    if (!parse(serialized)) return { ok: false, message: 'Não foi possível salvar: os dados da partida são inválidos.' };
    const previous = localStorage.getItem(SAVE_KEY);
    if (previous && parse(previous)) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(SAVE_KEY, serialized);
    return { ok: true, message: 'Partida salva neste navegador.' };
  } catch {
    return { ok: false, message: 'Não foi possível salvar. Verifique o espaço e a permissão de armazenamento do navegador.' };
  }
}

export function loadGame(): SaveState | null {
  try {
    return parse(localStorage.getItem(SAVE_KEY)) ?? parse(localStorage.getItem(BACKUP_KEY));
  } catch {
    return null;
  }
}

export function hasSave(): boolean { return loadGame() !== null; }

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    // Storage can be unavailable in privacy modes; starting a new in-memory game remains possible.
  }
}
