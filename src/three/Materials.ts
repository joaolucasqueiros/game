import * as THREE from 'three';

export class Materials {
  private maps = new Map<string, THREE.Texture>();
  private cache = new Map<string, THREE.MeshStandardMaterial>();
  async load() {
    const loader = new THREE.TextureLoader();
    const names = ['grass','forest','earth','sand','rock','mud','wood','bark','cobble','roof','plaster','leather','cloth','water'];
    await Promise.all(names.flatMap(name => ['', '_normal', '_rough'].map(async suffix => {
      const texture = await loader.loadAsync(`/assets3d/textures/${name}${suffix}.png`);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      if (!suffix) texture.colorSpace = THREE.SRGBColorSpace;
      this.maps.set(name + suffix, texture);
    })));
    for (const name of ['grass_card','leaves']) {
      const t = await loader.loadAsync(`/assets3d/textures/${name}.png`); t.colorSpace = THREE.SRGBColorSpace; this.maps.set(name,t);
    }
    return this;
  }
  texture(name: string) { return this.maps.get(name)!; }
  surface(name: string, color: THREE.ColorRepresentation = 0xffffff, metalness = 0) {
    const key = `${name}:${color}:${metalness}`;
    if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial({
      map: this.maps.get(name), normalMap: this.maps.get(name+'_normal'), roughnessMap: this.maps.get(name+'_rough'),
      normalScale: new THREE.Vector2(.65,.65), color, roughness: metalness ? .36 : .88, metalness,
    }));
    return this.cache.get(key)!;
  }
  plain(color: THREE.ColorRepresentation, metalness = 0, roughness = .8) {
    const key = `plain:${color}:${metalness}:${roughness}`;
    if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
    return this.cache.get(key)!;
  }
  vegetation(name: 'grass_card'|'leaves') {
    const key = `card:${name}`;
    if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial({ map:this.texture(name),alphaTest:.45,side:THREE.DoubleSide,roughness:1,color:0xffffff,emissive:0x203819,emissiveIntensity:.2 }));
    return this.cache.get(key)!;
  }
}
