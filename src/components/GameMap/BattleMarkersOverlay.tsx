import { getValidParticipantsBySide } from '../../engine/combat';
import { calculateArmyOrganization } from '../../engine/military';
import React from 'react';
import { ActiveBattle, Army, Country, Province } from '../../types';

interface BattleMarkersOverlayProps {
  activeBattles: ActiveBattle[];
  armies: Army[];
  countries: Country[];
  provinces: Province[];
}

export const BattleMarkersOverlay: React.FC<BattleMarkersOverlayProps> = React.memo(function BattleMarkersOverlay({
  activeBattles,
  armies,
  countries,
  provinces,
}: BattleMarkersOverlayProps) {
  return (
    <g className="battle-markers-layer">
      {activeBattles.map((battle) => {
        const province = provinces.find((p) => p.id === battle.provinceId);
        if (!province) return null;

        const attacker = getValidParticipantsBySide(battle,armies,'attacker')[0];
        const defender = getValidParticipantsBySide(battle,armies,'defender')[0];
        if (!attacker || !defender) return null;

        const attackerCountry = countries.find((c) => c.tag === attacker.owner);
        const defenderCountry = countries.find((c) => c.tag === defender.owner);

        const progress = Math.max(0, Math.min(100,100 - Math.min(calculateArmyOrganization(attacker),calculateArmyOrganization(defender))));

        return (
          <g key={`battle-${battle.id}`} pointerEvents="none">
            {/* Círculo de batalha pulsante */}
            <circle
              cx={province.center.x}
              cy={province.center.y}
              r="25"
              fill="none"
              stroke="#ff4444"
              strokeWidth="3"
              opacity="0.8"
            >
              <animate
                attributeName="r"
                values="20;28;20"
                dur="1.5s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.8;0.4;0.8"
                dur="1.5s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Ícone de espadas cruzadas */}
            <text
              x={province.center.x}
              y={province.center.y - 30}
              textAnchor="middle"
              fontSize="16"
              pointerEvents="none"
            >
              ⚔️
            </text>

            {/* Barra de progresso da batalha */}
            <rect
              x={province.center.x - 20}
              y={province.center.y + 20}
              width="40"
              height="6"
              fill="rgba(0, 0, 0, 0.5)"
              rx="3"
            />
            <rect
              x={province.center.x - 20}
              y={province.center.y + 20}
              width={40 * (progress / 100)}
              height="6"
              fill="#ff4444"
              rx="3"
            />

            {/* Texto com dias restantes */}
            <text
              x={province.center.x}
              y={province.center.y + 35}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#fff"
              stroke="#000"
              strokeWidth="0.5"
            >
              {battle.durationDays ?? Math.max(0,battle.daysTotal-battle.daysRemaining)}d
            </text>

            {/* Tooltip nativo com informações da batalha */}
            <title>
              {`Batalha em ${province.name}\n`}
              {`${attackerCountry?.flag} ${attackerCountry?.name}: ${battle.attackerCurrentTroops} tropas\n`}
              {`${defenderCountry?.flag} ${defenderCountry?.name}: ${battle.defenderCurrentTroops} tropas\n`}
              {`Duração: ${battle.durationDays ?? Math.max(0,battle.daysTotal-battle.daysRemaining)} dias\n`}
              {`Baixas: ${battle.attackerCasualties} vs ${battle.defenderCasualties}`}
            </title>
          </g>
        );
      })}
    </g>
  );
});
