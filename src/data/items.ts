import type { ItemDef, Rarity } from '../types';

const all: ItemDef[] = [];
function resource(id: string, name: string, description: string, value: number, rarity: Rarity = 'common') {
  all.push({ id, name, description, kind: 'resource', rarity, stack: 99, value });
}
resource('wood', 'Madeira', 'Tábuas e galhos do vale. Base das primeiras ferramentas e construções.', 2);
resource('hardwood', 'Madeira resistente', 'Madeira densa dos carvalhos da floresta. Exige um machado de ferro.', 7, 'uncommon');
resource('ancient_wood', 'Madeira antiga', 'O cerne das árvores das ruínas ainda pulsa com magia.', 18, 'rare');
resource('stone', 'Pedra', 'Rocha comum, útil em fundações, fornalhas e ferramentas.', 2);
resource('copper_ore', 'Minério de cobre', 'Pode ser fundido em barras numa fornalha.', 4);
resource('iron_ore', 'Minério de ferro', 'A matéria-prima de armas e armaduras confiáveis.', 7, 'uncommon');
resource('silver_ore', 'Minério de prata', 'Minério brilhante encontrado nas profundezas.', 12, 'rare');
resource('gold_ore', 'Minério de ouro', 'Um metal precioso das galerias mais perigosas.', 20, 'rare');
resource('crystal', 'Cristal mágico', 'Energia ancestral cristalizada, usada em cajados e amuletos.', 16, 'rare');
resource('herb', 'Erva medicinal', 'Folhas aromáticas. Essencial para preparar poções de cura.', 3);
resource('mushroom', 'Cogumelo', 'Um cogumelo do bosque. Ingrediente de poções de energia.', 3);
resource('flower', 'Flor silvestre', 'Uma pequena flor de perfume delicado, apreciada pela curandeira.', 2);
resource('berry', 'Fruta silvestre', 'Fruta fresca do vale, usada para preparar tônicos.', 2);
resource('fish', 'Peixe', 'Peixe fresco dos rios e lagos. Cozinhe-o numa fornalha.', 6);
resource('raw_meat', 'Carne de caça', 'Carne obtida ao caçar animais selvagens. Asse-a numa fornalha antes de comer.', 8);
resource('fiber', 'Fibra vegetal', 'Fibras flexíveis para cordas, arcos e cercas.', 2);
resource('fang', 'Presa', 'Troféu de um predador selvagem, valorizado pelos caçadores.', 7);
resource('leather', 'Couro', 'Couro curtido para botas e componentes de armadura.', 6);
resource('bone', 'Osso', 'Um osso antigo. Artesãos e alquimistas ainda encontram utilidade nele.', 4);
resource('essence', 'Essência mágica', 'Uma centelha que permanece após a derrota de uma criatura.', 10, 'uncommon');
resource('core', 'Núcleo do Guardião', 'Fragmento único do poder que protege as Ruínas Esquecidas.', 100, 'epic');
resource('copper_bar', 'Barra de cobre', 'Cobre refinado, pronto para a forja.', 10);
resource('iron_bar', 'Barra de ferro', 'Metal refinado para equipamento durável.', 18, 'uncommon');
resource('silver_bar', 'Barra de prata', 'Prata refinada para equipamentos mágicos.', 30, 'rare');
resource('gold_bar', 'Barra de ouro', 'Ouro refinado, precioso e maleável.', 48, 'rare');

all.push(
  { id: 'fishing_rod', name: 'Vara de pesca', description: 'Lance perto da água. Quando o peixe morder, pressione E dentro da janela de fisgada.', kind: 'tool', rarity: 'common', stack: 1, value: 14, slot: 'weapon', tool: 'rod', tier: 1, damage: 1, range: 130, cooldown: 700 },
  { id: 'cooked_meat', name: 'Carne assada', description: 'Uma refeição de caça. Restaura 40 de vida e 55 de energia.', kind: 'consumable', rarity: 'common', stack: 20, value: 16, heal: 40, energy: 55 },
  { id: 'wood_sword', name: 'Espada de madeira', description: 'Uma lâmina de treino. Rápida, mas pouco eficaz contra armaduras.', kind: 'weapon', rarity: 'common', stack: 1, value: 12, slot: 'weapon', weaponType: 'sword', damage: 8, range: 54, cooldown: 420, tier: 1 },
  { id: 'copper_sword', name: 'Espada de cobre', description: 'Uma lâmina forjada no vale. Um avanço importante para o aventureiro.', kind: 'weapon', rarity: 'uncommon', stack: 1, value: 40, slot: 'weapon', weaponType: 'sword', damage: 15, range: 58, cooldown: 380, tier: 1 },
  { id: 'iron_sword', name: 'Espada de ferro', description: 'Fio equilibrado e aço resistente para enfrentar os perigos das minas.', kind: 'weapon', rarity: 'rare', stack: 1, value: 85, slot: 'weapon', weaponType: 'sword', damage: 24, range: 62, cooldown: 360, tier: 2 },
  { id: 'ancient_blade', name: 'Lâmina do Amanhecer', description: 'A espada do Guardião. Seu brilho atravessa a noite das ruínas.', kind: 'weapon', rarity: 'legendary', stack: 1, value: 400, slot: 'weapon', weaponType: 'sword', damage: 42, range: 76, cooldown: 320, tier: 3 },
  { id: 'wood_axe', name: 'Machado de madeira', description: 'Cabo de madeira e lâmina de pedra. Corta árvores jovens; também serve como arma.', kind: 'tool', rarity: 'common', stack: 1, value: 10, slot: 'weapon', weaponType: 'axe', damage: 10, range: 56, cooldown: 650, tool: 'axe', tier: 1 },
  { id: 'iron_axe', name: 'Machado de ferro', description: 'Abate árvores resistentes e atinge vários inimigos com golpes pesados.', kind: 'tool', rarity: 'uncommon', stack: 1, value: 70, slot: 'weapon', weaponType: 'axe', damage: 30, range: 68, cooldown: 700, tool: 'axe', tier: 3 },
  { id: 'stone_pickaxe', name: 'Picareta de pedra', description: 'Quebra rochas, cobre e ferro. Veios mais duros exigem uma picareta melhor.', kind: 'tool', rarity: 'common', stack: 1, value: 12, slot: 'weapon', damage: 5, range: 54, cooldown: 600, tool: 'pickaxe', tier: 1 },
  { id: 'iron_pickaxe', name: 'Picareta de ferro', description: 'Extrai prata, ouro e cristais das paredes das minas.', kind: 'tool', rarity: 'uncommon', stack: 1, value: 65, slot: 'weapon', damage: 12, range: 58, cooldown: 450, tool: 'pickaxe', tier: 3 },
  { id: 'spear', name: 'Lança do vale', description: 'Ataques frontais de grande alcance. Mantenha os monstros à distância.', kind: 'weapon', rarity: 'uncommon', stack: 1, value: 45, slot: 'weapon', weaponType: 'spear', damage: 18, range: 100, cooldown: 580, tier: 1 },
  { id: 'hunting_bow', name: 'Arco de caça', description: 'Arco de madeira e fibra. Cada disparo consome uma flecha do inventário.', kind: 'weapon', rarity: 'uncommon', stack: 1, value: 35, slot: 'weapon', weaponType: 'bow', damage: 16, range: 390, cooldown: 550, tier: 1 },
  { id: 'staff', name: 'Cajado de cristal', description: 'Canaliza projéteis mágicos. Cada disparo consome mana.', kind: 'weapon', rarity: 'rare', stack: 1, value: 100, slot: 'weapon', weaponType: 'staff', damage: 25, range: 420, cooldown: 650, tier: 2 },
  { id: 'arrow', name: 'Flecha', description: 'Munição para o arco de caça. A fabricação produz seis por vez.', kind: 'ammo', rarity: 'common', stack: 99, value: 1 },
  { id: 'wood_shield', name: 'Escudo de madeira', description: 'Proteção leve. Segure o botão direito para bloquear golpes frontais.', kind: 'armor', rarity: 'common', stack: 1, value: 18, slot: 'shield', defense: 3, tier: 1 },
  { id: 'iron_shield', name: 'Escudo de ferro', description: 'Escudo reforçado que absorve o impacto de golpes pesados.', kind: 'armor', rarity: 'uncommon', stack: 1, value: 65, slot: 'shield', defense: 7, tier: 2 },
  { id: 'iron_helmet', name: 'Elmo de ferro', description: 'Um elmo forjado à medida. Aumenta sua defesa contra todas as criaturas.', kind: 'armor', rarity: 'uncommon', stack: 1, value: 45, slot: 'head', defense: 4, tier: 1 },
  { id: 'iron_chest', name: 'Peitoral de ferro', description: 'Armadura de placas sólida para explorar as ruínas com segurança.', kind: 'armor', rarity: 'rare', stack: 1, value: 95, slot: 'chest', defense: 8, tier: 2 },
  { id: 'iron_legs', name: 'Grevas de ferro', description: 'Placas articuladas que protegem as pernas sem impedir a esquiva.', kind: 'armor', rarity: 'uncommon', stack: 1, value: 55, slot: 'legs', defense: 5, tier: 1 },
  { id: 'leather_boots', name: 'Botas de couro', description: 'Botas macias para longas jornadas pelas trilhas do vale.', kind: 'armor', rarity: 'common', stack: 1, value: 25, slot: 'boots', defense: 2, tier: 1 },
  { id: 'amulet', name: 'Amuleto do bosque', description: 'Um cristal envolto em prata. Sua magia protege o viajante.', kind: 'armor', rarity: 'epic', stack: 1, value: 130, slot: 'accessory', defense: 6, tier: 2 },
  { id: 'health_potion', name: 'Poção de cura', description: 'Restaura 55 pontos de vida. Não é consumida quando a vida está cheia.', kind: 'consumable', rarity: 'common', stack: 20, value: 12, heal: 55 },
  { id: 'energy_potion', name: 'Poção de vigor', description: 'Restaura 65 de energia e 25 de mana.', kind: 'consumable', rarity: 'uncommon', stack: 20, value: 12, energy: 65, mana: 25 },
  { id: 'cooked_fish', name: 'Peixe assado', description: 'Uma refeição quente. Restaura 25 de vida e 40 de energia.', kind: 'consumable', rarity: 'common', stack: 20, value: 14, heal: 25, energy: 40 },
);

const structures: [string, string, string, number][] = [
  ['workbench', 'Bancada de trabalho', 'Posicione no mundo para fabricar ferramentas e estações.', 20],
  ['furnace', 'Fornalha', 'Funde minérios e prepara comida. Deve ser posicionada no chão.', 30],
  ['forge', 'Forja', 'Permite fabricar armas e armaduras de metal.', 50],
  ['alchemy', 'Mesa de alquimia', 'Transforma ervas e cogumelos em poções.', 40],
  ['carpentry', 'Bancada de carpintaria', 'Prepara estruturas maiores para desenvolver seu assentamento.', 35],
  ['chest', 'Baú de madeira', 'Armazena até dezoito pilhas de itens. Interaja para abrir.', 18],
  ['fence', 'Cerca de madeira', 'Demarca sua base e impede a passagem de criaturas.', 5],
  ['wall', 'Muro de pedra', 'Uma parede robusta para proteger seu assentamento.', 9],
  ['gate', 'Portão', 'Uma passagem de madeira para as cercas do assentamento.', 9],
  ['torch', 'Tocha', 'Ilumina os caminhos à noite com uma chama acolhedora.', 5],
  ['garden', 'Canteiro', 'Um pequeno cultivo. Produz ervas ao longo do tempo.', 15],
  ['cabin', 'Pequena cabana', 'Um abrigo de madeira de três por três quadrados.', 65],
  ['house', 'Casa medieval', 'Uma residência espaçosa para o coração do seu assentamento.', 120],
  ['animal_pen', 'Cercado de animais', 'Um cercado rústico para a criação futura de animais.', 40],
];
for (const [id, name, description, value] of structures) all.push({ id, name, description, value, kind: 'structure', rarity: 'common', stack: 20, structure: id });

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(all.map(item => [item.id, item]));
