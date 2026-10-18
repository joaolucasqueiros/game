import {test,expect,type Page} from '@playwright/test';
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{
 const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error')list.push(m.text())});
 page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5173/'))list.push('External request '+r.url())});
 await page.goto('/');await page.waitForFunction(()=>(window as any).__chronicles?.edition==='3d',null,{timeout:60000});await page.locator('[data-action="start"]').click({timeout:45000});await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.game.started)).toBe(true);
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([])});
async function close(page:Page){if(await page.evaluate(()=>(window as any).__chronicles.ui.isBlocking))await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.ui.isBlocking)).toBe(false);}
async function teleport(page:Page,x:number,y:number){await close(page);await page.evaluate(({x,y})=>{const g=(window as any).__chronicles.game;if(g.blocked(x,y,7,true))throw Error('Blocked teleport');g.teleport(x,y);},{x,y});await page.waitForFunction(() =>{const g=(window as any).__chronicles.game;return Math.abs(g.character.root.position.x-g.player.x/16)<.05});}
async function count(page:Page,id:string){return page.evaluate(id=>(window as any).__chronicles.model.count(id),id)}
async function gather(page:Page,item:string,times:number){
 for(let n=0;n<times;n++){
  const node=await page.evaluate(item=>{
   const g=(window as any).__chronicles.game;
   for(const node of g.world.nodes.filter((n:any)=>n.item===item&&g.model.state.resources[n.id]?.remaining!==0).sort((a:any,b:any)=>Math.hypot(a.x-1120,a.y-1728)-Math.hypot(b.x-1120,b.y-1728))){
    for(const[dx,dy]of [[-35,24],[35,24],[0,38],[0,-38]]){const x=node.x+dx,y=node.y+dy;if(g.blocked(x,y,7,true)||g.terrain.waterDepth(x,y)>.1)continue;g.teleport(x,y);if(g.context()?.kind==='resource'&&g.context()?.id===node.id)return{id:node.id,hp:node.hp};}
   }throw Error('No accessible '+item);
  },item);
  for(let h=0;h<node.hp;h++){await page.keyboard.press('e');await expect.poll(()=>page.evaluate(id=>(window as any).__chronicles.model.state.resources[id]?.remaining,node.id),{timeout:12000}).toBe(node.hp-h-1);}
 }
}
async function craft(page:Page,id:string){await page.locator('.main-nav [data-panel="craft"]').click();await page.locator(`[data-recipe="${id}"]`).click();await expect(page.locator(`[data-craft="${id}"]`)).toBeEnabled();await page.locator(`[data-craft="${id}"]`).click();}
async function build(page:Page,id:string){
 await close(page);await page.locator('.main-nav [data-panel="build"]').click();await page.locator(`[data-build="${id}"]`).click();
 const point=await page.evaluate(()=>{const g=(window as any).__chronicles.game,px=Math.floor(g.player.x/32),py=Math.floor(g.player.y/32);
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){if(!dx&&!dy)continue;const x=(px+dx)*32+16,y=(py+dy)*32+16;g.aimPoint.set(x,y);g.updateBuild();const p=g.screenPoint(x,y);if(g.buildValid&&p.x>365&&p.x<1050&&p.y>270&&p.y<700)return{x,y};}throw Error('No visible plot');
 });
 const screen=await page.evaluate(p=>(window as any).__chronicles.game.screenPoint(p.x,p.y),point);await page.mouse.move(screen.x,screen.y);await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.game.buildValid)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__chronicles.model.state.structures.length);await page.mouse.click(screen.x,screen.y);await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.model.state.structures.length)).toBe(before+1);await page.keyboard.press('Escape');
 return page.evaluate(()=>(window as any).__chronicles.model.state.structures.at(-1));
}

test('true 3D movement, camera orbit, water entry, swimming energy and saved position',async({page})=>{
 expect(await page.evaluate(()=>(window as any).__chronicles.game.renderer.isWebGLRenderer)).toBe(true);
 const before=await page.evaluate(()=>(window as any).__chronicles.game.player.x);await page.keyboard.down('d');await page.waitForTimeout(500);await page.keyboard.up('d');expect(await page.evaluate(()=>(window as any).__chronicles.game.player.x)).toBeGreaterThan(before+10);
 const cam=await page.evaluate(()=>(window as any).__chronicles.game.camera.position.x);await page.keyboard.down('q');await page.waitForTimeout(450);await page.keyboard.up('q');expect(await page.evaluate(()=>(window as any).__chronicles.game.camera.position.x)).not.toBe(cam);
 const entry=await page.evaluate(()=>{const g=(window as any).__chronicles.game;g.cameraAngle=0;
  for(let y=2020;y<=2290;y+=16)for(let x=780;x<1100;x+=4){if(g.terrain.waterDepth(x,y)>.03||g.terrain.waterDepth(x-110,y)<1.1)continue;let clear=true;for(let k=0;k<125;k+=5)if(g.blocked(x-k,y,7,true)){clear=false;break;}if(clear)return{x,y};}throw Error('No safe shore');
 });await teleport(page,entry.x,entry.y);await page.keyboard.down('a');await page.waitForFunction(()=>(window as any).__chronicles.game.player.waterMode==='wading');await page.waitForFunction(()=>(window as any).__chronicles.game.player.swimming);await page.keyboard.up('a');
 const energy=await page.evaluate(()=>(window as any).__chronicles.model.state.energy);await page.waitForTimeout(1000);expect(await page.evaluate(()=>(window as any).__chronicles.model.state.energy)).toBeLessThan(energy);await expect(page.locator('.environment-status')).toContainText('Nadando');
 await page.keyboard.press('F5');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('cronicas-de-ferro.save.v1')!));await page.reload();await page.locator('[data-action="continue"]').click();await page.waitForFunction(()=>(window as any).__chronicles.game.player.swimming);
 expect(await page.evaluate(()=>(window as any).__chronicles.model.state.position)).toEqual(saved.position);expect(await page.evaluate(()=>(window as any).__chronicles.model.state.inventory)).toEqual(saved.inventory);await page.screenshot({path:'test-results/3d-swimming.png'});
});

test('fishing has a timed bite, actual catch and missed-bite outcome',async({page})=>{
 const spot=await page.evaluate(()=>{const g=(window as any).__chronicles.game;
  for(let y=2000;y<2320;y+=12)for(let x=450;x<1050;x+=12){if(g.blocked(x,y,7,true)||g.terrain.waterDepth(x,y)>.03)continue;g.teleport(x,y);if(g.fishingPoint())return{x,y};}throw Error('No fishing shore');
 });await teleport(page,spot.x,spot.y);await page.keyboard.press('6');await page.keyboard.press('e');await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.game.fishing?.phase)).toBe('waiting');
 await page.waitForFunction(()=>(window as any).__chronicles.game.fishing?.phase==='bite');await page.keyboard.press('e');await page.waitForFunction(()=>(window as any).__chronicles.game.fishing===null);expect(await count(page,'fish')).toBe(2);
 await page.keyboard.press('e');await page.evaluate(()=>{(window as any).__fishingAttempt=(window as any).__chronicles.game.fishing;});await page.waitForFunction(()=>(window as any).__chronicles.game.fishing?.phase==='bite');await page.screenshot({path:'test-results/3d-fishing.png'});await page.waitForFunction(()=>(window as any).__chronicles.game.fishing===null);expect(await count(page,'fish')).toBe(2);expect(await page.evaluate(()=>(window as any).__fishingAttempt.phase)).toBe('missed');
});

test('wildlife flees and hunting arrows produce persistent meat loot',async({page})=>{
 await page.keyboard.press('5');
 const id=await page.evaluate(()=>{const g=(window as any).__chronicles.game;const a=g.actors.actors.find((a:any)=>a.type==='rabbit');
  for(let i=0;i<24;i++){const angle=i*Math.PI/12,dx=Math.sin(angle)*65,dy=Math.cos(angle)*65,x=a.x+dx,y=a.y+dy;
   if(!g.blocked(x,y,7,true)&&g.terrain.waterDepth(x,y)<.1&&!g.obstructed(x,y,a.x,a.y)&&!g.obstructed(a.x,a.y,a.x-dx*2.5,a.y-dy*2.5)){g.teleport(x,y);g.cameraTarget.set(g.player.x/16,1,g.player.y/16);return a.id;}}throw Error('No clear hunt position');
 });
 await page.waitForFunction(id=>(window as any).__chronicles.game.actors.actors.find((a:any)=>a.id===id).alert,id);
 const arrows=await count(page,'arrow');let dead=false;
 for(let n=0;n<5&&!dead;n++){
  await page.waitForTimeout(350);const p=await page.evaluate(id=>{const g=(window as any).__chronicles.game,a=g.actors.actors.find((a:any)=>a.id===id);return g.screenPoint(a.x,a.y,.4)},id);await page.mouse.click(p.x,p.y);await page.waitForTimeout(1400);dead=await page.evaluate(id=>(window as any).__chronicles.game.actors.actors.find((a:any)=>a.id===id).dead,id);
 }
 expect(dead).toBe(true);expect(await count(page,'arrow')).toBeLessThan(arrows);expect(await page.evaluate(()=>(window as any).__chronicles.model.state.metrics['hunt:rabbit'])).toBe(1);
 const loot=await page.evaluate(()=>{const m=(window as any).__chronicles.model;return m.state.loot.find((l:any)=>l.items.raw_meat)});expect(loot).toBeTruthy();await page.keyboard.press('F5');await page.reload();await page.locator('[data-action="continue"]').click();expect(await page.evaluate(id=>(window as any).__chronicles.model.state.loot.find((l:any)=>l.id===id).items.raw_meat,loot.id)).toBeGreaterThan(0);
});

test('resource collection, crafting, 3D construction, equipment and inventory still persist',async({page})=>{
 test.setTimeout(420000);
 await gather(page,'wood',3);await gather(page,'stone',2);expect(await count(page,'wood')).toBe(18);expect(await count(page,'stone')).toBe(8);await teleport(page,1120,1728);
 await craft(page,'workbench');const bench=await build(page,'workbench');await teleport(page,(bench.x+1)*32,(bench.y+1)*32+14);await craft(page,'wood_sword');expect(await count(page,'wood_sword')).toBe(1);await close(page);
 await page.locator('.main-nav [data-panel="inventory"]').click();const index=await page.evaluate(()=>(window as any).__chronicles.model.state.inventory.findIndex((s:any)=>s?.item==='wood_sword'));await page.locator(`[data-slot="${index}"]`).click();await page.locator('[data-action="equip"]').click();await close(page);await page.keyboard.press('F5');
 const inv=await page.evaluate(()=>(window as any).__chronicles.model.state.inventory);await page.reload();await page.locator('[data-action="continue"]').click();expect(await page.evaluate(()=>(window as any).__chronicles.model.state.inventory)).toEqual(inv);expect(await page.evaluate(id=>(window as any).__chronicles.model.state.structures.some((s:any)=>s.id===id),bench.id)).toBe(true);await page.screenshot({path:'test-results/3d-building.png'});
});

test('enemy attacks, respawn, village trade and night lighting remain functional in 3D',async({page})=>{
 const position=await page.evaluate(()=>{const g=(window as any).__chronicles.game,a=g.actors.actors.find((a:any)=>a.type==='slime');for(const[dx,dy]of [[30,0],[-30,0],[0,30],[0,-30]])if(!g.blocked(a.x+dx,a.y+dy,7,true))return{x:a.x+dx,y:a.y+dy};throw Error('No encounter position');});
 await teleport(page,position.x,position.y);await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.model.state.health),{timeout:15000}).toBeLessThan(100);
 await page.evaluate(()=>{(window as any).__chronicles.model.state.health=1});await expect(page.locator('[data-action="respawn"]')).toBeVisible({timeout:15000});await page.locator('[data-action="respawn"]').click();await page.waitForTimeout(350);expect(await page.evaluate(()=>(window as any).__chronicles.model.state.position)).toEqual({x:1120,y:1728});
 await teleport(page,1632,1044);await page.keyboard.press('e');await expect(page.locator('.npc-dialogue')).toBeVisible();const coins=await page.evaluate(()=>(window as any).__chronicles.model.state.coins);await page.locator('[data-buy="iron_ore"]').click();expect(await count(page,'iron_ore')).toBe(1);expect(await page.evaluate(()=>(window as any).__chronicles.model.state.coins)).toBe(coins-7);
 await close(page);await page.evaluate(()=>{(window as any).__chronicles.model.state.time=700});await expect.poll(()=>page.evaluate(()=>(window as any).__chronicles.game.sun.intensity)).toBeLessThan(.5);await expect(page.locator('.world-time b')).toContainText('22:');
});
