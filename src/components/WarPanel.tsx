import React from 'react';
import type { Army, Country, GameDate, Province, War } from '../types';
import { getCampaigns, getCampaignCasualties } from '../engine/diplomacy/campaigns';
import { calculateCampaignWarScore, calculateSurrenderProgress, getTerritorialControl, isCapitalOccupied } from '../engine/diplomacy/warResolution';
import { diplomacyDay } from '../engine/diplomacy/diplomacyRelations';

interface WarPanelProps {
  wars: War[]; playerCountry: Country; allCountries: Country[];
  provinces: Province[]; armies: Army[]; date: GameDate;
  onClose: () => void; onMakePeace: (warId: string) => void;
}
export const WarPanel: React.FC<WarPanelProps> = ({wars,playerCountry,allCountries,provinces,armies,date,onClose,onMakePeace}) => {
  const campaigns = getCampaigns(wars).filter(c => [...c.attackerParticipants,...c.defenderParticipants].includes(playerCountry.tag));
  const name = (tag:string) => allCountries.find(c => c.tag === tag)?.name ?? (tag.startsWith('rebel_') ? 'Exército Rebelde' : 'País desconhecido');
  return <div className="war-panel">
    <div className="war-panel__header"><h2>Guerras Ativas</h2><button className="war-panel__close" aria-label="Fechar guerras" onClick={onClose}>×</button></div>
    {!campaigns.length && <div className="war-panel__empty">Nenhuma guerra ativa no momento.</div>}
    <div className="war-panel__wars">{campaigns.map(campaign => {
      const score = campaign.civil ? campaign.root.warScore : calculateCampaignWarScore(campaign,provinces,allCountries);
      const casualties = getCampaignCasualties(campaign);
      const playerPair = campaign.pairs.find(w => [w.attacker,w.defender].includes(playerCountry.tag))!;
      return <section key={campaign.id} className="war-panel__war-card" aria-label={`Guerra ${name(campaign.attackerLeader)} × ${name(campaign.defenderLeader)}`}>
        <div className="war-panel__war-header"><h3>{name(campaign.attackerLeader)} × {name(campaign.defenderLeader)}</h3><span>{Math.max(0,diplomacyDay(date)-diplomacyDay(campaign.root.startDate))} dias de guerra</span></div>
        <p>Atacantes: {campaign.attackerParticipants.map(name).join(', ')}</p>
        <p>Defensores: {campaign.defenderParticipants.map(name).join(', ')}</p>
        <div className="war-panel__war-score"><p>Pontuação de Guerra: {score > 0 ? '+' : ''}{Math.round(score)}</p>
          <div className="war-panel__score-bar" role="meter" aria-label="War Score" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={score}><div className="war-panel__score-fill" style={{width:`${(score+100)/2}%`,background:score >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}} /><div className="war-panel__score-marker" style={{left:'50%'}} /></div>
        </div>
        {campaign.civil ? <p>Guerra civil: resolução pelos objetivos da rebelião.</p> : [campaign.attackerLeader,campaign.defenderLeader].map(tag => {
          const country = allCountries.find(c => c.tag === tag);
          const capital = provinces.find(p => p.id === (country?.capitalId ?? country?.capital));
          const surrender = calculateSurrenderProgress(tag,campaign,provinces,allCountries,armies);
          const territory = getTerritorialControl(tag,provinces);
          return <div key={tag} className="war-panel__occupied">
            <p>Rendição de {name(tag)}: {Math.round(surrender)}%</p>
            <progress aria-label={`Rendição de ${name(tag)}`} max={100} value={surrender} />
            <p>Capital de {name(tag)}: {capital?.name ?? 'Não definida'} — {isCapitalOccupied(country,provinces) ? 'ocupada' : capital ? 'controlada' : 'desconhecida'}</p>
            <p>Território de {name(tag)}: {territory.controlled}/{territory.total} controladas; {Math.round(territory.lossRatio*100)}% perdido.</p>
          </div>;
        })}
        <div className="war-panel__casualties"><p>Baixas de {name(campaign.attackerLeader)} e aliados: {casualties.attacker.toLocaleString('pt-BR')}</p><p>Baixas de {name(campaign.defenderLeader)} e aliados: {casualties.defender.toLocaleString('pt-BR')}</p></div>
        <button className="war-panel__peace-btn" disabled={campaign.civil || campaign.inconsistent} onClick={() => onMakePeace(playerPair.id)}>Assinar Paz Branca da Campanha</button>
      </section>;
    })}</div>
  </div>;
};
