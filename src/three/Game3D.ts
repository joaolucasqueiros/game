import * as THREE from 'three';
import { GameModel,createInitialState } from '../systems/GameModel';
import { loadGame,saveGame } from '../systems/SaveSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { ITEMS } from '../data/items';
import { RECIPES } from '../data/recipes';
import { STRUCTURES } from '../data/structures';
import { NPCS } from '../data/npcs';
import type { ResourceNode,PlacedStructure,Station } from '../types';
import { WorldMap,START,WORLD_WIDTH,WORLD_HEIGHT } from '../world/WorldMap';
import type { GameUI } from '../ui/GameUI';
import { Materials } from './Materials';
import { ModelFactory,HumanModel } from './Models3D';
import { Terrain3D,SCALE } from './Terrain3D';
import { Scenery3D } from './Scenery3D';
import { Actors3D } from './Actors3D';
import { FishingSession,waterMode,waterDrain,type WaterMode } from './Survival';

interface Projectile{group:THREE.Group; x:number;y:number;vx:number;vy:number;life:number;damage:number;enemy:boolean;magic:boolean;}
interface Particle{mesh:THREE.Mesh;vx:number;vy:number;vz:number;life:number;}
interface Float{element:HTMLDivElement;x:number;y:number;age:number;}
interface TimedAction{type:string;time:number;total:number;finish?:()=>void;tool?:string;}
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export class Game3D {
  readonly renderer:THREE.WebGLRenderer;readonly scene=new THREE.Scene();readonly camera=new THREE.PerspectiveCamera(48,1,.1,500);
  readonly world=new WorldMap();readonly terrain:Terrain3D;readonly scenery:Scenery3D;readonly factory:ModelFactory;readonly character:HumanModel;readonly actors:Actors3D;
  readonly audio=new AudioSystem();ui!:GameUI;ready=true;started=false;paused=true;
  player={x:START.x,y:START.y,heading:Math.PI,health:100,action:'idle',swimming:false,waterMode:'dry' as WaterMode,depth:0,breath:100,invincible:0};
  fishing:FishingSession|null=null;buildType:string|null=null;buildValid=false;buildX=0;buildY=0;openStorage?:PlacedStructure;
  private action:TimedAction|null=null;private held=new Set<string>();private pointer=new THREE.Vector2();private raycaster=new THREE.Raycaster();private plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.25);
  private pointerDown=false;private orbiting=false;private cameraAngle=.35;private cameraDistance=23;private cameraPitch=.65;
  private aimPoint=new THREE.Vector2(START.x,START.y+100);private cameraTarget=new THREE.Vector3();private lastFrame=0;private elapsed=0;private hudTimer=0;private autosave=0;private regenTimer=0;private cooldown=0;private knock=new THREE.Vector2();private dodge=new THREE.Vector2();private dodgeTime=0;private poison=0;
  private sun=new THREE.DirectionalLight(0xffefcf,3.1);private hemi=new THREE.HemisphereLight(0xc4d8d7,0x67624c,2.1);private lights:THREE.PointLight[]=[];
  private preview=new THREE.Group();private previewCell:THREE.Mesh;private previewModel?:THREE.Group;private rodLine:THREE.Line;private bobber:THREE.Mesh;
  private projectiles:Projectile[]=[];private particlesList:Particle[]=[];private floats:Float[]=[];private overlay:HTMLDivElement;private floatLayer:HTMLDivElement;
  private lootViews=new Map<string,THREE.Group>();private npcViews:{id:string;rig:HumanModel;x:number;y:number}[]=[];private ripples:{mesh:THREE.Mesh;age:number}[]=[];private rippleTimer=0;private dead=false;private dirty=true;private lastRegion='';
  private particleGeometry=new THREE.SphereGeometry(.045,4,3);private particleMaterials=new Map<number,THREE.MeshBasicMaterial>();
  readonly performanceMode:boolean;
  private renderRequested=true;
  private stepTimer=0;
  constructor(public model:GameModel,materials:Materials){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    const gl=this.renderer.getContext(),info=gl.getExtension('WEBGL_debug_renderer_info'),device=info?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):'';
    const quality=new URLSearchParams(location.search).get('quality');this.performanceMode=quality==='low'||(quality!=='high'&&/swiftshader|llvmpipe|software|softpipe/i.test(device));
    this.renderer.setPixelRatio(this.performanceMode ? .65 : Math.min(devicePixelRatio,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=this.performanceMode?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.domElement.setAttribute('aria-label','Mundo 3D de Crônicas de Ferro');document.querySelector('#game')!.replaceChildren(this.renderer.domElement);
    this.scene.background=new THREE.Color(0xb5ccca);this.scene.fog=new THREE.FogExp2(0xb5ccca,.008);
    this.terrain=new Terrain3D(this.world,this.scene,materials);this.factory=new ModelFactory(materials);this.scenery=new Scenery3D(this.scene,this.world,this.terrain,this.factory);
    this.character=new HumanModel(this.factory);this.scene.add(this.character.root);
    this.player.x=model.state.position.x;this.player.y=model.state.position.y;this.cameraTarget.set(this.player.x*SCALE,1,this.player.y*SCALE);
    this.character.root.position.set(this.player.x*SCALE,this.terrain.height(this.player.x,this.player.y),this.player.y*SCALE);
    this.scene.add(this.hemi,this.sun,this.sun.target);this.sun.castShadow=true;this.sun.shadow.mapSize.setScalar(this.performanceMode?512:1536);this.sun.shadow.camera.left=-34;this.sun.shadow.camera.right=34;this.sun.shadow.camera.top=34;this.sun.shadow.camera.bottom=-34;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=120;this.sun.shadow.bias=-.0003;this.sun.shadow.normalBias=.035;
    for(let i=0;i<(this.performanceMode?2:4);i++){const light=new THREE.PointLight(0xffb85c,0,16,1.6);this.lights.push(light);this.scene.add(light);}
    for(const npc of NPCS){const rig=new HumanModel(this.factory,npc.id==='merchant'?0x91865d:npc.id==='healer'?0x829c87:0x626553);rig.equip(npc.id==='hunter'?'hunting_bow':npc.id==='captain'?'iron_sword':'',npc.id==='captain',false);this.scene.add(rig.root);this.npcViews.push({id:npc.id,rig,x:npc.x,y:npc.y});}
    this.actors=new Actors3D(this.scene,this.world,this.terrain,this.factory,{model,player:()=>({...this.player,health:this.model.state.health}),blocked:(x,y,r,water)=>this.blocked(x,y,r,water),hitPlayer:(d,x,y,p)=>this.hitPlayer(d,x,y,p),loot:(x,y,i,c)=>this.dropLoot(x,y,i,c),text:(x,y,t,c)=>this.text(x,y,t,c),particles:(x,y,c)=>this.particles(x,y,c),shoot:(x,y,a,d,e,m)=>this.shoot(x,y,a,d,e,m),notice:s=>this.ui?.toast(s)});
    this.previewCell=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xb7d791,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));this.previewCell.rotation.x=-Math.PI/2;this.preview.add(this.previewCell);this.preview.visible=false;this.scene.add(this.preview);
    this.rodLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xdbd6b2}));this.rodLine.visible=false;this.scene.add(this.rodLine);this.bobber=this.factory.sphere(this.scene,.07,materials.plain(0xdfae63));this.bobber.visible=false;
    this.overlay=document.createElement('div');this.overlay.id='survival-overlay';document.querySelector('#app')!.append(this.overlay);
    this.floatLayer=document.createElement('div');this.floatLayer.id='world-floats';document.querySelector('#app')!.append(this.floatLayer);
    this.model.subscribe(()=>this.dirty=true);this.resize();this.installInput();this.sync();this.actors.update(0);this.updateCamera(1);this.lighting();this.renderer.setAnimationLoop(t=>this.tick(t));
  }
  private installInput(){
    document.addEventListener('keydown',e=>{
      if((e.target as HTMLElement).matches('input,textarea,select'))return;
      const key=e.key.toLowerCase();this.held.add(key);
      if([' ','arrowup','arrowdown','arrowleft','arrowright','f5'].includes(key))e.preventDefault();
      if(!this.started||e.repeat)return;
      if(key==='escape'){if(this.buildType)this.selectBuild(null);else if(this.fishing)this.cancelFishing('Linha recolhida.');else if(this.ui.isBlocking){if(!this.dead)this.ui.close();}else this.ui.open('pause');return;}
      if(key==='f5'){this.save();return;}if(this.dead)return;
      const menus:Record<string,string>={i:'inventory',c:'craft',b:'build',m:'map',j:'quests',k:'skills'};
      if(menus[key]){if(this.ui.activePanel===menus[key])this.ui.close();else{this.selectBuild(null);this.ui.open(menus[key]);}return;}
      if(this.ui.isBlocking)return;
      if(/^[1-9]$/.test(key))this.select(Number(key)-1);
      if(key==='e')this.interact();
      if(key===' '&&this.model.state.energy>=18&&!this.action&&!this.fishing&&!this.player.swimming){this.model.state.energy-=18;this.dodge.set(Math.sin(this.player.heading),Math.cos(this.player.heading));this.dodgeTime=.24;this.player.invincible=.42;this.particles(this.player.x,this.player.y,0xbab192);}
    });
    document.addEventListener('keyup',e=>this.held.delete(e.key.toLowerCase()));
    const canvas=this.renderer.domElement;canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointermove',e=>{this.pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);if(this.orbiting){this.cameraAngle-=e.movementX*.006;this.cameraPitch=THREE.MathUtils.clamp(this.cameraPitch+e.movementY*.004,.42,1.15);this.renderRequested=true;}this.updateAim();});
    canvas.addEventListener('pointerdown',e=>{this.audio.unlock();if(e.button===1){e.preventDefault();this.orbiting=true;canvas.setPointerCapture(e.pointerId);return;}if(!this.started||this.paused||this.ui.isBlocking||this.dead)return;this.pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);this.updateAim();
      if(e.button===2){if(!this.model.state.equipment.shield)this.interact();else this.held.add('block');return;}
      if(e.button!==0)return;if(this.buildType){this.place();return;}if(this.fishing){this.hook();return;}this.pointerDown=true;this.attack();
    });
    window.addEventListener('pointerup',()=>{this.pointerDown=false;this.orbiting=false;this.held.delete('block');});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.cameraDistance=THREE.MathUtils.clamp(this.cameraDistance+e.deltaY*.015,13,47);this.renderRequested=true;},{passive:false});
    window.addEventListener('resize',()=>this.resize());window.addEventListener('blur',()=>{this.held.clear();this.pointerDown=false;if(this.started&&!this.ui.isBlocking)this.ui.open('pause');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.started)this.save(false);});window.addEventListener('beforeunload',()=>{if(this.started)this.save(false);});
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.renderRequested=true;}
  screenPoint(x:number,y:number,height=0){const p=new THREE.Vector3(x*SCALE,this.terrain.height(x,y)+height,y*SCALE).project(this.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}
  private updateAim(){
    this.raycaster.setFromCamera(this.pointer,this.camera);
    if(!this.buildType&&this.actors){
      const targets=this.actors.actors.filter(a=>!a.dead&&a.group.visible).map(a=>a.group);
      const hitActor=this.raycaster.intersectObjects(targets,true)[0];
      if(hitActor){let root:THREE.Object3D|null=hitActor.object;while(root&&!root.userData.actorId)root=root.parent;const a=this.actors.actors.find(a=>a.id===root?.userData.actorId);if(a){this.aimPoint.set(a.x,a.y);return;}}
    }
    const hit=new THREE.Vector3();this.plane.constant=-.25;if(this.raycaster.ray.intersectPlane(this.plane,hit)){const x=hit.x/SCALE,y=hit.z/SCALE;this.plane.constant=-Math.max(0,this.terrain.height(x,y));this.raycaster.ray.intersectPlane(this.plane,hit);this.aimPoint.set(hit.x/SCALE,hit.z/SCALE);}
  }
  private updateCamera(dt:number){
    const target=new THREE.Vector3(this.player.x*SCALE,Math.max(0,this.terrain.height(this.player.x,this.player.y))+.95,this.player.y*SCALE);
    this.cameraTarget.lerp(target,1-Math.exp(-dt*7));
    this.camera.position.set(this.cameraTarget.x+Math.sin(this.cameraAngle)*this.cameraDistance,this.cameraTarget.y+this.cameraDistance*this.cameraPitch,this.cameraTarget.z+Math.cos(this.cameraAngle)*this.cameraDistance);
    this.camera.lookAt(this.cameraTarget);
  }
  get activeItem(){const id=this.model.state.hotbar[this.model.state.selected];return id&&(this.model.count(id)>0||Object.values(this.model.state.equipment).includes(id))?id:this.model.state.selected===0?this.model.state.equipment.weapon??'':'';}
  startGame(fresh:boolean){
    if(fresh){const settings=this.model.state.settings;this.model.state=createInitialState();this.model.state.settings=settings;}else{const s=loadGame();if(s)this.model.state=s;}
    this.started=true;this.dead=false;this.paused=false;this.player.breath=100;this.player.invincible=1;this.action=null;this.fishing=null;this.buildType=null;this.preview.visible=false;this.poison=0;this.knock.set(0,0);this.dodgeTime=0;this.pointerDown=false;this.held.clear();
    this.projectiles.forEach(p=>this.scene.remove(p.group));this.projectiles=[];this.lootViews.forEach(g=>this.scene.remove(g));this.lootViews.clear();this.actors.reset();
    this.teleport(this.model.state.position.x,this.model.state.position.y);if(this.blocked(this.player.x,this.player.y,7,true))this.teleport(START.x,START.y);
    this.ui.close();this.audio.unlock();this.lastRegion='';this.model.changed();this.sync();this.updateCamera(1);this.updateHud();
    this.ui.toast(fresh?'Seu mundo agora tem profundidade. Explore, nade, pesque com 6 e cace com o arco em 5.':'Sua jornada foi preservada. Bem-vindo ao mundo 3D.');
    if(this.model.state.health<=0)this.die();else this.save(false);
  }
  teleport(x:number,y:number){this.player.x=x;this.player.y=y;this.knock.set(0,0);this.dodgeTime=0;this.model.state.position={x,y};this.cameraTarget.set(x*SCALE,1,y*SCALE);this.renderRequested=true;}
  save(notice=true){if(!this.started)return;const r=saveGame(this.model.state);if(notice||!r.ok)this.ui.toast(r.message);this.autosave=0;}
  select(index:number){this.model.state.selected=index;const id=this.model.state.hotbar[index];if(ITEMS[id]?.kind==='consumable'){const i=this.model.state.inventory.findIndex(s=>s?.item===id);this.ui.toast(i>=0?this.model.consume(i).message:'Este consumível acabou.');}this.model.changed();}
  craft(id:string){const r=this.model.craft(id,this.stations());this.ui.toast(r.message);if(r.ok){this.audio.play('build');const recipe=RECIPES.find(r=>r.id===id)!;if(['weapon','structure','tool'].includes(ITEMS[recipe.item].kind)&&!this.model.state.hotbar.includes(recipe.item)){const empty=this.model.state.hotbar.findIndex((s,i)=>i>3&&!s);if(empty>=0)this.model.state.hotbar[empty]=recipe.item;}this.model.changed();}}
  blocked(x:number,y:number,r=8,allowWater=true){
    if(x<32+r||y<32+r||x>WORLD_WIDTH-32-r||y>WORLD_HEIGHT-32-r)return true;
    if(!allowWater&&this.terrain.waterDepth(x,y)>.12)return true;
    if(this.world.buildings.some(b=>x+r>b.x-b.width/2&&x-r<b.x+b.width/2&&y+r>b.y-Math.max(b.height,48)&&y-r<b.y))return true;
    if(this.world.nodes.some(n=>n.solid&&this.model.state.resources[n.id]?.remaining!==0&&Math.abs(n.x-x)<r+(n.type==='tree'?10:14)&&Math.abs(n.y-y)<r+10))return true;
    return this.model.state.structures.some(s=>{const d=STRUCTURES[s.type];return d.solid&&x+r>s.x*32&&x-r<(s.x+d.width)*32&&y+r>s.y*32&&y-r<(s.y+d.height)*32;});
  }
  private move(dx:number,dy:number){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/5));for(let i=0;i<steps;i++){if(!this.blocked(this.player.x+dx/steps,this.player.y,7))this.player.x+=dx/steps;if(!this.blocked(this.player.x,this.player.y+dy/steps,7))this.player.y+=dy/steps;}}
  private nearbyNode(range=65){return this.world.nodes.filter(n=>n.type!=='fish'&&this.model.state.resources[n.id]?.remaining!==0&&Math.hypot(n.x-this.player.x,n.y-this.player.y)<range).sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y))[0];}
  private structureNear(range=55){return this.model.state.structures.map(s=>{const d=STRUCTURES[s.type];return{s,dist:Math.hypot(this.player.x-THREE.MathUtils.clamp(this.player.x,s.x*32,(s.x+d.width)*32),this.player.y-THREE.MathUtils.clamp(this.player.y,s.y*32,(s.y+d.height)*32))};}).filter(v=>v.dist<range).sort((a,b)=>a.dist-b.dist)[0]?.s;}
  stations(){const set=new Set<Station>(['hand']);for(const b of this.world.buildings)if(b.station&&Math.hypot(this.player.x-THREE.MathUtils.clamp(this.player.x,b.x-b.width/2,b.x+b.width/2),this.player.y-b.y)<105)set.add(b.station);
    for(const s of this.model.state.structures){const d=STRUCTURES[s.type];if(d.station&&Math.hypot(this.player.x-THREE.MathUtils.clamp(this.player.x,s.x*32,(s.x+d.width)*32),this.player.y-THREE.MathUtils.clamp(this.player.y,s.y*32,(s.y+d.height)*32))<90)set.add(d.station);}return set;}
  context(){
    const p=this.player;const npc=this.npcViews.find(n=>Math.hypot(n.x-p.x,n.y-p.y)<67);if(npc)return{kind:'npc',id:npc.id,prompt:`Conversar com ${NPCS.find(n=>n.id===npc.id)!.name}`};
    const chest=this.world.chests.find(c=>!this.model.state.openedChests.includes(c.id)&&Math.hypot(c.x-p.x,c.y-p.y)<60);if(chest)return{kind:'treasure',id:chest.id,prompt:'Abrir tesouro'};
    const structure=this.structureNear();if(structure)return{kind:'structure',id:structure.id,prompt:`${structure.type==='chest'?'Abrir':'Usar'} ${STRUCTURES[structure.type].name}`};
    if(this.activeItem==='fishing_rod'){const fish=this.fishingPoint();if(fish)return{kind:'fish',id:'water',prompt:'Lançar a linha · espere a fisgada'};}
    const n=this.nearbyNode();if(n)return{kind:'resource',id:n.id,prompt:`${n.type==='tree'?'Cortar':n.type==='plant'?'Coletar':'Minerar'} ${ITEMS[n.item].name}`};
    const b=this.world.buildings.find(b=>Math.hypot(p.x-THREE.MathUtils.clamp(p.x,b.x-b.width/2,b.x+b.width/2),p.y-b.y)<65);if(b)return{kind:'building',id:b.id,prompt:b.id==='player-home'?'Descansar em casa':`Usar ${b.name}`};
    if(this.fishingPoint())return{kind:'fish',id:'water',prompt:'Pescar · vara no atalho 6'};
    return undefined;
  }
  interact(){
    if(this.dead||this.ui.isBlocking||!this.started)return;
    if(this.fishing){this.hook();return;}if(this.action)return;
    const c=this.context();if(!c){this.ui.toast('Aproxime-se de um recurso, habitante ou margem. Use o arco [5] para caçar.');return;}
    if(c.kind==='resource')this.gather(this.world.nodes.find(n=>n.id===c.id)!);
    if(c.kind==='fish')this.beginFishing();
    if(c.kind==='npc'){const npc=NPCS.find(n=>n.id===c.id)!;this.model.metric(`talk:${npc.id}`);this.ui.showNpc(npc);}
    if(c.kind==='treasure'){const chest=this.world.chests.find(chest=>chest.id===c.id)!;const backup=this.model.state.inventory.map(s=>s?{...s}:null);for(const[id,qty]of Object.entries(chest.items)){if(!this.model.add(id,qty)){this.model.state.inventory=backup;this.model.changed();this.ui.toast('Libere espaço na mochila.');return;}}this.model.state.openedChests.push(chest.id);this.model.state.coins+=chest.coins;this.model.addXP(15);this.ui.toast(`Tesouro encontrado: ${chest.coins} moedas e suprimentos.`);this.save(false);}
    if(c.kind==='structure'){
      const s=this.model.state.structures.find(s=>s.id===c.id)!;if(s.type==='chest'){this.openStorage=s;this.ui.showStorage(s);}
      else if(s.type==='garden'){if(this.model.state.time-(s.plantedAt??0)<90)this.ui.toast('As ervas ainda estão crescendo.');else if(this.model.add('herb',4)){s.plantedAt=this.model.state.time;this.model.metric('gather:herb',4);this.ui.toast('Colhido: 4 ervas.');}}
      else if(STRUCTURES[s.type].station)this.ui.open('craft');else if(['house','cabin'].includes(s.type))this.rest();else this.ui.toast(STRUCTURES[s.type].description);
    }
    if(c.kind==='building'){const b=this.world.buildings.find(b=>b.id===c.id)!;if(b.station)this.ui.open('craft');else if(b.id==='village-well'){this.model.state.energy=this.model.maxEnergy;this.model.changed();this.ui.toast('Energia restaurada com água fresca.');}else if(b.texture==='home'||b.texture==='tavern')this.rest();else this.ui.toast(b.id==='mine-entrance'?'Explore os veios ao norte. A picareta de pedra extrai ferro.':'As ruínas se estendem para o leste. Prepare armas e armadura.');}
  }
  private rest(){if(this.actors.inCombat){this.ui.toast('Afaste os inimigos antes de descansar.');return;}this.model.state.health=this.model.maxHealth;this.model.state.energy=this.model.maxEnergy;this.model.state.mana=this.model.maxMana;this.poison=0;this.model.changed();this.ui.toast('Vida, energia e mana restauradas.');this.save(false);}
  gather(node:ResourceNode){
    if(this.action||this.fishing||this.player.swimming||this.model.state.resources[node.id]?.remaining===0)return;
    const needed=node.type==='tree'?'axe':node.type==='plant'?null:'pickaxe';
    const owned=[...this.model.state.inventory.filter(Boolean).map(s=>s!.item),...Object.values(this.model.state.equipment).filter((id):id is string=>!!id)];
    const tool=owned.map(id=>ITEMS[id]).filter(i=>i.tool===needed).sort((a,b)=>(b.tier??0)-(a.tier??0))[0];
    if(needed&&(!tool||(tool.tier??1)<node.tier)){this.ui.toast(tool?'Este veio exige uma ferramenta de ferro.':'Você precisa da ferramenta apropriada.');return;}
    if(this.model.state.energy<5){this.ui.toast('Descanse para recuperar energia.');return;}
    this.model.state.energy-=needed?5:2;this.player.heading=Math.atan2(node.x-this.player.x,node.y-this.player.y);
    const skill=needed==='axe'?'woodcutting':needed?'mining':'survival',duration=Math.max(.25,.48-(this.model.skillLevel(skill)-1)*.025);
    this.action={type:needed==='axe'?'woodcut':needed?'mine':'gather',time:duration,total:duration,tool:tool?.id,finish:()=>{
      const record=this.model.state.resources[node.id]??{remaining:node.hp,respawnAt:0};const damage=(tool?.tier??1)>1?2:1;
      const amount=node.type==='tree'?6:node.type==='plant'?2:4;
      if(record.remaining<=damage&&!this.model.add(node.item,amount)){this.ui.toast('Mochila cheia.');return;}
      record.remaining=Math.max(0,record.remaining-damage);this.model.state.resources[node.id]=record;this.particles(node.x,node.y,needed==='axe'?0xac8956:0xa5a399);this.audio.play(needed==='axe'?'wood':needed?'stone':'pickup');
      if(!record.remaining){record.respawnAt=this.model.state.time+(node.type==='tree'?240:node.type==='ore'?300:140);this.model.metric(`gather:${node.item}`,amount);this.model.skillXP(skill,12);this.model.addXP(6);this.text(node.x,node.y,`+${amount} ${ITEMS[node.item].name}`,'#e0d6ad');}else this.text(node.x,node.y,`${node.hp-record.remaining}/${node.hp}`);
      this.model.changed();
    }};
  }
  private fishingPoint(){
    if(this.player.swimming)return null;
    if(this.terrain.isWater(this.aimPoint.x,this.aimPoint.y)&&this.player.depth<.95&&this.aimPoint.distanceTo(new THREE.Vector2(this.player.x,this.player.y))<140)return{x:this.aimPoint.x,y:this.aimPoint.y};
    let best:{x:number;y:number;d:number}|null=null;
    for(let a=0;a<Math.PI*2;a+=Math.PI/12)for(const r of [38,64,90,120]){const x=this.player.x+Math.sin(a)*r,y=this.player.y+Math.cos(a)*r;if(this.terrain.waterDepth(x,y)>.5&&(!best||r<best.d))best={x,y,d:r};}return best;
  }
  beginFishing(){
    if(this.player.swimming){this.ui.toast('Volte à margem ou a uma parte rasa para lançar a linha.');return;}
    if(!this.model.count('fishing_rod')&&this.model.state.equipment.weapon!=='fishing_rod'){this.ui.toast('Fabrique uma vara de pesca com madeira e fibras.');return;}
    const point=this.fishingPoint();if(!point){this.ui.toast('Aproxime-se da água e mire no lago.');return;}
    if(this.action)return;this.model.state.energy=Math.max(0,this.model.state.energy-3);this.fishing=new FishingSession(point.x,point.y,2.2+Math.random()*.6);this.player.heading=Math.atan2(point.x-this.player.x,point.y-this.player.y);this.ui.toast('Linha lançada. Espere a mordida e pressione E para fisgar.');this.ripple(point.x,point.y);
  }
  private hook(){if(this.fishing?.hook()){this.audio.play('fish');this.ripple(this.fishing.x,this.fishing.y);}else if(this.fishing?.phase==='waiting')this.ui.toast('Espere a bóia afundar.');}
  private cancelFishing(message:string){this.fishing=null;this.rodLine.visible=this.bobber.visible=false;this.ui.toast(message);}
  private updateFishing(dt:number){
    if(!this.fishing)return;const f=this.fishing,old=f.phase;f.update(dt);
    if(f.phase==='bite'&&old!=='bite'){this.ui.toast('MORDEU! Pressione E ou clique agora.');this.audio.play('fish');this.ripple(f.x,f.y);}
    this.rodLine.visible=this.bobber.visible=true;
    const hand=new THREE.Vector3(this.player.x*SCALE,Math.max(0,this.terrain.height(this.player.x,this.player.y))+1.8,this.player.y*SCALE),tip=hand.clone().add(new THREE.Vector3(Math.sin(this.player.heading)*1.6,.2,Math.cos(this.player.heading)*1.6));
    const bob=new THREE.Vector3(f.x*SCALE,f.phase==='bite'?-.08:.09+Math.sin(this.elapsed*5)*.04,f.y*SCALE);this.bobber.position.copy(bob);
    const curve=new THREE.QuadraticBezierCurve3(tip,tip.clone().lerp(bob,.5).add(new THREE.Vector3(0,-.3,0)),bob);
    this.rodLine.geometry.dispose();this.rodLine.geometry=new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
    if(f.phase==='caught'){if(this.model.add('fish',2)){this.model.metric('gather:fish',2);this.model.skillXP('survival',12);this.model.addXP(8);this.ui.toast('Você pescou 2 peixes. Asse-os numa fornalha.');this.text(f.x,f.y,'+2 Peixes','#b9e3e4');}else this.ui.toast('Mochila cheia: o peixe voltou para o lago.');this.fishing=null;this.rodLine.visible=this.bobber.visible=false;}
    else if(f.phase==='missed')this.cancelFishing('O peixe escapou. Lance novamente e fisgue quando a bóia afundar.');
  }
  attack(){
    if(this.action||this.cooldown>0||this.dead||this.fishing||this.player.swimming)return;
    const id=this.activeItem,item=ITEMS[id];if(!item)return;
    this.player.heading=Math.atan2(this.aimPoint.x-this.player.x,this.aimPoint.y-this.player.y);
    if(item.structure){this.selectBuild(item.structure);this.pointerDown=false;return;}
    if(item.tool==='rod'){this.beginFishing();this.pointerDown=false;return;}
    if(item.kind==='consumable'){this.select(this.model.state.selected);this.pointerDown=false;return;}
    if(item.tool){const node=this.nearbyNode(72);if(node&&(item.tool==='axe'?node.type==='tree':['rock','ore'].includes(node.type))){this.gather(node);return;}}
    if(!['weapon','tool'].includes(item.kind)||this.model.state.energy<5)return;
    const ranged=item.weaponType==='bow'||item.weaponType==='staff';
    if(item.weaponType==='bow'&&!this.model.remove('arrow',1)){this.ui.toast('Sem flechas. Fabrique mais com madeira e pedra.');this.pointerDown=false;return;}
    if(item.weaponType==='staff'){if(this.model.state.mana<8){this.ui.toast('Mana insuficiente.');this.pointerDown=false;return;}this.model.state.mana-=8;}
    this.model.state.energy-=item.weaponType==='axe'?9:5;this.cooldown=(item.cooldown??420)/1000;this.action={type:'attack',time:this.cooldown*.65,total:this.cooldown*.65};
    const skill=ranged?'archery':'melee',damage=(item.damage??3)+this.model.state.level-1+this.model.skillLevel(skill)-1;
    if(ranged)this.shoot(this.player.x,this.player.y,this.player.heading,damage,false,item.weaponType==='staff',item.range);
    else for(const a of this.actors.actors){const dist=Math.hypot(a.x-this.player.x,a.y-this.player.y),angle=Math.atan2(a.x-this.player.x,a.y-this.player.y);if(!a.dead&&dist<(item.range??54)+(a.def.boss?25:10)&&Math.abs(wrap(angle-this.player.heading))<(item.weaponType==='spear'?.4:item.weaponType==='axe'?1.65:1.1)&&!this.obstructed(this.player.x,this.player.y,a.x,a.y))this.actors.hit(a,damage,this.player.x,this.player.y);}
    this.model.skillXP(skill,1);this.audio.play(ranged?item.weaponType==='staff'?'magic':'bow':'sword');
  }
  private obstructed(x:number,y:number,tx:number,ty:number){const steps=Math.ceil(Math.hypot(tx-x,ty-y)/10);for(let i=1;i<steps;i++)if(this.blocked(x+(tx-x)*i/steps,y+(ty-y)*i/steps,1,true))return true;return false;}
  shoot(x:number,y:number,heading:number,damage:number,enemy:boolean,magic=false,range?:number){
    const group=new THREE.Group();if(magic){const mat=this.factory.materials.plain(enemy?0xe7a569:0x7ec9db,.3,.2).clone();mat.emissive.set(enemy?0xab3c16:0x458bce);mat.emissiveIntensity=2;this.factory.sphere(group,.13,mat);}
    else {this.factory.cylinder(group,.012,.012,.7,this.factory.materials.surface('wood')).rotation.x=Math.PI/2;this.factory.mesh(group,new THREE.ConeGeometry(.045,.16,5),this.factory.materials.plain(0xb5b8ae,.5),0,0,.4).rotation.x=Math.PI/2;}
    const speed=enemy?magic?110:175:magic?260:370;
    const p={group,x:x+Math.sin(heading)*15,y:y+Math.cos(heading)*15,vx:Math.sin(heading)*speed,vy:Math.cos(heading)*speed,damage,enemy,magic,life:enemy?3:(range??(magic?420:390))/speed};group.rotation.y=heading;this.scene.add(group);this.projectiles.push(p);
  }
  private updateProjectiles(dt:number){for(const p of this.projectiles){p.life-=dt;const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/7));for(let i=0;i<steps&&p.life>0;i++){p.x+=p.vx*dt/steps;p.y+=p.vy*dt/steps;if(this.blocked(p.x,p.y,2,true)){p.life=0;break;}if(p.enemy){if(Math.hypot(p.x-this.player.x,p.y-this.player.y)<17){this.hitPlayer(p.damage,p.x-p.vx,p.y-p.vy);p.life=0;}}else{const a=this.actors.actors.find(a=>!a.dead&&Math.hypot(a.x-p.x,a.y-p.y)<(a.def.boss?28:18));if(a){this.actors.hit(a,p.damage,p.x-p.vx,p.y-p.vy);p.life=0;}}}p.group.position.set(p.x*SCALE,Math.max(0,this.terrain.height(p.x,p.y))+1,p.y*SCALE);if(p.life<=0){this.particles(p.x,p.y,p.magic?0x8ebac4:0xb9a585);this.scene.remove(p.group);}}this.projectiles=this.projectiles.filter(p=>p.life>0);}
  hitPlayer(damage:number,x:number,y:number,poison=false){
    if(this.player.invincible>0||this.dead)return;let amount=Math.max(1,Math.round(damage-this.model.defense*.65));
    if(this.held.has('block')&&this.model.state.equipment.shield&&this.model.state.energy>=8){amount=Math.max(1,Math.round(amount*.25));this.model.state.energy-=8;this.text(this.player.x,this.player.y,'BLOQUEIO');}
    this.model.state.health=Math.max(0,this.model.state.health-amount);this.player.invincible=.8;this.knock.set(this.player.x-x,this.player.y-y).normalize().multiplyScalar(145);this.action=null;if(this.fishing)this.cancelFishing('A pesca foi interrompida pelo ataque.');if(poison)this.poison=7;
    this.text(this.player.x,this.player.y,`−${amount}`,'#e69c83');this.audio.play('hurt');this.model.changed();if(!this.model.state.health)this.die();
  }
  private die(){this.dead=true;this.player.action='dead';this.fishing=null;this.action=null;this.pointerDown=false;this.held.clear();this.audio.play('death');this.ui.showDeath();this.save(false);}
  respawn(){const penalty=Math.min(25,Math.floor(this.model.state.coins*.1));this.model.state.coins-=penalty;this.model.state.health=this.model.maxHealth;this.model.state.energy=this.model.maxEnergy;this.model.state.mana=this.model.maxMana;this.player.breath=100;this.player.invincible=3;this.dead=false;this.poison=0;this.teleport(START.x,START.y);this.player.action='idle';this.ui.close();this.projectiles.forEach(p=>this.scene.remove(p.group));this.projectiles=[];this.ui.toast(`Você voltou para casa. Perdeu ${penalty} moedas; os itens foram preservados.`);this.model.changed();this.save(false);}
  selectBuild(type:string|null){this.buildType=type;this.preview.visible=!!type;this.previewModel&&this.preview.remove(this.previewModel);this.previewModel=undefined;if(type&&type!=='__remove'){this.previewModel=this.factory.building(type,STRUCTURES[type].width*2,STRUCTURES[type].height*2);this.previewModel.traverse(o=>{if(o instanceof THREE.Mesh){const m=(o.material as THREE.Material).clone();m.transparent=true;m.opacity=.45;m.depthWrite=false;o.material=m;}});this.preview.add(this.previewModel);}if(type)this.ui.toast(type==='__remove'?'Clique numa construção sua para recolher.':'Escolha chão seco e livre perto do personagem. Esc cancela.');}
  private updateBuild(){
    if(!this.buildType)return;this.buildX=Math.floor(this.aimPoint.x/32);this.buildY=Math.floor(this.aimPoint.y/32);
    if(this.buildType==='__remove'){this.preview.visible=false;return;}const d=STRUCTURES[this.buildType];const x=(this.buildX+d.width/2)*32,y=(this.buildY+d.height)*32;
    const depleted=new Set(Object.entries(this.model.state.resources).filter(([,r])=>!r.remaining).map(([id])=>id));
    const closestX=THREE.MathUtils.clamp(this.player.x,this.buildX*32,(this.buildX+d.width)*32),closestY=THREE.MathUtils.clamp(this.player.y,this.buildY*32,(this.buildY+d.height)*32);
    this.buildValid=this.model.count(d.item)>0&&!this.player.swimming&&this.world.canPlace(d,this.buildX,this.buildY,this.world.nodes,this.model.state.structures,depleted)&&Math.hypot(x-this.player.x,y-this.player.y)<185&&Math.hypot(closestX-this.player.x,closestY-this.player.y)>16&&!this.actors.actors.some(a=>!a.dead&&a.x>this.buildX*32-10&&a.x<(this.buildX+d.width)*32+10&&a.y>this.buildY*32-10&&a.y<(this.buildY+d.height)*32+10);
    this.preview.position.set(x*SCALE,this.terrain.height(x,y)+.06,y*SCALE);this.previewCell.scale.set(d.width*2,d.height*2,1);this.previewCell.position.z=-d.height;(this.previewCell.material as THREE.MeshBasicMaterial).color.set(this.buildValid?0xb5d995:0xe28268);
  }
  place(){
    if(!this.buildType)return;
    if(this.buildType==='__remove'){
      const s=this.model.state.structures.find(s=>{const d=STRUCTURES[s.type];return this.aimPoint.x>=s.x*32&&this.aimPoint.x<(s.x+d.width)*32&&this.aimPoint.y>=s.y*32&&this.aimPoint.y<(s.y+d.height)*32;});
      if(!s||Math.hypot(this.player.x-this.aimPoint.x,this.player.y-this.aimPoint.y)>185){this.ui.toast('Clique perto de uma construção sua.');return;}
      if(s.storage?.some(Boolean)){this.ui.toast('Esvazie o baú antes de recolhê-lo.');return;}if(!this.model.add(STRUCTURES[s.type].item,1)){this.ui.toast('Mochila cheia.');return;}this.model.state.structures=this.model.state.structures.filter(p=>p.id!==s.id);this.model.changed();this.sync();return;
    }
    this.updateBuild();if(!this.buildValid){this.ui.toast('Local inválido. Verifique distância, recursos e terreno.');return;}const type=this.buildType,d=STRUCTURES[type];if(!this.model.remove(d.item,1))return;
    const s:PlacedStructure={id:crypto.randomUUID(),type,x:this.buildX,y:this.buildY};if(type==='chest')s.storage=Array(18).fill(null);if(type==='garden')s.plantedAt=this.model.state.time;
    this.model.state.structures.push(s);this.model.metric(`build:${type}`);this.model.addXP(10);this.action={type:'build',time:.35,total:.35,tool:'wood_axe'};this.audio.play('build');this.ui.toast(`${d.name} construída.`);this.model.changed();this.sync();this.save(false);
  }
  transfer(index:number,toStorage:boolean){
    const s=this.openStorage;if(!s?.storage||!this.model.state.structures.includes(s))return;
    if(!toStorage){const item=s.storage[index];if(item&&this.model.add(item.item,item.qty)){s.storage[index]=null;this.model.changed();}else this.ui.toast('Mochila cheia.');return;}
    const stack=this.model.state.inventory[index];if(!stack)return;const candidate=s.storage.map(p=>p?{...p}:null);let left=stack.qty;
    for(const p of candidate)if(p?.item===stack.item){const n=Math.min(left,ITEMS[p.item].stack-p.qty);p.qty+=n;left-=n;}
    for(let i=0;i<candidate.length&&left;i++)if(!candidate[i]){const n=Math.min(left,ITEMS[stack.item].stack);candidate[i]={item:stack.item,qty:n};left-=n;}
    if(left){this.ui.toast('O baú está cheio.');return;}s.storage=candidate;this.model.state.inventory[index]=null;this.model.changed();
  }
  private dropLoot(x:number,y:number,items:Record<string,number>,coins:number){this.model.state.loot.push({id:crypto.randomUUID(),x,y,items,coins});this.model.changed();this.sync();}
  private sync(){
    this.scenery.sync(this.model.state,.02);
    for(const loot of this.model.state.loot)if(!this.lootViews.has(loot.id)){const g=new THREE.Group();this.factory.sphere(g,.22,this.factory.materials.surface('leather'),0,.22,0,1,1.25,.8);this.factory.cylinder(g,.07,.1,.16,this.factory.materials.surface('wood'),0,.49,0);g.position.set(loot.x*SCALE,Math.max(0,this.terrain.height(loot.x,loot.y)),loot.y*SCALE);this.scene.add(g);this.lootViews.set(loot.id,g);}
    for(const[id,g]of this.lootViews)if(!this.model.state.loot.some(l=>l.id===id)){this.scene.remove(g);this.lootViews.delete(id);}this.dirty=false;
  }
  private collectLoot(){for(const l of this.model.state.loot){if(Math.hypot(l.x-this.player.x,l.y-this.player.y)>35)continue;for(const[id,n]of Object.entries(l.items))if(this.model.add(id,n)){delete l.items[id];this.text(l.x,l.y,`+${n} ${ITEMS[id].name}`);this.audio.play('pickup');}if(l.coins){this.model.state.coins+=l.coins;l.coins=0;this.model.changed();}}this.model.state.loot=this.model.state.loot.filter(l=>l.coins||Object.keys(l.items).length);}
  private regenResources(){for(const n of this.world.nodes){const r=this.model.state.resources[n.id];if(!r||r.remaining||r.respawnAt>this.model.state.time)continue;const occupied=Math.hypot(n.x-this.player.x,n.y-this.player.y)<30||this.model.state.structures.some(s=>{const d=STRUCTURES[s.type];return n.x+23>s.x*32&&n.x-23<(s.x+d.width)*32&&n.y+14>s.y*32&&n.y-14<(s.y+d.height)*32;});if(occupied)r.respawnAt=this.model.state.time+20;else{delete this.model.state.resources[n.id];this.dirty=true;}}}
  private ripple(x:number,y:number){const mesh=new THREE.Mesh(new THREE.RingGeometry(.15,.18,32),new THREE.MeshBasicMaterial({color:0xd1e0c9,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x*SCALE,.085,y*SCALE);this.scene.add(mesh);this.ripples.push({mesh,age:0});}
  particles(x:number,y:number,color:number){if(!this.particleMaterials.has(color))this.particleMaterials.set(color,new THREE.MeshBasicMaterial({color}));for(let i=0;i<7;i++){const mesh=new THREE.Mesh(this.particleGeometry,this.particleMaterials.get(color)!);mesh.position.set(x*SCALE,this.terrain.height(x,y)+.6,y*SCALE);this.scene.add(mesh);this.particlesList.push({mesh,vx:(Math.random()-.5)*2,vy:1+Math.random(),vz:(Math.random()-.5)*2,life:.7});}}
  text(x:number,y:number,message:string,color='#ebd7b4'){const element=document.createElement('div');element.className='world-float';element.textContent=message;element.style.color=color;this.floatLayer.append(element);this.floats.push({element,x,y,age:0});}
  private effects(dt:number){for(const p of this.particlesList){p.life-=dt;p.mesh.position.x+=p.vx*dt;p.mesh.position.y+=p.vy*dt;p.mesh.position.z+=p.vz*dt;p.vy-=dt*5;p.mesh.scale.setScalar(Math.max(0,p.life));if(p.life<=0)this.scene.remove(p.mesh);}this.particlesList=this.particlesList.filter(p=>p.life>0);
    for(const f of this.floats){f.age+=dt;const p=this.screenPoint(f.x,f.y,1.8);f.element.style.transform=`translate(${p.x}px,${p.y-f.age*25}px) translate(-50%,-100%)`;f.element.style.opacity=String(Math.max(0,1-f.age/1.4));if(f.age>1.4)f.element.remove();}this.floats=this.floats.filter(f=>f.age<=1.4);
    for(const r of this.ripples){r.age+=dt;r.mesh.scale.setScalar(1+r.age*5);(r.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,.65-r.age*.6);if(r.age>1.1){this.scene.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();}}this.ripples=this.ripples.filter(r=>r.age<=1.1);
  }
  private lighting(){
    const hour=(8+this.model.state.time/50)%24,day=hour>=6&&hour<19;const daylight=day?Math.min(1,(hour-5)/2,(20-hour)/2):.08;
    this.sun.intensity=.12+daylight*2.9;this.hemi.intensity=.45+daylight*1.4;
    const sky=new THREE.Color(0x263747).lerp(new THREE.Color(0xb5c9c9),daylight);this.scene.background=sky;(this.scene.fog as THREE.FogExp2).color.copy(sky);
    const p=this.character.root.position;this.sun.position.set(p.x-22,p.y+38,p.z-18);this.sun.target.position.copy(p);
    const positions=[...this.world.decorations.filter(d=>d.texture==='torch').map(d=>({x:d.x,y:d.y})),...this.model.state.structures.filter(s=>s.type==='torch').map(s=>({x:(s.x+.5)*32,y:(s.y+1)*32}))].sort((a,b)=>Math.hypot(a.x-this.player.x,a.y-this.player.y)-Math.hypot(b.x-this.player.x,b.y-this.player.y));
    this.lights.forEach((l,i)=>{const p=positions[i];l.intensity=p?(day?1.5:18)*(1+Math.sin(this.elapsed*8+i)*.06):0;if(p)l.position.set(p.x*SCALE,this.terrain.height(p.x,p.y)+1.7,p.y*SCALE);});
  }
  private updateHud(){
    if(!this.ui)return;const region=this.world.regionAt(this.player.x,this.player.y),min=Math.floor((480+this.model.state.time/50*60)%1440);
    this.ui.update({region:region.name,subtitle:'Mundo 3D · '+region.subtitle,time:`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`,day:Math.floor((this.model.state.time+400)/1200)+1,x:this.player.x,y:this.player.y,prompt:this.fishing?'Fisgar · E ou clique':this.context()?.prompt??'',stations:this.stations(),buildType:this.buildType,buildValid:this.buildValid,boss:this.actors.boss(this.player.x,this.player.y),paused:this.paused});
    if(!this.started||this.ui.isBlocking){this.overlay.hidden=true;return;}this.overlay.hidden=false;
    const f=this.fishing,status=f?f.phase==='waiting'?'Aguardando uma mordida':f.phase==='bite'?'MORDEU! E PARA FISGAR':'Recolhendo o peixe':this.player.waterMode==='swimming'?'Nadando':this.player.waterMode==='wading'?'Caminhando na água':'Terras de Eldoria';
    this.overlay.innerHTML=`<div class="environment-status ${this.player.swimming?'water':''}"><span class="eyebrow">${f?'PESCA':this.player.waterMode!=='dry'?'ÁGUA':'EXPLORAÇÃO 3D'}</span><strong>${status}</strong>${f?`<div class="activity-meter ${f.phase}"><i style="width:${f.progress*100}%"></i></div><small>${f.phase==='bite'?'Pressione E antes que o peixe escape.':'Mover cancela a pesca.'}</small>`:this.player.waterMode!=='dry'?`<small>Profundidade: ${this.player.depth.toFixed(1)} m · ${this.player.swimming?'Energia mantém você na superfície.':'Você pode atravessar as partes rasas.'}</small>${this.player.breath<100?`<div class="activity-meter breath"><i style="width:${this.player.breath}%"></i></div>`:''}`:`<small>${this.activeItem==='hunting_bow'?`${this.model.count('arrow')} flechas · cervos e coelhos fogem ao se aproximar.`:'Q / R girar câmera · roda do mouse para aproximar'}</small>`}</div>`;
  }
  private tick(milliseconds:number){
    const dt=this.lastFrame?Math.min(.25,(milliseconds-this.lastFrame)/1000):.016;this.lastFrame=milliseconds;this.elapsed+=dt;
    const active=this.started&&!this.paused&&!this.ui?.isBlocking&&!this.dead;
    if(active){
      this.model.state.time+=dt;this.autosave+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.player.invincible=Math.max(0,this.player.invincible-dt);
      if(this.held.has('q'))this.cameraAngle+=dt*1.2;if(this.held.has('r'))this.cameraAngle-=dt*1.2;
      const dx=Number(this.held.has('d')||this.held.has('arrowright'))-Number(this.held.has('a')||this.held.has('arrowleft')),dy=Number(this.held.has('s')||this.held.has('arrowdown'))-Number(this.held.has('w')||this.held.has('arrowup'));
      const movement=new THREE.Vector2(dx*Math.cos(this.cameraAngle)+dy*Math.sin(this.cameraAngle),-dx*Math.sin(this.cameraAngle)+dy*Math.cos(this.cameraAngle)).normalize();
      if(movement.lengthSq()&&this.fishing)this.cancelFishing('Você recolheu a linha ao se mover.');
      this.player.depth=this.terrain.waterDepth(this.player.x,this.player.y);this.player.waterMode=waterMode(this.player.depth);this.player.swimming=this.player.waterMode==='swimming';
      if(this.dodgeTime>0){this.dodgeTime-=dt;this.move(this.dodge.x*260*dt,this.dodge.y*260*dt);}
      else if(this.knock.length()>4){this.move(this.knock.x*dt,this.knock.y*dt);this.knock.multiplyScalar(Math.exp(-dt*14));}
      else if(!this.action&&!this.fishing&&movement.lengthSq()){
        const running=this.held.has('shift')&&this.model.state.energy>1&&!this.player.swimming;
        const speed=this.player.swimming?45:this.player.waterMode==='wading'?49:running?130:82;
        this.player.heading=Math.atan2(movement.x,movement.y);this.move(movement.x*speed*dt,movement.y*speed*dt);if(running)this.model.state.energy=Math.max(0,this.model.state.energy-dt*11);
        this.stepTimer-=dt;if(!this.player.swimming&&this.stepTimer<=0){this.audio.play('step');this.stepTimer=running?.27:.42;}
        this.player.action=running?'run':'walk';if(this.player.waterMode!=='dry'){this.rippleTimer-=dt;if(this.rippleTimer<=0){this.ripple(this.player.x,this.player.y);this.rippleTimer=.35;}}
      }else this.player.action='idle';
      if(this.player.swimming){const drained=waterDrain(this.player.depth,this.model.state.energy,dt);this.model.state.energy=drained.energy;if(drained.damage){this.player.breath=Math.max(0,this.player.breath-dt*16);if(this.player.breath<=0)this.model.state.health=Math.max(0,this.model.state.health-drained.damage);}}else{this.player.breath=Math.min(100,this.player.breath+dt*30);if(!this.action&&!this.held.has('shift'))this.model.state.energy=Math.min(this.model.maxEnergy,this.model.state.energy+dt*12);}
      if(this.player.swimming&&this.action)this.action=null;
      if(this.action){this.player.action=this.action.type;this.action.time-=dt;if(this.action.time<=0){const done=this.action.finish;this.action=null;done?.();}}
      if(this.fishing)this.player.action='fish';this.updateFishing(dt);this.actors.update(dt);this.updateProjectiles(dt);this.collectLoot();
      this.model.state.mana=Math.min(this.model.maxMana,this.model.state.mana+dt*2.5);
      if(this.poison>0){this.poison-=dt;this.model.state.health=Math.max(0,this.model.state.health-dt*2);}
      if(this.model.state.health<=0)this.die();
      this.model.state.position={x:this.player.x,y:this.player.y};this.player.health=this.model.state.health;
      if(this.pointerDown&&!this.buildType)this.attack();if(this.buildType)this.updateBuild();
      const region=this.world.regionAt(this.player.x,this.player.y);if(region.id!==this.lastRegion){this.lastRegion=region.id;this.model.visit(region.id);if(region.id!=='valley')this.ui.toast(region.name);}
      this.regenTimer-=dt;if(this.regenTimer<=0){this.regenTimer=1;this.regenResources();}if(this.autosave>20)this.save(false);
      const settings=this.model.state.settings;this.audio.enabled=settings.sound;this.audio.music=settings.music;this.audio.volume=settings.volume;this.audio.update(dt,this.actors.inCombat);
    }
    const heldItem=this.action?.tool??this.activeItem;this.character.equip(this.fishing?'fishing_rod':(['weapon','tool'].includes(ITEMS[heldItem]?.kind)?heldItem:''),!!this.model.state.equipment.head,!!this.model.state.equipment.chest);
    if(!this.fishing)this.rodLine.visible=this.bobber.visible=false;
    const floor=this.terrain.height(this.player.x,this.player.y);this.character.root.position.set(this.player.x*SCALE,this.player.swimming?-.95:floor,this.player.y*SCALE);this.character.root.rotation.y=this.player.heading;
    this.character.animate(active?dt:dt*.15,active&&['walk','run'].includes(this.player.action),this.dead?'dead':this.player.action,this.player.swimming);
    for(let i=0;i<this.npcViews.length;i++){const n=this.npcViews[i],def=NPCS.find(v=>v.id===n.id)!;const close=Math.hypot(n.x-this.player.x,n.y-this.player.y)<75;const tx=def.x+Math.sin(this.model.state.time*.1+i)*20,ty=def.y+Math.cos(this.model.state.time*.12+i)*14;let moving=false;if(active&&!close&&Math.hypot(tx-n.x,ty-n.y)>3){const a=Math.atan2(tx-n.x,ty-n.y);if(!this.blocked(n.x+Math.sin(a)*dt*12,n.y+Math.cos(a)*dt*12,7,false)){n.x+=Math.sin(a)*dt*12;n.y+=Math.cos(a)*dt*12;n.rig.root.rotation.y=a;moving=true;}}else if(close)n.rig.root.rotation.y=Math.atan2(this.player.x-n.x,this.player.y-n.y);n.rig.root.position.set(n.x*SCALE,this.terrain.height(n.x,n.y),n.y*SCALE);n.rig.root.visible=Math.hypot(n.x-this.player.x,n.y-this.player.y)<1000;n.rig.animate(active?dt:0,moving,'idle',false);}
    this.scenery.sync(this.model.state,active?dt:0);if(this.dirty)this.sync();this.terrain.update(this.elapsed);this.lighting();this.updateCamera(dt);this.effects(dt);
    this.hudTimer-=dt;if(this.hudTimer<=0){this.hudTimer=.12;this.updateHud();}
    // Menus pause the world. Keep their background frame instead of continually
    // submitting a paused scene to the GPU; camera changes still request a draw.
    if(active||this.renderRequested||this.orbiting){this.renderer.render(this.scene,this.camera);this.renderRequested=false;}
  }
}
