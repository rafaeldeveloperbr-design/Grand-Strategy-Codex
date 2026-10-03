import type { Technology } from '../../../types/technology';
import { AGRICULTURE_TECHNOLOGIES } from './agriculture';
import { INDUSTRY_TECHNOLOGIES } from './industry';
import { INFRASTRUCTURE_TECHNOLOGIES } from './infrastructure';
import { MILITARY_TECHNOLOGIES } from './military';
export * from './agriculture';
export * from './industry';
export * from './infrastructure';
export * from './military';
export const TECHNOLOGIES: Technology[] = [
  ...AGRICULTURE_TECHNOLOGIES, ...INDUSTRY_TECHNOLOGIES,
  ...INFRASTRUCTURE_TECHNOLOGIES, ...MILITARY_TECHNOLOGIES,
];
