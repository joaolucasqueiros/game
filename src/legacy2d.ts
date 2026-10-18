import Phaser from 'phaser';
import { GameModel } from './systems/GameModel';
import { loadGame } from './systems/SaveSystem';
import { WorldScene } from './scenes/WorldScene';
import { GameUI } from './ui/GameUI';
import './ui/style.css';

const model = new GameModel(loadGame() ?? undefined);
let ui: GameUI;
const scene = new WorldScene(model, () => {
  ui = new GameUI(model, {
    start: fresh => scene.startGame(fresh), save: () => scene.save(), respawn: () => scene.respawn(),
    select: index => scene.select(index), build: type => scene.build.select(type), removeBuild: () => scene.build.select('__remove'),
    craft: id => scene.craft(id), interact: () => scene.interact(), pause: paused => { scene.paused = paused; },
    sound: () => { scene.audio.enabled = model.state.settings.sound; scene.audio.music = model.state.settings.music; scene.audio.volume = model.state.settings.volume; scene.audio.unlock(); scene.audio.play('ui'); },
    transfer: (index, toStorage) => { if (scene.openStorage) scene.build.transfer(scene.openStorage, index, toStorage); },
    fishing: () => scene.interact(),
  });
  scene.ui = ui;
  model.onNotice = message => ui.toast(message);
});
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', backgroundColor: '#14251e', pixelArt: true, roundPixels: true,
  antialias: false, powerPreference: 'high-performance',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  render: { transparent: false, antialias: false, pixelArt: true, roundPixels: true },
  scene: [scene],
});

// Development-only inspection hook used by the browser smoke suite.
if (import.meta.env.DEV) Object.assign(window, { __chronicles: { game, scene, model, get ui() { return ui; } } });
