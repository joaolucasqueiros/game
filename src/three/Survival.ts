export type WaterMode = 'dry'|'wading'|'swimming';
export function waterMode(depth:number):WaterMode{return depth>.95?'swimming':depth>.12?'wading':'dry';}
export function waterDrain(depth:number, energy:number, dt:number){
  const mode=waterMode(depth);
  return {mode,energy:mode==='swimming'?Math.max(0,energy-5*dt):energy,damage:mode==='swimming'&&energy<=0?8*dt:0};
}
export type FishingPhase='waiting'|'bite'|'reeling'|'caught'|'missed';
/** A timing challenge, driven by game time so menus also pause the bite window. */
export class FishingSession {
  phase:FishingPhase='waiting'; elapsed=0; phaseTime=0;
  constructor(public x:number,public y:number,private wait=2.5){}
  update(dt:number){
    this.elapsed+=dt;this.phaseTime+=dt;
    if(this.phase==='waiting'&&this.phaseTime>=this.wait){this.phase='bite';this.phaseTime=0;}
    else if(this.phase==='bite'&&this.phaseTime>2){this.phase='missed';this.phaseTime=0;}
    else if(this.phase==='reeling'&&this.phaseTime>=1.1){this.phase='caught';this.phaseTime=0;}
  }
  hook(){if(this.phase==='bite'){this.phase='reeling';this.phaseTime=0;return true;}return false;}
  get progress(){return this.phase==='waiting'?Math.min(1,this.phaseTime/this.wait):this.phase==='bite'?Math.max(0,1-this.phaseTime/2):Math.min(1,this.phaseTime/1.1);}
}
