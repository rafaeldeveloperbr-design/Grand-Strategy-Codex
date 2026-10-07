import type { RebelType, RebellionObjective } from './types';
import type { Army, Country, Province, ToastType } from '../../types';
import { troopCount } from './rebellionUtils';
export const REBEL_TYPE_LABELS: Record<RebelType, string> = {
  peasants: 'Camponeses', separatists: 'Separatistas', pretenders: 'Pretendentes',
  religious: 'Religiosos', revolutionaries: 'Revolucionários', nationalists: 'Nacionalistas',
};
export const OBJECTIVE_LABELS: Record<RebellionObjective['kind'], string> = {
  tax_relief: 'Alívio fiscal', independence: 'Independência', replace_government: 'Substituição do governo', reform: 'Reforma política',
};
export const UNREST_SOURCE_LABELS: Record<string, string> = {
  politics: 'Legitimidade e grupos políticos',
  dissatisfaction: 'Insatisfação', food_shortage: 'Falta de alimentos', poverty: 'Baixo poder de compra',
  low_development: 'Baixo desenvolvimento', recent_conquest: 'Conquista recente', stability: 'Estabilidade nacional',
  prestige: 'Prestígio', taxation: 'Impostos', mobilization: 'Mobilização total', deficit: 'Déficit econômico',
  war_exhaustion: 'Guerra prolongada', war_defeats: 'Desvantagem na guerra', centralization: 'Governança',
  housing: 'Habitação', infrastructure: 'Infraestrutura', military_presence: 'Presença militar',
  resentment: 'Ressentimento', autonomy: 'Autonomia', concessions: 'Concessões', investment: 'Investimento',
  foreign_occupation: 'Ocupação estrangeira', excessive_mobilization: 'Mobilização local excessiva',
};

export interface RebellionFormationFeedback {
  factionId: string;
  owner: string;
  active: boolean;
  message: string;
  log?: string;
  type: ToastType;
  title: string;
}

/** Terminal records remain in the save; only the active -> terminal transition announces. */
export function collectRebellionResolutionFeedback(previous: Country[], current: Country[], provinces: Province[]) {
  const active = new Set(previous.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active').map(f => f.id));
  return current.flatMap(c => c.rebellions ?? []).filter(f => active.has(f.id) && f.status !== 'active').map(f => {
    const name = provinces.find(p => p.id === f.originProvince)?.name ?? f.originProvince;
    const cause = f.status === 'defeated' ? 'derrotada: nenhum exército vivo ou território rebelde restante'
      : f.status === 'negotiated' ? 'encerrada por negociação aceita'
        : `vitoriosa: objetivo ${OBJECTIVE_LABELS[f.objective.kind]} concluído (${f.objective.heldDays}/${f.objective.requiredDays} dias)`;
    return { owner: f.owner, status: f.status, message: `Rebelião de ${REBEL_TYPE_LABELS[f.type]} em ${name} ${cause}.` };
  });
}

/** Confirm births against committed state, never against the intermediate spawn. */
export function collectRebellionFormationFeedback(
  createdFactionIds: readonly string[], provinces: Province[], countries: Country[], armies: Army[],
): RebellionFormationFeedback[] {
  const feedback: RebellionFormationFeedback[] = [];
  for (const id of new Set(createdFactionIds)) {
    const faction = countries.flatMap(c => c.rebellions ?? []).find(f => f.id === id);
    if (!faction) continue;
    const provinceName = provinces.find(p => p.id === faction.originProvince)?.name ?? faction.originProvince;
    if (faction.status === 'active') {
      const hasArmy = armies.some(a => a.rebellionFactionId === id && a.owner === id && troopCount(a) > 0);
      const hasOccupation = provinces.some(p => p.owner === id);
      const hasObjective = faction.militaryStrength > 0 && faction.objective.heldDays < faction.objective.requiredDays
        && faction.objective.targets.length > 0 && faction.objective.targets.every(target => provinces.some(p => p.id === target));
      if (!hasArmy && !hasOccupation && !hasObjective) continue;
      feedback.push({ factionId: id, owner: faction.owner, active: true, type: 'error', title: 'Rebelião',
        message: `Rebelião de ${REBEL_TYPE_LABELS[faction.type]} em ${provinceName}`,
        log: `Facção de ${REBEL_TYPE_LABELS[faction.type]} formada em ${provinceName}: ${faction.militaryStrength} tropas, ${faction.involvedProvinces.length} província(s).` });
    } else {
      const outcome = faction.status === 'defeated' ? 'derrotada' : faction.status === 'negotiated' ? 'encerrada por negociação' : 'vitoriosa';
      feedback.push({ factionId: id, owner: faction.owner, active: false,
        message: `Revolta em ${provinceName} ${outcome} no mesmo dia.`, title: 'Revolta resolvida',
        type: faction.status === 'victorious' ? 'warning' : 'info' });
    }
  }
  return feedback;
}
