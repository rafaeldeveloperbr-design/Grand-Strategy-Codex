import type { Province, Country, Army, UnitType, Recruitment } from '../../types';
import type { CountryTechState } from '../../types/technology';
import { getProvinceLogistics, type LogisticsSnapshot } from '../../engine/logistics';
import { UNIT_DEFINITIONS, RECRUITABLE_UNIT_IDS, getUnitTechnologyName } from '../../data/units';
import { calculateArmyMorale, calculateArmyOrganization, calculateArmySize, getArmySupply, getEffectiveRecruitmentCost, getRecruitmentBlockReason } from '../../engine/military';
import { compositionText, supplyLabel, armyStatus } from '../militaryPresentation';
import { getUnitName } from '../../utils/translations';

interface ProvinceMilitaryTabProps {
  logistics?: LogisticsSnapshot; province: Province; playerCountry: Country; armiesHere: Army[];
  allArmies?: Army[]; countries?: Country[]; technology: CountryTechState;
  selectedArmyIds?: string[]; onSelectArmy?: (id: string) => void;
  recruitments?: Recruitment[]; onCancelRecruitment?: (id: string) => void;
  onRecruit: (provinceId: string, unitType: UnitType) => void;
}

export function ProvinceMilitaryTab({ logistics, province, playerCountry, armiesHere, allArmies = armiesHere, countries = [], technology, selectedArmyIds = [], onSelectArmy, recruitments = [], onCancelRecruitment, onRecruit }: ProvinceMilitaryTabProps) {
  const network = getProvinceLogistics(logistics, playerCountry.tag, province.id);
  return <>
    <section className="province-panel__section" aria-label="Tropas presentes">
      <h3 className="province-panel__subtitle">Exércitos na Província</h3>
      <p className="military-overview">{armiesHere.length} exércitos · {armiesHere.reduce((sum, a) => sum + calculateArmySize(a), 0).toLocaleString('pt-BR')} tropas</p>
      {network && <p className="military-overview">Rede logística: {network.connected ? 'Conectada' : 'Desconectada'} · Distância {network.distance ?? '—'} · Eficiência {Math.round(network.efficiency * 100)}%</p>}
      {!armiesHere.length && <p className="province-panel__no-armies">Nenhum exército presente</p>}
      {armiesHere.map(army => {
        const supply = getArmySupply(army, province, allArmies, logistics), owner = countries.find(c => c.tag === army.owner);
        return <article key={army.id} className={`province-panel__army-card ${selectedArmyIds.includes(army.id) ? 'military-army--selected' : ''}`}>
          <div className="province-panel__army-card-header"><strong>{army.name}</strong><span>{calculateArmySize(army).toLocaleString('pt-BR')} tropas</span></div>
          <p>{owner?.flag} {owner?.name ?? army.owner} · {armyStatus(army, supply.status)}</p>
          <div className="military-stat-grid"><span>Organização {Math.round(calculateArmyOrganization(army))}%</span><span>Moral {Math.round(calculateArmyMorale(army))}%</span><span>Supply {supplyLabel(supply.status)} · {Math.round(supply.ratio * 100)}%</span></div>
          <p className="military-composition">{compositionText([army])}</p>
          {getProvinceLogistics(logistics, army.owner, province.id) && <p className="military-overview">Logística: {getProvinceLogistics(logistics, army.owner, province.id)?.connected ? 'Conectada' : 'Desconectada'} · Distância: {getProvinceLogistics(logistics, army.owner, province.id)?.distance ?? '—'}</p>}
          {onSelectArmy && army.owner === playerCountry.tag && <button type="button" aria-pressed={selectedArmyIds.includes(army.id)} onClick={() => onSelectArmy(army.id)}>{selectedArmyIds.includes(army.id) ? 'Desmarcar' : 'Selecionar'} {army.name}</button>}
        </article>;
      })}
    </section>
    <section className="province-panel__section" aria-label="Recrutamento moderno">
      <h3 className="province-panel__subtitle">Recrutar Unidades</h3>
      <div className="province-panel__build-options military-recruitment-grid">
        {RECRUITABLE_UNIT_IDS.map(type => {
          const def = UNIT_DEFINITIONS[type], ctx = { country: playerCountry, province, technology };
          const cost = getEffectiveRecruitmentCost(type, ctx), reason = getRecruitmentBlockReason(type, ctx);
          const stats = { Ataque: def.attack, Defesa: def.defense, Choque: def.shock, Cerco: def.siege, Mobilidade: def.mobility, Força: def.maxStrength };
          const costs = { Ouro: cost.gold, Manpower: cost.manpower, Ferro: Number(cost.iron.toFixed(2)), Ferramentas: Number(cost.tools.toFixed(2)) };
          return <article key={type} className={`province-panel__build-option military-recruitment-card ${reason ? 'province-panel__build-option--disabled' : ''}`}>
            <div className="province-panel__build-option-header"><span className="province-panel__build-icon" aria-hidden="true">{def.icon}</span><div className="province-panel__build-info"><h4 className="province-panel__build-name">{def.name}</h4><p className="province-panel__build-desc">{def.role}</p></div></div>
            <dl className="military-stat-grid">{Object.entries(stats).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <dl className="military-cost-grid">{Object.entries(costs).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <p className="province-panel__build-desc">Supply {def.supplyUse} · Manutenção {def.maintenance}/dia · Tempo {cost.days} dias</p>
            <p className="military-requirements">{def.requiredArsenalLevel ? `Arsenal Militar nível ${def.requiredArsenalLevel}` : 'Sem Arsenal necessário'} · {def.requiredTechnology ? `Tecnologia: ${getUnitTechnologyName(def.requiredTechnology)}` : 'Sem tecnologia necessária'}</p>
            {reason && <p className="military-block-reason">{reason}</p>}
            <button type="button" className="province-panel__build-btn" disabled={!!reason} aria-label={`Recrutar ${def.name}${reason ? `: ${reason}` : ''}`} onClick={() => onRecruit(province.id, type)}>{reason ?? 'Recrutar'}</button>
          </article>;
        })}
      </div>
    </section>
    <section className="province-panel__section" aria-label="Fila de recrutamento">
      <h3 className="province-panel__subtitle">Fila de recrutamento</h3>
      {!recruitments.length && <p className="military-overview">Nenhum recrutamento em andamento.</p>}
      {recruitments.map(rec => {
        const total = rec.totalDays ?? UNIT_DEFINITIONS[rec.unitType].trainingTime;
        const progress = total > 0 ? Math.max(0, Math.min(100, (total - rec.daysRemaining) / total * 100)) : 0;
        return <article key={rec.id} className="military-queue-entry">
          <strong>{rec.count}× {getUnitName(rec.unitType)}</strong><span>{province.name} · {Math.max(0, Math.ceil(rec.daysRemaining))} dias restantes</span>
          <progress aria-label={`Progresso de ${getUnitName(rec.unitType)}`} value={progress} max={100} />
          <span>{Math.round(progress)}% concluído{rec.owner !== province.owner ? ' · Controle perdido: cancelamento no próximo tick' : ''}</span>
          {onCancelRecruitment && rec.owner === playerCountry.tag && <button type="button" onClick={() => onCancelRecruitment(rec.id)} aria-label={`Cancelar recrutamento de ${getUnitName(rec.unitType)}`}>Cancelar</button>}
        </article>;
      })}
    </section>
  </>;
}
