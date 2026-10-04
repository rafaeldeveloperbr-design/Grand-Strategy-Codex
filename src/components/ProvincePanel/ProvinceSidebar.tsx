import React from 'react';
import { BuildingConstruction, Recruitment } from '../../types';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
import { UNIT_DEFINITIONS } from '../../data/units';

interface ProvinceSidebarProps {
  provinceConstructions: BuildingConstruction[];
  recruitmentsHere: Recruitment[];
  onCancelBuilding: (constructionId: string) => void;
  onCancelRecruitment: (recruitmentId: string) => void;
}

export const ProvinceSidebar: React.FC<ProvinceSidebarProps> = ({
  provinceConstructions,
  recruitmentsHere,
  onCancelBuilding,
  onCancelRecruitment,
}) => {
  const hasActivities = provinceConstructions.length > 0 || recruitmentsHere.length > 0;

  return (
    <div className="province-panel__sidebar">
      <div className="province-panel__sidebar-content">
        <h3 className="province-panel__sidebar-title">📋 Atividades</h3>

        {!hasActivities && (
          <p className="province-panel__sidebar-empty">
            Nenhuma obra ou recrutamento em andamento.
          </p>
        )}

        {/* Construções em Andamento */}
        {provinceConstructions.length > 0 && (
          <div className="province-panel__sidebar-section">
            <h4 className="province-panel__sidebar-subtitle">🔨 Construções</h4>
            {provinceConstructions.map((item, idx) => {
              const def = BUILDING_DEFINITIONS[item.buildingType];
              const progress = Math.max(
                0,
                Math.min(
                  100,
                  ((item.totalDays - item.daysRemaining) / item.totalDays) * 100
                )
              );
              const isActive = idx === 0;

              return (
                <div key={item.id} className="province-panel__sidebar-item">
                  <div className="province-panel__sidebar-item-header">
                    <span>
                      {def.icon} {def.name}
                      {!isActive && (
                        <small style={{ marginLeft: '4px', opacity: 0.7 }}>(Fila)</small>
                      )}
                    </span>
                    <button
                      className="province-panel__construction-cancel"
                      onClick={() => onCancelBuilding(item.id)}
                      title={isActive ? 'Cancelar (Reembolso proporcional)' : 'Cancelar (Reembolso 100%)'}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="province-panel__sidebar-item-info">
                    <span className="province-panel__construction-days">
                      {isActive
                        ? `${Math.ceil(item.daysRemaining)}d`
                        : `${Math.ceil(item.totalDays)}d`}
                    </span>
                  </div>
                  <div className="province-panel__construction-bar">
                    <div
                      className="province-panel__construction-fill"
                      style={{
                        width: isActive ? `${progress}%` : '0%',
                        backgroundColor: isActive ? undefined : '#666',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recrutamentos em Andamento */}
        {recruitmentsHere.length > 0 && (
          <div className="province-panel__sidebar-section">
            <h4 className="province-panel__sidebar-subtitle">⚔️ Recrutando</h4>
            {recruitmentsHere.map((rec) => {
              const def = UNIT_DEFINITIONS[rec.unitType];
              const totalTime = def.trainingTime;
              const progress = Math.max(
                0,
                Math.min(
                  100,
                  ((totalTime - rec.daysRemaining) / totalTime) * 100
                )
              );

              return (
                <div key={rec.id} className="province-panel__sidebar-item">
                  <div className="province-panel__sidebar-item-header">
                    <span>
                      {def.icon} {rec.count > 1 ? `${rec.count}x ` : ''}{def.name}
                    </span>
                    <button
                      className="province-panel__construction-cancel"
                      onClick={() => onCancelRecruitment(rec.id)}
                      title="Cancelar recrutamento"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="province-panel__sidebar-item-info">
                    <span className="province-panel__construction-days">
                      {Math.ceil(rec.daysRemaining)}d
                    </span>
                  </div>
                  <div className="province-panel__construction-bar">
                    <div
                      className="province-panel__construction-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};