import { describe, expect, it } from 'vitest';
import { assembleMap, countries, mapCapitals, mapLandmasses, mapMetadata, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { northAmerica } from '../../data/map/regions/northAmerica';
import { southAmerica } from '../../data/map/regions/southAmerica';
import { crossRegionConnections } from '../../data/map/crossRegionConnections';
import { createInitialArmies } from '../../data/map/initialState';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { findPath } from '../military/movementEngine';
import { isTerrainType } from '../terrain';
import { buildLogisticsNetworks, getProvinceLogistics } from '../logistics';
import { calculateDemand, calculateProduction, processProvinceMarket } from '../market';
import { normalizePopulation } from '../population';
import { processInternalTrade, findDomesticTradePath } from '../internalTrade';
import { createInitialDiplomacy, declareWar, generateConquestCasusBelli, getCampaigns, processWarResolutionTick, offerAlliance, acceptAlliance, callAllyToWar, respondToWarCall, setOpinion, setTrust } from '../diplomacy';
import { transferProvince } from '../territoryTransfer';
import type { SaveGameV3 } from '../saveSystem';
import { date } from './helpers/southAmericaAudit';
import { queueRecruitment } from '../military/recruitmentEngine';
import { processEconomyTick } from '../../hooks/gameLoop/economyTick';
import { createInitialTechState } from '../technology';
import { ALL_GOODS } from '../market';
import { noop } from './helpers/southAmericaAudit';

const tags=['CAN','USA','MEX','GTM','BLZ','HND','SLV','NIC','CRI','PAN','CUB','HTI','DOM','JAM'];
const byId = new Map(provincesData.map(p=>[p.id,p]));
const route = (from:string,to:string) => {
  const owner=byId.get(from)!.owner;
  const relations=countries.filter(c=>c.tag!==owner).map(c=>({countryA:owner,countryB:c.tag,status:'peace' as const,opinion:0,trust:50,militaryAccess:[c.tag]}));
  return findPath(from,to,provincesData,owner,relations);
};
export function containsPoint(path:string, x:number,y:number) {
  let inside=false;
  for(const ring of path.split('M').filter(Boolean)) {
    const points=ring.replace('Z','').trim().split(/\s*L\s*/).map(point=>point.split(',').map(Number));
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const [xi,yi]=points[i], [xj,yj]=points[j];
      if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
    }
  }
  return inside;
}

describe('World V1 assembly and North America data', () => {
  it('assembles four regions and preserves all South America IDs', () => { const map=assembleMap(mapRegions,crossRegionConnections); expect(map.provincesData).toEqual(provincesData); expect(map.countries).toEqual(countries); expect(mapRegions.map(r=>r.id)).toEqual(['southAmerica','northAmerica','europe','africa']); expect(provincesData).toHaveLength(196); expect(countries).toHaveLength(89); expect(provincesData.filter(p=>p.id.startsWith('sa_')).map(p=>p.id)).toEqual(southAmerica.provinces.map(p=>p.id)); });
  it('contains no duplicate province IDs or country tags', () => { expect(new Set(provincesData.map(p=>p.id)).size).toBe(196); expect(new Set(countries.map(c=>c.tag)).size).toBe(89); });
  it('has complete matching gameplay, geometry and topology rosters', () => { for(const region of mapRegions) { const ids=region.provinces.map(p=>p.id).sort(); expect(region.geometry.map(p=>p.id).sort()).toEqual(ids); expect(region.topology.map(p=>p.id).sort()).toEqual(ids); } });
  it('rejects duplicate countries even when province definitions differ', () => { expect(()=>assembleMap([southAmerica,{...northAmerica,countries:[southAmerica.countries[0]]}])).toThrow('Duplicate country definition'); });
  it.each(tags)('initializes complete country %s with a valid explicit capital and original ownership', tag => { const c=countries.find(c=>c.tag===tag)!; expect(c).toBeDefined(); expect(c.name).not.toBe(tag); expect(c.flag).toBeTruthy(); expect(c.activeLaws).toBeDefined(); expect(c.capitalId).toBe(mapCapitals[tag]); const capital=byId.get(c.capitalId!)!; expect(capital.owner).toBe(tag); expect(c.provinces).toContain(capital.id); for(const id of c.provinces) { const p=byId.get(id)!; expect(p.owner).toBe(tag); expect(p.originalOwner).toBe(tag); expect(p.color).toBe(c.color); expect(isTerrainType(p.terrain)).toBe(true); expect(p.path).toMatch(/^M/); expect(id).toMatch(/^na_[a-z]{3}_[a-z_]+$/); } });
  it.each([['USA',12],['CAN',6],['MEX',6]] as const)('keeps %s at a strategic scale of %i provinces', (tag,count) => expect(countries.find(c=>c.tag===tag)?.provinces).toHaveLength(count));
  it('balances USA above its neighbors without an extreme initial treasury', () => { const usa=countries.find(c=>c.tag==='USA')!, mex=countries.find(c=>c.tag==='MEX')!, can=countries.find(c=>c.tag==='CAN')!; expect(usa.resources.gold).toBeGreaterThan(mex.resources.gold); expect(usa.resources.manpower).toBeGreaterThan(can.resources.manpower); expect(usa.resources.gold).toBeLessThan(mex.resources.gold*2); });
});

describe('World land topology and intentional islands', () => {
  it('validates the eleven declared landmasses without suppressing connectivity checks', () => { const audit=validateMapTopology(provincesData,countries); expect(audit.issues).toEqual([]); expect(audit.valid).toBe(true); expect(audit.components.map(c=>c.length)).toEqual([87,1,2,1,44,4,1,1,6,48,1]); expect(mapLandmasses).toHaveLength(11); });
  it('has only reciprocal existing land edges, without self or repeated neighbors', () => { for(const p of provincesData) { expect(new Set(p.neighbors).size).toBe(p.neighbors.length); for(const id of p.neighbors) { expect(id).not.toBe(p.id); expect(byId.get(id)?.neighbors).toContain(p.id); } } });
  it.each([
    ['na_can_british_columbia','na_usa_pacific_northwest'],['na_usa_texas','na_mex_northern_mexico'],
    ['na_mex_southern_mexico','na_gtm_guatemala'],['na_mex_yucatan','na_blz_belize'],
    ['na_gtm_guatemala','na_hnd_honduras'],['na_gtm_guatemala','na_slv_el_salvador'],
    ['na_hnd_honduras','na_nic_nicaragua'],['na_nic_nicaragua','na_cri_costa_rica'],
    ['na_cri_costa_rica','na_pan_panama'],['na_pan_panama','sa_col_caribe'],
    ['na_hti_haiti','na_dom_dominican_republic'],
  ])('preserves explicit bidirectional border %s ↔ %s', (a,b) => { expect(byId.get(a)?.neighbors).toContain(b); expect(byId.get(b)?.neighbors).toContain(a); });
  it('defines Colombia–Panama once and never mutates regional rosters during assembly', () => { expect(crossRegionConnections).toEqual([['sa_col_caribe','na_pan_panama']]); expect(southAmerica.topology.find(p=>p.id==='sa_col_caribe')?.neighbors).not.toContain('na_pan_panama'); expect(northAmerica.topology.find(p=>p.id==='na_pan_panama')?.neighbors).not.toContain('sa_col_caribe'); expect(()=>assembleMap(mapRegions,[['missing','na_pan_panama']])).toThrow('Invalid cross-region connection'); });
  it.each(['na_cub_cuba','na_jam_jamaica'])('%s has no fabricated land connections', id => expect(byId.get(id)?.neighbors).toEqual([]));
  it.each(['missing-neighbor','invalid-owner','invalid-capital','isolated-province','asymmetric-neighbor'] as const)('continues to reject %s in the expanded map', type => { const p=structuredClone(provincesData), c=structuredClone(countries), target=p.find(p=>p.id==='na_can_northern_canada')!; if(type==='missing-neighbor') target.neighbors.push('missing'); if(type==='invalid-owner') target.owner='missing'; if(type==='invalid-capital') c.find(c=>c.tag==='USA')!.capitalId='missing'; if(type==='isolated-province') { target.neighbors=[]; for(const other of p) other.neighbors=other.neighbors.filter(id=>id!==target.id); } if(type==='asymmetric-neighbor') target.neighbors=[]; const audit=validateMapTopology(p,c); expect(audit.valid).toBe(false); expect(audit.issues.some(i=>i.type===type)).toBe(true); });
  it('rejects a disconnected continental component even when no province is isolated', () => { const ids=new Set(['na_can_northern_canada','na_can_british_columbia']); const p=provincesData.map(p=>({...p,neighbors:p.neighbors.filter(id=>ids.has(id)===ids.has(p.id))})); expect(validateMapTopology(p,countries).issues.some(i=>i.type==='disconnected-components')).toBe(true); });
  it('undeclared isolated provinces still fail a custom-map audit', () => { expect(validateMapTopology([{id:'island',owner:'A',neighbors:[]}],[{tag:'A',provinces:['island']}],{}).valid).toBe(false); });
  it('rejects a fabricated land edge from Florida to Cuba', () => { const p=structuredClone(provincesData); p.find(p=>p.id==='na_cub_cuba')!.neighbors.push('na_usa_florida'); p.find(p=>p.id==='na_usa_florida')!.neighbors.push('na_cub_cuba'); expect(validateMapTopology(p,countries).issues.some(i=>i.type==='unexpected-landmass-connection')).toBe(true); });
});

describe('World geometry and ground routing', () => {
  it('uses global metadata and finite paths with centers inside their own polygons', () => { expect(mapMetadata.id).toBe('world-v1'); expect(mapMetadata.defaultPlayerCountry).toBe('BRA'); for(const p of provincesData) { expect(containsPoint(p.path,p.center.x,p.center.y),p.id).toBe(true); const values=p.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number); for(let i=0;i<values.length;i+=2) { expect(values[i]).toBeGreaterThanOrEqual(0); expect(values[i]).toBeLessThanOrEqual(mapMetadata.bounds.w); expect(values[i+1]).toBeGreaterThanOrEqual(0); expect(values[i+1]).toBeLessThanOrEqual(mapMetadata.bounds.h); } } });
  it('never overlays North America centers on South America geometry', () => { for(const p of provincesData.filter(p=>p.id.startsWith('na_'))) for(const other of provincesData.filter(p=>p.id.startsWith('sa_'))) expect(containsPoint(other.path,p.center.x,p.center.y)).toBe(false); expect(new Set(provincesData.map(p=>`${p.center.x}:${p.center.y}`)).size).toBe(196); });
  it.each([
    ['na_can_ontario','na_usa_washington'],['na_usa_texas','na_mex_central_mexico'],
    ['na_can_ontario','na_mex_central_mexico'],['na_mex_central_mexico','na_pan_panama'],
    ['na_pan_panama','sa_bra_brasilia'],['na_can_british_columbia','sa_arg_buenos_aires'],
  ])('finds a permitted ground route from %s to %s', (from,to) => { const path=route(from,to); expect(path.length).toBeGreaterThan(0); expect(path[path.length-1]).toBe(to); for(const id of path) { expect(byId.get(from)?.neighbors).toContain(id); from=id; } });
  it.each(['na_cub_cuba','na_jam_jamaica','na_hti_haiti','na_dom_dominican_republic'])('cannot route from mainland to %s', id => expect(route('na_usa_florida',id)).toEqual([]));
  it('does not grant diplomatic access just because a continental route exists', () => expect(findPath('na_usa_texas','na_mex_central_mexico',provincesData,'USA',[])).toEqual([]));
});

describe('World existing-system integration', () => {
  it('initializes all 89 national armies at owned capitals with stable IDs', () => { const armies=createInitialArmies(countries); expect(armies).toHaveLength(89); for(const a of armies) { expect(byId.get(a.location!)?.owner).toBe(a.owner); expect(a.location).toBe(mapCapitals[a.owner]); expect(a.regiments.length).toBeGreaterThan(0); } expect(new Set(armies.map(a=>a.id)).size).toBe(89); });
  it('supports ordinary infantry recruitment at all new capitals', () => { for(const tag of tags) { const country=countries.find(c=>c.tag===tag)!, province=byId.get(country.capitalId!)!; const queued=queueRecruitment('infantry',{country,province},`test-${tag}`); expect(queued.success,tag).toBe(true); if(queued.success) { expect(queued.country.resources.gold).toBeLessThan(country.resources.gold); expect(queued.recruitment.provinceId).toBe(province.id); } } });
  it('builds valid capital logistics networks for every new province', () => { const snapshot=buildLogisticsNetworks({provinces:provincesData,countries,relations:createInitialDiplomacy(countries,provincesData),wars:[]}); for(const p of provincesData.filter(p=>p.id.startsWith('na_'))) { const info=getProvinceLogistics(snapshot,p.owner,p.id)!; expect(info.connected).toBe(true); expect(info.originId).toBe(mapCapitals[p.owner]); expect(Number.isFinite(info.efficiency)).toBe(true); } });
  it('initializes viable markets, population, buildings, unrest and domestic trade', () => { const prepared=provincesData.map(p=>({...p,market:processProvinceMarket(p)})), traded=processInternalTrade(prepared); expect(traded).toHaveLength(196); for(const p of provincesData.filter(p=>p.id.startsWith('na_'))) { expect(normalizePopulation(p.population).total).toBe(p.population.total); expect(calculateProduction(p).food).toBeGreaterThanOrEqual(calculateDemand(p).food); expect(p.market?.goods.food.stock).toBeGreaterThan(0); expect(p.buildings.every(b=>b.level>0)).toBe(true); expect(p.unrest).toBe(0); } for(const p of traded) expect(Number.isFinite(p.market!.goods.food.stock)).toBe(true); expect(findDomesticTradePath('na_mex_northern_mexico','na_mex_yucatan',provincesData).length).toBeGreaterThan(0); });
  it('initializes canonical diplomacy for every country pair', () => { const rs=createInitialDiplomacy(countries,provincesData); expect(rs).toHaveLength(89*88/2); expect(rs.every(r=>r.status==='peace')).toBe(true); });
  it('runs 30 full-world economy ticks with finite resources and balanced trade', () => {
    let state={countries:structuredClone(countries),provinces:structuredClone(provincesData)};
    const technology=new Map(countries.map(c=>[c.tag,createInitialTechState(c.tag)]));
    const relations=createInitialDiplomacy(countries,provincesData);
    for(let n=0;n<30;n++) {
      const day=new Date(Date.UTC(1444,10,11+n));
      const tick=processEconomyTick({...state,date:{year:day.getUTCFullYear(),month:day.getUTCMonth()+1,day:day.getUTCDate()},wars:[],relations,
        armies:[],recruitments:[],buildingConstructions:[],allCountries:state.countries,playerCountryTag:'BRA',
        playerTechState:technology.get('BRA')!,botTechStates:technology,addToast:noop,addAILog:noop,addLog:noop,formatGameDate:()=>''});
      state={countries:tick.countries,provinces:tick.provinces};
      for(const good of ALL_GOODS) {
        expect(state.countries.reduce((sum,c)=>sum+(c.trade?.goods[good].imports??0),0)).toBeCloseTo(state.countries.reduce((sum,c)=>sum+(c.trade?.goods[good].exports??0),0),8);
      }
      expect(state.countries.every(c=>Number.isFinite(c.resources.gold)&&c.resources.gold>=0)).toBe(true);
      for(const p of state.provinces) for(const good of ALL_GOODS) expect(Number.isFinite(p.market!.goods[good].stock)&&p.market!.goods[good].stock>=0).toBe(true);
    }
    expect(state.provinces).toHaveLength(196); expect(state.countries).toHaveLength(89);
  });
  it('declares a North America war and resolves surrender using canonical transfers', () => { const provinces=structuredClone(provincesData), initialCountries=structuredClone(countries); let ctx={provinces,countries:initialCountries,relations:createInitialDiplomacy(initialCountries,provinces),wars:[],date}; const cb=generateConquestCasusBelli(ctx,'USA','MEX'); expect(cb.ok).toBe(true); ctx={...ctx,relations:cb.relations}; const declared=declareWar(ctx,'USA','MEX'); expect(declared.ok).toBe(true); let state: Parameters<typeof processWarResolutionTick>[0]={...ctx,...declared,armies:createInitialArmies(initialCountries),activeBattles:[],recruitments:[],constructions:[]}; for(const p of provinces.filter(p=>p.owner==='MEX')) state={...state,...transferProvince(state,p.id,'USA',{date})}; const ended=processWarResolutionTick(state); expect(ended.resolutions[0]).toMatchObject({winner:'USA',loser:'MEX'}); expect(ended.wars).toEqual([]); expect(ended.countries.find(c=>c.tag==='MEX')?.isAnnexed).toBe(true); expect(ended.provinces.find(p=>p.id==='na_mex_central_mexico')?.originalOwner).toBe('MEX'); });
  it('supports an allied call without continent-specific exceptions', () => { let ctx={provinces:provincesData,countries,relations:createInitialDiplomacy(countries,provincesData),wars:[],date}; ctx={...ctx,relations:setTrust(setOpinion(ctx.relations,'USA','CAN',80),'USA','CAN',80)}; const offer=offerAlliance(ctx,'USA','CAN'); const accepted=acceptAlliance({...ctx,relations:offer.relations},'USA','CAN'); expect(accepted.ok,accepted.message).toBe(true); const declared=declareWar({...ctx,relations:accepted.relations},'USA','MEX'); const called=callAllyToWar({...ctx,...declared},'USA','CAN',declared.wars[0].id); expect(called.ok).toBe(false); expect(called.message).toContain('Chamada já enviada'); const proposal=called.relations.flatMap(r=>r.proposals??[]).find(p=>p.kind==='call')!; const joined=respondToWarCall({...ctx,...called},proposal.id,true); expect(joined.ok,joined.message).toBe(true); expect(getCampaigns(joined.wars)[0].attackerParticipants).toContain('CAN'); });
  it('accepts exact world saves and rejects old South America without merging provinces', () => { const world={world:{provinces:provincesData,countries},mapId:'world-v1'} as SaveGameV3; expect(isSaveCompatibleWithActiveMap(world)).toBe(true); expect(isSaveCompatibleWithActiveMap({...world,mapId:'south-america-v1'})).toBe(false); const old=assembleMap([southAmerica]); expect(isSaveCompatibleWithActiveMap({...world,mapId:undefined,world:{provinces:old.provincesData,countries:old.countries}})).toBe(false); expect(isSaveCompatibleWithActiveMap({...world,world:{...world.world,provinces:provincesData.slice(1)}})).toBe(false); });
});
