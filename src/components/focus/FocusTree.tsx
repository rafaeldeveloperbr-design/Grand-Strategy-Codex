import React from 'react';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { getFocusBlockReason } from '../../engine/technology';
import type { CountryTechState } from '../../types/technology';
import { FocusNode } from './FocusNode';
import { FOCUS_CATEGORIES, getFocusNodeStatus, getFocusPercent } from './presentation';
import { createFocusLayout, FOCUS_GRID } from './layout';

// Shared grid metrics keep nodes and SVG ports aligned, independent of data pixels.
const {nodeWidth:NODE_WIDTH, nodeHeight:NODE_HEIGHT, columnGap:COLUMN_GAP, rowGap:ROW_GAP, padding:PADDING, headingSpace:HEADING_SPACE} = FOCUS_GRID;
interface Props {
  state: CountryTechState;
  inspectedId: string | null;
  detailId: string;
  onInspect: (id: string, element: HTMLButtonElement, pin: boolean) => void;
  onLeave: () => void;
  onScroll: () => void;
}
export function FocusTree({ state, inspectedId, detailId, onInspect, onLeave, onScroll }: Props) {
  const {columns, rows, lanes, getPosition} = createFocusLayout(NATIONAL_FOCUSES);
  const width = PADDING * 2 + columns * NODE_WIDTH + (columns - 1) * COLUMN_GAP;
  const height = PADDING * 2 + HEADING_SPACE + rows * NODE_HEIGHT + (rows - 1) * ROW_GAP;
  return (
    <div className="focus-tree-viewport" role="region" onScroll={onScroll} aria-label="Árvore de focos nacionais">
      <div className="focus-tree-canvas" style={{width,height,gridTemplateColumns:`repeat(${columns}, ${NODE_WIDTH}px)`,gridTemplateRows:`repeat(${rows}, ${NODE_HEIGHT}px)`,columnGap:COLUMN_GAP,rowGap:ROW_GAP,padding:PADDING,paddingTop:PADDING+HEADING_SPACE}}>
        {lanes.map(lane => <div key={lane.category} className="focus-tree-lane" aria-hidden="true" style={{left:PADDING+lane.columnOffset*(NODE_WIDTH+COLUMN_GAP),width:lane.columns*NODE_WIDTH+(lane.columns-1)*COLUMN_GAP,'--focus-color':FOCUS_CATEGORIES[lane.category].color} as React.CSSProperties}><span>{FOCUS_CATEGORIES[lane.category].label}</span></div>)}
        <svg className="focus-tree-connections" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
          {NATIONAL_FOCUSES.flatMap(focus => (focus.prerequisites ?? []).map(id => {
            const source = NATIONAL_FOCUSES.find(item => item.id === id);
            if (!source) return null;
            const sourcePosition = getPosition(source), targetPosition = getPosition(focus);
            const x1 = PADDING + sourcePosition.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2;
            const y1 = PADDING + HEADING_SPACE + sourcePosition.row * (NODE_HEIGHT + ROW_GAP) + NODE_HEIGHT;
            const x2 = PADDING + targetPosition.column * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2;
            const y2 = PADDING + HEADING_SPACE + targetPosition.row * (NODE_HEIGHT + ROW_GAP);
            const middle = (y1 + y2) / 2;
            const status = state.activeFocusId === focus.id ? 'active' : state.completedFocuses.includes(id) ? 'completed' : 'blocked';
            return <path key={`${id}-${focus.id}`} className={`focus-connection focus-connection--${status}`} data-source={id} data-target={focus.id} d={`M ${x1} ${y1} C ${x1} ${middle}, ${x2} ${middle}, ${x2} ${y2}`} />;
          }))}
        </svg>
        {NATIONAL_FOCUSES.map(focus => <FocusNode key={focus.id} focus={focus} position={getPosition(focus)}
          status={getFocusNodeStatus(focus,state,getFocusBlockReason(state,focus.id))}
          percent={getFocusPercent(focus,state.focusProgressDays)} expanded={inspectedId === focus.id} detailId={detailId}
          onInspect={(element,pin) => onInspect(focus.id,element,pin)} onLeave={onLeave} />)}
      </div>
    </div>
  );
}
