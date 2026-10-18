import * as THREE from 'three';
import { ENEMIES } from '../data/enemies';
import type { EnemyDef } from '../types';
import type { GameModel } from '../systems/GameModel';
import { WorldMap } from '../world/WorldMap';
import { ModelFactory,HumanModel,AnimalModel } from './Models3D';
import { SCALE,Terrain3D } from './Terrain3D';

export const WILDLIFE:Record<string,EnemyDef>={
  deer:{id:'deer',name:'Cervo do vale',hp:28,damage:0,speed:105,aggro:130,range:24,cooldown:1500,xp:16,coins:0,loot:[{item:'raw_meat',min:2,max:3,chance:1},{item:'leather',min:2,max:2,chance:1}]},
  rabbit:{id:'rabbit',name:'Coelho silvestre',hp:12,damage:0,speed:115,aggro:90,range:15,cooldown:1500,xp:9,coins:0,loot:[{item:'raw_meat',min:1,max:1,chance:1},{item:'fiber',min:1,max:2,chance:.7}]},
  boar:{id:'boar',name:'Javali selvagem',hp:64,damage:12,speed:70,aggro:100,range:29,cooldown:1500,xp:24,coins:0,loot:[{item:'raw_meat',min:3,max:3,chance:1},{item:'leather',min:2,max:3,chance:1},{item:'fang',min:1,max:1,chance:.7}]},
};
export interface Actor3D{ id:string;type:string;def:EnemyDef;x:number;y:number;homeX:number;homeY:number;hp:number;heading:number;cooldown:number;windup:number;phase:number;alert:boolean;dead:boolean;deathTime:number;invincible:number;knockX:number;knockY:number;wild:boolean;group:THREE.Group;rig?:HumanModel|AnimalModel;mark:THREE.Mesh;special:boolean;}
export interface ActorHost{model:GameModel;player:()=>{x:number;y:number;health:number};blocked:(x:number,y:number,r:number,water?:boolean)=>boolean;hitPlayer:(damage:number,x:number,y:number,poison?:boolean)=>void;loot:(x:number,y:number,items:Record<string,number>,coins:number)=>void;text:(x:number,y:number,text:string,color?:string)=>void;particles:(x:number,y:number,color:number)=>void;shoot:(x:number,y:number,angle:number,damage:number,enemy:boolean,magic?:boolean)=>void;notice:(message:string)=>void;}
export class Actors3D{
  actors:Actor3D[]=[];private time=0;
  constructor(private scene:THREE.Scene,world:WorldMap,private terrain:Terrain3D,private f:ModelFactory,private host:ActorHost){
    const spawns=[...world.enemySpawns.map(s=>({...s,wild:false})),
      ...[['deer',920,1830],['deer',1430,1570],['deer',780,1310],['rabbit',1270,1660],['rabbit',970,1800],['rabbit',1090,1860],['rabbit',1200,1450],['boar',850,1000],['boar',640,1180],['boar',1230,1000]].map(([type,x,y],i)=>({id:`wildlife-${type}-${i}`,type:String(type),x:Number(x),y:Number(y),wild:true}))];
    for(const spawn of spawns){
      const def=ENEMIES[spawn.type]??WILDLIFE[spawn.type];let group=new THREE.Group(),rig:HumanModel|AnimalModel|undefined;
      if(['deer','rabbit','boar','wolf'].includes(spawn.type)){rig=new AnimalModel(f,spawn.type);group=rig.root;}
      else if(['goblin','skeleton','archer','guardian','golem'].includes(spawn.type)){
        rig=new HumanModel(f,spawn.type==='goblin'?0x63764b:spawn.type==='guardian'?0x778984:0x9c9987);group=rig.root;
        rig.equip(spawn.type==='archer'?'hunting_bow':spawn.type==='goblin'?'wood_axe':'iron_sword',true,spawn.type!=='goblin');
        if(def.boss||spawn.type==='golem'){group.scale.setScalar(def.boss?2.1:1.65);f.sphere(group,.23,f.materials.plain(0x72b9b5,.4),0,1.35,.31);}
      }else if(spawn.type==='slime'){
        const mat=new THREE.MeshPhysicalMaterial({color:0x7fba54,roughness:.25,metalness:.08,transparent:true,opacity:.92,clearcoat:1});
        f.sphere(group,.6,mat,0,.45,0,1,.75,1);for(const x of [-.2,.2])f.sphere(group,.055,f.materials.plain(0x1c3122),x,.56,.48);
      }else{
        f.sphere(group,.43,f.materials.surface('leather',0x65664d),0,.4,0,1,.65,1.1);f.sphere(group,.25,f.materials.plain(0x4d4234),0,.32,.43);
        for(const side of [-1,1])for(let i=0;i<4;i++){f.beam(group,new THREE.Vector3(side*.2,.4,0),new THREE.Vector3(side*(.8+i*.08),.08,(i-1.5)*.4),.045,f.materials.plain(0x554b37));}
      }
      let x=spawn.x,y=spawn.y;
      for(let i=0;i<40&&host.blocked(x,y,9,false);i++){x=spawn.x+Math.sin(i*2.4)*(20+i*3);y=spawn.y+Math.cos(i*2.4)*(20+i*3);}
      const mark=new THREE.Mesh(new THREE.RingGeometry(.7,1,48),new THREE.MeshBasicMaterial({color:0xda6551,transparent:true,opacity:.5,side:THREE.DoubleSide,depthWrite:false}));mark.rotation.x=-Math.PI/2;mark.visible=false;scene.add(mark);
      scene.add(group);const dead=(host.model.state.enemies[spawn.id]??0)>host.model.state.time;
      group.visible=!dead;group.userData.actorId=spawn.id;
      this.actors.push({id:spawn.id,type:spawn.type,def,x,y,homeX:x,homeY:y,hp:def.hp,heading:0,cooldown:.8,windup:0,phase:1,alert:false,dead,deathTime:0,invincible:0,knockX:0,knockY:0,wild:spawn.wild,group,rig,mark,special:false});
    }
  }
  reset(){for(const a of this.actors){a.dead=(this.host.model.state.enemies[a.id]??0)>this.host.model.state.time;a.hp=a.def.hp;a.x=a.homeX;a.y=a.homeY;a.alert=false;a.phase=1;a.windup=0;a.deathTime=0;a.group.rotation.z=0;a.knockX=a.knockY=0;}}
  get inCombat(){return this.actors.some(a=>a.alert&&!a.dead&&!(['deer','rabbit'].includes(a.type)));}
  boss(x:number,y:number){const a=this.actors.find(a=>a.def.boss&&!a.dead&&Math.hypot(a.x-x,a.y-y)<400);return a?{name:a.def.name+(a.phase===2?' · Fúria ancestral':''),hp:a.hp,max:a.def.hp}:null;}
  private move(a:Actor3D,dx:number,dy:number){
    let moved=false;
    if(!this.host.blocked(a.x+dx,a.y,8,false)){a.x+=dx;moved=true;}
    if(!this.host.blocked(a.x,a.y+dy,8,false)){a.y+=dy;moved=true;}
    // Slide around trunks instead of trying the same blocked line forever.
    if(!moved){const side=Math.sin(a.homeX)>0?1:-1;if(!this.host.blocked(a.x-dy*side,a.y+dx*side,8,false)){a.x-=dy*side;a.y+=dx*side;moved=true;}}
    return moved;
  }
  update(dt:number){
    this.time+=dt;const p=this.host.player();
    for(const a of this.actors){
      a.mark.visible=false;
      if(a.dead){a.deathTime+=dt;a.group.visible=a.deathTime<.5;if(a.group.visible)a.group.rotation.z=Math.min(1,a.deathTime*2)*Math.PI/2;
        if((this.host.model.state.enemies[a.id]??Infinity)<=this.host.model.state.time){a.dead=false;a.hp=a.def.hp;a.x=a.homeX;a.y=a.homeY;a.group.rotation.z=0;}
        else continue;
      }
      const dist=Math.hypot(a.x-p.x,a.y-p.y);a.group.visible=dist<1050;if(!a.group.visible)continue;
      let moving=false;a.cooldown-=dt;a.invincible=Math.max(0,a.invincible-dt);
      if(a.knockX||a.knockY){this.move(a,a.knockX*dt,a.knockY*dt);a.knockX*=Math.exp(-dt*13);a.knockY*=Math.exp(-dt*13);}
      const angle=Math.atan2(p.x-a.x,p.y-a.y);const fleeing=['deer','rabbit'].includes(a.type);
      if(dist<a.def.aggro&&p.health>0)a.alert=true;
      if(dist>a.def.aggro*2.3||Math.hypot(a.x-a.homeX,a.y-a.homeY)>500||p.health<=0)a.alert=false;
      if(a.def.boss&&a.phase===1&&a.hp<=a.def.hp*.5){a.phase=2;a.cooldown=.4;this.host.notice('O Guardião entrou em fúria. Saia do círculo antes do impacto!');}
      if(a.windup>0){
        a.windup-=dt;const r=(a.special?115:a.def.range+10)*SCALE;a.mark.scale.setScalar(r);a.mark.position.set(a.x*SCALE,this.terrain.height(a.x,a.y)+.06,a.y*SCALE);a.mark.visible=true;
        if(a.windup<=0){
          if(a.special){if(dist<115)this.host.hitPlayer(a.def.damage*1.2,a.x,a.y);for(let i=0;i<8;i++)this.host.shoot(a.x,a.y,i*Math.PI/4,a.def.damage*.6,true,true);}
          else if(a.def.ranged)this.host.shoot(a.x,a.y,angle,a.def.damage,true);
          else if(dist<a.def.range+18)this.host.hitPlayer(a.def.damage,a.x,a.y,a.def.poison);
          a.cooldown=a.def.cooldown/1000*(a.phase===2?.65:1);
        }
      }else if(a.alert&&fleeing){a.heading=angle+Math.PI;moving=this.move(a,Math.sin(a.heading)*a.def.speed*dt,Math.cos(a.heading)*a.def.speed*dt);}
      else if(a.alert){
        a.heading=angle;
        if(a.def.boss&&a.phase===2&&a.cooldown<=0&&dist<200){a.windup=.95;a.special=true;}
        else if(dist<a.def.range+8&&a.cooldown<=0){a.windup=a.def.ranged?.6:.45;a.special=false;}
        else if(dist>(a.def.ranged?125:a.def.range*.75)){moving=this.move(a,Math.sin(angle)*a.def.speed*dt,Math.cos(angle)*a.def.speed*dt);}
        else if(a.def.ranged&&dist<90)moving=this.move(a,-Math.sin(angle)*a.def.speed*dt,-Math.cos(angle)*a.def.speed*dt);
      }else{
        const tx=a.homeX+Math.sin(this.time*.13+a.homeX)*45,ty=a.homeY+Math.cos(this.time*.1+a.homeY)*35;
        if(Math.hypot(a.x-tx,a.y-ty)>7){a.heading=Math.atan2(tx-a.x,ty-a.y);moving=this.move(a,Math.sin(a.heading)*a.def.speed*.25*dt,Math.cos(a.heading)*a.def.speed*.25*dt);}
      }
      a.group.position.set(a.x*SCALE,this.terrain.height(a.x,a.y),a.y*SCALE);a.group.rotation.y=a.heading;
      if(a.rig instanceof HumanModel)a.rig.animate(dt,moving,a.windup>0?'attack':'idle',false);else a.rig?.animate(dt,moving);
      if(a.type==='slime'){a.group.scale.y=1+Math.sin(this.time*5)*.08;a.group.position.y+=Math.max(0,Math.sin(this.time*5))*.09;}
    }
  }
  hit(a:Actor3D,damage:number,x:number,y:number){
    if(a.dead||a.invincible>0)return false;a.hp=Math.max(0,a.hp-damage);a.invincible=.12;a.alert=true;
    const angle=Math.atan2(a.x-x,a.y-y);a.knockX=Math.sin(angle)*(a.def.boss?25:130);a.knockY=Math.cos(angle)*(a.def.boss?25:130);
    this.host.text(a.x,a.y,`${Math.round(damage)}`, '#f5cba2');this.host.particles(a.x,a.y,0xc59a6b);
    if(a.hp<=0){a.dead=true;a.deathTime=0;a.alert=false;a.windup=0;const model=this.host.model;
      model.state.enemies[a.id]=model.state.time+(a.def.boss?1e12:a.wild?240:180);model.addXP(a.def.xp);model.metric(a.wild?`hunt:${a.type}`:`kill:${a.type}`);if(a.wild)model.metric('hunt:total');
      const loot:Record<string,number>={};for(const e of a.def.loot)if(Math.random()<=e.chance)loot[e.item]=e.min+Math.floor(Math.random()*(e.max-e.min+1));
      this.host.loot(a.x,a.y,loot,a.def.coins);this.host.text(a.x,a.y,`+${a.def.xp} EXP`,'#b9dcc5');model.changed();
      if(a.def.boss)this.host.notice('Guardião derrotado. Recolha a Lâmina do Amanhecer e o núcleo ancestral.');
    }
    return true;
  }
}
