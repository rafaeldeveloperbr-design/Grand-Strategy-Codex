import React, { useEffect, useState } from 'react';
import { CountrySelectionScreen } from './CountrySelectionScreen';
import { getSaveCompatibilityError, listSaves, loadGame, type SaveGameV3 } from '../engine/saveSystem';
import { isSaveCompatibleWithActiveMap } from '../data/map/saveCompatibility';
import { countries } from '../data/countries';

export interface CampaignStart { playerCountryTag: string; saved?: SaveGameV3 }

export function readCampaignSave(slot: string): { campaign: CampaignStart | null; error: string | null } {
  const saved = loadGame(slot);
  if (!saved) return { campaign: null, error: getSaveCompatibilityError() ?? (slot === 'autosave' ? null : 'Save não encontrado.') };
  if (!isSaveCompatibleWithActiveMap(saved)) return { campaign: null, error: 'Este save pertence a outro mapa.' };
  const tag = saved.technology.player.countryTag;
  if (!saved.world.countries.some(c => c.tag === tag)) return { campaign: null, error: 'País do jogador ausente ou inválido no save.' };
  return { campaign: { playerCountryTag: tag, saved }, error: null };
}

/** The game subtree (including refs and timers) does not exist in selection. */
export function CampaignEntry({ renderGame }: { renderGame: (campaign: CampaignStart) => React.ReactNode }) {
  const [initial] = useState(() => new URLSearchParams(window.location.search).get('newgame') === '1'
    ? { campaign: null, error: null } : readCampaignSave('autosave'));
  const [campaign, setCampaign] = useState<CampaignStart | null>(initial.campaign);
  const [error, setError] = useState<string | null>(initial.error);
  const [saves] = useState(listSaves);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('newgame') === '1') {
      url.searchParams.delete('newgame');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);
  if (campaign) return <>{renderGame(campaign)}</>;
  return <CountrySelectionScreen saves={saves} error={error} onConfirm={tag => {
    if (countries.some(c => c.tag === tag)) setCampaign({ playerCountryTag: tag });
  }} onLoad={slot => {
    const result = readCampaignSave(slot);
    setError(result.error);
    if (result.campaign) setCampaign(result.campaign);
  }} />;
}
