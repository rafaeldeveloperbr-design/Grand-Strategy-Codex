import type { FocusCategory, NationalFocus } from '../../types/technology';

const CATEGORY_ORDER: FocusCategory[] = ['POLITICS', 'ECONOMY', 'INDUSTRY', 'MILITARY', 'DIPLOMACY', 'RESEARCH'];
export const FOCUS_GRID = { nodeWidth:152, nodeHeight:88, columnGap:24, rowGap:36, padding:24, headingSpace:32 };

/** Presentation-only regions preserve local column spacing and all catalog rows. */
export function createFocusLayout(focuses: readonly NationalFocus[]) {
  let columns = 0;
  const lanes = CATEGORY_ORDER.flatMap(category => {
    const members = focuses.filter(item => item.category === category);
    if (!members.length) return [];
    const firstColumn = Math.min(...members.map(item => item.position.column));
    const width = Math.max(...members.map(item => item.position.column)) - firstColumn + 1;
    const lane = {category, firstColumn, columnOffset:columns, columns:width};
    columns += width;
    return [lane];
  });
  const rows = focuses.length ? Math.max(...focuses.map(item => item.position.row)) + 1 : 0;
  const getPosition = (focus: NationalFocus) => {
    const lane = lanes.find(item => item.category === focus.category)!;
    return {column:lane.columnOffset + focus.position.column - lane.firstColumn, row:focus.position.row};
  };
  return {lanes, columns, rows, getPosition};
}
