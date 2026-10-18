# Crônicas de Ferro

RPG medieval 2D para navegador, em português. Explore um vale interconectado, extraia recursos, fabrique equipamento, construa uma base e enfrente o Guardião das Ruínas. O jogo usa TypeScript, Phaser 3 e Vite, com sprites pixel art originais e áudio sintetizado localmente.

## Executar

Requer Node.js 22.12+ ou 24 LTS e npm. Não precisa de conta, chave de API ou servidor de jogo.

```sh
npm install
npm run dev
```

Abra no navegador o endereço informado pelo Vite. A instalação precisa acessar o registro npm; a partida e todos os recursos são locais. Para distribuição estática:

```sh
npm run build
npm run preview
```

O conteúdo de `dist/` pode ser servido por qualquer servidor HTTP estático. Abrir `index.html` diretamente pelo protocolo `file:` não é suportado. O salvamento pertence à origem do navegador: trocar domínio ou porta cria outro espaço de salvamento.

## Primeira aventura

1. Clique em **Iniciar aventura**. Você já carrega espada de madeira, machado, picareta de pedra e três poções.
2. Aproxime-se das árvores e pedras perto de casa e pressione **E** a cada golpe. Outra opção é selecionar **2** ou **3**, mirar no recurso e segurar o clique esquerdo. Árvores precisam de três golpes e rendem seis madeiras; pedras rendem quatro unidades. Os recursos entram na mochila de verdade.
3. Com oito madeiras e quatro pedras, abra **C**, selecione **Bancada de trabalho** e fabrique. Em **B**, escolha a bancada, feche o menu e clique num terreno livre próximo. A prévia verde confirma o local; **Esc** cancela.
4. Colete mais madeira, fique perto da bancada e fabrique uma espada. Abra **I** para equipar, consumir, organizar e atribuir atalhos.
5. Explore as trilhas a leste e ao sul de casa para encontrar slimes. Mire com o mouse, ataque e esquive dos golpes. Aproxime-se dos itens deixados para recolhê-los. Experiência aumenta seu nível e recupera seus atributos.
6. Siga a estrada ao norte até Pedra Alta. **E** conversa com os habitantes e abre lojas reais. Breno permite usar a forja; há uma fornalha ao lado. As estações disponíveis aparecem no menu de fabricação.
7. Cruze o rio pela ponte e siga para o nordeste. A picareta de pedra extrai ferro; prata, ouro e cristais exigem a de ferro. Funda quatro minérios em duas barras, usando madeira como combustível, e fabrique um elmo na forja. Equipe-o e confira sua defesa.
8. Fabrique baús, cercas, tochas e uma cabana para desenvolver a base. A carpintaria da vila permite preparar estruturas maiores. Baús armazenam pilhas; canteiros produzem ervas a cada 90 segundos de jogo ativo.
9. Prepare equipamento de ferro e poções antes de explorar as ruínas no sudeste. Os ataques do chefe são anunciados por marcas no chão, e a segunda fase muda seu comportamento.

As nove missões acompanham ações verificadas e entregam as recompensas automaticamente, inclusive quando uma ação foi feita antes de a missão desbloquear.

## Controles

| Controle | Ação |
| --- | --- |
| WASD ou setas | Mover |
| Shift | Correr, consumindo energia |
| Mouse + clique esquerdo | Mirar, atacar, usar ferramenta ou posicionar construção |
| Clique direito | Bloquear com escudo equipado; interagir sem escudo |
| Espaço | Esquivar; custa energia e concede invulnerabilidade breve |
| E | Interagir, coletar, pescar ou abrir baú |
| I | Inventário e equipamentos |
| C | Receitas e fabricação |
| B | Construções e recolhimento de estruturas |
| M | Mapa |
| J / K | Missões / habilidades |
| 1–9 | Selecionar atalho; consumíveis são usados ao selecionar |
| Esc | Cancelar construção, fechar menu ou pausar |
| F5 / botão de salvar | Salvar manualmente |

No inventário, arraste pilhas para mover ou combinar. Selecione um item para consultar atributos, comparar com o equipado e atribuí-lo à barra rápida. Flechas são consumidas por disparo; o cajado consome mana. Armas, escudo, elmo, peitoral, grevas, botas e acessório afetam os atributos; arma, elmo e peitoral têm representação visual em camadas.

## O que funciona nesta versão

- **Etapa 1:** projeto executável, câmera suave, colisões, animações nas quatro direções, inventário e persistência.
- **Etapa 2:** cinco regiões contínuas e acessíveis, árvores, pedras, minérios, plantas, pesca, ferramentas com requisitos, recursos esgotáveis e reaparecimento controlado.
- **Etapa 3:** espada, machado, lança, arco e cajado com diferenças de alcance, velocidade e custo; projéteis, recuo, bloqueio, esquiva, invulnerabilidade, dano, morte, reaparecimento, experiência e loot. Oito tipos de inimigos, incluindo arqueiro, veneno e chefe com duas fases.
- **Etapa 4:** bancada, fornalha, forja, alquimia e carpintaria; 39 receitas com custos reais e requisitos; 60 itens, equipamentos, raridades e seis habilidades com benefícios simples.
- **Etapa 5:** prévia com grade e validação de posição, consumo de itens, colisões, recolhimento de construções, baús persistentes, iluminação de tochas e canteiros renováveis.
- **Etapa 6:** vila, seis NPCs com pequenas rotinas, diálogos, compra e venda, nove missões, tesouros, minimapa, ciclo dia/noite, animais, borboletas, vento, fumaça, água animada e música/efeitos originais sintetizados.

É uma primeira versão jogável, com escopo definido. Ainda não há interiores exploráveis, masmorras em mapas separados, criação ou reprodução de animais, ataques à base, montarias, facções, árvores de talentos, durabilidade, remapeamento de teclas ou controles de toque. O cercado é uma estrutura de construção; a criação de animais fica para uma próxima etapa. As casas são colocáveis e servem de descanso; melhorias modulares de uma casa existente ainda não foram implementadas. As animações usam atlas compactos e camadas de ferramentas/armas; não há um atlas exclusivo para cada arma e ação.

## Salvamento

O jogo salva a cada 20 segundos de partida ativa, ao sair da página, em ações importantes e pelo botão de salvar. Persiste posição, atributos, habilidades, experiência, inventário, equipamentos, atalhos, moedas, missões, exploração, recursos, inimigos derrotados, loot não recolhido, tesouros, construções, armazenamento, canteiros, configurações e horário. Menus pausam a simulação; o tempo offline não é simulado.

O esquema está na versão 2, com migrações das versões 0 e 1. Saves malformados são rejeitados, e o último save válido é mantido como backup. A chave estável é `cronicas-de-ferro.save.v1` para preservar compatibilidade. Começar uma nova história pede confirmação quando já existe progresso. Limpar os dados do navegador remove os saves. Na morte, você reaparece em casa e perde 10% das moedas, limitado a 25, sem perder o inventário.

## Testes

```sh
npm test          # inventário, crafting, progressão, economia, saves e conectividade
npm run build    # TypeScript estrito e build de produção
npm run test:e2e # ciclo de jogo integrado em Chromium
```

Os testes de navegador usam `/usr/bin/chromium` quando disponível. Em outra máquina, rode `npx playwright install chromium` ou defina `CHROMIUM_PATH` com o executável local. A suíte inicia o Vite se não houver servidor na porta configurada. Os testes usam teclado, mouse e menus; reposicionam o personagem por um hook exclusivo do modo de desenvolvimento para encurtar viagens. Cenários isolados de arco, magia e chefe usam equipamento preparado no teste. O build de produção não expõe esse hook. Não substituem uma sessão extensa de balanceamento manual.

## Estrutura

```text
src/
  main.ts                  Inicialização do Phaser e conexão com a UI
  types.ts                 Contratos de dados e save
  data/                    Itens, receitas, estruturas, monstros, NPCs, missões
  scenes/WorldScene.ts      Coordenação da partida e interações
  world/WorldMap.ts         Mapa determinista, regiões e regras de colocação
  world/WorldVisuals.ts     Terreno, NPCs, animais, água e iluminação
  systems/                 Personagem, combate/IA, projéteis, coleta,
                           construção, inventário/progressão, áudio e save
  ui/                      HUD e menus em HTML/CSS
public/assets/             PNGs originais, atlas e especificação da arte
scripts/generate_assets.py Gerador reproduzível da pixel art (Python + Pillow)
tests/                     Testes de lógica e navegador
```

As regiões, receitas, inimigos e itens usam IDs estáveis. Novos conteúdos devem preservar esses IDs ou incluir migração de save. A renderização usa ordenação por Y, tiles de 32 pixels, spritesheets e culling; animação e movimentação usam tempo decorrido. Veja `public/assets/ASSETS.md` para dimensões e organização dos atlas.

Nenhuma imagem ou áudio das referências foi copiado. Os PNGs são entregues com o projeto e podem ser regenerados, opcionalmente, com `python scripts/generate_assets.py` após instalar Pillow. Phaser e as ferramentas mantêm suas próprias licenças.
