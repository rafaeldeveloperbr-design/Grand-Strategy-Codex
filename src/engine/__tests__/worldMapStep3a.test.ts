import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleMap, countries, mapCapitals, mapLandmasses, mapMetadata, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { asia } from '../../data/map/regions/asia';
import { oceania } from '../../data/map/regions/oceania';
import { crossRegionConnections } from '../../data/map/crossRegionConnections';
import { createInitialArmies } from '../../data/map/initialState';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { DEFAULT_LAWS } from '../../constants/laws';
import { isTerrainType } from '../terrain';
import { findPath, moveArmy } from '../military/movementEngine';
import { findDomesticTradePath } from '../internalTrade';
import { buildLogisticsNetworks, getProvinceLogistics } from '../logistics';
import { queueRecruitment, processRecruitments } from '../military/recruitmentEngine';
import { calculateDemand, calculateProduction, ALL_GOODS } from '../market';
import { createInitialDiplomacy, declareWar, generateConquestCasusBelli, getCampaigns, getCampaignCasualties, getRelation, processWarResolutionTick } from '../diplomacy';
import { transferProvince } from '../territoryTransfer';
import { createRelation, indexRelations, relationKey } from '../diplomacy/diplomacyRelations';
import { hasMilitaryAccess } from '../diplomacy/diplomacySelectors';
import type { SaveGameV3 } from '../saveSystem';
import { army, campaign, date, day, world } from './helpers/southAmericaAudit';

const core = 'RUS TUR GEO ARM AZE IRN IRQ SYR ISR JOR SAU YEM OMN KAZ UZB TKM KGZ TJK AFG PAK IND NPL BGD LKA CHN MNG PRK KOR JPN MMR THA LAO KHM VNM MYS IDN PHL AUS NZL'.split(' ');
const byId = new Map(provincesData.map(p=>[p.id,p]));
const byTag = new Map(countries.map(c=>[c.tag,c]));
const relations = createInitialDiplomacy(countries,provincesData);
function route(from:string,to:string) {
  const owner = byId.get(from)!.owner;
  const access = countries.filter(c=>c.tag!==owner).map(c=>({countryA:owner,countryB:c.tag,status:'peace' as const,opinion:0,trust:50,militaryAccess:[c.tag]}));
  return findPath(from,to,provincesData,owner,access);
}
afterEach(()=>vi.restoreAllMocks());

describe('World Map Step 3A Core',()=>{
  it('indexed diplomacy preserves first-pair semantics and directional access',()=>{
    const first = {...createRelation('RUS','CHN'),militaryAccess:['CHN']};
    const rows = [first,{...first,status:'war' as const},createRelation('IND','PAK')];
    const index = indexRelations(rows);
    expect(index.get(relationKey('CHN','RUS'))).toEqual([first]);
    for (const [visitor,host] of [['RUS','CHN'],['CHN','RUS'],['IND','PAK'],['AUS','NZL'],['RUS','RUS']]) {
      expect(hasMilitaryAccess(index.get(relationKey(visitor,host)) ?? [],visitor,host)).toBe(hasMilitaryAccess(rows,visitor,host));
    }
  });
  it('assembles exactly six regions, 128 countries and 274 unique complete provinces',()=>{
    expect(mapRegions.map(r=>r.id)).toEqual(['southAmerica','northAmerica','europe','africa','asia','oceania']);
    expect(asia.countries.map(c=>c.tag)).toEqual(core.slice(0,37)); expect(oceania.countries.map(c=>c.tag)).toEqual(core.slice(37));
    expect(asia.provinces).toHaveLength(70); expect(oceania.provinces).toHaveLength(8);
    expect(countries).toHaveLength(128); expect(provincesData).toHaveLength(274);
    expect(byId.size).toBe(274); expect(byTag.size).toBe(128);
    for (const region of mapRegions) {
      const ids=region.provinces.map(p=>p.id).sort();
      expect(region.geometry.map(p=>p.id).sort()).toEqual(ids); expect(region.topology.map(p=>p.id).sort()).toEqual(ids);
    }
  });
  it.each(core)('initializes playable core country %s with complete owned gameplay and recruitment',tag=>{
    const c=byTag.get(tag)!; expect(c).toBeDefined(); expect(c.name).not.toBe(tag); expect(c.adjective).toBeTruthy(); expect(c.flag).toBeTruthy();
    expect(c.activeLaws).toEqual(DEFAULT_LAWS); expect(c.capitalId).toBe(mapCapitals[tag]);
    const capital=byId.get(c.capitalId!)!; expect(capital.owner).toBe(tag); expect(c.provinces).toContain(capital.id);
    expect(c.resources.gold).toBeGreaterThan(1000); expect(c.resources.gold).toBeLessThan(6500);
    const queued=queueRecruitment('infantry',{country:c,province:capital},`core-${tag}`);
    expect(queued.success).toBe(true);
    if (queued.success) {
      const completed=processRecruitments([{...queued.recruitment,daysRemaining:1}],[],[queued.country],[queued.province]);
      expect(completed.completedRecruitments).toHaveLength(1); expect(completed.armies[0].location).toBe(capital.id);
      expect(completed.countries[0].resources.gold).toBe(queued.country.resources.gold);
    }
    for (const id of c.provinces) {
      const p=byId.get(id)!; expect(id).toMatch(/^(as|oc)_[a-z]{3}_[a-z_]+$/);
      expect(p.owner).toBe(tag); expect(p.originalOwner).toBe(tag); expect(p.color).toBe(c.color);
      expect(isTerrainType(p.terrain)).toBe(true); expect(p.path).toMatch(/^M/);
      expect(p.population.total).toBeGreaterThan(0); expect(p.maxPopulation).toBeGreaterThan(p.population.total); expect(p.defense).toBeGreaterThan(0); expect(p.unrest).toBe(0);
      expect(calculateProduction(p).food).toBeGreaterThanOrEqual(calculateDemand(p).food);
      for (const good of ALL_GOODS) expect(Number.isFinite(p.market!.goods[good].stock)&&p.market!.goods[good].stock>=0).toBe(true);
    }
  });
  it.each([
    ['RUS','Moscou'],['TUR','Ancara'],['GEO','Tbilisi'],['ARM','Yerevan'],['AZE','Baku'],['IRN','Teerã'],['IRQ','Bagdá'],['SYR','Damasco'],['ISR','Jerusalém'],['JOR','Amã'],
    ['SAU','Riad'],['YEM','Sanaá'],['OMN','Mascate'],['KAZ','Astana'],['UZB','Tashkent'],['TKM','Ashgabat'],['KGZ','Bishkek'],['TJK','Dushanbe'],['AFG','Cabul'],['PAK','Islamabad'],
    ['IND','Nova Délhi'],['NPL','Kathmandu'],['BGD','Dhaka'],['LKA','Colombo'],['CHN','Pequim'],['MNG','Ulaanbaatar'],['PRK','Pyongyang'],['KOR','Seul'],['JPN','Tóquio'],
    ['MMR','Naypyidaw'],['THA','Bangkok'],['LAO','Vientiane'],['KHM','Phnom Penh'],['VNM','Hanói'],['MYS','Kuala Lumpur'],['IDN','Jacarta'],['PHL','Manila'],['AUS','Canberra'],['NZL','Wellington'],
  ])('retains friendly capital %s: %s',(tag,name)=>expect(byId.get(byTag.get(tag)!.capitalId!)?.name).toContain(name));
  it('keeps strategic powers strong at the requested coarse scale',()=>{
    for (const [tag,count] of [['RUS',10],['CHN',8],['IND',6],['AUS',6],['TUR',3],['IRN',3],['JPN',2],['IDN',2]] as const) expect(byTag.get(tag)?.provinces).toHaveLength(count);
    expect(byTag.get('RUS')!.resources.gold).toBeLessThan(byTag.get('FRA')!.resources.gold*2);
  });
  it('validates one connected Afro-Eurasian mainland with intentional island groups',()=>{
    const result=validateMapTopology(provincesData,countries); expect(result.issues).toEqual([]); expect(result.valid).toBe(true);
    expect(mapLandmasses).toHaveLength(17);
    const mainland=mapLandmasses.find(l=>l.id==='eurasian-mainland')!;
    expect(mainland.provinceIds).toHaveLength(162);
    expect(result.components.some(component=>component.length===162&&component.every(id=>mainland.provinceIds.includes(id)))).toBe(true);
    for (const p of provincesData) for (const id of p.neighbors) {expect(id).not.toBe(p.id); expect(byId.get(id)?.neighbors).toContain(p.id);}
    const severed=provincesData.map(p=>({...p,neighbors:p.neighbors.filter(id=>!(p.owner==='RUS'&&id.startsWith('eu_fin_')||p.owner==='FIN'&&id.startsWith('as_rus_')))}));
    // Norway also borders Russia only when explicitly modeled; currently Finland is the bridge.
    expect(validateMapTopology(severed,countries).issues.some(i=>i.type==='disconnected-components')).toBe(true);
  });
  it.each(crossRegionConnections)('declares actual symmetric cross-region edge %s ↔ %s once',(a,b)=>{
    expect(byId.get(a)?.neighbors).toContain(b); expect(byId.get(b)?.neighbors).toContain(a);
    expect(crossRegionConnections.filter(([x,y])=>x===a&&y===b||x===b&&y===a)).toHaveLength(1);
    const regional=mapRegions.flatMap(r=>r.topology);
    expect(regional.find(p=>p.id===a)?.neighbors).not.toContain(b); expect(regional.find(p=>p.id===b)?.neighbors).not.toContain(a);
  });
  it.each([
    ['RUS','KAZ'],['RUS','MNG'],['RUS','CHN'],['TUR','SYR'],['TUR','IRN'],['GEO','ARM'],['GEO','AZE'],['ARM','IRN'],['AZE','IRN'],
    ['IRQ','SYR'],['SYR','JOR'],['ISR','JOR'],['JOR','SAU'],['SAU','YEM'],['SAU','OMN'],['IRN','TKM'],['IRN','AFG'],['IRN','PAK'],
    ['KAZ','UZB'],['UZB','TKM'],['UZB','KGZ'],['UZB','TJK'],['TKM','AFG'],['TJK','AFG'],['KAZ','CHN'],['KGZ','CHN'],['TJK','CHN'],
    ['AFG','PAK'],['PAK','IND'],['IND','NPL'],['IND','BGD'],['IND','MMR'],['IND','CHN'],['CHN','PRK'],['PRK','KOR'],
    ['CHN','VNM'],['CHN','LAO'],['CHN','MMR'],['MMR','THA'],['THA','LAO'],['THA','KHM'],['LAO','VNM'],['LAO','KHM'],['KHM','VNM'],['THA','MYS'],
  ])('models real core border %s ↔ %s',(a,b)=>expect(provincesData.some(p=>p.owner===a&&p.neighbors.some(id=>byId.get(id)?.owner===b))).toBe(true));
  it.each([
    ['eu_prt_lisbon','as_chn_beijing'],['eu_fra_paris','as_ind_delhi'],['eu_fin_helsinki','as_chn_beijing'],['as_tur_ankara','as_ind_delhi'],
    ['af_egy_cairo','as_ind_delhi'],['as_chn_beijing','as_vnm_hanoi'],['as_rus_moscow','as_chn_beijing'],['as_rus_moscow','eu_fra_paris'],['as_ind_delhi','as_mys_kuala_lumpur'],
  ])('routes across contiguous land %s → %s',(from,to)=>{
    const path=route(from,to); expect(path.length).toBeGreaterThan(0); expect(path[path.length-1]).toBe(to);
    for (const id of path) {expect(byId.get(from)?.neighbors).toContain(id); from=id;}
    if (to==='as_chn_beijing') expect(path.some(id=>id.startsWith('as_rus_')) || path[0]?.startsWith('as_')).toBe(true);
  });
  it.each([
    ['as_chn_beijing','as_jpn_kanto'],['as_ind_delhi','as_lka_colombo'],['as_mys_kuala_lumpur','as_idn_java'],['as_mys_kuala_lumpur','as_idn_sumatra'],
    ['as_chn_beijing','as_phl_luzon'],['oc_aus_new_south_wales','as_chn_beijing'],['oc_aus_new_south_wales','oc_nzl_north_island'],
    ['oc_nzl_north_island','oc_nzl_south_island'],['as_idn_java','as_idn_sumatra'],
  ])('never invents sea crossings %s → %s',(from,to)=>expect(route(from,to)).toEqual([]));
  it('uses no Kaliningrad/Lithuania, Egypt/Jordan or Bosporus shortcut',()=>{
    expect(provincesData.filter(p=>p.owner==='LTU').flatMap(p=>p.neighbors).some(id=>id.startsWith('as_rus_'))).toBe(false);
    expect(byId.get('af_egy_cairo')?.neighbors).not.toContain('as_jor_amman');
    expect(byId.get('as_tur_thrace')?.neighbors).not.toContain('as_tur_ankara');
  });
  it('initializes all armies, finite logistics, domestic island barriers and every diplomacy pair',()=>{
    const armies=createInitialArmies(countries); expect(armies).toHaveLength(128);
    const logistics=buildLogisticsNetworks({provinces:provincesData,countries,relations,wars:[]});
    for (const tag of core) {
      const c=byTag.get(tag)!; expect(armies.find(a=>a.owner===tag)?.location).toBe(c.capitalId);
      expect(getProvinceLogistics(logistics,tag,c.capitalId!)?.connected).toBe(true);
      for (const id of c.provinces) expect(Number.isFinite(getProvinceLogistics(logistics,tag,id)!.efficiency)).toBe(true);
    }
    expect(findDomesticTradePath('as_idn_java','as_idn_sumatra',provincesData)).toEqual([]);
    expect(findDomesticTradePath('oc_nzl_north_island','oc_nzl_south_island',provincesData)).toEqual([]);
    expect(relations).toHaveLength(8128); expect(new Set(relations.map(r=>JSON.stringify([r.countryA,r.countryB].sort()))).size).toBe(8128);
  });
  it.each([
    ['RUS','UKR','as_rus_southern_russia','eu_ukr_eastern_ukraine'],['CHN','MNG','as_chn_beijing','as_mng_ulaanbaatar'],['IND','PAK','as_ind_punjab','as_pak_islamabad'],
  ])('runs %s × %s through real combat, casualties and surrender cleanup',(attacker,defender,from,target)=>{
    vi.spyOn(Math,'random').mockReturnValue(.5);
    const initial=world(),ctx={...initial,relations:createInitialDiplomacy(initial.countries,initial.provinces),wars:[],date};
    const cb=generateConquestCasusBelli(ctx,attacker,defender); expect(cb.ok).toBe(true);
    const declared=declareWar({...ctx,relations:cb.relations},attacker,defender); expect(declared.ok).toBe(true);
    const mover=moveArmy(army(attacker,from,6),target,initial.provinces,declared.relations)!; expect(mover).not.toBeNull();
    let state=campaign([mover,army(defender,target,1)],declared.relations,declared.wars);
    for (let n=0;n<180&&state.battleHistory.length===0;n++) state=day(state);
    expect(state.battlesStarted).toBe(1); expect(state.battleHistory).toHaveLength(1);
    expect(state.provinces.find(p=>p.id===target)).toMatchObject({owner:attacker,originalOwner:defender});
    const losses=getCampaignCasualties(getCampaigns(state.wars)[0]); expect(losses.attacker+losses.defender).toBeGreaterThan(0);
    let resolution:Parameters<typeof processWarResolutionTick>[0]={...state,date,activeBattles:state.currentActiveBattles,recruitments:[],constructions:[]};
    for (const p of state.provinces.filter(p=>p.owner===defender)) resolution={...resolution,...transferProvince(resolution,p.id,attacker,{date})};
    const ended=processWarResolutionTick(resolution);
    expect(ended.resolutions).toHaveLength(1); expect(ended.resolutions[0]).toMatchObject({winner:attacker,loser:defender}); expect(ended.wars).toEqual([]); expect(ended.activeBattles).toEqual([]);
    expect(getRelation(ended.relations,attacker,defender)?.status).toBe('peace'); expect(getRelation(ended.relations,attacker,defender)?.lastWarEndedAt).toBeDefined();
    expect(ended.countries.find(c=>c.tag===defender)?.isAnnexed).toBe(true);
    for (const c of ended.countries) expect([...c.provinces].sort()).toEqual(ended.provinces.filter(p=>p.owner===c.tag).map(p=>p.id).sort());
  });
  it('retains world-v1/Save V3 and rejects the previous four-region roster',()=>{
    expect(mapMetadata.id).toBe('world-v1'); expect(mapMetadata.bounds).toEqual({x:0,y:0,w:5040,h:2520});
    const active={mapId:'world-v1',version:3,world:{countries,provinces:provincesData}} as SaveGameV3; expect(isSaveCompatibleWithActiveMap(active)).toBe(true);
    const old=assembleMap(mapRegions.slice(0,4),crossRegionConnections.filter(([a])=>a.startsWith('sa_')));
    expect(old.countries).toHaveLength(89); expect(old.provincesData).toHaveLength(196);
    expect(isSaveCompatibleWithActiveMap({...active,world:{countries:old.countries,provinces:old.provincesData}})).toBe(false);
  });
});
