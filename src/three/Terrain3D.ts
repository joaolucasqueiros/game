import * as THREE from 'three';
import { WorldMap, WORLD_WIDTH, WORLD_HEIGHT, TILE } from '../world/WorldMap';
import { Materials } from './Materials';

export const SCALE = 1 / 16;
export const WATER_LEVEL = 0;
const clamp = THREE.MathUtils.clamp;
export class Terrain3D {
  readonly ground: THREE.Mesh[] = [];
  readonly water: THREE.Mesh;
  private depth: number[][];
  private waterTime = {value:0};
  constructor(public world: WorldMap, scene: THREE.Scene, materials: Materials) {
    this.depth = this.makeDepth();
    const maskData=new Uint8Array(world.width*world.height*4);
    for(let z=0;z<world.height;z++)for(let x=0;x<world.width;x++){const i=(z*world.width+x)*4;maskData[i]=maskData[i+1]=maskData[i+2]=world.tileAt(x,z)===2?255:0;maskData[i+3]=255;}
    const mask=new THREE.DataTexture(maskData,world.width,world.height);mask.minFilter=mask.magFilter=THREE.LinearFilter;mask.needsUpdate=true;
    const names = ['grass','grass','earth','cobble','mud','sand','forest','rock','cobble','earth'];
    for (let kind=0;kind<10;kind++) {
      const vertices:number[]=[], normals:number[]=[], uvs:number[]=[], colors:number[]=[];
      for (let ty=0;ty<world.height;ty++) for(let tx=0;tx<world.width;tx++) {
        if(world.tileAt(tx,ty)!==kind) continue;
        for(let sy=0;sy<2;sy++) for(let sx=0;sx<2;sx++) {
          const points = [[sx,sy],[sx,sy+1],[sx+1,sy],[sx+1,sy],[sx,sy+1],[sx+1,sy+1]];
          for(const [ix,iy] of points) {
            const x=(tx+ix/2)*TILE,z=(ty+iy/2)*TILE;
            vertices.push(x*SCALE,this.height(x,z),z*SCALE);
            const normal = new THREE.Vector3((this.height(x-2,z)-this.height(x+2,z))/(4*SCALE),1,(this.height(x,z-2)-this.height(x,z+2))/(4*SCALE)).normalize();
            normals.push(normal.x,normal.y,normal.z); uvs.push(x/46,z/46);
            const shade=.87+Math.sin(x*.017)*Math.cos(z*.023)*.1;
            colors.push(shade,shade,shade);
          }
        }
      }
      if(!vertices.length)continue;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
      const material=materials.surface(names[kind]).clone();material.vertexColors=true;
      if(kind===2){
        material.onBeforeCompile=shader=>{
          shader.uniforms.uGrass={value:materials.texture('grass')};shader.uniforms.uPathMask={value:mask};
          shader.vertexShader='varying vec2 vLandPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvLandPosition=position.xz;');
          shader.fragmentShader='uniform sampler2D uGrass;uniform sampler2D uPathMask;varying vec2 vLandPosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float road=texture2D(uPathMask,vLandPosition/vec2(${WORLD_WIDTH*SCALE}.0,${WORLD_HEIGHT*SCALE}.0)).r;
            float grain=texture2D(uGrass,vMapUv*1.7).g;
            float edge=smoothstep(.52,.84,road+(grain-.3)*.3);
            diffuseColor.rgb=mix(texture2D(uGrass,vMapUv).rgb,diffuseColor.rgb,edge);`);
        };
      }
      if(kind===7)material.color.set(0x8e929d);
      if(kind===8)material.color.set(0x939285);
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;scene.add(mesh);this.ground.push(mesh);
    }
    const geometry=new THREE.PlaneGeometry(WORLD_WIDTH*SCALE,WORLD_HEIGHT*SCALE,90,72).rotateX(-Math.PI/2);
    geometry.translate(WORLD_WIDTH*SCALE/2,0,WORLD_HEIGHT*SCALE/2);
    const material=new THREE.MeshPhysicalMaterial({color:0x548c88,roughness:.19,metalness:.3,transparent:true,opacity:.71,depthWrite:false,normalMap:materials.texture('water_normal'),normalScale:new THREE.Vector2(.9,.9),side:THREE.DoubleSide,clearcoat:1,clearcoatRoughness:.1});
    material.normalMap!.repeat.set(60,48);
    material.onBeforeCompile=shader=>{
      shader.uniforms.uWaterTime=this.waterTime;
      shader.vertexShader='uniform float uWaterTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        transformed.y += sin(position.x*1.7+uWaterTime*1.2)*.025 + sin(position.z*2.2+uWaterTime*.8)*.022;`);
    };
    this.water=new THREE.Mesh(geometry,material);this.water.position.y=.02;this.water.receiveShadow=true;this.water.renderOrder=2;scene.add(this.water);
  }
  private makeDepth() {
    const w=this.world.width,h=this.world.height;
    const depth=Array.from({length:h},()=>Array(w).fill(100));const queue:[number,number][]=[];
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(this.world.tileAt(x,y)!==4){depth[y][x]=0;queue.push([x,y]);}
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy;
        if(nx>=0&&ny>=0&&nx<w&&ny<h&&depth[ny][nx]>depth[y][x]+1){depth[ny][nx]=depth[y][x]+1;queue.push([nx,ny]);}
      }
    }
    return depth;
  }
  private tileHeight(tx:number,ty:number){
    tx=clamp(tx,0,this.world.width-1);ty=clamp(ty,0,this.world.height-1);
    if(this.world.tileAt(tx,ty)===4)return -Math.min(3.2,this.depth[ty][tx]*.62);
    const t=this.world.tileAt(tx,ty);
    return (t===5?.12:.28)+Math.sin(tx*.32)*Math.cos(ty*.27)*.13;
  }
  height(x:number,z:number){
    const fx=x/TILE-.5, fz=z/TILE-.5, tx=Math.floor(fx),ty=Math.floor(fz), a=fx-tx,b=fz-ty;
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(this.tileHeight(tx,ty),this.tileHeight(tx+1,ty),a),THREE.MathUtils.lerp(this.tileHeight(tx,ty+1),this.tileHeight(tx+1,ty+1),a),b);
  }
  waterDepth(x:number,y:number){return Math.max(0,WATER_LEVEL-this.height(x,y));}
  isWater(x:number,y:number){return this.waterDepth(x,y)>.12;}
  update(time:number){this.waterTime.value=time;const mat=this.water.material as THREE.MeshPhysicalMaterial;mat.normalMap!.offset.set(time*.009,time*.006);}
}
