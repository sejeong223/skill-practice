import assert from 'node:assert/strict';
import test from 'node:test';
import Module from 'node:module';
import { requireTS, world04Harness } from './world04-test-fixtures.mjs';
const { overlapRect, sweepRect, sweepCircleRect } = requireTS('../src/game/systems/world04Geometry.ts');
const { getWorld04Layout } = requireTS('../src/game/data/world04Scrapyard.ts');
const { advanceTerrainState, createTerrainState } = requireTS('../src/game/systems/world04TerrainState.ts');
const { PlayerController } = requireTS('../src/game/systems/PlayerController.ts');
const { World04AirSystem } = requireTS('../src/game/systems/World04AirSystem.ts');
const { World04GroundSystem } = requireTS('../src/game/systems/World04GroundSystem.ts');
const { DEFAULT_PLAYER_TUNING } = requireTS('../src/game/entities/playerTypes.ts');
const KeyCodes = requireTS('phaser/src/input/keyboard/keys/KeyCodes.js');
const load = Module._load;
Module._load = function(name, parent, main) {
  if (name === 'phaser') return { Input: { Keyboard: { JustDown(key) { const down=key.justDown; key.justDown=false; return down; } } } };
  return load.call(this,name,parent,main);
};
const { InputManager, toKeybindMap } = requireTS('../src/game/input/InputManager.ts');
Module._load = load;

test('saved Digit1 binds to Phaser key code 49 and produces a real dash edge once', () => {
  const keys = new Map();
  const scene = { game:{loop:{frame:1}},input:{keyboard:{
    addKey(name) { const code=KeyCodes[name]; assert.equal(typeof code,'number',`Unknown Phaser key ${name}`); const key={isDown:false,justDown:false}; keys.set(code,key); return key; },
    removeKey() {},
  }}};
  const input=new InputManager(scene,toKeybindMap({dash:'Digit1'}));
  const key=keys.get(49); assert.ok(key); key.isDown=true; key.justDown=true;
  assert.equal(input.getSnapshot().dashPressed,true);
  scene.game.loop.frame++; assert.equal(input.getSnapshot().dashPressed,false);
  for (let digit=0;digit<10;digit++) assert.equal(KeyCodes[toKeybindMap({dash:`Digit${digit}`}).dash[0]],48+digit);
  input.destroy();
});

test('Arcade floating point edge contact is safe, real overlap and relative sweep remain lethal', () => {
  const scrap={x:424,y:472,width:48,height:32};
  const edge={x:472-1e-12,y:464,width:72,height:40};
  assert.equal(overlapRect(edge,scrap),false);
  assert.equal(sweepRect(edge,{...edge,y:460},scrap,scrap),false);
  assert.equal(overlapRect({...edge,x:471.99},scrap),true);
  assert.equal(sweepRect({x:300,y:464,width:72,height:40},{x:520,y:464,width:72,height:40},scrap,scrap),true);
  const body={x:100,y:100,width:72,height:40};
  assert.equal(sweepCircleRect(body,body,{x:80,y:80},{x:80,y:80},22),false);
  assert.equal(sweepCircleRect(body,body,{x:80,y:100},{x:80,y:100},22),true);
});

test('normal movement can retreat from the zero-warning rise at both 60 and 30 input updates', () => {
  const rise=getWorld04Layout('world-04-stage-1').terrain.find(t=>t.kind==='rise');
  for (const fps of [60,30]) {
    const h=world04Harness(rise.rect.x+rise.triggerInset-36), dt=1000/fps;
    const input={getSnapshot:()=>({left:true,right:false,jumpPressed:false})};
    const controller=new PlayerController(h.player,input,DEFAULT_PLAYER_TUNING);
    let before={...h.player.body}, state={...createTerrainState(rise),phase:'retreat'};
    for (let i=0;i<Math.ceil(rise.reactMs/dt);i++) {
      controller.update(i*dt,dt); h.move(h.player.x+h.player.body.velocity.x*dt/1000);
      const after={...h.player.body};
      const step=advanceTerrainState(rise,state,{before,after,grounded:true,velocityX:h.player.body.velocity.x,velocityY:0},dt);
      assert.equal(step.dangerRects.some(r=>overlapRect(after,r)),false,`${fps}fps frame ${i}`);
      state=step.state; before=after;
    }
    assert.ok(h.player.body.x+72<rise.rect.x);
  }
});

test('dash expiry exposes current contact without replaying the protected previous-frame contact', () => {
  for (const kind of ['saw','cable']) {
    const h=world04Harness(40), l=getWorld04Layout('world-04-stage-1');
    const definition=kind==='saw' ? {id:'saw',kind,triggerX:80,fromX:160,toX:160,centerY:480,radius:22,periodMs:1800} :
      {id:'cable',kind,triggerX:80,rect:{x:160,y:460,width:16,height:44},periodMs:2200,offMs:0,warningMs:250};
    h.port.kill=(id,risk)=>{if(risk==='attack'&&h.port.isDashing())return false;h.deaths.push(id);return true;};
    const system=kind==='saw'?new World04AirSystem(h.scene,h.player,{...l,objects:[definition]},h.port):
      new World04GroundSystem(h.scene,h.player,{clearSurfaceModifier(){},launchFromSurface(){return true;}},{...l,objects:[definition]},h.port);
    h.setDashing(true);h.move(136);assert.equal(system.update(16),false);assert.equal(h.deaths.length,0);
    h.setDashing(false);h.move(220);assert.equal(system.update(16),false);assert.equal(h.deaths.length,0);
    h.move(178);assert.equal(system.update(16),true);assert.equal(h.deaths.length,1);
    system.destroy();
  }
});

test('dense layouts retain full obstacle counts and room after ceilings and conveyor presses', () => {
  for (let n=1;n<=4;n++) {
    const layout=getWorld04Layout(`world-04-stage-${n}`);
    assert.ok(layout.objects.length+layout.terrain.length>=20);
    for (const cell of layout.cells.filter(c=>['dash-tunnel','oil-electric'].includes(c.template))) {
      const ceiling=layout.solids.find(s=>s.role==='ceiling'&&s.x>=cell.x&&s.x<cell.x+cell.width);
      const scrap=layout.objects.find(o=>o.kind==='scrap'&&o.rect.x>=cell.x&&o.rect.x<cell.x+cell.width);
      assert.ok(scrap.rect.x-(ceiling.x+ceiling.width)>=112,'body width plus jump ascent');
    }
    for (const press of layout.objects.filter(o=>o.kind==='press')) {
      const belt=layout.objects.find(o=>o.kind==='belt'&&o.triggerX===press.triggerX);
      assert.ok(press.rect.x-(belt.rect.x+belt.rect.width)>=80,'standing/braking space outside moving belt');
    }
  }
});
