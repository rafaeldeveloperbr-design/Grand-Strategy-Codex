import React from 'react';
import { Army, Province, Country } from '../types';
import { calculateArmySize } from '../engine/combat';
import { formatArmySize } from '../utils/formatters';

interface ArmyMarkerProps {
  army: Army;
  provinces: Province[];
  countries: Country[];
  isSelected: boolean;
  isHovered: boolean;
  /** Offset X aplicado ao marcador (para disposição em grupo) */
  offsetX: number;
  /** Offset Y aplicado ao marcador (para disposição em grupo) */
  offsetY: number;
  onClick: (armyId: string) => void;
  onHover: (armyId: string | null) => void;
}

/**
 * Marcador visual de um exército no mapa
 */
export const ArmyMarker: React.FC<ArmyMarkerProps> = ({
  army,
  provinces,
  countries,
  isSelected,
  isHovered,
  offsetX,
  offsetY,
  onClick,
  onHover,
}) => {
  const isRebellionArmy = !!army.rebellionFactionId;
  const effectiveTag = army.owner.startsWith('rebel_') && army.originalOwner 
    ? army.originalOwner 
    : army.owner;
  const country = countries.find(c => c.tag === effectiveTag);
  
  // Recalcula dinamicamente a soma do exército atual no estado
  const size = calculateArmySize(army); 
  
  // Determina posição base (se está em movimento, usa position; senão, centro da província)
  let baseX: number, baseY: number;
  
  if (army.position && army.destination) {
    // Em movimento - usa posição interpolada (sem offset para não confundir rota)
    baseX = army.position.x;
    baseY = army.position.y;
  } else if (army.location) {
    // Parado - usa centro da província + offset
    const province = provinces.find(p => p.id === army.location);
    if (!province) return null;
    baseX = province.center.x;
    baseY = province.center.y + 20; // Offset base para não sobrepor nome da província
  } else {
    return null;
  }

  // Aplica offset (apenas para exércitos parados)
  const x = baseX + (army.destination ? 0 : offsetX);
  const y = baseY + (army.destination ? 0 : offsetY);

  // Elevação visual: selected > hovered > normal
  const isElevated = isSelected || isHovered;

  return (
    <g
      className={`army-marker ${isSelected ? 'army-marker--selected' : ''} ${isHovered ? 'army-marker--hovered' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(army.id);
      }}
      onMouseEnter={() => onHover(army.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        cursor: 'pointer',
        transform: isElevated ? `translate(0, -3px)` : 'translate(0, 0)',
        transition: 'transform 0.15s ease',
      }}
    >
      {/* Sombra (mais proeminente quando elevado) */}
      <ellipse
        cx={x}
        cy={y + 12 + (isElevated ? 3 : 0)}
        rx={isElevated ? '16' : '14'}
        ry={isElevated ? '5' : '4'}
        fill={isElevated ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.3)'}
      />
      
      {/* Base do marcador */}
      <rect
        x={x - 16}
        y={y - 8}
        width="32"
        height="20"
        rx="4"
        fill={isRebellionArmy ? '#702d3e' : country?.color ?? '#555'}
        stroke={isSelected ? '#FFD700' : isHovered ? '#FFFFFF' : '#000'}
        strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
        className="army-marker__body"
        filter={isElevated ? 'url(#glow)' : undefined}
      />
      
      {/* Bandeira/Ícone */}
      <text
        x={x - 10}
        y={y + 5}
        fontSize="10"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {isRebellionArmy ? '🏴' : country?.flag ?? '⚔️'}
      </text>
      
      {/* Número de tropas */}
      <text
        x={x + 6}
        y={y + 4}
        fontSize="8"
        fontWeight="bold"
        fill="#FFF"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {formatArmySize(size)}
      </text>
      
      {/* Indicador de movimento */}
      {army.destination && (
        <circle
          cx={x + 14}
          cy={y - 6}
          r="3"
          fill="#4CAF50"
          stroke="#FFF"
          strokeWidth="0.5"
        >
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      
      {/* Indicador de seleção (anel rotativo) */}
      {isSelected && (
        <circle
          cx={x}
          cy={y + 2}
          r="20"
          fill="none"
          stroke="#FFD700"
          strokeWidth="1.5"
          strokeDasharray="3,2"
          opacity="0.9"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${x} ${y + 2}`}
            to={`360 ${x} ${y + 2}`}
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
      )}

      {/* Tooltip de nome ao hover */}
      {isHovered && !isSelected && (
        <g>
          <rect
            x={x - 40}
            y={y - 28}
            width="80"
            height="14"
            rx="3"
            fill="rgba(0,0,0,0.85)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />
          <text
            x={x}
            y={y - 19}
            fontSize="7"
            fill="#FFF"
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight="600"
          >
            {army.name.length > 18 ? army.name.substring(0, 16) + '…' : army.name}
          </text>
        </g>
      )}
    </g>
  );
};
