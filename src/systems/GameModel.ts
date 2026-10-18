import { ITEMS } from '../data/items';
import { QUESTS } from '../data/quests';
import { RECIPES } from '../data/recipes';
import type { EquipmentSlot, Result, SaveState, Skill, Stack, Station } from '../types';

export const INVENTORY_SIZE = 36;
export const SAVE_VERSION = 2;
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ['weapon', 'shield', 'head', 'chest', 'legs', 'boots', 'accessory'];
export const SKILLS: Skill[] = ['melee', 'archery', 'mining', 'woodcutting', 'smithing', 'survival'];
const validAmount = (amount: number) => Number.isSafeInteger(amount) && amount > 0;
const definition = (id: string) => Object.prototype.hasOwnProperty.call(ITEMS, id) ? ITEMS[id] : undefined;
const success = (message: string): Result => ({ ok: true, message });
const failure = (message: string): Result => ({ ok: false, message });
const copyInventory = (inventory: (Stack | null)[]) => inventory.map(stack => stack ? { ...stack } : null);

/** Insert into a candidate inventory. The caller commits it only after complete success. */
function insert(inventory: (Stack | null)[], id: string, amount: number): boolean {
  const item = definition(id);
  if (!item || !validAmount(amount)) return false;
  let remaining = amount;
  for (const stack of inventory) {
    if (!stack || stack.item !== id || stack.qty >= item.stack) continue;
    const increment = Math.min(remaining, item.stack - stack.qty);
    stack.qty += increment;
    remaining -= increment;
    if (!remaining) return true;
  }
  for (let index = 0; index < inventory.length; index++) {
    if (inventory[index]) continue;
    const increment = Math.min(remaining, item.stack);
    inventory[index] = { item: id, qty: increment };
    remaining -= increment;
    if (!remaining) return true;
  }
  return false;
}

function extract(inventory: (Stack | null)[], id: string, amount: number): boolean {
  if (!validAmount(amount) || inventory.reduce((total, stack) => total + (stack?.item === id ? stack.qty : 0), 0) < amount) return false;
  let remaining = amount;
  for (let index = 0; index < inventory.length; index++) {
    const stack = inventory[index];
    if (!stack || stack.item !== id) continue;
    const decrement = Math.min(remaining, stack.qty);
    stack.qty -= decrement;
    remaining -= decrement;
    if (!stack.qty) inventory[index] = null;
    if (!remaining) return true;
  }
  return true;
}

export function createInitialState(): SaveState {
  const inventory: (Stack | null)[] = Array.from({ length: INVENTORY_SIZE }, () => null);
  inventory[0] = { item: 'wood_axe', qty: 1 };
  inventory[1] = { item: 'stone_pickaxe', qty: 1 };
  inventory[2] = { item: 'health_potion', qty: 3 };
  return {
    version: SAVE_VERSION,
    position: { x: 1120, y: 1728 },
    health: 100, energy: 100, mana: 50, level: 1, xp: 0, coins: 25,
    inventory,
    equipment: { weapon: 'wood_sword', shield: null, head: null, chest: null, legs: null, boots: null, accessory: null },
    hotbar: ['wood_sword', 'wood_axe', 'stone_pickaxe', 'health_potion', '', '', '', '', ''],
    skills: { melee: 0, archery: 0, mining: 0, woodcutting: 0, smithing: 0, survival: 0 },
    metrics: {}, quests: [], structures: [], resources: {}, enemies: {}, openedChests: [], visited: [], loot: [],
    time: 0, selected: 0,
    settings: { sound: true, music: true, volume: 0.35, showHints: true },
  };
}

export class GameModel {
  public state: SaveState;
  public onNotice?: (message: string) => void;
  private readonly listeners = new Set<() => void>();
  private checkingQuests = false;

  constructor(state?: SaveState) {
    this.state = state ?? createInitialState();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  changed(): void {
    this.checkQuests();
    for (const listener of this.listeners) listener();
  }

  count(id: string): number {
    return this.state.inventory.reduce((total, stack) => total + (stack?.item === id ? stack.qty : 0), 0);
  }

  add(id: string, qty: number): boolean {
    const candidate = copyInventory(this.state.inventory);
    if (!insert(candidate, id, qty)) return false;
    this.state.inventory = candidate;
    this.changed();
    return true;
  }

  remove(id: string, qty: number): boolean {
    const candidate = copyInventory(this.state.inventory);
    if (!extract(candidate, id, qty)) return false;
    this.state.inventory = candidate;
    this.changed();
    return true;
  }

  move(from: number, to: number): Result {
    if (!this.isIndex(from) || !this.isIndex(to)) return failure('Espaço inválido.');
    if (from === to) return success('O item já está neste espaço.');
    const source = this.state.inventory[from];
    if (!source) return failure('Este espaço está vazio.');
    const destination = this.state.inventory[to];
    if (destination?.item === source.item && ITEMS[source.item].stack > 1) {
      const amount = Math.min(source.qty, ITEMS[source.item].stack - destination.qty);
      if (amount === 0) return failure('Esta pilha está cheia.');
      destination.qty += amount;
      source.qty -= amount;
      if (!source.qty) this.state.inventory[from] = null;
    } else {
      this.state.inventory[to] = source;
      this.state.inventory[from] = destination;
    }
    this.changed();
    return success('Inventário organizado.');
  }

  equip(index: number): Result {
    const stack = this.isIndex(index) ? this.state.inventory[index] : null;
    if (!stack) return failure('Selecione um equipamento.');
    const item = ITEMS[stack.item];
    if (!item.slot) return failure('Este item não pode ser equipado.');
    const previous = this.state.equipment[item.slot];
    this.state.equipment[item.slot] = item.id;
    this.state.inventory[index] = previous ? { item: previous, qty: 1 } : null;
    // Selecting equipment also makes the active weapon reachable from the first slot.
    if (item.slot === 'weapon') this.state.hotbar[0] = item.id;
    this.changed();
    return success(`${item.name} equipado.`);
  }

  unequip(slot: EquipmentSlot): Result {
    if (!EQUIPMENT_SLOTS.includes(slot)) return failure('Espaço de equipamento inválido.');
    const id = this.state.equipment[slot];
    if (!id) return failure('Não há equipamento neste espaço.');
    const candidate = copyInventory(this.state.inventory);
    if (!insert(candidate, id, 1)) return failure('O inventário está cheio.');
    this.state.inventory = candidate;
    this.state.equipment[slot] = null;
    this.changed();
    return success(`${ITEMS[id].name} guardado no inventário.`);
  }

  consume(index: number): Result {
    const stack = this.isIndex(index) ? this.state.inventory[index] : null;
    if (!stack || ITEMS[stack.item].kind !== 'consumable') return failure('Selecione um consumível.');
    const item = ITEMS[stack.item];
    const health = Math.min(this.maxHealth, this.state.health + (item.heal ?? 0));
    const energy = Math.min(this.maxEnergy, this.state.energy + (item.energy ?? 0));
    const mana = Math.min(this.maxMana, this.state.mana + (item.mana ?? 0));
    if (health === this.state.health && energy === this.state.energy && mana === this.state.mana) return failure('Você já está recuperado.');
    this.state.health = health;
    this.state.energy = energy;
    this.state.mana = mana;
    stack.qty--;
    if (!stack.qty) this.state.inventory[index] = null;
    this.changed();
    return success(`${item.name} consumido.`);
  }

  discard(index: number, qty = 1): Result {
    const stack = this.isIndex(index) ? this.state.inventory[index] : null;
    if (!stack || !validAmount(qty) || qty > stack.qty) return failure('Quantidade inválida para descartar.');
    const name = ITEMS[stack.item].name;
    stack.qty -= qty;
    if (!stack.qty) this.state.inventory[index] = null;
    this.changed();
    return success(`${qty} × ${name} descartado.`);
  }

  craft(recipeId: string, stations: Set<Station>): Result {
    const recipe = RECIPES.find(entry => entry.id === recipeId);
    if (!recipe) return failure('Receita desconhecida.');
    if (this.state.level < recipe.level) return failure(`Requer nível ${recipe.level}.`);
    if (recipe.station !== 'hand' && !stations.has(recipe.station)) return failure('Aproxime-se da estação de trabalho necessária.');
    for (const [id, amount] of Object.entries(recipe.costs)) {
      if (this.count(id) < amount) return failure(`Faltam ${amount - this.count(id)} × ${ITEMS[id].name}.`);
    }
    const candidate = copyInventory(this.state.inventory);
    for (const [id, amount] of Object.entries(recipe.costs)) extract(candidate, id, amount);
    if (!insert(candidate, recipe.item, recipe.qty)) return failure('Libere um espaço no inventário antes de fabricar.');
    this.state.inventory = candidate;
    this.incrementMetric(`craft:${recipe.item}`, recipe.qty);
    const item = ITEMS[recipe.item];
    if (item.kind === 'weapon') this.incrementMetric('craft:weapon', recipe.qty);
    if (item.kind === 'armor') this.incrementMetric('craft:armor', recipe.qty);
    this.state.skills.smithing += 8;
    this.gainXP(5 + this.skillLevel('smithing') - 1);
    this.changed();
    return success(`Fabricado: ${recipe.qty} × ${item.name}.`);
  }

  buy(itemId: string, qty = 1): Result {
    const item = definition(itemId);
    if (!item || !validAmount(qty)) return failure('Compra inválida.');
    const cost = item.value * qty;
    if (!Number.isSafeInteger(cost) || cost > this.state.coins) return failure('Moedas insuficientes.');
    const candidate = copyInventory(this.state.inventory);
    if (!insert(candidate, itemId, qty)) return failure('O inventário está cheio.');
    this.state.inventory = candidate;
    this.state.coins -= cost;
    this.changed();
    return success(`Comprado: ${qty} × ${item.name} por ${cost} moedas.`);
  }

  sell(index: number, qty = 1): Result {
    const stack = this.isIndex(index) ? this.state.inventory[index] : null;
    if (!stack || !validAmount(qty) || stack.qty < qty) return failure('Quantidade inválida para vender.');
    const item = ITEMS[stack.item];
    const price = Math.max(1, Math.floor(item.value * 0.45)) * qty;
    stack.qty -= qty;
    if (!stack.qty) this.state.inventory[index] = null;
    this.state.coins += price;
    this.changed();
    return success(`Vendido: ${qty} × ${item.name} por ${price} moedas.`);
  }

  addXP(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.gainXP(Math.floor(amount));
    this.changed();
  }

  skillXP(skill: Skill, amount: number): void {
    if (!SKILLS.includes(skill) || !Number.isFinite(amount) || amount <= 0) return;
    const before = this.skillLevel(skill);
    this.state.skills[skill] += Math.floor(amount);
    if (this.skillLevel(skill) > before) this.onNotice?.(`Habilidade aprimorada: ${skillNames[skill]} ${this.skillLevel(skill)}.`);
    this.changed();
  }

  metric(key: string, amount = 1): void {
    if (!Number.isFinite(amount) || amount <= 0 || !key || key.length > 100 || key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    this.incrementMetric(key, Math.floor(amount));
    this.changed();
  }

  visit(region: string): void {
    if (!region || this.state.visited.includes(region)) return;
    this.state.visited.push(region);
    this.incrementMetric(`visit:${region}`, 1);
    this.gainXP(12);
    this.changed();
  }

  get maxHealth(): number { return 100 + (this.state.level - 1) * 8; }
  get maxEnergy(): number { return 100 + (this.skillLevel('survival') - 1) * 5; }
  get maxMana(): number { return 50 + (this.state.level - 1) * 3; }
  get attack(): number {
    const weapon = this.state.equipment.weapon ? ITEMS[this.state.equipment.weapon] : undefined;
    const skill: Skill = weapon?.weaponType === 'bow' || weapon?.weaponType === 'staff' ? 'archery' : 'melee';
    return (weapon?.damage ?? 3) + this.state.level - 1 + this.skillLevel(skill) - 1;
  }
  get defense(): number {
    return 1 + EQUIPMENT_SLOTS.reduce((total, slot) => total + (ITEMS[this.state.equipment[slot] ?? '']?.defense ?? 0), 0);
  }
  get xpNeeded(): number { return 60 + (this.state.level - 1) * 40; }
  skillLevel(skill: Skill): number { return Math.min(20, 1 + Math.floor(Math.sqrt(Math.max(0, this.state.skills[skill] ?? 0) / 40))); }

  private isIndex(index: number): boolean { return Number.isInteger(index) && index >= 0 && index < this.state.inventory.length; }
  private incrementMetric(key: string, amount: number): void {
    const current = Object.prototype.hasOwnProperty.call(this.state.metrics, key) ? this.state.metrics[key] : 0;
    this.state.metrics[key] = current + amount;
  }

  private gainXP(amount: number): void {
    this.state.xp += amount;
    while (this.state.xp >= this.xpNeeded && this.state.level < 99) {
      this.state.xp -= this.xpNeeded;
      this.state.level++;
      this.state.health = this.maxHealth;
      this.state.energy = this.maxEnergy;
      this.state.mana = this.maxMana;
      this.onNotice?.(`Nível ${this.state.level}! Vida e energia recuperadas.`);
    }
  }

  private checkQuests(): void {
    if (this.checkingQuests) return;
    this.checkingQuests = true;
    try {
      if ((this.state.metrics['gather:wood'] ?? 0) >= 8 && (this.state.metrics['gather:stone'] ?? 0) >= 6) this.state.metrics['gather:basics'] = 1;
      // Definitions are ordered: an action performed early remains valid when its quest unlocks.
      for (const quest of QUESTS) {
        if (this.state.quests.includes(quest.id) || (quest.requires && !this.state.quests.includes(quest.requires))) continue;
        if ((this.state.metrics[quest.metric] ?? 0) < quest.target) continue;
        this.state.quests.push(quest.id);
        this.state.coins += quest.reward.coins;
        this.gainXP(quest.reward.xp);
        // Current quest rewards use currency and XP, so a full inventory never loses rewards.
        for (const [id, qty] of Object.entries(quest.reward.items ?? {})) {
          const candidate = copyInventory(this.state.inventory);
          if (insert(candidate, id, qty)) this.state.inventory = candidate;
          else this.state.coins += ITEMS[id].value * qty;
        }
        this.onNotice?.(`Missão concluída: ${quest.title} · +${quest.reward.coins} moedas · +${quest.reward.xp} XP`);
      }
    } finally {
      this.checkingQuests = false;
    }
  }
}

const skillNames: Record<Skill, string> = { melee: 'Combate', archery: 'Arquearia', mining: 'Mineração', woodcutting: 'Lenhador', smithing: 'Ferraria', survival: 'Sobrevivência' };
