import backlog from '../../../docs/world-map-completeness-backlog.md?raw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleMap, countries, mapCapitals, mapConnections, mapLandmasses, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { countryDefinitions, definitions } from '../../data/map/completeness/definitions';
import { createInitialArmies } from '../../data/map/initialState';
import { createInitialDiplomacy, declareWar, generateConquestCasusBelli, getCampaigns, getCampaignCasualties, getRelation, processWarResolutionTick } from '../diplomacy';
import { createRelation, relationKey, updateRelation } from '../diplomacy/diplomacyRelations';
import { transferProvince } from '../territoryTransfer';
import { findPath, moveArmy } from '../military/movementEngine';
import { findDomesticTradePath, processInternalTrade } from '../internalTrade';
import { buildLogisticsNetworks, getProvinceLogistics } from '../logistics';
import { canCountriesTrade } from '../economy/internationalTrade';
import { processAI } from '../aiEngine/aiMovement';
import { calculateDemand, calculateProduction, processProvinceMarket, ALL_GOODS } from '../market';
import { queueRecruitment, processRecruitments } from '../military/recruitmentEngine';
import { isTerrainType } from '../terrain';
import { army, campaign, date, day, world } from './helpers/southAmericaAudit';

const byId = new Map(provincesData.map(p=>[p.id,p]));
const byTag = new Map(countries.map(c=>[c.tag,c]));
const relations = createInitialDiplomacy(countries,provincesData);
const logistics = buildLogisticsNetworks({countries,provinces:provincesData,relations,wars:[]});
const required = 'MDA SVK ALB BIH MNE MKD SVN LUX ISL MLT CYP BDI DJI MWI RWA SSD GNQ GAB SWZ LSO BEN GMB GNB LBR SLE TGO COM MUS SYC CPV STP BRN SGP TLS BTN MDV BHR KWT LBN QAT ARE FJI PNG SLB VUT KIR MHL FSM NRU PLW WSM TON TUV COK NIU BHS ATG BRB DMA GRD KNA LCA VCT TTO AND LIE MCO SMR VAT TWN XKX PSE ESH'.split(' ');
const route = (from:string,to:string) => {
  const owner=byId.get(from)!.owner;
  const access=countries.filter(c=>c.tag!==owner).map(c=>({countryA:owner,countryB:c.tag,status:'peace' as const,opinion:0,trust:50,militaryAccess:[c.tag]}));
  return findPath(from,to,provincesData,owner,access);
};
afterEach(()=>vi.restoreAllMocks());

describe('Step 3B executable completeness',()=>{
  it('covers every required scenario entity, retaining six regions and exact unique rosters',()=>{
    expect(countryDefinitions.map(c=>c[0]).sort()).toEqual([...required].sort());
    expect(countries).toHaveLength(201); expect(provincesData).toHaveLength(494);
    expect(new Set(countries.map(c=>c.tag)).size).toBe(201); expect(new Set(provincesData.map(p=>p.id)).size).toBe(494);
    expect(mapRegions).toHaveLength(6); expect(validateMapTopology(provincesData,countries).issues).toEqual([]);
    expect(mapLandmasses).toHaveLength(186);
  });
  it('retains all 120 original M49 entries with executable decisions and 2 political extras',()=>{
    const text=backlog;
    const inventory=text.slice(text.indexOf('## '+String.fromCharCode(193)+'frica faltante'),text.indexOf('## Invent'));
    const rows=inventory.split('\n').filter(line=>/^\| [A-Z]{3} \|/.test(line));
    expect(rows).toHaveLength(120);
    const counts={IMPLEMENTED:0,AGGREGATED:0,DEFERRED_WITH_REASON:0};
    for (const row of rows) {
      const fields=row.split('|').map(s=>s.trim());
      const status=fields[4] as keyof typeof counts; expect(Object.keys(counts)).toContain(status);counts[status]++;
      expect(fields[5].length).toBeGreaterThan(15);
      const id=fields[1];
      if(status==='IMPLEMENTED')expect(byTag.has(id)).toBe(true);
      if(status==='AGGREGATED') {
        expect(byTag.has(id)).toBe(false);
        expect(definitions.some(d=>d[0].includes('_'+id.toLowerCase()+'_')&&byTag.has(d[2]))).toBe(true);
      }
    }
    expect(counts).toEqual({IMPLEMENTED:71,AGGREGATED:48,DEFERRED_WITH_REASON:1});
    expect(text).toContain('IMPLEMENTED - Taiwan'); expect(text).toContain('IMPLEMENTED - Kosovo');
  });
  it.each(required)('initializes complete playable %s with capital, market, recruitment and one national army',tag=>{
    const c=byTag.get(tag)!;expect(c).toBeDefined();expect(c.capitalId).toBe(mapCapitals[tag]);expect(c.provinces).toContain(c.capitalId);
    const p=byId.get(c.capitalId!)!;expect(p.owner).toBe(tag);expect(p.originalOwner).toBe(tag);
    expect(c.name).not.toBe(tag);expect(c.flag).toBeTruthy();expect(isTerrainType(p.terrain)).toBe(true);
    expect(getProvinceLogistics(logistics,tag,p.id)?.connected).toBe(true);
    expect(calculateProduction(p).food).toBeGreaterThanOrEqual(calculateDemand(p).food);
    expect(p.population.total).toBeGreaterThan(0);expect(p.maxPopulation).toBeGreaterThan(p.population.total);
    for(const good of ALL_GOODS)expect(Number.isFinite(p.market!.goods[good].stock)).toBe(true);
    const queued=queueRecruitment('infantry',{country:c,province:p},'complete-'+tag);expect(queued.success).toBe(true);
    if(queued.success)expect(processRecruitments([{...queued.recruitment,daysRemaining:1}],[],[queued.country],[queued.province]).armies[0].location).toBe(p.id);
    expect(createInitialArmies([c])).toHaveLength(1);
  });
  it.each('MDA SVK ALB BIH MNE MKD SVN LUX BDI DJI MWI RWA SSD GAB SWZ LSO BEN GMB GNB LBR SLE TGO BTN KWT LBN QAT ARE AND LIE MCO SMR VAT XKX ESH'.split(' '))('keeps continental %s connected to the Afro-Eurasian mainland',tag=>{
    const id=mapCapitals[tag];expect(route(id,'as_ind_delhi').length).toBeGreaterThan(0);
    expect(mapLandmasses.find(l=>l.id==='eurasian-mainland')!.provinceIds).toContain(id);
  });
  it.each([
    ['MDA','ROU'],['MDA','UKR'],['SVK','CZE'],['SVK','HUN'],['SVN','HRV'],['BIH','SRB'],['MNE','ALB'],['MKD','BGR'],
    ['BDI','RWA'],['GAB','GNQ'],['BEN','TGO'],['LBR','SLE'],['SSD','SDN'],['BTN','IND'],['BTN','CHN'],['KWT','IRQ'],['LBN','SYR'],['QAT','SAU'],['ARE','OMN'],['BRN','MYS'],['PNG','IDN'],['TLS','IDN'],
  ])('preserves a real terrestrial %s / %s contact',(a,b)=>{
    expect(provincesData.filter(p=>p.owner===a).some(p=>p.neighbors.some(id=>byId.get(id)?.owner===b))).toBe(true);
  });
  it.each('ISL MLT CYP SGP MDV BHR COM MUS SYC CPV STP FJI SLB VUT KIR MHL FSM NRU PLW WSM TON TUV COK NIU BHS ATG BRB DMA GRD KNA LCA VCT TTO TWN'.split(' '))('has no invented maritime edge for %s',tag=>{
    expect(byId.get(mapCapitals[tag])!.neighbors).toEqual([]);
    expect(route(mapCapitals[tag],'as_ind_delhi')).toEqual([]);
  });
  it.each([
    ['na_usa_restored_1','Alaska'],['na_usa_hawaii','Hawaii'],['na_can_restored_7','Newfoundland'],['oc_aus_restored_1','Tasmania'],
    ['eu_fra_restored_1','Corsica'],['eu_ita_restored_1','Sicily'],['eu_ita_restored_2','Sardinia'],['eu_grc_restored_1','Crete'],
    ['as_chn_restored_1','Hainan'],['as_jpn_restored_1','Hokkaido'],['as_jpn_restored_2','Shikoku'],['as_phl_restored_1','Mindanao'],
    ['as_idn_restored_1','Kalimantan'],['as_idn_restored_2','Indonesian Papua'],['as_idn_restored_3','Sulawesi'],['as_mys_restored_1','Sabah and Sarawak'],
  ])('restores actual vector territory %s with friendly label %s',(id,name)=>{
    const p=byId.get(id)!;expect(p.name).toBe(name);expect(p.path.startsWith('M')).toBe(true);expect(Number.isFinite(p.center.x)&&Number.isFinite(p.center.y)).toBe(true);
  });
  it('places antimeridian fragments at both edges without an ocean-spanning segment',()=>{
    for(const id of ['as_rus_restored_2','as_rus_wrangel','oc_kir_territory','oc_fji_territory']) {
      const p=byId.get(id)!;
      for(const ring of p.path.split('M').filter(Boolean)) {
        const points=ring.replace('Z','').trim().split(/\s*L\s*/).map(t=>t.split(',').map(Number));
        for(let i=0;i<points.length;i++) {
          const [x,y]=points[i];expect(x>=0&&x<=5040&&y>=0&&y<=2520).toBe(true);
          expect(Math.abs(x-points[(i+1)%points.length][0])).toBeLessThan(2520);
        }
      }
    }
    const wrangel=byId.get('as_rus_wrangel')!.path;expect(wrangel).toContain('0.000000');expect(wrangel).toContain('5040.000000');
    expect(byId.get('as_rus_restored_2')!.neighbors).toEqual([]);
  });
  it('keeps overseas holdings global, without national dependency armies/diplomacy or domestic ocean trade',()=>{
    const fra=byTag.get('FRA')!;expect(countries.filter(c=>c.tag==='FRA')).toHaveLength(1);
    for(const [id,owner] of [['na_pri_territory','USA'],['oc_gum_territory','USA'],['na_grl_territory','DNK'],['af_reu_territory','FRA'],['oc_pyf_territory','FRA']]) {
      const p=byId.get(id)!;expect(p.owner).toBe(owner);expect(p.originalOwner).toBe(owner);expect(byTag.get(owner)!.provinces).toContain(id);
      expect(p.neighbors).toEqual([]);expect(findDomesticTradePath(mapCapitals[owner],id,provincesData)).toEqual([]);
      expect(getProvinceLogistics(logistics,owner,id)?.connected).toBe(false);
      expect(createInitialArmies(countries).some(a=>a.location===id)).toBe(false);
    }
    expect(fra.provinces).toContain('af_reu_territory');expect(fra.provinces).toContain('na_glp_territory');
    expect(relations).toHaveLength(20100);expect(relations.some(r=>r.countryA==='PRI'||r.countryB==='PRI')).toBe(false);
    const prepared=provincesData.map(p=>({...p,market:processProvinceMarket(p)}));
    const traded=processInternalTrade(prepared);for(const p of traded)for(const good of ALL_GOODS)expect(Number.isFinite(p.market!.goods[good].stock)).toBe(true);
  });
  it('assembles deterministically and rejects missing, duplicate or misowned additional holdings',()=>{
    expect(assembleMap(mapRegions,mapConnections)).toEqual({countries,provincesData});
    const modify=(holdings:Record<string,string[]>)=>[{...mapRegions[0],additionalHoldings:holdings},...mapRegions.slice(1)];
    expect(()=>assembleMap(modify({missing:['sa_arg_restored_1']}))).toThrow('Missing holdings country');
    expect(()=>assembleMap(modify({BRA:['sa_arg_restored_1']}))).toThrow('Invalid additional holding');
    expect(()=>assembleMap(modify({ARG:['sa_arg_restored_1','sa_arg_restored_1']}))).toThrow('Invalid additional holding');
  });
  it('indexed trade membership preserves missing-country, owner, war and annexation eligibility',()=>{
    const a=byTag.get('SVK')!,b=byTag.get('HUN')!;
    const base={countries,provinces:provincesData,relations,wars:[],date};
    const contexts=[base,{...base,countries:countries.filter(c=>c.tag!=='SVK')},{...base,provinces:provincesData.filter(p=>p.owner!=='SVK')},
      {...base,relations:[{...createRelation('SVK','HUN'),status:'war' as const}]},
      {...base,wars:[{id:'membership-war',attacker:'SVK',defender:'HUN',startDate:date,warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]}]}];
    for(const ctx of contexts)for(const from of [a,{...a,isAnnexed:true},{...a,provinces:[]}]) {
      const membership={countryTags:new Set(ctx.countries.map(c=>c.tag)),ownerTags:new Set(ctx.provinces.map(p=>p.owner))};
      expect(canCountriesTrade(from,b,ctx,membership)).toBe(canCountriesTrade(from,b,ctx));
    }
  });
  it('new-country AI issues a real adjacent war order and cannot target an isolated overseas holding',()=>{
    vi.spyOn(Math,'random').mockReturnValue(.5);
    const rows=[{...createRelation('SVK','HUN'),status:'war' as const},...relations.filter(r=>relationKey(r.countryA,r.countryB)!==relationKey('SVK','HUN'))];
    const stacks=[army('SVK','eu_svk_territory',6),army('HUN','eu_hun_budapest',1)];
    const result=processAI('SVK',stacks,provincesData,rows,[],countries);
    const order=result.find(a=>a.owner==='SVK')!;
    expect(order.destination).toBe('eu_hun_budapest');expect(byId.get(order.location!)!.neighbors).toContain(order.destination);
    expect(order.path).not.toContain('na_grl_territory');
  });
  it('updates duplicate/reversed diplomatic pairs without changing first-row semantics, ordering or input',()=>{
    const first={...createRelation('SVK','HUN'),opinion:97,trust:49};
    const other=createRelation('FRA','GBR');
    const rows=[first,other,{...first,countryA:'SVK',countryB:'HUN',opinion:-90}];
    const before=structuredClone(rows);
    const updated=updateRelation(rows,'HUN','SVK',r=>({...r,opinion:r.opinion+15,trust:-10}));
    expect(updated).toEqual([other,{...first,opinion:100,trust:0}]);expect(rows).toEqual(before);
    expect(updated.filter(r=>relationKey(r.countryA,r.countryB)===relationKey('SVK','HUN'))).toHaveLength(1);
  });
  it.each(['peace','access','war'] as const)('scoped logistics matches complete networks with %s relations',mode=>{
    const rows=relations.map(r=>relationKey(r.countryA,r.countryB)===relationKey('SVK','HUN') ? {...r,status:mode==='war' ? 'war' as const : 'peace' as const,militaryAccess:mode==='access' ? ['HUN'] : []}:r);
    const full=buildLogisticsNetworks({countries,provinces:provincesData,relations:rows,wars:[]});
    const scoped=buildLogisticsNetworks({countries:countries.filter(c=>['SVK','HUN'].includes(c.tag)),provinces:provincesData,relations:rows,wars:[]});
    for(const tag of ['SVK','HUN']) {
      expect(scoped.networks.get(tag)).toEqual(full.networks.get(tag));expect(scoped.allowedOwners.get(tag)).toEqual(full.allowedOwners.get(tag));
      for(const id of byTag.get(tag)!.provinces)expect(getProvinceLogistics(scoped,tag,id)).toEqual(getProvinceLogistics(full,tag,id));
    }
  });
  it.each([
    ['SVK','HUN','eu_svk_territory','eu_hun_budapest'],['RWA','BDI','af_rwa_territory','af_bdi_territory'],['KWT','IRQ','as_kwt_territory','as_irq_baghdad'],
  ])('integrates new %s in declaration, Combat V2 and War Resolution against %s',(attacker,defender,from,target)=>{
    vi.spyOn(Math,'random').mockReturnValue(.5);
    const initial=world(),ctx={...initial,relations:createInitialDiplomacy(initial.countries,initial.provinces),wars:[],date};
    const cb=generateConquestCasusBelli(ctx,attacker,defender);expect(cb.ok).toBe(true);
    const declared=declareWar({...ctx,relations:cb.relations},attacker,defender);expect(declared.ok).toBe(true);
    const mover=moveArmy(army(attacker,from,6),target,initial.provinces,declared.relations)!;expect(mover).not.toBeNull();
    let state=campaign([mover,army(defender,target,1)],declared.relations,declared.wars);
    for(let n=0;n<180&&state.battleHistory.length===0;n++)state=day(state);
    expect(state.battleHistory).toHaveLength(1);expect(byId.get(target)!.originalOwner).toBe(defender);
    expect(state.provinces.find(p=>p.id===target)?.owner).toBe(attacker);
    expect(getCampaignCasualties(getCampaigns(state.wars)[0]).defender).toBeGreaterThan(0);
    let resolution:Parameters<typeof processWarResolutionTick>[0]={...state,date,activeBattles:state.currentActiveBattles,recruitments:[],constructions:[]};
    for(const p of state.provinces.filter(p=>p.owner===defender))resolution={...resolution,...transferProvince(resolution,p.id,attacker,{date})};
    const ended=processWarResolutionTick(resolution);expect(ended.resolutions[0]).toMatchObject({winner:attacker,loser:defender});expect(ended.wars).toEqual([]);
    expect(getRelation(ended.relations,attacker,defender)?.status).toBe('peace');expect(ended.countries.find(c=>c.tag===defender)?.isAnnexed).toBe(true);
  });
});
