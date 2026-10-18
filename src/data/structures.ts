import type { StructureDef } from '../types';

const definitions: StructureDef[] = [
  { id: 'workbench', item: 'workbench', name: 'Bancada de trabalho', width: 2, height: 1, solid: true, station: 'workbench', description: 'Ferramentas, armas simples e novas estações.' },
  { id: 'furnace', item: 'furnace', name: 'Fornalha', width: 1, height: 1, solid: true, station: 'furnace', description: 'Funda minérios em barras usando madeira.' },
  { id: 'forge', item: 'forge', name: 'Forja', width: 2, height: 1, solid: true, station: 'forge', description: 'Armas e armaduras de cobre e ferro.' },
  { id: 'alchemy', item: 'alchemy', name: 'Mesa de alquimia', width: 2, height: 1, solid: true, station: 'alchemy', description: 'Poções e equipamentos mágicos.' },
  { id: 'carpentry', item: 'carpentry', name: 'Bancada de carpintaria', width: 2, height: 1, solid: true, station: 'carpentry', description: 'Cabanas, casas e cercados.' },
  { id: 'chest', item: 'chest', name: 'Baú de madeira', width: 1, height: 1, solid: true, description: 'Guarda dezoito pilhas de itens em segurança.' },
  { id: 'fence', item: 'fence', name: 'Cerca', width: 1, height: 1, solid: true, description: 'Delimita o assentamento.' },
  { id: 'wall', item: 'wall', name: 'Muro de pedra', width: 1, height: 1, solid: true, description: 'Um obstáculo de pedra resistente.' },
  { id: 'gate', item: 'gate', name: 'Portão', width: 1, height: 1, solid: false, description: 'Passagem aberta para sua base.' },
  { id: 'torch', item: 'torch', name: 'Tocha', width: 1, height: 1, solid: false, description: 'Ilumina os arredores durante a noite.' },
  { id: 'garden', item: 'garden', name: 'Canteiro', width: 2, height: 2, solid: false, description: 'Produz ervas ao longo do tempo.' },
  { id: 'cabin', item: 'cabin', name: 'Pequena cabana', width: 3, height: 3, solid: true, description: 'Seu primeiro abrigo no vale.' },
  { id: 'house', item: 'house', name: 'Casa medieval', width: 5, height: 4, solid: true, description: 'Uma grande residência para o assentamento.' },
  { id: 'animal_pen', item: 'animal_pen', name: 'Cercado de animais', width: 3, height: 3, solid: true, description: 'Um cercado preparado para criação futura.' },
];
export const STRUCTURES: Record<string, StructureDef> = Object.fromEntries(definitions.map(entry => [entry.id, entry]));
