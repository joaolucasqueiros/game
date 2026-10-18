import type { QuestDef } from '../types';

export const QUESTS: QuestDef[] = [
  { id: 'gather_supplies', title: 'Um novo começo', description: 'Colete 8 madeiras com o machado e 6 pedras com a picareta. Use o clique esquerdo perto de árvores e rochas.', metric: 'gather:basics', target: 1, reward: { coins: 15, xp: 25 } },
  { id: 'first_bench', title: 'As próprias mãos', description: 'Fabrique uma bancada em C e posicione-a com B. Sua base começa aqui.', metric: 'build:workbench', target: 1, reward: { coins: 20, xp: 25 }, requires: 'gather_supplies' },
  { id: 'first_weapon', title: 'Pronto para a estrada', description: 'Aproxime-se de uma bancada e fabrique sua primeira arma. Uma espada de madeira já serve.', metric: 'craft:weapon', target: 1, reward: { coins: 25, xp: 30 }, requires: 'first_bench' },
  { id: 'slime_hunt', title: 'A trilha verde', description: 'Derrote cinco slimes nas trilhas próximas ao vale. Esquive com Espaço e recupere vida com poções.', metric: 'kill:slime', target: 5, reward: { coins: 45, xp: 45 }, requires: 'first_weapon' },
  { id: 'village_smith', title: 'O ferreiro de Pedra Alta', description: 'Siga a estrada até a vila e converse com Breno, o ferreiro. Suas estações estão à disposição.', metric: 'talk:smith', target: 1, reward: { coins: 30, xp: 30 }, requires: 'slime_hunt' },
  { id: 'iron_discovery', title: 'Sob a montanha', description: 'Extraia ao menos 3 minérios de ferro nas Minas de Ferro. A picareta de pedra pode quebrá-los.', metric: 'gather:iron_ore', target: 3, reward: { coins: 40, xp: 40 }, requires: 'village_smith' },
  { id: 'iron_armor', title: 'Pele de ferro', description: 'Funda seu minério numa fornalha e fabrique uma peça de armadura na forja. Um elmo usa apenas 2 barras.', metric: 'craft:armor', target: 1, reward: { coins: 60, xp: 55 }, requires: 'iron_discovery' },
  { id: 'deep_mine', title: 'O chamado das profundezas', description: 'Explore as Minas de Ferro. Equipe sua armadura antes de enfrentar os habitantes das cavernas.', metric: 'visit:mine', target: 1, reward: { coins: 50, xp: 45 }, requires: 'iron_armor' },
  { id: 'guardian', title: 'Crônicas de Ferro', description: 'Encontre as Ruínas Esquecidas e derrote o Guardião. Prepare poções, uma espada de ferro e armadura.', metric: 'kill:guardian', target: 1, reward: { coins: 200, xp: 200 }, requires: 'deep_mine' },
];
