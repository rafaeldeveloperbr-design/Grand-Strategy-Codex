/**
 * ============================================================
 * MÓDULO 2 - Definição dos Países (com Economia)
 * ============================================================
 * Contém os dados iniciais de todas as nações no mapa.
 * Cada país possui tag, cor, províncias, recursos e taxas econômicas.
 */

import { Country } from '../types';
import { DEFAULT_LAWS } from '../constants/laws';

export const countries: Country[] = [
  {
    tag: 'IMP',
    name: 'Império Aureliano',
    adjective: 'Aureliana',
    color: '#8B0000',
    colorLight: '#C41E3A',
    provinces: ['p1', 'p2', 'p3', 'p4', 'p5'],
    resources: { gold: 5000, manpower: 12000, maxManpower: 36000, stability: 75, prestige: 80 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '🦅',
    activeLaws: { ...DEFAULT_LAWS },
  },
  {
    tag: 'REP',
    name: 'República de Valória',
    adjective: 'Valoriana',
    color: '#1E3A8B',
    colorLight: '#3B82F6',
    provinces: ['p6', 'p7', 'p8', 'p9'],
    resources: { gold: 3500, manpower: 8500, maxManpower: 25500, stability: 82, prestige: 60 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '⚔️',
    activeLaws: { ...DEFAULT_LAWS },
  },
  {
    tag: 'RNO',
    name: 'Reino de Nordheim',
    adjective: 'Nordiana',
    color: '#1B5E20',
    colorLight: '#4CAF50',
    provinces: ['p10', 'p11', 'p12'],
    resources: { gold: 2800, manpower: 6500, maxManpower: 19500, stability: 90, prestige: 45 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '🛡️',
    activeLaws: { ...DEFAULT_LAWS },
  },
  {
    tag: 'KHA',
    name: 'Khanato de Steppe',
    adjective: 'Steppeana',
    color: '#F57F17',
    colorLight: '#FFC107',
    provinces: ['p14', 'p15', 'p16'],
    resources: { gold: 2000, manpower: 9500, maxManpower: 28500, stability: 55, prestige: 50 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '🐎',
    activeLaws: { ...DEFAULT_LAWS },
  },
  {
    tag: 'THC',
    name: 'Teocracia de Solara',
    adjective: 'Solariana',
    color: '#6A1B9A',
    colorLight: '#AB47BC',
    provinces: ['p17', 'p18', 'p19'],
    resources: { gold: 4200, manpower: 5500, maxManpower: 16500, stability: 88, prestige: 70 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '☀️',
    activeLaws: { ...DEFAULT_LAWS },
  },
  {
    tag: 'LIG',
    name: 'Liga Mercantil de Portus',
    adjective: 'Portusiana',
    color: '#00695C',
    colorLight: '#26A69A',
    provinces: ['p20', 'p21', 'p22'],
    resources: { gold: 8000, manpower: 4000, maxManpower: 12000, stability: 70, prestige: 55 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    flag: '⚓',
    activeLaws: { ...DEFAULT_LAWS },
  },
];

/**
 * Obtém um país pela sua tag
 */
export function getCountryByTag(tag: string): Country | undefined {
  return countries.find((c) => c.tag === tag);
}

/**
 * Obtém a cor de um país pela tag
 */
