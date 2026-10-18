import * as THREE from 'three';
import { Materials } from './Materials';

const geometries=new Map<string,THREE.BufferGeometry>();
function geometry(key:string,make:()=>THREE.BufferGeometry){if(!geometries.has(key))geometries.set(key,make());return geometries.get(key)!;}
export class ModelFactory {
  constructor(public materials:Materials){}
  mesh(parent:THREE.Object3D, shape:THREE.BufferGeometry, material:THREE.Material, x=0,y=0,z=0){const m=new THREE.Mesh(shape,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(p:THREE.Object3D,w:number,h:number,d:number,mat:THREE.Material,x=0,y=0,z=0){return this.mesh(p,geometry(`b${w},${h},${d}`,()=>new THREE.BoxGeometry(w,h,d)),mat,x,y,z);}
  sphere(p:THREE.Object3D,r:number,mat:THREE.Material,x=0,y=0,z=0,sx=1,sy=1,sz=1){const m=this.mesh(p,geometry('sphere',()=>new THREE.SphereGeometry(1,12,10)),mat,x,y,z);m.scale.set(r*sx,r*sy,r*sz);return m;}
  cylinder(p:THREE.Object3D,top:number,bottom:number,h:number,mat:THREE.Material,x=0,y=0,z=0){return this.mesh(p,geometry(`c${top},${bottom},${h}`,()=>new THREE.CylinderGeometry(top,bottom,h,10)),mat,x,y,z);}
  beam(p:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material){const m=this.cylinder(p,r*.8,r,a.distanceTo(b),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return m;}
  weapon(id:string){
    const g=new THREE.Group(),wood=this.materials.surface('wood'),metal=this.materials.plain(id.includes('wood')?0x967344:id.includes('copper')?0xb98354:0xbac5c5,.65,.3);
    if(id==='fishing_rod'){
      this.beam(g,new THREE.Vector3(0,0,0),new THREE.Vector3(0,1.8,.12),.025,wood);this.cylinder(g,.07,.07,.14,metal,.07,.2,0).rotation.z=Math.PI/2;
    }else if(id==='hunting_bow'){
      const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,-.6,0),new THREE.Vector3(.18,-.3,0),new THREE.Vector3(.23,0,0),new THREE.Vector3(.18,.3,0),new THREE.Vector3(0,.6,0)]);
      this.mesh(g,new THREE.TubeGeometry(curve,16,.025,6,false),wood);this.beam(g,new THREE.Vector3(0,-.6,0),new THREE.Vector3(0,.6,0),.006,this.materials.plain(0xdbd2b1));
    }else if(id==='staff'){
      this.cylinder(g,.035,.045,1.55,wood,0,.65,0);const orb=this.sphere(g,.16,this.materials.plain(0x73cfdf,.5,.2),0,1.5,0);(orb.material as THREE.MeshStandardMaterial).emissive.set(0x286576);
    }else if(id.includes('axe')||id.includes('pickaxe')){
      this.cylinder(g,.025,.035,.9,wood,0,.3,0);
      if(id.includes('pickaxe')){const m=this.box(g,.57,.08,.08,metal,.1,.69,0);m.rotation.z=.12;}
      else {const blade=this.sphere(g,.2,metal,.13,.67,0,1.3,1,.23);blade.rotation.z=.4;this.box(g,.09,.29,.1,wood,0,.67,0);}
    }else{
      this.cylinder(g,.026,.03,.25,wood,0,-.03,0);this.box(g,.27,.035,.06,metal,0,.1,0);
      const spear=id==='spear',length=spear?1.6:.7;
      if(spear)this.cylinder(g,.025,.035,1.5,wood,0,.6,0);
      const shape=new THREE.Shape();shape.moveTo(-.055,0);shape.lineTo(.055,0);shape.lineTo(.045,length*.85);shape.lineTo(0,length);shape.lineTo(-.045,length*.85);shape.closePath();
      const blade=new THREE.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.008,bevelThickness:.008,bevelSegments:1,steps:1});this.mesh(g,blade,metal,0,spear?1.2:.1,0);
    }
    return g;
  }
  building(type:string,w=6,d=4){
    const g=new THREE.Group(),m=this.materials, wood=m.surface('wood'),stone=m.surface('rock'),steel=m.plain(0x879294,.7,.35);
    if(['home','house','cabin','smithy','tavern'].includes(type)){
      const h=type==='cabin'?2.6:3.3;
      this.box(g,w,.35,d,stone,0,.17,-d/2);this.box(g,w-.12,h,d-.1,m.surface('plaster'),0,h/2+.35,-d/2);
      for(const x of [-w/2+.08,0,w/2-.08])this.box(g,.16,h+.2,d+.05,wood,x,h/2+.4,-d/2);
      for(const y of [.5,h*.55,h+.35])this.box(g,w+.1,.13,d+.1,wood,0,y,-d/2);
      // Gabled roof, with a shingle material and a deep eave casting real shadows.
      const rise=w*.37,roofY=h+.4,half=w/2+.38,roofD=d+.75;
      const roofGeo=new THREE.BufferGeometry();
      const verts=[-half,roofY,-d-.4,0,roofY+rise,-d-.4,-half,roofY,.35,0,roofY+rise,-d-.4,0,roofY+rise,.35,-half,roofY,.35,
        0,roofY+rise,-d-.4,half,roofY,-d-.4,half,roofY,.35,0,roofY+rise,-d-.4,half,roofY,.35,0,roofY+rise,.35];
      roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));roofGeo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,roofD/2,1,0,1,roofD/2,0,roofD/2,0,0,1,0,1,roofD/2,0,0,1,roofD/2,0,roofD/2],2));roofGeo.computeVertexNormals();
      const roofMat=m.surface('roof',type==='smithy'?0xa0b7ae:0xffffff).clone();roofMat.side=THREE.DoubleSide;this.mesh(g,roofGeo,roofMat);
      const triangle=new THREE.Shape();triangle.moveTo(-w/2,0);triangle.lineTo(0,rise);triangle.lineTo(w/2,0);triangle.closePath();const gable=new THREE.ShapeGeometry(triangle);
      this.mesh(g,gable,m.surface('plaster'),0,roofY,.01);this.mesh(g,gable,m.surface('plaster'),0,roofY,-d-.01).rotation.y=Math.PI;
      this.beam(g,new THREE.Vector3(-half,roofY,.39),new THREE.Vector3(0,roofY+rise,.39),.085,wood);this.beam(g,new THREE.Vector3(half,roofY,.39),new THREE.Vector3(0,roofY+rise,.39),.085,wood);
      this.box(g,w+.1,.12,.12,wood,0,roofY,.04);
      const doorX=w*.23;this.box(g,1.02,2.05,.16,wood,doorX,1.37,.08);this.sphere(g,.045,steel,doorX+.29,1.3,.19);
      for(const y of [.65,1.9])this.box(g,.85,.06,.04,steel,doorX,y,.18);
      for(const x of [-w*.27,w*.3]){
        if(Math.abs(x-doorX)<.7)continue;
        this.box(g,.95,1.05,.14,wood,x,2,.1);
        const glass=m.plain(0x96b9b5,.3,.2).clone();glass.emissive.set(0x48452a);this.box(g,.77,.87,.06,glass,x,2,.2);
        this.box(g,.05,.88,.08,wood,x,2,.25);this.box(g,.8,.05,.08,wood,x,2,.25);
        this.box(g,1.13,.18,.38,wood,x,1.36,.13);
        for(let i=0;i<4;i++)this.sphere(g,.12,m.plain(0x9c7759),x-.35+i*.23,1.53,.26);
      }
      this.box(g,.65,2.7,.7,stone,-w*.24,roofY+.5,-d*.72);this.box(g,.8,.13,.85,stone,-w*.24,roofY+1.87,-d*.72);
      if(type==='smithy'){this.box(g,1.4,.9,1,stone,-w*.28,.75,.9);this.box(g,.8,.3,.45,steel,-w*.28,1.45,.9);}
      this.box(g,1.5,.16,.8,stone,doorX,.18,.5);
    }else if(type==='market'){
      for(const x of [-2,2])for(const z of [-1.6,1])this.cylinder(g,.055,.07,2.7,wood,x,1.35,z);
      this.box(g,4.5,.65,1.5,wood,0,.95,.4);
      for(let i=0;i<8;i++){const mat=m.plain(i%2?0xb2a67c:0x795d4a);this.box(g,.58,.08,3.3,mat,-2+i*.57,2.8,-.3).rotation.x=-.06;}
      for(let i=0;i<8;i++)this.sphere(g,.16,m.plain(i%2?0x9c4c38:0x819143),-1.7+i*.46,1.44,.5);
    }else if(type==='well'){
      const outer=new THREE.CylinderGeometry(.85,.88,.7,16,1,true);this.mesh(g,outer,stone,0,.35,0);
      this.mesh(g,new THREE.TorusGeometry(.82,.12,6,16),stone,0,.75,0).rotation.x=Math.PI/2;
      for(const x of [-.95,.95])this.box(g,.1,2.1,.13,wood,x,1.1,0);
      this.box(g,2.5,.18,1.65,m.surface('roof'),0,2.2,0);
    }else if(['workbench','carpentry','alchemy'].includes(type)){
      for(const x of [-.8,.8])for(const z of [-.35,.35])this.box(g,.1,.9,.1,wood,x,.45,z);
      this.box(g,2,.15,1,wood,0,1,0);
      if(type==='alchemy')for(let i=0;i<4;i++){this.cylinder(g,.08,.12,.3,m.plain([0x63999a,0x8e5b61,0x7e8e49,0xb0a158][i]),-.6+i*.38,1.25,0);}
      else {this.box(g,.45,.06,.2,steel,-.4,1.12,0);this.cylinder(g,.035,.035,.65,wood,.4,1.15,0).rotation.z=1.5;}
    }else if(['furnace','forge'].includes(type)){
      this.cylinder(g,.55,.8,1.4,stone,0,.7,0);this.cylinder(g,.25,.32,1.5,stone,0,1.7,0);
      const fire=m.plain(0xffbc54).clone();fire.emissive.set(0xf06415);fire.emissiveIntensity=2;this.sphere(g,.3,fire,0,.5,.55,1,.65,.4);
      if(type==='forge'){this.box(g,.9,.35,.5,steel,1.3,1,0);this.box(g,.4,.85,.5,wood,1.3,.4,0);}
    }else if(type==='chest'){
      this.box(g,1.15,.65,.7,wood,0,.35,0);this.mesh(g,new THREE.CylinderGeometry(.38,.38,1.15,12,1,false,0,Math.PI),wood,0,.67,0).rotation.z=Math.PI/2;
      for(const x of [-.42,.42])this.box(g,.06,.82,.74,steel,x,.43,0);this.box(g,.12,.2,.06,steel,0,.55,.4);
    }else if(type==='torch'){
      this.cylinder(g,.04,.07,1.6,wood,0,.8,0);this.sphere(g,.15,m.plain(0xe5a44a),0,1.65,0,.6,1.8,.6);
      const fire=m.plain(0xffcd6e).clone();fire.emissive.set(0xff8a26);fire.emissiveIntensity=3;this.sphere(g,.11,fire,0,1.7,0,.7,1.9,.7);
    }else if(['fence','gate','animal_pen'].includes(type)){
      const length=type==='animal_pen'?5:1.95;
      for(const x of [-length/2,length/2])this.box(g,.16,1.4,.16,wood,x,.7,0);
      if(type==='gate'){
        const hinge=new THREE.Group();hinge.position.x=-length/2;hinge.rotation.y=-Math.PI*.47;g.add(hinge);
        for(const y of [.5,1.05])this.box(hinge,length,.13,.12,wood,length/2,y,0);
      }else for(const y of [.5,1.05])this.box(g,length,.13,.12,wood,0,y,0);
      if(type==='animal_pen'){for(const z of [-3,-1.5]){this.box(g,length,.13,.12,wood,0,.7,z);}for(const x of [-length/2,length/2])this.box(g,.13,1.1,3,wood,x,.55,-1.5);}
    }else if(type==='wall')this.box(g,2,1.6,.6,stone,0,.8,0);
    else if(type==='garden'){
      this.box(g,3.8,.18,3.8,m.surface('earth'),0,.07,-1.7);
      for(let i=0;i<12;i++)this.sphere(g,.2,m.plain(0x567340),-1.3+(i%4)*.85,.27,-.5-Math.floor(i/4)*.95,1,.7,1);
    }else if(type==='bridge'){
      for(let i=0;i<15;i++)this.box(g,5.8,.18,.44,wood,0,.48,-3.2+i*.45);
      for(const x of [-2.8,2.8]){for(const z of [-3,0,3])this.box(g,.13,1.25,.13,wood,x,1,z);this.box(g,.1,.12,6.4,wood,x,1.52,0);}
    }else if(type==='mine_entrance'||type==='ruin_arch'){
      const width=type==='mine_entrance'?6:7;
      for(const x of [-width/2,width/2])this.box(g,1,4,1.3,stone,x,2,0);
      this.box(g,width+1.2,.8,1.5,stone,0,4.25,0);
      if(type==='mine_entrance')this.box(g,width,3.8,.3,m.plain(0x171d1c),0,1.9,-.6);
      else for(let i=0;i<5;i++)this.box(g,.6,.1,.3,m.plain(0x6fb2ac,.3),-2+i,4.26,.8);
    }else if(type==='sign'){
      this.box(g,.12,1.5,.12,wood,0,.75,0);this.box(g,1.25,.45,.12,wood,0,1.3,0);
    }else if(type==='log')this.cylinder(g,.2,.25,1.5,m.surface('bark'),0,.22,0).rotation.z=Math.PI/2;
    return g;
  }
}

export class HumanModel {
  root=new THREE.Group();body=new THREE.Group();arms:THREE.Group[]=[];legs:THREE.Group[]=[];
  weapon:THREE.Group;helmet:THREE.Mesh;armor:THREE.Mesh;
  private weaponId=''; private phase=0;
  constructor(private f:ModelFactory,color:THREE.ColorRepresentation=0x526b54){
    const m=f.materials,skin=m.plain(0xc39a72),leather=m.surface('leather'),cloth=m.surface('cloth',new THREE.Color(color).lerp(new THREE.Color(0xffffff),.52)),metal=m.plain(0x9faeac,.6,.36);
    this.root.add(this.body);this.body.position.y=.8;
    f.sphere(this.body,.31,cloth,0,.35,0,1.12,1.45,.65);f.cylinder(this.body,.34,.4,.45,cloth,0,-.06,0);
    f.box(this.body,.62,.07,.4,leather,0,.1,0);f.box(this.body,.1,.1,.035,metal,0,.1,.22);
    f.sphere(this.body,.22,skin,0,.96,0,.9,1.2,.88);
    const hair=m.plain(0x49382a);f.sphere(this.body,.225,hair,0,1.07,-.025,1,.65,.95);
    for(const x of [-.085,.085]){f.sphere(this.body,.022,m.plain(0x252c24),x,.99,.18);f.sphere(this.body,.038,skin,x*1.1,.95,.17,1,.6,.5);}
    f.sphere(this.body,.035,skin,0,.94,.2,.7,1,1);f.box(this.body,.08,.012,.02,m.plain(0x7c5041),0,.87,.19);
    for(const side of [-1,1]){
      const arm=new THREE.Group();arm.position.set(side*.36,.6,0);this.body.add(arm);
      f.cylinder(arm,.1,.085,.38,cloth,0,-.16,0);f.cylinder(arm,.075,.06,.34,skin,0,-.48,.02);f.sphere(arm,.073,skin,0,-.67,.035);this.arms.push(arm);
      const leg=new THREE.Group();leg.position.set(side*.16,-.1,0);this.body.add(leg);
      f.cylinder(leg,.115,.08,.43,leather,0,-.2,0);f.cylinder(leg,.08,.075,.37,leather,0,-.54,0);f.sphere(leg,.105,leather,0,-.73,.055,.85,.9,1.55);this.legs.push(leg);
    }
    this.weapon=f.weapon('wood_sword');this.arms[1].add(this.weapon);this.weapon.position.set(0,-.65,.04);this.weapon.rotation.x=Math.PI/2;
    this.helmet=f.sphere(this.body,.24,metal,0,1.09,0,1,.7,1);this.helmet.visible=false;
    this.armor=f.sphere(this.body,.325,metal,0,.36,.015,1.1,1.2,.72);this.armor.visible=false;
    // Hooded traveller's cloak, open at the front.
    f.mesh(this.body,new THREE.ConeGeometry(.42,.9,12,1,true,Math.PI*.22,Math.PI*1.56),cloth,0,.22,-.09).rotation.y=Math.PI;
  }
  equip(weapon:string,helmet:boolean,armor:boolean){
    if(weapon&&weapon!==this.weaponId){this.arms[1].remove(this.weapon);this.weapon=this.f.weapon(weapon);this.weapon.position.set(0,-.65,.04);this.weapon.rotation.x=Math.PI/2;this.arms[1].add(this.weapon);this.weaponId=weapon;}
    this.weapon.visible=!!weapon;
    this.helmet.visible=helmet;this.armor.visible=armor;
  }
  animate(dt:number,moving:boolean,action:string,swimming:boolean){
    this.phase+=dt*(swimming?6:10);const s=Math.sin(this.phase);
    this.body.position.y=.8+(moving?Math.abs(s)*.035:Math.sin(this.phase*.25)*.008);
    this.body.rotation.x=swimming?.36:0;
    this.legs.forEach((l,i)=>l.rotation.x=moving?s*(i?1:-1)*.5:swimming?s*.25:0);
    this.arms.forEach((a,i)=>{a.rotation.set(moving?s*(i?-1:1)*.45:0,0,(i?1:-1)*.08);});
    if(['attack','mine','woodcut','build'].includes(action)){this.arms[1].rotation.set(-1+Math.sin(this.phase*1.8)*.9,.1,-.35);this.body.rotation.y=Math.sin(this.phase*1.5)*.15;}
    else{this.body.rotation.y=0;if(action==='fish'){this.arms[1].rotation.x=-.95;this.arms[0].rotation.x=-.75;}else if(swimming){this.arms.forEach((a,i)=>{a.rotation.x=-1.3+Math.sin(this.phase+(i?Math.PI:0))*.7;a.rotation.z=(i?1:-1)*.6;});}}
    this.root.rotation.z=action==='dead'?Math.PI/2:0;
  }
}

export class AnimalModel {
  root=new THREE.Group();legs:THREE.Group[]=[];head=new THREE.Group();private phase=0;
  constructor(f:ModelFactory,public type:string){
    const deer=type==='deer',rabbit=type==='rabbit',wolf=type==='wolf',boar=type==='boar',sheep=type==='sheep';
    const mat=f.materials.surface('leather',deer?0xc9b082:rabbit?0xb4a494:wolf?0x9a9e96:boar?0x7e786b:sheep?0xe8dfc9:0x9b9c82);
    const size=rabbit?.45:deer?1:boar?.9:.75;
    const body=f.sphere(this.root,.45,mat,0,deer?1:.65,0,1,1,1.85);
    if(rabbit)body.position.y=.5;
    this.head.position.set(0,deer?1.5:rabbit?.65:.85,.67);this.root.add(this.head);
    f.sphere(this.head,.25,mat,0,0,0,.65,1,1.2);f.sphere(this.head,.16,mat,0,-.08,.2,.8,.65,1.1);
    for(const side of [-1,1]){
      const ear=f.sphere(this.head,.12,mat,side*.15,.23,-.05,.5,rabbit?2.8:1.5,.55);ear.rotation.z=-side*.25;
      f.sphere(this.head,.032,f.materials.plain(0x161c16),side*.16,.02,.12);
      if(deer){for(let i=0;i<3;i++){const a=new THREE.Vector3(side*.1,.2,0),b=new THREE.Vector3(side*(.18+i*.14),.65+i*.06,-.12);f.beam(this.head,a,b,.025,f.materials.plain(0x7c6b4c));}}
      if(boar)f.sphere(this.head,.1,f.materials.plain(0xe2d4b1),side*.16,-.12,.25,.35,1,.4);
      for(const z of [-.48,.48]){
        const leg=new THREE.Group();leg.position.set(side*.27,deer?.85:.52,z);this.root.add(leg);
        f.cylinder(leg,.055,.035,deer?.9:.55,mat,0,deer?-.43:-.25,0);f.sphere(leg,.065,f.materials.plain(0x403b31),0,deer?-.85:-.5,.03,1,.7,1.3);this.legs.push(leg);
      }
    }
    this.root.scale.setScalar(size);
  }
  animate(dt:number,moving:boolean){this.phase+=dt*10;this.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(this.phase+(i===0||i===3?0:Math.PI))*.5:0);this.head.rotation.x=moving?Math.sin(this.phase)*.035:Math.sin(this.phase*.2)*.06;}
}
