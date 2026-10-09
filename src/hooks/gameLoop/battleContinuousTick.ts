import type { AirState } from '../../types/air';
import { getAirSupportForBattle, getAirSuperiorityModifier } from '../../engine/air';
import { recordBattleWarCasualties } from '../../engine/diplomacy/warResolution';
import { politicalBattleOutcome } from '../../engine/politics';
import { battleEndFeedback } from '../../components/militaryPresentation';
/**
 * battleContinuousTick.ts - FIX RECUO - TYPED
 */
import { processBattleDay, synchronizeBattle, getBattleParticipants, createBattleHostility } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import type {
  Army,
  Province,
  Country,
  War,
  BattleExtended,
  Recruitment,
  BuildingConstruction,
  CombatResult,
  RetreatInfo,
  BattleSideReport,
  BattleSideSnapshot,
} from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import { calculateArmySize } from '../../engine/combat/combatCalculations';
import { transferProvince } from '../../engine/territoryTransfer';
import { applyMilitaryCasualties } from '../../engine/population';
import type { CountryTechState } from '../../types/technology';
import { calculateTechBonuses } from '../../engine/technology';
import { getBuildingLevel } from '../../data/buildings';
import { buildLogisticsNetworks } from '../../engine/logistics';
import type { DiplomaticRelation } from '../../types';



type FinalResultEnriched = CombatResult & {
  retreatInfo?: RetreatInfo | null;

  isStackwipe?: boolean;

  totalAttackerInitial?: number;
  totalDefenderInitial?: number;

  attackerReinfInitial?: number;
  defenderReinfInitial?: number;

  attackerCurrentTroops?: number;
  defenderCurrentTroops?: number;

  participantDetails?: Array<{
    id: string;
    name: string;
    owner: string;
    side: 'attacker' | 'defender';
    initial: number;
    final: number;
    loss: number;
  }>;

  reinforcementInitialSize?: Record<string, number>;
};

type Params = {
  air?: AirState;
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  relations?: DiplomaticRelation[];
  currentActiveBattles: BattleExtended[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  playerTechState: CountryTechState;
  botTechStates: Map<string, CountryTechState>;
  addLog: (msg: string) => void;
  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;
  setActiveBattles: (b: BattleExtended[]) => void;
  setArmies: (a: Army[]) => void;
  setBattleHistory: React.Dispatch<
    React.SetStateAction<CombatResult[]>
  >;

  setBattleReport: React.Dispatch<
    React.SetStateAction<CombatResult | null>
  >;
  setIsPaused: (p: boolean) => void;
  activeBattlesRef: React.MutableRefObject<BattleExtended[]>;
  cancelProvinceActivities: (provinceId: string, oldOwner: string, newOwner: string, rec: Recruitment[], cons: BuildingConstruction[], provs: Province[]) => { recruitments: Recruitment[]; constructions: BuildingConstruction[]; provinces: Province[] };
};

function buildBattleSideReport(
  initial: BattleSideSnapshot,
  final: BattleSideSnapshot
): BattleSideReport {
  const regimentTypes = new Set([
    ...Object.keys(initial.regimentComposition),
    ...Object.keys(final.regimentComposition),
  ] as Array<keyof typeof initial.regimentComposition>);

  const regimentComposition: BattleSideReport['regimentComposition'] = {};

  for (const type of regimentTypes) {
    regimentComposition[type] = {
      initial: initial.regimentComposition[type] ?? 0,
      final: final.regimentComposition[type] ?? 0,
    };
  }

  return {
    initialTroops: initial.troops,
    finalTroops: final.troops,
    casualties: Math.max(0, initial.troops - final.troops),

    initialOrganization: initial.organization,
    finalOrganization: final.organization,

    initialMorale: initial.morale,
    finalMorale: final.morale,

    initialSupply: initial.supply,
    finalSupply: final.supply,

    attack: initial.attack,
    defense: initial.defense,
    shock: initial.shock,
    siege: initial.siege,

    regimentComposition,
  };
}

export function processBattleContinuous(p: Params) {
  let { armies, provinces, countries, wars, recruitments, buildingConstructions } = p;
  let retreats=0, annihilations=0;
  const stillActiveBattles: BattleExtended[] = [];
  if (!p.currentActiveBattles.length) {p.activeBattlesRef.current=[];return {armies,provinces,countries,currentActiveBattles:stillActiveBattles,wars,recruitments,buildingConstructions,retreats,annihilations};}
  const armyOwners = new Set(armies.map(a => a.owner));
  const logistics = buildLogisticsNetworks({countries:countries.filter(c => armyOwners.has(c.tag)),provinces,wars,relations:p.relations ?? []});
  const unitBonuses = new Map(countries.map(country => {
    const state = country.tag === p.playerCountryTag ? p.playerTechState : p.botTechStates.get(country.tag);
    return [country.tag,state ? calculateTechBonuses(state).combatPowerBonus : {}] as const;
  }));
  const fortificationMultipliers = new Map(countries.map(country => {
    const state = country.tag === p.playerCountryTag ? p.playerTechState : p.botTechStates.get(country.tag);
    return [country.tag,state ? calculateTechBonuses(state).fortificationMultiplier : 1] as const;
  }));
  const hostility = createBattleHostility(wars);
  const processed = new Set<string>();
  for (const original of [...p.currentActiveBattles].sort((a,b) => a.id.localeCompare(b.id))) {
    if (processed.has(original.id)) continue;
    processed.add(original.id);
    const province = provinces.find(pr => pr.id === original.provinceId);
    const beforeById = new Map(armies.map(a => [a.id,a]));
    const historical = getBattleParticipants(original,original.participantArmyIds.flatMap(id => {
      const a = beforeById.get(id) ?? original.participantSnapshots?.[id]; return a ? [a] : [];
    }));
    const local = historical.filter(a => beforeById.has(a.id) && a.location === original.provinceId && !a.retreatProtectionDays && !a.embarkedFleetId && calculateArmySize(a) > 0);
    const hostile = local.filter(a => local.some(b => original.participantSides[a.id] !== original.participantSides[b.id] && hostility(a,b)));
    const hostilityEnded = local.length > 0 && hostile.length === 0 && local.some(a => original.participantSides[a.id] === 'attacker') && local.some(a => original.participantSides[a.id] === 'defender');
    const cancelled = !province || hostilityEnded;
    const departed = new Set(local.filter(a => !hostile.includes(a)).map(a => a.id));
    if (!cancelled) armies = armies.map(a => departed.has(a.id) ? {...a,inCombat:false} : a);
    const battle = {...original, participantArmyIds: cancelled ? original.participantArmyIds : original.participantArmyIds.filter(id => !departed.has(id))};
    const repaired = synchronizeBattle(battle,armies) ?? battle;
    const combatMultipliers = new Map<string,number>();
    const airModifiers: NonNullable<BattleExtended['airModifiers']> = {};
    if (province) for (const tag of [...new Set(hostile.map(a => a.owner))].sort()) {
      const ctx = {provinces,countries,armies,wars,relations:p.relations ?? []};
      const superiority = p.air ? getAirSuperiorityModifier(p.air,province.id,tag,ctx) : 1;
      const cas = p.air ? getAirSupportForBattle(p.air,repaired,tag,ctx) : 0;
      airModifiers[tag] = {superiority,cas}; combatMultipliers.set(tag,superiority + cas);
    }
    const armiesBefore = armies;
    const result = cancelled ? {
      battle: {...original, endReason: province ? 'hostility_ended' as const : 'territory_invalid' as const, phase:'BREAK_RETREAT' as const},
      armies: armies.map(a => original.participantArmyIds.includes(a.id) ? {...a,inCombat:false} : a),
      finished:true, winner:'defender' as const, retreatInfo:null,
    } : processBattleDay(repaired,armies,province!,provinces,combatMultipliers,fortificationMultipliers,logistics,unitBonuses,{wars,relations:p.relations ?? []});
    const afterById = new Map(result.armies.map(a => [a.id,a]));
    const countryCasualties = {...(original.warCasualtiesByCountry ?? {[original.attackerCountryId]:original.attackerCasualties,[original.defenderCountryId]:original.defenderCasualties})};
    for (const before of historical) {
      if (!beforeById.has(before.id)) continue;
      const after = afterById.get(before.id);
      const loss = Math.max(0,calculateArmySize(before) - (after ? calculateArmySize(after) : 0));
      countryCasualties[before.owner] = (countryCasualties[before.owner] ?? 0) + loss;
    }
    result.battle = {...result.battle, warCasualtiesByCountry:countryCasualties, airModifiers};
    armies = result.armies;
    provinces = applyMilitaryCasualties(provinces,armiesBefore,armies);
    if (!result.finished) { stillActiveBattles.push(result.battle); continue; }
    const fb = result.battle;
    retreats += Object.values(fb.retreatOutcomes ?? {}).filter(o => o.reason==='retreat').length;
    annihilations += Object.values(fb.retreatOutcomes ?? {}).filter(o => o.reason==='no_retreat').length;
    const attacker = afterById.get(fb.attackerArmyId) ?? fb.participantSnapshots?.[fb.attackerArmyId] ?? fb.attackerInitialSnapshot;
    const defender = afterById.get(fb.defenderArmyId) ?? fb.participantSnapshots?.[fb.defenderArmyId] ?? fb.defenderInitialSnapshot;
    if (!attacker || !defender) continue;
    const participantDetails = [...new Set([...original.participantArmyIds,...Object.keys(fb.participantSnapshots ?? {})])].sort().map(id => {
      const initialArmy = fb.participantSnapshots?.[id] ?? beforeById.get(id);
      const finalArmy = afterById.get(id);
      const initial = fb.participantInitialSizes?.[id] ?? fb.reinforcementInitialSize?.[id] ?? (id === original.attackerArmyId ? fb.attackerInitialTroops : id === original.defenderArmyId ? fb.defenderInitialTroops : calculateArmySize(initialArmy ?? attacker));
      const final = finalArmy ? calculateArmySize(finalArmy) : 0;
      return {id,name:initialArmy?.name ?? id,owner:initialArmy?.owner ?? '',side:fb.participantSides[id],initial,final,loss:Math.max(0,initial-final)};
    });
    const total = (side:'attacker'|'defender', field:'initial'|'final'|'loss') => participantDetails.filter(d => d.side === side).reduce((sum,d) => sum+d[field],0);
    const combatReport = fb.attackerCombatSnapshot && fb.defenderCombatSnapshot && fb.attackerFinalCombatSnapshot && fb.defenderFinalCombatSnapshot ? {
      attacker:buildBattleSideReport(fb.attackerCombatSnapshot,fb.attackerFinalCombatSnapshot),
      defender:buildBattleSideReport(fb.defenderCombatSnapshot,fb.defenderFinalCombatSnapshot),
      endReason:fb.endReason ?? 'side_empty',fortLevel:province ? getBuildingLevel(province,'fortress') : 0,fortDefenseBonus:0,
    } : undefined;
    if (combatReport) for (const side of ['attacker','defender'] as const) {
      combatReport[side].initialTroops=total(side,'initial'); combatReport[side].finalTroops=total(side,'final'); combatReport[side].casualties=total(side,'loss');
    }
    let report: FinalResultEnriched = {
      id:fb.id,endReason:fb.endReason,phase:fb.phase,attacker,defender,attackerOriginal:fb.attackerInitialSnapshot ?? attacker,defenderOriginal:fb.defenderInitialSnapshot ?? defender,
      attackerCasualties:total('attacker','loss'),defenderCasualties:total('defender','loss'),winner:result.winner,
      provinceId:fb.provinceId,provinceName:province?.name ?? fb.provinceId,duration:fb.durationDays ?? Math.max(0,fb.daysTotal-fb.daysRemaining),
      territoryChanged:false,territorialDefenseBonus:false,powerRatio:1,date:p.snapshot.date,retreatInfo:result.retreatInfo,
      participantDetails,totalAttackerInitial:total('attacker','initial'),totalDefenderInitial:total('defender','initial'),
      attackerCurrentTroops:total('attacker','final'),defenderCurrentTroops:total('defender','final'),
      isStackwipe:participantDetails.some(d => fb.retreatOutcomes?.[d.id]?.reason === 'no_retreat'),
      combatReport,countryCasualties,airModifiers,retreatOutcomes:fb.retreatOutcomes,
    };
    wars = recordBattleWarCasualties(wars,fb.id,report);
    const winningArmy = participantDetails.filter(d => d.side === result.winner).map(d => afterById.get(d.id)).find(a => a && calculateArmySize(a)>0 && a.location === fb.provinceId);
    const remainingEnemies = winningArmy && armies.some(a => a.location === fb.provinceId && !a.embarkedFleetId && !a.retreatProtectionDays && calculateArmySize(a)>0 && hostility(a,winningArmy));
    if (!cancelled && province && result.winner === 'attacker' && winningArmy && !remainingEnemies) {
      const rebelReturnOwner = checkRebelTerritoryReturn(winningArmy);
      const occupation = wars.some(w => (w.attacker===winningArmy.owner && w.defender===province.owner)||(w.defender===winningArmy.owner && w.attacker===province.owner));
      const liberation = !!rebelReturnOwner && province.owner.startsWith('rebel_');
      if (occupation || liberation) {
        const newOwner = rebelReturnOwner ?? winningArmy.owner;
        const transferred = transferProvince({provinces,countries,recruitments,constructions:buildingConstructions},province.id,newOwner,{date:p.snapshot.date,liberation});
        ({provinces,countries,recruitments}=transferred); buildingConstructions=transferred.constructions;
        report={...report,territoryChanged:true,newOwner};
        p.addLog(`${newOwner} conquistou ${province.name}`);
      }
    }
    p.setBattleHistory(prev => prev.some(item => item.id === fb.id) ? prev : [report,...prev]);
    if (participantDetails.some(d => d.owner === p.playerCountryTag)) p.addToast(battleEndFeedback(report,p.playerCountryTag,report.territoryChanged), 'info','Fim de batalha');
    if (!cancelled) {
      const winnerCountry=result.winner === 'attacker' ? fb.attackerCountryId : fb.defenderCountryId;
      const loserCountry=result.winner === 'attacker' ? fb.defenderCountryId : fb.attackerCountryId;
      countries=countries.map(c => c.tag===winnerCountry ? politicalBattleOutcome(applyStabilityPrestigeChanges(c,0,2),true,report.attackerCasualties+report.defenderCasualties) : c.tag===loserCountry ? politicalBattleOutcome(applyStabilityPrestigeChanges(c,0,-3),false,report.attackerCasualties+report.defenderCasualties) : c);
    }
    armies=armies.filter(a => calculateArmySize(a)>0);
  }
  p.activeBattlesRef.current=stillActiveBattles; p.setActiveBattles(stillActiveBattles); p.setArmies(armies);
  return {armies,provinces,countries,currentActiveBattles:stillActiveBattles,wars,recruitments,buildingConstructions,retreats,annihilations};
}
