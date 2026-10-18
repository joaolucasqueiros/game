import * as THREE from 'three';
import { STRUCTURES } from '../data/structures';
import type { SaveState, ResourceNode } from '../types';
import { WorldMap } from '../world/WorldMap';
import { ModelFactory } from './Models3D';
import { Terrain3D, SCALE } from './Terrain3D';

interface Part {batch:THREE.InstancedMesh;index:number;x:number;y:number;z:number;sx:number;sy:number;sz:number;rot:number;stump?:boolean;tilt:number}
export class Scenery3D {
  readonly buildings:THREE.Group[]=[];readonly placed=new Map<string,THREE.Group>();readonly chests=new Map<string,THREE.Group>();
  private parts=new Map<string,Part[]>();private batches:THREE.InstancedMesh[]=[];
  private dummy=new THREE.Object3D();private flames:THREE.Mesh[]=[];private falls=new Map<string,number>();
  private previousDepleted=new Set<string>();
  private initialized=false;
  private chunks=new Map<string,THREE.InstancedMesh>();
  constructor(public scene:THREE.Scene,public world:WorldMap,public terrain:Terrain3D,public factory:ModelFactory){
    const f=factory;
    for(const b of world.buildings){const g=f.building(b.texture,b.width*SCALE,Math.max(3,b.height*SCALE*1.7));g.position.set(b.x*SCALE,terrain.height(b.x,b.y),b.y*SCALE);g.userData.buildingId=b.id;scene.add(g);this.buildings.push(g);}
    for(const decor of world.decorations.filter(d=>['bridge','torch','sign','log'].includes(d.texture))){
      const g=f.building(decor.texture);g.position.set(decor.x*SCALE,terrain.height(decor.x,decor.y),decor.y*SCALE);if(decor.texture==='bridge')g.position.y=.05;scene.add(g);
    }
    for(const chest of world.chests){const g=f.building('chest');g.position.set(chest.x*SCALE,terrain.height(chest.x,chest.y),chest.y*SCALE);scene.add(g);this.chests.set(chest.id,g);}
    this.makeResources();this.makeGroundCover();this.makeHorizon();
  }
  private batch(geometry:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],count:number){const b=new THREE.InstancedMesh(geometry,material,count);b.count=0;b.castShadow=true;b.receiveShadow=true;b.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(b);this.batches.push(b);return b;}
  private add(node:ResourceNode,batch:THREE.InstancedMesh,x:number,y:number,z:number,sx:number,sy:number,sz:number,rot=0,stump=false,tilt=0){
    const key=`${batch.uuid}:${Math.floor(node.x/256)},${Math.floor(node.y/256)}`;
    if(!this.chunks.has(key)){const chunk=this.batch(batch.geometry,batch.material,512);this.chunks.set(key,chunk);}
    batch=this.chunks.get(key)!;
    const part={batch,index:batch.count++,x,y,z,sx,sy,sz,rot,stump,tilt};const parts=this.parts.get(node.id)??[];parts.push(part);this.parts.set(node.id,parts);this.write(node,part,false,0);
    return part;
  }
  private write(node:ResourceNode,p:Part,depleted:boolean,fall:number){
    const base=this.terrain.height(node.x,node.y),d=this.dummy;
    d.position.set(node.x*SCALE+p.x,base+p.y,node.y*SCALE+p.z);d.rotation.set(0,p.rot,p.tilt);
    let scale=depleted&&!p.stump?0:1;
    if(fall>0&&!p.stump){scale=1-fall;d.rotation.z=fall*1.3;d.position.x+=Math.sin(fall*1.5)*p.y;d.position.y=base+Math.cos(fall*1.5)*p.y;}
    d.scale.set(p.sx*scale,p.sy*scale,p.sz*scale);d.updateMatrix();p.batch.setMatrixAt(p.index,d.matrix);p.batch.instanceMatrix.needsUpdate=true;
  }
  private makeResources(){
    const f=this.factory,m=f.materials;
    const trunks=this.batch(new THREE.CylinderGeometry(.11,.21,1,9),m.surface('bark'),1800);
    const crowns=this.batch(new THREE.IcosahedronGeometry(1,2),m.surface('grass',0xb9cf9b),4000);
    const pines=this.batch(new THREE.ConeGeometry(1,1,10),m.surface('forest',0x8aab8b),1000);
    const rocks=this.batch(new THREE.IcosahedronGeometry(1,1),m.surface('rock'),300);
    const ores=this.batch(new THREE.IcosahedronGeometry(1,0),m.plain(0xc1b7a1,.55,.5),500);
    const stems=this.batch(new THREE.CylinderGeometry(.035,.045,.5,5),m.plain(0x617747),600);
    const plants=this.batch(new THREE.SphereGeometry(1,7,5),m.plain(0x6d884d),700);
    const fungi=this.batch(new THREE.SphereGeometry(1,8,5,0,Math.PI*2,0,Math.PI/2),m.plain(0xae6f49),200);
    for(const node of this.world.nodes){
      const seed=Math.sin(node.x*7.13+node.y*.17)*.5+.5;
      if(node.type==='tree'){
        const h=node.texture==='tree_pine'?5.6:4.1+seed*.8;
        this.add(node,trunks,0,.15,0,1,.3,1,0,true);this.add(node,trunks,0,h*.5,0,1,h,1);
        if(node.texture!=='tree_pine')for(let j=0;j<3;j++){const a=j*2.4+seed;this.add(node,trunks,Math.cos(a)*.55,h*.7,Math.sin(a)*.55,.55,h*.55,.55,-a,false,-.65);}
        if(node.texture==='tree_pine')for(let i=0;i<4;i++)this.add(node,pines,0,h*.6+i*.7,0,1.7-i*.28,2,1.7-i*.28,seed*5);
        else for(let i=0;i<6;i++){
          const angle=i*2.4+seed*7,r=i===0?0:1.05;
          this.add(node,crowns,Math.sin(angle)*r,h+.25+(i%3)*.42,Math.cos(angle)*r,1.35+(i%2)*.15,1.2,1.3,angle);
        }
      }else if(node.type==='rock'||node.type==='ore'){
        this.add(node,rocks,0,.44,0,.88,.65,.7,seed*6);
        if(node.type==='ore')for(let i=0;i<5;i++){
          const colors:Record<string,number>={copper_ore:0xbd814a,iron_ore:0x999ea3,silver_ore:0xc1cbd3,gold_ore:0xcda348,crystal:0x80c7cf};
          const part=this.add(node,ores,Math.sin(i*2.4)*.49,.8+(i%2)*.16,Math.cos(i*2.4)*.4,.18,node.item==='crystal'?.6:.2,.18,i);part.batch.setColorAt(part.index,new THREE.Color(colors[node.item]));
        }
      }else if(node.type==='plant'){
        for(let i=0;i<3;i++){
          const x=Math.sin(i*2.5)*.17,z=Math.cos(i*2.5)*.17;
          this.add(node,stems,x,.2,z,1,1,1);
          if(node.item==='mushroom')this.add(node,fungi,x,.43,z,.22,.15,.22);
          else{this.add(node,plants,x,.31,z,.22,.17,.14,i);if(node.item==='flower'||node.item==='berry'){const part=this.add(node,plants,x,.49,z,.095,.08,.095);part.batch.setColorAt(part.index,new THREE.Color(node.item==='flower'?0xd7b590:0x934d58));}}
        }
      }
    }
    for(const b of this.batches){b.instanceMatrix.needsUpdate=true;b.computeBoundingSphere();}
  }
  private makeGroundCover(){
    const m=this.factory.materials,grass=new THREE.InstancedMesh(new THREE.PlaneGeometry(.7,.6),m.vegetation('grass_card'),2100);grass.count=0;
    let seed=72;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<5500&&grass.count<2100;i++){
      const x=random()*3584,z=random()*2816,t=this.world.tileAt(Math.floor(x/32),Math.floor(z/32));
      if(![0,1,6].includes(t)||this.world.isStaticBlocked(x,z,10))continue;
      this.dummy.position.set(x*SCALE,this.terrain.height(x,z)+.27,z*SCALE);this.dummy.rotation.set(0,random()*Math.PI,0);this.dummy.scale.setScalar(.7+random()*.8);this.dummy.updateMatrix();grass.setMatrixAt(grass.count++,this.dummy.matrix);
    }
    grass.receiveShadow=true;grass.computeBoundingSphere();this.scene.add(grass);
  }
  private makeHorizon(){
    const mat=this.factory.materials.surface('rock',0x89938c);
    for(let i=0;i<28;i++){
      const x=i*10-20,z=-14-Math.sin(i*2.4)*10,h=12+(Math.sin(i*3.3)*.5+.5)*19;
      const mountain=new THREE.Mesh(new THREE.ConeGeometry(12,h,7),mat);mountain.position.set(x,h*.5,z);mountain.receiveShadow=true;this.scene.add(mountain);
    }
  }
  sync(state:SaveState,dt:number){
    for(const node of this.world.nodes){
      const depleted=state.resources[node.id]?.remaining===0;
      if(depleted===this.previousDepleted.has(node.id)&&!this.falls.has(node.id))continue;
      if(this.initialized&&depleted&&!this.previousDepleted.has(node.id)&&node.type==='tree')this.falls.set(node.id,.001);
      if(depleted)this.previousDepleted.add(node.id);else this.previousDepleted.delete(node.id);
      let fall=this.falls.get(node.id)??0;
      if(fall>0){fall+=dt*1.7;if(fall>=1){this.falls.delete(node.id);fall=0;}else this.falls.set(node.id,fall);}
      for(const part of this.parts.get(node.id)??[])this.write(node,part,depleted,fall);
    }
    for(const s of state.structures){
      if(this.placed.has(s.id))continue;const def=STRUCTURES[s.type];const g=this.factory.building(s.type,def.width*2,def.height*2);
      const x=(s.x+def.width/2)*32,z=(s.y+def.height)*32;g.position.set(x*SCALE,this.terrain.height(x,z),z*SCALE);this.scene.add(g);this.placed.set(s.id,g);
    }
    for(const [id,g]of this.placed)if(!state.structures.some(s=>s.id===id)){this.scene.remove(g);this.placed.delete(id);}
    for(const [id,g]of this.chests)g.visible=!state.openedChests.includes(id);
    this.initialized=true;
  }
}
