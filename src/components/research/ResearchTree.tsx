import React from 'react';
import { TECHNOLOGIES } from '../../data/technology';
import { getTechnologyBlockReason, getResearchProgress } from '../../engine/technology';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';
import { ResearchNode } from './ResearchNode';
import { getResearchNodeStatus } from './presentation';

// Shared grid metrics keep nodes and SVG ports aligned, independent of data pixels.
const NODE_WIDTH = 152, NODE_HEIGHT = 88, COLUMN_GAP = 40, ROW_GAP = 36, PADDING = 24;
interface Props {
  state: CountryTechState;
  country: Country;
  inspectedId: string | null;
  detailId: string;
  onInspect: (id: string, element: HTMLButtonElement, pin: boolean) => void;
  onLeave: () => void;
  onScroll: () => void;
}
export function ResearchTree({ state, country, inspectedId, detailId, onInspect, onLeave, onScroll }: Props) {
  const progress = getResearchProgress(state);
  const columns = Math.max(...TECHNOLOGIES.map(f => f.position.column)) + 1;
  const rows = Math.max(...TECHNOLOGIES.map(f => f.position.row)) + 1;
  const width = PADDING * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP;
  const height = PADDING * 2 + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP;
  return (
    <div className="research-tree-viewport" role="region" onScroll={onScroll} aria-label="Árvore tecnológica">
      <div className="research-tree-canvas" style={{width,height,gridTemplateColumns:`repeat(${columns}, ${NODE_WIDTH}px)`,gridTemplateRows:`repeat(${rows}, ${NODE_HEIGHT}px)`,columnGap:COLUMN_GAP,rowGap:ROW_GAP,padding:PADDING}}>
        <svg className="research-tree-connections" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {TECHNOLOGIES.flatMap(research => research.prerequisites.map((id, index) => {
            const source = TECHNOLOGIES.find(item => item.id === id);
            if (!source) return null;
            const x1 = PADDING + source.position.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2;
            const y1 = PADDING + source.position.row * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT;
            // Separate incoming ports slightly so converging prerequisites remain distinct.
            const portOffset = (index - (research.prerequisites.length - 1) / 2) * 12;
            const x2 = PADDING + research.position.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2 + portOffset;
            const y2 = PADDING + research.position.row * (NODE_HEIGHT + ROW_GAP);
            const middle = (y1 + y2) / 2;
            const status = state.activeResearchId === research.id ? 'active' : state.completedTechnologies.includes(id) ? 'completed' : 'blocked';
            return <path key={`${id}-${research.id}`} className={`research-connection research-connection--${status}`} data-source={id} data-target={research.id} d={`M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`} />;
          }))}
        </svg>
        {TECHNOLOGIES.map(research => <ResearchNode key={research.id} research={research}
          status={getResearchNodeStatus(research,state,getTechnologyBlockReason(state,research.id,country))}
          percent={state.activeResearchId === research.id ? Math.round(progress?.percent ?? 0) : 0} expanded={inspectedId === research.id} detailId={detailId}
          onInspect={(element,pin) => onInspect(research.id,element,pin)} onLeave={onLeave} />)}
      </div>
    </div>
  );
}
