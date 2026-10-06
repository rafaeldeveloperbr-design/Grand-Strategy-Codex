/**
 * ============================================================
 * MÓDULO 2 - Definição das Províncias (com Economia e Desenvolvimento)
 * ============================================================
 * Contém os dados de todas as províncias no mapa.
 * Cada província possui propriedades econômicas, populacionais
 * e de desenvolvimento para o sistema de Módulo 2.
 */

import type { ProvinceGameplay } from '../../types';

/**
 * Dados das províncias com propriedades expandidas para Módulo 2.
 * Inclui: maxPopulation, development, buildings, defense
 */
export const provinceGameplay: ProvinceGameplay[] = [
  // === IMPÉRIO AURELIANO (Norte-Central) ===
  {
    id: 'p1', name: 'Capitalis Aurea', owner: 'IMP', color: '#8B0000',
    population: { total: 45000, growthRate: 0.002, employed: 22500, unemployed: 4500, satisfaction: 60 }, maxPopulation: 80000,
    development: 8, buildings: [], defense: 5,
  },
  {
    id: 'p2', name: 'Fortis Borealis', owner: 'IMP', color: '#8B0000',
    population: { total: 28000, growthRate: 0.002, employed: 14000, unemployed: 2800, satisfaction: 60 }, maxPopulation: 50000,
    development: 5, buildings: [], defense: 3,
  },
  {
    id: 'p3', name: 'Mons Ferrum', owner: 'IMP', color: '#8B0000',
    population: { total: 22000, growthRate: 0.002, employed: 11000, unemployed: 2200, satisfaction: 60 }, maxPopulation: 40000,
    development: 4, buildings: [], defense: 2,
  },
  {
    id: 'p4', name: 'Silva Antiqua', owner: 'IMP', color: '#8B0000',
    population: { total: 15000, growthRate: 0.002, employed: 7500, unemployed: 1500, satisfaction: 60 }, maxPopulation: 35000,
    development: 3, buildings: [], defense: 1,
  },
  {
    id: 'p5', name: 'Portus Magnus', owner: 'IMP', color: '#8B0000',
    population: { total: 35000, growthRate: 0.002, employed: 17500, unemployed: 3500, satisfaction: 60 }, maxPopulation: 60000,
    development: 7, buildings: [], defense: 4,
  },
  // === REPÚBLICA DE VALÓRIA (Oeste/Litoral) ===
  {
    id: 'p6', name: 'Valoria Prima', owner: 'REP', color: '#1E3A8B',
    population: { total: 32000, growthRate: 0.002, employed: 16000, unemployed: 3200, satisfaction: 60 }, maxPopulation: 55000,
    development: 6, buildings: [], defense: 3,
  },
  {
    id: 'p7', name: 'Liberum Mare', owner: 'REP', color: '#1E3A8B',
    population: { total: 26000, growthRate: 0.002, employed: 13000, unemployed: 2600, satisfaction: 60 }, maxPopulation: 45000,
    development: 5, buildings: [], defense: 2,
  },
  {
    id: 'p8', name: 'Insula Flumen', owner: 'REP', color: '#1E3A8B',
    population: { total: 20000, growthRate: 0.002, employed: 10000, unemployed: 2000, satisfaction: 60 }, maxPopulation: 40000,
    development: 4, buildings: [], defense: 2,
  },
  {
    id: 'p9', name: 'Delta Sacrum', owner: 'REP', color: '#1E3A8B',
    population: { total: 18000, growthRate: 0.002, employed: 9000, unemployed: 1800, satisfaction: 60 }, maxPopulation: 35000,
    development: 4, buildings: [], defense: 2,
  },
  // === REINO DE NORDHEIM (Noroeste) ===
  {
    id: 'p10', name: 'Nordheim Capitalis', owner: 'RNO', color: '#1B5E20',
    population: { total: 30000, growthRate: 0.002, employed: 15000, unemployed: 3000, satisfaction: 60 }, maxPopulation: 50000,
    development: 6, buildings: [], defense: 4,
  },
  {
    id: 'p11', name: 'Silva Borealis', owner: 'RNO', color: '#1B5E20',
    population: { total: 18000, growthRate: 0.002, employed: 9000, unemployed: 1800, satisfaction: 60 }, maxPopulation: 30000,
    development: 3, buildings: [], defense: 2,
  },
  {
    id: 'p12', name: 'Campus Glacius', owner: 'RNO', color: '#1B5E20',
    population: { total: 12000, growthRate: 0.002, employed: 6000, unemployed: 1200, satisfaction: 60 }, maxPopulation: 25000,
    development: 2, buildings: [], defense: 1,
  },

  // === KHANATO DE STEPPE (Nordeste) ===
  {
    id: 'p14', name: 'Steppe Magna', owner: 'KHA', color: '#F57F17',
    population: { total: 20000, growthRate: 0.002, employed: 10000, unemployed: 2000, satisfaction: 60 }, maxPopulation: 45000,
    development: 3, buildings: [], defense: 2,
  },
  {
    id: 'p15', name: 'Campus Equus', owner: 'KHA', color: '#F57F17',
    population: { total: 15000, growthRate: 0.002, employed: 7500, unemployed: 1500, satisfaction: 60 }, maxPopulation: 40000,
    development: 2, buildings: [], defense: 1,
  },
  {
    id: 'p16', name: 'Portus Orientalis', owner: 'KHA', color: '#F57F17',
    population: { total: 25000, growthRate: 0.002, employed: 12500, unemployed: 2500, satisfaction: 60 }, maxPopulation: 50000,
    development: 4, buildings: [], defense: 3,
  },
  // === TEOCRACIA DE SOLARA (Sul) ===
  {
    id: 'p17', name: 'Solara Sacra', owner: 'THC', color: '#6A1B9A',
    population: { total: 22000, growthRate: 0.002, employed: 11000, unemployed: 2200, satisfaction: 60 }, maxPopulation: 40000,
    development: 5, buildings: [], defense: 3,
  },
  {
    id: 'p18', name: 'Templum Solis', owner: 'THC', color: '#6A1B9A',
    population: { total: 19000, growthRate: 0.002, employed: 9500, unemployed: 1900, satisfaction: 60 }, maxPopulation: 35000,
    development: 5, buildings: [], defense: 3,
  },
  {
    id: 'p19', name: 'Oasis Divina', owner: 'THC', color: '#6A1B9A',
    population: { total: 14000, growthRate: 0.002, employed: 7000, unemployed: 1400, satisfaction: 60 }, maxPopulation: 30000,
    development: 4, buildings: [], defense: 2,
  },
  // === LIGA MERCANTIL DE PORTUS (Sudeste/Costa) ===
  {
    id: 'p20', name: 'Portus Mercatus', owner: 'LIG', color: '#00695C',
    population: { total: 28000, growthRate: 0.002, employed: 14000, unemployed: 2800, satisfaction: 60 }, maxPopulation: 50000,
    development: 7, buildings: [], defense: 3,
  },
  {
    id: 'p21', name: 'Insula Auri', owner: 'LIG', color: '#00695C',
    population: { total: 16000, growthRate: 0.002, employed: 8000, unemployed: 1600, satisfaction: 60 }, maxPopulation: 30000,
    development: 5, buildings: [], defense: 2,
  },
  {
    id: 'p22', name: 'Corona Maris', owner: 'LIG', color: '#00695C',
    population: { total: 12000, growthRate: 0.002, employed: 6000, unemployed: 1200, satisfaction: 60 }, maxPopulation: 25000,
    development: 4, buildings: [], defense: 2,
  },
];

