// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FocusModal } from '../FocusModal';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { createFocusLayout } from '../focus/layout';
import * as engine from '../../engine/technology';
import type { CountryTechState } from '../../types/technology';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const initial = () => engine.createInitialTechState('TST');
const node = (title: string) => screen.getByRole('button',{name:new RegExp(`^${title} —`)});
const details = (title: string) => screen.getByRole('dialog',{name:`Detalhes de ${title}`});
const setup = (state: CountryTechState = initial()) => {
  const onStartFocus = vi.fn(), onCancelFocus = vi.fn(), onClose = vi.fn();
  const props = {techState:state,onStartFocus,onCancelFocus,onClose};
  return {...render(<FocusModal {...props} />),...props};
};

describe('Focus UI V2', () => {
  it('shows six compact region markers with friendly category names', () => {
    const view = setup();
    const markers = view.container.querySelectorAll('.focus-tree-lane');
    expect(Array.from(markers, marker => marker.textContent)).toEqual(['Política','Economia','Indústria','Militar','Diplomacia','Ciência e Pesquisa']);
    for (const marker of markers) expect(marker.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.textContent).not.toMatch(/focus_[a-z_]+/);
  });
  it('renders 36 globally distinct cells and separates categories even with reused local coordinates', () => {
    const view = setup();
    expect(NATIONAL_FOCUSES).toHaveLength(36);
    const nodes = view.container.querySelectorAll<HTMLButtonElement>('.focus-node');
    expect(nodes).toHaveLength(36);
    expect(new Set(Array.from(nodes, node => `${node.style.gridColumn}:${node.style.gridRow}`)).size).toBe(36);
    const layout = createFocusLayout(NATIONAL_FOCUSES);
    for (const a of NATIONAL_FOCUSES) for (const b of NATIONAL_FOCUSES) {
      if (a.category !== b.category) expect(layout.getPosition(a)).not.toEqual(layout.getPosition(b));
    }
    const overlapping = [NATIONAL_FOCUSES[0],{...NATIONAL_FOCUSES[0],category:'RESEARCH' as const}];
    const reused = createFocusLayout(overlapping);
    expect(reused.getPosition(overlapping[0])).not.toEqual(reused.getPosition(overlapping[1]));
  });
  it('packs occupied category ranges and preserves local spacing and rows without mutating data', () => {
    const snapshot = JSON.stringify(NATIONAL_FOCUSES);
    const layout = createFocusLayout(NATIONAL_FOCUSES);
    const reversed = createFocusLayout([...NATIONAL_FOCUSES].reverse());
    let offset = 0;
    for (const lane of layout.lanes) {
      expect(lane.columnOffset).toBe(offset);
      const members = NATIONAL_FOCUSES.filter(focus => focus.category === lane.category);
      expect(lane.columns).toBe(Math.max(...members.map(f => f.position.column))-Math.min(...members.map(f => f.position.column))+1);
      offset += lane.columns;
      for (const a of members) for (const b of members) expect(layout.getPosition(a).column-layout.getPosition(b).column).toBe(a.position.column-b.position.column);
    }
    expect(layout.columns).toBe(offset);
    for (const focus of NATIONAL_FOCUSES) {
      expect(layout.getPosition(focus).row).toBe(focus.position.row);
      expect(layout.getPosition(focus)).toEqual(reversed.getPosition(focus));
    }
    expect(JSON.stringify(NATIONAL_FOCUSES)).toBe(snapshot);
  });
  it('anchors SVG endpoints to global columns and preserves cross-category prerequisites', () => {
    const view = setup(); const layout = createFocusLayout(NATIONAL_FOCUSES);
    const centers: {column:number;x:number}[] = [];
    let crossCategoryCount = 0;
    for (const focus of NATIONAL_FOCUSES) for (const id of focus.prerequisites ?? []) {
      const source = NATIONAL_FOCUSES.find(f => f.id === id)!;
      const path = view.container.querySelector(`path[data-source="${id}"][data-target="${focus.id}"]`)!;
      expect(path).toBeTruthy();
      const coordinates = path.getAttribute('d')!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      centers.push({column:layout.getPosition(source).column,x:coordinates[0]},{column:layout.getPosition(focus).column,x:coordinates[6]});
      expect(node(source.title).style.gridColumn).toBe(String(layout.getPosition(source).column+1));
      expect(node(focus.title).style.gridColumn).toBe(String(layout.getPosition(focus).column+1));
      if (source.category !== focus.category) {
        crossCategoryCount++;
        expect(coordinates[0]).not.toBe(coordinates[6]);
      }
    }
    expect(crossCategoryCount).toBeGreaterThan(0);
    for (const a of centers) for (const b of centers) {
      if (a.column === b.column) expect(a.x).toBeCloseTo(b.x);
      else if (a.column < b.column) expect(a.x).toBeLessThan(b.x);
    }
  });
  it('exposes all six categories and every focus in the compact tree', () => {
    setup();
    for (const category of ['Política','Economia','Indústria','Militar','Diplomacia','Ciência e Pesquisa']) expect(screen.getByRole('heading',{name:new RegExp(category)})).toBeTruthy();
    expect(document.querySelectorAll('.focus-node')).toHaveLength(36);
    for (const focus of NATIONAL_FOCUSES) {
      const card = node(focus.title);
      expect(card.style.gridColumn).toBe(String(createFocusLayout(NATIONAL_FOCUSES).getPosition(focus).column+1));
      expect(card.style.gridRow).toBe(String(focus.position.row+1));
      expect(card.textContent).not.toContain(focus.description);
    }
    expect(screen.getByText('Nenhum foco ativo')).toBeTruthy();
  });
  it('uses canonical locks for exclusivity and keeps the active cancel action', () => {
    const state = {...initial(),completedFocuses:['focus_regional_diplomacy','focus_alliance_policy']};
    const view = setup(state);
    const blocked = node('Projeção Regional');
    expect(blocked.getAttribute('aria-disabled')).toBe('true');
    expect(blocked.classList.contains('focus-node--exclusive-blocked')).toBe(true);
    fireEvent.click(blocked);
    expect(within(details('Projeção Regional')).getByText(engine.getFocusBlockReason(state,'focus_regional_projection')!)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
    expect(view.onStartFocus).not.toHaveBeenCalled();
    fireEvent.click(node('Unidade Nacional'));
    expect(view.onStartFocus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Iniciar foco'}));
    expect(view.onStartFocus).toHaveBeenCalledWith('focus_national_unity');
    view.rerender(<FocusModal {...view} techState={{...state,activeFocusId:'focus_national_unity',focusProgressDays:10}} />);
    fireEvent.click(node('Unidade Nacional'));
    fireEvent.click(screen.getByRole('button',{name:'Cancelar foco'}));
    expect(view.onCancelFocus).toHaveBeenCalledOnce();
  });
  it('marks completed nodes and does not offer any action to start or cancel them', () => {
    setup({...initial(),completedFocuses:['focus_national_unity']});
    const completed = node('Unidade Nacional');
    expect(completed.classList.contains('focus-node--completed')).toBe(true);
    fireEvent.click(completed);
    expect(within(details('Unidade Nacional')).getByText('Concluído')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Cancelar foco'})).toBeNull();
  });
  it('shows compact active progress, detailed progress and loss on cancellation', () => {
    setup({...initial(),activeFocusId:'focus_national_unity',focusProgressDays:30});
    const active = node('Unidade Nacional');
    expect(active.classList.contains('focus-node--active')).toBe(true);
    expect(within(active).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50');
    expect(within(active).getByText('◉ 50%')).toBeTruthy();
    expect(screen.getByText('Foco ativo: Unidade Nacional — 50%')).toBeTruthy();
    fireEvent.click(active);
    expect(within(details('Unidade Nacional')).getByText(/30 \/ 60 dias \(50%\)/)).toBeTruthy();
    expect(screen.getByText('Cancelar perde todo o progresso deste foco.')).toBeTruthy();
  });
  it('does not start blocked prerequisites or when another focus is active', () => {
    const view = setup();
    fireEvent.click(node('Exército Profissional'));
    expect(node('Exército Profissional').classList.contains('focus-node--blocked')).toBe(true);
    expect(within(details('Exército Profissional')).getByText('Pré-requisitos incompletos')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
    expect(view.onStartFocus).not.toHaveBeenCalled();
    view.rerender(<FocusModal {...view} techState={{...initial(),activeFocusId:'focus_national_unity'}} />);
    fireEvent.click(node('Modernização Militar'));
    expect(within(details('Modernização Militar')).getByText('Outro foco já ativo')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
  });
  it('opens rich details on hover with description, category, duration and formatted effects', () => {
    setup();
    fireEvent.mouseEnter(node('Modernização Militar'));
    const popup = details('Modernização Militar');
    expect(within(popup).getByText('Padroniza armas e treinamento da infantaria.')).toBeTruthy();
    expect(within(popup).getByText('Militar')).toBeTruthy();
    expect(within(popup).getByText('60 dias')).toBeTruthy();
    expect(within(popup).getByText(engine.formatFocusEffect(NATIONAL_FOCUSES[0].rewardEffects[0]))).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
  });
  it('resolves prerequisites and mutually exclusive choices to friendly titles without visible IDs', () => {
    const view = setup();
    fireEvent.click(node('Política de Alianças'));
    const popup = details('Política de Alianças');
    expect(within(popup).getByText('Diplomacia Regional')).toBeTruthy();
    expect(within(popup).getByText('Projeção Regional')).toBeTruthy();
    expect(view.container.textContent).not.toMatch(/focus_[a-z_]+/);
  });
  it('uses the canonical validation even for an otherwise available root', () => {
    const canonical = engine.getFocusBlockReason;
    const spy = vi.spyOn(engine,'getFocusBlockReason').mockImplementation((state,id) => id === 'focus_military_modernization' ? 'Bloqueio canônico de teste' : canonical(state,id));
    const view = setup();
    fireEvent.click(node('Modernização Militar'));
    expect(node('Modernização Militar').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('Bloqueio canônico de teste')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
    expect(view.onStartFocus).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith(initial(),'focus_military_modernization');
  });
  it('revalidates a pinned focus when state changes', () => {
    const view = setup();
    fireEvent.click(node('Modernização Militar'));
    expect(screen.getByRole('button',{name:'Iniciar foco'})).toBeTruthy();
    view.rerender(<FocusModal {...view} techState={{...initial(),activeFocusId:'focus_national_unity'}} />);
    expect(screen.queryByRole('button',{name:'Iniciar foco'})).toBeNull();
    expect(screen.getByText('Outro foco já ativo')).toBeTruthy();
    expect(view.onStartFocus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Voltar à árvore'}));
  });
  it('opens on keyboard focus, pins with native button activation and restores focus on Escape', () => {
    const view = setup();
    const available = node('Modernização Militar');
    expect(available.tagName).toBe('BUTTON');
    expect(available.tabIndex).toBe(0);
    act(() => available.focus());
    expect(details('Modernização Militar')).toBeTruthy();
    expect(available.getAttribute('aria-expanded')).toBe('true');
    fireEvent.scroll(screen.getByLabelText('Árvore de focos nacionais'));
    expect(details('Modernização Militar')).toBeTruthy();
    // jsdom does not synthesize native Enter -> click; dispatch its resulting activation.
    fireEvent.click(available);
    expect(document.activeElement).toBe(screen.getByRole('button',{name:'Iniciar foco'}));
    fireEvent.keyDown(document.activeElement!,{key:'Escape'});
    expect(screen.queryByRole('dialog',{name:'Detalhes de Modernização Militar'})).toBeNull();
    expect(document.activeElement).toBe(available);
    expect(view.onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(available,{key:'Escape'});
    expect(view.onClose).toHaveBeenCalledOnce();
  });
  it('traps Tab within the modal and restores the opener on unmount', () => {
    const opener = document.createElement('button');
    document.body.append(opener); opener.focus();
    const view = setup();
    const close = screen.getByRole('button',{name:'Fechar focos nacionais'});
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close,{key:'Tab',shiftKey:true});
    expect(document.activeElement).toBe(node(NATIONAL_FOCUSES[NATIONAL_FOCUSES.length-1].title));
    // Focusing the final node reveals its detail close button, now the final control.
    act(() => within(details(NATIONAL_FOCUSES[NATIONAL_FOCUSES.length-1].title)).getByRole('button',{name:'Fechar detalhes'}).focus());
    fireEvent.keyDown(document.activeElement!,{key:'Tab'});
    expect(document.activeElement).toBe(close);
    view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });
  it('keeps hover details open while moving into the popup and dismisses on leave or scroll', () => {
    vi.useFakeTimers();
    setup();
    const available = node('Modernização Militar');
    fireEvent.mouseEnter(available);
    fireEvent.mouseLeave(available);
    fireEvent.mouseEnter(details('Modernização Militar'));
    act(() => vi.advanceTimersByTime(200));
    expect(details('Modernização Militar')).toBeTruthy();
    fireEvent.mouseLeave(details('Modernização Militar'));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('dialog',{name:'Detalhes de Modernização Militar'})).toBeNull();
    fireEvent.click(available);
    fireEvent.scroll(screen.getByLabelText('Árvore de focos nacionais'));
    expect(screen.queryByRole('dialog',{name:'Detalhes de Modernização Militar'})).toBeNull();
  });
  it('creates a pointer-transparent SVG edge for every real prerequisite', () => {
    const view = setup({...initial(),activeFocusId:'focus_army_modernization',completedFocuses:['focus_military_modernization']});
    const edges = view.container.querySelectorAll('.focus-connection');
    expect(edges).toHaveLength(NATIONAL_FOCUSES.reduce((sum,f) => sum+(f.prerequisites?.length ?? 0),0));
    for (const focus of NATIONAL_FOCUSES) for (const id of focus.prerequisites ?? []) expect(view.container.querySelector(`path[data-source="${id}"][data-target="${focus.id}"]`)).toBeTruthy();
    expect(view.container.querySelector('.focus-tree-connections')?.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.querySelector('path[data-target="focus_army_modernization"]')?.classList.contains('focus-connection--active')).toBe(true);
    expect(view.container.querySelector('path[data-target="focus_cavalry_traditions"]')?.classList.contains('focus-connection--completed')).toBe(true);
  });
  it('closes through the labeled close button and backdrop', () => {
    const view = setup();
    fireEvent.click(screen.getByRole('button',{name:'Fechar focos nacionais'}));
    fireEvent.click(view.container.querySelector('.tech-modal__overlay')!);
    expect(view.onClose).toHaveBeenCalledTimes(2);
  });
});
