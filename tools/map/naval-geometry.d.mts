type Point = [number, number];
export function ringsOf(path: string): Point[][];
export function geometryIndex(provinces: readonly { id: string; path: string }[]): {
  shapes: { id: string; rings: Point[][]; minX: number; maxX: number; minY: number; maxY: number }[];
  land: (x: number, y: number) => boolean;
  waterLine: (a: Point, b: Point) => boolean;
};
