import type { NationalFocus } from '../../../types/technology';
import { MILITARY_FOCUSES } from './military';
import { ECONOMIC_FOCUSES } from './economic';
import { POLITICAL_FOCUSES } from './political';

import { DIPLOMATIC_FOCUSES } from './diplomatic';
export * from './diplomatic';
export * from './military';
export * from './economic';
export * from './political';

export const NATIONAL_FOCUSES: NationalFocus[] = [
  ...MILITARY_FOCUSES,
  ...ECONOMIC_FOCUSES,
  ...POLITICAL_FOCUSES,
  ...DIPLOMATIC_FOCUSES
];
export { validateFocusTree } from './validation';
