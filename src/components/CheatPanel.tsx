/**
 * CheatPanel.tsx - Painel visual de cheats
 * Coloca em src/components/CheatPanel.tsx
 */
import React from 'react';

interface CheatPanelProps {
  cheats: CheatActions;
  isOpen: boolean;
  onClose: () => void;
}

interface CheatActions {
  addGold: (amount: number) => void;
  addManpower: (amount: number) => void;
  addAllResources: () => void;
  instantRecruit: () => void;
  instantBuild: () => void;
  spawnArmy: (provinceId?: string) => void;
  killAllEnemiesInProvince: () => void;
  fastForward: (days?: number) => void;
  godMode: () => void;
}

export const CheatPanel: React.FC<CheatPanelProps> = ({ cheats, isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="cheat-panel">
      <div className="cheat-panel__header">
        <strong className="cheat-panel__title">🎮 CHEAT PANEL (Ctrl+Shift+C)</strong>
        <button onClick={onClose} className="cheat-panel__close" aria-label="Fechar cheats">✕</button>
      </div>

      <div className="cheat-panel__actions">
        <button onClick={() => cheats.addAllResources()} className="cheat-panel__button">[1] 💎 +10k Ouro/Manpower + Estabilidade</button>
        <button onClick={() => cheats.addGold(5000)} className="cheat-panel__button">[ ] 💰 +5k Ouro</button>
        <button onClick={() => cheats.addManpower(5000)} className="cheat-panel__button">[ ] 👥 +5k Manpower</button>
        <button onClick={() => cheats.instantRecruit()} className="cheat-panel__button">[2] ⚡ Recrutamento Instantâneo</button>
        <button onClick={() => cheats.instantBuild()} className="cheat-panel__button">[3] 🏗️ Construção Instantânea</button>
        <button onClick={() => cheats.spawnArmy()} className="cheat-panel__button">[4] 🪖 Spawnar Exército (província selecionada)</button>
        <button onClick={() => cheats.killAllEnemiesInProvince()} className="cheat-panel__button">[7] 💀 Matar Inimigos na Província</button>
        <button onClick={() => cheats.fastForward(30)} className="cheat-panel__button">[5] ⏩ Avançar 30 dias + x5 vel</button>
        <button onClick={() => cheats.fastForward(365)} className="cheat-panel__button">[ ] ⏩ Avançar 1 ano</button>
        <button onClick={() => cheats.godMode()} className="cheat-panel__button">[6] 👑 GOD MODE (999k recursos + 100% moral)</button>
      </div>

      <div className="cheat-panel__help">
        Console: <code>cheats.addGold(10000)</code><br/>
        <code>cheats.spawnArmy('sa_bra_brasilia')</code><br/>
        <code>cheats.godMode()</code>
      </div>
    </div>
  );
};
