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
import { Country, GameDate, Province } from "../types";
import {
  getStabilityDescription,
  getStabilityColor,
} from "../engine/stability";

interface TopBarProps {
  playerCountry: Country;
  provinces: Province[];
  date: GameDate;
  gameSpeed: number;
  onSpeedChange: (speed: number) => void;
  onResearchClick: () => void;
  onFocusClick: () => void;
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
  provinces,
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

  const nationalGoods = provinces
    .filter((province) => province.owner === playerCountry.tag)
    .reduce(
      (total, province) => {
        total.food += province.market?.goods.food.stock ?? 0;
        total.wood += province.market?.goods.wood.stock ?? 0;
        total.iron += province.market?.goods.iron.stock ?? 0;
        total.tools += province.market?.goods.tools.stock ?? 0;

        return total;
      },
      {
        food: 0,
        wood: 0,
        iron: 0,
        tools: 0,
      }
    );

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
        <div className="topbar__resource-popover">
          <button
            className="topbar__icon-btn"
            onClick={onEconomyClick}
            aria-label="Abrir economia nacional"
          >
            📦
          </button>

          <div className="topbar__resource-popover-content">
            <div className="topbar__resource-popover-title">
              Recursos nacionais
            </div>

            <div className="topbar__resource-popover-row">
              <span>🍞 FOOD</span>
              <strong>{Math.floor(nationalGoods.food).toLocaleString()}</strong>
            </div>

            <div className="topbar__resource-popover-row">
              <span>🪵 WOOD</span>
              <strong>{Math.floor(nationalGoods.wood).toLocaleString()}</strong>
            </div>

            <div className="topbar__resource-popover-row">
              <span>⛓️ IRON</span>
              <strong>{Math.floor(nationalGoods.iron).toLocaleString()}</strong>
            </div>

            <div className="topbar__resource-popover-row">
              <span>🔧 TOOLS</span>
              <strong>{Math.floor(nationalGoods.tools).toLocaleString()}</strong>
            </div>

            <div className="topbar__resource-popover-hint">
              Clique para abrir a economia
            </div>
          </div>
        </div>
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
        <div
          className="top-bar__resource top-bar__resource"
          title={[
            `Tesouro: ${Math.floor(resources.gold).toLocaleString()}`,
            `Receita diária: +${economy.goldIncome.toFixed(1)}`,
            `Despesa diária: -${economy.goldExpense.toFixed(1)}`,
            `Saldo diário: ${formatRate(goldBalance)}`
          ].join('\n')}
        >
          <span className="top-bar__resource-icon">💰</span>

          <span className="top-bar__resource-value">
            {Math.floor(resources.gold).toLocaleString()}
          </span>
        </div>


        {/* Manpower */}
        <div
          className="top-bar__resource top-bar__resource"
          title={[
            `Manpower disponível: ${resources.manpower.toLocaleString()}`,
            `Capacidade máxima: ${resources.maxManpower.toLocaleString()}`,
            `Recuperação diária: +${economy.manpowerGain}`
          ].join('\n')}
        >
          <span className="top-bar__resource-icon">👥</span>

          <span className="top-bar__resource-value">
            {resources.manpower.toLocaleString()}
          </span>
        </div>


        {/* Estabilidade */}
        <div
          className="top-bar__resource top-bar__resource"
          title={`Estabilidade: ${Math.round(resources.stability)}% · ${getStabilityDescription(resources.stability)}`}
        >
          <span className="top-bar__resource-icon">⚖️</span>

          <span
            className="top-bar__resource-value"
            style={{ color: getStabilityColor(resources.stability) }}
          >
            {Math.round(resources.stability)}%
          </span>
        </div>

        {/* Prestígio */}
        <div
          className="top-bar__resource top-bar__resource"
          title={`Prestígio nacional: ${resources.prestige}`}
        >
          <span className="top-bar__resource-icon">🏆</span>

          <span className="top-bar__resource-value">
            {resources.prestige}
          </span>
        </div>
      </div>



      {/* === Seção: Data e Controles === */}
      <div className="top-bar__date-section">
        <div className="top-bar__date">{formatDate(date)}</div>
        <div className="top-bar__speed-controls">
          {[0, 1, 2, 3, 4, 5].map((speed) => (
            <button
              key={speed}
              className={`top-bar__speed-btn ${gameSpeed === speed ? "top-bar__speed-btn--active" : ""
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
