import test from 'node:test';
import assert from 'node:assert/strict';
import { FishingSession,waterMode,waterDrain } from '../src/three/Survival';
import { WILDLIFE } from '../src/three/Actors3D';
import { ITEMS } from '../src/data/items';
import { GameModel } from '../src/systems/GameModel';

test('depth distinguishes land, wading and swimming, with stamina and exhaustion consequences',()=>{
  assert.equal(waterMode(0),'dry');assert.equal(waterMode(.55),'wading');assert.equal(waterMode(1.3),'swimming');
  assert.equal(waterDrain(.6,50,1).energy,50);assert.equal(waterDrain(2,50,2).energy,40);assert.equal(waterDrain(2,0,1).damage,8);
});
test('fish require the bite window and reeling before a catch; premature input cannot grant fish',()=>{
  const f=new FishingSession(1,2,2.5);assert.equal(f.hook(),false);f.update(2.5);assert.equal(f.phase,'bite');assert.equal(f.hook(),true);f.update(.5);assert.equal(f.phase,'reeling');f.update(.6);assert.equal(f.phase,'caught');
  const missed=new FishingSession(1,2,2);missed.update(2);missed.update(2.1);assert.equal(missed.phase,'missed');assert.equal(missed.hook(),false);
});
test('hunting rewards use real items and meat must be cooked at an actual furnace',()=>{
  for(const animal of Object.values(WILDLIFE)){assert.ok(animal.hp>0);assert.ok(animal.loot.some(l=>l.item==='raw_meat'));for(const loot of animal.loot)assert.ok(ITEMS[loot.item]);}
  const m=new GameModel();m.add('raw_meat',1);m.add('wood',1);assert.equal(m.craft('cooked_meat',new Set(['hand'])).ok,false);assert.equal(m.count('raw_meat'),1);
  assert.equal(m.craft('cooked_meat',new Set(['furnace'])).ok,true);assert.equal(m.count('raw_meat'),0);m.state.health=20;assert.equal(m.consume(m.state.inventory.findIndex(s=>s?.item==='cooked_meat')).ok,true);assert.equal(m.state.health,60);
});
