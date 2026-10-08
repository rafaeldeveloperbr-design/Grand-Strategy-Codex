import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleMap, countries, mapCapitals, mapLandmasses, mapMetadata, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { southAmerica } from '../../data/map/regions/southAmerica';
import { northAmerica } from '../../data/map/regions/northAmerica';
import { europe } from '../../data/map/regions/europe';
import { africa } from '../../data/map/regions/africa';
import { crossRegionConnections } from '../../data/map/crossRegionConnections';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { createInitialArmies } from '../../data/map/initialState';
import { DEFAULT_LAWS } from '../../constants/laws';
import { isTerrainType } from '../terrain';
import { findPath, moveArmy } from '../military/movementEngine';
import { buildLogisticsNetworks, getProvinceLogistics } from '../logistics';
import { calculateDemand, calculateProduction, ALL_GOODS } from '../market';
import { findDomesticTradePath, processInternalTrade } from '../internalTrade';
import { normalizePopulation } from '../population';
import { queueRecruitment, processRecruitments } from '../military/recruitmentEngine';
import { createInitialDiplomacy, declareWar, generateConquestCasusBelli, getCampaigns, getCampaignCasualties, getRelation, hasMilitaryAccess, processWarResolutionTick } from '../diplomacy';
import { transferProvince } from '../territoryTransfer';
import type { SaveGameV3 } from '../saveSystem';
import { army, campaign, date, day, world } from './helpers/southAmericaAudit';

const europeTags = 'PRT ESP FRA GBR IRL BEL NLD DEU DNK NOR SWE FIN POL CZE AUT CHE ITA HUN ROU BGR GRC SRB HRV UKR BLR LTU LVA EST'.split(' ');
const africaTags = 'MAR DZA TUN LBY EGY MRT MLI SEN GIN CIV GHA BFA NER NGA CMR TCD CAF SDN ETH ERI SOM KEN UGA TZA COD COG AGO ZMB ZWE MOZ NAM BWA ZAF MDG'.split(' ');
const newTags = [...europeTags, ...africaTags];
const byId = new Map(provincesData.map(p => [p.id, p]));
const byTag = new Map(countries.map(c => [c.tag, c]));
const newProvinces = provincesData.filter(p => /^(eu|af)_/.test(p.id));
const relations = createInitialDiplomacy(countries, provincesData);
const permittedRoute = (from: string, to: string) => {
  const owner = byId.get(from)!.owner;
  const access = countries.filter(c => c.tag !== owner).map(c => ({countryA: owner, countryB: c.tag, status: 'peace' as const, opinion: 0, trust: 50, militaryAccess: [c.tag]}));
  return findPath(from, to, provincesData, owner, access);
};
afterEach(() => vi.restoreAllMocks());

describe('World Map Step 2 assembly, capitals and gameplay', () => {
  it('preserves the original four regions inside the 128-country, 274-province world', () => {
    expect(mapRegions.slice(0,4).map(r=>r.id)).toEqual(['southAmerica','northAmerica','europe','africa']);
    expect(europe.countries.map(c => c.tag)).toEqual(europeTags);
    expect(africa.countries.map(c => c.tag)).toEqual(africaTags);
    expect(europe.provinces).toHaveLength(56); expect(africa.provinces).toHaveLength(49);
    expect(countries).toHaveLength(201); expect(provincesData).toHaveLength(494);
    expect(new Set(countries.map(c => c.tag)).size).toBe(201);
    expect(new Set(provincesData.map(p => p.id)).size).toBe(494);
    for (const region of [europe, africa]) {
      const ids = region.provinces.map(p => p.id).sort();
      expect(region.geometry.map(p => p.id).sort()).toEqual(ids);
      expect(region.topology.map(p => p.id).sort()).toEqual(ids);
    }
    expect(europe.countries.some(c => c.tag === 'RUS')).toBe(false);
  });
  it.each(newTags)('initializes playable %s with a real owned capital and complete gameplay', tag => {
    const country = byTag.get(tag)!;
    expect(country).toBeDefined(); expect(country.name).not.toBe(tag); expect(country.adjective).toBeTruthy(); expect(country.flag).toBeTruthy();
    expect(country.activeLaws).toEqual(DEFAULT_LAWS);
    expect(country.resources.gold).toBeGreaterThan(1000); expect(country.resources.gold).toBeLessThan(5000);
    expect(country.resources.manpower).toBeGreaterThan(0);
    expect(mapCapitals[tag]).toBe(country.capitalId);
    expect(byId.get(country.capitalId!)?.owner).toBe(tag);
    for (const id of country.provinces) {
      const p = byId.get(id)!;
      expect(id).toMatch(/^(eu|af|as|oc|na|sa)_[a-z]{3}_[a-z_0-9]+$/);
      expect(p.owner).toBe(tag); expect(p.originalOwner).toBe(tag); expect(p.color).toBe(country.color);
      expect(isTerrainType(p.terrain)).toBe(true); expect(p.path).toMatch(/^M/);
      expect(Number.isFinite(p.center.x) && Number.isFinite(p.center.y)).toBe(true);
      expect(normalizePopulation(p.population)).toMatchObject(p.population);
      expect(p.maxPopulation).toBeGreaterThan(p.population.total);
      expect(p.development).toBeGreaterThan(0); expect(p.defense).toBeGreaterThan(0); expect(p.unrest).toBe(0);
      expect(p.buildings.every(b => b.level > 0 && b.daysRemaining === 0)).toBe(true);
      expect(calculateProduction(p).food).toBeGreaterThanOrEqual(calculateDemand(p).food);
      for (const good of ALL_GOODS) expect(Number.isFinite(p.market!.goods[good].stock) && p.market!.goods[good].stock >= 0).toBe(true);
    }
  });
  it.each([
    ['PRT','Lisboa'], ['ESP','Madrid'], ['FRA','Paris'], ['GBR','Londres'], ['IRL','Dublin'], ['DEU','Berlim'], ['DNK','Copenhague'],
    ['ITA','Roma'], ['UKR','Kyiv'], ['MAR','Rabat'], ['DZA','Argel'], ['TUN','Túnis'], ['LBY','Trípoli'], ['EGY','Cairo'],
    ['NGA','Abuja'], ['ETH','Adis Abeba'], ['KEN','Nairóbi'], ['TZA','Dodoma'], ['COD','Kinshasa'], ['AGO','Luanda'], ['ZAF','Pretória'],
  ])('uses friendly capital %s: %s', (tag, name) => expect(byId.get(byTag.get(tag)!.capitalId!)?.name).toBe(name));
  it('keeps strategic subdivisions and balanced major powers', () => {
    for (const tag of ['FRA','DEU']) expect(europe.countries.find(c=>c.tag===tag)?.provinces).toHaveLength(5);
    for (const tag of ['ESP','ITA','GBR']) expect(europe.countries.find(c=>c.tag===tag)?.provinces).toHaveLength(4);
    for (const tag of ['POL','UKR']) expect(europe.countries.find(c=>c.tag===tag)?.provinces).toHaveLength(3);
    expect(byTag.get('DEU')!.resources).toEqual(byTag.get('FRA')!.resources);
    expect(africa.countries.every(c => c.provinces.length <= 3)).toBe(true);
  });
  it.each([
    ['eu_che_bern','mountains'], ['eu_nor_northern_norway','mountains'], ['eu_fin_lapland','forest'], ['eu_deu_berlin','plains'],
    ['af_dza_eastern_sahara','desert'], ['af_cod_congo_basin','jungle'], ['af_eth_addis_ababa','mountains'], ['af_nam_windhoek','desert'],
  ])('assigns coherent existing terrain %s: %s', (id, terrain) => expect(byId.get(id)?.terrain).toBe(terrain));
});

describe('World Map Step 2 explicit land topology', () => {
  it('validates intentional landmasses and detects unexpected continental splits', () => {
    const result = validateMapTopology(provincesData, countries);
    expect(result.issues).toEqual([]); expect(result.valid).toBe(true);
    for (const landmass of mapLandmasses) expect(result.components.some(c => c.length === landmass.provinceIds.length && c.every(id => landmass.provinceIds.includes(id)))).toBe(true);
    for (const target of ['eu_deu_berlin','af_nga_abuja']) {
      const separated = provincesData.map(p => ({...p, neighbors: p.id === target ? [] : p.neighbors.filter(id => id !== target)}));
      expect(validateMapTopology(separated,countries).issues.some(i => i.type === 'disconnected-components')).toBe(true);
    }
  });
  it.each([
    ['PRT','ESP'], ['ESP','FRA'], ['FRA','BEL'], ['FRA','DEU'], ['FRA','CHE'], ['FRA','ITA'],
    ['DEU','NLD'], ['DEU','BEL'], ['DEU','POL'], ['DEU','CZE'], ['DEU','AUT'], ['DEU','DNK'],
    ['ITA','CHE'], ['ITA','AUT'], ['POL','CZE'], ['POL','UKR'], ['POL','LTU'], ['NOR','SWE'], ['SWE','FIN'],
    ['HUN','ROU'], ['ROU','BGR'], ['BGR','GRC'], ['BGR','SRB'], ['SRB','HRV'],
    ['MAR','DZA'], ['DZA','TUN'], ['DZA','LBY'], ['DZA','MLI'], ['DZA','NER'], ['LBY','EGY'], ['LBY','TCD'], ['LBY','SDN'], ['EGY','SDN'],
    ['NGA','NER'], ['NGA','CMR'], ['CMR','CAF'], ['CAF','COD'], ['COD','AGO'], ['COD','ZMB'], ['COD','TZA'], ['ETH','KEN'], ['TZA','MOZ'], ['MOZ','ZAF'],
  ])('preserves reciprocal explicit border %s ↔ %s', (a,b) => {
    const edges = provincesData.filter(p => p.owner === a).flatMap(p => p.neighbors.map(id => [p,id] as const)).filter(([,id]) => byId.get(id)?.owner === b);
    expect(edges.length).toBeGreaterThan(0);
    for (const [p,id] of edges) expect(byId.get(id)?.neighbors).toContain(p.id);
  });
  it('contains no self, missing, repeated or asymmetric edge', () => {
    for (const p of newProvinces) {
      expect(new Set(p.neighbors).size).toBe(p.neighbors.length);
      for (const id of p.neighbors) {expect(id).not.toBe(p.id); expect(byId.get(id)?.neighbors).toContain(p.id);}
    }
  });
  it('models Great Britain, Ireland, Zealand and Madagascar without fake crossings', () => {
    expect(byId.get('eu_irl_dublin')?.neighbors).toEqual(['eu_gbr_restored_1']);
    for (const id of ['eu_dnk_copenhagen','af_mdg_antananarivo']) expect(byId.get(id)?.neighbors).toEqual([]);
    for (const p of provincesData.filter(p => p.owner === 'GBR' && europe.provinces.some(core=>core.id===p.id))) expect(p.neighbors.every(id => byId.get(id)?.owner === 'GBR')).toBe(true);
    expect(byId.get('eu_gbr_restored_1')?.neighbors).toEqual(['eu_irl_dublin']);
    expect(byId.get('eu_gib_territory')?.neighbors).toEqual(['eu_esp_andalusia']);
    expect(mapLandmasses.find(l => l.id === 'eurasian-mainland')?.provinceIds.filter(id => /^eu_(nor|swe|fin)_/.test(id))).toHaveLength(6);
    expect(newProvinces.every(p => p.neighbors.every(id => !(p.id.startsWith('eu_') && id.startsWith('af_') || p.id.startsWith('af_') && id.startsWith('eu_'))))).toBe(true);
    expect(crossRegionConnections.filter(([a]) => a.startsWith('sa_'))).toEqual([['sa_col_caribe','na_pan_panama']]);
  });
  it.each([
    ['eu_prt_lisbon','eu_deu_berlin'], ['eu_esp_madrid','eu_pol_warsaw'], ['eu_fra_paris','eu_ita_rome'],
    ['eu_nor_oslo','eu_fin_helsinki'], ['eu_hrv_zagreb','eu_grc_athens'],
    ['af_mar_rabat','af_egy_cairo'], ['af_nga_abuja','af_zaf_pretoria'], ['af_eth_addis_ababa','af_zaf_pretoria'],
  ])('routes over real land borders %s → %s', (from,to) => {
    const path = permittedRoute(from,to);
    expect(path.length).toBeGreaterThan(0); expect(path[path.length-1]).toBe(to);
    for (const id of path) {expect(byId.get(from)?.neighbors).toContain(id); from = id;}
  });
  it('also permits Norway → Finland via Sweden, alongside the real direct northern border', () => {
    expect(permittedRoute('eu_nor_oslo','eu_swe_northern_sweden').length).toBeGreaterThan(0);
    const path = permittedRoute('eu_swe_northern_sweden','eu_fin_helsinki');
    expect(path.length).toBeGreaterThan(0); expect(path[path.length-1]).toBe('eu_fin_helsinki');
  });
  it.each([
    ['eu_fra_paris','eu_gbr_london'], ['eu_gbr_london','eu_irl_dublin'], ['eu_esp_madrid','af_mar_rabat'],
    ['eu_ita_rome','af_tun_tunis'], ['eu_grc_athens','af_egy_cairo'], ['af_zaf_pretoria','af_mdg_antananarivo'],
    ['eu_deu_hamburg','eu_dnk_copenhagen'], ['eu_deu_berlin','eu_nor_oslo'], ['na_usa_washington','eu_fra_paris'],
  ])('preserves sea barriers while allowing new real land connectors %s → %s', (from,to) => {
    const path = permittedRoute(from,to);
    if (from.startsWith('eu_') && to.startsWith('af_') || to === 'eu_nor_oslo') {
      expect(path.length).toBeGreaterThan(0); expect(path[path.length-1]).toBe(to);
      expect(path.some(id => id.startsWith('as_rus_'))).toBe(true);
      if (to.startsWith('af_')) expect(path).toContain('as_isr_jerusalem');
    } else expect(path).toEqual([]);
  });
});

describe('World Map Step 2 existing-system integration', () => {
  it('initializes armies, finite logistics and recruitment for every new country', () => {
    const armies = createInitialArmies(countries);
    const logistics = buildLogisticsNetworks({countries, provinces: provincesData, relations, wars: []});
    for (const tag of newTags) {
      const country = byTag.get(tag)!, capital = byId.get(country.capitalId!)!;
      expect(armies.find(a => a.owner === tag)?.location).toBe(capital.id);
      expect(getProvinceLogistics(logistics, tag, capital.id)?.connected).toBe(true);
      const queued = queueRecruitment('infantry',{country, province: capital}, `new-${tag}`);
      expect(queued.success, tag).toBe(true);
      if (queued.success) {
        const completed = processRecruitments([{...queued.recruitment, daysRemaining: 1}], [], [queued.country], [queued.province]);
        expect(completed.completedRecruitments).toHaveLength(1);
        expect(completed.armies[0].owner).toBe(tag); expect(completed.armies[0].location).toBe(capital.id);
        expect(completed.countries[0].resources.gold).toBe(queued.country.resources.gold);
      }
    }
    for (const p of newProvinces) expect(Number.isFinite(getProvinceLogistics(logistics,p.owner,p.id)!.efficiency)).toBe(true);
    // Jutland has no land supply route from the island capital: expected, not repaired.
    expect(getProvinceLogistics(logistics,'DNK','eu_dnk_jutland')?.connected).toBe(false);
  });
  it('keeps domestic trade continental and never supplies across the sea', () => {
    expect(findDomesticTradePath('eu_fra_paris','eu_fra_provence',provincesData).length).toBeGreaterThan(0);
    expect(findDomesticTradePath('af_cod_kinshasa','af_cod_katanga',provincesData).length).toBeGreaterThan(0);
    expect(findDomesticTradePath('eu_dnk_copenhagen','eu_dnk_jutland',provincesData)).toEqual([]);
    for (const p of processInternalTrade(newProvinces)) for (const good of ALL_GOODS) expect(Number.isFinite(p.market!.goods[good].stock) && p.market!.goods[good].stock >= 0).toBe(true);
  });
  it('initializes every diplomacy pair once and preserves unordered lookup semantics', () => {
    expect(relations).toHaveLength(20100);
    expect(new Set(relations.map(r => JSON.stringify([r.countryA,r.countryB].sort()))).size).toBe(20100);
    for (const [a,b] of [['FRA','DEU'],['EGY','LBY'],['BRA','ZAF']]) {
      expect(getRelation(relations,a,b)?.status).toBe('peace'); expect(getRelation(relations,a,b)).toBe(getRelation(relations,b,a));
    }
    const ambiguous = [{countryA: 'A|B', countryB: 'C', status: 'peace' as const, opinion: 0, trust: 50}, {countryA: 'A', countryB: 'B|C', status: 'war' as const, opinion: 0, trust: 50}];
    expect(getRelation(ambiguous,'C','A|B')).toBe(ambiguous[0]); expect(getRelation(ambiguous,'B|C','A')).toBe(ambiguous[1]);
    expect(getRelation(ambiguous,'missing','C')).toBeUndefined();
  });
  it('preserves canonical logistics access with alliances, directional access and hostile pairs', () => {
    const rows = relations.map(r => {
      const tags = [r.countryA,r.countryB];
      if (tags.includes('FRA') && tags.includes('DEU')) return {...r,alliance:{since:0}};
      if (tags.includes('EGY') && tags.includes('LBY')) return {...r,status:'war' as const};
      if (tags.includes('PRT') && tags.includes('ESP')) return {...r,militaryAccess:['ESP']};
      return r;
    });
    // A later duplicate cannot override the original canonical first match.
    rows.push({...getRelation(relations,'FRA','DEU')!});
    const snapshot = buildLogisticsNetworks({countries,provinces:provincesData,relations:rows,wars:[]});
    const tags = ['FRA','DEU','EGY','LBY','PRT','ESP','DNK','BRA'];
    for (const visitor of tags) for (const owner of tags) expect(snapshot.allowedOwners.get(visitor)?.has(owner)).toBe(hasMilitaryAccess(rows,visitor,owner));
    expect(snapshot.allowedOwners.get('FRA')?.has('DEU')).toBe(true);
    expect(snapshot.allowedOwners.get('EGY')?.has('LBY')).toBe(false);
    expect(snapshot.allowedOwners.get('PRT')?.has('ESP')).toBe(true);
    expect(snapshot.allowedOwners.get('ESP')?.has('PRT')).toBe(false);
  });
  it.each([
    ['FRA','DEU','eu_fra_lyon','eu_deu_rhine'], ['EGY','LBY','af_egy_cairo','af_lby_cyrenaica'],
  ])('runs %s × %s through declaration, Combat V2, transfer and campaign surrender', (attacker, defender, from, target) => {
    vi.spyOn(Math,'random').mockReturnValue(.5);
    const initial = world();
    const ctx = {...initial, relations: createInitialDiplomacy(initial.countries,initial.provinces), wars: [], date};
    const cb = generateConquestCasusBelli(ctx,attacker,defender); expect(cb.ok).toBe(true);
    const declared = declareWar({...ctx, relations: cb.relations},attacker,defender); expect(declared.ok).toBe(true);
    const mover = moveArmy(army(attacker,from,6),target,initial.provinces,declared.relations)!; expect(mover).not.toBeNull();
    let state = campaign([mover,army(defender,target,1)],declared.relations,declared.wars);
    for (let n=0; n<180 && state.battleHistory.length === 0; n++) state = day(state);
    expect(state.battlesStarted).toBe(1); expect(state.battleHistory).toHaveLength(1);
    expect(state.provinces.find(p => p.id === target)?.owner).toBe(attacker);
    expect(state.provinces.find(p => p.id === target)?.originalOwner).toBe(defender);
    const losses = getCampaignCasualties(getCampaigns(state.wars)[0]);
    expect(losses.attacker+losses.defender).toBeGreaterThan(0);
    let resolution: Parameters<typeof processWarResolutionTick>[0] = {...state, date, activeBattles: state.currentActiveBattles, recruitments: [], constructions: []};
    for (const p of state.provinces.filter(p => p.owner === defender)) resolution = {...resolution,...transferProvince(resolution,p.id,attacker,{date})};
    const ended = processWarResolutionTick(resolution);
    expect(ended.resolutions).toHaveLength(1); expect(ended.resolutions[0]).toMatchObject({winner: attacker,loser: defender});
    expect(ended.wars).toEqual([]); expect(ended.activeBattles).toEqual([]);
    expect(getRelation(ended.relations,attacker,defender)?.status).toBe('peace');
    expect(getRelation(ended.relations,attacker,defender)?.lastWarEndedAt).toBeDefined();
    expect(ended.countries.find(c => c.tag === defender)?.isAnnexed).toBe(true);
    for (const c of ended.countries) expect([...c.provinces].sort()).toEqual(ended.provinces.filter(p => p.owner === c.tag).map(p => p.id).sort());
  });
  it('keeps world-v1 and rejects the old Americas-only roster without a migration', () => {
    expect(mapMetadata.id).toBe('world-v1'); expect(mapMetadata.bounds).toEqual({x:0,y:0,w:5040,h:2520});
    const active = {mapId: 'world-v1',world: {provinces: provincesData,countries}} as SaveGameV3;
    expect(isSaveCompatibleWithActiveMap(active)).toBe(true);
    const old = assembleMap([southAmerica,northAmerica],crossRegionConnections.filter(([a]) => a.startsWith('sa_')));
    expect(old.provincesData).toHaveLength(91); expect(old.countries).toHaveLength(27);
    expect(isSaveCompatibleWithActiveMap({...active,world:{provinces:old.provincesData,countries:old.countries}})).toBe(false);
    expect(isSaveCompatibleWithActiveMap({...active,mapId:undefined,world:{provinces:old.provincesData,countries:old.countries}})).toBe(false);
  });
});
