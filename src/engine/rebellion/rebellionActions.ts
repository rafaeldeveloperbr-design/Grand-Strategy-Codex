import type { Army, Country, GameDate, Province } from '../../types';
import { politicalConsequence } from '../politics';
import type { RebellionAction } from './types';
import { REBELLION_BALANCE as B } from './balance';
import { clamp, friendlyTroops, getProvinceRebellion, normalizeRebellion, rebellionDay } from './rebellionUtils';
import { normalizePopulation } from '../population';
import { transferProvince, type TerritoryTransferState } from '../territoryTransfer';
export function applyRebellionAction(provinces: Province[], countries: Country[], armies: Army[], countryTag: string, provinceId: string, action: RebellionAction, date: GameDate) {
  const p = provinces.find(p => p.id === provinceId), country = countries.find(c => c.tag === countryTag);
  const unchanged = (reason: string) => ({ provinces, countries, armies, accepted: false, reason });
  if (!p || !country || (p.owner !== countryTag && !country.rebellions?.some(f => f.id === p.owner && f.status === 'active'))) return unchanged('Sem controle ou facção negociável.');
  const s = normalizeRebellion(p.rebellion), day = rebellionDay(date), cost = B.costs[action];
  if (day - s.lastActionDay < B.actionDays) return unchanged('Resposta anterior ainda em vigor.');
  if (country.resources.gold < cost) return unchanged('Ouro insuficiente.');
  const pop = normalizePopulation(p.population), troops = friendlyTroops({ ...p, owner: countryTag }, armies);
  if (action === 'repression' && troops <= 0) return unchanged('Repressão exige tropas locais disponíveis.');
  const faction = getProvinceRebellion(p, [country]);
  if (action === 'negotiate' && !faction) return unchanged('Não há facção ativa.');
  if (action === 'negotiate' && faction && !['peasants', 'separatists'].includes(faction.type)) return unchanged('Esta facção exige vitória militar.');
  const repressionRatio = Math.min(1, troops / Math.max(1, pop.total * B.garrisonPopulationRatio));
  let updated = { ...s, lastActionDay: day, progress: clamp(s.progress - B.actionProgress[action] * (action === 'repression' ? repressionRatio : 1)) };
  if (action === 'repression') updated = { ...updated, suppressionDays: B.suppressionDays, resentment: clamp(s.resentment + B.repressionResentment) };
  if (action === 'tax_relief' || action === 'concessions' || action === 'negotiate') updated = { ...updated, reliefDays: B.reliefDays, resentment: clamp(s.resentment - B.concessionResentment) };
  if (action === 'autonomy' || (action === 'negotiate' && faction?.type === 'separatists')) updated = { ...updated, autonomy: clamp(s.autonomy + B.autonomyGrant) };
  if (action === 'investment') updated = { ...updated, investmentDays: B.investmentDays };
  const negotiated = action === 'negotiate' ? faction : undefined;
  const ids = negotiated ? Array.from(new Set([...negotiated.involvedProvinces, ...provinces.filter(item => item.owner === negotiated.id).map(item => item.id)])) : [p.id];
  if (negotiated) {
    let territory: TerritoryTransferState = { provinces, countries, recruitments: [], constructions: [] };
    for (const item of provinces.filter(item => item.owner === negotiated.id)) territory = transferProvince(territory, item.id, countryTag, { date });
    ({ provinces, countries } = territory);
  }
  return { accepted: true, reason: negotiated ? `Rebelião em ${p.name} encerrada por negociação aceita.` : action === 'repression' ? 'Repressão reduziu progress; ressentimento aumentou.' : 'Concessão aceita.',
    provinces: provinces.map(item => ids.includes(item.id) ? { ...item,
      rebellion: negotiated ? { ...normalizeRebellion(item.rebellion), ...updated, factionId: undefined } : updated,
      population: action === 'repression' ? { ...pop, total: Math.max(0, pop.total - Math.round(Math.min(1, troops / Math.max(1, pop.total * B.garrisonPopulationRatio)) * pop.total * B.repressionDeaths)) } : item.population } : item),
    armies: negotiated ? armies.filter(a => a.owner !== negotiated.id) : armies,
    countries: countries.map((c): Country => c.tag === countryTag ? { ...politicalConsequence(c,action === 'repression'),
      provinces: negotiated ? Array.from(new Set([...c.provinces, ...ids.filter(id => provinces.find(p => p.id === id)?.owner === negotiated.id)])) : c.provinces,
      resources: { ...c.resources, gold: c.resources.gold - cost, prestige: c.resources.prestige - (action === 'repression' ? B.repressionPrestige : 0) },
      rebellions: c.rebellions?.map(f => f.id === negotiated?.id ? { ...f, status: 'negotiated', resolution: { reason: 'negotiation', day } } : f) } : c) };
}
