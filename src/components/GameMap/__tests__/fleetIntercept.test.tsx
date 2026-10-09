// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countries, provincesData } from '../../../data/map';
import { createNavalUnit } from '../../../data/navalUnits';
import { navalCombatTick, orderFleetMove, portByProvince, resolveFleetIntercept, seaNodeById } from '../../../engine/naval';
import type { Fleet } from '../../../types/naval';
import type { War } from '../../../types';
import systemCss from '../../../styles/system.css?raw';
import { GameMap } from '../GameMap';
const node=portByProvince.get('sa_bra_sao_paulo')!.seaNodeId,next=seaNodeById.get(node)!.neighbors[0];
const fleet=(tag='BRA'):Fleet=>({id:tag,name:tag,countryTag:tag,units:[createNavalUnit(tag,'CRUISER')],locationSeaNodeId:node,status:'HOLDING',movementProgress:0,route:[]});
const war:War={id:'BRA-COG',attacker:'BRA',defender:'COG',startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
const provinceClick=vi.fn(),provinceRight=vi.fn(),intercept=vi.fn(),command=vi.fn();
const props={provinces:provincesData,countries,armies:[],recruitments:[],buildingConstructions:[],activeBattles:[],selectedProvince:null,hoveredProvince:null,selectedArmy:null,playerCountryTag:'BRA',onProvinceClick:provinceClick,onProvinceHover:vi.fn(),onArmyClick:vi.fn(),onProvinceRightClick:provinceRight,initialViewBox:{x:0,y:100,w:5040,h:2300}};
afterEach(()=>{cleanup();vi.clearAllMocks();});
function Harness({target=fleet('COG'),wars=[war],selected='BRA',own=fleet()}:{target?:Fleet;wars?:War[];selected?:string|null;own?:Fleet}) {
  const [state,setState]=useState(own),[error,setError]=useState('');
  return <><style>{systemCss}</style><output data-testid="fleet-state">{JSON.stringify(state)}</output><output data-testid="feedback">{error}</output>
    <GameMap {...props} navalState={{fleets:[state,target],battles:[]}} wars={wars} selectedFleetId={selected}
      onFleetOrder={id=>{command(id);const moved=orderFleetMove(state,id,'BRA');if(moved)setState(moved);}}
      onFleetIntercept={id=>{intercept(id);const destination=resolveFleetIntercept(selected===state.id?state:undefined,target,'BRA',wars);if(destination.error){setError(destination.error);return;}const moved=orderFleetMove(state,destination.nodeId!,'BRA');if(moved){command(destination.nodeId);setState(moved);}else setError('Sem rota naval até a frota alvo.');}}/>
  </>;
}
const hit=(tag='COG')=>screen.getByLabelText(`Fleet: ${tag}`).querySelector('[data-fleet-hit-target]')!;
describe('FleetMarker real SVG contextmenu',()=>{
  it.each(['HOLDING','DOCKED','MOVING','COMBAT','RETREATING'] as const)('intercepts %s through the existing movement command',status=>{
    const target={...fleet('COG'),status,...(status==='DOCKED'?{portProvinceId:'sa_bra_sao_paulo',locationSeaNodeId:undefined}:status==='MOVING'?{route:[next],movementProgress:.5}:{})};
    render(<Harness target={target}/>);
    const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2});fireEvent(hit(),event);
    expect(event.defaultPrevented).toBe(true);expect(intercept).toHaveBeenCalledExactlyOnceWith('COG');
    const destination=status==='MOVING'?next:node;
    expect(command).toHaveBeenCalledExactlyOnceWith(destination);
    expect(JSON.parse(screen.getByTestId('fleet-state').textContent!)).toMatchObject({status:'MOVING',destinationSeaNodeId:destination});
    expect(provinceClick).not.toHaveBeenCalled();expect(provinceRight).not.toHaveBeenCalled();
  });
  it.each(['neutral','ally'])('does not issue movement against %s and explains why',kind=>{
    const target=fleet(kind==='ally'?'USA':'COG');
    const wars=kind==='ally'?[{...war,campaignId:'root'},{...war,id:'USA-COG',attacker:'USA',campaignId:'root'}]:[];
    render(<Harness target={target} wars={wars}/>);fireEvent.contextMenu(hit(target.countryTag));
    expect(command).not.toHaveBeenCalled();expect(screen.getByTestId('feedback').textContent).toContain('não é hostil');
  });
  it.each(['COG',null])('cannot give orders when selected fleet is %s',selected=>{
    render(<Harness selected={selected}/>);fireEvent.contextMenu(hit());
    expect(intercept).not.toHaveBeenCalled();expect(command).not.toHaveBeenCalled();
  });
  it('right mouse does not pan, fall through to a SeaNode or select Province',()=>{
    const {container}=render(<Harness/>);fireEvent.click(screen.getByLabelText('Naval Mode'));
    const svg=container.querySelector('svg.map__svg')!,before=svg.getAttribute('viewBox');
    fireEvent.mouseDown(hit(),{button:2,clientX:100,clientY:100});fireEvent.mouseMove(svg,{buttons:2,clientX:250,clientY:250});
    fireEvent.mouseUp(hit(),{button:2});fireEvent.contextMenu(hit(),{button:2});
    expect(svg.getAttribute('viewBox')).toBe(before);expect(command).toHaveBeenCalledTimes(1);
    expect(provinceClick).not.toHaveBeenCalled();expect(provinceRight).not.toHaveBeenCalled();
    command.mockClear();
    fireEvent.contextMenu(screen.getByLabelText(`SeaNode ${next}`).querySelector('[data-sea-node-hit-target]')!,{button:2});
    expect(command).toHaveBeenCalledExactlyOnceWith(next);
  });
  it('opens a naval battle from its SVG hit target despite decorative CSS',()=>{
    const state=navalCombatTick({fleets:[fleet(),fleet('COG')],battles:[]},[war],-190000,provincesData,[]);
    render(<><style>{systemCss}</style><GameMap {...props} wars={[war]} navalState={state}/></>);
    const battle=screen.getByLabelText('Naval battle').querySelector('[data-naval-battle-hit-target]')!;
    expect(getComputedStyle(battle).pointerEvents).toBe('all');fireEvent.click(battle);
    expect(screen.getByLabelText('Naval battle panel').textContent).toContain('ACTIVE');
  });
});
