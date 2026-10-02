/**
 * ============================================================
 * MÓDULO 2 - Definição das Províncias (com Economia e Desenvolvimento)
 * ============================================================
 * Contém os dados de todas as províncias no mapa.
 * Cada província possui propriedades econômicas, populacionais
 * e de desenvolvimento para o sistema de Módulo 2.
 */

import { Province } from '../types';

/**
 * Dados das províncias com propriedades expandidas para Módulo 2.
 * Inclui: maxPopulation, development, buildings, defense
 */
export const provincesData: Province[] = [
  // === IMPÉRIO AURELIANO (Norte-Central) ===
  {
    id: 'p1', name: 'Capitalis Aurea', owner: 'IMP', color: '#8B0000',
    neighbors: ['p2', 'p6', 'p10'], population: { total: 45000, growthRate: 0.002, employed: 22500, unemployed: 4500, satisfaction: 60 }, maxPopulation: 80000,
    development: 8, buildings: [], defense: 5,
    center: { x: 280, y: 180 },
    path: 'M220,120 L340,120 L350,180 L340,240 L220,240 L210,180 Z',
  },
  {
    id: 'p2', name: 'Fortis Borealis', owner: 'IMP', color: '#8B0000',
    neighbors: ['p1', 'p3', 'p11'], population: { total: 28000, growthRate: 0.002, employed: 14000, unemployed: 2800, satisfaction: 60 }, maxPopulation: 50000,
    development: 5, buildings: [], defense: 3,
    center: { x: 400, y: 150 },
    path: 'M340,120 L460,110 L470,170 L460,220 L350,230 L350,180 Z',
  },
  {
    id: 'p3', name: 'Mons Ferrum', owner: 'IMP', color: '#8B0000',
    neighbors: ['p2', 'p4', 'p14'], population: { total: 22000, growthRate: 0.002, employed: 11000, unemployed: 2200, satisfaction: 60 }, maxPopulation: 40000,
    development: 4, buildings: [], defense: 2,
    center: { x: 520, y: 130 },
    path: 'M460,110 L580,100 L590,160 L570,200 L470,210 L470,170 Z',
  },
  {
    id: 'p4', name: 'Silva Antiqua', owner: 'IMP', color: '#8B0000',
    neighbors: ['p3', 'p5', 'p15'], population: { total: 15000, growthRate: 0.002, employed: 7500, unemployed: 1500, satisfaction: 60 }, maxPopulation: 35000,
    development: 3, buildings: [], defense: 1,
    center: { x: 520, y: 250 },
    path: 'M470,210 L570,200 L580,260 L570,310 L460,300 L460,250 Z',
  },
  {
    id: 'p5', name: 'Portus Magnus', owner: 'IMP', color: '#8B0000',
    neighbors: ['p4', 'p9', 'p16'], population: { total: 35000, growthRate: 0.002, employed: 17500, unemployed: 3500, satisfaction: 60 }, maxPopulation: 60000,
    development: 7, buildings: [], defense: 4,
    center: { x: 420, y: 290 },
    path: 'M350,230 L460,250 L460,300 L450,350 L340,340 L340,280 Z',
  },
  // === REPÚBLICA DE VALÓRIA (Oeste/Litoral) ===
  {
    id: 'p6', name: 'Valoria Prima', owner: 'REP', color: '#1E3A8B',
    neighbors: ['p1', 'p7', 'p10', 'p12'], population: { total: 32000, growthRate: 0.002, employed: 16000, unemployed: 3200, satisfaction: 60 }, maxPopulation: 55000,
    development: 6, buildings: [], defense: 3,
    center: { x: 180, y: 260 },
    path: 'M120,200 L220,240 L210,300 L200,340 L110,320 L100,260 Z',
  },
  {
    id: 'p7', name: 'Liberum Mare', owner: 'REP', color: '#1E3A8B',
    neighbors: ['p6', 'p8', 'p12'], population: { total: 26000, growthRate: 0.002, employed: 13000, unemployed: 2600, satisfaction: 60 }, maxPopulation: 45000,
    development: 5, buildings: [], defense: 2,
    center: { x: 130, y: 380 },
    path: 'M110,320 L200,340 L190,400 L180,440 L90,420 L80,370 Z',
  },
  {
    id: 'p8', name: 'Insula Flumen', owner: 'REP', color: '#1E3A8B',
    neighbors: ['p7', 'p9', 'p17'], population: { total: 20000, growthRate: 0.002, employed: 10000, unemployed: 2000, satisfaction: 60 }, maxPopulation: 40000,
    development: 4, buildings: [], defense: 2,
    center: { x: 240, y: 400 },
    path: 'M200,340 L340,340 L330,400 L320,440 L190,430 L190,400 Z',
  },
  {
    id: 'p9', name: 'Delta Sacrum', owner: 'REP', color: '#1E3A8B',
    neighbors: ['p5', 'p8', 'p16', 'p18'], population: { total: 18000, growthRate: 0.002, employed: 9000, unemployed: 1800, satisfaction: 60 }, maxPopulation: 35000,
    development: 4, buildings: [], defense: 2,
    center: { x: 370, y: 400 },
    path: 'M340,340 L450,350 L440,410 L430,450 L320,440 L330,400 Z',
  },
  // === REINO DE NORDHEIM (Noroeste) ===
  {
    id: 'p10', name: 'Nordheim Capitalis', owner: 'RNO', color: '#1B5E20',
    neighbors: ['p1', 'p6', 'p11'], population: { total: 30000, growthRate: 0.002, employed: 15000, unemployed: 3000, satisfaction: 60 }, maxPopulation: 50000,
    development: 6, buildings: [], defense: 4,
    center: { x: 170, y: 150 },
    path: 'M100,100 L220,120 L210,180 L220,240 L120,200 L100,160 Z',
  },
  {
    id: 'p11', name: 'Silva Borealis', owner: 'RNO', color: '#1B5E20',
    neighbors: ['p2', 'p10', 'p12', 'p14'], population: { total: 18000, growthRate: 0.002, employed: 9000, unemployed: 1800, satisfaction: 60 }, maxPopulation: 30000,
    development: 3, buildings: [], defense: 2,
    center: { x: 340, y: 80 },
    path: 'M220,50 L340,40 L460,50 L460,110 L340,120 L220,120 Z',
  },
  {
    id: 'p12', name: 'Campus Glacius', owner: 'RNO', color: '#1B5E20',
    neighbors: ['p6', 'p7', 'p10', 'p11'], population: { total: 12000, growthRate: 0.002, employed: 6000, unemployed: 1200, satisfaction: 60 }, maxPopulation: 25000,
    development: 2, buildings: [], defense: 1,
    center: { x: 80, y: 200 },
    path: 'M30,130 L100,100 L100,160 L120,200 L100,260 L30,250 L20,190 Z',
  },

  // === KHANATO DE STEPPE (Nordeste) ===
  {
    id: 'p14', name: 'Steppe Magna', owner: 'KHA', color: '#F57F17',
    neighbors: ['p3', 'p11', 'p15'], population: { total: 20000, growthRate: 0.002, employed: 10000, unemployed: 2000, satisfaction: 60 }, maxPopulation: 45000,
    development: 3, buildings: [], defense: 2,
    center: { x: 640, y: 130 },
    path: 'M580,100 L700,80 L720,140 L710,190 L590,200 L590,160 Z',
  },
  {
    id: 'p15', name: 'Campus Equus', owner: 'KHA', color: '#F57F17',
    neighbors: ['p4', 'p14', 'p16'], population: { total: 15000, growthRate: 0.002, employed: 7500, unemployed: 1500, satisfaction: 60 }, maxPopulation: 40000,
    development: 2, buildings: [], defense: 1,
    center: { x: 650, y: 250 },
    path: 'M570,200 L710,190 L720,250 L710,310 L580,300 L580,260 Z',
  },
  {
    id: 'p16', name: 'Portus Orientalis', owner: 'KHA', color: '#F57F17',
    neighbors: ['p5', 'p9', 'p15', 'p18', 'p20'], population: { total: 25000, growthRate: 0.002, employed: 12500, unemployed: 2500, satisfaction: 60 }, maxPopulation: 50000,
    development: 4, buildings: [], defense: 3,
    center: { x: 570, y: 370 },
    path: 'M450,350 L580,300 L710,310 L700,380 L690,430 L440,410 L450,350 Z',
  },
  // === TEOCRACIA DE SOLARA (Sul) ===
  {
    id: 'p17', name: 'Solara Sacra', owner: 'THC', color: '#6A1B9A',
    neighbors: ['p8', 'p18'], population: { total: 22000, growthRate: 0.002, employed: 11000, unemployed: 2200, satisfaction: 60 }, maxPopulation: 40000,
    development: 5, buildings: [], defense: 3,
    center: { x: 150, y: 480 },
    path: 'M80,470 L180,440 L190,430 L200,490 L180,540 L80,530 L60,500 Z',
  },
  {
    id: 'p18', name: 'Templum Solis', owner: 'THC', color: '#6A1B9A',
    neighbors: ['p9', 'p16', 'p17', 'p19'], population: { total: 19000, growthRate: 0.002, employed: 9500, unemployed: 1900, satisfaction: 60 }, maxPopulation: 35000,
    development: 5, buildings: [], defense: 3,
    center: { x: 340, y: 500 },
    path: 'M190,430 L320,440 L430,450 L420,510 L400,550 L180,540 L200,490 Z',
  },
  {
    id: 'p19', name: 'Oasis Divina', owner: 'THC', color: '#6A1B9A',
    neighbors: ['p16', 'p18', 'p22'], population: { total: 14000, growthRate: 0.002, employed: 7000, unemployed: 1400, satisfaction: 60 }, maxPopulation: 30000,
    development: 4, buildings: [], defense: 2,
    center: { x: 550, y: 490 },
    path: 'M430,450 L690,430 L680,500 L670,550 L400,550 L420,510 Z',
  },
  // === LIGA MERCANTIL DE PORTUS (Sudeste/Costa) ===
  {
    id: 'p20', name: 'Portus Mercatus', owner: 'LIG', color: '#00695C',
    neighbors: ['p16', 'p19', 'p21'], population: { total: 28000, growthRate: 0.002, employed: 14000, unemployed: 2800, satisfaction: 60 }, maxPopulation: 50000,
    development: 7, buildings: [], defense: 3,
    center: { x: 730, y: 380 },
    path: 'M710,310 L780,300 L790,370 L780,440 L690,430 L700,380 Z',
  },
  {
    id: 'p21', name: 'Insula Auri', owner: 'LIG', color: '#00695C',
    neighbors: ['p20', 'p22', 'p19'], population: { total: 16000, growthRate: 0.002, employed: 8000, unemployed: 1600, satisfaction: 60 }, maxPopulation: 30000,
    development: 5, buildings: [], defense: 2,
    center: { x: 750, y: 490 },
    path: 'M690,430 L780,440 L790,510 L770,560 L670,550 L680,500 Z',
  },
  {
    id: 'p22', name: 'Corona Maris', owner: 'LIG', color: '#00695C',
    neighbors: ['p19', 'p21'], population: { total: 12000, growthRate: 0.002, employed: 6000, unemployed: 1200, satisfaction: 60 }, maxPopulation: 25000,
    development: 4, buildings: [], defense: 2,
    center: { x: 600, y: 570 },
    path: 'M400,550 L670,550 L660,600 L640,620 L420,610 L400,580 Z',
  },
];

/**
 * Cria um mapa de províncias indexado por ID para acesso rápido
 */

/**
 * Obtém todas as províncias de um país
 */
