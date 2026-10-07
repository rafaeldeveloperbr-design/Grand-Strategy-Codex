import { Technology } from '../../../types/technology';
import { MILITARY_TECHNOLOGIES } from './military';
import { INDUSTRY_TECHNOLOGIES } from './industry';
import { ECONOMIC_TECHNOLOGIES } from './economic';
import { SOCIETY_TECHNOLOGIES } from './infrastructure';

export * from './military';
export * from './economic';
export * from './industry';
export * from './validation';
export * from './infrastructure';

export const TECHNOLOGIES: Technology[] = [
  ...MILITARY_TECHNOLOGIES,
  ...INDUSTRY_TECHNOLOGIES,
  ...ECONOMIC_TECHNOLOGIES,
  ...SOCIETY_TECHNOLOGIES
];
