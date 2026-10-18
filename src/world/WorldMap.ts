import type { Building, PlacedStructure, Region, ResourceNode, StructureDef } from '../types';
import { STRUCTURES } from '../data/structures';

export const TILE = 32;
export const WORLD_WIDTH = 112 * TILE;
export const WORLD_HEIGHT = 88 * TILE;
export const START = { x: 1120, y: 1728 };

/** Region rectangles are in world pixels; the map remains one continuous space. */
export const REGIONS: Region[] = [
  { id: 'valley', name: 'Vale do Amanhecer', subtitle: 'Um novo começo, entre campos e rios.', color: '#92b769', x: 0, y: 43 * TILE, width: 76 * TILE, height: 45 * TILE, danger: 1 },
  { id: 'village', name: 'Vila Pedra Alta', subtitle: 'A forja acesa e histórias à espera.', color: '#d8b879', x: 34 * TILE, y: 20 * TILE, width: 31 * TILE, height: 27 * TILE, danger: 0 },
  { id: 'forest', name: 'Floresta dos Sussurros', subtitle: 'Sob as folhas, algo desperta.', color: '#447955', x: 0, y: 0, width: 44 * TILE, height: 43 * TILE, danger: 2 },
  { id: 'mine', name: 'Minas de Ferro', subtitle: 'Riquezas antigas nas entranhas da montanha.', color: '#8c91ac', x: 76 * TILE, y: 0, width: 36 * TILE, height: 37 * TILE, danger: 3 },
  { id: 'ruins', name: 'Ruínas Esquecidas', subtitle: 'O guardião ainda cumpre seu juramento.', color: '#ab8fbd', x: 76 * TILE, y: 47 * TILE, width: 36 * TILE, height: 41 * TILE, danger: 4 },
];

export type Decoration = { x: number; y: number; texture: string; scale?: number; flip?: boolean };
export type EnemySpawn = { id: string; type: string; x: number; y: number };
export type ChestSpawn = { id: string; x: number; y: number; items: Record<string, number>; coins: number };

type Rect = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Small, deterministic generator: saves refer to stable node and enemy IDs. */
class Random {
  constructor(private state = 0x4f657272) {}
  next() {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  int(min: number, max: number) { return Math.floor(this.next() * (max - min + 1)) + min; }
}

export class WorldMap {
  readonly width = 112;
  readonly height = 88;
  terrain: number[][] = [];
  nodes: ResourceNode[] = [];
  buildings: Building[] = [];
  decorations: Decoration[] = [];
  enemySpawns: EnemySpawn[] = [];
  chests: ChestSpawn[] = [];
  private random = new Random();

  constructor() {
    this.makeTerrain();
    this.makeSettlement();
    this.makeResources();
    this.makeInhabitants();
    this.makeDetails();
  }

  regionAt(x: number, y: number): Region {
    const tx = x / TILE, ty = y / TILE;
    if (tx >= 76 && ty < 37) return REGIONS[3];
    if (tx >= 76 && ty >= 47) return REGIONS[4];
    if (tx >= 34 && tx < 65 && ty >= 20 && ty < 47) return REGIONS[1];
    if (tx < 44 && ty < 43) return REGIONS[2];
    return REGIONS[0];
  }

  tileAt(tx: number, ty: number) { return this.terrain[ty]?.[tx] ?? 4; }

  isTerrainBlocked(x: number, y: number): boolean {
    return x < TILE || y < TILE || x >= WORLD_WIDTH - TILE || y >= WORLD_HEIGHT - TILE || this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 4;
  }

  /** Buildings use a bottom-center anchor and a shallow, visible ground footprint. */
  isStaticBlocked(x: number, y: number, radius = 10): boolean {
    for (const [dx, dy] of [[0, 0], [-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
      if (this.isTerrainBlocked(x + dx, y + dy)) return true;
    }
    return this.buildings.some(building => {
      const closestX = Math.max(building.x - building.width / 2, Math.min(x, building.x + building.width / 2));
      const closestY = Math.max(building.y - building.height, Math.min(y, building.y));
      return Math.hypot(x - closestX, y - closestY) < radius ||
        (x >= building.x - building.width / 2 && x <= building.x + building.width / 2 && y >= building.y - building.height && y <= building.y);
    });
  }

  canPlace(def: StructureDef, tx: number, ty: number, nodes: ResourceNode[], structures: PlacedStructure[], depleted: Set<string>): boolean {
    if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 1 || ty < 1 || tx + def.width >= this.width || ty + def.height >= this.height) return false;
    const area: Rect = { left: tx * TILE, top: ty * TILE, right: (tx + def.width) * TILE, bottom: (ty + def.height) * TILE };
    for (let y = ty; y < ty + def.height; y++) {
      for (let x = tx; x < tx + def.width; x++) {
        if (this.tileAt(x, y) === 4) return false;
      }
    }
    if (this.buildings.some(b => overlaps(area, { left: b.x - b.width / 2, right: b.x + b.width / 2, top: b.y - b.height, bottom: b.y }))) return false;
    if (this.chests.some(chest => overlaps(area, { left: chest.x - 20, right: chest.x + 20, top: chest.y - 20, bottom: chest.y + 8 }))) return false;
    // Plants may be walked over, but building over a living resource would hide it.
    if (nodes.some(node => !depleted.has(node.id) && overlaps(area, this.nodeFootprint(node)))) return false;
    return !structures.some(structure => {
      const existing = STRUCTURES[structure.type];
      if (!existing) return true;
      return overlaps(area, { left: structure.x * TILE, top: structure.y * TILE, right: (structure.x + existing.width) * TILE, bottom: (structure.y + existing.height) * TILE });
    });
  }

  private nodeFootprint(node: ResourceNode): Rect {
    const radius = node.type === 'tree' ? 15 : node.type === 'ore' || node.type === 'rock' ? 17 : 10;
    return { left: node.x - radius, right: node.x + radius, top: node.y - radius, bottom: node.y + radius };
  }

  private makeTerrain() {
    for (let y = 0; y < this.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.width; x++) {
        let tile = this.random.next() < .15 ? 1 : 0;
        if (x < 44 + Math.sin(y / 5) * 3 && y < 41 + Math.cos(x / 7) * 2) tile = this.random.next() < .72 ? 6 : tile;
        if (x >= 78 && y < 36) tile = this.random.next() < .9 ? 7 : 3;
        if (x >= 78 && y >= 49) tile = this.random.next() < .65 ? 8 : 6;
        const lake = ((x - 20) / 11.5) ** 2 + ((y - 67) / 8) ** 2;
        if (lake < 1.18 + Math.sin(x * .83 + y * .57) * .08) tile = 5;
        if (lake < .96 + Math.sin(x * .83 + y * .57) * .09) tile = 4;
        const riverX = 68 + Math.sin(y / 10) * 2;
        if (Math.abs(x - riverX) < 2.8) tile = 5;
        if (Math.abs(x - riverX) < 1.9) tile = 4;
        row.push(tile);
      }
      this.terrain.push(row);
    }
    this.path([[35, 54], [36, 46], [44, 40], [48, 35]], 2, 2);
    this.path([[44, 40], [30, 37], [25, 24], [21, 12]], 2, 1);
    this.path([[48, 35], [61, 40], [72, 40], [82, 29], [94, 17]], 3, 1);
    this.path([[35, 54], [53, 60], [64, 64], [75, 64], [85, 65], [94, 65]], 2, 1);
    this.path([[35, 54], [32, 62], [32, 73], [41, 77], [53, 73], [53, 60]], 2, 1);
    // A broad plaza leaves room to move around buildings and NPCs.
    for (let y = 25; y < 43; y++) for (let x = 37; x < 60; x++) {
      if (((x - 48) / 11) ** 2 + ((y - 34) / 8) ** 2 < 1) this.terrain[y][x] = 3;
    }
    this.path([[48, 23], [48, 46]], 3, 1);
    this.path([[36, 35], [62, 35]], 3, 1);
    for (const y of [40, 64]) {
      for (let by = y - 1; by <= y + 1; by++) for (let x = 63; x <= 73; x++) this.terrain[by][x] = 2;
      this.decorations.push({ x: (68 + Math.sin(y / 10) * 2) * TILE + 16, y: (y + 2) * TILE, texture: 'bridge' });
    }
    // The homestead clearing and a little working garden.
    for (let y = 50; y <= 56; y++) for (let x = 30; x <= 38; x++) {
      if (this.terrain[y][x] !== 2) this.terrain[y][x] = this.random.next() < .15 ? 1 : 0;
    }
    for (let y = 54; y <= 57; y++) for (let x = 27; x <= 30; x++) this.terrain[y][x] = 9;
    // Existing stone remnants make the eastern destination recognisable.
    this.path([[83, 58], [94, 58], [94, 70], [83, 70], [83, 58]], 3, 0);
  }

  private path(points: number[][], tile: number, radius: number) {
    for (let p = 1; p < points.length; p++) {
      const [ax, ay] = points[p - 1], [bx, by] = points[p];
      const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 2;
      for (let i = 0; i <= steps; i++) {
        const cx = Math.round(ax + (bx - ax) * i / steps), cy = Math.round(ay + (by - ay) * i / steps);
        for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
          if (x > 0 && y > 0 && x < this.width - 1 && y < this.height - 1 && this.terrain[y][x] !== 4) this.terrain[y][x] = tile;
        }
      }
    }
  }

  private makeSettlement() {
    const add = (id: string, x: number, y: number, width: number, height: number, texture: string, name: string, station?: Building['station']) => {
      this.buildings.push({ id, x, y, width, height, texture, name, station });
    };
    add('player-home', 1024, 1664, 116, 34, 'home', 'Sua casa');
    add('village-smithy', 1760, 1020, 140, 40, 'smithy', 'Forja de Breno', 'forge');
    add('village-tavern', 1408, 896, 140, 42, 'tavern', 'Taverna do Javali');
    add('village-market', 1328, 1165, 90, 28, 'market', 'Mercado de Pedra Alta');
    add('village-cottage', 1888, 1310, 108, 34, 'home', 'Casa da curandeira');
    add('village-cottage-west', 1184, 1110, 108, 34, 'home', 'Casa do vale');
    add('village-well', 1536, 1088, 32, 18, 'well', 'Poço da praça');
    add('village-furnace', 1815, 1090, 40, 26, 'furnace', 'Fornalha da vila', 'furnace');
    add('village-alchemy', 1850, 1180, 40, 22, 'alchemy', 'Mesa de alquimia', 'alchemy');
    add('village-carpentry', 1280, 1320, 56, 24, 'carpentry', 'Bancada do carpinteiro', 'carpentry');
    add('mine-entrance', 3008, 512, 110, 40, 'mine_entrance', 'Entrada das Minas de Ferro');
    add('ruin-entrance', 2736, 1770, 124, 30, 'ruin_arch', 'Arco dos antigos');
    // Small patches of worn earth make stations part of the landscape.
    for (const building of this.buildings) {
      if (this.regionAt(building.x, building.y).id !== 'valley') continue;
      const tx = Math.floor(building.x / TILE), ty = Math.floor(building.y / TILE);
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 2; x <= tx + 2; x++) this.terrain[y][x] = 2;
    }
  }

  private makeResources() {
    const add = (type: ResourceNode['type'], item: string, tx: number, ty: number, texture: string, tier = 1) => {
      this.nodes.push({ id: `resource-${this.nodes.length}`, type, item, x: tx * TILE + 16, y: ty * TILE + 16, texture, hp: type === 'plant' || type === 'fish' ? 1 : type === 'ore' ? 4 : 3, tier, solid: type === 'tree' || type === 'rock' || type === 'ore' });
    };
    // Deliberately arranged introductory resources, never hidden behind a roof.
    for (const [x, y] of [[38, 55], [37, 58], [30, 59], [40, 51], [29, 50], [39, 59]]) add('tree', 'wood', x, y, 'tree_oak');
    for (const [x, y] of [[33, 58], [40, 57], [39, 52], [29, 60]]) add('rock', 'stone', x, y, 'rock');
    add('ore', 'copper_ore', 41, 55, 'copper_ore');
    add('plant', 'herb', 37, 56, 'herb');
    add('plant', 'berry', 32, 57, 'berry');

    const reserved = [START, ...[
      [1632, 1024], [1410, 1110], [1790, 1175], [1550, 850], [1120, 1420], [1500, 1220],
    ].map(([x, y]) => ({ x, y }))];
    const free = (tx: number, ty: number, margin = 42) => {
      const x = tx * TILE + 16, y = ty * TILE + 16;
      const tile = this.tileAt(tx, ty);
      if (tile === 4 || tile === 2 || tile === 3 || tile === 9) return false;
      if (reserved.some(point => Math.hypot(x - point.x, y - point.y) < (point === START ? 155 : 85))) return false;
      if (this.buildings.some(b => x > b.x - b.width / 2 - 60 && x < b.x + b.width / 2 + 60 && y > b.y - 180 && y < b.y + 65)) return false;
      if (this.nodes.some(node => Math.hypot(node.x - x, node.y - y) < margin)) return false;
      return true;
    };
    const distribute = (count: number, bounds: number[], callback: (x: number, y: number) => void, margin = 46) => {
      let placed = 0;
      for (let attempt = 0; attempt < count * 60 && placed < count; attempt++) {
        const x = this.random.int(bounds[0], bounds[2]), y = this.random.int(bounds[1], bounds[3]);
        if (!free(x, y, margin)) continue;
        callback(x, y); placed++;
      }
    };
    distribute(170, [3, 4, 42, 41], (x, y) => {
      const old = this.random.next() > .82;
      add('tree', old ? 'hardwood' : 'wood', x, y, this.random.next() > .6 ? 'tree_pine' : 'tree_oak', old ? 2 : 1);
    }, 50);
    distribute(125, [3, 43, 63, 84], (x, y) => add('tree', 'wood', x, y, this.random.next() > .63 ? 'tree_birch' : 'tree_oak'), 58);
    distribute(35, [46, 4, 64, 25], (x, y) => add('tree', 'wood', x, y, 'tree_pine'), 51);
    distribute(22, [78, 49, 108, 83], (x, y) => add('tree', 'ancient_wood', x, y, 'tree_pine', 3), 64);
    distribute(22, [5, 42, 62, 83], (x, y) => add('rock', 'stone', x, y, 'rock'), 42);
    distribute(12, [8, 8, 44, 38], (x, y) => add('ore', 'copper_ore', x, y, 'copper_ore'), 44);
    distribute(35, [79, 5, 108, 34], (x, y) => {
      const n = this.random.next();
      const item = n < .52 ? 'iron_ore' : n < .75 ? 'silver_ore' : n < .9 ? 'gold_ore' : 'crystal';
      add('ore', item, x, y, item, item === 'iron_ore' ? 1 : 2);
    }, 52);
    distribute(12, [80, 51, 108, 83], (x, y) => {
      const item = this.random.next() > .5 ? 'crystal' : 'gold_ore';
      add('ore', item, x, y, item, 2);
    }, 48);
    const plants = ['herb', 'mushroom', 'flower', 'berry', 'fiber'];
    distribute(85, [4, 5, 63, 83], (x, y) => {
      const item = plants[this.random.int(0, plants.length - 1)];
      add('plant', item, x, y, item);
    }, 32);
    // Fish are interactable from the shore, rather than unreachable in deep water.
    for (const [x, y] of [[19, 59], [28, 63], [31, 68], [24, 74], [11, 67]]) {
      if (this.tileAt(x, y) === 4) add('fish', 'fish', x, y, 'lily');
    }
    // A first iron seam is visible just inside the mines, beside the marked road.
    if (free(80, 31)) add('ore', 'iron_ore', 80, 31, 'iron_ore', 1);
  }

  private makeInhabitants() {
    const groups: [string, number[][]][] = [
      ['slime', [[43, 58], [48, 63], [41, 66], [54, 53], [46, 72], [57, 68]]],
      ['wolf', [[19, 31], [33, 21], [16, 17], [39, 13]]],
      ['goblin', [[28, 16], [36, 29], [10, 29], [47, 15]]],
      ['spider', [[12, 12], [29, 9], [40, 34], [20, 39]]],
      ['skeleton', [[82, 27], [90, 23], [103, 15], [83, 57], [101, 72]]],
      ['archer', [[98, 10], [88, 10], [103, 60], [89, 75]]],
      ['golem', [[103, 29], [83, 12], [104, 80]]],
      ['guardian', [[94, 65]]],
    ];
    for (const [type, points] of groups) for (const [tx, ty] of points) {
      const x = tx * TILE + 16, y = ty * TILE + 16;
      // A spawn gets its own little clearing so a new creature cannot be trapped.
      this.nodes = this.nodes.filter(node => Math.hypot(node.x - x, node.y - y) > (type === 'guardian' ? 112 : 48));
      this.enemySpawns.push({ id: `${type}-${this.enemySpawns.filter(enemy => enemy.type === type).length}`, type, x, y });
    }
    this.chests = [
      { id: 'valley-cache', x: 1248, y: 1940, items: { wood: 3, herb: 2 }, coins: 12 },
      { id: 'forest-cache', x: 448, y: 720, items: { copper_ore: 4, herb: 3 }, coins: 28 },
      { id: 'mine-cache', x: 3296, y: 1100, items: { iron_ore: 6, crystal: 1 }, coins: 50 },
      { id: 'ruins-cache', x: 3296, y: 2390, items: { gold_ore: 3, crystal: 3 }, coins: 90 },
      { id: 'lakeside-cache', x: 1120, y: 2440, items: { stone: 4, mushroom: 3 }, coins: 18 },
    ];
    for (const chest of this.chests) this.nodes = this.nodes.filter(node => Math.hypot(node.x - chest.x, node.y - chest.y) > 44);
  }

  private makeDetails() {
    // Tiny flowers, tufts, fungi, and fallen branches are sparse on paths, lush elsewhere.
    for (let i = 0; i < 920; i++) {
      const x = this.random.int(48, WORLD_WIDTH - 48), y = this.random.int(48, WORLD_HEIGHT - 48);
      const tile = this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
      if (![0, 1, 6].includes(tile) || this.isStaticBlocked(x, y, 22)) continue;
      const n = this.random.next();
      this.decorations.push({ x, y, texture: n < .6 ? 'grass_tuft' : n < .92 ? 'flowers' : 'log', flip: this.random.next() > .5 });
    }
    for (const [x, y] of [[1104, 1632], [1280, 1440], [2016, 1312], [2400, 1280], [2480, 2048], [2750, 1770]]) this.decorations.push({ x, y, texture: 'sign' });
    for (const [x, y] of [[1000, 1700], [1440, 1184], [1600, 1184], [1680, 920], [1880, 1070], [2950, 540], [3065, 540], [2660, 1790], [2810, 1790], [2890, 2110], [3130, 2110]]) this.decorations.push({ x, y, texture: 'torch' });
    for (const [x, y] of [[17, 64], [22, 62], [24, 70], [15, 69], [19, 73]]) this.decorations.push({ x: x * TILE, y: y * TILE, texture: 'lily' });
  }
}
