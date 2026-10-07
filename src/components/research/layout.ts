import type { Technology, TechnologyCategory } from '../../types/technology';

const CATEGORY_ORDER: TechnologyCategory[] = ['MILITARY', 'INDUSTRY', 'ECONOMY', 'SOCIETY'];
export const RESEARCH_GRID = { nodeWidth:152, nodeHeight:88, columnGap:40, rowGap:36, padding:24, headingSpace:32 };

/** Catalog positions are local to each category; offsets exist only in presentation. */
export function createResearchLayout(technologies: readonly Technology[]) {
  let columns = 0;
  const lanes = CATEGORY_ORDER.flatMap(category => {
    const members = technologies.filter(item => item.category === category);
    if (!members.length) return [];
    const width = Math.max(...members.map(item => item.position.column)) + 1;
    const lane = {category, columnOffset:columns, columns:width};
    columns += width;
    return [lane];
  });
  const rows = technologies.length ? Math.max(...technologies.map(item => item.position.row)) + 1 : 0;
  const getPosition = (technology: Technology) => ({
    column: lanes.find(lane => lane.category === technology.category)!.columnOffset + technology.position.column,
    row: technology.position.row,
  });
  return {lanes, columns, rows, getPosition};
}
