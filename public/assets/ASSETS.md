# Arte original — Crônicas de Ferro

Todos os PNGs desta pasta foram desenhados programaticamente para este projeto por
`scripts/generate_assets.py`, com Python 3 e Pillow. Não há recursos baixados,
sprites de terceiros, personagens de outros jogos, emojis ou fontes externas.
O script é determinístico: `python scripts/generate_assets.py` recria os mesmos
arquivos. Use renderização sem suavização (`pixelArt: true`, nearest-neighbor).

As figuras têm contornos em verde carvão, luz no canto superior esquerdo,
sombras translúcidas no chão e uma paleta comum de musgo, couro, pedra e cobre.
Os dois arquivos `*-preview.png` são apenas catálogos para inspeção visual.

## Atlas

| Arquivo | Dimensão | Organização |
| --- | --- | --- |
| `terrain.png` | 320 × 32 | 10 tiles de 32 × 32, uma linha |
| `path_edges.png`, `shore_edges.png`, `water_edges.png` | 512 × 32 | 16 sobreposições de borda de 32 × 32 |
| `player.png` | 384 × 256 | 8 colunas × 4 linhas; frames de 48 × 64 |
| `npc_*.png` | 384 × 256 | Mesma organização do jogador |
| `armor_chest.png` | 384 × 256 | Camada de peitoral alinhada ao jogador |
| `armor_helmet.png` | 384 × 256 | Camada de capacete alinhada ao jogador |
| `enemy_*.png` | 192 × 64 | 4 colunas de 48 × 64; uma linha |
| `enemy_guardian.png` | 384 × 112 | 4 colunas de 96 × 112; uma linha |
| `chicken.png`, `sheep.png` | 128 × 32 | 4 colunas de 32 × 32 |
| `butterfly.png` | 64 × 16 | 4 colunas de 16 × 16 |

As linhas do jogador e dos NPCs são: **baixo, esquerda, direita, cima**.
As colunas são: **repouso 1, repouso 2, passo 1, passo 2, passo 3, passo 4,
ação antecipação, ação golpe**. As mãos mudam de posição durante os golpes.
O jogador não tem uma arma fixa pintada: a arma equipada deve ser renderizada
como camada própria, sincronizada com a mão. O capitão mantém sua espada.
As duas poses de repouso mantêm o corpo estável; os passos alternam pernas,
braços e a altura do corpo. Os perfis, o rosto e a capa mudam pela direção.
Os pés ficam em torno de Y = 58, adequado a uma origem `(0.5, 0.92)`.

Os inimigos têm **repouso, passo 1, passo 2 e ataque**. As criaturas possuem
silhuetas próprias: slime translúcido, lobo de quatro patas, goblin de orelhas
grandes, esqueleto armado, arqueiro encapuzado, aranha de oito patas, golem
mineral e guardião com coroa e núcleo mágico.

Índices do terreno: **0** grama, **1** variação de grama, **2** caminho de terra,
**3** calçamento, **4** água, **5** margem de areia, **6** chão da floresta,
**7** caverna, **8** pedra das ruínas e **9** terra arada.

As sobreposições de borda são opcionais, transparentes e renderizadas por cima
do tile base. Seu índice é a soma das direções com vizinhos externos:
**norte = 1, leste = 2, sul = 4, oeste = 8**. Exemplo: uma curva com grama ao
norte e ao leste usa frame **3** de `path_edges.png`. Para caminhos (tile 2),
marque vizinhos de grama (tiles 0, 1 ou 6). Para margens de areia (tile 5), use
`shore_edges.png` com a mesma regra. Para água (tile 4), use `water_edges.png`
marcando qualquer vizinho diferente de 4. As bordas têm perfis irregulares em
pixels, tufos de grama, cantos arredondados e espuma nas margens da água.

## Objetos de mundo

As dimensões abaixo incluem as sombras. A origem sugerida é o centro inferior;
as colisões devem considerar apenas troncos, fundações ou bases, deixando a
folhagem, os telhados e a parte superior dos objetos passarem à frente do herói.

| Arquivos | Dimensão |
| --- | --- |
| `tree_oak.png` | 96 × 128 |
| `tree_pine.png`, `tree_birch.png` | 64 × 112 |
| `rock.png` | 48 × 40 |
| `copper_ore.png`, `iron_ore.png`, `silver_ore.png`, `gold_ore.png`, `crystal.png` | 48 × 48 |
| `herb.png`, `mushroom.png`, `flower.png`, `berry.png`, `fiber.png` | 24 × 24 |
| `stump.png` | 40 × 24 |
| `chest.png` | 40 × 36 |
| `torch.png`, `sign.png` | 24 × 48; 32 × 48 |
| `workbench.png`, `carpentry.png` | 64 × 48; 80 × 48 |
| `furnace.png`, `forge.png`, `alchemy.png` | 64 × 80; 80 × 64; 64 × 56 |
| `fence.png`, `wall.png`, `gate.png` | 32 × 40; 32 × 48; 64 × 48 |
| `garden.png`, `animal_pen.png` | 64 × 64; 96 × 96 |
| `cabin.png`, `house.png`, `home.png` | 160 × 160; 192 × 192; 192 × 192 |
| `smithy.png`, `tavern.png` | 224 × 224 |
| `market.png`, `ruin_arch.png`, `mine_entrance.png` | 160 × 160 |
| `well.png`, `bridge.png` | 64 × 80; 128 × 128 |
| `flowers.png`, `grass_tuft.png`, `lily.png` | 32 × 32 |
| `log.png` | 48 × 32 |

## Ícones

Todos os 60 arquivos em `items/` têm **32 × 32**, fundo transparente e
silhuetas específicas. As armas, barras e minérios usam cores de material
distintas; as poções têm símbolos de cura/energia desenhados em pixels.
Os ícones das estruturas são miniaturas dos respectivos objetos de mundo.

Para substituir uma imagem, preserve seu nome, dimensões, transparência e o
alinhamento dos pés/base. Para mudar a resolução de um atlas, atualize também
o `frameWidth` e o `frameHeight` no carregamento do Phaser.
