import type { EquipmentSlot, ItemDef, NpcDef, PlacedStructure, Skill, Station } from '../types';
import { GameModel } from '../systems/GameModel';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { STRUCTURES } from '../data/structures';
import { QUESTS } from '../data/quests';
import { WorldMap, WORLD_WIDTH, WORLD_HEIGHT } from '../world/WorldMap';

export interface UICallbacks {
  start: (fresh: boolean) => void; save: () => void; respawn: () => void;
  select: (index: number) => void; build: (type: string) => void; removeBuild: () => void;
  craft: (id: string) => void; interact: () => void; pause: (paused: boolean) => void;
  sound: () => void; transfer: (index: number, toStorage: boolean) => void; fishing?: () => void;
}
export interface UIInfo {
  region: string; subtitle: string; time: string; day: number; x: number; y: number; prompt: string;
  stations: Set<Station>; buildType: string | null; buildValid: boolean;
  boss?: { name: string; hp: number; max: number } | null; paused: boolean;
}

const slots: [EquipmentSlot, string][] = [['weapon', 'Arma principal'], ['shield', 'Escudo'], ['head', 'Cabeça'], ['chest', 'Peitoral'], ['legs', 'Pernas'], ['boots', 'Botas'], ['accessory', 'Acessório']];
const skillNames: Record<Skill, string> = { melee: 'Combate', archery: 'Arquearia', mining: 'Mineração', woodcutting: 'Lenhador', smithing: 'Ferraria', survival: 'Sobrevivência' };
const stationNames: Record<Station, string> = { hand: 'Em qualquer lugar', workbench: 'Bancada de trabalho', furnace: 'Fornalha', forge: 'Forja', alchemy: 'Mesa de alquimia', carpentry: 'Carpintaria' };
const rarityNames: Record<string, string> = { common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário' };
const panelNames: Record<string, string> = { inventory: 'Sua mochila', craft: 'Arte de criar', build: 'Um lugar para chamar de lar', skills: 'Sua trajetória', quests: 'Diário de aventura', map: 'Terras de Eldoria', settings: 'Configurações', storage: 'Baú de armazenamento', npc: 'Encontro na vila', pause: 'Uma breve pausa' };
const icon = (name: string) => {
  const paths: Record<string, string> = {
    bag: '<path d="M5 7h14v13H5zM9 7V4h6v3M5 12h14M10 12v3h4v-3"/>',
    hammer: '<path d="m4 19 9-9m-3-5 4-3 7 7-4 4-7-8ZM2 18l4 4"/>',
    house: '<path d="m3 11 9-8 9 8M5 9v12h14V9M10 21v-7h5v7"/>',
    map: '<path d="m3 5 6-2 6 3 6-2v16l-6 2-6-3-6 2ZM9 3v16M15 6v16"/>',
    book: '<path d="M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3ZM12 6v15M6 8h3M6 12h3M15 8h3M15 12h3"/>',
    gear: '<path d="m9 3-1 3-3 1 1 4-2 3 3 3 3-1 2 3 3-1 1-4 3-1-1-4-3-1-1-3ZM15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>',
    heart: '<path d="M12 21 3 12C-2 5 7-1 12 6c5-7 14-1 9 6Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 9 10-13h-7Z"/>',
    drop: '<path d="M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13Z"/>',
    sword: '<path d="m14 3 7-1-1 7L9 20l-4-4ZM5 12l7 7M2 22l6-6"/>',
    shield: '<path d="m12 2 9 4v7c-1 5-6 8-9 10-3-2-8-5-9-10V6ZM12 6v12"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M20 4l-2 2M6 18l-2 2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-5v4h4v4H9M12 6v12"/>',
    save: '<path d="M4 3h14l3 3v15H3V3ZM7 3v7h9V3M7 21v-7h10v7"/>',
    sound: '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8c3 2 3 6 0 8M19 4c6 4 6 12 0 16"/>',
    star: '<path d="m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.star}</svg>`;
};
const image = (id: string, cls = '') => `<img class="item-icon ${cls}" src="/assets/items/${id}.png" alt="" draggable="false">`;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export class GameUI {
  private root: HTMLElement;
  private hud: HTMLElement;
  private modal: HTMLElement;
  private toasts: HTMLElement;
  private panel: string | null = null;
  private selected = 0;
  private selectedRecipe: string | null = null;
  private craftingFilter: Station | 'all' = 'all';
  private npc: NpcDef | null = null;
  private storage: PlacedStructure | null = null;
  private info: UIInfo = { region: 'Vale do Amanhecer', subtitle: 'O início de uma nova história', time: '08:00', day: 1, x: 0, y: 0, prompt: '', stations: new Set(['hand']), buildType: null, buildValid: false, paused: false };
  private dragSource = -1;
  private freshConfirm = false;
  private titleHasSave = false;
  private mapBase: HTMLCanvasElement | null = null;
  private dialogueIndex = 0;

  constructor(private model: GameModel, private callbacks: UICallbacks) {
    this.root = document.querySelector('#ui')!;
    this.root.innerHTML = '<div class="game-hud"></div><div class="modal-root" hidden></div><div class="toast-stack" aria-live="polite"></div>';
    this.hud = this.root.querySelector('.game-hud')!;
    this.modal = this.root.querySelector('.modal-root')!;
    this.toasts = this.root.querySelector('.toast-stack')!;
    this.root.addEventListener('pointerdown', e => e.stopPropagation());
    this.root.addEventListener('mousedown', e => e.stopPropagation());
    this.root.addEventListener('click', e => this.click(e));
    this.root.addEventListener('change', e => this.change(e));
    this.root.addEventListener('dragstart', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!target || !this.model.state.inventory[Number(target.dataset.slot)]) return;
      this.dragSource = Number(target.dataset.slot); e.dataTransfer?.setData('text/plain', String(this.dragSource));
    });
    this.root.addEventListener('dragover', e => { if ((e.target as HTMLElement).closest('[data-slot]')) e.preventDefault(); });
    this.root.addEventListener('drop', e => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (target && this.dragSource >= 0) { e.preventDefault(); this.model.move(this.dragSource, Number(target.dataset.slot)); this.selected = Number(target.dataset.slot); this.renderPanel(); }
      this.dragSource = -1;
    });
    this.model.subscribe(() => { this.renderHUD(); if (this.panel && !['title', 'death'].includes(this.panel)) this.renderPanel(); });
    this.renderHUD();
  }

  get isBlocking() { return this.panel !== null; }
  get activePanel() { return this.panel; }

  update(info: UIInfo) {
    this.info = info;
    this.renderHUD();
    if (this.panel === 'map') this.drawMap(this.modal.querySelector('canvas'), true);
  }

  toast(message: string) {
    if (!message) return;
    const el = document.createElement('div'); el.className = 'game-toast';
    el.innerHTML = `<span class="toast-diamond"></span><span>${esc(message)}</span>`;
    this.toasts.append(el);
    while (this.toasts.children.length > 4) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => { el.classList.add('leaving'); window.setTimeout(() => el.remove(), 250); }, 3400);
  }

  open(panel: string) {
    this.panel = panel; this.freshConfirm = false;
    this.callbacks.pause(true); this.modal.hidden = false; this.root.classList.add('menu-open'); this.renderPanel();
  }

  close() {
    if (this.panel === 'title' || this.panel === 'death') return;
    this.panel = null; this.modal.hidden = true; this.root.classList.remove('menu-open'); this.callbacks.pause(false); this.renderHUD();
  }

  showTitle(hasSave: boolean) {
    this.titleHasSave = hasSave; this.panel = 'title'; this.freshConfirm = false;
    this.callbacks.pause(true); this.modal.hidden = false; this.root.classList.add('menu-open'); this.renderTitle();
  }

  showDeath() {
    this.panel = 'death'; this.callbacks.pause(true); this.modal.hidden = false; this.root.classList.add('menu-open');
    this.modal.innerHTML = `<div class="modal-shade death-shade"></div><section class="story-card death-card"><span class="eyebrow">NEM TODA QUEDA É O FIM</span><span class="story-ornament">◇</span><h1>O vale ainda<br>precisa de você.</h1><p>Você despertará em segurança, junto à sua cabana.<br>Parte de suas moedas fica para trás. Sua história continua.</p><button class="primary-btn" data-action="respawn">Retornar ao amanhecer ${icon('arrow')}</button></section>`;
  }

  showNpc(npc: NpcDef) { this.npc = npc; this.dialogueIndex = 0; this.open('npc'); }
  showStorage(structure: PlacedStructure) { this.storage = structure; this.open('storage'); }

  private renderHUD() {
    const s = this.model.state;
    const quest = QUESTS.find(q => !s.quests.includes(q.id) && (!q.requires || s.quests.includes(q.requires)));
    const questTarget = quest?.metric === 'gather:basics' ? 14 : quest?.target || 1;
    const progress = quest ? quest.metric === 'gather:basics' ? Math.min(8, s.metrics['gather:wood'] || 0) + Math.min(6, s.metrics['gather:stone'] || 0) : Math.min(quest.target, s.metrics[quest.metric] || 0) : 0;
    const hp = Math.max(0, s.health / this.model.maxHealth * 100), energy = s.energy / this.model.maxEnergy * 100, mana = s.mana / this.model.maxMana * 100;
    const selectedItem = ITEMS[s.hotbar[s.selected]];
    const attackSkill: Skill = selectedItem?.weaponType === 'bow' || selectedItem?.weaponType === 'staff' ? 'archery' : 'melee';
    const activeAttack = selectedItem?.damage ? selectedItem.damage + s.level - 1 + this.model.skillLevel(attackSkill) - 1 : this.model.attack;
    const markup = `
      <header class="top-bar"><a class="brand" href="#" data-action="pause" aria-label="Pausar jogo"><span class="brand-seal">CF</span><span><strong>CRÔNICAS DE FERRO</strong><small>UM MUNDO. A SUA HISTÓRIA.</small></span></a>
      <nav class="main-nav" aria-label="Menus do jogo"><button data-panel="inventory">${icon('bag')}<span>Inventário</span><kbd>I</kbd></button><button data-panel="craft">${icon('hammer')}<span>Fabricação</span><kbd>C</kbd></button><button data-panel="build">${icon('house')}<span>Construir</span><kbd>B</kbd></button><button data-panel="map">${icon('map')}<span>Mapa</span><kbd>M</kbd></button></nav>
      <div class="header-actions"><span class="coin-count">${icon('coin')}<b>${s.coins.toLocaleString('pt-BR')}</b></span><button class="icon-btn" title="Salvar partida" aria-label="Salvar partida" data-action="save">${icon('save')}</button><button class="icon-btn" title="Configurações" aria-label="Configurações" data-panel="settings">${icon('gear')}</button></div></header>
      <aside class="player-card"><div class="portrait-frame"><div class="player-portrait"></div><span>${s.level}</span></div><div class="player-stats"><div class="player-name">O Aventureiro <span>NÍVEL ${s.level}</span></div><div class="stat-line health">${icon('heart')}<div class="meter"><i style="width:${hp}%"></i><span>${Math.ceil(s.health)} <em>/ ${this.model.maxHealth}</em></span></div></div><div class="stat-line energy">${icon('bolt')}<div class="meter"><i style="width:${energy}%"></i><span>${Math.ceil(s.energy)} <em>/ ${this.model.maxEnergy}</em></span></div></div><div class="stat-line mana">${icon('drop')}<div class="meter"><i style="width:${mana}%"></i><span>${Math.ceil(s.mana)} <em>/ ${this.model.maxMana}</em></span></div></div><div class="xp-line"><i style="width:${Math.min(100, s.xp / this.model.xpNeeded * 100)}%"></i></div></div></aside>
      <div class="region-banner"><span class="small-diamond"></span><span>${esc(this.info.region)}</span><span class="small-diamond"></span><small>${esc(this.info.subtitle)}</small></div>
      <aside class="world-card"><div class="world-time"><span>${icon('sun')} DIA ${this.info.day}</span><b>${this.info.time}</b></div><button class="minimap-button" data-panel="map" aria-label="Abrir mapa do mundo"><canvas class="minimap" width="192" height="126"></canvas><span class="compass">N</span><span class="minimap-expand">${icon('map')}</span></button><div class="world-caption"><span class="live-dot"></span>${esc(this.info.region)}<span>◇</span></div></aside>
      ${quest ? `<aside class="quest-card"><div class="quest-eyebrow">${icon('book')} SUA JORNADA <button data-panel="quests" aria-label="Abrir diário">${icon('arrow')}</button></div><h3>${esc(quest.title)}</h3><p>${quest.metric === 'gather:basics' ? `Madeira ${Math.min(8, s.metrics['gather:wood'] || 0)}/8 · Pedra ${Math.min(6, s.metrics['gather:stone'] || 0)}/6` : esc(quest.description)}</p><div class="quest-progress"><span>${progress} / ${questTarget}</span><div><i style="width:${progress / questTarget * 100}%"></i></div></div><button class="text-btn" data-panel="quests">Ver diário ${icon('arrow')}</button></aside>` : `<aside class="quest-card"><div class="quest-eyebrow">${icon('star')} UMA LENDA DO VALE</div><h3>Seu próximo capítulo</h3><p>Explore, construa e descubra o que ainda se esconde nestas terras.</p><button class="text-btn" data-panel="quests">Ver suas conquistas ${icon('arrow')}</button></aside>`}
      ${this.info.boss ? `<div class="boss-hud"><span>GUARDIÃO DAS RUÍNAS</span><strong>${esc(this.info.boss.name)}</strong><div><i style="width:${Math.max(0, this.info.boss.hp / this.info.boss.max * 100)}%"></i></div></div>` : ''}
      ${this.info.prompt && !this.panel ? `<button class="interact-prompt" data-action="interact"><kbd>E</kbd><span>${esc(this.info.prompt)}</span></button>` : ''}
      ${this.info.buildType ? `<div class="build-prompt ${this.info.buildValid ? 'valid' : 'invalid'}"><span class="small-diamond"></span>${this.info.buildValid ? 'Posição livre' : 'Não é possível construir aqui'}<small>Clique para construir · Esc para cancelar</small></div>` : ''}
      <footer class="bottom-hud"><div class="hotbar-label"><span></span>EQUIPAMENTO RÁPIDO<span></span></div><div class="hotbar">${Array.from({ length: 9 }, (_, i) => { const id = s.hotbar[i], item = ITEMS[id], qty = item ? this.model.count(id) : 0; return `<button class="hotbar-slot ${s.selected === i ? 'active' : ''} ${qty === 0 && item && item.kind !== 'weapon' && item.kind !== 'tool' ? 'depleted' : ''}" data-select="${i}" title="${item ? esc(item.name) : 'Espaço vazio'} [${i + 1}]"><kbd>${i + 1}</kbd>${item ? image(id) : '<span class="empty-slot-mark">·</span>'}${item && item.stack > 1 ? `<span class="stack-count">${qty}</span>` : ''}${s.selected === i ? '<i class="selected-gem"></i>' : ''}</button>`; }).join('')}</div><div class="hotbar-selected">${esc(ITEMS[s.hotbar[s.selected]]?.name || 'Mãos livres')}<span>·</span><span>${icon('sword')} ${activeAttack}</span><span>${icon('shield')} ${this.model.defense}</span></div></footer>
      ${s.settings.showHints ? '<div class="control-hints"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Mover</span><span><kbd>SHIFT</kbd> Correr</span><span><kbd>ESPAÇO</kbd> Esquivar</span><span><kbd>E</kbd> Interagir</span></div><div class="right-hint"><span class="mouse-icon"></span> Atacar / coletar <span class="hint-divider">·</span> <kbd>ESC</kbd> Pausar</div>' : ''}`;
    this.syncHUD(markup);
    this.drawMap(this.hud.querySelector('canvas'), false);
  }

  /** Keep live buttons in the DOM while the clock, meters and minimap refresh. */
  private syncHUD(markup: string) {
    const template = document.createElement('template'); template.innerHTML = markup;
    const sync = (current: Node, next: Node) => {
      if (current.nodeType !== next.nodeType || (current instanceof Element && next instanceof Element && current.tagName !== next.tagName)) { current.parentNode?.replaceChild(next.cloneNode(true), current); return; }
      if (current.nodeType === Node.TEXT_NODE) { if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue; return; }
      if (current instanceof Element && next instanceof Element) {
        for (const attr of Array.from(current.attributes)) if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
        for (const attr of Array.from(next.attributes)) if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
      }
      const existing = Array.from(current.childNodes), incoming = Array.from(next.childNodes);
      for (let i = 0; i < incoming.length; i++) {
        if (existing[i]) sync(existing[i], incoming[i]); else current.appendChild(incoming[i].cloneNode(true));
      }
      for (let i = incoming.length; i < existing.length; i++) existing[i].parentNode?.removeChild(existing[i]);
    };
    const existing = Array.from(this.hud.children);
    for (const next of Array.from(template.content.children)) {
      const key = next.classList[0];
      const current = existing.find(el => el.classList[0] === key);
      if (current) { sync(current, next); existing.splice(existing.indexOf(current), 1); }
      else this.hud.appendChild(next);
    }
    for (const stale of existing) stale.remove();
  }

  private renderTitle() {
    this.modal.innerHTML = `<div class="modal-shade title-shade"></div><div class="title-atmosphere"><span class="title-overline">MUNDO 3D • PESCA • CAÇA</span><div class="title-wordmark"><span>CRÔNICAS</span><small>DE</small><span>FERRO</span></div><p class="title-tagline">Toda lenda começa com um primeiro passo.</p></div><section class="story-card title-card"><div class="story-topline"><span></span><span class="small-diamond"></span><span></span></div><span class="eyebrow">UMA NOVA HISTÓRIA AGUARDA</span><h1>O vale é seu.<br>A história também.</h1><p>Entre florestas e rios, há um mundo a descobrir.<br>Forje seu caminho, construa seu lar<br>e enfrente o que desperta nas ruínas.</p>${this.titleHasSave && !this.freshConfirm ? `<button class="primary-btn" data-action="continue">Continuar jornada ${icon('arrow')}</button><button class="secondary-btn" data-action="fresh-confirm">Começar uma nova história</button>` : this.freshConfirm ? '<p class="confirm-note">Uma nova jornada substituirá seu progresso salvo.</p><button class="primary-btn" data-action="start">Iniciar nova aventura</button><button class="secondary-btn" data-action="cancel-fresh">Manter minha jornada</button>' : `<button class="primary-btn" data-action="start">Iniciar aventura ${icon('arrow')}</button>`}<div class="title-control-row"><span><kbd>WASD</kbd> Explorar</span><span><kbd>E</kbd> Interagir</span><span><span class="mouse-icon"></span> Atacar</span></div><div class="title-badges"><span class="live-dot"></span>Mundo aberto <i>·</i> Salvo no navegador</div></section><span class="title-bottom">FEITO PARA EXPLORAR. CONSTRUÍDO PARA PERTENCER.</span><span class="version-badge">CRÔNICAS DE FERRO <b>0.2 · 3D</b></span>`;
  }

  private renderPanel() {
    if (!this.panel) return;
    if (this.panel === 'title') { this.renderTitle(); return; }
    if (this.panel === 'death') return;
    const p = this.panel;
    const nav: [string, string, string][] = [['inventory', 'bag', 'Inventário'], ['craft', 'hammer', 'Fabricação'], ['build', 'house', 'Construção'], ['skills', 'star', 'Habilidades'], ['quests', 'book', 'Missões'], ['map', 'map', 'Mapa'], ['settings', 'gear', 'Configurações']];
    const content = p === 'inventory' ? this.inventory() : p === 'craft' ? this.crafting() : p === 'build' ? this.building() : p === 'skills' ? this.skills() : p === 'quests' ? this.quests() : p === 'map' ? this.mapPanel() : p === 'settings' ? this.settings() : p === 'npc' ? this.npcPanel() : p === 'storage' ? this.storagePanel() : this.pausePanel();
    this.modal.innerHTML = `<div class="modal-shade" data-action="close"></div><section class="game-menu ${p === 'map' ? 'map-menu' : ''}"><aside class="menu-sidebar"><div class="menu-brand"><span class="brand-seal">CF</span><span>SEU MUNDO<br><small>SUA HISTÓRIA</small></span></div><nav>${nav.map(([id, symbol, label]) => `<button class="${p === id ? 'active' : ''}" data-panel="${id}">${icon(symbol)}${label}${p === id ? '<span class="nav-dot"></span>' : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><span class="coin-count">${icon('coin')} ${this.model.state.coins.toLocaleString('pt-BR')} <small>moedas</small></span><span>Dia ${this.info.day} · ${this.info.time}</span><button class="text-btn" data-action="save">${icon('save')} Salvar jornada</button></div></aside><main class="menu-main"><header class="menu-header"><div><span class="eyebrow">${p === 'npc' ? esc(this.npc?.role || 'VILA PEDRA ALTA') : 'CRÔNICAS DE FERRO'}</span><h2>${p === 'npc' ? esc(this.npc?.name || '') : panelNames[p] || 'Sua aventura'}</h2></div><button class="close-btn" data-action="close" title="Fechar [Esc]" aria-label="Fechar menu">×<kbd>ESC</kbd></button></header><div class="menu-content">${content}</div></main></section>`;
    if (p === 'map') this.drawMap(this.modal.querySelector('canvas'), true);
  }

  private inventory() {
    const s = this.model.state, stack = s.inventory[this.selected], item = stack ? ITEMS[stack.item] : null;
    return `<div class="inventory-layout"><div><div class="section-label">MOCHILA <span>${s.inventory.filter(Boolean).length} / ${s.inventory.length} espaços</span></div><div class="inventory-grid">${s.inventory.map((stack, i) => `<button class="inventory-slot ${i === this.selected ? 'selected' : ''} ${stack ? `rarity-${ITEMS[stack.item]?.rarity}` : ''}" data-slot="${i}" draggable="${!!stack}" title="${stack ? esc(ITEMS[stack.item]?.name || stack.item) : 'Espaço vazio'}">${stack ? `${image(stack.item)}<span class="stack-count">${stack.qty > 1 ? stack.qty : ''}</span>` : '<span class="empty-slot-mark">·</span>'}</button>`).join('')}</div><p class="quiet-note">Arraste para organizar. Selecione um item para ver os detalhes.</p><div class="section-label equipment-label">EQUIPAMENTOS <span>${icon('shield')} ${this.model.defense} defesa</span></div><div class="equipment-grid">${slots.map(([slot, label]) => { const id = s.equipment[slot]; return `<button class="equipment-slot ${id ? 'equipped' : ''}" data-unequip="${slot}" title="${id ? `${esc(ITEMS[id]?.name || id)} — clique para desequipar` : label}">${id ? image(id) : icon(slot === 'weapon' ? 'sword' : 'shield')}<span>${label}</span></button>`; }).join('')}</div></div><aside class="item-detail">${item && stack ? this.itemDetail(item, stack.qty) : `<div class="empty-detail">${icon('bag')}<h3>Há espaço para<br>novas descobertas.</h3><p>Selecione um item da mochila para conhecer sua história e seus atributos.</p></div>`}</aside></div>`;
  }

  private itemDetail(item: ItemDef, qty: number) {
    const equipped = item.slot ? ITEMS[this.model.state.equipment[item.slot] || ''] : null;
    return `<div class="detail-art rarity-${item.rarity}">${image(item.id)}<span class="detail-art-ring"></span></div><span class="rarity-tag rarity-${item.rarity}">${rarityNames[item.rarity]}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="detail-stats">${item.damage ? `<span>${icon('sword')} Dano <b>${item.damage}</b>${equipped ? `<small class="${item.damage >= (equipped.damage || 0) ? 'positive' : 'negative'}">${item.damage - (equipped.damage || 0) >= 0 ? '+' : ''}${item.damage - (equipped.damage || 0)}</small>` : ''}</span>` : ''}${item.defense ? `<span>${icon('shield')} Defesa <b>${item.defense}</b>${equipped ? `<small class="${item.defense >= (equipped.defense || 0) ? 'positive' : 'negative'}">${item.defense - (equipped.defense || 0) >= 0 ? '+' : ''}${item.defense - (equipped.defense || 0)}</small>` : ''}</span>` : ''}${item.heal ? `<span>${icon('heart')} Cura <b>+${item.heal}</b></span>` : ''}${item.range ? `<span>Alcance <b>${item.range} px</b></span>` : ''}<span>Na mochila <b>${qty}</b></span><span>${icon('coin')} Valor de venda <b>${Math.max(1, Math.floor(item.value * .45))}</b></span></div>${item.slot ? `<button class="primary-btn" data-action="equip">Equipar ${icon('arrow')}</button>` : ''}${item.kind === 'consumable' ? '<button class="primary-btn" data-action="consume">Consumir</button>' : ''}${item.kind === 'structure' ? `<button class="primary-btn" data-build="${item.structure}">Posicionar estrutura</button>` : ''}<div class="hotbar-assignment"><span>ADICIONAR À BARRA RÁPIDA</span><div>${Array.from({ length: 9 }, (_, i) => `<button data-assign="${i}" title="Atribuir ao atalho ${i + 1}">${i + 1}</button>`).join('')}</div></div><button class="text-btn danger-text" data-action="discard">Descartar uma unidade</button>`;
  }

  private crafting() {
    const recipes = RECIPES.filter(r => this.craftingFilter === 'all' || r.station === this.craftingFilter);
    if (!this.selectedRecipe || !recipes.some(r => r.id === this.selectedRecipe)) this.selectedRecipe = recipes[0]?.id || null;
    const recipe = RECIPES.find(r => r.id === this.selectedRecipe), item = recipe ? ITEMS[recipe.item] : null;
    const allowed = recipe && Object.entries(recipe.costs).every(([id, qty]) => this.model.count(id) >= qty) && (recipe.station === 'hand' || this.info.stations.has(recipe.station)) && this.model.state.level >= recipe.level;
    return `<div class="crafting-top"><p>Transforme o que o mundo oferece em novas possibilidades.</p><select data-action="craft-filter" aria-label="Filtrar estação"><option value="all" ${this.craftingFilter === 'all' ? 'selected' : ''}>Todas as estações</option>${Object.entries(stationNames).map(([id, name]) => `<option value="${id}" ${this.craftingFilter === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div><div class="crafting-layout"><div class="recipe-list">${recipes.map(r => { const i = ITEMS[r.item], enough = Object.entries(r.costs).every(([id, qty]) => this.model.count(id) >= qty); return `<button class="recipe-row ${this.selectedRecipe === r.id ? 'selected' : ''}" data-recipe="${r.id}"><span class="recipe-icon">${image(r.item)}</span><span><strong>${esc(i.name)}</strong><small>${stationNames[r.station]}${r.qty > 1 ? ` · ×${r.qty}` : ''}</small></span><i class="recipe-status ${enough ? 'ready' : ''}"></i></button>`; }).join('')}</div><aside class="craft-detail">${recipe && item ? `<div class="detail-art rarity-${item.rarity}">${image(item.id)}</div><span class="rarity-tag rarity-${item.rarity}">${rarityNames[item.rarity]}</span><h3>${esc(item.name)}${recipe.qty > 1 ? ` <small>×${recipe.qty}</small>` : ''}</h3><p>${esc(item.description)}</p><div class="craft-requirements"><span class="section-label">MATERIAIS NECESSÁRIOS</span>${Object.entries(recipe.costs).map(([id, qty]) => `<div class="material-row ${this.model.count(id) >= qty ? 'available' : 'missing'}">${image(id)}<span>${esc(ITEMS[id]?.name || id)}</span><b>${this.model.count(id)} <em>/ ${qty}</em></b></div>`).join('')}</div><div class="station-requirement ${recipe.station === 'hand' || this.info.stations.has(recipe.station) ? '' : 'missing'}">${icon('hammer')} ${stationNames[recipe.station]} ${recipe.station !== 'hand' && !this.info.stations.has(recipe.station) ? '<small>Aproxime-se da estação</small>' : '<small>Disponível</small>'}</div>${this.model.state.level < recipe.level ? `<p class="negative">Requer nível ${recipe.level}</p>` : ''}<button class="primary-btn" data-craft="${recipe.id}" ${allowed ? '' : 'disabled'}>Fabricar ${icon('hammer')}</button>` : '<p>Nenhuma receita nesta estação.</p>'}</aside></div>`;
  }

  private building() {
    return `<p class="panel-intro">Construa seu refúgio, uma peça de cada vez. Fabrique as estruturas e escolha onde colocá-las.</p><div class="build-grid">${Object.values(STRUCTURES).map(def => { const n = this.model.count(def.item); return `<button class="build-option ${n ? 'available' : ''}" data-build="${def.id}" ${n ? '' : 'disabled'}><span class="build-image">${image(def.item)}</span><span class="build-info"><strong>${esc(def.name)}</strong><small>${esc(def.description)}</small><em>${def.width} × ${def.height} tiles <i>·</i> ${n > 0 ? `${n} ${n === 1 ? 'disponível' : 'disponíveis'}` : 'Fabrique primeiro'}</em></span>${icon('arrow')}</button>`; }).join('')}</div><div class="build-footer"><span>${icon('house')} ${this.model.state.structures.length} estruturas no seu mundo</span><button class="secondary-btn" data-action="remove-build">Remover uma estrutura</button></div>`;
  }

  private skills() {
    const s = this.model.state;
    return `<div class="level-summary"><div class="level-medallion">${s.level}<span>NÍVEL</span></div><div><h3>Cada passo deixa uma marca.</h3><p>Explore, crie e lute para desenvolver suas habilidades.</p><div class="level-progress"><i style="width:${s.xp / this.model.xpNeeded * 100}%"></i></div><span>${s.xp} / ${this.model.xpNeeded} EXP para o próximo nível</span></div></div><div class="skills-grid">${(Object.keys(skillNames) as Skill[]).map(skill => { const xp = s.skills[skill], level = this.model.skillLevel(skill); const benefits: Record<Skill, string> = { melee: 'Ataques corpo a corpo mais fortes.', archery: 'Mais dano ao disparar com o arco.', mining: 'Extraia minérios com mais eficiência.', woodcutting: 'Derrube árvores com menos esforço.', smithing: 'A arte de transformar e fabricar.', survival: 'Mais energia para descobrir o mundo.' }; return `<div class="skill-card"><div class="skill-top">${icon(skill === 'melee' || skill === 'archery' ? 'sword' : skill === 'survival' ? 'heart' : 'hammer')}<h3>${skillNames[skill]}</h3><b>${level}</b></div><p>${benefits[skill]}</p><div class="skill-meter"><i style="width:${Math.min(100, (xp - 40 * (level - 1) ** 2) / (40 * level ** 2 - 40 * (level - 1) ** 2) * 100)}%"></i></div><small>${xp} pontos de prática</small></div>`; }).join('')}</div>`;
  }

  private quests() {
    const s = this.model.state;
    return `<div class="journal-intro"><span class="journal-illustration">${icon('book')}</span><div><h3>As páginas da sua história</h3><p>Pequenos feitos abrem caminho para grandes aventuras.</p></div><b>${s.quests.length}<small> / ${QUESTS.length} concluídas</small></b></div><div class="quest-list">${QUESTS.map((q, index) => { const done = s.quests.includes(q.id), locked = q.requires && !s.quests.includes(q.requires), progress = done ? q.target : Math.min(q.target, s.metrics[q.metric] || 0); return `<article class="journal-quest ${done ? 'complete' : ''} ${locked ? 'locked' : ''}"><span class="quest-number">${done ? '✓' : String(index + 1).padStart(2, '0')}</span><div><span class="eyebrow">${done ? 'CAPÍTULO CONCLUÍDO' : locked ? 'AINDA POR DESCOBRIR' : 'EM ANDAMENTO'}</span><h3>${esc(q.title)}</h3><p>${esc(q.description)}</p><div class="journal-progress"><div><i style="width:${progress / q.target * 100}%"></i></div><span>${progress} / ${q.target}</span></div></div><aside><span>${icon('coin')} ${q.reward.coins}</span><span>${icon('star')} ${q.reward.xp} EXP</span></aside></article>`; }).join('')}</div>`;
  }

  private mapPanel() {
    return `<div class="map-intro"><span class="live-dot"></span>Você está em <b>${esc(this.info.region)}</b><small>Explore livremente. Nem todas as terras são seguras.</small></div><div class="world-map-frame"><canvas width="880" height="540" class="world-map"></canvas><span class="map-north">N<span>↑</span></span><span class="map-corner top-left"></span><span class="map-corner bottom-right"></span></div><div class="map-legend"><span><i class="legend-player"></i>Você</span><span><i class="legend-safe"></i>Terras tranquilas</span><span><i class="legend-danger"></i>Terras perigosas</span><span><i class="legend-water"></i>Água</span></div>`;
  }

  private settings() {
    const s = this.model.state.settings;
    return `<div class="settings-section"><span class="section-label">ÁUDIO E AMBIENTE</span><label class="setting-row"><span><strong>Efeitos sonoros</strong><small>Passos, combate, coleta e sons da interface.</small></span><input type="checkbox" data-setting="sound" ${s.sound ? 'checked' : ''}><i class="toggle"></i></label><label class="setting-row"><span><strong>Música de ambiente</strong><small>Uma trilha original para acompanhar sua jornada.</small></span><input type="checkbox" data-setting="music" ${s.music ? 'checked' : ''}><i class="toggle"></i></label><label class="setting-row"><span><strong>Volume geral</strong><small>Encontre o equilíbrio para sua aventura.</small></span><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-setting="volume" aria-label="Volume geral"></label><span class="section-label settings-label">JOGABILIDADE</span><label class="setting-row"><span><strong>Dicas de controles</strong><small>Exibir atalhos de teclado durante a exploração.</small></span><input type="checkbox" data-setting="showHints" ${s.showHints ? 'checked' : ''}><i class="toggle"></i></label></div><div class="controls-reference"><h3>O mundo nas suas mãos</h3><div>${[['WASD', 'Movimentar'], ['Shift', 'Correr'], ['Espaço', 'Esquivar'], ['E', 'Interagir'], ['Clique', 'Atacar ou coletar'], ['Direito', 'Ação secundária'], ['1–9', 'Barra rápida'], ['I', 'Inventário'], ['C', 'Fabricação'], ['B', 'Construção'], ['M', 'Mapa'], ['Esc', 'Pausar / voltar']].map(([key, label]) => `<span><kbd>${key}</kbd>${label}</span>`).join('')}</div></div><div class="settings-save"><p>Seu progresso é salvo neste navegador.<br><small>O salvamento automático mantém sua jornada segura.</small></p><button class="primary-btn" data-action="save">${icon('save')} Salvar agora</button></div>`;
  }

  private npcPanel() {
    if (!this.npc) return '';
    const n = this.npc;
    return `<div class="npc-dialogue"><span class="npc-portrait" style="background-image:url('/assets/${n.sprite.replace(/-/g, '_')}.png')"></span><div><span class="eyebrow">${esc(n.role)}</span><blockquote>“${esc(n.dialogue[this.dialogueIndex] || 'Seja bem-vindo ao vale, aventureiro.')}”</blockquote>${n.dialogue.length > 1 ? '<button class="text-btn dialogue-next" data-action="next-dialogue">Continuar conversa →</button>' : ''}</div></div>${n.stock.length ? `<div class="section-label">À VENDA <span>Seu saldo: ${this.model.state.coins} moedas</span></div><div class="shop-grid">${n.stock.map(id => { const item = ITEMS[id], price = item.value; return `<div class="shop-item">${image(id)}<div><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small><span>${icon('coin')} ${price}</span></div><button class="secondary-btn" data-buy="${id}" ${this.model.state.coins >= price ? '' : 'disabled'}>Comprar</button></div>`; }).join('')}</div><div class="section-label sell-label">VENDER DA MOCHILA <span>Uma unidade por clique</span></div><div class="sell-grid">${this.model.state.inventory.map((stack, index) => stack && ITEMS[stack.item].value > 0 ? `<button class="sell-item" data-sell="${index}" title="Vender ${esc(ITEMS[stack.item].name)} por ${Math.max(1, Math.floor(ITEMS[stack.item].value * .45))} moedas">${image(stack.item)}<span>${esc(ITEMS[stack.item].name)} <small>×${stack.qty}</small></span><b>${Math.max(1, Math.floor(ITEMS[stack.item].value * .45))} ${icon('coin')}</b></button>` : '').join('') || '<p class="quiet-note">Você ainda não tem itens para vender.</p>'}</div>` : '<p class="panel-intro">Continue explorando e construindo sua história. Os habitantes acompanham os seus feitos.</p>'}`;
  }

  private storagePanel() {
    if (!this.storage) return '';
    return `<p class="panel-intro">Um lugar seguro para suas descobertas. Clique em um item para transferir uma pilha.</p><div class="storage-layout"><div><div class="section-label">SUA MOCHILA</div><div class="inventory-grid">${this.model.state.inventory.map((stack, i) => `<button class="inventory-slot" data-transfer="${i}" data-to-storage="true" title="${stack ? `Guardar ${esc(ITEMS[stack.item].name)}` : 'Vazio'}">${stack ? `${image(stack.item)}<span class="stack-count">${stack.qty}</span>` : '<span class="empty-slot-mark">·</span>'}</button>`).join('')}</div></div><span class="storage-arrow">⇄</span><div><div class="section-label">BAÚ</div><div class="inventory-grid">${(this.storage.storage || Array(18).fill(null)).map((stack, i) => `<button class="inventory-slot" data-transfer="${i}" data-to-storage="false" title="${stack ? `Retirar ${esc(ITEMS[stack.item].name)}` : 'Vazio'}">${stack ? `${image(stack.item)}<span class="stack-count">${stack.qty}</span>` : '<span class="empty-slot-mark">·</span>'}</button>`).join('')}</div></div></div>`;
  }

  private pausePanel() {
    return `<div class="pause-content"><span class="story-ornament">◇</span><h3>O mundo pode esperar.</h3><p>Sua próxima aventura continua logo ali.</p><button class="primary-btn" data-action="close">Continuar explorando ${icon('arrow')}</button><button class="secondary-btn" data-action="save">${icon('save')} Salvar jornada</button><button class="text-btn" data-action="title">Salvar e voltar ao início</button><small>Seu progresso permanece neste navegador.</small></div>`;
  }

  private click(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button, a[data-action], .modal-shade[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    e.preventDefault();
    if (el.dataset.panel) { this.open(el.dataset.panel); return; }
    if (el.dataset.select !== undefined) { this.callbacks.select(Number(el.dataset.select)); this.renderHUD(); return; }
    if (el.dataset.slot !== undefined) { this.selected = Number(el.dataset.slot); this.renderPanel(); return; }
    if (el.dataset.recipe) { this.selectedRecipe = el.dataset.recipe; this.renderPanel(); return; }
    if (el.dataset.craft) { this.callbacks.craft(el.dataset.craft); this.renderPanel(); return; }
    if (el.dataset.build) { this.callbacks.build(el.dataset.build); this.close(); return; }
    if (el.dataset.unequip) { this.report(this.model.unequip(el.dataset.unequip as EquipmentSlot)); return; }
    if (el.dataset.buy) { this.report(this.model.buy(el.dataset.buy)); return; }
    if (el.dataset.sell !== undefined) { this.report(this.model.sell(Number(el.dataset.sell))); return; }
    if (el.dataset.transfer !== undefined) { this.callbacks.transfer(Number(el.dataset.transfer), el.dataset.toStorage === 'true'); this.renderPanel(); return; }
    if (el.dataset.assign !== undefined) {
      const stack = this.model.state.inventory[this.selected]; if (!stack) return;
      this.model.state.hotbar[Number(el.dataset.assign)] = stack.item; this.renderHUD(); this.toast(`${ITEMS[stack.item].name} atribuído ao atalho ${Number(el.dataset.assign) + 1}.`); return;
    }
    const action = el.dataset.action;
    if (action === 'close') this.close();
    else if (action === 'pause') this.open('pause');
    else if (action === 'save') { this.callbacks.save(); }
    else if (action === 'start' || action === 'continue') {
      this.panel = null; this.modal.hidden = true; this.root.classList.remove('menu-open'); this.callbacks.start(action === 'start'); this.callbacks.pause(false); this.renderHUD();
    }
    else if (action === 'fresh-confirm') { this.freshConfirm = true; this.renderTitle(); }
    else if (action === 'cancel-fresh') { this.freshConfirm = false; this.renderTitle(); }
    else if (action === 'respawn') { this.panel = null; this.modal.hidden = true; this.root.classList.remove('menu-open'); this.callbacks.respawn(); this.callbacks.pause(false); this.renderHUD(); }
    else if (action === 'equip') this.report(this.model.equip(this.selected));
    else if (action === 'consume') this.report(this.model.consume(this.selected));
    else if (action === 'discard') this.report(this.model.discard(this.selected));
    else if (action === 'sell') this.report(this.model.sell(this.selected));
    else if (action === 'interact') this.callbacks.interact();
    else if (action === 'next-dialogue' && this.npc) { this.dialogueIndex = (this.dialogueIndex + 1) % this.npc.dialogue.length; this.renderPanel(); }
    else if (action === 'remove-build') { this.callbacks.removeBuild(); this.close(); }
    else if (action === 'title') { this.callbacks.save(); this.showTitle(true); }
  }

  private change(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.dataset.action === 'craft-filter') { this.craftingFilter = el.value as Station | 'all'; this.renderPanel(); return; }
    const setting = el.dataset.setting as keyof typeof this.model.state.settings | undefined;
    if (!setting) return;
    if (setting === 'volume') this.model.state.settings.volume = Number(el.value);
    else this.model.state.settings[setting] = el.checked;
    this.callbacks.sound(); this.renderHUD(); this.callbacks.save();
  }

  private report(result: { ok: boolean; message: string } | void) { if (result?.message) this.toast(result.message); this.renderHUD(); this.renderPanel(); }

  private drawMap(canvas: HTMLCanvasElement | null, large: boolean) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    if (!this.mapBase) {
      const world = new WorldMap();
      this.mapBase = document.createElement('canvas');
      this.mapBase.width = world.width * 4; this.mapBase.height = world.height * 4;
      const map = this.mapBase.getContext('2d')!;
      const colors = ['#597447', '#647c4d', '#b19b6b', '#938971', '#2d6267', '#738263', '#345d3d', '#616465', '#55574d', '#817444'];
      for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) {
        map.fillStyle = colors[world.terrain[y][x]] || colors[0];
        map.fillRect(x * 4, y * 4, 4, 4);
      }
      for (const node of world.nodes) {
        if (node.type !== 'tree') continue;
        const x = node.x / 8, y = node.y / 8;
        map.fillStyle = '#284934'; map.fillRect(x - 2, y - 3, 4, 4);
        map.fillStyle = '#456d42'; map.fillRect(x - 1, y - 4, 3, 3);
      }
      for (const b of world.buildings) {
        const x = b.x / 8, y = b.y / 8, bw = b.width / 8;
        map.fillStyle = '#d3b98a'; map.fillRect(x - bw / 2, y - 5, bw, 5);
        map.fillStyle = '#965d43'; map.fillRect(x - bw / 2 - 1, y - 9, bw + 2, 5);
        map.fillStyle = '#c19960'; map.fillRect(x - bw / 2, y - 9, 1, 5);
      }
      map.strokeStyle = '#b6ad7f44'; map.strokeRect(.5, .5, this.mapBase.width - 1, this.mapBase.height - 1);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapBase, 0, 0, w, h);
    for (const structure of this.model.state.structures) {
      ctx.fillStyle = '#d4bf88';
      ctx.fillRect(structure.x * 32 / WORLD_WIDTH * w, structure.y * 32 / WORLD_HEIGHT * h, large ? 5 : 2, large ? 5 : 2);
    }
    if (large) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 17px Georgia'; ctx.shadowColor = '#16291c'; ctx.shadowBlur = 7;
      ctx.lineWidth = 4; ctx.strokeStyle = '#203523aa'; ctx.fillStyle = '#f1e8c5';
      const labels: [string, number, number][] = [
        ['VALE DO AMANHECER', .36, .9], ['VILA PEDRA ALTA', .44, .2],
        ['FLORESTA DOS', .2, .15], ['SUSSURROS', .2, .2],
        ['MINAS DE FERRO', .84, .08], ['RUÍNAS ESQUECIDAS', .83, .9],
      ];
      for (const [text, x, y] of labels) { ctx.strokeText(text, x * w, y * h); ctx.fillText(text, x * w, y * h); }
      ctx.shadowBlur = 0;
    }
    const px = Math.max(.02, Math.min(.98, this.info.x / WORLD_WIDTH)), py = Math.max(.02, Math.min(.98, this.info.y / WORLD_HEIGHT));
    ctx.strokeStyle = '#f4d891'; ctx.fillStyle = '#f4d891'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(px * w, py * h, large ? 10 : 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff4c9'; ctx.beginPath(); ctx.arc(px * w, py * h, large ? 4 : 2, 0, Math.PI * 2); ctx.fill();
    if (large) {
      ctx.font = '10px Arial'; ctx.fillStyle = '#fff1c3'; ctx.textAlign = 'center';
      ctx.fillText('VOCÊ', px * w, py * h - 18);
    }
    ctx.strokeStyle = '#bca36c66'; ctx.lineWidth = 1; ctx.strokeRect(.5, .5, w - 1, h - 1);
  }
}
