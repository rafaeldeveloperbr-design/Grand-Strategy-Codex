import { NationalFocus } from '../../../types/technology';
import { MILITARY_FOCUSES } from './military';
import { ECONOMIC_FOCUSES } from './economic';
import { POLITICAL_FOCUSES } from './political';

export * from './military';
export * from './economic';
export * from './political';

export const NATIONAL_FOCUSES: NationalFocus[] = [
  ...MILITARY_FOCUSES,
  ...ECONOMIC_FOCUSES,
  ...POLITICAL_FOCUSES
];