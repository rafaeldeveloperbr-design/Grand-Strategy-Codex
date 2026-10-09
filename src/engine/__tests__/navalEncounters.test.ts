import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import { createNavalUnit } from '../../data/navalUnits';
import type { Fleet, NavalState } from '../../types/naval';
import type { War } from '../../types';
import { buildNavalHostility, buildNavalIndexes, buildNavalPresence, fleetCombatNode, navalCombatTick, navalMovementTick, portByProvince, resolveFleetIntercept, seaNodeById } from '../naval';
import { readNavalSave } from '../naval/saveCompatibility';
const node=portByProvince.get('sa_bra_sao_paulo')!.seaNodeId;
const next=seaNodeById.get(node)!.neighbors[0];
const fleet=(tag='BRA',id=tag):Fleet=>({id,name:id,countryTag:tag,units:Array.from({length:6},(_,i)=>createNavalUnit(`${id}-${i}`,'DESTROYER')),locationSeaNodeId:node,status:'HOLDING',movementProgress:0,route:[]});
const war=(a='BRA',b='COG'):War=>({id:`${a}-${b}`,attacker:a,defender:b,startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]});
const combat=(state:NavalState,wars:War[]=[war()],day=-190000)=>navalCombatTick(state,wars,day,provincesData,[]);
const pair=():NavalState=>({fleets:[fleet(),fleet('COG')],battles:[]});
describe('Logical naval encounters',()=>{
  it('BRA and COG HOLDING at one node start combat on the first tick',()=>{
    expect(countries.find(c=>c.tag==='COG')!.name).toBe('República do Congo');
    expect(countries.find(c=>c.tag==='COD')!.name).toBe('República Democrática do Congo');
    const state=pair(), result=combat(state);
    expect(buildNavalHostility([war()]).get('BRA')?.has('COG')).toBe(true);
    expect(buildNavalHostility([war()]).get('BRA')?.has('COD')).toBeFalsy();
    expect(buildNavalPresence(state.fleets,[war()]).get(node)?.contested).toBe(true);
    expect(result.battles).toHaveLength(1);expect(result.battles[0]).toMatchObject({seaNodeId:node,status:'ACTIVE'});
    expect(result.fleets.every(f=>f.status==='COMBAT')).toBe(true);
  });
  it('neutral fleets do not fight',()=>expect(combat(pair(),[]).battles).toEqual([]));
  it('called allies on the same campaign side do not fight',()=>{
    const wars=[{...war(),campaignId:'root'},{...war('USA','COG'),campaignId:'root'}];
    expect(combat({fleets:[fleet(),fleet('USA')],battles:[]},wars).battles).toEqual([]);
    expect(buildNavalHostility(wars).get('USA')?.has('COG')).toBe(true);
  });
  it.each(['DOCKED','MOVING'] as const)('%s at a port is outside the sea bucket',status=>{
    const own={...fleet(),status,portProvinceId:'sa_bra_sao_paulo'};
    expect(fleetCombatNode(own)).toBeUndefined();expect(combat({fleets:[own,fleet('COG')],battles:[]}).battles).toEqual([]);
  });
  it('excludes a DOCKED status even with a stale sea location',()=>expect(fleetCombatNode({...fleet(),status:'DOCKED'})).toBeUndefined());
  it('excludes invalid nodes',()=>expect(buildNavalIndexes([{...fleet(),locationSeaNodeId:'missing'}]).bySeaNode.size).toBe(0));
  it.each(['HOLDING','COMBAT','RETREATING'] as const)('%s at a valid node is in the logical bucket',status=>expect(fleetCombatNode({...fleet(),status})).toBe(node));
  it('does not engage MOVING mid-edge even with a shared origin',()=>{
    const own={...fleet(),status:'MOVING' as const,route:[next],movementProgress:.5};
    expect(combat({fleets:[own,fleet('COG')],battles:[]}).battles).toEqual([]);
  });
  it('updates arrival before combat in the same movement/combat tick',()=>{
    const own={...fleet(),locationSeaNodeId:next,status:'MOVING' as const,route:[node],movementProgress:.999};
    const fleets=navalMovementTick([own,fleet('COG')],provincesData,[],[war()]);
    expect(fleets[0]).toMatchObject({locationSeaNodeId:node,movementProgress:0});
    expect(combat({fleets,battles:[]}).battles[0].status).toBe('ACTIVE');
  });
  it('joins reinforcements to an existing battle instead of leaving them HOLDING',()=>{
    const state=combat(pair());state.fleets.push(fleet('BRA','reinforcement'));
    const result=combat(state,[war()],-189999);
    expect(result.battles).toHaveLength(1);
    expect(result.battles[0].sideA.concat(result.battles[0].sideB)).toContain('reinforcement');
    expect(result.fleets.find(f=>f.id==='reinforcement')!.status).toBe('COMBAT');
  });
  it('two opposite reinforcements cannot create a second battle on the same node',()=>{
    const state=combat(pair());state.fleets.push(fleet('BRA','new-own'),fleet('COG','new-enemy'),fleet('USA','neutral'));
    const result=combat(state,[war()],-189999);
    expect(result.battles).toHaveLength(1);expect(result.battles[0].sideA.concat(result.battles[0].sideB)).toHaveLength(4);
    expect(result.fleets.find(f=>f.id==='neutral')!.units[0].strength).toBe(100);
    expect(combat(result,[war()],-189998).battles).toHaveLength(1);
  });
  it('is deterministic and roundtrips battle state unchanged through the save reader',()=>{
    const input=pair(),before=structuredClone(input),result=combat(input);
    expect(combat(input)).toEqual(result);expect(input).toEqual(before);
    expect(readNavalSave(JSON.parse(JSON.stringify(result)))).toEqual(result);
  });
  it('retains destroyed participants in battle history while joining reinforcements',()=>{
    const state=combat(pair());state.battles[0].sideA.push('sunk');state.fleets.push(fleet('BRA','reinforcement'));
    expect(combat(state,[war()],-189999).battles[0].sideA).toContain('sunk');
  });
  it('ends an existing encounter when an opposing fleet is logically mid-edge',()=>{
    const state=combat(pair());state.fleets[1]={...state.fleets[1],status:'MOVING',route:[next],movementProgress:.5};
    const strength=state.fleets[1].units[0].strength;
    const result=combat(state,[war()],-189999);
    expect(result.battles[0].status).toBe('ENDED');expect(result.fleets[1].units[0].strength).toBe(strength);
  });
});
describe('Interception destination and feedback',()=>{
  it('HOLDING and COMBAT use current logical node',()=>{
    for(const status of ['HOLDING','COMBAT'] as const)expect(resolveFleetIntercept(fleet(),{...fleet('COG'),status},'BRA',[war()])).toEqual({nodeId:node});
  });
  it('DOCKED uses the port connection, not docking access',()=>expect(resolveFleetIntercept(fleet(),{...fleet('COG'),status:'DOCKED',locationSeaNodeId:undefined,portProvinceId:'sa_bra_sao_paulo'},'BRA',[war()])).toEqual({nodeId:node}));
  it('MOVING snapshots its next route node',()=>expect(resolveFleetIntercept(fleet(),{...fleet('COG'),status:'MOVING',route:[next],movementProgress:.5},'BRA',[war()])).toEqual({nodeId:next}));
  it('RETREATING uses current node when stationary and next node while underway',()=>{
    const target={...fleet('COG'),status:'RETREATING' as const,route:[next]};
    expect(resolveFleetIntercept(fleet(),target,'BRA',[war()])).toEqual({nodeId:node});
    expect(resolveFleetIntercept(fleet(),{...target,movementProgress:.5},'BRA',[war()])).toEqual({nodeId:next});
  });
  it('rejects neutral and same-side allied targets',()=>{
    expect(resolveFleetIntercept(fleet(),fleet('COG'),'BRA',[]).error).toContain('não é hostil');
    expect(resolveFleetIntercept(fleet(),fleet('USA'),'BRA',[{...war(),campaignId:'root'},{...war('USA','COG'),campaignId:'root'}]).error).toContain('não é hostil');
  });
  it('rejects foreign/missing selection, missing target, missing node and busy fleets with distinct reasons',()=>{
    expect(resolveFleetIntercept(fleet('USA'),fleet('COG'),'BRA',[war()]).error).toContain('própria');
    expect(resolveFleetIntercept(undefined,fleet('COG'),'BRA',[war()]).error).toContain('própria');
    expect(resolveFleetIntercept(fleet(),undefined,'BRA',[war()]).error).toContain('não existe');
    expect(resolveFleetIntercept(fleet(),{...fleet('COG'),locationSeaNodeId:'missing'},'BRA',[war()]).error).toContain('node válido');
    expect(resolveFleetIntercept({...fleet(),status:'COMBAT'},fleet('COG'),'BRA',[war()]).error).toContain('combate');
    expect(resolveFleetIntercept({...fleet(),status:'RETREATING'},fleet('COG'),'BRA',[war()]).error).toContain('retirada');
  });
});
