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
    <div style={{
      position: 'fixed', top: '100px', right: '1400px', width: '280px',
      background: 'rgba(20,20,20,0.95)', border: '2px solid #f39c12', borderRadius: '8px',
      padding: '12px', zIndex: 9999, color: 'white', fontFamily: 'monospace', fontSize: '12px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <strong style={{ color: '#f39c12' }}>🎮 CHEAT PANEL (Ctrl+Shift+C)</strong>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button onClick={() => cheats.addAllResources()} style={btnStyle}>[1] 💎 +10k Ouro/Manpower + Estabilidade</button>
        <button onClick={() => cheats.addGold(5000)} style={btnStyle}>[ ] 💰 +5k Ouro</button>
        <button onClick={() => cheats.addManpower(5000)} style={btnStyle}>[ ] 👥 +5k Manpower</button>
        <button onClick={() => cheats.instantRecruit()} style={btnStyle}>[2] ⚡ Recrutamento Instantâneo</button>
        <button onClick={() => cheats.instantBuild()} style={btnStyle}>[3] 🏗️ Construção Instantânea</button>
        <button onClick={() => cheats.spawnArmy()} style={btnStyle}>[4] 🪖 Spawnar Exército (província selecionada)</button>
        <button onClick={() => cheats.killAllEnemiesInProvince()} style={btnStyle}>[7] 💀 Matar Inimigos na Província</button>
        <button onClick={() => cheats.fastForward(30)} style={btnStyle}>[5] ⏩ Avançar 30 dias + x5 vel</button>
        <button onClick={() => cheats.fastForward(365)} style={btnStyle}>[ ] ⏩ Avançar 1 ano</button>
        <button onClick={() => cheats.godMode()} style={btnStyle}>[6] 👑 GOD MODE (999k recursos + 100% moral)</button>
      </div>

      <div style={{ marginTop: '10px', fontSize: '10px', color: '#aaa' }}>
        Console: <code>cheats.addGold(10000)</code><br/>
        <code>cheats.spawnArmy('p1')</code><br/>
        <code>cheats.godMode()</code>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: '#2c3e50', border: '1px solid #34495e', color: 'white',
  padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', textAlign: 'left'
};
