import React from 'react';
import { TECHNOLOGIES } from '../../data/technology';
import { getTechnologyBlockReason, getResearchProgress } from '../../engine/technology';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';
import { ResearchNode } from './ResearchNode';
import { getResearchNodeStatus, RESEARCH_CATEGORIES } from './presentation';
import { createResearchLayout, RESEARCH_GRID } from './layout';

// Shared grid metrics keep nodes and SVG ports aligned, independent of data pixels.
const {nodeWidth:NODE_WIDTH, nodeHeight:NODE_HEIGHT, columnGap:COLUMN_GAP, rowGap:ROW_GAP, padding:PADDING, headingSpace:HEADING_SPACE} = RESEARCH_GRID;
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
  const {columns, rows, lanes, getPosition} = createResearchLayout(TECHNOLOGIES);
  const width = PADDING * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP;
  const height = PADDING * 2 + HEADING_SPACE + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP;
  return (
    <div className="research-tree-viewport" role="region" onScroll={onScroll} aria-label="Árvore tecnológica">
      <div className="research-tree-canvas" style={{width,height,gridTemplateColumns:`repeat(${columns}, ${NODE_WIDTH}px)`,gridTemplateRows:`repeat(${rows}, ${NODE_HEIGHT}px)`,columnGap:COLUMN_GAP,rowGap:ROW_GAP,padding:PADDING,paddingTop:PADDING+HEADING_SPACE}}>
        {lanes.map(lane => <div key={lane.category} className="research-tree-lane" aria-hidden="true" style={{left:PADDING+lane.columnOffset*(NODE_WIDTH+COLUMN_GAP),width:lane.columns*NODE_WIDTH+(lane.columns-1)*COLUMN_GAP,'--research-color':RESEARCH_CATEGORIES[lane.category].color} as React.CSSProperties}><span>{RESEARCH_CATEGORIES[lane.category].label}</span></div>)}
        <svg className="research-tree-connections" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {TECHNOLOGIES.flatMap(research => research.prerequisites.map((id, index) => {
            const source = TECHNOLOGIES.find(item => item.id === id);
            if (!source) return null;
            const sourcePosition = getPosition(source), targetPosition = getPosition(research);
            const x1 = PADDING + sourcePosition.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2;
            const y1 = PADDING + HEADING_SPACE + sourcePosition.row * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT;
            // Separate incoming ports slightly so converging prerequisites remain distinct.
            const portOffset = (index - (research.prerequisites.length - 1) / 2) * 12;
            const x2 = PADDING + targetPosition.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2 + portOffset;
            const y2 = PADDING + HEADING_SPACE + targetPosition.row * (NODE_HEIGHT + ROW_GAP);
            const middle = (y1 + y2) / 2;
            const status = state.researchSlots.some(slot => slot.technologyId === research.id) ? 'active' : state.completedTechnologies.includes(id) ? 'completed' : 'blocked';
            return <path key={`${id}-${research.id}`} className={`research-connection research-connection--${status}`} data-source={id} data-target={research.id} d={`M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`} />;
          }))}
        </svg>
        {TECHNOLOGIES.map(research => <ResearchNode key={research.id} research={research} position={getPosition(research)}
          status={getResearchNodeStatus(research,state,getTechnologyBlockReason(state,research.id,country))}
          percent={state.researchSlots.some(slot => slot.technologyId === research.id) ? Math.round(getResearchProgress(state, state.researchSlots.find(slot => slot.technologyId === research.id)!.id)?.percent ?? 0) : 0} expanded={inspectedId === research.id} detailId={detailId}
          onInspect={(element,pin) => onInspect(research.id,element,pin)} onLeave={onLeave} />)}
      </div>
    </div>
  );
}
