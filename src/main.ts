import { GameModel } from './systems/GameModel';
import { loadGame,hasSave } from './systems/SaveSystem';
import { Materials } from './three/Materials';
import { Game3D } from './three/Game3D';
import { GameUI } from './ui/GameUI';
import './ui/style.css';
import './three/style3d.css';

async function boot(){
  const loading=document.createElement('div');loading.className='loading-3d';loading.innerHTML='<span>CRÔNICAS DE FERRO</span><h1>Um novo horizonte.</h1><p>Preparando o mundo 3D, materiais e iluminação…</p>';document.querySelector('#game')!.append(loading);
  const materials=await new Materials().load(),model=new GameModel(loadGame()??undefined),game=new Game3D(model,materials);
  await game.renderer.compileAsync(game.scene,game.camera);
  game.renderer.render(game.scene,game.camera);
  const ui=new GameUI(model,{
    start:fresh=>game.startGame(fresh),save:()=>game.save(),respawn:()=>game.respawn(),select:i=>game.select(i),build:type=>game.selectBuild(type),removeBuild:()=>game.selectBuild('__remove'),craft:id=>game.craft(id),interact:()=>game.interact(),pause:p=>{game.paused=p;},
    sound:()=>{game.audio.enabled=model.state.settings.sound;game.audio.music=model.state.settings.music;game.audio.volume=model.state.settings.volume;game.audio.unlock();game.audio.play('ui');},transfer:(i,to)=>game.transfer(i,to),fishing:()=>game.beginFishing(),
  });
  game.ui=ui;model.onNotice=m=>ui.toast(m);ui.showTitle(hasSave());document.body.classList.add('edition-3d');
  if(import.meta.env.DEV)Object.assign(window,{__chronicles:{game,scene:game,model,ui,edition:'3d'}});
}
void boot().catch(error=>{console.error(error);document.querySelector('#game')!.innerHTML='<div class="loading-3d"><h1>Não foi possível iniciar o 3D.</h1><p>Ative WebGL e a aceleração de hardware no navegador. Atualize a página para tentar novamente.</p></div>';});
