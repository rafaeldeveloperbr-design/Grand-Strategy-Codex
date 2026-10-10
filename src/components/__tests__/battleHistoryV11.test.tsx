// @vitest-environment jsdom
import React, {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {BattleHistoryModal} from '../BattleHistoryModal';
import {AirCombatReportModal} from '../AirCombatReportModal';
import {NavalBattleReportModal} from '../NavalBattleReportModal';
import {useGameModals} from '../../hooks/app/useGameModals';
import {AirZonePanel} from '../AirZonePanel';
import {countries, provincesData} from '../../data/map';
import {createInitialArmies} from '../../data/map/initialState';
import {createAirCombatReport, finishAirCombatReport, formatAirCombatDay} from '../../engine/air/reports';
import {airZones} from '../../engine/air/world';
import {seaNodes} from '../../engine/naval';
import type {CombatResult} from '../../types';
import type {NavalBattle} from '../../types/naval';
const armies=createInitialArmies(countries), attacker=armies.find(a=>a.owner==='BRA')!, defender=armies.find(a=>a.owner==='ARG')!;
const base=Math.floor(Date.UTC(1500,0,1)/86400000);
const land:CombatResult={id:'land',attacker,defender,attackerOriginal:attacker,defenderOriginal:defender,attackerCasualties:2,defenderCasualties:4,winner:'attacker',provinceId:'test',provinceName:'Land location',duration:1,territoryChanged:false,territorialDefenseBonus:false,powerRatio:1,date:{year:1500,month:1,day:2}};
const active=createAirCombatReport('air',airZones[0].id,base,[{wingId:'gone',wingName:'Historical Wing',countryTag:'BRA',type:'FIGHTER',mission:'AIR_SUPERIORITY',initialAircraft:24,finalAircraft:18,aircraftLost:6}]);
const air=finishAirCombatReport({...active,lastCombatDay:base+4},base+7);
const naval:NavalBattle={id:'naval',seaNodeId:seaNodes[0].id,sideA:['a'],sideB:['b'],startedAt:base+2,days:2,status:'ENDED',lossesA:10,lossesB:20,winner:'DRAW',participantSnapshots:{A:[{fleetId:'a',fleetName:'Fleet',countryTag:'BRA',initialShips:{CRUISER:2},finalShips:{CRUISER:1},lostShips:{CRUISER:1}}],B:[]}};
const props=()=>({playerCountryTag:'BRA',battleHistory:[land],navalBattles:[naval],airReports:[air],allCountries:countries,onClose:vi.fn(),onViewBattle:vi.fn(),onViewAirBattle:vi.fn(),onViewNavalBattle:vi.fn()});
afterEach(cleanup);

describe('Battle History V1.1',()=>{
  it('defaults to Todos and combines all three kinds with most recent first',()=>{const {container}=render(<BattleHistoryModal {...props()}/>);expect(screen.getByRole('button',{name:'Todos'}).getAttribute('aria-pressed')).toBe('true');const entries=container.querySelectorAll('.battle-history-item');expect(entries).toHaveLength(3);expect(entries[0].textContent).toContain('Combate aéreo');expect(entries[1].textContent).toContain('Batalha naval');expect(entries[2].textContent).toContain('Land location');});
  it('shows the air location, period, country and accumulated losses without a winner',()=>{render(<BattleHistoryModal {...props()} battleHistory={[]} navalBattles={[]}/>);expect(screen.getByText(airZones[0].name)).toBeTruthy();expect(screen.getByText(`${formatAirCombatDay(base)} → ${formatAirCombatDay(base+7)}`)).toBeTruthy();expect(screen.getByText('BRA')).toBeTruthy();expect(screen.getByText('- 6 aeronaves')).toBeTruthy();expect(screen.queryByText(/Vitória|Derrota|vencedor/i)).toBeNull();});
  it('air click and keyboard use only the air callback',()=>{const p=props();render(<BattleHistoryModal {...p}/>);const entry=screen.getByRole('button',{name:`Abrir relatório aéreo de ${airZones[0].name}`});fireEvent.click(entry);fireEvent.keyDown(entry,{key:'Enter'});expect(p.onViewAirBattle).toHaveBeenCalledTimes(2);expect(p.onViewAirBattle).toHaveBeenCalledWith(air);expect(p.onViewBattle).not.toHaveBeenCalled();expect(p.onViewNavalBattle).not.toHaveBeenCalled();});
  it('naval click and keyboard use only the naval callback and show damage/result',()=>{const p=props();render(<BattleHistoryModal {...p}/>);const entry=screen.getByRole('button',{name:/Abrir relatório naval/});fireEvent.click(entry);fireEvent.keyDown(entry,{key:' '});expect(p.onViewNavalBattle).toHaveBeenCalledTimes(2);expect(p.onViewNavalBattle).toHaveBeenCalledWith(naval);expect(p.onViewBattle).not.toHaveBeenCalled();expect(screen.getByText('Empate')).toBeTruthy();expect(screen.getByText('· Navios perdidos: 1')).toBeTruthy();expect(entry.textContent).toContain('Dano: A 10 / B 20');});
  it('terrestrial click retains the original callback and result presentation',()=>{const p=props();render(<BattleHistoryModal {...p}/>);fireEvent.click(screen.getByRole('button',{name:'Abrir relatório de Land location'}));expect(p.onViewBattle).toHaveBeenCalledWith(land);expect(p.onViewAirBattle).not.toHaveBeenCalled();});
  it.each([['⚔️ Terrestres','Land location'],['⚓ Navais','Batalha naval'],['✈️ Aéreos','Combate aéreo']])('filters %s then restores Todos', (label, expected)=>{const {container}=render(<BattleHistoryModal {...props()}/>);fireEvent.click(screen.getByRole('button',{name:label}));expect(container.querySelectorAll('.battle-history-item')).toHaveLength(1);expect(container.querySelector('.battle-history-item')?.textContent).toContain(expected);fireEvent.click(screen.getByRole('button',{name:'Todos'}));expect(container.querySelectorAll('.battle-history-item')).toHaveLength(3);});
  it('excludes ACTIVE reports and naval battles',()=>{const {container}=render(<BattleHistoryModal {...props()} battleHistory={[]} airReports={[active]} navalBattles={[{...naval,status:'ACTIVE'}]}/>);expect(container.querySelectorAll('.battle-history-item')).toHaveLength(0);expect(screen.getByText('Nenhuma batalha registrada ainda.')).toBeTruthy();});
  it('uses deterministic tie ordering independently from input order',()=>{const other={...air,id:'air2'};const {container,rerender}=render(<BattleHistoryModal {...props()} airReports={[other,air]}/>);const before=Array.from(container.querySelectorAll('.battle-history-item')).map(e=>e.textContent);rerender(<BattleHistoryModal {...props()} airReports={[air,other]}/>);expect(Array.from(container.querySelectorAll('.battle-history-item')).map(e=>e.textContent)).toEqual(before);});
  it('manual air selection closes history and opens the snapshot modal without pause or queue',()=>{
    function Harness(){const modals=useGameModals(),[history,setHistory]=useState(true);return <>{history && <BattleHistoryModal {...props()} onViewAirBattle={r=>{setHistory(false);modals.setAirReport(r);}}/>}{modals.airReport && <AirCombatReportModal report={modals.airReport} playerCountryTag="BRA" countries={countries} onClose={()=>modals.setAirReport(null)}/>}<span>Paused: {String(modals.isPaused)}</span><span>Naval queue: {modals.navalReports.length}</span></>;}
    render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:`Abrir relatório aéreo de ${airZones[0].name}`}));expect(screen.queryByRole('dialog',{name:'Histórico de Batalhas'})).toBeNull();expect(screen.getByText('Historical Wing')).toBeTruthy();expect(screen.getByText('Paused: false')).toBeTruthy();expect(screen.getByText('Naval queue: 0')).toBeTruthy();fireEvent.click(screen.getByText('Fechar'));expect(screen.queryByText('Historical Wing')).toBeNull();
  });
  it('manual naval selection opens the existing naval modal',()=>{
    function Harness(){const [selected,setSelected]=useState<NavalBattle|null>(null);return selected?<NavalBattleReportModal battle={selected} playerCountryTag="BRA" countries={countries} onClose={()=>setSelected(null)}/>:<BattleHistoryModal {...props()} onViewNavalBattle={setSelected}/>;}
    render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:/Abrir relatório naval/}));expect(screen.getByText('EMPATE')).toBeTruthy();expect(screen.getByText('Fleet')).toBeTruthy();
  });
});

describe('AirZonePanel report lifecycle',()=>{
  const panel={id:air.zoneId,state:{wings:[],engagements:[],reports:[active,{...air,id:'ended'}]},ctx:{countries,provinces:provincesData,wars:[],relations:[]},player:'BRA',battles:[],onClose:vi.fn(),onLocate:vi.fn()};
  it('shows active combat and only counts ended reports in the zone',()=>{render(<AirZonePanel {...panel}/>);expect(screen.getByText('Combate aéreo ativo: sim · Relatórios encerrados: 1')).toBeTruthy();});
  it('shows no active combat for old saves and ignores other zones',()=>{const {rerender}=render(<AirZonePanel {...panel} state={{wings:[],engagements:[]}}/>);expect(screen.getByText('Combate aéreo ativo: não · Relatórios encerrados: 0')).toBeTruthy();rerender(<AirZonePanel {...panel} state={{wings:[],engagements:[],reports:[{...air,zoneId:airZones[1].id}]}}/>);expect(screen.getByText('Combate aéreo ativo: não · Relatórios encerrados: 0')).toBeTruthy();});
});
