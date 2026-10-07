/**
 * ============================================================
 * MÓDULO 2 - Barra Superior (Top Bar) com Economia
 * ============================================================
 * Exibe informações globais do país do jogador:
 * - Nome e bandeira do país
 * - Recursos (Ouro, Manpower) com taxas de ganho/despesa
 * - Estabilidade
 * - Data/Turno atual
 * - Controles de velocidade
 */

import React from "react";
import { Country, GameDate } from "../types";
import {
  getStabilityDescription,
  getStabilityColor,
} from "../engine/stability";

interface TopBarProps {
  playerCountry: Country;
  date: GameDate;
  gameSpeed: number;
  onSpeedChange: (speed: number) => void;
  onResearchClick: () => void; // NOVO
  onFocusClick: () => void; // NOVO
  onTechClick?: () => void;
  onSettingsClick?: () => void;
  onGovernmentClick?: () => void;
  onEconomyClick?: () => void;
}

/**
 * Formata a data do jogo para exibição
 */
function formatDate(date: GameDate): string {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${date.day} de ${months[date.month - 1]}, ${date.year}`;
}

/**
 * Formata um valor com sinal (+ ou -)
 */
function formatRate(value: number): string {
  if (value >= 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
}

/**
 * Componente da barra superior do jogo
 */
export const TopBar: React.FC<TopBarProps> = ({
  playerCountry,
  date,
  gameSpeed,
  onSpeedChange,
  onResearchClick,
  onFocusClick,
  onSettingsClick,
  onGovernmentClick,
  onEconomyClick,
}) => {
  const { resources, economy } = playerCountry;
  const goldBalance = economy.goldIncome - economy.goldExpense;

  return (
    <div className="top-bar">
      {/* === Seção: País do Jogador === */}
      <div
        className="top-bar__country top-bar__country--clickable"
        onClick={onGovernmentClick}
        title="Clique para gerenciar leis e governo"
      >
        <span className="top-bar__flag">{playerCountry.flag}</span>
        <div className="top-bar__country-info">
          <span className="top-bar__country-name">{playerCountry.name}</span>
          <span className="top-bar__country-tag">[{playerCountry.tag}]</span>
        </div>
      </div>

          {/* === Botões de Tecnologia === */}
      <div className="top-bar__tech-group">
        <button className="topbar__icon-btn" onClick={onEconomyClick} title="Economia nacional e comércio" aria-label="Abrir economia nacional">📦</button>
        {onGovernmentClick && <button className="topbar__icon-btn" onClick={onGovernmentClick} title="Governo e política interna" aria-label="Abrir Governo">🏛️</button>}
        <button
          className="topbar__icon-btn"
          onClick={onResearchClick}
          title="Pesquisas"
        >
          🔬
        </button>
        <button
          className="topbar__icon-btn"
          onClick={onFocusClick}
          title="Focos Nacionais"
        >
          🎯
        </button>
      </div>

      {/* === Seção: Recursos com Taxas === */}
      <div className="top-bar__resources">
        {/* Ouro */}
        <div className="top-bar__resource" title="Ouro">
          <span className="top-bar__resource-icon">💰</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">
              {Math.floor(resources.gold).toLocaleString()}
            </span>
            <div className="top-bar__resource-rates">
              <span className="top-bar__resource-rate top-bar__resource-rate--income">
                +{economy.goldIncome.toFixed(1)}
              </span>
              <span className="top-bar__resource-rate top-bar__resource-rate--expense">
                -{economy.goldExpense.toFixed(1)}
              </span>
            </div>
            <span
              className={`top-bar__resource-balance ${goldBalance >= 0 ? "top-bar__resource-balance--positive" : "top-bar__resource-balance--negative"}`}
            >
              {formatRate(goldBalance)}/dia
            </span>
          </div>
        </div>

        {/* Manpower */}
        <div className="top-bar__resource" title="Mão de Obra">
          <span className="top-bar__resource-icon">👥</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">
              {resources.manpower.toLocaleString()} /{" "}
              {resources.maxManpower.toLocaleString()}
            </span>
            <span className="top-bar__resource-rate top-bar__resource-rate--income">
              +{economy.manpowerGain}/dia
            </span>
            <span className="top-bar__resource-label">Manpower</span>
          </div>
        </div>

        {/* Estabilidade */}
        <div
          className="top-bar__resource"
          title={`Estabilidade: ${getStabilityDescription(resources.stability)}`}
        >
          <span className="top-bar__resource-icon">⚖️</span>
          <div className="top-bar__resource-data">
            <span
              className="top-bar__resource-value"
              style={{ color: getStabilityColor(resources.stability) }}
            >
              {Math.round(resources.stability)}%
            </span>
            <span className="top-bar__resource-label">
              {getStabilityDescription(resources.stability)}
            </span>
            <div className="top-bar__stability-bar">
              <div
                className="top-bar__stability-fill"
                style={{
                  width: `${resources.stability}%`,
                  backgroundColor: getStabilityColor(resources.stability),
                }}
              />
            </div>
          </div>
        </div>

        {/* Prestígio */}
        <div className="top-bar__resource" title="Prestígio">
          <span className="top-bar__resource-icon">🏆</span>
          <div className="top-bar__resource-data">
            <span className="top-bar__resource-value">
              {resources.prestige}
            </span>
            <span className="top-bar__resource-label">Prestígio</span>
          </div>
        </div>
      </div>

      {/* === Seção: Data e Controles === */}
      <div className="top-bar__date-section">
        <div className="top-bar__date">{formatDate(date)}</div>
        <div className="top-bar__speed-controls">
          {[0, 1, 2, 3, 4, 5].map((speed) => (
            <button
              key={speed}
              className={`top-bar__speed-btn ${
                gameSpeed === speed ? "top-bar__speed-btn--active" : ""
              }`}
              onClick={() => onSpeedChange(speed)}
              title={speed === 0 ? "Pausar" : `Velocidade ${speed}`}
            >
              {speed === 0 ? "⏸" : `▶${speed}`}
            </button>
          ))}
        </div>


        
        {onSettingsClick && (
          <button
            className="top-bar__settings-btn"
            onClick={onSettingsClick}
            title="Configurações"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
};
